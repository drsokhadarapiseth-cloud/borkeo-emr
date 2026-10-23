import { canUseMaternalPatient, maternalOptions } from '../maternal.mjs';
import { uploadDirectory } from '../config.mjs';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {
  acknowledgeCritical, addAttachment, addParaclinicExtraFee, cancelOrder, createLabTest, createOrder, deleteLabTest,
  getAttachment, getOrder, imagingCatalog, labCatalog, listOrders, listParaclinicExtraFees, markReviewed, markResultViewed,
  updateImagingModality, updateLabTest, updateOrder, updateParaclinicExtraFee
} from '../paraclinic.mjs';
import {
  sessionRole, sessionWard, canAccessPatient, IMAGING_SUBTYPES, WARDS, patientWorkWard
} from '../access.mjs';
import { recordLegacyReview } from '../requests.mjs';
import { serviceCatalog, patientBill, voidFinanceItem, voidChargeBySource } from '../finance.mjs';
import { createSystemMessage, createStaffMessage, completePatientMessages } from '../messages.mjs';
import { useLabMaterials } from '../stock.mjs';
import { signatureSnapshot } from '../esign.mjs';
import { encounterAccess, RECORD_MANAGEMENT } from '../encounter-access.mjs';
import { queueCashierPayment } from '../invoice-edits.mjs';

