import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function write(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
}

console.log('--- Applying Server-side v36.4 Updates ---');

// 1. Update server/finance.mjs
console.log('1. Updating server/finance.mjs');
let finance = read('server/finance.mjs');

// patientBill skipAttachments
const oldPatientBillHead = `export function patientBill(database, patientKey, requestedInvoiceId='') {
  const patient = database.findPatient(patientKey);
  if (!patient) return null;
  const invoice=getInvoiceRow(database,patientKey,requestedInvoiceId);
  if(requestedInvoiceId&&!invoice)return null;
  const invoiceId=invoice?.id||'';
  const profile = invoiceId?invoiceProfile(database,patientKey,invoiceId):(getFinanceProfile(database, patientKey) || defaultProfile(patientKey, patient));
  const invoiceFilter=invoiceId?' AND c.invoice_id=?':'';
  const paymentFilter=invoiceId?' AND p.invoice_id=?':'';
  const charges = database.sqlite.prepare(\`SELECT c.*,u.display_name created_by_name FROM finance_charges c
    LEFT JOIN users u ON u.id=c.created_by WHERE c.patient_key=?\${invoiceFilter} ORDER BY c.created_at DESC\`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey])).map(r => chargeFromRow(r, database));
  const payments = database.sqlite.prepare(\`SELECT p.*,u.display_name received_by_name FROM finance_payments p
    LEFT JOIN users u ON u.id=p.received_by WHERE p.patient_key=?\${paymentFilter} ORDER BY p.received_at DESC\`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey])).map(paymentFromRow);
  const attachmentRows = database.sqlite.prepare(\`SELECT id,payment_id,filename,content_type,uploaded_at FROM finance_payment_attachments
    WHERE payment_id IN (SELECT id FROM finance_payments WHERE patient_key=?\${invoiceId?' AND invoice_id=?':''}) ORDER BY uploaded_at\`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey]));`;

const newPatientBillHead = `export function patientBill(database, patientKey, requestedInvoiceId='', options = {}) {
  const patient = database.findPatient(patientKey);
  if (!patient) return null;
  const invoice=getInvoiceRow(database,patientKey,requestedInvoiceId);
  if(requestedInvoiceId&&!invoice)return null;
  const invoiceId=invoice?.id||'';
  const profile = invoiceId?invoiceProfile(database,patientKey,invoiceId):(getFinanceProfile(database, patientKey) || defaultProfile(patientKey, patient));
  const invoiceFilter=invoiceId?' AND c.invoice_id=?':'';
  const paymentFilter=invoiceId?' AND p.invoice_id=?':'';
  const charges = database.sqlite.prepare(\`SELECT c.*,u.display_name created_by_name FROM finance_charges c
    LEFT JOIN users u ON u.id=c.created_by WHERE c.patient_key=?\${invoiceFilter} ORDER BY c.created_at DESC\`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey])).map(r => chargeFromRow(r, database));
  const payments = database.sqlite.prepare(\`SELECT p.*,u.display_name received_by_name FROM finance_payments p
    LEFT JOIN users u ON u.id=p.received_by WHERE p.patient_key=?\${paymentFilter} ORDER BY p.received_at DESC\`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey])).map(paymentFromRow);
  const skipAttachments = Boolean(options?.skipAttachments);
  const attachmentRows = skipAttachments ? [] : database.sqlite.prepare(\`SELECT id,payment_id,filename,content_type,uploaded_at FROM finance_payment_attachments
    WHERE payment_id IN (SELECT id FROM finance_payments WHERE patient_key=?\${invoiceId?' AND invoice_id=?':''}) ORDER BY uploaded_at\`).all(...(invoiceId?[patientKey,invoiceId]:[patientKey]));`;

finance = finance.replace(oldPatientBillHead.replace(/\n/g, '\r\n'), newPatientBillHead.replace(/\n/g, '\r\n'));

// financePatientSearch using listPatientSummaries and skipAttachments
const oldFinancePatientSearch = `export function financePatientSearch(database, query = '', { view = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const patients = database.listPatients().filter(row => {
    if (!q) return true;
    return [row.full_name,row.case_number,row.health_id,row.phone,row.department_name_en,row.department_name_kh]
      .some(value => String(value || '').toLowerCase().includes(q));
  }).slice(0,200).map(row => {
    let data = {};
    try { data = JSON.parse(row.record_json || '{}'); } catch {}
    let bill = patientBill(database, row.patient_key);
    const storedQueue=data['system:cashierQueueRequest'];
    const hasRequestTable=database.sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='finance_cashier_requests'").get();
    const requests=hasRequestTable?database.sqlite.prepare('SELECT invoice_id invoiceId,sent_at sentAt,source FROM finance_cashier_requests WHERE patient_key=? ORDER BY sent_at DESC,rowid DESC').all(row.patient_key):[];
    if(storedQueue?.invoiceId&&!requests.some(r=>r.invoiceId===storedQueue.invoiceId))requests.unshift(storedQueue);
    const pending=requests.map(queue=>({queue,bill:patientBill(database,row.patient_key,queue.invoiceId)})).find(item=>item.bill?.invoice&&!item.bill.invoice.closedAt&&Number(item.bill.summary.KHR.balance||0)+Number(item.bill.summary.USD.balance||0)>0);`;

