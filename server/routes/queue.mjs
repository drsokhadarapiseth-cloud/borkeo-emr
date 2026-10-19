import {
  getActiveQueueCall, listActiveQueueCalls, getQueueDisplayRows,
  listSkippedQueue, callQueuePatient, skipQueuePatient, clearQueueCall
} from '../queue-board.mjs';
import { listOpdQueue, opdLocalDate } from '../opd-queue.mjs';
import { completePatientMessages } from '../messages.mjs';

export function mountQueueRoutes(router) {
  // 1. GET /api/triage/queue
  router.get('/api/triage/queue', async (ctx) => {
    const {
      session, requireContext, database, sendJson, response, config, url,
      parseStoredJson, patientRecordResponse, paymentStatusForPatient,
      patientClinicalClosed, encounterAccess, listActiveQueueCalls: getActiveCalls = listActiveQueueCalls,
      listSkippedQueue: getSkipped = listSkippedQueue, opdLocalDate: getOpdLocalDate = opdLocalDate
    } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'TRIAGE'].includes(role)) {
      return sendJson(response, 403, { error: 'Triage access is required.' }, { secure: config.cookieSecure });
    }
    const dispensedKeys = new Set(database.sqlite.prepare(`SELECT DISTINCT patient_key FROM pharmacy_prescriptions WHERE dispensed_at IS NOT NULL`).all().map(r => r.patient_key));
    const allPatients = database.listPatientSummaries({ omitPhotos: url.searchParams.get('omitPhotos') === '1' }).map(row => {
      const data = row._parsedData ?? (row._parsedData = parseStoredJson(row.record_json));
      const patient = patientRecordResponse(row, false, data);
      patient.queueNumber = Number(row.queue_num_1 || row.queue_num_2 || 0) || null;
      patient.triageStatus = row.triage_status || '';
      patient.triageCompletedAt = row.triage_completed_at ? Number(row.triage_completed_at) || row.triage_completed_at : null;
      patient.admissionStatus = row.admission_status || '';
      patient.paymentStatus = paymentStatusForPatient(database, row.patient_key);
      patient.clinicalClosed = patientClinicalClosed(database, row, dispensedKeys, data);
      return patient;
    }).sort((left, right) => Number(left.queueNumber || 999999) - Number(right.queueNumber || 999999) || Number(left.registeredAt || left.createdAt) - Number(right.registeredAt || right.createdAt));
    const patients = allPatients.filter(patient => !patient.dischargeDate);
    const today = getOpdLocalDate();
    const counter = String(url.searchParams.get('counter') || '').trim();
    const occupiedElsewhere = new Set(getActiveCalls(database)
      .filter(call => call.service === 'TRIAGE' && counter && call.counter !== counter)
      .map(call => call.patientKey));
    const waiting = patients.filter(patient => (patient.triageStatus === 'WAITING' || (!patient.triageStatus && !patient.departmentCode && !patient.serviceMode)) && !occupiedElsewhere.has(patient.patientKey));
    const completed = allPatients.filter(patient => patient.triageStatus === 'COMPLETED' &&
      patient.triageCompletedAt && getOpdLocalDate(patient.triageCompletedAt) === today);
    completed.forEach(patient => {
      patient.canOpenRecord = true;
      patient.recordAccess = encounterAccess(database, session, database.findPatient(patient.patientKey));
    });
    const skipped = getSkipped(database, 'TRIAGE').filter(item => !occupiedElsewhere.has(item.patientKey));
    return sendJson(response, 200, { date: today, patients: waiting, waiting, completed, skipped }, { secure: config.cookieSecure });
  });

  // 2. GET /api/opd/queue
  router.get('/api/opd/queue', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, url, sessionWard } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role) && !(role === 'DOCTOR' && sessionWard(session) === 'opd')) {
      return sendJson(response, 403, { error: 'OPD queue access requires an OPD doctor.' }, { secure: config.cookieSecure });
    }
    try {
      const date = url.searchParams.get('date') || opdLocalDate();
      const counter = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(role) ? '' : String(url.searchParams.get('counter') || '').trim();
      const occupiedElsewhere = new Set(listActiveQueueCalls(database)
        .filter(call => call.service === 'OPD' && counter && call.counter !== counter)
        .map(call => call.patientKey));
      const readyPatients = listOpdQueue(database, date).filter(item =>
        ['WAITING', 'IN_CONSULTATION'].includes(item.status) &&
        !item.transferredToIpdAt &&
        database.findPatient(item.patientKey)?.service_mode === 'opd' &&
        !database.findPatient(item.patientKey)?.discharge_date
      );
      const readyPatientKeys = new Set(readyPatients.map(patient => patient.patientKey));
      const skipped = listSkippedQueue(database, 'OPD').filter(item => readyPatientKeys.has(item.patientKey) && !occupiedElsewhere.has(item.patientKey));
      return sendJson(response, 200, {
        date,
        patients: readyPatients.filter(patient => !occupiedElsewhere.has(patient.patientKey)),
        skipped
      }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 3. GET /api/queue/display
  router.get('/api/queue/display', async (ctx) => {
    const { database, sendJson, response, config, url, opdConsultationPaymentConfirmed } = ctx;
    const service = String(url.searchParams.get('service') || 'OPD').toUpperCase();
    try {
      const currentCall = getActiveQueueCall(database, service);
      const call = service === 'OPD' && currentCall && !opdConsultationPaymentConfirmed(database, currentCall.patientKey) ? null : currentCall;
      const activeCalls = listActiveQueueCalls(database).filter(c => c.service === service && (service !== 'OPD' || opdConsultationPaymentConfirmed(database, c.patientKey)));
      const waiting = getQueueDisplayRows(database, service, 10).filter(item => service !== 'OPD' || opdConsultationPaymentConfirmed(database, item.patientKey));
      const skipped = listSkippedQueue(database, service).filter(item => service !== 'OPD' || opdConsultationPaymentConfirmed(database, item.patientKey));
      return sendJson(response, 200, { service, call, activeCalls, waiting, skipped }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 4. GET /api/queue/tts
  router.get('/api/queue/tts', async (ctx) => {
    const { sendJson, response, config, url } = ctx;
    const text = String(url.searchParams.get('text') || '').trim();
    if (!text) return sendJson(response, 400, { error: 'Text is required.' }, { secure: config.cookieSecure });
    try {
      const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=km&client=tw-ob&q=${encodeURIComponent(text.slice(0, 300))}`;
      const upstream = await fetch(ttsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://translate.google.com/'
        }
      });
      if (!upstream.ok) {
        return sendJson(response, upstream.status, { error: 'TTS upstream failed.' }, { secure: config.cookieSecure });
      }
      const buffer = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(200, {
        'Content-Type': 'audio/mpeg',
        'Content-Length': buffer.length,
        'Cache-Control': 'public, max-age=86400'
      });
      return response.end(buffer);
    } catch (error) {
      return sendJson(response, 502, { error: 'TTS gateway error.' }, { secure: config.cookieSecure });
    }
  });

  // 5. POST /api/queue/call
  router.post('/api/queue/call', async (ctx) => {
    const {
      session, requireContext, database, sendJson, response, config, readJson, request, audit,
      clinicalPatientKey, canAccessPatient, parseStoredJson, opdConsultationPaymentConfirmed, messagingVisibility
    } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'TRIAGE', 'DOCTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Queue calling is available to Triage, OPD doctors, Admin and Director.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 10_000);
    const service = String(body?.service || '').toUpperCase();
    if (role === 'TRIAGE' && service !== 'TRIAGE') {
      return sendJson(response, 403, { error: 'Triage staff can only call the Triage board.' }, { secure: config.cookieSecure });
    }
    if (role === 'DOCTOR' && service !== 'OPD') {
      return sendJson(response, 403, { error: 'OPD doctors can only call the OPD board.' }, { secure: config.cookieSecure });
    }
    try {
      const row = database.findPatient(clinicalPatientKey(body?.patientKey));
      if (!row || !canAccessPatient(database, session, row)) {
        return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
      }
      const rowData = parseStoredJson(row.record_json);
      const testOnlyPreConsult = service === 'OPD' && rowData['system:workflowStage'] === 'OPD_PARACLINIC_ORDERING' && Boolean(rowData['system:opdPreConsultParaclinicAt']);
      if (service === 'OPD' && !testOnlyPreConsult && !opdConsultationPaymentConfirmed(database, row)) {
        return sendJson(response, 409, { error: 'Confirm the OPD consultation fee before calling this patient to the doctor.' }, { secure: config.cookieSecure });
      }
      const call = callQueuePatient(database, { service, counter: body?.counter, patientKey: row.patient_key, userId: session.user_id, queueNumber: body?.queueNumber });
      if (role === 'DOCTOR' && service === 'OPD') {
        completePatientMessages(database, row.patient_key, messagingVisibility(session), { subjectPattern: /^OPD ·|^Cashier payment completed$|OPD.*payment|OPD.*paid|OPD.*បានបង់/i });
      }
      audit(database, request, 'QUEUE_PATIENT_CALLED', { userId: session.user_id, subjectUsername: session.username, details: { service, counter: call.counter, patientKey: row.patient_key, queueNumber: call.queueNumber } });
      return sendJson(response, 200, { call }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 6. POST /api/queue/skip
  router.post('/api/queue/skip', async (ctx) => {
    const {
      session, requireContext, database, sendJson, response, config, readJson, request, audit,
      clinicalPatientKey, canAccessPatient, parseStoredJson, opdConsultationPaymentConfirmed
    } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['TRIAGE', 'DOCTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Only Triage nurses or OPD doctors can skip a queue patient.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 4_000);
    const service = String(body?.service || '').toUpperCase();
    if (role === 'TRIAGE' && service !== 'TRIAGE') {
      return sendJson(response, 403, { error: 'Triage staff can only skip the Triage board.' }, { secure: config.cookieSecure });
    }
    if (role === 'DOCTOR' && service !== 'OPD') {
      return sendJson(response, 403, { error: 'OPD doctors can only skip the OPD board.' }, { secure: config.cookieSecure });
    }
    try {
      const row = database.findPatient(clinicalPatientKey(body?.patientKey));
      if (!row || !canAccessPatient(database, session, row)) {
        return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
      }
      const rowData = parseStoredJson(row.record_json);
      const testOnlyPreConsult = service === 'OPD' && rowData['system:workflowStage'] === 'OPD_PARACLINIC_ORDERING' && Boolean(rowData['system:opdPreConsultParaclinicAt']);
      if (service === 'OPD' && !testOnlyPreConsult && !opdConsultationPaymentConfirmed(database, row)) {
        return sendJson(response, 409, { error: 'Confirm the OPD consultation fee before changing this doctor queue.' }, { secure: config.cookieSecure });
      }
      const skipped = skipQueuePatient(database, { service, counter: body?.counter, patientKey: row.patient_key, userId: session.user_id, queueNumber: body?.queueNumber });
      audit(database, request, 'QUEUE_PATIENT_SKIPPED', { userId: session.user_id, subjectUsername: session.username, details: skipped });
      return sendJson(response, 200, { skipped }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 7. POST /api/queue/clear
  router.post('/api/queue/clear', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'TRIAGE', 'DOCTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'Queue access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 2_000);
    try {
      return sendJson(response, 200, clearQueueCall(database, body?.service, session.user_id), { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });
}
