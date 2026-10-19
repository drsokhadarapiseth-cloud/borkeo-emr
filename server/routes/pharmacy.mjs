import { MANAGEMENT } from '../requests.mjs';
import {
  medicineReportWards, wardMedicineReport, ordersForDate
} from '../ward-medicines.mjs';
import {
  listStock, addStockItem, receiveStock, stockHistory, manualMaterialUsage, manualFilmUsage
} from '../stock.mjs';
import {
  listOpdPrescriptions, opdPrescriptionForPharmacy, markOpdPrescriptionReceived
} from '../pharmacy-prescriptions.mjs';
import {
  listDischargeMedicationOrders, markDischargeMedicationReceived
} from '../pharmacy-discharge.mjs';
import {
  reviewedWardMedicineReport, rejectWardMedicineReport,
  directorWardMedicineInbox, signWardMedicineReport, markPharmacyAlerted
} from '../ward-medicine-approvals.mjs';
import { updateOpdQueueStatus } from '../opd-queue.mjs';
import { createSystemMessage, createStaffMessage } from '../messages.mjs';
import { signatureSnapshot } from '../esign.mjs';

const pharmacySettledCodes = new Set([
  'INSURANCE', 'NGO', 'PAID', 'NSSF', 'HEF_EQUITY', 'HEF_VULNERABLE', 'EXEMPT',
  'NSSF_OUTSIDE', 'NSSF_WORKER', 'NSSF_CIVIL', 'HEF_POOR', 'HEF_VULNERABLE_FAMILY', 'FULL_WAIVER'
]);

