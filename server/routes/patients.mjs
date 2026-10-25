import crypto from 'node:crypto';
import { selectionFor, beneficiaryPayment, saveBeneficiaryLink } from '../npca/beneficiaries.mjs';
import { mapCode } from '../npca/codes.mjs';
import { roleCanPage, patientWorkWard, sessionRole } from '../access.mjs';
import { mergeSharedEncounterFields } from '../shared-encounter-fields.mjs';
import { listAppointments, createAppointment, updateAppointmentStatus } from '../appointments.mjs';
import { listOrders } from '../paraclinic.mjs';
import { listEditorHistory, saveEditorHistory, patientRecordChangeNotes } from '../editor-history.mjs';
import { validPatientPhoto } from '../patient-photo.mjs';
import { signatureSnapshot } from '../esign.mjs';
import { referToOpd, updateOpdQueueStatus, getOpdQueueEntry } from '../opd-queue.mjs';
import { prepareOpdPrescription, submitOpdPrescription } from '../pharmacy-prescriptions.mjs';
import { queueLateWardMedicineOrder } from '../ward-medicine-approvals.mjs';
import { ordersForDate } from '../ward-medicines.mjs';
import { syncMedicineStock } from '../stock.mjs';
import { completePatientMessages } from '../messages.mjs';
import { syncClinicalRequests } from '../requests.mjs';
import { ensureAdmissionMovement, recordBedAssignment, recordMovement } from '../daily-report.mjs';
import { patientBill } from '../finance.mjs';
import { queueCashierPayment } from '../invoice-edits.mjs';
import { encounterAccess, assertEncounterWrite, consumeCorrection, RECORD_MANAGEMENT } from '../encounter-access.mjs';
import { allergyAlert, patientRef } from '../clinical-summary.mjs';
import { logFromContext } from '../record-access.mjs';
import { isFreeMaternalService, isGynecologyOutpatient, isMaternalService, maternalOptions } from '../maternal.mjs';

const caseTypeFromData = dataValue => {
  const hasNew = dataValue?.['scope:registration:id:emr_pmrs_case_new'] === true || dataValue?.['scope:registration:id:emr_pmrs_case_new'] === 'true';
  const hasOld = dataValue?.['scope:registration:id:emr_pmrs_case_old'] === true || dataValue?.['scope:registration:id:emr_pmrs_case_old'] === 'true';
  if (hasNew === hasOld) return '';
  return hasNew ? 'new' : 'old';
};

