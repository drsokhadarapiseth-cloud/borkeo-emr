import { logFromContext } from '../record-access.mjs';
import crypto from 'node:crypto';
import { listSymptoms, addCustomSymptom, SYMPTOM_CREATE_ROLES } from '../symptoms.mjs';
import { medicineCatalogue } from '../medicine-catalogue.mjs';
import { roleCanPage, WARDS } from '../access.mjs';
import { listPatientInvoices, patientBill, startPatientInvoice } from '../finance.mjs';
import {
  MANAGEMENT, listWorkflowRequests, getWorkflowRequest, submitWorkflowRequest,
  reviewWorkflowRequest, applyServiceConcession, legacyReviewHistory, syncClinicalRequests
} from '../requests.mjs';
import { listParaclinicExtraFees } from '../paraclinic.mjs';
import { listConcessions } from '../payment-policy.mjs';
import {
  wardMedicineRequestKeys, reviewedWardMedicineReport, approvalFor, medicineStage as stage
} from '../ward-medicine-approvals.mjs';
import { listEditorHistory } from '../editor-history.mjs';
import { signatureSnapshot } from '../esign.mjs';
import { dailyHospitalReport, recordMovement } from '../daily-report.mjs';
import { opdLocalDate } from '../opd-queue.mjs';
import { pmrs2Preview } from '../pmrs2-mapping.mjs';
import { buildPmrs2TransferPackage, pmrs2ReviewIssues } from '../pmrs2-transfer.mjs';
import { normalizePmrsId, preparePmrsMedicineImport, applyPmrsMedicineImport } from '../pmrs2-medicine-import.mjs';
import { admissionApprovalFor, listPendingAdmissionApprovals } from '../admission-approvals.mjs';
import { completePatientMessages } from '../messages.mjs';
import { assertEncounterWrite } from '../encounter-access.mjs';
import { validate, Schemas } from '../validation.mjs';

