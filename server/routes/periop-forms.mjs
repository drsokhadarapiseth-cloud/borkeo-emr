// v41.3 - /api/periop-forms: consents, surgery, anaesthesia and transfusion forms.
import { PERIOP_WRITE_ROLES, listPeriopForms, savePeriopForm, signPeriopForm } from '../periop-forms.mjs';
import { clinicalOptions } from '../clinical-summary.mjs';

export function mountPeriopFormRoutes(router) {
  const fail = (ctx, status, error) => ctx.sendJson(ctx.response, status, { error }, { secure: ctx.config.cookieSecure });

  function patientFor(ctx, patientKey, write) {
    const { session, database, requireContext, clinicalPatientKey, canAccessPatient, clinicalFormReadRoles } = ctx;
    if (!session) { fail(ctx, 401, 'Authentication required.'); return null; }
    const role = requireContext(session);
    if (!(write ? PERIOP_WRITE_ROLES : clinicalFormReadRoles).has(role)) { fail(ctx, 403, 'Your role cannot do this.'); return null; }
    const row = database.findPatient(clinicalPatientKey(patientKey));
    if (!row || !canAccessPatient(database, session, row)) { fail(ctx, 404, 'Patient not found.'); return null; }
    return { row, actor: { ...session, activeRole: role, active_role: role } };
  }

  const respond = (ctx, status, row) => ctx.sendJson(ctx.response, status, {
    forms: listPeriopForms(ctx.database, row.patient_key), whoChecklist: clinicalOptions().whoChecklist,
    newbornCare: clinicalOptions().newbornCare, birthVaccines: clinicalOptions().birthVaccines,
  }, { secure: ctx.config.cookieSecure });

  router.get('/api/periop-forms', async (ctx) => {
    const found = patientFor(ctx, ctx.url.searchParams.get('patientKey'), false);
    if (!found) return true;
    return respond(ctx, 200, found.row);
  });

  // POST /api/periop-forms (save) and /api/periop-forms/:id/sign
  router.post(/^\/api\/periop-forms(?:\/([0-9a-f-]{36})\/sign)?$/, async (ctx) => {
    const { request, session, database, readJson, audit, routeParams } = ctx;
    const body = await readJson(request, 1_200_000);
    const found = patientFor(ctx, body?.patientKey, true);
    if (!found) return true;
    const [, signId] = routeParams;
    try {
      if (signId) {
        if (!signPeriopForm(database, found.row.patient_key, found.actor, signId, String(body?.slot || ''))) return fail(ctx, 404, 'Form not found.');
        audit(database, request, 'PERIOP_FORM_SIGNED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: found.row.patient_key, formId: signId, slot: body?.slot } });
        return respond(ctx, 200, found.row);
      }
      const id = savePeriopForm(database, found.row.patient_key, found.actor, body);
      audit(database, request, 'PERIOP_FORM_SAVED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: found.row.patient_key, formId: id, formType: body?.formType, formDate: body?.formDate } });
      return respond(ctx, 200, found.row);
    } catch (error) {
      return fail(ctx, error.status || 400, error.message);
    }
  });
}
