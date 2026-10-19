import crypto from 'node:crypto';
import path from 'node:path';
import {
  listUsers, listAllRoles, allRoleLabels, listAllWards, createCustomRole, createCustomWard,
  updateUserProfile, setUserAccess, IMAGING_SUBTYPES, IMAGING_SUBTYPE_DETAILS, IMAGING_GROUPS
} from '../access.mjs';
import {
  FACILITY_ROLES, getFacility, saveFacility, uploadFacilityDocument, facilityDocument, removeFacilityDocument
} from '../health-facility.mjs';
import {
  getNavigationSettings, navigationCatalog, updateNavigationSettings
} from '../navigation-settings.mjs';
import {
  getInterfaceTheme, updateInterfaceTheme, INTERFACE_PRESETS
} from '../interface-theme.mjs';
import {
  getOrganizationBranding, getOrganizationLogo, updateOrganizationBranding
} from '../organization-branding.mjs';
import {
  listESignatures, setESignature, signatureSnapshot
} from '../esign.mjs';
import { recentPatientTransfers } from '../patient-transfers.mjs';
import { listPendingAdmissionApprovals } from '../admission-approvals.mjs';
import { validateUsername, validatePassword, hashPassword } from '../password.mjs';
import { disabledDemoPasswordHash } from '../demo-accounts.mjs';

