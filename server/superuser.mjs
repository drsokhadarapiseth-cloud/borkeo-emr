import crypto from 'node:crypto';
import { ROLES, listAllWards, setUserAccess, IMAGING_SUBTYPES } from './access.mjs';
import { setESignature } from './esign.mjs';
import { defaultLogger } from './logger.mjs';

export const SUPERUSER_USERNAME = 'Superuser';
export const SUPERUSER_PASSWORD = '1234';
// v42.4: in production the password comes from SUPERUSER_PASSWORD and must
// have at least this many characters; otherwise the account cannot log in.
export const SUPERUSER_PRODUCTION_MIN_LENGTH = 12;

const SCRYPT = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

function passwordHash(password) {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64url'), derived.toString('base64url')].join('$');
}

// Same format and check as server/password.mjs verifyPassword (synchronous here,
// because the account is prepared while the server starts).
export function passwordMatchesHash(password, encoded) {
  try {
    const [algorithm, n, r, p, saltText, hashText] = String(encoded || '').split('$');
    if (algorithm !== 'scrypt' || !hashText) return false;
    const expected = Buffer.from(hashText, 'base64url');
    const actual = crypto.scryptSync(String(password), Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem,
    });
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// options.production: true on an online server (NODE_ENV=production or EMR_MODE=production).
// options.password: SUPERUSER_PASSWORD (production only). It is never logged.
export function ensureSuperuser(database, now = Date.now(), options = {}) {
  const production = options.production === true;
  const productionPassword = String(options.password || '');
  const productionUsable = productionPassword.length >= SUPERUSER_PRODUCTION_MIN_LENGTH;
  const existing = database.findUser(SUPERUSER_USERNAME);
  // v42.1: the Superuser is a "switch user type" account. It holds every real
  // staff role and every ward (so it can switch to any user type), but never
  // the SUPERUSER role itself: setUserAccess replaces the account's rows, so an
  // old SUPERUSER row in user_roles is removed here.
  const allRoles = [...ROLES];
  const allWardCodes = listAllWards(database).map(w => w.code);
  let userId;

  if (!production) {
    // Hospital computer and local demo: Superuser / 1234, reset at every start (unchanged).
    const hash = passwordHash(SUPERUSER_PASSWORD);
    if (existing) {
      userId = existing.id;
      database.sqlite.prepare(`
        UPDATE users
        SET password_hash = ?, is_active = 1, must_change_password = 0, updated_at = ?
        WHERE id = ?
      `).run(hash, now, userId);
    } else {
      userId = crypto.randomUUID();
      database.createUser({ id: userId, username: SUPERUSER_USERNAME, displayName: SUPERUSER_USERNAME, role: 'ADMIN', passwordHash: hash, createdAt: now });
    }
  } else if (!productionUsable) {
    // v42.4: online server without a strong SUPERUSER_PASSWORD: the account
    // cannot log in. The server still starts.
    defaultLogger.warn(`Superuser login is disabled: set SUPERUSER_PASSWORD (at least ${SUPERUSER_PRODUCTION_MIN_LENGTH} characters) to use the Superuser account on this server.`);
    if (existing) {
      userId = existing.id;
      database.sqlite.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?').run(now, userId);
      database.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    } else {
      userId = crypto.randomUUID();
      // A random unusable password; the account stays inactive.
      database.createUser({ id: userId, username: SUPERUSER_USERNAME, displayName: SUPERUSER_USERNAME, role: 'ADMIN', passwordHash: passwordHash(crypto.randomBytes(32).toString('base64url')), createdAt: now });
      database.sqlite.prepare('UPDATE users SET is_active = 0 WHERE id = ?').run(userId);
    }
  } else if (existing) {
    // v42.4: the password changes only when SUPERUSER_PASSWORD changes (not at every start).
    userId = existing.id;
    if (!passwordMatchesHash(productionPassword, existing.password_hash)) {
      database.sqlite.prepare('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?').run(passwordHash(productionPassword), now, userId);
      database.sqlite.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
    }
    database.sqlite.prepare('UPDATE users SET is_active = 1, must_change_password = 0 WHERE id = ?').run(userId);
  } else {
    userId = crypto.randomUUID();
    database.createUser({ id: userId, username: SUPERUSER_USERNAME, displayName: SUPERUSER_USERNAME, role: 'ADMIN', passwordHash: passwordHash(productionPassword), createdAt: now });
  }

  setUserAccess(database, userId, allRoles, allWardCodes, now, IMAGING_SUBTYPES);
  try {
    setESignature(database, userId, { signerName: SUPERUSER_USERNAME }, userId, now);
  } catch {}

  try {
    database.audit({
      id: crypto.randomUUID(),
      userId,
      subjectUsername: SUPERUSER_USERNAME,
      action: 'SUPERUSER_ENSURED',
      details: { username: SUPERUSER_USERNAME, roles: allRoles.length, wards: allWardCodes.length, production, active: !production || productionUsable },
      occurredAt: now,
    });
  } catch {}

  return userId;
}

// v42.4: number of active accounts whose password is still the shared default
// 1234 (for a startup warning on an online server). No password is returned.
export function countDefaultPasswordAccounts(database) {
  const rows = database.sqlite.prepare('SELECT username, password_hash FROM users WHERE is_active = 1').all();
  return rows.filter(row => passwordMatchesHash(SUPERUSER_PASSWORD, row.password_hash)).length;
}