const newFinancePatientSearch = `export function financePatientSearch(database, query = '', { view = 'all' } = {}) {
  const q = String(query || '').trim().toLowerCase();
  const patients = database.listPatientSummaries().filter(row => {
    if (!q) return true;
    return [row.full_name,row.case_number,row.health_id,row.phone,row.department_name_en,row.department_name_kh]
      .some(value => String(value || '').toLowerCase().includes(q));
  }).slice(0,200).map(row => {
    let data = {};
    try { data = JSON.parse(row.record_json || '{}'); } catch {}
    let bill = patientBill(database, row.patient_key, '', { skipAttachments: true });
    const storedQueue=data['system:cashierQueueRequest'];
    const hasRequestTable=database.sqlite.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='finance_cashier_requests'").get();
    const requests=hasRequestTable?database.sqlite.prepare('SELECT invoice_id invoiceId,sent_at sentAt,source FROM finance_cashier_requests WHERE patient_key=? ORDER BY sent_at DESC,rowid DESC').all(row.patient_key):[];
    if(storedQueue?.invoiceId&&!requests.some(r=>r.invoiceId===storedQueue.invoiceId))requests.unshift(storedQueue);
    const pending=requests.map(queue=>({queue,bill:patientBill(database,row.patient_key,queue.invoiceId, { skipAttachments: true })})).find(item=>item.bill?.invoice&&!item.bill.invoice.closedAt&&Number(item.bill.summary.KHR.balance||0)+Number(item.bill.summary.USD.balance||0)>0);`;

finance = finance.replace(oldFinancePatientSearch.replace(/\n/g, '\r\n'), newFinancePatientSearch.replace(/\n/g, '\r\n'));
write('server/finance.mjs', finance);

// 2. Update server/server.mjs
console.log('2. Updating server/server.mjs');
let server = read('server/server.mjs');

// Add static compressed cache to server.mjs
const oldStaticCache = `const htmlTemplateCache = new Map();
const staticFileCache = new Map();

function compressIfNeeded(request, response, buffer, contentType) {`;

const newStaticCache = `const htmlTemplateCache = new Map();
const staticFileCache = new Map();
const staticCompressedCache = new Map();

function compressIfNeeded(request, response, buffer, contentType) {`;

server = server.replace(oldStaticCache.replace(/\n/g, '\r\n'), newStaticCache.replace(/\n/g, '\r\n'));

// Update compressIfNeeded in sendFile to use static cache for public assets
const oldSendFileCompress = `    if (bodyBytes) {
      const finalBytes = compressIfNeeded(req, response, bodyBytes, contentType);
      response.setHeader('Content-Length', finalBytes.length);
      response.writeHead(200);
      return response.end(finalBytes);
    }`;

const newSendFileCompress = `    if (bodyBytes) {
      const accept = String(req?.headers?.['accept-encoding'] || '');
      const enc = /\\bgzip\\b/i.test(accept) ? 'gzip' : (/\\bdeflate\\b/i.test(accept) ? 'deflate' : '');
      let finalBytes = bodyBytes;
      if (enc && isAsset && bodyBytes.length >= 512) {
        const cacheKey = \`\${filePath}:\${mtimeMs}:\${enc}\`;
        let cachedCompressed = staticCompressedCache.get(cacheKey);
        if (!cachedCompressed) {
          cachedCompressed = enc === 'gzip' ? zlib.gzipSync(bodyBytes, { level: 6 }) : zlib.deflateSync(bodyBytes, { level: 6 });
          staticCompressedCache.set(cacheKey, cachedCompressed);
        }
        response.setHeader('Content-Encoding', enc);
        response.setHeader('Vary', 'Accept-Encoding');
        finalBytes = cachedCompressed;
      } else {
        finalBytes = compressIfNeeded(req, response, bodyBytes, contentType);
      }
      response.setHeader('Content-Length', finalBytes.length);
      response.writeHead(200);
      return response.end(finalBytes);
    }`;