export function mountPatientsRoutes(router) {
  // 1. GET /api/appointments
  router.get('/api/appointments', async (ctx) => {
    const { session, database, config, sendJson, url, requireContext } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'REGISTRATION'].includes(role)) {
      return sendJson(ctx.response, 403, { error: 'Registration access is required.' }, { secure: config.cookieSecure });
    }
    return sendJson(ctx.response, 200, {
      appointments: listAppointments(
        database,
        url.searchParams.get('startDate') || url.searchParams.get('date') || '',
        url.searchParams.get('endDate') || '',
        url.searchParams.get('rolling') === '1'
      )
    }, { secure: config.cookieSecure });
  });

  // 2. POST /api/appointments
  router.post('/api/appointments', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, audit, requireContext } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'REGISTRATION'].includes(role)) {
      return sendJson(response, 403, { error: 'Registration access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    try {
      const appointment = createAppointment(database, body || {}, session.user_id);
      audit(database, request, 'APPOINTMENT_CREATED', {
        userId: session.user_id,
        subjectUsername: session.username,
        details: { appointmentId: appointment.id, date: appointment.appointmentDate }
      });
      return sendJson(response, 201, { appointment }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 3. POST /api/appointments/:id/status
  router.post(/^\/api\/appointments\/([0-9a-f-]+)\/status$/, async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, audit, requireContext, routeParams } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'REGISTRATION'].includes(role)) {
      return sendJson(response, 403, { error: 'Registration access is required.' }, { secure: config.cookieSecure });
    }
    const appointmentId = routeParams[1];
    const body = await readJson(request, 10_000);
    try {
      const appointment = updateAppointmentStatus(database, appointmentId, body?.status, session.user_id);
      if (!appointment) return sendJson(response, 404, { error: 'Appointment was not found.' }, { secure: config.cookieSecure });
      audit(database, request, 'APPOINTMENT_STATUS_UPDATED', {
        userId: session.user_id,
        subjectUsername: session.username,
        details: { appointmentId: appointment.id, status: appointment.status }
      });
      return sendJson(response, 200, { appointment }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 4. GET /api/encounter-access
  router.get('/api/encounter-access', async (ctx) => {
    const { response, session, database, config, sendJson, url, clinicalPatientKey } = ctx;
    if (!session) return sendJson(response, 401, { error: 'សូមចូលគណនីជាមុន។' }, { secure: config.cookieSecure });
    const row = database.findPatient(clinicalPatientKey(url.searchParams.get('patientKey')));
    if (!row) return sendJson(response, 404, { error: 'រកមិនឃើញកំណត់ត្រាអ្នកជំងឺ។' }, { secure: config.cookieSecure });
    return sendJson(response, 200, { access: encounterAccess(database, session, row, url.searchParams.get('scope') || '') }, { secure: config.cookieSecure });
  });

  // 5. GET /api/record-viewer
  router.get('/api/record-viewer', async (ctx) => {
    const { response, session, database, config, sendJson, url, requireContext, clinicalPatientKey, parseStoredJson, patientRecordResponse, buildIpdDischargeSummary } = ctx;
    if (!session) return sendJson(response, 401, { error: 'សូមចូលគណនីជាមុន។' }, { secure: config.cookieSecure });
    const row = database.findPatient(clinicalPatientKey(url.searchParams.get('patientKey')));
    if (!row) return sendJson(response, 404, { error: 'រកមិនឃើញកំណត់ត្រាអ្នកជំងឺ។' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!RECORD_MANAGEMENT.includes(role)) return sendJson(response, 403, { error: 'ទំព័រនេះសម្រាប់គណៈគ្រប់គ្រងប៉ុណ្ណោះ។' }, { secure: config.cookieSecure });
    const rows = row.health_id ? database.sqlite.prepare('SELECT * FROM patient_records WHERE health_id=? COLLATE NOCASE ORDER BY entry_date DESC,created_at DESC').all(row.health_id) : [row];
    const encounters = rows.map(record => {
      const data = parseStoredJson(record.record_json);
      return {
        patient: patientRecordResponse(record, true),
        orders: listOrders(database, { patientKey: record.patient_key }),
        resume: record.service_mode === 'ipd' ? buildIpdDischargeSummary(database, record, data, data['system:discharge'] || {}) : null
      };
    });
    return sendJson(response, 200, { encounters }, { secure: config.cookieSecure });
  });

  // 6. GET /api/patients
  router.get('/api/patients', async (ctx) => {
    const { response, session, database, config, sendJson, url, requireContext, parseStoredJson, patientRecordResponse, paymentStatusForPatient, patientClinicalClosed, canAccessPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const includePayment = url.searchParams.get('includePayment') === '1';
    const dispensedKeys = new Set(database.sqlite.prepare(`SELECT DISTINCT patient_key FROM pharmacy_prescriptions WHERE dispensed_at IS NOT NULL`).all().map(r => r.patient_key));
    const role = requireContext(session);
    // v41.0: allergy summary for the ward map bed popup (one query for all patients).
    const allergiesByRef = new Map();
    for (const allergy of database.sqlite.prepare('SELECT * FROM patient_allergies WHERE removed_at IS NULL ORDER BY created_at').all()) {
      if (!allergiesByRef.has(allergy.patient_ref)) allergiesByRef.set(allergy.patient_ref, []);
      allergiesByRef.get(allergy.patient_ref).push({ allergyType: allergy.allergy_type, substance: allergy.substance, severity: allergy.severity });
    }
    return sendJson(response, 200, {
      patients: database.listPatientSummaries({ omitPhotos: url.searchParams.get('omitPhotos') === '1' }).map(row => {
        const data = row._parsedData ?? (row._parsedData = parseStoredJson(row.record_json));
        const patient = patientRecordResponse(row, false, data);
        patient.allergyAlert = allergyAlert(allergiesByRef.get(patientRef(row)) || [], data);
        patient.queueNumber = Number(row.queue_num_1 || row.queue_num_2 || 0) || null;
        patient.triageStatus = row.triage_status || '';
        patient.admissionStatus = row.admission_status || '';
        if (includePayment || ['DOCTOR', 'PHARMACY'].includes(role)) patient.paymentStatus = paymentStatusForPatient(database, row.patient_key);
        patient.clinicalClosed = patientClinicalClosed(database, row, dispensedKeys, data);
        patient.canOpenRecord = canAccessPatient(database, session, row) && roleCanPage(role, '/emr');
        patient.recordAccess = encounterAccess(database, session, row);
        patient.canEditClinical = patient.recordAccess.canEdit;
        return patient;
      }),
    }, { secure: config.cookieSecure });
  });

  // 7. GET /api/patient-record
  router.get('/api/patient-record', async (ctx) => {
    const { response, session, database, config, sendJson, url, clinicalPatientKey, canAccessPatient, syncOpdParaclinicToRecord, patientRecordResponse, parseStoredJson, paymentStatusForPatient, patientClinicalClosed, patientDataVisibleForRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    let patient = database.findPatient(patientKey);
    if (patient && !canAccessPatient(database, session, patient)) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    const role = sessionRole(session);
    if (patient?.service_mode === 'opd' && ['DOCTOR', 'CHIEF_WARD', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role) && url.searchParams.get('readOnly') !== '1' && encounterAccess(database, session, patient).canEdit) {
      syncOpdParaclinicToRecord(database, patientKey);
      patient = database.findPatient(patientKey);
    }
    const limitedIdentityRole = ['LAB', 'IMAGING', 'PHARMACY'].includes(role);
    const patientView = patient ? patientRecordResponse(patient, !limitedIdentityRole) : null;
    if (patientView) {
      const data = parseStoredJson(patient.record_json);
      patientView.queueNumber = Number(data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || 0) || null;
      patientView.paymentStatus = paymentStatusForPatient(database, patient.patient_key);
      patientView.clinicalClosed = patientClinicalClosed(database, patient);
      patientView.recordAccess = encounterAccess(database, session, patient);
    }
    if (patientView && role === 'TRIAGE' && patientView.data) patientView.data = patientDataVisibleForRole(patientView.data, role);
    // v41.7: record view log (repeated openings within two minutes count once).
    if (patient) logFromContext(ctx, patient, 'open', url.searchParams.get('readOnly') === '1' ? 'record (view)' : 'record');
    return sendJson(response, 200, {
      patient: patientView,
      opdQueue: patient?.service_mode === 'opd' ? getOpdQueueEntry(database, patientKey) : null
    }, { secure: config.cookieSecure });
  });

  // 8. GET /api/patient-editor-history
  router.get('/api/patient-editor-history', async (ctx) => {
    const { response, session, database, config, sendJson, url, clinicalFormReadRoles, clinicalPatientKey, canAccessPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!clinicalFormReadRoles.has(sessionRole(session))) return sendJson(response, 403, { error: 'Clinical access is required.' }, { secure: config.cookieSecure });
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const patient = database.findPatient(patientKey);
    if (!patient || !canAccessPatient(database, session, patient)) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, {
      entries: listEditorHistory(database, patientKey, { includeFieldChanges: ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(sessionRole(session)) })
    }, { secure: config.cookieSecure });
  });

  // 9. GET /api/patient-history
  router.get('/api/patient-history', async (ctx) => {
    const { response, session, database, config, sendJson, url, requireContext, clinicalPatientKey, canAccessPatient, patientRecordResponse, patientDataVisibleForRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'REGISTRATION', 'TRIAGE', 'DOCTOR', 'CHIEF_WARD', 'NURSE', 'MIDWIFE'].includes(role)) {
      return sendJson(response, 403, { error: 'Clinical access is required.' }, { secure: config.cookieSecure });
    }
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const current = database.findPatient(patientKey);
    if (!current) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(role) && !canAccessPatient(database, session, current)) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    logFromContext(ctx, current, 'open', 'patient history'); // v41.7 record view log
    let rows;
    if (current.health_id) {
      rows = database.sqlite.prepare(`SELECT * FROM patient_records WHERE health_id=? ORDER BY CASE WHEN entry_date='' THEN 1 ELSE 0 END, entry_date DESC, created_at DESC`).all(current.health_id);
    } else {
      rows = [current];
    }
    const history = rows.map(row => {
      const item = patientRecordResponse(row, true);
      if (role === 'TRIAGE' && item.data) item.data = patientDataVisibleForRole(item.data, role);
      return item;
    });
    return sendJson(response, 200, { history }, { secure: config.cookieSecure });
  });

  // 10. DELETE /api/patient-record
  router.delete('/api/patient-record', async (ctx) => {
    const { response, config, sendJson } = ctx;
    return sendJson(response, 403, { error: 'សូមផ្ញើសំណើលុបទៅគណៈគ្រប់គ្រង។ មិនអាចលុបដោយផ្ទាល់បានទេ។' }, { secure: config.cookieSecure });
  });

  // 11. DELETE /api/patient-triage
  router.delete('/api/patient-triage', async (ctx) => {
    const { response, config, sendJson } = ctx;
    return sendJson(response, 403, { error: 'ការលុបត្រូវការសំណើ និងការអនុម័តពីគណៈគ្រប់គ្រង។' }, { secure: config.cookieSecure });
  });

  // 12. POST /api/patient-triage
  router.post('/api/patient-triage', async (ctx) => {
    const { response, config, sendJson } = ctx;
    return sendJson(response, 403, { error: 'ការលុបត្រូវការសំណើ និងការអនុម័តពីគណៈគ្រប់គ្រង។' }, { secure: config.cookieSecure });
  });

  // 13. POST /api/patient-photo
  router.post('/api/patient-photo', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, audit, clinicalWriteRoles, clinicalPatientKey, canAccessPatient, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = sessionRole(session);
    if (!clinicalWriteRoles.has(role) && !['REGISTRATION', 'TRIAGE', 'ADMIN', 'VICE_DIRECTOR', 'DOCTOR', 'NURSE', 'MIDWIFE'].includes(role)) {
      return sendJson(response, 403, { error: 'Your role cannot update patient photos.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxPatientBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const photo = String(body?.photo || '');
    if (!validPatientPhoto(photo)) return sendJson(response, 400, { error: 'Invalid patient photo data.' }, { secure: config.cookieSecure });
    const existing = database.findPatient(patientKey);
    if (!existing) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
    if (body.expectedVersion !== undefined && (!Number.isInteger(body.expectedVersion) || body.expectedVersion !== existing.version)) {
      return sendJson(response, 409, { error: 'The patient record changed. Reload the patient before uploading the photo.' }, { secure: config.cookieSecure });
    }
    if (!canAccessPatient(database, session, existing)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const data = parseStoredJson(existing.record_json);
    data['scope:registration:id:web_patient_photo'] = photo;
    data['scope:registration:id:patient_photo'] = photo;
    data['system:patientPhoto'] = photo;
    const updatedAt = Date.now();
    const changedPhoto = database.sqlite.prepare('UPDATE patient_records SET record_json=?, version=version+1, updated_at=? WHERE patient_key=? AND version=?').run(JSON.stringify(data), updatedAt, patientKey, existing.version);
    if (!changedPhoto.changes) return sendJson(response, 409, { error: 'The patient record changed. Reload before uploading the photo.' }, { secure: config.cookieSecure });
    const updated = database.findPatient(patientKey);
    audit(database, request, 'PATIENT_PHOTO_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, activeRole: role, changedFields: patientRecordChangeNotes(existing, updated) } });
    return sendJson(response, 200, { ok: true, patientKey, patientVersion: updated.version, updatedAt }, { secure: config.cookieSecure });
  });

  // 14. PUT /api/patient-record
  router.put('/api/patient-record', async (ctx) => {
    const {
      request, response, session, database, config, sendJson, readJson, audit,
      clinicalWriteRoles, clinicalPatientKey, sanitizePatientSummary, recordData,
      validateDailyMonitoringDates, badRequest, canAccessPatient, parseStoredJson,
      opdConsultationPaymentConfirmed, mergePatientSummaryForRole, mergeRecordDataForRole,
      registrationQueueNumberFromData, nextRegistrationQueueNumber, ensureUniqueRegistrationQueueNumber,
      addCatalogCharge,
      messagingVisibility, sessionWard, automaticWardMessage, notifyTriageReferral,
      releasePatientFromHospitalMap, patientRecordResponse, patientDataVisibleForRole,
      wardMedicineOrderDates,
    } = ctx;

    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!clinicalWriteRoles.has(sessionRole(session)) && !['REGISTRATION', 'TRIAGE'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Your role cannot update patient records.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxPatientBodyBytes);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendJson(response, 400, { error: 'Patient record information is invalid.' }, { secure: config.cookieSecure });
    }
    const patientKey = clinicalPatientKey(body.patientKey);
    const submittedSummary = sanitizePatientSummary(body.summary);
    const submittedData = recordData(body.data);
    validateDailyMonitoringDates(database, submittedData);
    let summary = submittedSummary;
    if (!summary.caseNumber && !summary.healthId) badRequest('Case number or Health ID is required.');
    if (!summary.fullName) badRequest('Patient name is required.');

    const existingPatient = database.findPatient(patientKey);
    const activeRoleBeforeSave = sessionRole(session) === 'CHIEF_WARD' ? 'DOCTOR' : sessionRole(session);
    const visitSourceKey = body.newVisitFrom ? clinicalPatientKey(body.newVisitFrom) : '';
    if (visitSourceKey) {
      if (!['REGISTRATION', 'ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(activeRoleBeforeSave)) {
        return sendJson(response, 403, { error: 'Only Registration can start a new visit from an existing patient.' }, { secure: config.cookieSecure });
      }
      if (!database.findPatient(visitSourceKey)) return sendJson(response, 404, { error: 'The previous patient record was not found.' }, { secure: config.cookieSecure });
      if (existingPatient || patientKey === visitSourceKey) return sendJson(response, 409, { error: 'Use a new case number for this visit. The previous record must remain unchanged.' }, { secure: config.cookieSecure });
    }
    const registrationSave = activeRoleBeforeSave === 'REGISTRATION' || (RECORD_MANAGEMENT.includes(activeRoleBeforeSave) && body.editorScope === 'registration');
    if (body.registrationOnly === true && (!registrationSave || body.transferToTriage === true || body.triageSave === true || body.submitOpdPrescription === true)) {
      return sendJson(response, 400, { error: 'Invalid registration-only action.' }, { secure: config.cookieSecure });
    }
    if (activeRoleBeforeSave === 'TRIAGE' && !existingPatient) {
      return sendJson(response, 400, { error: 'This patient must be registered first. Triage cannot create a new patient record.' }, { secure: config.cookieSecure });
    }
    if (existingPatient && !canAccessPatient(database, session, existingPatient)) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    if (existingPatient && Number.isInteger(body.expectedVersion) && body.expectedVersion !== existingPatient.version) {
      return sendJson(response, 409, { error: 'This patient record changed. Reopen the latest record before saving so earlier clinical notes are preserved.' }, { secure: config.cookieSecure });
    }
    if (body.submitOpdPrescription === true && existingPatient && body.expectedVersion !== existingPatient.version) {
      return sendJson(response, 409, { error: 'This patient record changed. Reopen the latest record before sending the prescription.' }, { secure: config.cookieSecure });
    }
    const existingData = existingPatient ? parseStoredJson(existingPatient.record_json) : Object.create(null);
    if ((body.triageSave === true || body.triageEdit === true) && !['TRIAGE', ...RECORD_MANAGEMENT].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'គណនីនេះមិនអាចរក្សាទុកទ្រីយ៉ាបានទេ។' }, { secure: config.cookieSecure });
    }
    if (body.transferToTriage === true && !['REGISTRATION', ...RECORD_MANAGEMENT].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'គណនីនេះមិនអាចបញ្ជូនពីការចុះឈ្មោះបានទេ។' }, { secure: config.cookieSecure });
    }
    let editAccess = null;
    if (existingPatient) {
      try {
        editAccess = assertEncounterWrite(database, session, existingPatient, body.editorScope || undefined);
      } catch (error) {
        return sendJson(response, error.status || 403, { error: error.message }, { secure: config.cookieSecure });
      }
    }
    if (body.editOnly === true && existingPatient && body.editorScope === 'triage' &&
      (submittedSummary.departmentCode !== existingPatient.department_code || submittedSummary.serviceMode !== existingPatient.service_mode)) {
      return sendJson(response, 409, { error: 'ការប្តូរផ្នែកត្រូវប្រើសកម្មភាពបញ្ជូន។ រក្សាទុកនេះកែតែព័ត៌មានទ្រីយ៉ា។' }, { secure: config.cookieSecure });
    }
    if (existingPatient && activeRoleBeforeSave === 'DOCTOR' && existingPatient.service_mode === 'opd') {
      const workflowStage = String(existingData['system:workflowStage'] || '');
      const isOpdClinicalSave = body.editorScope === 'medical' || body.editorScope === 'opd' || body.submitOpdPrescription === true || body.markMedicalComplete === true || Object.keys(submittedData).some(key => key.startsWith('scope:medical:') || key.startsWith('system:opdMedications')) || submittedData['system:medicalRecordCompleted'] === true;
      if (isOpdClinicalSave && (!['DOCTOR_READY', 'IN_CONSULTATION'].includes(workflowStage) || !opdConsultationPaymentConfirmed(database, existingPatient))) {
        return sendJson(response, 409, { error: 'The OPD consultation fee must be confirmed by Cashier before the patient can meet the doctor.' }, { secure: config.cookieSecure });
      }
    }
    const isTriageSaveOrEdit = body.triageSave === true || body.triageEdit === true || body.editorScope === 'triage';
    if (activeRoleBeforeSave === 'TRIAGE' && existingPatient && existingData['system:triageStatus'] === 'COMPLETED' && !isTriageSaveOrEdit) {
      return sendJson(response, 409, { error: 'Triage is already completed for this patient. Use the patient record to view the completed triage.' }, { secure: config.cookieSecure });
    }

    if (registrationSave) {
      const source = visitSourceKey ? database.findPatient(visitSourceKey) : null;
      if (existingData['system:previousPatientKey']) {
        if (String(summary.healthId || '').trim() !== String(existingPatient.health_id || '').trim()) return sendJson(response, 409, { error: 'A returning visit must keep the existing Patient ID.' }, { secure: config.cookieSecure });
        if (caseTypeFromData(submittedData) === 'new') return sendJson(response, 409, { error: 'An existing patient must keep Old Case for this visit.' }, { secure: config.cookieSecure });
      }
      if (source && String(summary.healthId || '').trim() !== String(source.health_id || '').trim()) return sendJson(response, 409, { error: 'A returning visit must keep the existing Patient ID.' }, { secure: config.cookieSecure });
      if (source && caseTypeFromData(submittedData) !== 'old') return sendJson(response, 409, { error: 'An existing patient must use Old Case for a new visit.' }, { secure: config.cookieSecure });
      const knownId = summary.healthId && database.sqlite.prepare('SELECT patient_key FROM patient_records WHERE health_id=? COLLATE NOCASE LIMIT 1').get(summary.healthId);
      if (!existingPatient && knownId && caseTypeFromData(submittedData) === 'new') return sendJson(response, 409, { error: 'This Patient ID already exists. Add a new Old Case record from the Patient ID in the patient list.' }, { secure: config.cookieSecure });
      if (body.transferToTriage && existingData['system:triageStatus'] === 'COMPLETED') return sendJson(response, 409, { error: 'Start a new visit from Patient ID; do not overwrite a completed visit.' }, { secure: config.cookieSecure });
      const selectedCaseType = caseTypeFromData(submittedData) || String(existingData['system:caseType'] || '').toLowerCase();
      if ((activeRoleBeforeSave === 'REGISTRATION' || body.editorScope === 'registration' || body.transferToTriage) && !['new', 'old'].includes(selectedCaseType)) return sendJson(response, 400, { error: 'Select New Case or Old Case during registration before continuing.' }, { secure: config.cookieSecure });
    }
    if (activeRoleBeforeSave === 'TRIAGE' && !caseTypeFromData(existingData) && !['new', 'old'].includes(String(existingData['system:caseType'] || '').toLowerCase())) {
      return sendJson(response, 400, { error: 'Registration is incomplete. Select New Case or Old Case in Registration first.' }, { secure: config.cookieSecure });
    }

    const activeClinicalRole = sessionRole(session) === 'CHIEF_WARD' ? 'DOCTOR' : sessionRole(session);
    const editorScope = RECORD_MANAGEMENT.includes(activeClinicalRole) && ['registration', 'triage', 'medical', 'nursing'].includes(body.editorScope)
      ? body.editorScope : '';
    const triageSave = !(body.editOnly === true && existingData['system:triageStatus'] === 'COMPLETED') && (body.triageSave === true || activeClinicalRole === 'TRIAGE' || editorScope === 'triage');
    // v42.6: the midwife writes the OPD forms of the maternal services (PNC, family planning, cervical screening).
    const maternalMidwife = activeRoleBeforeSave === 'MIDWIFE' && Boolean(existingPatient) && isMaternalService(existingPatient);
    const effectiveRoleForMerge = registrationSave ? 'REGISTRATION' : (activeRoleBeforeSave === 'TRIAGE' || triageSave || editorScope === 'triage' ? 'TRIAGE' : RECORD_MANAGEMENT.includes(activeRoleBeforeSave) ? (body.editorScope === 'nursing' ? 'NURSE' : 'DOCTOR') : maternalMidwife ? 'DOCTOR' : activeRoleBeforeSave);
    summary = mergePatientSummaryForRole(existingPatient, submittedSummary, effectiveRoleForMerge);
    let data = mergeRecordDataForRole(existingData, submittedData, effectiveRoleForMerge, Boolean(existingPatient));
    if (body.registrationOnly === true) data = { ...existingData, ...Object.fromEntries(Object.entries(submittedData).filter(([key]) => key.startsWith('scope:registration:'))) };
    if (body.sharedTriage !== undefined) {
      if (!existingPatient || existingPatient.service_mode !== 'opd' || !['DOCTOR', ...RECORD_MANAGEMENT].includes(activeClinicalRole) || body.editorScope !== 'medical' || body.clinicalSubTab !== 'opd') {
        return sendJson(response, 403, { error: 'Shared clinical fields require OPD doctor edit access.' }, { secure: config.cookieSecure });
      }
      if (body.expectedVersion !== existingPatient.version) return sendJson(response, 409, { error: 'Reload the current encounter before editing shared fields.' }, { secure: config.cookieSecure });
      try { data = mergeSharedEncounterFields(data, body.sharedTriage); }
      catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
    }
    // NPCA identity is taken only from a recent server-side beneficiary search.
    for (const key of Object.keys(data)) if (key.startsWith('system:npca')) { delete data[key]; if (key in existingData) data[key]=existingData[key]; }
    const npcaSelectionId = registrationSave ? submittedData['scope:registration:id:npca_selection'] : '';
    let npcaPerson = null, npcaPayment = '';
    if (npcaSelectionId) {
      npcaPerson = selectionFor(database,npcaSelectionId,session.user_id);
      npcaPayment = beneficiaryPayment(npcaPerson);
      if (!npcaPayment) return sendJson(response,400,{error:'សូមបញ្ជាក់ប្រភេទបណ្ណ និងគម្រោងទូទាត់ជាមួយ NPCA ជាមុន។'},{secure:config.cookieSecure});
      const surname=String(summary.lastName||'').trim(), name=String(summary.firstName||'').trim();
      if (surname!==String(npcaPerson.surname||'').trim() || name!==String(npcaPerson.name||'').trim() || summary.dateOfBirth!==npcaPerson.birthdate || mapCode('sex',summary.sex)!==mapCode('sex',npcaPerson.sex)) return sendJson(response,400,{error:'អត្តសញ្ញាណអ្នកជំងឺមិនត្រូវគ្នានឹងសមាជិកដែលបានជ្រើសរើសទេ។'},{secure:config.cookieSecure});
      data['system:npcaSpid']=npcaPerson.spid;data['system:npcaPatientCode']=npcaPerson.patient_code||'';
      data['system:npcaCards']=JSON.stringify(npcaPerson.benefit_cards||[]);data['system:npcaPaymentType']=npcaPayment;
    }
    delete data['scope:registration:id:npca_selection'];

    if (registrationSave) {
      data['system:caseType'] = caseTypeFromData(data);
      const sameArrivalDay = existingPatient && existingPatient.entry_date === summary.entryDate;
      const existingQueueNumber = sameArrivalDay ? registrationQueueNumberFromData(existingData) : '';
      const queueNumber = existingQueueNumber || nextRegistrationQueueNumber(database, patientKey, summary.entryDate);
      ensureUniqueRegistrationQueueNumber(database, patientKey, summary.entryDate, queueNumber);
      data['system:registrationQueueNumber'] = queueNumber;
    }
    const savedAt = Date.now();
    if (activeRoleBeforeSave === 'DOCTOR' && Object.prototype.hasOwnProperty.call(submittedData, 'system:dailyMonitoringRecords')) {
      let doctorDaily = [];
      try {
        const rawDaily = submittedData['system:dailyMonitoringRecords'];
        const parsedDaily = typeof rawDaily === 'string' ? JSON.parse(rawDaily) : rawDaily;
        if (Array.isArray(parsedDaily)) doctorDaily = parsedDaily;
      } catch { /* Malformed follow-ups cannot replace the doctor's report source. */ }
      let previousDaily = [];
      try { previousDaily=typeof existingData['system:dailyMonitoringRecords']==='string'?JSON.parse(existingData['system:dailyMonitoringRecords']):existingData['system:dailyMonitoringRecords']; } catch {}
      const priorNotes = Array.isArray(previousDaily) ? previousDaily : [];
      const clinicalContent = note => { const { npcaSignature, ...content } = note || {}; return JSON.stringify(content); };
      const npcaSnapshot=signatureSnapshot(database,session,savedAt);
      const npcaAuthor={userId:npcaSnapshot.userId,signerName:npcaSnapshot.signerName,displayName:npcaSnapshot.displayName,role:npcaSnapshot.role,signedAt:npcaSnapshot.signedAt};
      doctorDaily = doctorDaily.map(note => {
        if(!note||typeof note!=='object'||Array.isArray(note))return note;
        const previous=priorNotes.find(old=>old&&String(old.id||old.dtVal)===String(note.id||note.dtVal));
        const { npcaSignature, ...content }=note;
        return {...content,...(previous&&clinicalContent(previous)===clinicalContent(note)
          ? previous.npcaSignature ? {npcaSignature:previous.npcaSignature}:{}
          : {npcaSignature:npcaAuthor})};
      });
      data['system:dailyMonitoringRecords'] = JSON.stringify(doctorDaily);
      data['system:doctorDailyMedicineOrders'] = JSON.stringify(doctorDaily.slice(0,500));
    }
    if (existingPatient?.service_mode === 'opd') {
      const latestRx = database.sqlite.prepare(`SELECT dispensed_at FROM pharmacy_prescriptions
        WHERE patient_key=? ORDER BY rowid DESC LIMIT 1`).get(patientKey);
      if (latestRx?.dispensed_at) {
        let before = existingData['system:opdMedications'] || '[]';
        let after = data['system:opdMedications'] || '[]';
        try { before = JSON.stringify(JSON.parse(before)); after = JSON.stringify(JSON.parse(after)); } catch {}
        if (body.submitOpdPrescription === true || before !== after) {
          return sendJson(response, 409, { error: 'ឱសថស្ថានបានបញ្ជាក់ថាអ្នកជំងឺបានទទួលឱសថរួចហើយ។ មិនអាចកែវេជ្ជបញ្ជានេះបានទេ។' }, { secure: config.cookieSecure });
        }
      }
    }
    const admissionKeys = [
      'system:admissionStatus', 'system:careType',
      'system:currentDepartmentCode', 'system:currentDepartmentNameKh',
      'system:currentDepartmentNameEn', 'system:currentWardCode', 'system:currentRoomId',
      'system:currentRoomNameKh', 'system:currentRoomNameEn',
      'system:currentBedId', 'system:currentBedLabel', 'system:discharge', 'system:opdDischarge',
    ];
    admissionKeys.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(existingData, key)) data[key] = existingData[key];
      else delete data[key];
    });
    const existingDischarge = existingData['system:discharge'];
    const hasFormalDischarge = existingData['system:admissionStatus'] === 'discharged' &&
      existingDischarge && typeof existingDischarge === 'object';
    const hasOpdDischarge = existingPatient?.service_mode === 'opd' && Boolean(existingData['system:opdDischarge']?.dispensedAt);
    summary.dischargeDate = hasFormalDischarge || hasOpdDischarge ? existingPatient.discharge_date : '';

    if (registrationSave) {
      if (visitSourceKey) data['system:previousPatientKey'] = visitSourceKey;
      if (!existingPatient) {
        summary.departmentCode = '';
        summary.departmentNameKh = '';
        summary.departmentNameEn = '';
        summary.serviceMode = '';
      }
      if (!existingData['system:triageStatus'] || existingData['system:triageStatus'] === 'REGISTERED' && body.transferToTriage === true) {
        data['system:triageStatus'] = body.registrationOnly === true ? 'REGISTERED' : 'WAITING';
        data['system:workflowStage'] = body.registrationOnly === true ? 'REGISTRATION_SAVED' : 'TRIAGE_WAITING';
        data['system:registeredAt'] = existingData['system:registeredAt'] || savedAt;
      }
    } else if (triageSave) {
      if (!summary.departmentCode || !summary.serviceMode) badRequest('Select a receiving ward/service before completing triage.');
      // v42.6: the official ANC record imports every Triage value; none may be blank.
      if (String(summary.departmentCode).toLowerCase() === 'anc') {
        const missing = ['p2_weight', 'p2_height', 'p2_bp_sys', 'p2_bp_dia', 'p2_pulse', 'p2_temp', 'p2_spo2']
          .filter(key => !String(data[`scope:triage:id:${key}`] ?? '').trim());
        if (missing.length) return sendJson(response, 400, { error: 'សូមបំពេញសញ្ញាជីវិតទាំងអស់ មុនបញ្ជូនទៅពិនិត្យផ្ទៃពោះ។', missing }, { secure: config.cookieSecure });
      }
      data['system:signature:triage'] = JSON.stringify(signatureSnapshot(database, session, savedAt));
      data['system:triageStatus'] = 'COMPLETED';
      const paraclinicRequested = submittedData['scope:triage:id:triage_paraclinic'] === true || submittedData['scope:triage:id:triage_paraclinic'] === 'true';
      data['system:triageParaclinic'] = paraclinicRequested;
      const wasTriageTransferred = Boolean(
        existingPatient && (
          existingData['system:triageStatus'] === 'COMPLETED' ||
          existingData['system:triageTransferred'] ||
          existingData['system:triageCompletedAt'] ||
          existingData['system:triageSaved']
        )
      );
      if (!wasTriageTransferred) {
        data['system:workflowStage'] = summary.serviceMode === 'ipd' ? 'WARD_WAITING'
          : paraclinicRequested ? 'OPD_PARACLINIC_ORDERING' : 'CASHIER_PENDING_OPD';
        data['system:triageCompletedAt'] = savedAt;
        data['system:triageReferredWardCode'] = summary.departmentCode;
        if (summary.serviceMode === 'opd') {
          data['system:opdEncounterAt'] = savedAt;
          if (paraclinicRequested) data['system:opdPreConsultParaclinicAt'] = savedAt;
          else delete data['system:opdPreConsultParaclinicAt'];
          delete data['system:opdConsultedAt'];
          delete data['system:opdConsultationPaidAt'];
          delete data['system:opdConsultationInvoiceId'];
        }
      } else {
        if (existingData['system:workflowStage']) data['system:workflowStage'] = existingData['system:workflowStage'];
        if (existingData['system:triageCompletedAt']) data['system:triageCompletedAt'] = existingData['system:triageCompletedAt'];
        data['system:triageUpdatedAt'] = savedAt;
      }
    } else if (activeClinicalRole === 'DOCTOR' || editorScope === 'medical' || maternalMidwife) {
      const doctorSig = JSON.stringify(signatureSnapshot(database, session, savedAt));
      data['system:signature:medical'] = doctorSig;
      const subTab = String(body.clinicalSubTab || '').toLowerCase();
      const svcMode = String(summary.serviceMode || existingPatient?.service_mode || '').toLowerCase();
      if (subTab === 'opd' || svcMode === 'opd') {
        data['system:signature:opdDoctor'] = doctorSig;
      } else if (subTab === 'ipd' || svcMode === 'ipd') {
        data['system:signature:ipdDoctor'] = doctorSig;
      } else {
        if (svcMode === 'opd') data['system:signature:opdDoctor'] = doctorSig;
        else data['system:signature:ipdDoctor'] = doctorSig;
      }
      if (activeClinicalRole === 'DOCTOR' && svcMode === 'opd') {
        data['system:opdConsultedAt'] = data['system:opdConsultedAt'] || savedAt;
      }
    } else if (activeClinicalRole === 'NURSE' || activeClinicalRole === 'MIDWIFE' || editorScope === 'nursing') {
      data['system:signature:nursing'] = JSON.stringify(signatureSnapshot(database, session, savedAt));
    }
    if (activeClinicalRole === 'DOCTOR' && existingPatient?.service_mode === 'opd' && data['system:opdConsultedAt']) {
      const currentBill = patientBill(database, patientKey);
      const outstanding = Number(currentBill?.summary?.KHR?.balance || 0) + Number(currentBill?.summary?.USD?.balance || 0);
      if (outstanding > 0 && currentBill?.invoice?.id) {
        data['system:cashierQueueRequest'] = {
          invoiceId: currentBill.invoice.id, sentAt: savedAt, sentBy: session.user_id,
          wardCode: 'opd', source: 'OPD_CONSULT',
        };
        queueCashierPayment(database, patientKey, data['system:cashierQueueRequest']);
      }
    }
    let prescriptionSnapshot = null;
    if (body.submitOpdPrescription === true) {
      if (activeClinicalRole !== 'DOCTOR' && !maternalMidwife) return sendJson(response, 403, { error: 'Only the prescribing doctor can submit an OPD prescription.' }, { secure: config.cookieSecure });
      // v42.6: the midwife prescribes only the medicines of the maternal services.
      if (maternalMidwife) {
        const allowed = maternalOptions().midwifeMedicines.map(name => name.toLowerCase());
        let rows = [];
        try { rows = JSON.parse(data['system:opdMedications'] || '[]'); } catch { rows = []; }
        const refused = (Array.isArray(rows) ? rows : []).filter(row => row?.name && !allowed.some(name => String(row.name).toLowerCase().replace(/^[a-z]{2}\d{4}(?:,\s*[a-z]{2}\d{4})*-/, '').startsWith(`${name}-`) || String(row.name).toLowerCase() === name));
        if (refused.length) return sendJson(response, 403, { error: 'ឆ្មបអាចចេញវេជ្ជបញ្ជាតែឱសថសេវាមាតាប៉ុណ្ណោះ។', refused: refused.map(row => row.name) }, { secure: config.cookieSecure });
      }
      try { prescriptionSnapshot = prepareOpdPrescription(data, summary, JSON.parse(data['system:signature:medical'])); }
      catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
    }
    let patient, pharmacySubmission = null, wardMedicineNotification = null, opdReferral = null;
    database.sqlite.exec('BEGIN IMMEDIATE');
    try {
      patient = database.upsertPatient({
        id: crypto.randomUUID(), patientKey, summary, data,
        userId: session.user_id, savedAt,
      });
      if (npcaPerson) saveBeneficiaryLink(database,patientKey,npcaPerson,npcaPayment,session.user_id);
      else if (registrationSave && existingPatient && (
        summary.firstName!==existingPatient.first_name || summary.lastName!==existingPatient.last_name || summary.sex!==existingPatient.sex || summary.dateOfBirth!==existingPatient.date_of_birth || summary.equityCard!==existingPatient.equity_card ||
        String(data['scope:registration:id:web_nssf']||'')!==String(existingData['scope:registration:id:web_nssf']||'')
      )) database.sqlite.prepare('UPDATE npca_patient_links SET eligible=0 WHERE patient_key=?').run(patientKey);
      saveEditorHistory(database, {
        patientKey, role: activeClinicalRole, editorScope, userId: session.user_id,
        editorName: String(session.display_name || session.username || ''), savedAt,
        existingData, data, nursingDays: body.nursingDays, nursingLabels: body.nursingLabels
      });
      ensureAdmissionMovement(database, patient, session.user_id, savedAt);
      const wasTransferredBefore = Boolean(
        existingPatient && (
          existingData['system:triageStatus'] === 'COMPLETED' ||
          existingData['system:triageTransferred'] ||
          existingData['system:triageCompletedAt'] ||
          existingData['system:triageSaved']
        )
      );
      if (triageSave && !wasTransferredBefore && patient.service_mode === 'opd' && isFreeMaternalService(patient)) {
        // v42.6: vaccination is free: straight to the midwife, no Cashier.
        data['system:workflowStage'] = 'DOCTOR_READY';
        data['system:maternalFreeService'] = true;
        delete data['system:cashierQueueRequest'];
        database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data), savedAt, patientKey);
        patient = database.findPatient(patientKey);
      } else if (triageSave && !wasTransferredBefore && patient.service_mode === 'opd') {
        const consultationCharge = addCatalogCharge(database, patientKey, 'OPD_CONSULT', session.user_id, `CARE_ROUTE:${patientKey}:OPD`, 'Automatically added when Triage selected OPD');
        const consultationBill = patientBill(database, patientKey, consultationCharge.invoiceId);
        const balance = Number(consultationBill?.summary?.KHR?.balance || 0) + Number(consultationBill?.summary?.USD?.balance || 0);
        data['system:opdConsultationInvoiceId'] = consultationCharge.invoiceId;
        if (balance > 0) {
          if (data['system:triageParaclinic'] === true || data['system:triageParaclinic'] === 'true') {
            data['system:workflowStage'] = 'OPD_PARACLINIC_ORDERING';
            delete data['system:cashierQueueRequest'];
          } else {
            data['system:workflowStage'] = 'CASHIER_PENDING_OPD';
            // v42.6: safe abortion is billed under the Gynecology ward.
            data['system:cashierQueueRequest'] = { invoiceId: consultationCharge.invoiceId, sentAt: savedAt, sentBy: session.user_id, wardCode: isGynecologyOutpatient(patient) ? 'gynecology' : 'opd', source: 'TRIAGE_OPD_CONSULTATION' };
            queueCashierPayment(database, patientKey, data['system:cashierQueueRequest']);
          }
        } else {
          data['system:opdConsultationPaidAt'] = savedAt;
          data['system:workflowStage'] = (data['system:triageParaclinic'] === true || data['system:triageParaclinic'] === 'true') ? 'OPD_PARACLINIC_ORDERING' : 'DOCTOR_READY';
          delete data['system:cashierQueueRequest'];
        }
        database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data), savedAt, patientKey);
        patient = database.findPatient(patientKey);
      }
      if (triageSave && !wasTransferredBefore && patient.service_mode === 'opd') {
        opdReferral = referToOpd(database, patientKey, savedAt);
      } else if (patient.service_mode === 'opd' && (activeClinicalRole === 'DOCTOR' || editorScope === 'medical')) {
        updateOpdQueueStatus(database, patientKey, 'IN_CONSULTATION', savedAt);
        if (!data['system:encounterId']) {
          const now = new Date(savedAt);
          const pad = (n, l = 2) => String(n).padStart(l, '0');
          const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
          const counterRow = database.sqlite.prepare("SELECT COUNT(*) as c FROM patient_records WHERE json_extract(record_json, '$.\"system:encounterId\"') LIKE ?").get(`OPD-${datePart}-%`);
          const seq = (counterRow?.c || 0) + 1;
          const encId = `OPD-${datePart}-${pad(seq, 4)}`;
          data['system:encounterId'] = encId;
          data['encounterId'] = encId;
          data['scope:triage:id:web_encounter_id'] = encId;
          database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data), savedAt, patientKey);
        }
      }
      const pendingDate = patient.service_mode === 'ipd' && ['DOCTOR', 'NURSE', 'MIDWIFE'].includes(activeClinicalRole)
        ? queueLateWardMedicineOrder(database, patient, patientWorkWard(patient),
          [...new Set([...wardMedicineOrderDates(data, patient.entry_date),
            ...wardMedicineOrderDates(existingData, patient.entry_date)])]) : '';
      wardMedicineNotification = null;
      if (['DOCTOR', 'NURSE', 'MIDWIFE'].includes(activeClinicalRole)) completePatientMessages(database, patientKey, messagingVisibility(session), { before: savedAt });
      audit(database, request, 'PATIENT_RECORD_SAVED', {
        userId: session.user_id,
        subjectUsername: session.username,
        details: {
          patientId: patient.id, patientKey, version: patient.version, editorScope, activeRole: activeClinicalRole,
          changedFields: patientRecordChangeNotes(existingPatient, database.findPatient(patientKey))
        },
      });
      if (patient.service_mode === 'ipd' && ['DOCTOR', 'NURSE', 'MIDWIFE'].includes(activeClinicalRole)) {
        const ward = patientWorkWard(patient);
        for (const date of wardMedicineOrderDates(data, patient.entry_date)) {
          syncMedicineStock(database, `IPD_DAILY:${patientKey}:${ward}:${date}`, ordersForDate(data, patient.entry_date, date).medications, session.user_id);
        }
      }
      if (prescriptionSnapshot) {
        pharmacySubmission = submitOpdPrescription(database, patient, prescriptionSnapshot, { userId: session.user_id, role: activeClinicalRole, wardCode: sessionWard(session) });
        if (!pharmacySubmission.duplicate) {
          updateOpdQueueStatus(database, patientKey, 'SENT_TO_PHARMACY', savedAt);
          syncMedicineStock(database, `OPD_RX:${pharmacySubmission.id}`, prescriptionSnapshot.medications || [], session.user_id);
        }
        audit(database, request, 'OPD_PRESCRIPTION_SUBMITTED', {
          userId: session.user_id, subjectUsername: session.username,
          details: { patientKey, prescriptionId: pharmacySubmission.id, duplicate: pharmacySubmission.duplicate }
        });
      }
      consumeCorrection(database, editAccess);
      syncClinicalRequests(database, patient, { userId: session.user_id, role: activeClinicalRole, wardCode: sessionWard(session) });
      database.sqlite.exec('COMMIT');
    } catch (error) { database.sqlite.exec('ROLLBACK'); throw error; }
    if (triageSave) {
      data['system:triageSaved'] = true;
      data['system:triageTransferred'] = true;
      const previousDept = (body.previousWard || existingPatient?.department_code || '').toLowerCase();
      const newDept = (patient.department_code || '').toLowerCase();
      const wardChanged = Boolean(body.triageWardChanged || (previousDept && newDept && previousDept !== newDept));

      const wasTransferredAtStart = Boolean(
        existingPatient && (
          existingData['system:triageStatus'] === 'COMPLETED' ||
          existingData['system:triageTransferred'] ||
          existingData['system:triageCompletedAt'] ||
          existingData['system:triageSaved']
        )
      );

      if (!wasTransferredAtStart) {
        if (wardChanged) {
          releasePatientFromHospitalMap(database, patientKey, session.user_id, savedAt);
          completePatientMessages(database, patientKey, messagingVisibility(session), {
            before: savedAt,
            subjectPattern: /^(New patient transferred from OPD|មានអ្នកជំងឺថ្មីពីតម្រៀប|អ្នកជំងឺឈ្មោះ.*ត្រូវបានបញ្ជូន)/
          });
          if (summary.serviceMode === 'ipd') {
            try { notifyTriageReferral(database, session, patient); } catch {}
          }
        } else if (!existingPatient?.department_code && summary.serviceMode === 'ipd') {
          try { notifyTriageReferral(database, session, patient); } catch {}
        }
      }
    }
    const responsePatient = patientRecordResponse(patient);
    responsePatient.recordAccess = encounterAccess(database, session, patient);
    if (activeClinicalRole === 'TRIAGE' && responsePatient.data) responsePatient.data = patientDataVisibleForRole(responsePatient.data, activeClinicalRole);
    return sendJson(response, 200, {
      patient: responsePatient, pharmacySubmission,
      opdQueue: patient.service_mode === 'opd' ? getOpdQueueEntry(database, patientKey) : null,
      wardMedicineNotification: wardMedicineNotification ? { id: wardMedicineNotification.id } : null
    }, {
      secure: config.cookieSecure,
    });
  });

  // 15. PATCH /api/patient-admission
  router.patch('/api/patient-admission', async (ctx) => {
    const {
      request, response, session, database, config, sendJson, readJson, audit,
      clinicalWriteRoles, clinicalPatientKey, canAccessPatient, sanitizeAdmissionAction,
      badRequest, parseStoredJson, buildIpdDischargeSummary, admissionWardCode,
      automaticWardMessage, sessionWard, releasePatientFromHospitalMap,
      patientRecordResponse,
    } = ctx;

    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!clinicalWriteRoles.has(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Your role cannot update admissions.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxPatientBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const existing = database.findPatient(patientKey);
    if (!existing) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    if (!canAccessPatient(database, session, existing)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const update = sanitizeAdmissionAction(body);
    try {
      const policy = encounterAccess(database, session, existing, 'medical');
      if (policy.discharged || policy.received && existing.service_mode === 'opd') {
        return sendJson(response, 403, { error: 'កំណត់ត្រាត្រូវបានបិទ។ ការកែប្រែក្រោយចេញពីពេទ្យត្រូវធ្វើតាមសំណើអនុម័ត។' }, { secure: config.cookieSecure });
      }
    } catch (error) {
      return sendJson(response, 403, { error: error.message }, { secure: config.cookieSecure });
    }
    if (update.action === 'discharge' && !['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'DOCTOR', 'CHIEF_WARD'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Only a doctor or administrator can discharge a patient.' }, { secure: config.cookieSecure });
    }
    const mapRow = database.findHospitalState('main'), assignmentMap = mapRow ? parseStoredJson(mapRow.state_json) : null;
    let assignmentBed = null;
    if (update.action === 'assign') {
      for (const d of assignmentMap?.departments || []) {
        for (const r of d.rooms || []) {
          for (const b of r.beds || []) {
            if (b.id === update.bedId) {
              if (d.code !== update.departmentCode || r.id !== update.roomId) badRequest('Choose a bed inside the receiving room.');
              assignmentBed = b;
            }
          }
        }
      }
      if (assignmentBed?.patientKey && assignmentBed.patientKey !== patientKey) {
        const occ = database.findPatient(assignmentBed.patientKey);
        if (occ && !occ.discharge_date && occ.department_code === update.departmentCode) badRequest('This bed is already occupied. Refresh the map.');
        else assignmentBed.patientKey = '';
      }
      if (database.sqlite.prepare("SELECT 1 FROM patient_records WHERE patient_key<>? AND COALESCE(discharge_date,'')='' AND json_extract(record_json,'$.\"system:currentBedId\"')=?").get(patientKey, update.bedId)) badRequest('This bed is already occupied.');
    }
    database.sqlite.exec('SAVEPOINT admission_request196');
    try {
      const savedAt = Date.now();
      const data = parseStoredJson(existing.record_json);
      const previousWardCode = data['system:currentWardCode'] || existing.department_code || '';
      const previousDepartmentCode = existing.department_code || '';
      const previousAdmissionStatus = data['system:admissionStatus'] || '';
      ensureAdmissionMovement(database, existing, session.user_id, savedAt);

      if (update.action === 'assign') {
        if (existing.department_code && existing.department_code !== update.departmentCode) {
          badRequest('Patient must be assigned inside the receiving department.');
        }
        data['system:admissionStatus'] = 'admitted';
        data['system:currentWardCode'] = update.roomCode || (update.careType === 'obstetric' ? 'obstetric' : update.departmentCode);
        data['system:currentRoomId'] = update.roomId;
        data['system:currentRoomNameKh'] = update.roomNameKh;
        data['system:currentRoomNameEn'] = update.roomNameEn;
        data['system:currentBedId'] = update.bedId;
        data['system:currentBedLabel'] = update.bedLabel;
        data['system:careType'] = update.careType || 'nurse';
        data['system:workflowStage'] = 'ADMITTED';
        if (!data['system:encounterId']) {
          const rawCode = (update.departmentCode || update.roomCode || 'ipd').toLowerCase();
          let prefix = 'IPD';
          if (rawCode.includes('emerg') || rawCode === 'er') prefix = 'EMG';
          else if (rawCode.includes('surg')) prefix = 'SURG';
          else if (rawCode.includes('mat') || rawCode.includes('obst') || rawCode.includes('deliv')) prefix = 'MAT';
          else if (rawCode.includes('med')) prefix = 'MED';
          else if (rawCode.includes('ped')) prefix = 'PED';
          else if (rawCode.includes('tb')) prefix = 'TB';
          else if (rawCode.includes('infectious')) prefix = 'MED';
          else if (rawCode.includes('art')) prefix = 'ART';
          const now = new Date(savedAt);
          const pad = (n, l = 2) => String(n).padStart(l, '0');
          const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
          const counterRow = database.sqlite.prepare("SELECT COUNT(*) as c FROM patient_records WHERE json_extract(record_json, '$.\"system:encounterId\"') LIKE ?").get(`${prefix}-${datePart}-%`);
          const seq = (counterRow?.c || 0) + 1;
          const encId = `${prefix}-${datePart}-${pad(seq, 4)}`;
          data['system:encounterId'] = encId;
          data['encounterId'] = encId;
          data['scope:triage:id:web_encounter_id'] = encId;
        }
      } else if (update.action === 'transfer') {
        data['system:admissionStatus'] = 'waiting-transfer';
        data['system:workflowStage'] = 'WARD_WAITING';
        data['system:currentWardCode'] = '';
        data['system:currentRoomId'] = '';
        data['system:currentRoomNameKh'] = '';
        data['system:currentRoomNameEn'] = '';
        data['system:currentBedId'] = '';
        data['system:currentBedLabel'] = '';
        data['system:careType'] = update.careType || '';
      } else {
        data['system:admissionStatus'] = 'discharged';
        data['system:workflowStage'] = 'DISCHARGED';
        data['system:currentWardCode'] = '';
        data['system:currentRoomId'] = '';
        data['system:currentRoomNameKh'] = '';
        data['system:currentRoomNameEn'] = '';
        data['system:currentBedId'] = '';
        data['system:currentBedLabel'] = '';
        data['system:discharge'] = update.discharge;
        data['system:ipdDischargeSummary'] = JSON.stringify(buildIpdDischargeSummary(database, existing, data, update.discharge));
        data['system:signature:discharge'] = JSON.stringify(signatureSnapshot(database, session, savedAt));
      }

      if (update.action !== 'discharge') {
        data['system:currentDepartmentCode'] = update.departmentCode;
        data['system:currentDepartmentNameKh'] = update.departmentNameKh;
        data['system:currentDepartmentNameEn'] = update.departmentNameEn;
      }

      if (update.action === 'assign') {
        const prefixMap = {
          emergency: 'EMG', surgery: 'SURG', gynecology: 'GYN', obstetric: 'MAT',
          maternity: 'MAT', pediatric: 'PED', pediatrics: 'PED', tb: 'TB', infectious: 'MED',
          icu: 'ICU', medicine: 'MED', medical: 'MED', opd: 'OPD'
        };
        const deptCode = String(update.departmentCode || update.roomCode || '').toLowerCase();
        const newPrefix = prefixMap[deptCode] || 'IPD';
        const currentEnc = String(data['system:encounterId'] || data['encounterId'] || '');
        if (!currentEnc.startsWith(`${newPrefix}-`)) {
          const now = new Date(savedAt);
          const pad = (n, l = 2) => String(n).padStart(l, '0');
          const datePart = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
          const counterRow = database.sqlite.prepare("SELECT COUNT(*) as c FROM patient_records WHERE json_extract(record_json, '$.\"system:encounterId\"') LIKE ?").get(`${newPrefix}-${datePart}-%`);
          const seq = (counterRow?.c || 0) + 1;
          const newEncId = `${newPrefix}-${datePart}-${pad(seq, 4)}`;
          data['system:encounterId'] = newEncId;
          data['encounterId'] = newEncId;
          data['scope:triage:id:web_encounter_id'] = newEncId;
        }

        const serviceCodeMap = {
          emergency: 'RH-EMG', surgery: 'RH-IPDSurg', gynecology: 'RH-IPDGen',
          obstetric: 'RH-Del', maternity: 'RH-Del', pediatric: 'RH-IPDGen',
          pediatrics: 'RH-IPDGen', tb: 'RH-TB1', infectious: 'RH-IPDGen', icu: 'RH-EMG', medicine: 'RH-IPDGen',
          medical: 'RH-IPDGen', opd: 'RH-OPDSpec'
        };
        if (serviceCodeMap[deptCode]) {
          const newServiceCode = serviceCodeMap[deptCode];
          data['system:serviceCode'] = newServiceCode;
          data['serviceCode'] = newServiceCode;
          data['scope:triage:id:web_service_code'] = newServiceCode;
        }
      }

      if (update.action !== 'assign') {
        releasePatientFromHospitalMap(database, patientKey, session.user_id, savedAt);
      }
      let patient;
      database.sqlite.exec('SAVEPOINT admission_stock');
      try {
        patient = database.updatePatientAdmission({
          patientKey,
          departmentCode: update.action === 'discharge' ? existing.department_code : update.departmentCode,
          departmentNameKh: update.action === 'discharge' ? existing.department_name_kh : update.departmentNameKh,
          departmentNameEn: update.action === 'discharge' ? existing.department_name_en : update.departmentNameEn,
          serviceMode: update.action === 'discharge' ? (existing.service_mode || 'ipd') : 'ipd',
          dischargeDate: update.dischargeDate,
          data,
          userId: session.user_id,
          savedAt,
        });
        if (update.action === 'discharge') {
          syncMedicineStock(database, `IPD_DISCHARGE:${patientKey}`, update.discharge?.medications || [], session.user_id);
        }
        database.sqlite.exec('RELEASE admission_stock');
      } catch (error) {
        database.sqlite.exec('ROLLBACK TO admission_stock');
        database.sqlite.exec('RELEASE admission_stock');
        throw error;
      }
      if (update.action === 'assign') {
        if (assignmentBed) {
          for (const d of assignmentMap.departments) {
            for (const r of d.rooms) {
              for (const b of r.beds) {
                if (b.patientKey === patientKey) b.patientKey = '';
              }
            }
          }
          assignmentBed.patientKey = patientKey;
          database.upsertHospitalState({ stateKey: 'main', state: assignmentMap, userId: session.user_id, savedAt });
        }
        completePatientMessages(database, patientKey, ctx.messagingVisibility(session), {
          before: savedAt,
          subjectPattern: /^(New patient transferred from OPD|មានអ្នកជំងឺថ្មីពីតម្រៀប|អ្នកជំងឺឈ្មោះ.*ត្រូវបានបញ្ជូន)/
        });
        recordBedAssignment(database, {
          patientKey,
          fromWardCode: previousAdmissionStatus === 'waiting-transfer' ? '' : previousWardCode,
          toWardCode: update.roomCode || update.departmentCode,
          fromDepartmentCode: previousDepartmentCode,
          toDepartmentCode: update.departmentCode,
          eventAt: savedAt,
          createdBy: session.user_id,
          details: { roomId: update.roomId, bedId: update.bedId, bedLabel: update.bedLabel, transferAssignment: previousAdmissionStatus === 'waiting-transfer' },
        });
        try {
          const wardCode = admissionWardCode(update);
          automaticWardMessage(
            database,
            { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) },
            patient,
            'មានអ្នកជំងឺចូលសម្រាកថ្មី',
            `អ្នកជំងឺ ${patient.full_name || patient.case_number || patient.patient_key} ត្រូវបានដាក់លើគ្រែ ${update.bedLabel || ''}។ សូមវេជ្ជបណ្ឌិតពិនិត្យ និងបំពេញកំណត់ត្រាវេជ្ជសាស្ត្រ។`,
            { wardCode, destinationRole: 'DOCTOR' },
          );
        } catch {}
      } else if (update.action === 'transfer') {
        recordMovement(database, {
          patientKey, eventType: 'INTERNAL_TRANSFER', fromWardCode: previousWardCode,
          toWardCode: update.departmentCode, fromDepartmentCode: previousDepartmentCode,
          toDepartmentCode: update.departmentCode, eventAt: savedAt, createdBy: session.user_id,
          details: { reason: 'internal-transfer' },
        });
      } else if (update.action === 'discharge') {
        const externalProvincial = update.discharge?.status === 'referred' &&
          update.discharge?.referralDestinationType === 'PROVINCIAL_HOSPITAL';
        const dischargeAtMs = update.discharge?.dischargeAt ? new Date(update.discharge.dischargeAt).getTime() : savedAt;
        recordMovement(database, {
          patientKey, eventType: externalProvincial ? 'EXTERNAL_TRANSFER' : 'DISCHARGE',
          fromWardCode: previousWardCode, toWardCode: '', fromDepartmentCode: previousDepartmentCode,
          toDepartmentCode: '', eventAt: Number.isFinite(dischargeAtMs) ? dischargeAtMs : savedAt,
          createdBy: session.user_id, details: update.discharge || {},
        });
      }
      syncClinicalRequests(database, patient, { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) });
      audit(database, request, `PATIENT_${update.action.toUpperCase()}`, {
        userId: session.user_id,
        subjectUsername: session.username,
        details: { patientKey, departmentCode: patient.department_code, bedId: update.bedId },
      });
      database.sqlite.exec('RELEASE admission_request196');
      return sendJson(response, 200, { patient: patientRecordResponse(patient) }, {
        secure: config.cookieSecure,
      });
    } catch (error) {
      database.sqlite.exec('ROLLBACK TO admission_request196');
      database.sqlite.exec('RELEASE admission_request196');
      throw error;
    }
  });

  // 16. PATCH /api/patient-dates
  router.patch('/api/patient-dates', async (ctx) => {
    const {
      request, response, session, database, config, sendJson, readJson, audit,
      clinicalWriteRoles, clinicalPatientKey, calendarDate, canAccessPatient,
      parseStoredJson, patientRecordResponse,
    } = ctx;

    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!clinicalWriteRoles.has(sessionRole(session)) && !['REGISTRATION', 'TRIAGE'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Your role cannot update patient dates.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const entryDate = calendarDate(body?.entryDate, 'entryDate');
    const existingPatient = database.findPatient(patientKey);
    if (!existingPatient) {
      return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    }
    if (!canAccessPatient(database, session, existingPatient)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const existingData = parseStoredJson(existingPatient.record_json);
    const storedDischarge = existingData['system:discharge'];
    const hasFormalDischarge = existingData['system:admissionStatus'] === 'discharged' &&
      storedDischarge && typeof storedDischarge === 'object';
    const hasOpdDischarge = existingPatient.service_mode === 'opd' && Boolean(existingData['system:opdDischarge']?.dispensedAt);
    const dischargeDate = hasFormalDischarge || hasOpdDischarge ? existingPatient.discharge_date : '';
    const savedAt = Date.now();
    const patient = database.updatePatientDates({
      patientKey, entryDate, dischargeDate, userId: session.user_id, savedAt,
    });
    audit(database, request, 'PATIENT_DATES_UPDATED', {
      userId: session.user_id,
      subjectUsername: session.username,
      details: { patientKey, entryDate, dischargeDate },
    });
    return sendJson(response, 200, { patient: patientRecordResponse(patient) }, {
      secure: config.cookieSecure,
    });
  });
}
