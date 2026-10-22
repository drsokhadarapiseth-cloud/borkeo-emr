// v41.0 - /api/clinical-summary: structured allergies, active problem list and
// resuscitation status for the patient banner and the SOAP boxes.
import {
  CLINICAL_SUMMARY_WRITE_ROLES, addAllergy, addProblem, allergyAlert, clinicalOptions, clinicalSummary, displayRules,
  removeAllergy, setProblemStatus, setResuscitationStatus,
} from '../clinical-summary.mjs';

export function mountClinicalSummaryRoutes(router) {
  // Resolves the patient and checks access; returns null after sending an error.
  function patientFor(ctx, patientKey, write) {
    const { response, session, database, config, sendJson, requireContext, clinicalPatientKey, canAccessPatient, clinicalFormReadRoles } = ctx;
    if (!session) { sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure }); return null; }
    const role = requireContext(session);
    const allowed = write ? CLINICAL_SUMMARY_WRITE_ROLES.has(role) : clinicalFormReadRoles.has(role);
    if (!allowed) { sendJson(response, 403, { error: write ? 'Only doctors can change the clinical summary.' : 'Clinical access is required.' }, { secure: config.cookieSecure }); return null; }
    const row = database.findPatient(clinicalPatientKey(patientKey));
    if (!row || !canAccessPatient(database, session, row)) { sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure }); return null; }
    return { row, role };
  }

  function respond(ctx, status, row, extra = {}) {
    const { response, database, config, sendJson, parseStoredJson } = ctx;
    const summary = clinicalSummary(database, row);
    return sendJson(response, status, { ...summary, allergyAlert: allergyAlert(summary.allergies, parseStoredJson(row.record_json)), ...extra }, { secure: config.cookieSecure });
  }

  // v41.1: display rules by age and sex for the medical record page.
  router.get('/api/clinical-options', async (ctx) => {
    const { response, session, config, sendJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, { displayRules: displayRules(), earlyWarning: clinicalOptions().earlyWarning }, { secure: config.cookieSecure });
  });

  router.get('/api/clinical-summary', async (ctx) => {
    const found = patientFor(ctx, ctx.url.searchParams.get('patientKey'), false);
    if (!found) return true;
    return respond(ctx, 200, found.row);
  });

  // POST /api/clinical-summary/{allergies|allergies/:id/remove|problems|problems/:id/status|resuscitation}
  router.post(/^\/api\/clinical-summary\/(allergies|problems|resuscitation)(?:\/([0-9a-f-]{36})\/(remove|status))?$/, async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, audit, routeParams } = ctx;
    const body = await readJson(request, 20_000);
    const found = patientFor(ctx, body?.patientKey, true);
    if (!found) return true;
    const [, kind, itemId, action] = routeParams;
    const actor = { ...session, activeRole: found.role };
    try {
      let event, details;
      if (kind === 'allergies' && !itemId) {
        const allergy = addAllergy(database, found.row, actor, body);
        event = 'ALLERGY_RECORDED'; details = { allergyId: allergy.id, allergyType: allergy.allergyType };
      } else if (kind === 'allergies' && action === 'remove') {
        if (!removeAllergy(database, found.row, actor, itemId, body?.reason)) return sendJson(response, 404, { error: 'Allergy was not found.' }, { secure: config.cookieSecure });
        event = 'ALLERGY_REMOVED'; details = { allergyId: itemId };
      } else if (kind === 'problems' && !itemId) {
        const problem = addProblem(database, found.row, actor, body);
        event = 'PROBLEM_RECORDED'; details = { problemId: problem.id };
      } else if (kind === 'problems' && action === 'status') {
        if (!setProblemStatus(database, found.row, actor, itemId, body?.status)) return sendJson(response, 404, { error: 'Problem was not found or already has that status.' }, { secure: config.cookieSecure });
        event = 'PROBLEM_STATUS_CHANGED'; details = { problemId: itemId, status: body?.status };
      } else if (kind === 'resuscitation' && !itemId) {
        const value = setResuscitationStatus(database, found.row, actor, body?.status);
        event = 'RESUSCITATION_STATUS_RECORDED'; details = { status: value.status };
      } else {
        return sendJson(response, 404, { error: 'Not found.' }, { secure: config.cookieSecure });
      }
      audit(database, request, event, { userId: session.user_id, subjectUsername: session.username, details: { patientKey: found.row.patient_key, ...details } });
      return respond(ctx, kind === 'resuscitation' || !itemId ? 201 : 200, found.row);
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });
}