server = server.replace(oldSendFileCompress.replace(/\n/g, '\r\n'), newSendFileCompress.replace(/\n/g, '\r\n'));

// Update patientRecordResponse and patientClinicalClosed to reuse parsed JSON
const oldPatientRecordResponse = `function patientRecordResponse(row, includeData = true) {
  const data = parseStoredJson(row.record_json);`;

const newPatientRecordResponse = `function patientRecordResponse(row, includeData = true, preParsedData = null) {
  const data = preParsedData || (row._parsedData ?? (row._parsedData = parseStoredJson(row.record_json)));`;

server = server.replace(oldPatientRecordResponse.replace(/\n/g, '\r\n'), newPatientRecordResponse.replace(/\n/g, '\r\n'));

const oldPatientClinicalClosed = `function patientClinicalClosed(database, row, dispensedKeys = null) {
  if (!row) return false;
  const data = parseStoredJson(row.record_json);`;

const newPatientClinicalClosed = `function patientClinicalClosed(database, row, dispensedKeys = null, preParsedData = null) {
  if (!row) return false;
  const data = preParsedData || (row._parsedData ?? (row._parsedData = parseStoredJson(row.record_json)));`;

server = server.replace(oldPatientClinicalClosed.replace(/\n/g, '\r\n'), newPatientClinicalClosed.replace(/\n/g, '\r\n'));

// Reuse parsed data in GET /api/patients and GET /api/triage/queue
const oldGetPatients = `          patients: database.listPatientSummaries().map(row => {
            const patient = patientRecordResponse(row, false);
            patient.queueNumber = Number(row.queue_num_1 || row.queue_num_2 || 0) || null;
            patient.triageStatus = row.triage_status || '';
            patient.admissionStatus = row.admission_status || '';
            if (includePayment || ['DOCTOR','PHARMACY'].includes(role)) patient.paymentStatus = paymentStatusForPatient(database, row.patient_key);
            patient.clinicalClosed = patientClinicalClosed(database, row, dispensedKeys);`;

const newGetPatients = `          patients: database.listPatientSummaries().map(row => {
            const data = row._parsedData ?? (row._parsedData = parseStoredJson(row.record_json));
            const patient = patientRecordResponse(row, false, data);
            patient.queueNumber = Number(row.queue_num_1 || row.queue_num_2 || 0) || null;
            patient.triageStatus = row.triage_status || '';
            patient.admissionStatus = row.admission_status || '';
            if (includePayment || ['DOCTOR','PHARMACY'].includes(role)) patient.paymentStatus = paymentStatusForPatient(database, row.patient_key);
            patient.clinicalClosed = patientClinicalClosed(database, row, dispensedKeys, data);`;

server = server.replace(oldGetPatients.replace(/\n/g, '\r\n'), newGetPatients.replace(/\n/g, '\r\n'));

const oldGetTriageQueue = `        const allPatients = database.listPatientSummaries().map(row => {
          const patient = patientRecordResponse(row, false);
          patient.queueNumber = Number(row.queue_num_1 || row.queue_num_2 || 0) || null;
          patient.triageStatus = row.triage_status || '';
          patient.triageCompletedAt = row.triage_completed_at ? Number(row.triage_completed_at) || row.triage_completed_at : null;
          patient.admissionStatus = row.admission_status || '';
          patient.paymentStatus = paymentStatusForPatient(database, row.patient_key);
          patient.clinicalClosed = patientClinicalClosed(database, row, dispensedKeys);`;

const newGetTriageQueue = `        const allPatients = database.listPatientSummaries().map(row => {
          const data = row._parsedData ?? (row._parsedData = parseStoredJson(row.record_json));
          const patient = patientRecordResponse(row, false, data);
          patient.queueNumber = Number(row.queue_num_1 || row.queue_num_2 || 0) || null;
          patient.triageStatus = row.triage_status || '';
          patient.triageCompletedAt = row.triage_completed_at ? Number(row.triage_completed_at) || row.triage_completed_at : null;
          patient.admissionStatus = row.admission_status || '';
          patient.paymentStatus = paymentStatusForPatient(database, row.patient_key);
          patient.clinicalClosed = patientClinicalClosed(database, row, dispensedKeys, data);`;

server = server.replace(oldGetTriageQueue.replace(/\n/g, '\r\n'), newGetTriageQueue.replace(/\n/g, '\r\n'));

// Add GET /api/requests/counts endpoint before GET /api/requests
const oldGetRequests = `        if(request.method==='GET'&&pathname==='/api/requests'){
          const items=listWorkflowRequests(database,actor);`;

