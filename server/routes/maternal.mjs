// v42.6 - /api/maternal/* (midwife queue, settings, cervical result),
// /api/anc/* (official ANC record) and /api/vaccinations.
import {
  ancColourChart, ancRecordLabels, ancVisitSchedule, canSignReferral, canUseMaternalPatient, closePregnancy, colourHistory,
  findPregnancy, getPregnancy, importedValues, isFreeMaternalService, listVisits, maternalOptions, maternalQueue, midwifeMedicineAllowed, openPregnancy,
  pregnancyVaccinations, recordVaccination, releasedResults, requestReferral, saveRecord, saveVisit, sendCervicalResult,
  signReferral, statusFor, updateTask, vaccinationHistory, vaccineLines, ancSentOrders, ancOrderAlreadySent,
} from '../maternal.mjs';
import { medicineCatalogue } from '../medicine-catalogue.mjs';
import { createSystemMessage } from '../messages.mjs';
import { opdLocalDate, updateOpdQueueStatus } from '../opd-queue.mjs';
import { prepareOpdPrescription, submitOpdPrescription } from '../pharmacy-prescriptions.mjs';
import { signatureSnapshot } from '../esign.mjs';
import { syncMedicineStock } from '../stock.mjs';
import { legacyAncFields, readLegacyAnc } from '../anc-legacy.mjs';
import { missingAncFields } from '../../public/anc-required-fields.mjs';

