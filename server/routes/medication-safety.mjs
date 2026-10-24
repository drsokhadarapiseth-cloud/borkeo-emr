// v41.2 - /api/medication-administrations (MAR), /api/prescribing-overrides and
// /api/drug-safety (interaction and maximum-dose tables).
import {
  DRUG_SAFETY_APPROVE_ROLES, DRUG_SAFETY_EDIT_ROLES, DRUG_SAFETY_VIEW_ROLES, MAR_WRITE_ROLES, OVERRIDE_ROLES,
  addInteraction, addMaxDose, drugSafetyTables, listAdministrations, recordAdministration,
  recordOverride, recordUnconvertedDose, removeDrugSafetyRow, reviewMaxDose, updateMaxDose, voidAdministration,
} from '../medication-safety.mjs';

export function mountMedicationSafetyRoutes(router) {
  const fail = (ctx, status, error) => ctx.sendJson(ctx.response, status, { error }, { secure: ctx.config.cookieSecure });

  // Resolves the patient and checks the role; returns null after sending an error.
  function patientFor(ctx, patientKey, roles) {
    const { session, database, requireContext, clinicalPatientKey, canAccessPatient, clinicalFormReadRoles } = ctx;
    if (!session) { fail(ctx, 401, 'Authentication required.'); return null; }
    const role = requireContext(session);
    if (!(roles || clinicalFormReadRoles).has(role)) { fail(ctx, 403, 'Your role cannot do this.'); return null; }
    const row = database.findPatient(clinicalPatientKey(patientKey));
    if (!row || !canAccessPatient(database, session, row)) { fail(ctx, 404, 'Patient not found.'); return null; }
    return { row, role, actor: { ...ctx.session, activeRole: role, active_role: role } };
  }

  const administrations = (ctx, status, row) => ctx.sendJson(ctx.response, status,
    { administrations: listAdministrations(ctx.database, row.patient_key) }, { secure: ctx.config.cookieSecure });

  router.get('/api/medication-administrations', async (ctx) => {
    const found = patientFor(ctx, ctx.url.searchParams.get('patientKey'));
    if (!found) return true;
    return administrations(ctx, 200, found.row);
  });

  router.post(/^\/api\/medication-administrations(?:\/([0-9a-f-]{36})\/void)?$/, async (ctx) => {
    const { request, session, database, readJson, audit, routeParams } = ctx;
    const body = await readJson(request, 20_000);
    const found = patientFor(ctx, body?.patientKey, MAR_WRITE_ROLES);
    if (!found) return true;
    const [, voidId] = routeParams;
    try {
      if (voidId) {
        if (!voidAdministration(database, found.row.patient_key, found.actor, voidId, body?.reason)) return fail(ctx, 404, 'Entry not found or already corrected.');
        audit(database, request, 'MEDICATION_ADMINISTRATION_VOIDED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: found.row.patient_key, administrationId: voidId } });
        return administrations(ctx, 200, found.row);
      }
      const entry = recordAdministration(database, found.row.patient_key, found.actor, body);
      audit(database, request, 'MEDICATION_ADMINISTRATION_RECORDED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: found.row.patient_key, administrationId: entry.id, status: entry.status } });
      return administrations(ctx, 201, found.row);
    } catch (error) {
      return fail(ctx, error.status || 400, error.message);
    }
  });

  router.post('/api/prescribing-overrides', async (ctx) => {
    const { request, session, database, readJson, audit, sendJson, response, config } = ctx;
    const body = await readJson(request, 20_000);
    const found = patientFor(ctx, body?.patientKey, OVERRIDE_ROLES);
    if (!found) return true;
    try {
      const entry = recordOverride(database, found.row.patient_key, found.actor, body);
      audit(database, request, 'PRESCRIBING_WARNING_OVERRIDDEN', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: found.row.patient_key, overrideId: entry.id, medicine: entry.medicine, kinds: entry.warnings.map((w) => w.kind) } });
      return sendJson(response, 201, { override: entry }, { secure: config.cookieSecure });
    } catch (error) {
      return fail(ctx, 400, error.message);
    }
  });

  router.get('/api/drug-safety', async (ctx) => {
    const { session, database, requireContext, sendJson, response, config } = ctx;
    if (!session) return fail(ctx, 401, 'Authentication required.');
    const role = requireContext(session);
    if (!DRUG_SAFETY_VIEW_ROLES.has(role)) return fail(ctx, 403, 'Your role cannot view this.');
    return sendJson(response, 200, { ...drugSafetyTables(database), canEdit: DRUG_SAFETY_EDIT_ROLES.has(role), canApprove: DRUG_SAFETY_APPROVE_ROLES.has(role) }, { secure: config.cookieSecure });
  });

  // v42.5: POST /api/drug-safety/max-doses/:id/{update|approve|reject}
  // update: administrators (the line goes back to draft); approve / reject:
  // the Head of Pharmacy or the Director (name and time saved, audited).
  router.post(/^\/api\/drug-safety\/max-doses\/([0-9a-f-]{36})\/(update|approve|reject)$/, async (ctx) => {
    const { request, session, database, requireContext, readJson, audit, routeParams, sendJson, response, config } = ctx;
    if (!session) return fail(ctx, 401, 'Authentication required.');
    const role = requireContext(session);
    const [, id, action] = routeParams;
    const allowed = action === 'update' ? DRUG_SAFETY_EDIT_ROLES : DRUG_SAFETY_APPROVE_ROLES;
    if (!allowed.has(role)) return fail(ctx, 403, action === 'update' ? 'Only an administrator can change these tables.' : 'Only the Head of Pharmacy or the Director can approve.');
    const body = await readJson(request, 20_000);
    try {
      const actor = { ...session, activeRole: role, active_role: role };
      const entry = action === 'update' ? updateMaxDose(database, actor, id, body) : reviewMaxDose(database, actor, id, action);
      if (!entry) return fail(ctx, 404, 'Not found.');
      const event = { update: 'DRUG_MAX_DOSE_UPDATED', approve: 'DRUG_MAX_DOSE_APPROVED', reject: 'DRUG_MAX_DOSE_REJECTED' }[action];
      audit(database, request, event, { userId: session.user_id, subjectUsername: session.username, details: { id, doseKey: entry.doseKey, status: entry.status } });
      return sendJson(response, 200, { ...drugSafetyTables(database), canEdit: DRUG_SAFETY_EDIT_ROLES.has(role), canApprove: DRUG_SAFETY_APPROVE_ROLES.has(role) }, { secure: config.cookieSecure });
    } catch (error) {
      return fail(ctx, 400, error.message);
    }
  });

  // v42.5: a prescribed dose the check could not convert to the unit of the
  // limit; the pharmacist sees the list on the drug safety page.
  router.post('/api/drug-safety/unconverted', async (ctx) => {
    const { request, session, database, requireContext, readJson, sendJson, response, config } = ctx;
    if (!session) return fail(ctx, 401, 'Authentication required.');
    if (!OVERRIDE_ROLES.has(requireContext(session))) return fail(ctx, 403, 'Your role cannot do this.');
    const body = await readJson(request, 5_000);
    try {
      return sendJson(response, 201, { entry: recordUnconvertedDose(database, session, body) }, { secure: config.cookieSecure });
    } catch (error) {
      return fail(ctx, 400, error.message);
    }
  });

  // POST /api/drug-safety/{interactions|max-doses}[/:id/delete] (administrators)
  router.post(/^\/api\/drug-safety\/(interactions|max-doses)(?:\/([0-9a-f-]{36})\/delete)?$/, async (ctx) => {
    const { request, session, database, requireContext, readJson, audit, routeParams, sendJson, response, config } = ctx;
    if (!session) return fail(ctx, 401, 'Authentication required.');
    if (!DRUG_SAFETY_EDIT_ROLES.has(requireContext(session))) return fail(ctx, 403, 'Only an administrator can change these tables.');
    const body = await readJson(request, 20_000);
    const [, table, deleteId] = routeParams;
    try {
      if (deleteId) {
        if (!removeDrugSafetyRow(database, table, deleteId)) return fail(ctx, 404, 'Not found.');
        audit(database, request, 'DRUG_SAFETY_ROW_DELETED', { userId: session.user_id, subjectUsername: session.username, details: { table, id: deleteId } });
      } else {
        const entry = table === 'interactions' ? addInteraction(database, session, body) : addMaxDose(database, session, body);
        audit(database, request, 'DRUG_SAFETY_ROW_ADDED', { userId: session.user_id, subjectUsername: session.username, details: { table, id: entry.id } });
      }
      return sendJson(response, 200, { ...drugSafetyTables(database), canEdit: true }, { secure: config.cookieSecure });
    } catch (error) {
      return fail(ctx, 400, error.message);
    }
  });
}