export function mountPharmacyRoutes(router) {
  // 1. POST /api/reports/ward-medicines/reject
  router.post('/api/reports/ward-medicines/reject', async (ctx) => {
    const { session, database, config, sendJson, readJson, request, audit, sessionRole } = ctx;
    if (!session || !MANAGEMENT.includes(sessionRole(session))) {
      return sendJson(ctx.response, 403, { error: 'Management access required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 10000);
    database.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const report = rejectWardMedicineReport(database, body.date, body.ward, session.user_id, body.note, body.revision, body.fingerprint);
      createStaffMessage(database, {
        senderUserId: session.user_id,
        senderRole: sessionRole(session),
        destinationType: 'WARD',
        destinationCode: body.ward,
        subject: 'បណ្ណស្នើរសុំឱសថត្រូវកែតម្រូវ',
        body: body.note
      });
      audit(database, request, 'MEDICINE_REQUEST_REJECTED', { userId: session.user_id, details: { ward: body.ward, date: body.date } });
      database.sqlite.exec('COMMIT');
      return sendJson(ctx.response, 200, { report }, { secure: config.cookieSecure });
    } catch (e) {
      database.sqlite.exec('ROLLBACK');
      return sendJson(ctx.response, 400, { error: e.message }, { secure: config.cookieSecure });
    }
  });

  // 2. GET /api/stock/:kind or /api/stock/:kind/history
  router.get(/^\/api\/stock\/(medicine|material|film)(?:\/(receipt|use|history))?$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, match } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const kind = match[1];
    const sub = match[2] || '';

    if (!sub) {
      const allowed = kind === 'medicine'
        ? ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'PHARMACY', 'DOCTOR'].includes(role)
        : kind === 'material'
          ? ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'LAB'].includes(role)
          : ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'IMAGING', 'DOCTOR'].includes(role);
      if (!allowed) return sendJson(response, 403, { error: 'Your role cannot view this stock list.' }, { secure: config.cookieSecure });
      return sendJson(response, 200, { items: listStock(database, kind) }, { secure: config.cookieSecure });
    }

    if (sub === 'history') {
      const allowed = kind === 'medicine'
        ? ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'PHARMACY', 'DOCTOR'].includes(role)
        : kind === 'material'
          ? ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'LAB'].includes(role)
          : ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'IMAGING', 'DOCTOR'].includes(role);
      if (!allowed) return sendJson(response, 403, { error: 'Your role cannot view stock history.' }, { secure: config.cookieSecure });
      return sendJson(response, 200, { history: stockHistory(database, kind) }, { secure: config.cookieSecure });
    }
  });

  // 3. POST /api/stock/:kind or /api/stock/:kind/(receipt|use)
  router.post(/^\/api\/stock\/(medicine|material|film)(?:\/(receipt|use|history))?$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, match } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const kind = match[1];
    const sub = match[2] || '';
    const body = await readJson(request, config.maxBodyBytes);

    if (!sub) {
      const allowed = kind === 'medicine'
        ? ['ADMIN', 'VICE_DIRECTOR', 'PHARMACY'].includes(role)
        : kind === 'material'
          ? ['ADMIN', 'VICE_DIRECTOR', 'LAB'].includes(role)
          : ['ADMIN', 'VICE_DIRECTOR', 'IMAGING'].includes(role);
      if (!allowed) return sendJson(response, 403, { error: 'Your role cannot add new items.' }, { secure: config.cookieSecure });
      try {
        const id = addStockItem(database, kind, body || {}, session.user_id);
        audit(database, request, `STOCK_${kind.toUpperCase()}_ADDED`, { userId: session.user_id, subjectUsername: session.username, details: { id, name: body?.name, unit: body?.unit } });
        return sendJson(response, 200, { id, items: listStock(database, kind) }, { secure: config.cookieSecure });
      } catch (error) {
        return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
      }
    }

    if (sub === 'receipt') {
      const allowed = kind === 'medicine'
        ? ['ADMIN', 'VICE_DIRECTOR', 'PHARMACY'].includes(role)
        : kind === 'material'
          ? ['ADMIN', 'VICE_DIRECTOR', 'LAB'].includes(role)
          : ['ADMIN', 'VICE_DIRECTOR', 'IMAGING'].includes(role);
      if (!allowed) return sendJson(response, 403, { error: 'Your role cannot receive stock.' }, { secure: config.cookieSecure });
      try {
        receiveStock(database, body?.id, body?.quantity, session.user_id);
        audit(database, request, `STOCK_${kind.toUpperCase()}_RECEIVED`, { userId: session.user_id, subjectUsername: session.username, details: { id: body?.id, quantity: body?.quantity } });
        return sendJson(response, 200, { items: listStock(database, kind) }, { secure: config.cookieSecure });
      } catch (error) {
        return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
      }
    }

    if (sub === 'use') {
      if (kind === 'material') {
        if (!['ADMIN', 'VICE_DIRECTOR', 'LAB'].includes(role)) return sendJson(response, 403, { error: 'Your role cannot record material usage.' }, { secure: config.cookieSecure });
        try {
          manualMaterialUsage(database, body?.id, body?.quantity, body?.reference, session.user_id);
          audit(database, request, 'STOCK_MATERIAL_USED', { userId: session.user_id, subjectUsername: session.username, details: { id: body?.id, quantity: body?.quantity, reference: body?.reference } });
          return sendJson(response, 200, { items: listStock(database, kind) }, { secure: config.cookieSecure });
        } catch (error) {
          return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
        }
      }
      if (kind === 'film') {
        if (!['ADMIN', 'VICE_DIRECTOR', 'IMAGING'].includes(role)) return sendJson(response, 403, { error: 'Your role cannot record film usage.' }, { secure: config.cookieSecure });
        try {
          manualFilmUsage(database, body?.id, body?.quantity, body?.reference, session.user_id);
          audit(database, request, 'STOCK_FILM_USED', { userId: session.user_id, subjectUsername: session.username, details: { id: body?.id, quantity: body?.quantity, reference: body?.reference } });
          return sendJson(response, 200, { items: listStock(database, kind) }, { secure: config.cookieSecure });
        } catch (error) {
          return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
        }
      }
    }
  });

  // 4. GET /api/reports/ward-medicines
  router.get('/api/reports/ward-medicines', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, url, sessionWard } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const wards = medicineReportWards(role, sessionWard(session));
    if (!wards.length) return sendJson(response, 403, { error: 'Your active role cannot view ward medicine orders.' }, { secure: config.cookieSecure });
    const wardCode = String(url.searchParams.get('ward') || '').trim().toLowerCase();
    if (!wards.some(item => item.code === wardCode)) {
      return sendJson(response, 403, { error: 'This medicine report is outside your assigned ward.' }, { secure: config.cookieSecure });
    }
    try {
      const report = reviewedWardMedicineReport(database, url.searchParams.get('date'), wardCode);
      if (role === 'PHARMACY' && !report.approval?.director) {
        return sendJson(response, 403, { error: 'Management approval is required before Pharmacy can view this request.' }, { secure: config.cookieSecure });
      }
      return sendJson(response, 200, { ...report, wards }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 5. GET /api/reports/ward-medicines/pending
  router.get('/api/reports/ward-medicines/pending', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!MANAGEMENT.includes(requireContext(session))) return sendJson(response, 403, { error: 'Director access is required.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, { items: directorWardMedicineInbox(database) }, { secure: config.cookieSecure });
  });

  // 6. POST /api/reports/ward-medicines/sign
  router.post('/api/reports/ward-medicines/sign', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, sessionWard } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['NURSE', 'MIDWIFE', 'WARD_HEAD', 'CHIEF_WARD', 'DOCTOR', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'PHARMACY'].includes(role)) {
      return sendJson(response, 403, { error: 'Your role cannot sign the ward medicine list.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const ward = String(body?.ward || '').toLowerCase();
    const allowed = medicineReportWards(role, sessionWard(session));
    if (!allowed.some(item => item.code === ward)) return sendJson(response, 403, { error: 'This medicine report is outside your assigned ward.' }, { secure: config.cookieSecure });
    if (role === 'CHIEF_WARD' && sessionWard(session) !== ward) return sendJson(response, 403, { error: 'Chief of Ward can sign only the active ward.' }, { secure: config.cookieSecure });
    if (['NURSE', 'MIDWIFE'].includes(role) && sessionWard(session) !== ward) return sendJson(response, 403, { error: 'Nursing staff can sign only the active ward.' }, { secure: config.cookieSecure });
    let report;
    database.sqlite.exec('BEGIN IMMEDIATE');
    try {
      report = signWardMedicineReport(database, body?.date, ward, role, session.user_id, signatureSnapshot(database, session, Date.now()), body.step, body.revision, body.fingerprint);
      audit(database, request, 'WARD_MEDICINE_SIGNED', { userId: session.user_id, subjectUsername: session.username, details: { ward, date: report.date, role, status: report.approval?.status } });
      if (MANAGEMENT.includes(role) && report.approval?.status === 'director_signed' && !report.approval?.pharmacyAlertedAt) {
        const wardName = report.wardNameKh || ward;
        createSystemMessage(database, {
          senderUserId: session.user_id,
          senderRole: role,
          destinationType: 'PHARMACY',
          destinationCode: 'pharmacy',
          subject: `បញ្ជីឱសថផ្នែករួចរាល់ · ${ward} · ${report.date}`,
          body: `បញ្ជីឱសថប្រចាំថ្ងៃពី ${wardName} សម្រាប់ថ្ងៃទី ${report.date} បានចុះហត្ថលេខាដោយនាយក។ សូមឱសថស្ថានពិនិត្យ និងចុះហត្ថលេខាប្រគល់ថ្នាំទៅផ្នែក។`
        });
        markPharmacyAlerted(database, report.date, ward);
        report = reviewedWardMedicineReport(database, report.date, ward);
      }
      database.sqlite.exec('COMMIT');
    } catch (error) {
      database.sqlite.exec('ROLLBACK');
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
    return sendJson(response, 200, { report }, { secure: config.cookieSecure });
  });

  // 7. POST /api/reports/ward-medicines/approve (legacy)
  router.post('/api/reports/ward-medicines/approve', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, sessionRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!MANAGEMENT.includes(requireContext(session))) return sendJson(response, 403, { error: 'Only the hospital director can complete the director signature stage.' }, { secure: config.cookieSecure });
    const body = await readJson(request, config.maxBodyBytes);
    const ward = String(body?.ward || '').toLowerCase();
    try {
      database.sqlite.exec('BEGIN IMMEDIATE');
      let report = signWardMedicineReport(database, body?.date, ward, sessionRole(session), session.user_id, signatureSnapshot(database, session, Date.now()), 3);
      if (!report.approval?.pharmacyAlertedAt) {
        createSystemMessage(database, {
          senderUserId: session.user_id,
          senderRole: sessionRole(session),
          destinationType: 'PHARMACY',
          destinationCode: 'pharmacy',
          subject: `បញ្ជីឱសថផ្នែករួចរាល់ · ${ward} · ${report.date}`,
          body: 'បញ្ជីឱសថបានអនុម័តរួចរាល់។'
        });
        markPharmacyAlerted(database, report.date, ward);
        report = reviewedWardMedicineReport(database, report.date, ward);
      }
      audit(database, request, 'WARD_MEDICINE_SIGNED', { userId: session.user_id, details: { ward, date: report.date, role: sessionRole(session), step: 3 } });
      database.sqlite.exec('COMMIT');
      return sendJson(response, 200, { report }, { secure: config.cookieSecure });
    } catch (error) {
      try { database.sqlite.exec('ROLLBACK'); } catch {}
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 8. GET /api/pharmacy/opd-prescriptions
  router.get('/api/pharmacy/opd-prescriptions', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, paymentStatusForPatient, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'PHARMACY'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Pharmacy access is required.' }, { secure: config.cookieSecure });
    }
    const patients = listOpdPrescriptions(database).map(item => {
      const paymentStatus = paymentStatusForPatient(database, item.patientKey);
      const row = database.findPatient(item.patientKey);
      const data = parseStoredJson(row?.record_json);
      return {
        ...item,
        queueNumber: Number(data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || 0) || null,
        paymentStatus,
        canDispense: ['PAID', 'INSURANCE', 'NGO', 'NSSF', 'HEF_EQUITY', 'HEF_VULNERABLE', 'EXEMPT', 'NSSF_OUTSIDE', 'NSSF_WORKER', 'NSSF_CIVIL', 'HEF_POOR', 'HEF_VULNERABLE_FAMILY', 'FULL_WAIVER'].includes(paymentStatus?.code)
      };
    });
    return sendJson(response, 200, { patients }, { secure: config.cookieSecure });
  });

  // 9. GET /api/pharmacy/discharge-medications
  router.get('/api/pharmacy/discharge-medications', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, paymentStatusForPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'PHARMACY'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Pharmacy access is required.' }, { secure: config.cookieSecure });
    }
    const patients = listDischargeMedicationOrders(database).map(item => {
      const paymentStatus = paymentStatusForPatient(database, item.patientKey);
      return { ...item, paymentStatus, canDispense: pharmacySettledCodes.has(paymentStatus?.code) };
    });
    return sendJson(response, 200, { patients }, { secure: config.cookieSecure });
  });

  // 10. GET /api/pharmacy/dispensing-board
  router.get('/api/pharmacy/dispensing-board', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, paymentStatusForPatient, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'PHARMACY'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Pharmacy access is required.' }, { secure: config.cookieSecure });
    }
    const opd = listOpdPrescriptions(database).map(item => {
      const paymentStatus = paymentStatusForPatient(database, item.patientKey);
      const row = database.findPatient(item.patientKey);
      const data = parseStoredJson(row?.record_json);
      return {
        ...item,
        queueNumber: Number(data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || 0) || null,
        canDispense: pharmacySettledCodes.has(paymentStatus?.code)
      };
    }).filter(item => !item.dispensedAt && item.canDispense);

    const ipd = listDischargeMedicationOrders(database).map(item => {
      const paymentStatus = paymentStatusForPatient(database, item.patientKey);
      return { ...item, paymentStatus, canDispense: pharmacySettledCodes.has(paymentStatus?.code) };
    }).filter(item => !item.dispensedAt && item.canDispense);

    return sendJson(response, 200, { opd, ipd, updatedAt: Date.now() }, { secure: config.cookieSecure });
  });

  // 11. POST /api/pharmacy/discharge-medications/received
  router.post('/api/pharmacy/discharge-medications/received', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, clinicalPatientKey, paymentStatusForPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'PHARMACY'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Pharmacy access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxClinicalBodyBytes);
    try {
      const patientKey = clinicalPatientKey(body?.patientKey);
      if (!pharmacySettledCodes.has(paymentStatusForPatient(database, patientKey)?.code)) {
        throw new Error('សូមបញ្ចប់ការបង់ប្រាក់ ឬការធានារ៉ាប់រង មុនពេលផ្ដល់ថ្នាំ។');
      }
      const patient = markDischargeMedicationReceived(database, { patientKey, dischargeAt: body?.dischargeAt, userId: session.user_id });
      audit(database, request, 'IPD_DISCHARGE_MEDICATIONS_RECEIVED', {
        userId: session.user_id,
        subjectUsername: session.username,
        details: { patientKey, dischargeAt: patient.dischargeAt, medicineCount: patient.medicineCount }
      });
      return sendJson(response, 200, { patient }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 409, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 12. GET /api/pharmacy/opd-prescriptions/:id
  router.get(/^\/api\/pharmacy\/opd-prescriptions\/([0-9a-f-]+)$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, match, paymentStatusForPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'PHARMACY'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Pharmacy access is required.' }, { secure: config.cookieSecure });
    }
    const prescription = opdPrescriptionForPharmacy(database, match[1]);
    if (!prescription) return sendJson(response, 404, { error: 'Prescription not found.' }, { secure: config.cookieSecure });
    const paymentStatus = paymentStatusForPatient(database, prescription.patientKey);
    prescription.paymentStatus = paymentStatus;
    prescription.canDispense = ['PAID', 'INSURANCE', 'NGO', 'NSSF', 'HEF_EQUITY', 'HEF_VULNERABLE', 'EXEMPT', 'NSSF_OUTSIDE', 'NSSF_WORKER', 'NSSF_CIVIL', 'HEF_POOR', 'HEF_VULNERABLE_FAMILY', 'FULL_WAIVER'].includes(paymentStatus?.code);
    return sendJson(response, 200, { prescription }, { secure: config.cookieSecure });
  });

  // 13. POST /api/pharmacy/opd-prescriptions/:id/received
  router.post(/^\/api\/pharmacy\/opd-prescriptions\/([0-9a-f-]+)\/received$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, match, request, audit, paymentStatusForPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'PHARMACY'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Pharmacy access is required.' }, { secure: config.cookieSecure });
    }
    database.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const row = database.sqlite.prepare('SELECT patient_key FROM pharmacy_prescriptions WHERE id=?').get(match[1]);
      if (!row) throw new Error('Prescription was not found.');
      const paymentStatus = paymentStatusForPatient(database, row.patient_key);
      const allowedPaidCodes = new Set(['PAID', 'INSURANCE', 'NGO', 'NSSF', 'HEF_EQUITY', 'HEF_VULNERABLE', 'EXEMPT', 'NSSF_OUTSIDE', 'NSSF_WORKER', 'NSSF_CIVIL', 'HEF_POOR', 'HEF_VULNERABLE_FAMILY', 'FULL_WAIVER']);
      if (!allowedPaidCodes.has(paymentStatus?.code)) {
        throw new Error('Pharmacy cannot confirm medicine delivery until the patient payment is completed.');
      }
      const prescription = markOpdPrescriptionReceived(database, match[1], session.user_id);
      updateOpdQueueStatus(database, prescription.patientKey, 'RECEIVED', prescription.dispensedAt);
      audit(database, request, 'OPD_PRESCRIPTION_RECEIVED', {
        userId: session.user_id,
        subjectUsername: session.username,
        details: { patientKey: prescription.patientKey, prescriptionId: prescription.id }
      });
      database.sqlite.exec('COMMIT');
      return sendJson(response, 200, { prescription }, { secure: config.cookieSecure });
    } catch (error) {
      database.sqlite.exec('ROLLBACK');
      return sendJson(response, 409, { error: error.message }, { secure: config.cookieSecure });
    }
  });
}