const newGetRequests = `        if(request.method==='GET'&&pathname==='/api/requests/counts'){
          const counts = { ADMISSION: 0, DISCHARGE: 0, MEDICINE: 0, FEE: 0 };
          const isMgmt = MANAGEMENT.includes(actor.role);
          const isCashier = ['CLERK', 'ACCOUNTANT'].includes(actor.role);
          const isPharmacy = actor.role === 'PHARMACY';

          if (!isCashier && !isPharmacy) {
            if (isMgmt) {
              const rows = database.sqlite.prepare(\`
                SELECT kind, COUNT(*) as c FROM workflow_requests
                WHERE status = 'PENDING' AND kind IN ('ADMISSION', 'DISCHARGE')
                GROUP BY kind
              \`).all();
              for (const r of rows) counts[r.kind] = r.c;
            } else {
              const rows = database.sqlite.prepare(\`
                SELECT kind, COUNT(*) as c FROM workflow_requests
                WHERE status = 'PENDING' AND kind IN ('ADMISSION', 'DISCHARGE')
                  AND (submitted_by = ? OR (? != '' AND source_ward = ?))
                GROUP BY kind
              \`).all(actor.userId, actor.wardCode || '', actor.wardCode || '');
              for (const r of rows) counts[r.kind] = r.c;
            }
          }

          if (!isPharmacy) {
            if (isMgmt) {
              const feeRow = database.sqlite.prepare(\`
                SELECT COUNT(*) as c FROM workflow_requests
                WHERE status = 'PENDING' AND kind = 'FEE'
              \`).get();
              let feeCount = feeRow?.c || 0;

              const extraFees = database.sqlite.prepare(\`
                SELECT COUNT(*) as c FROM paraclinic_extra_fees
                WHERE waiver_status = 'PENDING'
              \`).get();
              feeCount += (extraFees?.c || 0);

              const concessions = database.sqlite.prepare(\`
                SELECT COUNT(*) as c FROM finance_concession_requests
                WHERE status = 'PENDING'
              \`).get();
              feeCount += (concessions?.c || 0);

              counts.FEE = feeCount;
            } else if (!isCashier) {
              const feeRow = database.sqlite.prepare(\`
                SELECT COUNT(*) as c FROM workflow_requests
                WHERE status = 'PENDING' AND kind = 'FEE'
                  AND (submitted_by = ? OR (? != '' AND source_ward = ?))
              \`).get(actor.userId, actor.wardCode || '', actor.wardCode || '');
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

          return sendJson(response, 200, { counts }, { secure: config.cookieSecure });
        }
        if(request.method==='GET'&&pathname==='/api/requests'){
          const items=listWorkflowRequests(database,actor);`;

server = server.replace(oldGetRequests.replace(/\n/g, '\r\n'), newGetRequests.replace(/\n/g, '\r\n'));

// Update triageSave in PUT /api/patient-record
// 1. triageSave branch in stage calculation:
const oldTriageSaveBranch = `        } else if (triageSave) {
          if (!summary.departmentCode || !summary.serviceMode) badRequest('Select a receiving ward/service before completing triage.');
          data['system:signature:triage'] = JSON.stringify(signatureSnapshot(database, session, savedAt));
          data['system:triageStatus'] = 'COMPLETED';
          const paraclinicRequested = submittedData['scope:triage:id:triage_paraclinic'] === true || submittedData['scope:triage:id:triage_paraclinic'] === 'true';
          data['system:triageParaclinic'] = paraclinicRequested;
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
        } else if (activeClinicalRole === 'DOCTOR' || editorScope === 'medical') {`;

const newTriageSaveBranch = `        } else if (triageSave) {
          if (!summary.departmentCode || !summary.serviceMode) badRequest('Select a receiving ward/service before completing triage.');
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
            // Post-transfer correction: preserve existing downstream workflow stage and timestamps
            if (existingData['system:workflowStage']) data['system:workflowStage'] = existingData['system:workflowStage'];
            if (existingData['system:triageCompletedAt']) data['system:triageCompletedAt'] = existingData['system:triageCompletedAt'];
            data['system:triageUpdatedAt'] = savedAt;
          }
        } else if (activeClinicalRole === 'DOCTOR' || editorScope === 'medical') {`;

server = server.replace(oldTriageSaveBranch.replace(/\n/g, '\r\n'), newTriageSaveBranch.replace(/\n/g, '\r\n'));