export function mountClinicalRoutes(router) {
  // 1. GET /api/symptoms
  router.get('/api/symptoms', async (ctx) => {
    const { session, database, config, sendJson, sessionRole } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = sessionRole(session);
    const canCreate = SYMPTOM_CREATE_ROLES.has(role);
    return sendJson(ctx.response, 200, { items: listSymptoms(database), canCreate }, { secure: config.cookieSecure });
  });

  // v42.3: GET /api/medicines/catalogue - Cambodia Essential Medicines List for
  // the medicine name search in the prescription forms (searched in the browser).
  router.get('/api/medicines/catalogue', async (ctx) => {
    const { session, config, sendJson } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    return sendJson(ctx.response, 200, medicineCatalogue(), { secure: config.cookieSecure });
  });

  // 2. POST /api/symptoms
  router.post('/api/symptoms', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, sessionRole, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = sessionRole(session);
    const canCreate = SYMPTOM_CREATE_ROLES.has(role);
    if (!canCreate) return sendJson(response, 403, { error: 'A clinical or management role is required to add symptoms.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 8192);
    const validSymptom = validate(body, Schemas.symptom);
    if (!validSymptom.valid) return sendJson(response, 400, { error: validSymptom.error, details: validSymptom.errors }, { secure: config.cookieSecure });
    try {
      const result = addCustomSymptom(database, validSymptom.data, session.user_id);
      if (result.created) audit(database, request, 'SYMPTOM_CREATED', { userId: session.user_id, subjectUsername: session.username, details: { symptomId: result.item.id, nameKh: result.item.nameKh, nameEn: result.item.nameEn, activeRole: role } });
      return sendJson(response, result.created ? 201 : 200, result, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, error.status || 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 3. GET /api/icd10/search
  router.get('/api/icd10/search', async (ctx) => {
    const { session, response, config, sendJson, url, diagnosisSearch } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    try {
      return sendJson(response, 200, diagnosisSearch.search(url.searchParams.get('q'), 40), { secure: config.cookieSecure });
    } catch {
      return sendJson(response, 503, { error: 'Diagnosis catalogue unavailable.' }, { secure: config.cookieSecure });
    }
  });

  // 4. GET /api/requests/invoices
  router.get('/api/requests/invoices', async (ctx) => {
    const { session, database, config, sendJson, url, sessionRole, sessionWard, canAccessPatient } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const actor = { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) };
    if (!roleCanPage(actor.role, '/requests')) return sendJson(ctx.response, 403, { error: 'Request access required.' }, { secure: config.cookieSecure });
    const p = database.findPatient(String(url.searchParams.get('patientKey') || ''));
    if (!p || (!['CLERK', 'ACCOUNTANT'].includes(actor.role) && !canAccessPatient(database, session, p))) {
      return sendJson(ctx.response, 403, { error: 'This patient is outside your ward.' }, { secure: config.cookieSecure });
    }
    const invoices = listPatientInvoices(database, p.patient_key);
    return sendJson(ctx.response, 200, { invoices: invoices.map(i => ({ ...i, bill: patientBill(database, p.patient_key, i.id) })) }, { secure: config.cookieSecure });
  });

  // 5. GET /api/requests/counts
  router.get('/api/requests/counts', async (ctx) => {
    const { session, database, config, sendJson, sessionRole, sessionWard } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const actor = { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) };
    if (!roleCanPage(actor.role, '/requests')) return sendJson(ctx.response, 403, { error: 'Request access required.' }, { secure: config.cookieSecure });

    const counts = { ADMISSION: 0, DISCHARGE: 0, MEDICINE: 0, FEE: 0 };
    const isMgmt = MANAGEMENT.includes(actor.role);
    const isCashier = ['CLERK', 'ACCOUNTANT'].includes(actor.role);
    const isPharmacy = actor.role === 'PHARMACY';

    if (!isCashier && !isPharmacy) {
      if (isMgmt) {
        const rows = database.sqlite.prepare(`
          SELECT kind, COUNT(*) as c FROM workflow_requests
          WHERE status = 'PENDING' AND kind IN ('ADMISSION', 'DISCHARGE')
          GROUP BY kind
        `).all();
        for (const r of rows) counts[r.kind] = r.c;
      } else {
        const rows = database.sqlite.prepare(`
          SELECT kind, COUNT(*) as c FROM workflow_requests
          WHERE status = 'PENDING' AND kind IN ('ADMISSION', 'DISCHARGE')
            AND (submitted_by = ? OR (? != '' AND source_ward = ?))
          GROUP BY kind
        `).all(actor.userId, actor.wardCode || '', actor.wardCode || '');
        for (const r of rows) counts[r.kind] = r.c;
      }
    }

    if (!isPharmacy) {
      if (isMgmt) {
        const feeRow = database.sqlite.prepare(`
          SELECT COUNT(*) as c FROM workflow_requests
          WHERE status = 'PENDING' AND kind = 'FEE'
        `).get();
        let feeCount = feeRow?.c || 0;

        const extraFees = database.sqlite.prepare(`
          SELECT COUNT(*) as c FROM paraclinic_extra_fees
          WHERE waiver_status = 'PENDING'
        `).get();
        feeCount += (extraFees?.c || 0);

        const concessions = database.sqlite.prepare(`
          SELECT COUNT(*) as c FROM finance_concession_requests
          WHERE status = 'PENDING'
        `).get();
        feeCount += (concessions?.c || 0);

        counts.FEE = feeCount;
      } else if (!isCashier) {
        const feeRow = database.sqlite.prepare(`
          SELECT COUNT(*) as c FROM workflow_requests
          WHERE status = 'PENDING' AND kind = 'FEE'
            AND (submitted_by = ? OR (? != '' AND source_ward = ?))
        `).get(actor.userId, actor.wardCode || '', actor.wardCode || '');
        counts.FEE = feeRow?.c || 0;
      }
    }

    if (isMgmt || isPharmacy || actor.wardCode) {
      const keys = wardMedicineRequestKeys(database);
      let medCount = 0;
      for (const x of keys) {
        if (!isMgmt && !isPharmacy && actor.wardCode !== x.ward_code) continue;
        const approval = approvalFor(database, x.ward_code, x.report_date);
        const st = stage(approval);
        if (st.status === 'chief_signed') {
          if (!isPharmacy) medCount++;
        }
      }
      counts.MEDICINE = medCount;
    }

    return sendJson(ctx.response, 200, { counts }, { secure: config.cookieSecure });
  });

  // 6. GET /api/requests
  router.get('/api/requests', async (ctx) => {
    const { session, database, config, sendJson, sessionRole, sessionWard } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const actor = { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) };
    if (!roleCanPage(actor.role, '/requests')) return sendJson(ctx.response, 403, { error: 'Request access required.' }, { secure: config.cookieSecure });

    const items = listWorkflowRequests(database, actor);
    if (MANAGEMENT.includes(actor.role)) {
      for (const fee of listParaclinicExtraFees(database).filter(f => ['PENDING', 'APPROVED', 'REJECTED'].includes(f.waiverStatus))) {
        const p = database.findPatient(fee.patientKey);
        const history = legacyReviewHistory(database, 'legacy-fee:' + fee.id);
        items.push({
          history,
          signature: history.at(-1)?.signature || (fee.reviewerName ? { name: fee.reviewerName, signedAt: fee.reviewedAt } : {}),
          reviewNote: fee.reviewNote,
          id: 'legacy-fee:' + fee.id,
          kind: 'FEE',
          status: fee.waiverStatus,
          patientKey: fee.patientKey,
          patientName: p?.full_name || '',
          reason: fee.waiverReason,
          sourceWard: p?.department_code || '',
          payload: { percent: 100, mode: 'PERCENT', items: [{ description: fee.description, currency: fee.currency, originalMinor: fee.amountMinor, amountMinor: fee.amountMinor }] },
          revision: 1,
          submittedAt: fee.waiverRequestedAt,
        });
      }
      for (const inv of database.sqlite.prepare('SELECT DISTINCT invoice_id FROM finance_concession_requests').all()) {
        for (const fee of listConcessions(database, actor, { invoiceId: inv.invoice_id })) {
          const history = legacyReviewHistory(database, 'legacy-cash:' + fee.id);
          items.push({
            ...fee,
            history,
            signature: history.at(-1)?.signature || (fee.reviewedByName ? { name: fee.reviewedByName, signedAt: fee.reviewedAt } : {}),
            id: 'legacy-cash:' + fee.id,
            kind: 'FEE',
            revision: 1,
            submittedAt: fee.requestedAt,
          });
        }
      }
    }
    const medicineRows = wardMedicineRequestKeys(database).sort((a, b) => b.report_date.localeCompare(a.report_date));
    for (const x of medicineRows) {
      if (!MANAGEMENT.includes(actor.role) && actor.role !== 'PHARMACY' && actor.wardCode !== x.ward_code) continue;
      const report = reviewedWardMedicineReport(database, x.report_date, x.ward_code);
      if (!report.matrix.patientCount) continue;
      if (actor.role === 'PHARMACY' && !report.approval.director) continue;
      const status = report.approval.status === 'chief_signed' ? 'PENDING' : report.approval.status === 'rejected' ? 'REJECTED' : report.approval.director ? 'APPROVED' : 'PREPARING';
      items.push({
        id: 'medicine:' + x.ward_code + ':' + x.report_date,
        kind: 'MEDICINE',
        status,
        sourceWard: x.ward_code,
        patientName: report.wardNameKh,
        submittedAt: new Date(x.report_date).getTime(),
        date: x.report_date,
        ward: x.ward_code,
        stage: report.approval.status,
      });
    }
    const counts = Object.fromEntries(['ADMISSION', 'DISCHARGE', 'MEDICINE', 'FEE'].map(kind => [kind, items.filter(x => x.kind === kind && x.status === 'PENDING').length]));
    return sendJson(ctx.response, 200, { items, counts }, { secure: config.cookieSecure });
  });

  // 7. GET /api/requests/:id
  router.get(/^\/api\/requests\/([0-9a-f-]+)(?:\/(review|resubmit|apply|correct))?$/, async (ctx) => {
    const { session, database, config, sendJson, sessionRole, sessionWard, parseStoredJson, patientDataVisibleForRole, match } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const actor = { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) };
    if (!roleCanPage(actor.role, '/requests')) return sendJson(ctx.response, 403, { error: 'Request access required.' }, { secure: config.cookieSecure });
    try {
      const d = getWorkflowRequest(database, match[1], actor);
      const cashier = ['CLERK', 'ACCOUNTANT'].includes(actor.role);
      if (cashier) {
        d.snapshot = { full_name: d.snapshot.full_name, health_id: d.snapshot.health_id };
        d.history = d.history.map(h => ({ ...h, signature_json: undefined }));
      }
      if (actor.role === 'TRIAGE') {
        d.snapshot = { ...d.snapshot, record_json: JSON.stringify(patientDataVisibleForRole(parseStoredJson(d.snapshot.record_json), actor.role)) };
      }
      return sendJson(ctx.response, 200, {
        request: { ...d, row: undefined },
        editorHistory: cashier ? [] : listEditorHistory(database, d.patientKey).filter(h => actor.role !== 'TRIAGE' || ['triage', 'registration'].includes(h.scope)),
        clinicalForms: cashier || actor.role === 'TRIAGE' ? [] : d.snapshot._clinicalForms || [],
      }, { secure: config.cookieSecure });
    } catch (e) {
      return sendJson(ctx.response, e.status || 400, { error: e.message }, { secure: config.cookieSecure });
    }
  });

  // 8. POST /api/requests/bulk-review
  router.post('/api/requests/bulk-review', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, sessionRole, sessionWard, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const actor = { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) };
    if (!roleCanPage(actor.role, '/requests')) return sendJson(response, 403, { error: 'Request access required.' }, { secure: config.cookieSecure });
    if (!MANAGEMENT.includes(actor.role)) return sendJson(response, 403, { error: 'Management access required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 200000);
    database.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const reviews = Array.isArray(body?.reviews) ? body.reviews : [];
      if (!reviews.length) throw Object.assign(Error('No requests selected.'), { status: 400 });
      const results = [];
      for (const item of reviews) {
        try {
          results.push(reviewWorkflowRequest(database, item.id, { approved: true, note: '', revision: item.revision }, actor));
        } catch (err) {
          console.warn('bulk review error:', item.id, err.message);
        }
      }
      audit(database, request, 'WORKFLOW_REQUESTS_BULK_APPROVED', { userId: actor.userId, details: { count: results.length } });
      database.sqlite.exec('COMMIT');
      return sendJson(response, 200, { approvedCount: results.length, requests: results }, { secure: config.cookieSecure });
    } catch (e) {
      database.sqlite.exec('ROLLBACK');
      return sendJson(response, e.status || 400, { error: e.message }, { secure: config.cookieSecure });
    }
  });

  // 9. POST /api/requests/:id/(review|resubmit|apply|correct)
  router.post(/^\/api\/requests\/([0-9a-f-]+)\/(review|resubmit|apply|correct)$/, async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, sessionRole, sessionWard,
            canAccessPatient, parseStoredJson, sanitizeAdmissionAction, buildIpdDischargeSummary, audit, match } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const actor = { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) };
    if (!roleCanPage(actor.role, '/requests')) return sendJson(response, 403, { error: 'Request access required.' }, { secure: config.cookieSecure });

    const body = await readJson(request, 200000);
    database.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const id = match[1];
      const action = match[2];
      let result;
      if (action === 'review') {
        result = reviewWorkflowRequest(database, id, body, actor);
      } else if (action === 'apply') {
        result = applyServiceConcession(database, id, actor);
      } else if (action === 'correct') {
        const old = getWorkflowRequest(database, id, actor);
        if (actor.role !== 'DOCTOR' || old.kind !== 'DISCHARGE' || old.status !== 'REJECTED') {
          throw Object.assign(Error('The ward doctor may correct a rejected discharge letter.'), { status: 403 });
        }
        const p = database.findPatient(old.patientKey);
        if (!p?.discharge_date || !canAccessPatient(database, session, p)) {
          throw Object.assign(Error('This discharged patient is outside your ward.'), { status: 403 });
        }
        const data = parseStoredJson(p.record_json);
        const stored = typeof data['system:discharge'] === 'string' ? parseStoredJson(data['system:discharge']) : data['system:discharge'] || {};
        const correction = { ...stored };
        for (const field of ['dischargeDiagnosis', 'dischargeIcd10', 'outcome', 'followUpDate']) {
          if (Object.hasOwn(body, field)) correction[field] = body[field];
        }
        if (body.revision !== old.revision) throw Object.assign(Error('This letter was updated. Refresh before correcting it.'), { status: 409 });
        const validated = sanitizeAdmissionAction({ action: 'discharge', dischargeDate: p.discharge_date, ...correction, dischargeDepartment: stored.department });
        if (Array.isArray(stored.medications)) validated.discharge.medications = stored.medications;
        data['system:discharge'] = validated.discharge;
        data['system:ipdDischargeSummary'] = JSON.stringify(buildIpdDischargeSummary(database, p, data, validated.discharge));
        data['system:signature:discharge'] = JSON.stringify(signatureSnapshot(database, session, Date.now()));
        database.updatePatientAdmission({
          patientKey: p.patient_key,
          departmentCode: p.department_code,
          departmentNameKh: p.department_name_kh,
          departmentNameEn: p.department_name_en,
          serviceMode: p.service_mode,
          dischargeDate: p.discharge_date,
          data,
          userId: actor.userId,
          savedAt: Date.now()
        });
        result = submitWorkflowRequest(database, { kind: 'DISCHARGE', patientKey: p.patient_key, reason: old.reason }, actor);
        audit(database, request, 'DISCHARGE_LETTER_CORRECTED', { userId: actor.userId, details: { patientKey: p.patient_key, requestId: id } });
      } else if (action === 'resubmit') {
        const old = getWorkflowRequest(database, id, actor);
        if (old.status !== 'REJECTED') throw Error('Only rejected requests may be resubmitted.');
        result = submitWorkflowRequest(database, { kind: old.kind, patientKey: old.patientKey, payload: body.payload || old.payload, reason: body.reason || old.reason }, actor);
      } else {
        throw Error('Choose a request action.');
      }
      audit(database, request, 'WORKFLOW_REQUEST_UPDATED', { userId: actor.userId, details: { id: result.id, kind: result.kind, status: result.status } });
      database.sqlite.exec('COMMIT');
      return sendJson(response, 200, { request: result }, { secure: config.cookieSecure });
    } catch (e) {
      database.sqlite.exec('ROLLBACK');
      return sendJson(response, e.status || 400, { error: e.message }, { secure: config.cookieSecure });
    }
  });

  // 10. POST /api/requests
  router.post('/api/requests', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, sessionRole, sessionWard, canAccessPatient, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const actor = { userId: session.user_id, role: sessionRole(session), wardCode: sessionWard(session) };
    if (!roleCanPage(actor.role, '/requests')) return sendJson(response, 403, { error: 'Request access required.' }, { secure: config.cookieSecure });

    const body = await readJson(request, 200000);
    database.sqlite.exec('BEGIN IMMEDIATE');
    try {
      const patient = database.findPatient(String(body.patientKey || ''));
      if (!patient || (!['CLERK', 'ACCOUNTANT'].includes(actor.role) && !canAccessPatient(database, session, patient))) {
        throw Object.assign(Error('This patient is outside your ward.'), { status: 403 });
      }
      const result = submitWorkflowRequest(database, body, actor);
      audit(database, request, 'WORKFLOW_REQUEST_UPDATED', { userId: actor.userId, details: { id: result.id, kind: result.kind, status: result.status } });
      database.sqlite.exec('COMMIT');
      return sendJson(response, 200, { request: result }, { secure: config.cookieSecure });
    } catch (e) {
      database.sqlite.exec('ROLLBACK');
      return sendJson(response, e.status || 400, { error: e.message }, { secure: config.cookieSecure });
    }
  });

  // 11. GET /api/reports/daily
  router.get('/api/reports/daily', async (ctx) => {
    const { session, database, config, sendJson, url, sessionRole, sessionWard } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    try {
      const role = sessionRole(session);
      const ward = sessionWard(session);
      const isManagement = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'CASHIER', 'REGISTRATION'].includes(role) || !ward;
      const filterWard = isManagement ? (url.searchParams.get('ward') || '') : ward;
      return sendJson(ctx.response, 200, dailyHospitalReport(database, url.searchParams.get('date'), filterWard), { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(ctx.response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 12. GET /api/opd/ipd-transfer-candidates
  router.get('/api/opd/ipd-transfer-candidates', async (ctx) => {
    const { session, database, config, sendJson, requireContext, sessionWard, paidOpdQueuePatients } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (role !== 'DOCTOR' || sessionWard(session) !== 'opd') {
      return sendJson(ctx.response, 403, { error: 'Only an OPD doctor can transfer patients into IPD.' }, { secure: config.cookieSecure });
    }
    const date = opdLocalDate();
    const patients = paidOpdQueuePatients(database, date).filter(item => {
      if (item.transferredToIpdAt) return false;
      const patient = database.findPatient(item.patientKey);
      return patient && String(patient.service_mode || '').toLowerCase() === 'opd';
    });
    return sendJson(ctx.response, 200, { date, patients }, { secure: config.cookieSecure });
  });

  // 13. GET /api/opd/ipd-wards
  router.get('/api/opd/ipd-wards', async (ctx) => {
    const { session, config, sendJson, requireContext, sessionWard } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (role !== 'DOCTOR' || sessionWard(session) !== 'opd') {
      return sendJson(ctx.response, 403, { error: 'Only an OPD doctor can choose an IPD ward.' }, { secure: config.cookieSecure });
    }
    return sendJson(ctx.response, 200, { wards: WARDS.filter(ward => ward.code !== 'opd') }, { secure: config.cookieSecure });
  });

  // 14. POST /api/opd/transfer-to-ipd
  router.post('/api/opd/transfer-to-ipd', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, requireContext, sessionWard,
            clinicalPatientKey, canAccessPatient, opdConsultationPaymentConfirmed, parseStoredJson,
            releasePatientFromHospitalMap, automaticWardMessage,
            audit, patientRecordResponse } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (role !== 'DOCTOR' || sessionWard(session) !== 'opd') {
      return sendJson(response, 403, { error: 'Only an OPD doctor can transfer a patient into IPD.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, 20000);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const wardCode = String(body?.wardCode || '').trim().toLowerCase();
    const ward = WARDS.find(item => item.code === wardCode && item.code !== 'opd');
    if (!ward) return sendJson(response, 400, { error: 'Choose a valid inpatient ward.' }, { secure: config.cookieSecure });
    const existing = database.findPatient(patientKey);
    if (!existing) return sendJson(response, 404, { error: 'Patient was not found.' }, { secure: config.cookieSecure });
    if (String(existing.service_mode || '').toLowerCase() !== 'opd') return sendJson(response, 409, { error: 'Only a current OPD patient can be transferred with this action.' }, { secure: config.cookieSecure });
    if (!canAccessPatient(database, session, existing)) return sendJson(response, 403, { error: 'This patient is outside the OPD.' }, { secure: config.cookieSecure });
    if (!opdConsultationPaymentConfirmed(database, existing)) return sendJson(response, 409, { error: 'Confirm the OPD consultation fee with Cashier before transferring this patient.' }, { secure: config.cookieSecure });
    const savedAt = Date.now();
    const data = parseStoredJson(existing.record_json);
    data['system:admissionStatus'] = 'waiting-transfer';
    data['system:workflowStage'] = 'WARD_WAITING';
    data['system:currentWardCode'] = '';
    data['system:currentRoomId'] = '';
    data['system:currentRoomNameKh'] = '';
    data['system:currentRoomNameEn'] = '';
    data['system:currentBedId'] = '';
    data['system:currentBedLabel'] = '';
    data['system:careType'] = ward.code === 'obstetric' ? 'obstetric' : 'nurse';
    data['system:currentDepartmentCode'] = ward.code;
    data['system:currentDepartmentNameKh'] = ward.nameKh;
    data['system:currentDepartmentNameEn'] = ward.nameEn;
    data['system:opdTransferredToIpdAt'] = savedAt;
    data['system:opdTransferredToIpdWardCode'] = ward.code;
    try {
      database.sqlite.exec('BEGIN IMMEDIATE');
      try {
        releasePatientFromHospitalMap(database, patientKey, session.user_id, savedAt);
        const patient = database.updatePatientAdmission({
          patientKey,
          departmentCode: ward.code,
          departmentNameKh: ward.nameKh,
          departmentNameEn: ward.nameEn,
          serviceMode: 'ipd',
          dischargeDate: '',
          data,
          userId: session.user_id,
          savedAt
        });
        const invoice = startPatientInvoice(database, patientKey, session.user_id, savedAt);
        recordMovement(database, {
          patientKey,
          eventType: 'ADMISSION',
          fromWardCode: 'opd',
          toWardCode: ward.code,
          fromDepartmentCode: 'opd',
          toDepartmentCode: ward.code,
          eventAt: savedAt,
          createdBy: session.user_id,
          details: { source: 'OPD', reason: 'doctor-transfer-to-ipd' }
        });
        const patientName = patient.full_name || patient.case_number;
        const targetWardKh = (ward.nameKh || ward.nameEn || '').replace(/^ផ្នែក\s*/, '');
        const transferMsg = `អ្នកជំងឺឈ្មោះ ${patientName} ត្រូវបានបញ្ជូនពីផ្នែកពិគ្រោះក្រៅមកផ្នែក ${targetWardKh} សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ`;
        automaticWardMessage(database, { userId: session.user_id, role, wardCode: 'opd' }, patient, transferMsg, transferMsg, { wardCode: ward.code });
        syncClinicalRequests(database, patient, { userId: session.user_id, role, wardCode: 'opd' });
        audit(database, request, 'OPD_PATIENT_TRANSFERRED_TO_IPD', {
          userId: session.user_id,
          subjectUsername: session.username,
          details: { patientKey, fromWardCode: 'opd', toWardCode: ward.code, invoiceId: invoice.id, invoiceNo: invoice.invoiceNo }
        });
        database.sqlite.exec('COMMIT');
        return sendJson(response, 200, { patient: patientRecordResponse(patient), ward, invoice }, { secure: config.cookieSecure });
      } catch (error) {
        database.sqlite.exec('ROLLBACK');
        throw error;
      }
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 15. GET /api/pmrs2/preview
  router.get('/api/pmrs2/preview', async (ctx) => {
    const { session, database, config, sendJson, url, requireContext, clinicalPatientKey, canAccessPatient, patientRecordResponse } = ctx;
    if (config.demoMode) return sendJson(ctx.response, 403, { error: 'PMRS2 transfer is unavailable in the username-only demo.' }, { secure: config.cookieSecure });
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'REGISTRATION', 'DOCTOR', 'NURSE', 'MIDWIFE'].includes(role)) {
      return sendJson(ctx.response, 403, { error: 'Clinical access is required.' }, { secure: config.cookieSecure });
    }
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(ctx.response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
    if (!canAccessPatient(database, session, patient)) return sendJson(ctx.response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const preview = pmrs2Preview(patientRecordResponse(patient, true));
    logFromContext(ctx, patient, 'open', 'PMRS2 review'); // v41.7 record view log
    return sendJson(ctx.response, 200, { preview, reviewIssues: pmrs2ReviewIssues(preview, preview.triage) }, { secure: config.cookieSecure });
  });

  // 16. POST /api/pmrs2/prepare-export
  router.post('/api/pmrs2/prepare-export', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, requireContext, clinicalPatientKey, canAccessPatient, patientRecordResponse, boundedText, audit } = ctx;
    if (config.demoMode) return sendJson(response, 403, { error: 'PMRS2 transfer is unavailable in the username-only demo.' }, { secure: config.cookieSecure });
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DOCTOR'].includes(requireContext(session))) return sendJson(response, 403, { error: 'Doctor or administrator access is required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 10000);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const row = database.findPatient(patientKey);
    if (!row) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
    if (!canAccessPatient(database, session, row)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const patient = patientRecordResponse(row, true);
    if (!Number.isInteger(body.reviewedVersion) || body.reviewedVersion !== patient.version) {
      return sendJson(response, 409, { error: 'The record changed. Open a fresh PMRS2 review.' }, { secure: config.cookieSecure });
    }
    const identifier = boundedText(body.confirmedIdentifier, 160, 'Confirmed patient identifier', true);
    if (!identifier || ![patient.healthId, patient.caseNumber].filter(Boolean).includes(identifier)) {
      return sendJson(response, 400, { error: 'Patient identifier does not match the saved record.' }, { secure: config.cookieSecure });
    }
    if (body.reviewed !== true) return sendJson(response, 400, { error: 'Review the patient and all clinical sections first.' }, { secure: config.cookieSecure });
    const transferPackage = buildPmrs2TransferPackage(patient, new Date().toISOString());
    logFromContext(ctx, row, 'export', 'PMRS2 transfer package'); // v41.7 record view log
    const checksum = crypto.createHash('sha256').update(JSON.stringify(transferPackage)).digest('hex');
    audit(database, request, 'PMRS2_EXPORT_PREPARED', {
      userId: session.user_id,
      subjectUsername: session.username,
      details: { patientKey, patientVersion: patient.version, warningCount: transferPackage.reviewIssues.length, checksum }
    });
    return sendJson(response, 200, { transferPackage, checksum }, { secure: config.cookieSecure });
  });

  // 17. POST /api/pmrs2/import-candidates
  router.post('/api/pmrs2/import-candidates', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, requireContext, canAccessPatient, patientRecordResponse, pmrsPaymentCategoryStatus } = ctx;
    if (config.demoMode) return sendJson(response, 403, { error: 'PMRS2 transfer is unavailable in the username-only demo.' }, { secure: config.cookieSecure });
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DOCTOR'].includes(requireContext(session))) return sendJson(response, 403, { error: 'Doctor or administrator access is required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 2000);
    const pid = normalizePmrsId(body?.sourcePid);
    if (pid.length < 4 || pid.length > 120) return sendJson(response, 400, { error: 'PMRS2 patient ID is invalid.' }, { secure: config.cookieSecure });
    const patients = database.listPatients().filter(row => normalizePmrsId(row.health_id) === pid && canAccessPatient(database, session, row)).map(row => {
      const p = patientRecordResponse(row, false);
      return {
        patientKey: p.patientKey,
        healthId: p.healthId,
        fullName: p.fullName,
        caseNumber: p.caseNumber,
        version: p.version,
        serviceMode: p.serviceMode,
        entryDate: p.entryDate,
        departmentNameKh: p.departmentNameKh,
        paymentStatus: pmrsPaymentCategoryStatus(database, p.patientKey)
      };
    });
    return sendJson(response, 200, { patients }, { secure: config.cookieSecure });
  });

  // 18. POST /api/pmrs2/import-medicines
  router.post('/api/pmrs2/import-medicines', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, requireContext, clinicalPatientKey, canAccessPatient, patientRecordResponse, pmrsPaymentCategoryStatus, audit } = ctx;
    if (config.demoMode) return sendJson(response, 403, { error: 'PMRS2 transfer is unavailable in the username-only demo.' }, { secure: config.cookieSecure });
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DOCTOR'].includes(requireContext(session))) return sendJson(response, 403, { error: 'Doctor or administrator access is required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 70000);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const row = database.findPatient(patientKey);
    if (!row) return sendJson(response, 404, { error: 'EMR patient was not found.' }, { secure: config.cookieSecure });
    if (!canAccessPatient(database, session, row)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const payment = pmrsPaymentCategoryStatus(database, patientKey);
    if (!['HEF_EQUITY', 'HEF_VULNERABLE', 'HEF_POOR', 'HEF_VULNERABLE_FAMILY'].includes(payment)) {
      return sendJson(response, 403, { error: 'This patient is not recorded as HEF in the EMR payment profile.' }, { secure: config.cookieSecure });
    }
    if (body.reviewed !== true) return sendJson(response, 400, { error: 'Review the patient, date, route, and every medicine before saving.' }, { secure: config.cookieSecure });
    if (!Number.isInteger(body.reviewedVersion) || body.reviewedVersion !== row.version) {
      return sendJson(response, 409, { error: 'The EMR record changed. Reload the patient and review again.' }, { secure: config.cookieSecure });
    }
    try {
      const prepared = preparePmrsMedicineImport(body);
      const previous = patientRecordResponse(row, true);
      const imported = applyPmrsMedicineImport(previous.data, prepared, previous);
      if (!imported.added) return sendJson(response, 200, { added: 0, skipped: imported.skipped, patientVersion: row.version }, { secure: config.cookieSecure });
      const summary = {
        caseNumber: previous.caseNumber,
        healthId: previous.healthId,
        firstName: previous.firstName,
        lastName: previous.lastName,
        fullName: previous.fullName,
        sex: previous.sex,
        age: previous.age,
        dateOfBirth: previous.dateOfBirth,
        phone: previous.phone,
        equityCard: previous.equityCard,
        paymentType: previous.paymentType,
        departmentCode: previous.departmentCode,
        departmentNameKh: previous.departmentNameKh,
        departmentNameEn: previous.departmentNameEn,
        serviceMode: previous.serviceMode,
        entryDate: previous.entryDate,
        dischargeDate: previous.dischargeDate
      };
      const saved = database.upsertPatient({ id: crypto.randomUUID(), patientKey, summary, data: imported.data, userId: session.user_id, savedAt: Date.now() });
      audit(database, request, 'PMRS2_MEDICINES_IMPORTED', {
        userId: session.user_id,
        subjectUsername: session.username,
        details: { patientKey, visitHash: crypto.createHash('sha256').update(prepared.sourceVisit).digest('hex'), target: prepared.target, recordAt: prepared.recordAt, added: imported.added, skipped: imported.skipped }
      });
      return sendJson(response, 200, { added: imported.added, skipped: imported.skipped, patientVersion: saved.version }, { secure: config.cookieSecure });
    } catch (error) {
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 19. GET /api/admission-approvals
  router.get('/api/admission-approvals', async (ctx) => {
    const { session, database, config, sendJson, url, requireContext, clinicalPatientKey, canAccessPatient } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'REGISTRATION', 'TRIAGE', 'DOCTOR', 'NURSE', 'MIDWIFE', 'CHIEF_WARD'].includes(role)) {
      return sendJson(ctx.response, 403, { error: 'Clinical access is required.' }, { secure: config.cookieSecure });
    }
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(ctx.response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
    if (!canAccessPatient(database, session, patient)) return sendJson(ctx.response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    return sendJson(ctx.response, 200, { approval: admissionApprovalFor(database, patientKey) }, { secure: config.cookieSecure });
  });

  // 20. GET /api/admission-approvals/pending
  router.get('/api/admission-approvals/pending', async (ctx) => {
    const { session, database, config, sendJson, requireContext } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) return sendJson(ctx.response, 403, { error: 'Only Admin or Director can view the approval list.' }, { secure: config.cookieSecure });
    return sendJson(ctx.response, 200, { items: listPendingAdmissionApprovals(database, role) }, { secure: config.cookieSecure });
  });

  // 21. POST /api/admission-approvals
  router.post('/api/admission-approvals', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, requireContext, sessionWard,
            clinicalPatientKey, canAccessPatient, messagingVisibility, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const role = requireContext(session);
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'Only Admin or Director can approve an admission.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 10000);
    const patientKey = clinicalPatientKey(body?.patientKey);
    const patient = database.findPatient(patientKey);
    if (!patient) return sendJson(response, 404, { error: 'Patient not found.' }, { secure: config.cookieSecure });
    if (!canAccessPatient(database, session, patient) && !['ADMIN', 'VICE_DIRECTOR'].includes(role)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    try {
      database.sqlite.exec('BEGIN IMMEDIATE');
      const reviewRole = role;
      syncClinicalRequests(database, patient, { userId: session.user_id, role, wardCode: sessionWard(session) });
      const workflow = database.sqlite.prepare("SELECT id,status,revision FROM workflow_requests WHERE source_key=?").get('ADMISSION:' + patientKey);
      if (workflow?.status === 'PENDING') reviewWorkflowRequest(database, workflow.id, { approved: true, revision: workflow.revision }, { userId: session.user_id, role, wardCode: sessionWard(session) });
      else if (workflow?.status === 'REJECTED') throw Error('Correct and resubmit the rejected request first.');
      const approval = admissionApprovalFor(database, patientKey);
      completePatientMessages(database, patientKey, messagingVisibility(session), { subjectPattern: /admission|ចូលសម្រាក/i });
      audit(database, request, 'ADMISSION_APPROVED', { userId: session.user_id, subjectUsername: session.username, details: { patientKey, approverRole: reviewRole } });
      database.sqlite.exec('COMMIT');
      return sendJson(response, 200, { approval }, { secure: config.cookieSecure });
    } catch (error) {
      database.sqlite.exec('ROLLBACK');
      return sendJson(response, 400, { error: error.message }, { secure: config.cookieSecure });
    }
  });

  // 22. GET /api/system-settings/followup
  router.get('/api/system-settings/followup', async (ctx) => {
    const { session, database, config, sendJson, followupDatePolicy } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    return sendJson(ctx.response, 200, { allowFutureFollowup: followupDatePolicy(database).allowFuture }, { secure: config.cookieSecure });
  });

  // 23. PUT /api/system-settings/followup
  router.put('/api/system-settings/followup', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, sessionRole, parseStoredJson, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR'].includes(sessionRole(session))) return sendJson(response, 403, { error: 'Administrator access is required.' }, { secure: config.cookieSecure });
    const body = await readJson(request, 20000);
    const allowFuture = body?.allowFutureFollowup === true;
    const existingRow = database.findHospitalState('settings');
    const existingState = existingRow ? parseStoredJson(existingRow.state_json) : {};
    const state = existingState && typeof existingState === 'object' ? { ...existingState } : {};
    state.followupDatePolicy = { allowFuture };
    const savedAt = Date.now();
    const row = database.upsertHospitalState({ stateKey: 'settings', state, userId: session.user_id, savedAt });
    audit(database, request, 'FOLLOWUP_DATE_POLICY_CHANGED', { userId: session.user_id, subjectUsername: session.username, details: { allowFuture } });
    return sendJson(response, 200, { allowFutureFollowup: allowFuture, version: row.version }, { secure: config.cookieSecure });
  });

  // 24. GET /api/hospital-state
  router.get('/api/hospital-state', async (ctx) => {
    const { session, database, config, sendJson, parseStoredJson, hospitalStateForSession } = ctx;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    const row = database.findHospitalState('main');
    const fullState = row ? parseStoredJson(row.state_json) : null;
    return sendJson(ctx.response, 200, {
      state: hospitalStateForSession(fullState, session),
      version: row?.version ?? 0,
    }, { secure: config.cookieSecure });
  });

  // 25. PUT /api/hospital-state
  router.put('/api/hospital-state', async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, requireContext,
            parseStoredJson, sanitizeHospitalState, mergeHospitalStateForSession, hospitalStateForSession, audit } = ctx;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'DOCTOR', 'NURSE', 'MIDWIFE', 'WARD_HEAD', 'CHIEF_WARD'].includes(requireContext(session))) {
      return sendJson(response, 403, { error: 'Your role cannot update the hospital map.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxHospitalStateBytes);
    const submittedState = sanitizeHospitalState(body?.state);
    const existingRow = database.findHospitalState('main');
    if (body.expectedVersion !== undefined && body.expectedVersion !== (existingRow?.version || 0)) {
      return sendJson(response, 409, { error: 'The bed map changed. Refresh before saving your edits.' }, { secure: config.cookieSecure });
    }
    const existingState = existingRow ? parseStoredJson(existingRow.state_json) : null;
    const state = mergeHospitalStateForSession(existingState, submittedState, session, database);
    const savedAt = Date.now();
    const row = database.upsertHospitalState({ stateKey: 'main', state, userId: session.user_id, savedAt });
    audit(database, request, 'HOSPITAL_MAP_SAVED', {
      userId: session.user_id,
      subjectUsername: session.username,
      details: { version: row.version },
    });
    return sendJson(response, 200, {
      state: hospitalStateForSession(parseStoredJson(row.state_json), session),
      version: row.version,
    }, { secure: config.cookieSecure });
  });

  // 26. GET /api/clinical-forms/:type
  router.get(/^\/api\/clinical-forms\/([a-z]+)$/, async (ctx) => {
    const { session, database, config, sendJson, url, sessionRole, canAccessPatient, clinicalPatientKey,
            clinicalFormTypes, clinicalFormReadRoles, clinicalRecordResponse, match } = ctx;
    const formType = match[1];
    if (!clinicalFormTypes.has(formType)) return false;
    if (!session) return sendJson(ctx.response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!clinicalFormReadRoles.has(sessionRole(session))) return sendJson(ctx.response, 403, { error: 'Your role cannot view clinical forms.' }, { secure: config.cookieSecure });
    const patientKey = clinicalPatientKey(url.searchParams.get('patientKey'));
    const patientRow = database.findPatient(patientKey);
    if (patientRow && !canAccessPatient(database, session, patientRow)) return sendJson(ctx.response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    const record = database.findClinicalForm(patientKey, formType);
    return sendJson(ctx.response, 200, {
      record: record ? clinicalRecordResponse(record) : null,
    }, { secure: config.cookieSecure });
  });

  // 27. PUT /api/clinical-forms/:type
  router.put(/^\/api\/clinical-forms\/([a-z]+)$/, async (ctx) => {
    const { request, response, session, database, config, sendJson, readJson, sessionRole, canAccessPatient,
            clinicalPatientKey, clinicalFormTypes, clinicalFormWriteRoles, sanitizePatientSnapshot,
            sanitizeClinicalFormData, clinicalRecordResponse, audit, match } = ctx;
    const formType = match[1];
    if (!clinicalFormTypes.has(formType)) return false;
    if (!session) return sendJson(response, 401, { error: 'Authentication required.' }, { secure: config.cookieSecure });
    if (!clinicalFormWriteRoles.has(sessionRole(session))) {
      return sendJson(response, 403, { error: 'Your role cannot update clinical forms.' }, { secure: config.cookieSecure });
    }
    const body = await readJson(request, config.maxClinicalBodyBytes);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return sendJson(response, 400, { error: 'Clinical form information is invalid.' }, { secure: config.cookieSecure });
    }
    const patientKey = clinicalPatientKey(body.patientKey);
    const patientRow = database.findPatient(patientKey);
    if (patientRow && !canAccessPatient(database, session, patientRow)) return sendJson(response, 403, { error: 'This patient is outside your active ward.' }, { secure: config.cookieSecure });
    try {
      assertEncounterWrite(database, session, patientRow, 'medical');
    } catch (error) {
      return sendJson(response, error.status || 403, { error: error.message }, { secure: config.cookieSecure });
    }
    const patient = sanitizePatientSnapshot(body.patient);
    const data = sanitizeClinicalFormData(body.data);
    const savedAt = Date.now();
    const record = database.upsertClinicalForm({
      id: crypto.randomUUID(), patientKey, formType, patient, data,
      userId: session.user_id, savedAt,
    });
    audit(database, request, 'CLINICAL_FORM_SAVED', {
      userId: session.user_id,
      subjectUsername: session.username,
      details: { recordId: record.id, formType, version: record.version },
    });
    return sendJson(response, 200, { record: clinicalRecordResponse(record) }, {
      secure: config.cookieSecure,
    });
  });
}