export function mountAdminRoutes(router) {
  // 1. Health Facility (Single handler or sub-routes for facility)
  // GET /api/admin/health-facility
  router.get('/api/admin/health-facility', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!FACILITY_ROLES.includes(requireContext(session))) return sendJson(response, 403, { error: 'Management access required.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, getFacility(database), { secure: config.cookieSecure });
  });

  // PUT /api/admin/health-facility
  router.put('/api/admin/health-facility', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!FACILITY_ROLES.includes(requireContext(session))) return sendJson(response, 403, { error: 'Management access required.' }, { secure: config.cookieSecure });
    try {
      const body = await readJson(request, 150000);
      const section = body?.section;
      const result = saveFacility(database, body, session.user_id);
      audit(database, request, 'HEALTH_FACILITY_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { section } });
      return sendJson(response, 200, result, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // GET /api/admin/health-facility/documents/:id
  router.get(/^\/api\/admin\/health-facility\/documents\/([0-9a-f-]{36})$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, sendBuffer, match } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!FACILITY_ROLES.includes(requireContext(session))) return sendJson(response, 403, { error: 'Management access required.' }, { secure: config.cookieSecure });
    const id = match[1];
    const file = facilityDocument(database, id);
    if (!file) return sendJson(response, 404, { error: 'File not found.' });
    response.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    response.setHeader('Cache-Control', 'no-store');
    return sendBuffer(response, file.bytes, file.mime, { secure: config.cookieSecure });
  });

  // POST /api/admin/health-facility/documents
  router.post('/api/admin/health-facility/documents', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!FACILITY_ROLES.includes(requireContext(session))) return sendJson(response, 403, { error: 'Management access required.' }, { secure: config.cookieSecure });
    try {
      const result = uploadFacilityDocument(database, await readJson(request, 8 * 1024 * 1024), session.user_id);
      audit(database, request, 'HEALTH_FACILITY_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { section: 'document' } });
      return sendJson(response, 200, result, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // DELETE /api/admin/health-facility/documents/:id
  router.delete(/^\/api\/admin\/health-facility\/documents\/([0-9a-f-]{36})$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, match, request, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!FACILITY_ROLES.includes(requireContext(session))) return sendJson(response, 403, { error: 'Management access required.' }, { secure: config.cookieSecure });
    const id = match[1];
    try {
      const result = removeFacilityDocument(database, id);
      audit(database, request, 'HEALTH_FACILITY_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { section: 'document' } });
      return sendJson(response, 200, result, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 2. Navigation settings
  router.get('/api/navigation-settings', async (ctx) => {
    const { session, database, sendJson, response, config } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, { settings: getNavigationSettings(database), catalog: navigationCatalog() }, { secure: config.cookieSecure });
  });

  router.post('/api/navigation-settings', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Management access required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 10000);
    try {
      const settings = updateNavigationSettings(database, body, session.user_id);
      audit(database, request, 'NAVIGATION_SETTINGS_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { role: body?.role } });
      return sendJson(response, 200, { settings }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 3. Interface theme
  router.get('/api/interface-theme', async (ctx) => {
    const { database, sendJson, response, config } = ctx;
    return sendJson(response, 200, { theme: getInterfaceTheme(database), presets: INTERFACE_PRESETS }, { secure: config.cookieSecure });
  });

  router.post('/api/interface-theme', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Management access required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 10000);
    try {
      const theme = updateInterfaceTheme(database, body, session.user_id);
      audit(database, request, 'INTERFACE_THEME_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: theme });
      return sendJson(response, 200, { theme }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 4. Organization Branding & Logo
  router.get('/api/organization/branding', async (ctx) => {
    const { database, sendJson, response, config } = ctx;
    return sendJson(response, 200, getOrganizationBranding(database), { secure: config.cookieSecure });
  });

  router.get('/api/organization/logo', async (ctx) => {
    const { database, response, config, sendBuffer, sendFile } = ctx;
    const logo = getOrganizationLogo(database);
    if (logo) return sendBuffer(response, logo.data, logo.mime, { secure: config.cookieSecure });
    return sendFile(response, path.join(config.publicDirectory, 'logo-hospital.jpg'), 'image/jpeg', { secure: config.cookieSecure }, true);
  });

  router.post('/api/admin/organization-branding', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Only management can change the organization name or logo.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 3 * 1024 * 1024);
    try {
      const branding = updateOrganizationBranding(database, body, session.user_id);
      audit(database, request, 'ORGANIZATION_BRANDING_UPDATED', {
        userId: session.user_id, subjectUsername: session.username,
        details: { nameKh: branding.nameKh, nameEn: branding.nameEn, hasCustomLogo: branding.hasCustomLogo }
      });
      return sendJson(response, 200, { branding }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 5. Operational District
  router.get('/api/operational-district', async (ctx) => {
    const { session, database, sendJson, response, config } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const facility = getFacility(database);
    const od = facility?.data?.operationalDistrict || { province: '16', districts: ['1601', '1603', '1607'] };
    return sendJson(response, 200, od, { secure: config.cookieSecure });
  });

  // 6. Audit & E-signatures
  router.get('/api/admin/audit', async (ctx) => {
    const { session, database, sendJson, response, config, sessionRole, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator or Director access is required.' }, { secure: config.cookieSecure });
    }
    const events = database.sqlite.prepare(`SELECT a.id,a.action,a.subject_username,a.details_json,a.occurred_at,
      u.display_name AS actor_name,u.username AS actor_username FROM audit_events a
      LEFT JOIN users u ON u.id=a.user_id ORDER BY a.occurred_at DESC LIMIT 300`).all().map(row => ({
        id: row.id, action: row.action, subjectUsername: row.subject_username || '',
        actorName: row.actor_name || '', actorUsername: row.actor_username || '',
        details: parseStoredJson(row.details_json), occurredAt: row.occurred_at,
      }));
    return sendJson(response, 200, { events }, { secure: config.cookieSecure });
  });

  router.get('/api/esignature/me', async (ctx) => {
    const { session, database, sendJson, response, config } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, {
      signature: signatureSnapshot(database, session, Date.now()),
    }, { secure: config.cookieSecure });
  });

  router.get('/api/admin/esignatures', async (ctx) => {
    const { session, database, sendJson, response, config, sessionRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator or Director access is required.' }, { secure: config.cookieSecure });
    }
    return sendJson(response, 200, { signatures: listESignatures(database) }, { secure: config.cookieSecure });
  });

  router.put(/^\/api\/admin\/esignatures\/([0-9a-f-]+)$/, async (ctx) => {
    const { session, database, sendJson, response, config, sessionRole, readJson, request, match, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, Math.min(config.maxPatientBodyBytes, 180_000));
    try {
      const signature = setESignature(database, match[1], body || {}, session.user_id, Date.now());
      if (!signature) return sendJson(response, 404, { error: 'User not found.' }, { secure: config.cookieSecure });
      audit(database, request, 'USER_ESIGN_UPDATED', {
        userId: session.user_id, subjectUsername: signature.username,
        details: { userId: signature.userId, signerName: signature.signerName, hasSignature: signature.hasSignature },
      });
      return sendJson(response, 200, { signature }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 7. Users, Roles & Wards
  router.get('/api/admin/users', async (ctx) => {
    const { session, database, sendJson, response, config, sessionRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator or Director access is required.' }, { secure: config.cookieSecure });
    }
    return sendJson(response, 200, {
      users: listUsers(database),
      roles: listAllRoles(database),
      roleLabels: allRoleLabels(database),
      wards: listAllWards(database),
      imagingSubtypes: IMAGING_SUBTYPES,
      imagingSubtypeDetails: IMAGING_SUBTYPE_DETAILS,
      imagingGroups: IMAGING_GROUPS,
    }, { secure: config.cookieSecure });
  });

  router.post('/api/admin/roles', async (ctx) => {
    const { session, database, sendJson, response, config, sessionRole, readJson, request, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 10_000);
    try {
      const role = createCustomRole(database, body || {});
      audit(database, request, 'ROLE_CREATED', { userId: session.user_id, details: role });
      return sendJson(response, 201, {
        role,
        roles: listAllRoles(database),
        roleLabels: allRoleLabels(database),
      }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/admin/wards', async (ctx) => {
    const { session, database, sendJson, response, config, sessionRole, readJson, request, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 10_000);
    try {
      const ward = createCustomWard(database, body || {});
      audit(database, request, 'WARD_CREATED', { userId: session.user_id, details: ward });
      return sendJson(response, 201, {
        ward,
        wards: listAllWards(database),
      }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post('/api/admin/users', async (ctx) => {
    const { session, database, sendJson, response, config, sessionRole, readJson, request, audit, boundedText } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    if (body?.userId) {
      const targetUser = database.findUserById ? database.findUserById(body.userId) : database.sqlite.prepare('SELECT * FROM users WHERE id = ?').get(body.userId);
      if (!targetUser) return sendJson(response, 404, { error: 'User not found.' }, { secure: config.cookieSecure });
      const roles = Array.isArray(body.roles) ? body.roles : body.role ? [body.role] : targetUser.roles || [targetUser.role];
      const wards = Array.isArray(body.wards) ? body.wards : Array.isArray(body.allowedWards) ? body.allowedWards : undefined;
      const imagingSubtypes = Array.isArray(body.imagingSubtypes) ? body.imagingSubtypes : undefined;
      const updated = updateUserProfile(database, body.userId, {
        displayName: body.displayName || targetUser.display_name,
        roles,
        wards,
        imagingSubtypes
      });
      audit(database, request, 'USER_UPDATED', { userId: session.user_id, subjectUsername: updated.username, details: { roles, wards, imagingSubtypes } });
      return sendJson(response, 200, { user: listUsers(database).find(item => item.id === body.userId) }, { secure: config.cookieSecure });
    }
    let username;
    try { username = validateUsername(body?.username); }
    catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
    const displayName = boundedText(body?.displayName, 100, 'Display name', true);
    const roles = Array.isArray(body?.roles) ? body.roles : [];
    const wards = Array.isArray(body?.wards) ? body.wards : [];
    const imagingSubtypes = Array.isArray(body?.imagingSubtypes) ? body.imagingSubtypes : undefined;
    const password = String(body?.password || '');
    if (!config.demoMode) {
      try { validatePassword(password); }
      catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
    }
    if (database.findUser(username)) return sendJson(response, 409, { error: 'That username already exists.' }, { secure: config.cookieSecure });
    if (!roles.length) return sendJson(response, 400, { error: 'Select at least one role.' }, { secure: config.cookieSecure });
    const now = Date.now();
    const id = crypto.randomUUID();
    const mustChangePassword = config.demoMode ? false : true;
    try {
      database.createUser({
        id, username, displayName, role: String(roles[0]).toUpperCase(),
        passwordHash: config.demoMode ? disabledDemoPasswordHash() : await hashPassword(password),
        mustChangePassword,
        createdAt: now
      });
      setUserAccess(database, id, roles, wards, now, imagingSubtypes);
    } catch (error) {
      database.sqlite.prepare('DELETE FROM users WHERE id=?').run(id);
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
    audit(database, request, 'USER_CREATED', { userId: session.user_id, subjectUsername: username, details: { roles, wards, imagingSubtypes } });
    return sendJson(response, 201, { user: listUsers(database).find(item => item.id === id) }, { secure: config.cookieSecure });
  });

  router.patch(/^\/api\/admin\/users\/([0-9a-f-]+)$/, async (ctx) => {
    const { session, database, sendJson, response, config, sessionRole, readJson, request, match, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    try {
      const updated = updateUserProfile(database, match[1], body || {});
      if (!updated) return sendJson(response, 404, { error: 'User not found.' }, { secure: config.cookieSecure });
      audit(database, request, 'USER_UPDATED', { userId: session.user_id, subjectUsername: updated.username, details: { roles: body?.roles, wards: body?.wards, isActive: body?.isActive } });
      return sendJson(response, 200, { user: listUsers(database).find(item => item.id === match[1]) }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  router.post(/^\/api\/admin\/users\/([0-9a-f-]+)\/reset-password$/, async (ctx) => {
    const { session, database, sendJson, response, config, sessionRole, readJson, request, match, audit } = ctx;
    if (config.demoMode) return sendJson(response, 404, { error: 'Passwords are disabled in this demo.' }, { secure: config.cookieSecure });
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const password = String(body?.password || '');
    try { validatePassword(password); }
    catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
    const user = database.sqlite.prepare('SELECT id,username FROM users WHERE id=?').get(match[1]);
    if (!user) return sendJson(response, 404, { error: 'User not found.' }, { secure: config.cookieSecure });
    const now = Date.now();
    database.sqlite.prepare('UPDATE users SET password_hash=?, must_change_password=1, updated_at=? WHERE id=?').run(await hashPassword(password), now, user.id);
    database.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run(user.id);
    audit(database, request, 'PASSWORD_RESET_BY_ADMIN', { userId: session.user_id, subjectUsername: user.username });
    return sendJson(response, 200, { ok: true }, { secure: config.cookieSecure });
  });

  // 8. Patient Transfers (Admin view)
  router.get('/api/admin/patient-transfers', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Administrator or director access is required.' }, { secure: config.cookieSecure });
    }
    return sendJson(response, 200, { transfers: recentPatientTransfers(database) }, { secure: config.cookieSecure });
  });

  // 9. Admin Dashboard
  router.get('/api/admin/dashboard', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Administrator or Director access is required.' }, { secure: config.cookieSecure });
    }
    const rolePending = key => listPendingAdmissionApprovals(database, key);
    const patients = database.listPatients();
    const activePatients = patients.filter(row => !row.discharge_date);
    const pendingAdmin = rolePending('ADMIN');
    const pendingDirector = rolePending('DIRECTOR');
    return sendJson(response, 200, {
      role,
      stats: {
        total: patients.length,
        active: activePatients.length,
        ipdWaitingForAdmin: pendingAdmin.length,
        ipdWaitingForDirector: pendingDirector.length
      },
      pendingAdmin,
      pendingDirector
    }, { secure: config.cookieSecure });
  });
}