// 2. Post-insert triage charges and referrals in transaction:
const oldTriageOpdCharge = `          if (triageSave && patient.service_mode==='opd') {
            const consultationCharge=addCatalogCharge(database,patientKey,'OPD_CONSULT',session.user_id,\`CARE_ROUTE:\${patientKey}:OPD\`,'Automatically added when Triage selected OPD');
            const consultationBill=patientBill(database,patientKey,consultationCharge.invoiceId);
            const balance=Number(consultationBill?.summary?.KHR?.balance||0)+Number(consultationBill?.summary?.USD?.balance||0);
            data['system:opdConsultationInvoiceId']=consultationCharge.invoiceId;
            if(balance>0){
              if(data['system:triageParaclinic']===true||data['system:triageParaclinic']==='true'){
                data['system:workflowStage']='OPD_PARACLINIC_ORDERING';
                delete data['system:cashierQueueRequest'];
              }else{
                data['system:workflowStage']='CASHIER_PENDING_OPD';
                data['system:cashierQueueRequest']={invoiceId:consultationCharge.invoiceId,sentAt:savedAt,sentBy:session.user_id,wardCode:'opd',source:'TRIAGE_OPD_CONSULTATION'};
                queueCashierPayment(database,patientKey,data['system:cashierQueueRequest']);
              }
            }else{
              data['system:opdConsultationPaidAt']=savedAt;
              data['system:workflowStage']=(data['system:triageParaclinic']===true||data['system:triageParaclinic']==='true')?'OPD_PARACLINIC_ORDERING':'DOCTOR_READY';
              delete data['system:cashierQueueRequest'];
            }
            database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data),savedAt,patientKey);
            patient=database.findPatient(patientKey);
          }
          if (triageSave && patient.service_mode==='opd') {
            opdReferral=referToOpd(database,patientKey,savedAt);
          }`;

const newTriageOpdCharge = `          const wasTransferredBefore = Boolean(
            existingPatient && (
              existingData['system:triageStatus'] === 'COMPLETED' ||
              existingData['system:triageTransferred'] ||
              existingData['system:triageCompletedAt'] ||
              existingData['system:triageSaved']
            )
          );
          if (triageSave && !wasTransferredBefore && patient.service_mode==='opd') {
            const consultationCharge=addCatalogCharge(database,patientKey,'OPD_CONSULT',session.user_id,\`CARE_ROUTE:\${patientKey}:OPD\`,'Automatically added when Triage selected OPD');
            const consultationBill=patientBill(database,patientKey,consultationCharge.invoiceId);
            const balance=Number(consultationBill?.summary?.KHR?.balance||0)+Number(consultationBill?.summary?.USD?.balance||0);
            data['system:opdConsultationInvoiceId']=consultationCharge.invoiceId;
            if(balance>0){
              if(data['system:triageParaclinic']===true||data['system:triageParaclinic']==='true'){
                data['system:workflowStage']='OPD_PARACLINIC_ORDERING';
                delete data['system:cashierQueueRequest'];
              }else{
                data['system:workflowStage']='CASHIER_PENDING_OPD';
                data['system:cashierQueueRequest']={invoiceId:consultationCharge.invoiceId,sentAt:savedAt,sentBy:session.user_id,wardCode:'opd',source:'TRIAGE_OPD_CONSULTATION'};
                queueCashierPayment(database,patientKey,data['system:cashierQueueRequest']);
              }
            }else{
              data['system:opdConsultationPaidAt']=savedAt;
              data['system:workflowStage']=(data['system:triageParaclinic']===true||data['system:triageParaclinic']==='true')?'OPD_PARACLINIC_ORDERING':'DOCTOR_READY';
              delete data['system:cashierQueueRequest'];
            }
            database.sqlite.prepare('UPDATE patient_records SET record_json=?,updated_at=? WHERE patient_key=?').run(JSON.stringify(data),savedAt,patientKey);
            patient=database.findPatient(patientKey);
          }
          if (triageSave && !wasTransferredBefore && patient.service_mode==='opd') {
            opdReferral=referToOpd(database,patientKey,savedAt);
          }`;

server = server.replace(oldTriageOpdCharge.replace(/\n/g, '\r\n'), newTriageOpdCharge.replace(/\n/g, '\r\n'));

// 3. Post-commit triage notifications:
const oldTriageNotifications = `        if (triageSave) {
          data['system:triageSaved'] = true;
          const previousDept = (body.previousWard || existingPatient?.department_code || '').toLowerCase();
          const newDept = (patient.department_code || '').toLowerCase();
          const wardChanged = Boolean(body.triageWardChanged || (previousDept && newDept && previousDept !== newDept));

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
        }`;

const newTriageNotifications = `        if (triageSave) {
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
        }`;

server = server.replace(oldTriageNotifications.replace(/\n/g, '\r\n'), newTriageNotifications.replace(/\n/g, '\r\n'));
write('server/server.mjs', server);

console.log('Server updates applied successfully.');