const READ_ROLES = new Set(['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'MIDWIFE', 'DOCTOR', 'CHIEF_WARD', 'NURSE']);

export function mountMaternalRoutes(router) {
  const fail = (ctx, status, error, extra = {}) => ctx.sendJson(ctx.response, status, { error, ...extra }, { secure: ctx.config.cookieSecure });
  const ok = (ctx, status, body) => ctx.sendJson(ctx.response, status, body, { secure: ctx.config.cookieSecure });

  function actor(ctx) {
    const { session, requireContext } = ctx;
    if (!session) { fail(ctx, 401, 'Authentication required.'); return null; }
    const role = requireContext(session);
    return { role, ward: ctx.sessionWard(session), session: { ...session, activeRole: role, active_role: role } };
  }

  // The patient for a maternal page: the midwife (maternal services), the
  // Gynecology ward (safe abortion) or anyone who already sees the record
  // (an Obstetric doctor signing a referral, management).
  function patientFor(ctx, who, patientKey, { write = false } = {}) {
    const { database, clinicalPatientKey, canAccessPatient } = ctx;
    const row = database.findPatient(clinicalPatientKey(patientKey));
    if (!row) { fail(ctx, 404, 'Patient not found.'); return null; }
    const maternal = canUseMaternalPatient(who.session, row, who.ward);
    const ward = canSignReferral(who.session, who.ward) || canAccessPatient(database, who.session, row);
    // Writing: the midwife's own services; a doctor who signs referrals reaches the
    // record too (each action checks its own role).
    const signer = canSignReferral(who.session, who.ward);
    if (!(maternal || (write && signer) || (!write && ward && READ_ROLES.has(who.role)))) { fail(ctx, 403, 'This patient is outside your service.'); return null; }
    return row;
  }

  router.get('/api/maternal/config', async (ctx) => {
    const who = actor(ctx); if (!who) return true;
    const options = maternalOptions();
    const allowed = new Set(options.midwifeMedicines.map((name) => name.toLowerCase()));
    return ok(ctx, 200, {
      chart: ancColourChart(), schedule: ancVisitSchedule(), labels: ancRecordLabels(), options, legacyFields: legacyAncFields,
      vaccines: vaccineLines(), midwifeMedicines: medicineCatalogue().items.filter((item) => allowed.has(item.name.toLowerCase())),
      canSignReferral: canSignReferral(who.session, who.ward), role: who.role, today: opdLocalDate(),
    });
  });

  router.get('/api/maternal/queue', async (ctx) => {
    const who = actor(ctx); if (!who) return true;
    const gynecology = ['DOCTOR', 'CHIEF_WARD'].includes(who.role) && who.ward === 'gynecology';
    const management = ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(who.role);
    if (!(who.role === 'MIDWIFE' || gynecology || management)) return fail(ctx, 403, 'The maternal services queue is for the midwife.');
    const kind = gynecology || ctx.url.searchParams.get('kind') === 'gynecology' ? 'gynecology' : 'midwife';
    try {
      const date = ctx.url.searchParams.get('date') || opdLocalDate();
      const patients = maternalQueue(ctx.database, { date, kind, paymentConfirmed: (row) => ctx.opdConsultationPaymentConfirmed(ctx.database, row) });
      return ok(ctx, 200, { date, kind, patients });
    } catch (error) {
      return fail(ctx, 400, error.message);
    }
  });

  // ANC record of the pregnancy (open, or the latest closed one, read-only).
  router.get('/api/anc/record', async (ctx) => {
    const who = actor(ctx); if (!who) return true;
    const row = patientFor(ctx, who, ctx.url.searchParams.get('patientKey')); if (!row) return true;
    const pregnancy = findPregnancy(ctx.database, row);
    const today = opdLocalDate();
    const body = {
      patient: { patientKey: row.patient_key, fullName: row.full_name, healthId: row.health_id, caseNumber: row.case_number, sex: row.sex, age: row.age, departmentCode: row.department_code },
      imported: importedValues(row), released: releasedResults(ctx.database, row), legacyAnc: readLegacyAnc(row), pregnancy: null, visits: [], colourHistory: [], status: null, vaccinations: [],
      canEdit: canUseMaternalPatient(who.session, row, who.ward) && who.role === 'MIDWIFE' || ['ADMIN', 'VICE_DIRECTOR'].includes(who.role),
      canSignReferral: canSignReferral(who.session, who.ward), today, sentOrders: ancSentOrders(ctx.database, row, today),
    };
    if (pregnancy) {
      body.pregnancy = pregnancy;
      body.visits = listVisits(ctx.database, pregnancy.id);
      body.colourHistory = colourHistory(ctx.database, pregnancy.id);
      body.status = statusFor(ctx.database, pregnancy, today);
      body.vaccinations = pregnancyVaccinations(ctx.database, pregnancy);
    }
    return ok(ctx, 200, body);
  });

  // Colour badge for the patient banner on every page.
  router.get('/api/anc/badge', async (ctx) => {
    const who = actor(ctx); if (!who) return true;
    const { database, clinicalPatientKey, canAccessPatient } = ctx;
    const row = database.findPatient(clinicalPatientKey(ctx.url.searchParams.get('patientKey')));
    if (!row || !(canAccessPatient(database, who.session, row) || canUseMaternalPatient(who.session, row, who.ward))) return ok(ctx, 200, { colour: '' });
    const pregnancy = findPregnancy(database, row, { openOnly: true });
    return ok(ctx, 200, { colour: pregnancy?.colour || '', status: pregnancy?.status || '' });
  });

  async function pregnancyAction(ctx, handler) {
    const who = actor(ctx); if (!who) return true;
    const body = await ctx.readJson(ctx.request, 500_000);
    const row = patientFor(ctx, who, body?.patientKey, { write: true });
    if (!row) return true;
    try {
      return await handler({ who, row, body });
    } catch (error) {
      return fail(ctx, error.status || 400, error.message, error.duplicate ? { duplicate: true } : error.code ? { code: error.code } : {});
    }
  }

  const midwifeOnly = (ctx, who) => {
    if (who.role === 'MIDWIFE' || ['ADMIN', 'VICE_DIRECTOR'].includes(who.role)) return true;
    fail(ctx, 403, 'Only the midwife writes the ANC record.');
    return false;
  };

  router.post('/api/anc/record/open', async (ctx) => pregnancyAction(ctx, ({ who, row }) => {
    if (!midwifeOnly(ctx, who)) return true;
    const result = openPregnancy(ctx.database, row, who.session);
    if (result.created) ctx.audit(ctx.database, ctx.request, 'ANC_RECORD_OPENED', { userId: who.session.user_id, subjectUsername: who.session.username, details: { patientKey: row.patient_key, pregnancyId: result.pregnancy.id } });
    return ok(ctx, result.created ? 201 : 200, { pregnancy: result.pregnancy, status: statusFor(ctx.database, result.pregnancy, opdLocalDate()) });
  }));

  router.post(/^\/api\/anc\/record\/([0-9a-f-]{36})\/(save|save-all|visit|task|referral|sign|close|prescription)$/, async (ctx) => {
    const [, id, action] = ctx.routeParams;
    return pregnancyAction(ctx, ({ who, row, body }) => {
      const pregnancy = getPregnancy(ctx.database, id);
      if (!pregnancy) return fail(ctx, 404, 'ANC record not found.');
      if (pregnancy.patientKey !== row.patient_key && !(pregnancy.healthId && pregnancy.healthId === row.health_id)) return fail(ctx, 403, 'The pregnancy does not belong to this patient.');
      const today = opdLocalDate();
      const event = (name, details = {}) => ctx.audit(ctx.database, ctx.request, name, { userId: who.session.user_id, subjectUsername: who.session.username, details: { patientKey: row.patient_key, pregnancyId: id, ...details } });
      if (action === 'sign') {
        if (!canSignReferral(who.session, who.ward)) return fail(ctx, 403, 'A doctor of the Obstetric or Gynecology ward signs the referral.');
        const signed = signReferral(ctx.database, id, who.session);
        event('ANC_REFERRAL_SIGNED', { visitId: signed.visitId });
        return ok(ctx, 200, { ...signed, pregnancy: getPregnancy(ctx.database, id) });
      }
      if (!midwifeOnly(ctx, who)) return true;
      if (action === 'save-all') {
        if (Number(body.expectedVersion) !== pregnancy.version) return fail(ctx, 409, 'The ANC record changed. Reload it before saving.');
        const missing = missingAncFields(body.record, body.visit);
        if (missing.length) return fail(ctx, 400, 'Required ANC information is missing.', { missing });
        ctx.database.sqlite.exec('BEGIN IMMEDIATE');
        try {
          saveRecord(ctx.database, id, who.session, body, today);
          saveVisit(ctx.database, id, row, who.session, body, today);
          ctx.database.sqlite.exec('COMMIT');
        } catch (error) { ctx.database.sqlite.exec('ROLLBACK'); throw error; }
        try { updateOpdQueueStatus(ctx.database, row.patient_key, 'IN_CONSULTATION'); } catch { /* no queue entry */ }
        event('ANC_VISIT_SAVED', { unified: true });
        return ok(ctx, 200, { pregnancy: getPregnancy(ctx.database, id), visits: listVisits(ctx.database, id), colourHistory: colourHistory(ctx.database, id) });
      }
      if (action === 'save') {
        const saved = saveRecord(ctx.database, id, who.session, body, today);
        event('ANC_RECORD_SAVED', { colour: saved.colour });
        return ok(ctx, 200, { pregnancy: saved, status: statusFor(ctx.database, saved, today), colourHistory: colourHistory(ctx.database, id) });
      }
      if (action === 'visit') {
        const status = saveVisit(ctx.database, id, row, who.session, body, today);
        try { updateOpdQueueStatus(ctx.database, row.patient_key, 'IN_CONSULTATION'); } catch { /* not in today's queue */ }
        event('ANC_VISIT_SAVED', { colour: status.colour });
        return ok(ctx, 200, { status, visits: listVisits(ctx.database, id), pregnancy: getPregnancy(ctx.database, id), colourHistory: colourHistory(ctx.database, id) });
      }
      if (action === 'task') {
        const updated = updateTask(ctx.database, id, who.session, body);
        event('ANC_TASK_UPDATED', { key: body?.key, action: body?.action, reason: body?.reason || '' });
        return ok(ctx, 200, { pregnancy: updated, status: statusFor(ctx.database, updated, today) });
      }
      if (action === 'prescription') return sendPrescription(ctx, who, row, body, event);
      if (action === 'referral') {
        const referral = requestReferral(ctx.database, id, row, who.session, body, today);
        event('ANC_REFERRAL_REQUESTED', { visitId: referral.visitId });
        return ok(ctx, 200, { ...referral, visits: listVisits(ctx.database, id) });
      }
      const closed = closePregnancy(ctx.database, id, who.session, body);
      if (!closed) return fail(ctx, 409, 'This ANC record is already closed.');
      event('ANC_RECORD_CLOSED', { status: closed.status });
      return ok(ctx, 200, { pregnancy: closed });
    });
  });

  // The midwife's prescription (iron + folic acid ...) goes to Pharmacy like an
  // OPD prescription; only the medicines of the maternal services are accepted.
  function sendPrescription(ctx, who, row, body, event) {
    const { database } = ctx;
    const fields = ['name', 'route', 'unit', 'doseAmount', 'scheduleType', 'm', 'a', 'e', 'n', 'd', 'total', 'note', 'cmsCode'];
    const medications = (Array.isArray(body?.medications) ? body.medications.slice(0, 20) : [])
      .map((med) => Object.fromEntries(fields.map((key) => [key, String(med?.[key] ?? '').trim().slice(0, key === 'name' ? 600 : 200)])))
      .filter((med) => med.name);
    if (!medications.length) return fail(ctx, 400, 'Enter the medicines.');
    const refused = medications.filter((med) => !midwifeMedicineAllowed(med.name));
    if (refused.length) return fail(ctx, 403, 'ឆ្មបអាចចេញវេជ្ជបញ្ជាតែឱសថសេវាមាតាប៉ុណ្ណោះ។', { refused: refused.map((med) => med.name) });
    const data = ctx.parseStoredJson(row.record_json);
    const signature = signatureSnapshot(database, who.session, Date.now());
    data['system:opdMedications'] = JSON.stringify(medications);
    data['system:signature:medical'] = JSON.stringify(signature);
    const summary = { serviceMode: row.service_mode, fullName: row.full_name, healthId: row.health_id, caseNumber: row.case_number,
      age: row.age, sex: row.sex, departmentNameKh: row.department_name_kh, entryDate: row.entry_date };
    const snapshot = prepareOpdPrescription(data, summary, signature);
    let submission;
    database.sqlite.exec('BEGIN IMMEDIATE');
    try {
      database.sqlite.prepare('UPDATE patient_records SET record_json=?, updated_at=? WHERE patient_key=?').run(JSON.stringify(data), Date.now(), row.patient_key);
      submission = submitOpdPrescription(database, row, snapshot, { userId: who.session.user_id, role: who.role, wardCode: who.ward });
      if (!submission.duplicate) {
        updateOpdQueueStatus(database, row.patient_key, 'SENT_TO_PHARMACY');
        syncMedicineStock(database, `OPD_RX:${submission.id}`, medications, who.session.user_id);
      }
      database.sqlite.exec('COMMIT');
    } catch (error) { database.sqlite.exec('ROLLBACK'); throw error; }
    event('OPD_PRESCRIPTION_SUBMITTED', { prescriptionId: submission.id, duplicate: submission.duplicate, source: 'ANC' });
    return ok(ctx, 200, { prescriptionId: submission.id, duplicate: submission.duplicate });
  }

  router.get('/api/vaccinations', async (ctx) => {
    const who = actor(ctx); if (!who) return true;
    const row = patientFor(ctx, who, ctx.url.searchParams.get('patientKey')); if (!row) return true;
    return ok(ctx, 200, { patient: { patientKey: row.patient_key, fullName: row.full_name, healthId: row.health_id, sex: row.sex, age: row.age, dateOfBirth: row.date_of_birth || '' },
      vaccines: vaccineLines(), history: vaccinationHistory(ctx.database, row), free: isFreeMaternalService(row), today: opdLocalDate() });
  });

  router.post('/api/vaccinations', async (ctx) => pregnancyAction(ctx, ({ who, row, body }) => {
    if (who.role !== 'MIDWIFE') return fail(ctx, 403, 'Only the midwife records a vaccination.');
    const result = recordVaccination(ctx.database, row, who.session, body);
    ctx.audit(ctx.database, ctx.request, 'VACCINATION_RECORDED', { userId: who.session.user_id, subjectUsername: who.session.username,
      details: { patientKey: row.patient_key, vaccinationId: result.vaccination.id, vaccine: result.vaccination.vaccineName, dose: result.vaccination.doseNumber } });
    return ok(ctx, 201, { ...result, history: vaccinationHistory(ctx.database, row) });
  }));

  // A test of the schedule the midwife does not order (OGTT, CBC, blood group):
  // a message asks the Obstetric ward doctors to order it.
  router.post('/api/maternal/ask-doctor', async (ctx) => pregnancyAction(ctx, ({ who, row, body }) => {
    if (who.role !== 'MIDWIFE') return fail(ctx, 403, 'Only the midwife asks for a test.');
    const test = String(body?.test || '').replace(/[^A-Z0-9_]/gi, '').slice(0, 40).toUpperCase();
    if (!test) return fail(ctx, 400, 'Choose the test.');
    // v47.8: once per visit (also when the test is already ordered and waiting).
    if (ancOrderAlreadySent(ctx.database, row, [test])) return fail(ctx, 409, 'This request was already sent for this visit.', { code: 'ALREADY_SENT' });
    const message = createSystemMessage(ctx.database, { senderUserId: who.session.user_id, senderRole: who.role, senderWardCode: who.ward,
      destinationType: 'WARD', destinationCode: 'obstetric', destinationRole: 'DOCTOR',
      subject: `ANC · ${test} · ${row.full_name || row.patient_key}`, body: `ANC ${test}: ${row.full_name || ''} · ${row.health_id || row.case_number || ''} · /anc-record?patient=${encodeURIComponent(row.patient_key)}`, patientKey: row.patient_key });
    return ok(ctx, 201, { messageId: message.id });
  }));

  router.post('/api/maternal/cervix-result', async (ctx) => pregnancyAction(ctx, ({ who, row, body }) => {
    if (who.role !== 'MIDWIFE') return fail(ctx, 403, 'Only the midwife sends the screening result.');
    const sent = sendCervicalResult(ctx.database, row, who.session, body);
    ctx.audit(ctx.database, ctx.request, 'CERVICAL_RESULT_SENT', { userId: who.session.user_id, subjectUsername: who.session.username, details: { patientKey: row.patient_key, messageId: sent.messageId } });
    return ok(ctx, 201, sent);
  }));
}
