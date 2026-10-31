import {
  normalizeUsername, randomToken, tokenHash, validatePassword, verifyPassword, hashPassword
} from '../password.mjs';
import { defaultContext, getUserAccess, setSessionContext, readSessionContext, sessionRole, isSuperuser } from '../access.mjs';
import { generateTotpSecret, generateTotpUri, verifyTotpCode } from '../totp.mjs';
import { validate, Schemas } from '../validation.mjs';

const dummyPasswordHash = 'scrypt$32768$8$1$MDAwMDAwMDAwMDAwMDAwMA$qM8HKw2pZpspPRTL7ogxHkbKyCS16wfj9nXQEvqHjsqDxIZAFCPmi5VMUNk7uHaRY_xUAyguLh4k6j8W3mimNQ';

export function mountAuthRoutes(router) {
  // GET /api/auth/config
  router.get('/api/auth/config', async (ctx) => {
    const { database, config, sendJson, response, listUsers } = ctx;
    const accounts = config.demoMode
      ? listUsers(database).filter(u => u.isActive).map(u => ({
          username: u.username,
          displayName: u.displayName,
          roles: u.roles || [u.role],
          wards: u.wards || [],
        }))
      : [];
    // v42.4: an online server (production) lists no accounts on the login page.
    return sendJson(response, 200, { demoMode: config.demoMode, production: config.isProduction === true, accounts }, { secure: config.cookieSecure });
  });

  // GET /api/auth/me
  router.get('/api/auth/me', async (ctx) => {
    const { session, database, config, sendJson, response, buildIdentity } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const identity = buildIdentity(database, session);
    return sendJson(response, 200, { user: identity, csrfToken: session.csrf_token, demoMode: config.demoMode }, { secure: config.cookieSecure });
  });

  // POST /api/auth/login
  router.post('/api/auth/login', async (ctx) => {
    const { request, response, database, config, sendJson, readJson, sameOrigin, requestIp, genericLoginFailure, buildIdentity, audit, serializeSessionCookie } = ctx;
    if (!sameOrigin(request, config)) {
      return sendJson(response, 403, { error: 'Request origin was rejected.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const validRes = validate(body, Schemas.login);
    if (!validRes.valid) {
      return sendJson(response, 400, { error: 'Login information is invalid.', details: validRes.errors }, { secure: config.cookieSecure });
    }
    const username = normalizeUsername(body.username);
    const ipKey = `ip:${requestIp(request)}`;
    const userKey = `user:${username}`;
    const now = Date.now();
    const limits = [
      database.loginLimitStatus(ipKey, now, config.loginWindowMs),
      database.loginLimitStatus(userKey, now, config.loginWindowMs),
    ];
    const blocked = limits.find(limit => limit.blocked);
    if (blocked) return genericLoginFailure(response, config, Math.ceil(blocked.retryAfterMs / 1000));

    const user = database.findUser(username);
    const valid = config.demoMode
      ? user?.is_active === 1
      : await verifyPassword(String(body.password ?? ''), user?.password_hash ?? dummyPasswordHash);
    if (!user || !valid || user.is_active !== 1) {
      database.recordLoginFailure(ipKey, now, config.loginWindowMs, config.loginMaxAttempts);
      database.recordLoginFailure(userKey, now, config.loginWindowMs, config.loginMaxAttempts);
      audit(database, request, 'LOGIN_FAILED', { subjectUsername: username });
      return genericLoginFailure(response, config, 0);
    }

    if (!config.demoMode && user.totp_enabled === 1 && ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(user.role)) {
      if (!body.totpCode) {
        return sendJson(response, 200, {
          totpRequired: true,
          username: user.username,
          message: 'Two-factor authentication code required.'
        }, { secure: config.cookieSecure });
      }
      if (!verifyTotpCode(body.totpCode, user.totp_secret)) {
        database.recordLoginFailure(ipKey, now, config.loginWindowMs, config.loginMaxAttempts);
        database.recordLoginFailure(userKey, now, config.loginWindowMs, config.loginMaxAttempts);
        audit(database, request, 'LOGIN_FAILED_INVALID_TOTP', { subjectUsername: username });
        return genericLoginFailure(response, config, 0);
      }
    }

    database.clearLoginLimit(ipKey);
    database.clearLoginLimit(userKey);
    const rawToken = randomToken();
    const csrfToken = randomToken();
    const hash = tokenHash(rawToken);
    database.createSession({
      tokenHash: hash,
      userId: user.id,
      csrfToken,
      createdAt: now,
      expiresAt: now + config.sessionTtlMs,
    });
    const automatic = defaultContext(getUserAccess(database, user.id), user);
    if (automatic) setSessionContext(database, hash, user.id, automatic.role, automatic.wardCode);
    database.markLogin(user.id, now);
    const context = readSessionContext(database, hash);
    const identity = buildIdentity(database, {
      user_id: user.id, username: user.username, display_name: user.display_name,
      ...context,
    });
    audit(database, request, 'LOGIN_SUCCEEDED', {
      userId: user.id, subjectUsername: user.username,
      details: { automaticContext: automatic || null, demoMode: config.demoMode },
    });
    response.setHeader('Set-Cookie', serializeSessionCookie(
      rawToken, config.sessionTtlMs / 1000, config.cookieSecure,
    ));
    return sendJson(response, 200, {
      user: identity,
      needsContext: identity.needsContext,
      mustChangePassword: Boolean(user.must_change_password)
    }, { secure: config.cookieSecure });
  }, { skipCsrf: true }); // Unauthenticated login endpoint

  // POST /api/auth/context
  router.post('/api/auth/context', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, buildIdentity, audit, landingPathForRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, config.maxBodyBytes);
    const validRes = validate(body, Schemas.authContext);
    if (!validRes.valid) return sendJson(response, 400, { error: validRes.error, details: validRes.errors }, { secure: config.cookieSecure });
    try {
      const chosen = setSessionContext(database, session.tokenHash, session.user_id, body?.role, body?.wardCode || '');
      await ctx.pmrs?.closeToken(session.tokenHash);
      const refreshed = { ...session, active_role: chosen.role, active_ward_code: chosen.wardCode, active_ward_name: chosen.wardName };
      const identity = buildIdentity(database, refreshed);
      audit(database, request, 'WORK_CONTEXT_CHANGED', {
        userId: session.user_id, subjectUsername: session.username,
        details: { role: chosen.role, wardCode: chosen.wardCode, ...(isSuperuser(session) ? { switchedBy: 'Superuser' } : {}) },
      });
      // v42.1: the landing page of the chosen user type, the same as after a
      // real login (one source of truth for /context and the switch window).
      const landingPath = landingPathForRole(chosen.role, chosen.wardCode);
      return sendJson(response, 200, { user: identity, landingPath }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // POST /api/auth/change-password
  router.post('/api/auth/change-password', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, audit, clearSessionCookie } = ctx;
    if (config.demoMode) return sendJson(response, 404, { error: 'Passwords are disabled in this demo.' }, { secure: config.cookieSecure });
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, config.maxBodyBytes);
    const validRes = validate(body, Schemas.changePassword);
    if (!validRes.valid) return sendJson(response, 400, { error: validRes.error, details: validRes.errors }, { secure: config.cookieSecure });
    const currentPassword = String(body.currentPassword);
    const newPassword = String(body.newPassword);
    const confirmation = String(body.confirmation);
    if (newPassword !== confirmation) return sendJson(response, 400, { error: 'New passwords do not match.' }, { secure: config.cookieSecure });
    try { validatePassword(newPassword); }
    catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
    const user = database.findUser(session.username);
    if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
      return sendJson(response, 400, { error: 'Current password is incorrect.' }, { secure: config.cookieSecure });
    }
    const now = Date.now();
    database.sqlite.prepare('UPDATE users SET password_hash=?, must_change_password=0, updated_at=? WHERE id=?')
      .run(await hashPassword(newPassword), now, session.user_id);
    database.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(session.user_id);
    audit(database, request, 'PASSWORD_CHANGED', { userId: session.user_id, subjectUsername: session.username });
    response.setHeader('Set-Cookie', clearSessionCookie(config.cookieSecure));
    return sendJson(response, 200, { ok: true, reauthenticate: true }, { secure: config.cookieSecure });
  });

  // GET /api/auth/2fa/setup
  router.get('/api/auth/2fa/setup', async (ctx) => {
    const { session, config, sendJson, response } = ctx;
    if (config.demoMode) return sendJson(response, 404, { error: 'Two-factor authentication is not available in demo mode.' }, { secure: config.cookieSecure });
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = sessionRole(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Two-factor authentication is only available for Administrator and Director accounts.' }, { secure: config.cookieSecure });
    }
    const secret = generateTotpSecret();
    const uri = generateTotpUri(session.username, secret);
    return sendJson(response, 200, { secret, uri }, { secure: config.cookieSecure });
  });

  // POST /api/auth/2fa/enable
  router.post('/api/auth/2fa/enable', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, audit } = ctx;
    if (config.demoMode) return sendJson(response, 404, { error: 'Two-factor authentication is not available in demo mode.' }, { secure: config.cookieSecure });
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = sessionRole(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Two-factor authentication is only available for Administrator and Director accounts.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const secret = String(body?.secret || '').trim();
    const code = String(body?.code || '').trim();
    if (!secret || !code) {
      return sendJson(response, 400, { error: 'Secret and verification code are required.' }, { secure: config.cookieSecure });
    }
    if (!verifyTotpCode(code, secret)) {
      return sendJson(response, 400, { error: 'Verification code is invalid or expired.' }, { secure: config.cookieSecure });
    }
    database.setUserTotp(session.user_id, secret, 1);
    audit(database, request, 'TOTP_ENABLED', { userId: session.user_id, subjectUsername: session.username });
    return sendJson(response, 200, { ok: true, enabled: true }, { secure: config.cookieSecure });
  });

  // POST /api/auth/2fa/disable
  router.post('/api/auth/2fa/disable', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, audit } = ctx;
    if (config.demoMode) return sendJson(response, 404, { error: 'Two-factor authentication is not available in demo mode.' }, { secure: config.cookieSecure });
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, config.maxBodyBytes);
    const password = String(body?.password || '');
    const user = database.findUser(session.username);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      return sendJson(response, 400, { error: 'Current password is incorrect.' }, { secure: config.cookieSecure });
    }
    database.setUserTotp(session.user_id, null, 0);
    audit(database, request, 'TOTP_DISABLED', { userId: session.user_id, subjectUsername: session.username });
    return sendJson(response, 200, { ok: true, enabled: false }, { secure: config.cookieSecure });
  });

  // POST /api/auth/logout
  router.post('/api/auth/logout', async (ctx) => {
    const { request, response, session, database, config, sendJson, audit, clearSessionCookie } = ctx;
    if (!session) {
      response.setHeader('Set-Cookie', clearSessionCookie(config.cookieSecure));
      return sendJson(response, 200, { ok: true }, { secure: config.cookieSecure });
    }
    await ctx.pmrs?.closeToken(session.tokenHash);
    database.deleteSession(session.tokenHash);
    audit(database, request, 'LOGOUT', { userId: session.user_id, subjectUsername: session.username });
    response.setHeader('Set-Cookie', clearSessionCookie(config.cookieSecure));
    return sendJson(response, 200, { ok: true }, { secure: config.cookieSecure });
  });
}