export function mountParaclinicRoutes(router) {
  // 1. GET /api/lab-catalog
  router.get('/api/lab-catalog', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, sessionRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    requireContext(session);
    return sendJson(response, 200, { tests: labCatalog(database, ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(sessionRole(session))) }, { secure: config.cookieSecure });
  });

  // 2. POST /api/lab-catalog
  router.post('/api/lab-catalog', async (ctx) => {
    const { session, database, sendJson, response, config, readJson, request, audit, sessionRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(sessionRole(session))) return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, config.maxClinicalBodyBytes);
    try {
      const test = createLabTest(database, body || {});
      audit(database, request, 'LAB_CATALOG_CREATED', { userId: session.user_id, subjectUsername: session.username, details: { code: test.code } });
      return sendJson(response, 201, { test }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 3. PATCH /api/lab-catalog/:code
  router.patch(/^\/api\/lab-catalog\/([A-Z0-9_]+)$/, async (ctx) => {
    const { session, database, sendJson, response, config, readJson, request, audit, match, sessionRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'LAB'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxClinicalBodyBytes);
    if (sessionRole(session) === 'LAB') {
      const allowed = new Set(['baseUnit', 'units', 'referenceLow', 'referenceHigh', 'criticalLow', 'criticalHigh', 'referenceNote', 'referenceRules', 'criticalRules', 'criticalInclusive', 'referenceHighExclusive', 'referenceLowExclusive', 'locallyReviewed', 'active']);
      if (Object.keys(body || {}).some(k => !allowed.has(k))) {
        return sendJson(response, 403, { error: 'Laboratory staff may edit ranges, units and active status only.' }, { secure: config.cookieSecure });
      }
    }
    try {
      const test = updateLabTest(database, match[1], body || {});
      if (!test) return sendJson(response, 404, { error: 'Laboratory test not found.' }, { secure: config.cookieSecure });
      audit(database, request, 'LAB_CATALOG_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { code: test.code, active: test.active } });
      return sendJson(response, 200, { test }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 4. DELETE /api/lab-catalog/:code
  router.delete(/^\/api\/lab-catalog\/([A-Z0-9_]+)$/, async (ctx) => {
    const { session, database, sendJson, response, config, request, audit, match, sessionRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(sessionRole(session))) return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    const deleted = deleteLabTest(database, match[1]);
    if (!deleted) return sendJson(response, 404, { error: 'Laboratory test not found.' }, { secure: config.cookieSecure });
    audit(database, request, 'LAB_CATALOG_DELETED', { userId: session.user_id, subjectUsername: session.username, details: { code: match[1] } });
    return sendJson(response, 200, { ok: true, code: match[1] }, { secure: config.cookieSecure });
  });

  // 5. GET /api/imaging-catalog
  router.get('/api/imaging-catalog', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, sessionRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    requireContext(session);
    const includeInactive = ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'IMAGING'].includes(sessionRole(session));
    return sendJson(response, 200, { modalities: imagingCatalog(database, includeInactive) }, { secure: config.cookieSecure });
  });

  // 6. PATCH /api/imaging-catalog/:code
  router.patch(/^\/api\/imaging-catalog\/([A-Z0-9_]+)$/, async (ctx) => {
    const { session, database, sendJson, response, config, readJson, request, audit, match, sessionRole } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'IMAGING'].includes(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Imaging or administrator access is required.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxClinicalBodyBytes);
    try {
      const modality = updateImagingModality(database, match[1], body || {});
      if (!modality) return sendJson(response, 404, { error: 'Imaging modality not found.' }, { secure: config.cookieSecure });
      audit(database, request, 'IMAGING_CATALOG_UPDATED', { userId: session.user_id, subjectUsername: session.username, details: { code: modality.code, active: modality.active } });
      return sendJson(response, 200, { modality }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 7. GET /api/paraclinic/orders
  router.get('/api/paraclinic/orders', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, url, clinicalPatientKey, canAccessPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const patientKeyParam = url.searchParams.get('patientKey');
    const modalityParam = String(url.searchParams.get('modality') || '').toUpperCase();
    const statusParam = String(url.searchParams.get('status') || '').toUpperCase();
    let filters = {};
    if (patientKeyParam) filters.patientKey = clinicalPatientKey(patientKeyParam);
    if (modalityParam) filters.modality = modalityParam;
    if (statusParam) filters.status = statusParam;
    if (role === 'LAB') filters.modality = 'LAB';
    if (role === 'IMAGING' && filters.modality === 'LAB') {
      return sendJson(response, 403, { error: 'Imaging users cannot view laboratory worklists.' }, { secure: config.cookieSecure });
    }
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'LAB', 'IMAGING', 'DOCTOR', 'NURSE', 'MIDWIFE'].includes(role)) {
      return sendJson(response, 403, { error: 'Your role cannot view paraclinic orders.' }, { secure: config.cookieSecure });
    }
    let orders = listOrders(database, filters);
    if (role === 'LAB') {
      orders = orders.filter(item => {
        const row = database.findPatient(item.patientKey);
        if (row?.service_mode === 'opd') {
          const handoff = item.request?.opdHandoff || {};
          if (handoff.method === 'NURSE' && handoff.stage !== 'SENT_TO_DEPARTMENT') return false;
          return ['ORDERED', 'SENT_TO_LAB', 'RECEIVED', 'PROCESSING', 'RESULT_AVAILABLE', 'WARD_SEEN', 'REJECTED'].includes(item.status);
        }
        return ['SENT_TO_LAB', 'RECEIVED', 'PROCESSING', 'RESULT_AVAILABLE', 'WARD_SEEN', 'REJECTED'].includes(item.status);
      });
    }
    if (role === 'IMAGING') {
      orders = orders.filter(item => {
        if (item.modality === 'LAB' || item.status === 'PAYMENT_PENDING') return false;
        if (['RESULT_AVAILABLE', 'WARD_SEEN'].includes(item.status)) return true;
        const row = database.findPatient(item.patientKey);
        if (String(row?.service_mode || '').toLowerCase() === 'ipd') {
          return ['PATIENT_SENT_TO_IMAGING', 'IMAGING_RECEIVED'].includes(String(item.request?.wardWorkflow?.stage || '').toUpperCase());
        }
        if (String(row?.service_mode || '').toLowerCase() === 'opd') {
          const handoff = item.request?.opdHandoff || {};
          if (handoff.method === 'NURSE' && handoff.stage !== 'SENT_TO_DEPARTMENT') return false;
          return ['ORDERED', 'SCHEDULED', 'PERFORMED', 'PROCESSING', 'RESULT_AVAILABLE'].includes(item.status);
        }
        return true;
      });
    }
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'LAB', 'IMAGING'].includes(role)) {
      orders = orders.filter(item => {
        const row = database.findPatient(item.patientKey);
        return row && canAccessPatient(database, session, row);
      });
    }
    return sendJson(response, 200, { orders }, { secure: config.cookieSecure });
  });

  // 8. GET /api/opd/nurse-paraclinic-orders
  router.get('/api/opd/nurse-paraclinic-orders', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, sessionWard, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if ((role !== 'NURSE' || sessionWard(session) !== 'opd')) return sendJson(response, 403, { error: 'This queue is available to OPD nurses only.' }, { secure: config.cookieSecure });
    const orders = listOrders(database).filter(order => {
      const row = database.findPatient(order.patientKey);
      if (row?.service_mode !== 'opd' || order.status !== 'ORDERED' || order.request?.opdHandoff?.method !== 'NURSE' || !['WAITING_NURSE', 'NURSE_RECEIVED', 'SAMPLE_COLLECTED'].includes(order.request?.opdHandoff?.stage)) return false;
      const data = parseStoredJson(row.record_json);
      if (!data['system:opdConsultedAt'] && order.request?.opdPreConsult !== true) return false;
      const encounterAt = Number(data['system:opdEncounterAt'] || data['system:triageCompletedAt'] || order.createdAt || 0);
      return !database.sqlite.prepare('SELECT 1 FROM pharmacy_prescriptions WHERE patient_key=? AND submitted_at>=? LIMIT 1').get(order.patientKey, encounterAt);
    }).map(order => {
      const row = database.findPatient(order.patientKey);
      return { order, patient: { patientKey: row.patient_key, fullName: row.full_name || '', caseNumber: row.case_number || '', healthId: row.health_id || '', sex: row.sex || '', age: row.age || '', entryDate: row.entry_date || '' } };
    });
    return sendJson(response, 200, { orders }, { secure: config.cookieSecure });
  });

  // 9. POST /api/opd/nurse-paraclinic-orders/:id/action
  router.post(/^\/api\/opd\/nurse-paraclinic-orders\/([0-9a-f-]+)\/action$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, match, sessionWard, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if ((role !== 'NURSE' || sessionWard(session) !== 'opd')) return sendJson(response, 403, { error: 'Only OPD nurses can process these handoffs.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 10_000);
    const order = getOrder(database, match[1]);
    if (!order) return sendJson(response, 404, { error: 'Paraclinic request was not found.' }, { secure: config.cookieSecure });
    const patient = database.findPatient(order.patientKey);
    const handoff = order.request?.opdHandoff || {};
    if (patient?.service_mode !== 'opd' || handoff.method !== 'NURSE' || order.status !== 'ORDERED') {
      return sendJson(response, 409, { error: 'This request is not waiting for an OPD nurse handoff.' }, { secure: config.cookieSecure });
    }
    const patientData = parseStoredJson(patient.record_json);
    if (!patientData['system:opdConsultedAt'] && order.request?.opdPreConsult !== true) {
      return sendJson(response, 409, { error: 'This request is no longer available in the OPD nurse queue.' }, { secure: config.cookieSecure });
    }
    const encounterAt = Number(patientData['system:opdEncounterAt'] || patientData['system:triageCompletedAt'] || order.createdAt || 0);
    if (database.sqlite.prepare('SELECT 1 FROM pharmacy_prescriptions WHERE patient_key=? AND submitted_at>=? LIMIT 1').get(order.patientKey, encounterAt)) {
      return sendJson(response, 409, { error: 'This patient has a submitted prescription and no longer belongs on the OPD nurse sample queue.' }, { secure: config.cookieSecure });
    }
    const action = String(body?.action || '').toUpperCase();
    const stage = String(handoff.stage || '').toUpperCase();
    const chargeMode = String(order.request?.chargeMode || 'PAID').toUpperCase();
    const next = { ...handoff };
    const now = Date.now();
    if (action === 'COLLECT' && order.modality === 'LAB' && stage === 'WAITING_NURSE') {
      next.stage = 'SAMPLE_COLLECTED'; next.collectedBy = session.user_id; next.collectedAt = now;
    } else if (action === 'SEND' && ((order.modality === 'LAB' && stage === 'SAMPLE_COLLECTED') || (order.modality !== 'LAB' && stage === 'WAITING_NURSE'))) {
      next.stage = 'SENT_TO_DEPARTMENT'; next.sentBy = session.user_id; next.sentAt = now;
    } else {
      return sendJson(response, 409, { error: 'Complete the displayed nurse steps in order before sending this request.' }, { secure: config.cookieSecure });
    }
    const updatedRequest = { ...order.request, opdHandoff: next };
    const nextStatus = next.stage === 'SENT_TO_DEPARTMENT' && order.modality === 'LAB' ? 'SENT_TO_LAB' : 'ORDERED';
    try {
      database.sqlite.exec('BEGIN IMMEDIATE');
      try {
        database.sqlite.prepare('UPDATE paraclinic_orders SET status=?,request_json=?,collected_by=CASE WHEN ? THEN ? ELSE collected_by END,collected_at=CASE WHEN ? THEN ? ELSE collected_at END,updated_at=? WHERE id=?')
          .run(nextStatus, JSON.stringify(updatedRequest), action === 'COLLECT' ? 1 : 0, session.user_id, action === 'COLLECT' ? 1 : 0, action === 'COLLECT' ? now : null, now, order.id);
        database.sqlite.exec('COMMIT');
      } catch (error) { try { database.sqlite.exec('ROLLBACK'); } catch {} throw error; }
    } catch (error) { return sendJson(response, 409, { error: error.message || 'Unable to save the nurse handoff.' }, { secure: config.cookieSecure }); }
    const updated = getOrder(database, order.id);
    audit(database, request, `OPD_PARACLINIC_NURSE_${action}`, { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, patientKey: order.patientKey, stage: next.stage } });
    if (next.stage === 'SENT_TO_DEPARTMENT') {
      const destinationType = order.modality === 'LAB' ? 'LAB' : 'IMAGING';
      const destinationCode = order.modality === 'LAB' ? 'lab' : 'imaging';
      const modalityName = order.modality === 'LAB' ? 'Laboratory' : 'Imaging';
      createSystemMessage(database, {
        senderUserId: session.user_id,
        senderRole: role,
        senderWardCode: 'opd',
        destinationType,
        destinationCode,
        subject: `New ${modalityName} request • ${order.accessionNumber}`,
        body: `The OPD nurse completed the handoff for ${patient.full_name || patient.case_number || patient.patient_key}. The ${chargeMode === 'FREE' ? 'free' : 'paid'} request is ready for the department.`,
        patientKey: order.patientKey
      });
    }
    return sendJson(response, 200, { order: updated, stage: next.stage, cashierPaymentRequired: false }, { secure: config.cookieSecure });
  });

  // 10. GET /api/paraclinic/fee-services
  router.get('/api/paraclinic/fee-services', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, url } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const modality = String(url.searchParams.get('modality') || '').toUpperCase();
    if (!['ADMIN', 'VICE_DIRECTOR', 'LAB', 'IMAGING'].includes(role)) return sendJson(response, 403, { error: 'Laboratory or Imaging access is required.' }, { secure: config.cookieSecure });
    if (!['LAB', 'IMAGING'].includes(modality)) return sendJson(response, 400, { error: 'Select Laboratory or Imaging.' }, { secure: config.cookieSecure });
    if ((role === 'LAB' && modality !== 'LAB' || role === 'IMAGING' && modality !== 'IMAGING')) return sendJson(response, 403, { error: 'You cannot add fees for this department.' }, { secure: config.cookieSecure });
    const category = modality === 'LAB' ? 'LAB' : 'IMAGING';
    const services = serviceCatalog(database).filter(item => item.categoryCode === category && Number(item.defaultAmount) > 0);
    return sendJson(response, 200, { services }, { secure: config.cookieSecure });
  });

  // 11. GET /api/paraclinic/fees
  router.get('/api/paraclinic/fees', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, url, clinicalPatientKey, canAccessPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'NURSE', 'MIDWIFE'].includes(role)) return sendJson(response, 403, { error: 'Ward staff access is required.' }, { secure: config.cookieSecure });
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(role) && !canAccessPatient(database, session, patient)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const fees = listParaclinicExtraFees(database, { patientKey }).map(fee => {
      const bill = patientBill(database, patientKey, fee.invoiceId);
      const summary = bill?.summary || {};
      const paid = Number(summary.KHR?.balance || 0) + Number(summary.USD?.balance || 0) <= 0;
      return { ...fee, paymentState: fee.chargeVoidedAt || fee.waiverStatus === 'APPROVED' ? 'FREE' : paid ? 'PAID' : 'NOT_PAID' };
    });
    return sendJson(response, 200, { fees }, { secure: config.cookieSecure });
  });

  // 12. GET /api/paraclinic/fee-waivers
  router.get('/api/paraclinic/fee-waivers', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Administrator or Director access is required.' }, { secure: config.cookieSecure });
    const fees = listParaclinicExtraFees(database, { waiverStatus: 'PENDING' }).map(fee => {
      const patient = database.findPatient(fee.patientKey);
      return { ...fee, patientName: patient?.full_name || patient?.case_number || fee.patientKey, ward: patient?.department_code || '' };
    });
    return sendJson(response, 200, { fees }, { secure: config.cookieSecure });
  });

  // 13. POST /api/paraclinic/orders/:id/fees
  router.post(/^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/fees$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, match, sessionWard, addCatalogCharge, automaticWardMessage } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const order = getOrder(database, match[1]);
    if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
    const expectedRole = order.modality === 'LAB' ? 'LAB' : 'IMAGING';
    if (!['ADMIN', expectedRole].includes(role)) return sendJson(response, 403, { error: `${expectedRole} access is required to add this fee.` }, { secure: config.cookieSecure });
    const patient = database.findPatient(order.patientKey);
    if (!patient || String(patient.service_mode || '').toLowerCase() !== 'ipd') return sendJson(response, 400, { error: 'Extra paraclinic fees are available for IPD orders only.' }, { secure: config.cookieSecure });
    const body = await readJson(request, config.maxBodyBytes);
    const category = order.modality === 'LAB' ? 'LAB' : 'IMAGING';
    const service = serviceCatalog(database).find(item => item.code === String(body?.serviceCode || '').toUpperCase() && item.categoryCode === category && Number(item.defaultAmount) > 0);
    if (!service) return sendJson(response, 400, { error: `Choose an active ${category} service fee.` }, { secure: config.cookieSecure });
    const feeSource = `PARACLINIC_EXTRA:${order.id}:${crypto.randomUUID()}`;
    try {
      database.sqlite.exec('BEGIN IMMEDIATE');
      let charge, fee;
      try {
        charge = addCatalogCharge(database, patient.patient_key, service.code, session.user_id, feeSource, `Extra ${category} fee for ${order.accessionNumber}`, Number(body?.quantity || 1));
        fee = addParaclinicExtraFee(database, { orderId: order.id, patientKey: patient.patient_key, chargeId: charge.id, invoiceId: charge.invoiceId, serviceCode: service.code, userId: session.user_id });
        database.sqlite.exec('COMMIT');
      } catch (error) { try { database.sqlite.exec('ROLLBACK'); } catch {} throw error; }
      automaticWardMessage(database, { userId: session.user_id, role, wardCode: sessionWard(session) }, patient, `Extra ${category} fee added • ${order.accessionNumber}`, `${service.nameKh || service.nameEn}: ${charge.amount} ${charge.currency}. Please discuss the optional charge with the patient.`, {});
      audit(database, request, 'PARACLINIC_EXTRA_FEE_ADDED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey: patient.patient_key, orderId: order.id, feeId: fee.id, serviceCode: service.code, chargeId: charge.id } });
      return sendJson(response, 201, { fee: { ...fee, amount: charge.amount, currency: charge.currency }, charge }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 14. POST /api/paraclinic/fees/:id/(patient-informed|waiver-request|waiver-review)
  router.post(/^\/api\/paraclinic\/fees\/([0-9a-f-]+)\/(patient-informed|waiver-request|waiver-review)$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, match, sessionWard, messagingVisibility, automaticWardMessage, canAccessPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const body = await readJson(request, 10_000);
    const fee = listParaclinicExtraFees(database).find(item => item.id === match[1]);
    if (!fee) return sendJson(response, 404, { error: 'Paraclinic fee request was not found.' }, { secure: config.cookieSecure });
    const patient = database.findPatient(fee.patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    if (['NURSE', 'MIDWIFE'].includes(role) && !canAccessPatient(database, session, patient)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const action = match[2];
    const actionName = action === 'patient-informed' ? 'PATIENT_INFORMED' : action === 'waiver-request' ? 'REQUEST_WAIVER' : 'REVIEW_WAIVER';
    try {
      if (actionName === 'PATIENT_INFORMED' || actionName === 'REQUEST_WAIVER') {
        const feeBill = patientBill(database, fee.patientKey, fee.invoiceId);
        const summary = feeBill?.summary || {};
        if (Number(summary.KHR?.balance || 0) + Number(summary.USD?.balance || 0) <= 0 && !fee.chargeVoidedAt) {
          return sendJson(response, 409, { error: 'This invoice is already paid.' }, { secure: config.cookieSecure });
        }
      }
      if (actionName === 'REVIEW_WAIVER' && body?.approved === true) {
        const bill = patientBill(database, fee.patientKey, fee.invoiceId);
        const summary = bill?.summary || {};
        if (Number(summary.KHR?.balance || 0) + Number(summary.USD?.balance || 0) <= 0) {
          return sendJson(response, 409, { error: 'This invoice is already settled. Keep the payment record and ask Cashier to handle any correction.' }, { secure: config.cookieSecure });
        }
        database.sqlite.exec('BEGIN IMMEDIATE');
        try {
          voidFinanceItem(database, 'charge', fee.chargeId, `Free-charge request approved by ${role}${body?.note ? `: ${String(body.note).slice(0, 250)}` : ''}`, session.user_id);
          updateParaclinicExtraFee(database, fee.id, { action: actionName, approved: true, note: body?.note }, { role, userId: session.user_id });
          database.sqlite.exec('COMMIT');
        } catch (error) { try { database.sqlite.exec('ROLLBACK'); } catch {} throw error; }
      } else {
        updateParaclinicExtraFee(database, fee.id, { action: actionName, approved: body?.approved === true, reason: body?.reason, note: body?.note }, { role, userId: session.user_id });
      }
      const updated = listParaclinicExtraFees(database, { patientKey: fee.patientKey }).find(item => item.id === fee.id);
      if (actionName === 'REQUEST_WAIVER') {
        const message = {
          senderUserId: session.user_id, senderRole: role, senderWardCode: sessionWard(session),
          subject: `Free paraclinic fee approval requested • ${fee.accessionNumber}`,
          body: `${patient.full_name || patient.case_number}: ${fee.description} (${fee.serviceCode}). Amount: ${fee.amountMinor / 100} ${fee.currency}. Reason: ${updated.waiverReason}`,
          patientKey: fee.patientKey
        };
        createSystemMessage(database, { ...message, destinationType: 'ADMIN', destinationCode: 'admin' });
      }
      if (actionName === 'REVIEW_WAIVER') {
        recordLegacyReview(database, 'legacy-fee:' + fee.id, updated, { userId: session.user_id, role, wardCode: sessionWard(session) });
        if (updated.waiverStatus === 'REJECTED') {
          const ward = patientWorkWard(patient);
          if (WARDS.some(w => w.code === ward)) {
            createStaffMessage(database, { senderUserId: session.user_id, senderRole: role, destinationType: 'WARD', destinationCode: ward, subject: 'មតិកែតម្រូវសំណើលើកលែងសេវា', body: updated.reviewNote, patientKey: fee.patientKey });
          }
        }
      }
      if (actionName === 'REVIEW_WAIVER') completePatientMessages(database, fee.patientKey, messagingVisibility(session), { subjectIncludes: `Free paraclinic fee approval requested • ${fee.accessionNumber}` });
      if (actionName === 'REVIEW_WAIVER') automaticWardMessage(database, { userId: session.user_id, role, wardCode: sessionWard(session) }, patient, `Free paraclinic fee ${body?.approved === true ? 'approved' : 'declined'} • ${fee.accessionNumber}`, `${fee.description}: ${body?.approved === true ? 'Fee waived by Admin/Director.' : `Payment is still required.${body?.note ? ` Note: ${String(body.note).slice(0, 250)}` : ''}`}`);
      audit(database, request, `PARACLINIC_EXTRA_FEE_${actionName}`, { userId: session.user_id, subjectUsername: session.username, details: { feeId: fee.id, patientKey: fee.patientKey, approved: body?.approved === true } });
      return sendJson(response, 200, { fee: updated }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 15. POST /api/paraclinic/orders
  router.post('/api/paraclinic/orders', async (ctx) => {
    const {
      session, requireContext, database, sendJson, response, config, readJson, request, audit,
      sessionWard, clinicalPatientKey, canAccessPatient, parseStoredJson, paymentStatusForPatient,
      patientRecordResponse, opdConsultationPaymentRecorded, opdConsultationPaymentConfirmed,
      addParaclinicCharges, syncOpdParaclinicToRecord, automaticWardMessage
    } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['DOCTOR', 'ADMIN', 'VICE_DIRECTOR', 'MIDWIFE'].includes(role)) return sendJson(response, 403, { error: 'Only a doctor or administrator can create paraclinic requests.' }, { secure: config.cookieSecure });
    const body = await readJson(request, config.maxClinicalBodyBytes);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    // v42.6: the midwife orders only HBsAg from the Laboratory and ultrasound from
    // Imaging for her maternal-service patients (server/clinical-options.json "maternal").
    if (role === 'MIDWIFE') {
      const options = maternalOptions();
      const modalityRequested = String(body?.modality || '').toUpperCase();
      const items = Array.isArray(body?.request?.items) ? body.request.items : [];
      const allowedOrder = modalityRequested === 'LAB'
        ? items.length > 0 && items.every(item => options.midwifeLabTests.includes(String(item?.code || '').toUpperCase()))
        : options.midwifeImaging.includes(modalityRequested);
      if (!canUseMaternalPatient({ ...session, activeRole: role }, patient, sessionWard(session))) return sendJson(response, 403, { error: 'This patient is outside your service.' }, { secure: config.cookieSecure });
      if (!allowedOrder) return sendJson(response, 403, { error: 'ឆ្មបអាចស្នើតែ HBsAg និងអេកូសាស្ត្រប៉ុណ្ណោះ។' }, { secure: config.cookieSecure });
    }
    if (!canAccessPatient(database, session, patient) && !['ADMIN', 'VICE_DIRECTOR', 'DOCTOR'].includes(role)) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    if (['DOCTOR', 'CHIEF_WARD', ...RECORD_MANAGEMENT].includes(role)) {
      const access = encounterAccess(database, session, patient, 'medical');
      if (access.received && patient.service_mode === 'opd' || access.discharged) {
        return sendJson(response, 403, { error: 'កំណត់ត្រាត្រូវបានបិទ។ មិនអាចបង្កើតសំណើពិនិត្យថ្មីបានទេ។' }, { secure: config.cookieSecure });
      }
    }
    const patientData = parseStoredJson(patient.record_json);
    const workflowStage = String(patientData['system:workflowStage'] || '');
    const triageParaclinic = patientData['system:triageParaclinic'] === true || patientData['system:triageParaclinic'] === 'true';
    const payment = paymentStatusForPatient(database, patientKey);
    const paidEnough = ['PAID', 'INSURANCE', 'NGO', 'NSSF', 'HEF_EQUITY', 'HEF_VULNERABLE', 'EXEMPT', 'NSSF_OUTSIDE', 'NSSF_WORKER', 'NSSF_CIVIL', 'HEF_POOR', 'HEF_VULNERABLE_FAMILY', 'FULL_WAIVER'].includes(payment?.code);
    const consultationPaymentRecorded = opdConsultationPaymentRecorded(database, patient);
    const prePaymentReview = role === 'DOCTOR' && patient.service_mode === 'opd' && triageParaclinic && workflowStage === 'PARACLINIC_REVIEW_PENDING' && consultationPaymentRecorded;
    const preConsultOpd = role === 'DOCTOR' && patient.service_mode === 'opd' && triageParaclinic &&
      Boolean(patientData['system:opdPreConsultParaclinicAt']) && !patientData['system:opdConsultedAt'] && ['OPD_PARACLINIC_ORDERING', 'CASHIER_PENDING_PARACLINIC', 'PARACLINIC_RESULTS_PENDING', 'DOCTOR_READY'].includes(workflowStage);
    const postConsultOpd = ['DOCTOR', 'ADMIN', 'VICE_DIRECTOR', 'MIDWIFE'].includes(role) && patient.service_mode === 'opd' && consultationPaymentRecorded && !preConsultOpd && !prePaymentReview;
    const opdParaclinicFlow = preConsultOpd || prePaymentReview || postConsultOpd;
    if (patient.service_mode === 'opd' && !opdParaclinicFlow && !consultationPaymentRecorded) {
      return sendJson(response, 409, { error: 'Cashier confirmation of the OPD consultation fee is required before ordering paraclinic services.' }, { secure: config.cookieSecure });
    }
    if (patient.service_mode === 'opd' && !paidEnough && !opdParaclinicFlow) {
      return sendJson(response, 409, { error: 'The OPD consultation must be paid and saved before requesting additional paraclinic tests.' }, { secure: config.cookieSecure });
    }
    const modality = String(body?.modality || '').toUpperCase();
    if (!['LAB', ...IMAGING_SUBTYPES].includes(modality)) return sendJson(response, 400, { error: 'Paraclinic modality is invalid.' }, { secure: config.cookieSecure });
    if (modality !== 'LAB' && !imagingCatalog(database).some(item => item.code === modality)) return sendJson(response, 400, { error: 'This Imaging service is inactive. Reload the catalog before sending.' }, { secure: config.cookieSecure });
    let priority = String(body?.priority || 'ROUTINE').toUpperCase() === 'URGENT' ? 'URGENT' : 'ROUTINE';
    const requestData = body?.request && typeof body.request === 'object' && !Array.isArray(body.request) ? body.request : {};
    const ipdOrder = String(patient.service_mode || '').toLowerCase() === 'ipd';
    const chargeMode = ipdOrder ? 'FREE' : opdParaclinicFlow ? String(body?.chargeMode || 'PAID').toUpperCase() : 'PAID';
    if (opdParaclinicFlow && !['PAID', 'FREE'].includes(chargeMode)) return sendJson(response, 400, { error: 'Select whether this OPD paraclinic request requires payment or is free of charge.' }, { secure: config.cookieSecure });
    const handoffMode = opdParaclinicFlow ? String(body?.handoffMode || 'DIRECT').toUpperCase() : 'DIRECT';
    if (opdParaclinicFlow && !['DIRECT', 'NURSE'].includes(handoffMode)) return sendJson(response, 400, { error: 'Select direct Cashier-to-department or OPD nurse handoff.' }, { secure: config.cookieSecure });
    if (modality === 'LAB') {
      const items = Array.isArray(requestData.items) ? requestData.items : [];
      if (!items.length) return sendJson(response, 400, { error: 'Select at least one laboratory test.' }, { secure: config.cookieSecure });
      const catalogCodes = new Set(labCatalog(database).map(item => item.code));
      requestData.items = items.slice(0, 150).map(item => ({ code: String(item.code || '').toUpperCase(), urgent: item.urgent === true })).filter(item => catalogCodes.has(item.code));
      if (!requestData.items.length) return sendJson(response, 400, { error: 'No valid laboratory tests were selected.' }, { secure: config.cookieSecure });
      if (requestData.items.length !== items.length) return sendJson(response, 400, { error: 'A selected laboratory test is inactive, unavailable or exceeds the order limit. Reload the catalog before sending.' }, { secure: config.cookieSecure });
      if (requestData.items.some(item => item.urgent)) priority = 'URGENT';
    }
    const requestedPatient = patientRecordResponse(patient, false);
    requestData.patientSnapshot = Object.fromEntries(['patientKey', 'fullName', 'sex', 'age', 'dateOfBirth', 'healthId', 'caseNumber', 'phone', 'village', 'commune', 'district', 'province', 'departmentNameKh', 'departmentNameEn', 'currentWardCode', 'departmentCode'].map(key => [key, requestedPatient[key] || '']));
    requestData.patientSnapshot.diagnosis = String(requestData.clinicalInfo || requestData.diagnosis || requestedPatient.diagnosis || '');
    requestData.requesterSignature = signatureSnapshot(database, session, Date.now());
    if (opdParaclinicFlow || ipdOrder) requestData.chargeMode = chargeMode;
    if (opdParaclinicFlow) {
      requestData.opdHandoff = { method: handoffMode, stage: handoffMode === 'NURSE' ? 'WAITING_NURSE' : chargeMode === 'PAID' ? 'DIRECT_TO_CASHIER' : 'SENT_TO_DEPARTMENT' };
      if (preConsultOpd) {
        requestData.opdPreConsult = true;
        requestData.opdPreConsultInvoiceId = String(patientData['system:opdConsultationInvoiceId'] || '');
      }
    }
    const consultationSettled = patient.service_mode === 'opd' && opdConsultationPaymentConfirmed(database, patient);
    const paymentPending = prePaymentReview ||
      (preConsultOpd && (chargeMode === 'PAID' || !consultationSettled)) ||
      (postConsultOpd && chargeMode === 'PAID');
    let order;
    let investigationText = '';
    try {
      database.sqlite.exec('BEGIN IMMEDIATE');
      try {
        order = createOrder(database, {
          patientKey, modality, priority, request: requestData,
          userId: session.user_id, role, ward: sessionWard(session), paymentPending,
        });
        if (ipdOrder || (opdParaclinicFlow && chargeMode === 'FREE')) {
          // Free ipd or opd free
        } else {
          addParaclinicCharges(database, patientKey, order, session.user_id, { strict: !ipdOrder });
        }
        if (paymentPending && opdParaclinicFlow) {
          const currentData = parseStoredJson(database.findPatient(patientKey)?.record_json);
          currentData['system:workflowStage'] = 'CASHIER_PENDING_PARACLINIC';
          const currentBill = patientBill(database, patientKey);
          if (Number(currentBill?.summary?.KHR?.balance || 0) + Number(currentBill?.summary?.USD?.balance || 0) > 0 && currentBill?.invoice?.id) {
            currentData['system:cashierQueueRequest'] = { invoiceId: currentBill.invoice.id, sentAt: Date.now(), sentBy: session.user_id, wardCode: 'opd', source: 'PARACLINIC' };
            queueCashierPayment(database, patientKey, currentData['system:cashierQueueRequest']);
          }
          database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(currentData), Date.now(), patientKey);
        } else if (preConsultOpd) {
          const currentData = parseStoredJson(database.findPatient(patientKey)?.record_json);
          currentData['system:workflowStage'] = 'PARACLINIC_RESULTS_PENDING';
          database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(currentData), Date.now(), patientKey);
        }
        if (patient.service_mode === 'opd') investigationText = syncOpdParaclinicToRecord(database, patientKey, body?.opdInvestigationText);
        database.sqlite.exec('COMMIT');
      } catch (error) { try { database.sqlite.exec('ROLLBACK'); } catch {} throw error; }
    } catch (error) { return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure }); }
    audit(database, request, 'PARACLINIC_ORDER_CREATED', { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, patientKey, modality, priority, paymentPending, chargeMode: opdParaclinicFlow ? chargeMode : '', handoffMode: opdParaclinicFlow ? handoffMode : '', cashierInvoiceRequired: paymentPending } });
    try {
      const pName = patient.full_name || patient.case_number || patient.patient_key;
      const fromWardCode = opdParaclinicFlow ? 'opd' : (sessionWard(session) || 'ipd');
      const fromDeptKh = fromWardCode === 'opd' ? 'ផ្នែកពិគ្រោះក្រៅ' : (database.findWard?.(fromWardCode)?.nameKh || `ផ្នែក ${fromWardCode}`);
      const labMsg = `អ្នកជំងឺឈ្មោះ ${pName} ត្រូវបានបញ្ជូនពីផ្នែក ${fromDeptKh.replace(/^ផ្នែក\s*/, '')} មកមន្ទីរពិសោធន៍ សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ`;
      const imagingMsg = `អ្នកជំងឺឈ្មោះ ${pName} ត្រូវបានបញ្ជូនពីផ្នែក ${fromDeptKh.replace(/^ផ្នែក\s*/, '')} មកផ្នែករូបភាពវេជ្ជសាស្ត្រ សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ`;
      if (opdParaclinicFlow && handoffMode === 'NURSE' && !paymentPending) {
        automaticWardMessage(database, { userId: session.user_id, role, wardCode: 'opd' }, patient,
          modality === 'LAB' ? labMsg : imagingMsg, modality === 'LAB' ? labMsg : imagingMsg,
          { wardCode: 'opd', destinationRole: 'NURSE' });
      } else if (!paymentPending && ipdOrder) {
        automaticWardMessage(database, { userId: session.user_id, role, wardCode: sessionWard(session) }, patient,
          modality === 'LAB' ? labMsg : imagingMsg, modality === 'LAB' ? labMsg : imagingMsg);
      } else if (!paymentPending && modality !== 'LAB') {
        createSystemMessage(database, { senderUserId: session.user_id, senderRole: role, senderWardCode: sessionWard(session), destinationType: 'IMAGING', destinationCode: 'imaging', subject: imagingMsg, body: imagingMsg, patientKey });
      } else if (!paymentPending && opdParaclinicFlow && handoffMode === 'DIRECT' && modality === 'LAB') {
        createSystemMessage(database, { senderUserId: session.user_id, senderRole: role, senderWardCode: 'opd', destinationType: 'LAB', destinationCode: 'lab', subject: labMsg, body: labMsg, patientKey });
      }
    } catch {}
    return sendJson(response, 201, { order, investigationText, cashierPaymentRequired: paymentPending, nurseHandoffRequired: opdParaclinicFlow && handoffMode === 'NURSE', handoffMode: opdParaclinicFlow ? handoffMode : '', chargeMode: opdParaclinicFlow ? chargeMode : '' }, { secure: config.cookieSecure });
  });

  // 16. POST /api/paraclinic/send-to-cashier
  router.post('/api/paraclinic/send-to-cashier', async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, clinicalPatientKey, canAccessPatient, parseStoredJson } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (role !== 'DOCTOR') return sendJson(response, 403, { error: 'Only the OPD doctor can send paraclinic requests to Cashier.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 10_000);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    if (!canAccessPatient(database, session, patient)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const data = parseStoredJson(patient.record_json);
    if (patient.service_mode !== 'opd' || data['system:workflowStage'] !== 'PARACLINIC_REVIEW_PENDING') {
      return sendJson(response, 409, { error: 'This patient is not waiting for pre-payment paraclinic review.' }, { secure: config.cookieSecure });
    }
    const orders = listOrders(database, { patientKey }).filter(order => order.status === 'PAYMENT_PENDING');
    if (!orders.length) return sendJson(response, 400, { error: 'Select at least one paraclinic test before sending to Cashier.' }, { secure: config.cookieSecure });
    data['system:workflowStage'] = 'CASHIER_PENDING_PARACLINIC';
    const bill = patientBill(database, patientKey);
    if (Number(bill?.summary?.KHR?.balance || 0) + Number(bill?.summary?.USD?.balance || 0) > 0 && bill?.invoice?.id) {
      data['system:cashierQueueRequest'] = { invoiceId: bill.invoice.id, sentAt: Date.now(), sentBy: session.user_id, wardCode: 'opd', source: 'PARACLINIC' };
      queueCashierPayment(database, patientKey, data['system:cashierQueueRequest']);
    }
    database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data), Date.now(), patientKey);
    audit(database, request, 'PARACLINIC_SENT_TO_CASHIER', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, orderIds: orders.map(order => order.id) } });
    return sendJson(response, 200, { orders, workflowStage: 'CASHIER_PENDING_PARACLINIC' }, { secure: config.cookieSecure });
  });

  // 17. GET /api/paraclinic/orders/:id
  router.get(/^\/api\/paraclinic\/orders\/([0-9a-f-]+)$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, match, canAccessPatient, orderActorAllowed } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const order = getOrder(database, match[1]);
    if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
    const patient = database.findPatient(order.patientKey);
    const allowed = orderActorAllowed(role, order.modality) || role === 'DOCTOR' || (patient && canAccessPatient(database, session, patient));
    if (!allowed) return sendJson(response, 403, { error: 'You cannot view this request.' }, { secure: config.cookieSecure });
    return sendJson(response, 200, { order }, { secure: config.cookieSecure });
  });

  // 18. DELETE /api/paraclinic/orders/:id
  router.delete(/^\/api\/paraclinic\/orders\/([0-9a-f-]+)$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, match, canAccessPatient, parseStoredJson, syncOpdParaclinicToRecord } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['DOCTOR', 'ADMIN', 'VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Only the ordering doctor or administrator can delete this request.' }, { secure: config.cookieSecure });
    const hasDeleteBody = Number(request.headers['content-length'] || 0) > 0 || Boolean(request.headers['transfer-encoding']);
    const deleteBody = hasDeleteBody ? await readJson(request, 10_000) : {};
    const order = getOrder(database, match[1]);
    if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
    const patient = database.findPatient(order.patientKey);
    if (!patient || (!canAccessPatient(database, session, patient) && !['ADMIN', 'VICE_DIRECTOR'].includes(role))) {
      return sendJson(response, 403, { error: 'You cannot modify this request.' }, { secure: config.cookieSecure });
    }
    try {
      const wasPendingPayment = order.status === 'PAYMENT_PENDING';
      const cancelled = cancelOrder(database, order.id, { role, userId: session.user_id });
      voidChargeBySource(database, `PARACLINIC:${order.id}:`, session.user_id, 'Paraclinic request cancelled');
      const investigationText = patient.service_mode === 'opd' ? syncOpdParaclinicToRecord(database, order.patientKey, deleteBody?.opdInvestigationText) : '';
      if (wasPendingPayment && patient.service_mode === 'opd' && !database.sqlite.prepare("SELECT 1 FROM paraclinic_orders WHERE patient_key=? AND status='PAYMENT_PENDING' LIMIT 1").get(order.patientKey)) {
        const record = parseStoredJson(database.findPatient(order.patientKey)?.record_json);
        if (record['system:workflowStage'] === 'CASHIER_PENDING_PARACLINIC') {
          record['system:workflowStage'] = 'DOCTOR_READY';
          database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(record), Date.now(), order.patientKey);
        }
      }
      audit(database, request, 'PARACLINIC_ORDER_CANCELLED', { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, patientKey: order.patientKey, modality: order.modality } });
      return sendJson(response, 200, { order: cancelled, investigationText }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 409, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 19. PATCH /api/paraclinic/orders/:id and POST /api/paraclinic/orders/:id/result
  const patchOrResultHandler = async (ctx) => {
    const {
      session, requireContext, database, sendJson, response, config, readJson, request, audit, match,
      sessionWard, canAccessPatient, parseStoredJson, messagingVisibility, orderActorAllowed,
      labWardWorkflowRole, automaticWardMessage
    } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const targetOrderId = match[1];
    const isResult = ctx.pathname.endsWith('/result');
    const order = getOrder(database, targetOrderId);
    if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
    const patient = database.findPatient(order.patientKey);
    const labWardAllowed = order.modality === 'LAB' && labWardWorkflowRole(role) && patient && canAccessPatient(database, session, patient);
    const imagingWardAllowed = order.modality !== 'LAB' && ['NURSE', 'MIDWIFE'].includes(role) && String(patient?.service_mode || '').toLowerCase() === 'ipd' && patient && canAccessPatient(database, session, patient);
    if (!orderActorAllowed(role, order.modality) && !labWardAllowed && !imagingWardAllowed) {
      return sendJson(response, 403, { error: 'Your role cannot update this paraclinic workflow.' }, { secure: config.cookieSecure });
    }
    const rawBody = await readJson(request, config.maxPatientBodyBytes);
    const body = isResult ? { result: rawBody?.result || rawBody, release: true } : (rawBody || {});
    let updated, investigationText = '';
    try {
      database.sqlite.exec('BEGIN IMMEDIATE');
      try {
        updated = updateOrder(database, order.id, body || {}, { userId: session.user_id, role });
        completePatientMessages(database, order.patientKey, messagingVisibility(session), { subjectIncludes: order.accessionNumber });
        if (body?.release === true) {
          if (order.modality === 'LAB' && !order.releasedAt) {
            useLabMaterials(database, updated, session.user_id);
          }
          if (patient?.service_mode === 'opd') {
            const current = database.findPatient(patient.patient_key);
            const record = parseStoredJson(current?.record_json);
            const preConsultAt = Number(record['system:opdPreConsultParaclinicAt'] || 0);
            if (preConsultAt && !record['system:opdConsultedAt']) {
              const required = listOrders(database, { patientKey: patient.patient_key }).filter(item => item.request?.opdPreConsult === true && Number(item.createdAt || 0) >= preConsultAt && item.status !== 'CANCELLED');
              if (required.length && required.every(item => Boolean(item.releasedAt))) {
                record['system:workflowStage'] = 'DOCTOR_READY';
                record['system:opdPreConsultResultsAt'] = Date.now();
                database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(record), Date.now(), patient.patient_key);
              }
            }
          }
        }
        database.sqlite.exec('COMMIT');
      } catch (error) {
        try { database.sqlite.exec('ROLLBACK'); } catch {}
        throw error;
      }
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
    let auditAction = body?.release ? 'PARACLINIC_RESULT_RELEASED' : 'PARACLINIC_RESULT_SAVED';
    const requestedStatus = String(body?.status || '').toUpperCase();
    if (!body?.release && requestedStatus) auditAction = `PARACLINIC_${requestedStatus}`;
    audit(database, request, auditAction, { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, modality: order.modality, accessionNumber: updated.accessionNumber } });
    try {
      if (order.modality === 'LAB' && requestedStatus === 'SENT_TO_LAB') {
        createSystemMessage(database, { senderUserId: session.user_id, senderRole: role, senderWardCode: sessionWard(session), destinationType: 'LAB', destinationCode: 'lab', subject: `Sample sent • ${updated.accessionNumber}`, body: `Ward sent a laboratory specimen for ${patient?.full_name || patient?.case_number || updated.patientKey}.`, patientKey: updated.patientKey });
      }
      const workflowStage = String(updated.request?.wardWorkflow?.stage || '').toUpperCase();
      if (imagingWardAllowed && workflowStage === 'PATIENT_SENT_TO_IMAGING') {
        const modalityName = ({ ULTRASOUND: 'Ultrasound', XRAY: 'X-ray', CT: 'CT', MRI: 'MRI' })[order.modality] || order.modality;
        createSystemMessage(database, { senderUserId: session.user_id, senderRole: role, senderWardCode: sessionWard(session), destinationType: 'IMAGING', destinationCode: 'imaging', subject: `Patient sent for ${modalityName} • ${updated.accessionNumber}`, body: `Ward nurse sent ${patient?.full_name || patient?.case_number || updated.patientKey} for ${modalityName}. Please receive the patient.`, patientKey: updated.patientKey });
      }
      if (order.modality === 'LAB' && requestedStatus === 'REJECTED') {
        automaticWardMessage(database, { userId: session.user_id, role, wardCode: sessionWard(session) }, patient,
          `⚠ Laboratory sample rejected • ${updated.accessionNumber}`, `Reason: ${updated.rejectionReason || 'Specimen rejected by laboratory.'} Please collect a replacement sample.`);
      }
      if (order.modality === 'LAB' && body?.release === true) {
        const isOpdPatient = String(patient?.service_mode || '').toLowerCase() === 'opd';
        automaticWardMessage(database, { userId: session.user_id, role, wardCode: sessionWard(session) }, patient,
          isOpdPatient ? `Laboratory result ready for OPD doctor • ${updated.accessionNumber}` : `Laboratory result returned • ${updated.accessionNumber}`,
          isOpdPatient
            ? `Laboratory completed the OPD test. The result for ${patient?.full_name || patient?.case_number || updated.patientKey} is ready for the OPD doctor.`
            : `Laboratory result is available for ${patient?.full_name || patient?.case_number || updated.patientKey}. Please review and mark seen.`,
          isOpdPatient ? { wardCode: 'opd', destinationRole: 'DOCTOR' } : {});
      }
      if (order.modality !== 'LAB' && body?.release === true) {
        automaticWardMessage(database, { userId: session.user_id, role, wardCode: sessionWard(session) }, patient,
          `${order.modality} report returned • ${updated.accessionNumber}`, `Imaging report is available for ${patient?.full_name || patient?.case_number || updated.patientKey}.`);
      }
    } catch {}
    return sendJson(response, 200, { order: updated, investigationText }, { secure: config.cookieSecure });
  };

  router.patch(/^\/api\/paraclinic\/orders\/([0-9a-f-]+)$/, patchOrResultHandler);
  router.post(/^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/result$/, patchOrResultHandler);

  // 20. POST /api/paraclinic/orders/:id/critical-ack
  router.post(/^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/critical-ack$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readJson, request, audit, match, canAccessPatient } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['DOCTOR', 'ADMIN', 'VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Only a doctor can acknowledge a critical result.' }, { secure: config.cookieSecure });
    const order = getOrder(database, match[1]);
    if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
    const patient = database.findPatient(order.patientKey);
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(role) && (!patient || !canAccessPatient(database, session, patient))) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxClinicalBodyBytes);
    try {
      const updated = acknowledgeCritical(database, order.id, session.user_id, body?.note);
      audit(database, request, 'PARACLINIC_CRITICAL_ACKNOWLEDGED', { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, accessionNumber: updated.accessionNumber } });
      return sendJson(response, 200, { order: updated }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 21. POST /api/paraclinic/orders/:id/(review|view)
  router.post(/^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/(review|view)$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, audit, match, sessionWard, canAccessPatient, messagingVisibility } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['DOCTOR', 'ADMIN', 'VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Only a doctor can acknowledge a result.' }, { secure: config.cookieSecure });
    const order = getOrder(database, match[1]);
    if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
    const patient = database.findPatient(order.patientKey);
    const orderWard = order.ward || patientWorkWard(patient);
    const userWard = sessionWard(session);
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(role) && (!patient || !canAccessPatient(database, session, patient) || (userWard && orderWard && userWard !== orderWard))) {
      return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    }
    let updated;
    try {
      updated = match[2] === 'view' ? markResultViewed(database, order.id, session.user_id) : markReviewed(database, order.id, session.user_id);
    } catch (error) {
      return sendJson(response, 409, { error: error.message }, { secure: config.cookieSecure });
    }
    completePatientMessages(database, order.patientKey, messagingVisibility(session), { subjectIncludes: order.accessionNumber });
    audit(database, ctx.request, match[2] === 'view' ? 'PARACLINIC_RESULT_VIEWED' : 'PARACLINIC_RESULT_REVIEWED', { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id } });
    return sendJson(response, 200, { order: updated }, { secure: config.cookieSecure });
  });

  // 22. POST /api/paraclinic/orders/:id/attachments
  router.post(/^\/api\/paraclinic\/orders\/([0-9a-f-]+)\/attachments$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, readBinary, request, audit, match, orderActorAllowed, safeAttachmentName } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    const order = getOrder(database, match[1]);
    if (!order) return sendJson(response, 404, { error: 'Request not found.' }, { secure: config.cookieSecure });
    if (!orderActorAllowed(role, order.modality)) return sendJson(response, 403, { error: 'Your role cannot attach files to this request.' }, { secure: config.cookieSecure });
    const contentType = String(request.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    const extensionByType = { 'application/pdf': '.pdf', 'image/jpeg': '.jpg', 'image/png': '.png' };
    const extension = extensionByType[contentType];
    if (!extension) return sendJson(response, 415, { error: 'Only PDF, JPEG and PNG attachments are allowed.' }, { secure: config.cookieSecure });
    const bytes = await readBinary(request, 12 * 1024 * 1024);
    if (!bytes.length) return sendJson(response, 400, { error: 'Attachment is empty.' }, { secure: config.cookieSecure });
    const uploadRoot = uploadDirectory(config, order.id);
    fs.mkdirSync(uploadRoot, { recursive: true });
    const storedName = `${crypto.randomUUID()}${extension}`;
    const storagePath = path.join(uploadRoot, storedName);
    fs.writeFileSync(storagePath, bytes, { flag: 'wx' });
    const attachment = addAttachment(database, order.id, {
      filename: safeAttachmentName(request.headers['x-file-name']), contentType, storagePath, userId: session.user_id,
    });
    audit(database, request, 'PARACLINIC_ATTACHMENT_ADDED', { userId: session.user_id, subjectUsername: session.username, details: { orderId: order.id, attachmentId: attachment.id } });
    return sendJson(response, 201, { attachment }, { secure: config.cookieSecure });
  });

  // 23. GET /api/paraclinic/attachments/:id
  router.get(/^\/api\/paraclinic\/attachments\/([0-9a-f-]+)$/, async (ctx) => {
    const { session, requireContext, database, sendJson, response, config, redirect, sendFile, match, canAccessPatient, orderActorAllowed } = ctx;
    if (!session) return redirect(response, '/login', { secure: config.cookieSecure });
    const role = requireContext(session);
    const attachment = getAttachment(database, match[1]);
    if (!attachment) return sendJson(response, 404, { error: 'Attachment not found.' }, { secure: config.cookieSecure });
    const patient = database.findPatient(attachment.patient_key);
    const allowed = orderActorAllowed(role, attachment.modality) || (patient && canAccessPatient(database, session, patient));
    if (!allowed) return sendJson(response, 403, { error: 'You cannot view this attachment.' }, { secure: config.cookieSecure });
    return sendFile(response, attachment.storage_path, attachment.content_type, { secure: config.cookieSecure }, false);
  });
}
