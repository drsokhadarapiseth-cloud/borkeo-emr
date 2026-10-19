import crypto from 'node:crypto';
import {WARDS} from './access.mjs';
import {patientBill,listPatientInvoices,moneyToMinor,voidFinanceItem, invalidatePaymentStatusCache} from './finance.mjs';

export function ensureInvoiceEditSchema(database){
 database.sqlite.exec(`CREATE TABLE IF NOT EXISTS finance_cashier_requests (
 invoice_id TEXT PRIMARY KEY REFERENCES finance_invoices(id),patient_key TEXT NOT NULL REFERENCES patient_records(patient_key),
 sent_by TEXT NOT NULL REFERENCES users(id),sent_at INTEGER NOT NULL,ward_code TEXT NOT NULL DEFAULT '',source TEXT NOT NULL DEFAULT ''
 ) STRICT;
 CREATE INDEX IF NOT EXISTS finance_cashier_patient_idx ON finance_cashier_requests(patient_key,sent_at);
 CREATE TABLE IF NOT EXISTS finance_invoice_edit_requests (
 id TEXT PRIMARY KEY,patient_key TEXT NOT NULL,invoice_id TEXT NOT NULL REFERENCES finance_invoices(id),
 requested_by TEXT NOT NULL REFERENCES users(id),requested_at INTEGER NOT NULL,reason TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'PENDING',fingerprint TEXT NOT NULL,before_json TEXT NOT NULL,
 reviewed_by TEXT REFERENCES users(id),reviewed_at INTEGER,review_note TEXT NOT NULL DEFAULT '',
 applied_at INTEGER,after_json TEXT NOT NULL DEFAULT ''
 ) STRICT;
 CREATE INDEX IF NOT EXISTS finance_invoice_edit_status_idx ON finance_invoice_edit_requests(status,requested_at DESC);`);
 if(!database.sqlite.prepare('PRAGMA table_info(finance_invoice_edit_requests)').all().some(column=>column.name==='operation'))database.sqlite.exec("ALTER TABLE finance_invoice_edit_requests ADD COLUMN operation TEXT NOT NULL DEFAULT 'CORRECT'");
 for(const patient of database.sqlite.prepare(`SELECT * FROM patient_records WHERE json_extract(record_json,'$."system:cashierQueueRequest"') IS NOT NULL`).all()){
  const queue=JSON.parse(patient.record_json)['system:cashierQueueRequest'];
  if(queue?.invoiceId&&!database.sqlite.prepare('SELECT 1 FROM finance_cashier_requests WHERE invoice_id=?').get(queue.invoiceId))queueCashierPayment(database,patient.patient_key,queue);
 }
}
const manager=role=>['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role);
function failure(message,status=409){const error=new Error(message);error.status=status;throw error;}
export function invoiceSettled(bill){
 const due=Number(bill?.summary?.KHR?.balance||0)+Number(bill?.summary?.USD?.balance||0);
 const gross=Number(bill?.summary?.KHR?.gross||0)+Number(bill?.summary?.USD?.gross||0);
 return Boolean(bill?.invoice?.closedAt || (gross>0 && due<=0));
}
export function isPatientDischarged(database, patientKey) {
  const patient = database.findPatient(patientKey);
  if (!patient) return false;
  let data = {};
  try { data = JSON.parse(patient.record_json || '{}'); } catch {}
  const isFormallyDischarged = data['system:admissionStatus'] === 'discharged' && Boolean(data['system:discharge']);
  const isOpdDischarged = patient.service_mode === 'opd' && (Boolean(data['system:opdDischarge']?.dispensedAt) || data['system:workflowStage'] === 'OPD_DISCHARGED');
  return Boolean(patient.discharge_date || isFormallyDischarged || isOpdDischarged || data['system:admissionStatus'] === 'discharged');
}
export function assertCashierInvoiceWritable(database,patientKey,invoiceId,role){
  if(invoiceId&&invoiceSettled(patientBill(database,patientKey,invoiceId)))failure('ការកែប្រែវិក្កយបត្រដែលបានទូទាត់ត្រូវការការអនុម័តពីគណៈគ្រប់គ្រង។',403);
  if(isPatientDischarged(database,patientKey)){
    failure('អ្នកជំងឺបានចេញពីពេទ្យរួចហើយ (ករណីត្រូវបានបិទ) មិនអាចកែប្រែវិក្កយបត្របានទេ។ / Patient is discharged (case closed). Invoices are locked.', 403);
  }
}
function snapshot(bill){
 return {invoice:bill.invoice,profile:bill.profile,summary:bill.summary,
 charges:bill.charges.map(({id,description,quantity,unitAmount,amount,currency,category,note,serviceCode,voidedAt,voidReason})=>({id,description,quantity,unitAmount,amount,currency,category,note,serviceCode,voidedAt,voidReason})),
 payments:bill.payments.map(({id,receiptNo,amount,currency,receivedAt,voidedAt,voidReason})=>({id,receiptNo,amount,currency,receivedAt,voidedAt,voidReason}))};
}
const fingerprint=bill=>crypto.createHash('sha256').update(JSON.stringify(snapshot(bill))).digest('hex');
function requestRow(row){if(!row)return null;return {id:row.id,operation:row.operation||'CORRECT',patientKey:row.patient_key,invoiceId:row.invoice_id,invoiceNo:row.invoice_no,patientName:row.patient_name,requestedBy:row.requested_by,requestedByName:row.requester_name,requestedAt:row.requested_at,reason:row.reason,status:row.status,reviewedBy:row.reviewed_by,reviewedByName:row.reviewer_name,reviewedAt:row.reviewed_at,reviewNote:row.review_note,appliedAt:row.applied_at,before:JSON.parse(row.before_json),after:row.after_json?JSON.parse(row.after_json):null};}
export function invoiceEditRequests(database,{userId,role},patientKey=''){
 const where=manager(role)?'1=1':'r.requested_by=?',args=manager(role)?[]:[userId];
 const active=patientKey?'':manager(role)?" AND r.status='PENDING'":" AND r.status IN ('PENDING','APPROVED','REJECTED')";
 if(patientKey)args.push(patientKey);
 return database.sqlite.prepare(`SELECT r.*,i.invoice_no,u.display_name requester_name,v.display_name reviewer_name,p.full_name patient_name
 FROM finance_invoice_edit_requests r JOIN finance_invoices i ON i.id=r.invoice_id JOIN users u ON u.id=r.requested_by
 LEFT JOIN users v ON v.id=r.reviewed_by JOIN patient_records p ON p.patient_key=r.patient_key
 WHERE ${where}${active}${patientKey?' AND r.patient_key=?':''} ORDER BY r.requested_at DESC,r.rowid DESC`).all(...args).map(requestRow);
}
export function invoiceHistory(database,patientKey,{paidOnly=false}={}){
 if(!database.findPatient(patientKey))failure('Patient was not found.',404);
 const discharged=isPatientDischarged(database,patientKey);
 return listPatientInvoices(database,patientKey).map(invoice=>{
  const bill=patientBill(database,patientKey,invoice.id),payments=bill.payments.filter(p=>!p.voidedAt);
  const paymentAt=payments.reduce((latest,p)=>Math.max(latest,Number(p.receivedAt||0)),0);
  const cancelled=Boolean(database.sqlite.prepare("SELECT 1 FROM finance_invoice_edit_requests WHERE invoice_id=? AND operation='VOID' AND status='APPLIED'").get(invoice.id));
  return {invoice,bill,paymentAt,locked:discharged,discharged,settled:invoiceSettled(bill),cancelled};
 }).filter(entry=>!paidOnly||entry.settled&&!entry.cancelled).sort((a,b)=>b.paymentAt-a.paymentAt || b.invoice.createdAt-a.invoice.createdAt);
}
// Keep one payment handoff per invoice; later invoices never overwrite earlier handoffs.
export function queueCashierPayment(database,patientKey,queue){
 if(!queue?.invoiceId||!database.sqlite.prepare('SELECT 1 FROM users WHERE id=?').get(queue.sentBy||''))return;
 const bill=patientBill(database,patientKey,queue.invoiceId);
 if(!bill?.invoice||invoiceSettled(bill))return;
 const balance=Number(bill.summary.KHR.balance||0)+Number(bill.summary.USD.balance||0);
 if(balance<=0)return;
 database.sqlite.prepare(`INSERT INTO finance_cashier_requests(invoice_id,patient_key,sent_by,sent_at,ward_code,source)
 VALUES(?,?,?,?,?,?) ON CONFLICT(invoice_id) DO UPDATE SET sent_by=excluded.sent_by,sent_at=excluded.sent_at,ward_code=excluded.ward_code,source=excluded.source`)
 .run(queue.invoiceId,patientKey,queue.sentBy,Number(queue.sentAt||Date.now()),queue.wardCode||'',queue.source||'');
}
export function cashierPaymentAlerts(database){
 const requests=new Map(database.sqlite.prepare('SELECT * FROM finance_cashier_requests').all().map(r=>[r.invoice_id,{invoiceId:r.invoice_id,patientKey:r.patient_key,sentBy:r.sent_by,sentAt:r.sent_at,wardCode:r.ward_code,source:r.source}]));
 // Older projects keep their most recent handoff inside the patient record.
 for(const patient of database.sqlite.prepare(`SELECT * FROM patient_records WHERE json_extract(record_json,'$."system:cashierQueueRequest"') IS NOT NULL`).all()){
  const queue=JSON.parse(patient.record_json)['system:cashierQueueRequest'];
  if(queue?.invoiceId&&!requests.has(queue.invoiceId))requests.set(queue.invoiceId,{...queue,patientKey:patient.patient_key});
 }
 return [...requests.values()].flatMap(queue=>{
  const patient=database.findPatient(queue.patientKey),bill=patientBill(database,queue.patientKey,queue.invoiceId);
  if(!patient||!bill?.invoice||invoiceSettled(bill))return [];
  const balance=Number(bill.summary.KHR.balance||0)+Number(bill.summary.USD.balance||0);
  if(balance<=0)return [];
  const sender=database.sqlite.prepare('SELECT display_name FROM users WHERE id=?').get(queue.sentBy||'');
  const ward=WARDS.find(w=>w.code===(queue.wardCode||patient.department_code));
  return [{wardNameKh:ward?.nameKh||patient.department_name_kh,wardNameEn:ward?.nameEn||patient.department_name_en,id:queue.invoiceId,invoiceId:queue.invoiceId,invoiceNo:bill.invoice.invoiceNo,patientKey:patient.patient_key,patientName:patient.full_name,wardCode:queue.wardCode||patient.department_code,senderName:sender?.display_name||'',sentAt:Number(queue.sentAt||0),source:queue.source||'',summary:bill.summary}];
 }).sort((a,b)=>b.sentAt-a.sentAt);
}
export function requestInvoiceEdit(database,{userId,role},patientKey,invoiceId,reason,operation='CORRECT'){
 if(!['CLERK','ACCOUNTANT','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role))failure('សូមប្រើគណនីបេឡា ឬគណៈគ្រប់គ្រង។',403);
 if(!['CORRECT','VOID'].includes(operation))failure('ប្រភេទសំណើមិនត្រឹមត្រូវ។',400);
 const bill=patientBill(database,patientKey,invoiceId);
 if(!invoiceId||!bill)failure('Invoice was not found.',404);
 if(operation==='CORRECT'&&!invoiceSettled(bill))failure('សូមប្រើសំណើកែសម្រាប់វិក្កយបត្រដែលបានទូទាត់។');
 const note=String(reason||'').trim();if(!note||note.length>1000)failure('Enter a correction reason (up to 1000 characters).',400);
 const current=fingerprint(bill),prior=database.sqlite.prepare("SELECT * FROM finance_invoice_edit_requests WHERE invoice_id=? AND requested_by=? AND operation=? AND status IN ('PENDING','APPROVED') ORDER BY requested_at DESC").get(invoiceId,userId,operation);
 if(prior?.fingerprint===current)return prior.id;
 if(prior)database.sqlite.prepare("UPDATE finance_invoice_edit_requests SET status='STALE' WHERE id=?").run(prior.id);
 const id=crypto.randomUUID();database.sqlite.prepare(`INSERT INTO finance_invoice_edit_requests(id,patient_key,invoice_id,requested_by,requested_at,reason,fingerprint,before_json,operation) VALUES(?,?,?,?,?,?,?,?,?)`).run(id,patientKey,invoiceId,userId,Date.now(),note,current,JSON.stringify(snapshot(bill)),operation);
 return id;
}
export function reviewInvoiceEdit(database,{userId,role},id,approved,note=''){
 if(!manager(role))failure('Admin or Director approval is required.',403);
 database.sqlite.exec('BEGIN IMMEDIATE');
 try{
  const row=database.sqlite.prepare('SELECT * FROM finance_invoice_edit_requests WHERE id=?').get(id);
  if(!row)failure('Correction request was not found.',404);
  if(row.status!=='PENDING')failure('This request has already been reviewed.');
  const bill=patientBill(database,row.patient_key,row.invoice_id);
  if(!bill||fingerprint(bill)!==row.fingerprint)failure('Invoice changed since the request. Reject it and ask for a new request.');
  database.sqlite.prepare('UPDATE finance_invoice_edit_requests SET status=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=? AND status=\'PENDING\'').run(approved?'APPROVED':'REJECTED',userId,Date.now(),String(note||'').trim().slice(0,1000),id);
  if(approved&&row.operation==='VOID'){
   const at=Date.now(),reason='ការលុបវិក្កយបត្រត្រូវបានអនុម័ត៖ '+row.reason;
   for(const charge of bill.charges.filter(item=>!item.voidedAt))voidFinanceItem(database,'charge',charge.id,reason,userId,at);
   for(const payment of bill.payments.filter(item=>!item.voidedAt))voidFinanceItem(database,'payment',payment.id,reason,userId,at);
   database.sqlite.prepare('UPDATE finance_invoices SET closed_at=? WHERE id=?').run(at,row.invoice_id);
   const after=patientBill(database,row.patient_key,row.invoice_id);
   database.sqlite.prepare("UPDATE finance_invoice_edit_requests SET status='APPLIED',applied_at=?,after_json=? WHERE id=?").run(at,JSON.stringify(snapshot(after)),id);
  }
  database.sqlite.exec('COMMIT');
 }catch(error){database.sqlite.exec('ROLLBACK');throw error;}
}
export function applyInvoiceEdit(database,{userId,role},id,values){
 if(!['CLERK','ACCOUNTANT','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role))failure('គណនីនេះមិនអាចប្រើសំណើកែបានទេ។',403);
 database.sqlite.exec('BEGIN IMMEDIATE');
 try{
  const row=database.sqlite.prepare('SELECT * FROM finance_invoice_edit_requests WHERE id=?').get(id);
  if(!row)failure('Correction request was not found.',404);
  if(row.requested_by!==userId)failure('Approval belongs to another Cashier account.',403);
  if(row.operation==='VOID')failure('សំណើលុបមិនអាចប្រើសម្រាប់កែវិក្កយបត្របានទេ។',403);
  if(row.status!=='APPROVED')failure('An approved, unused correction request is required.');
  const bill=patientBill(database,row.patient_key,row.invoice_id);
  if(!bill||fingerprint(bill)!==row.fingerprint)failure('Invoice changed after approval. Request a new approval.');
  const active=bill.charges.filter(c=>!c.voidedAt),charges=values?.charges;
  if(!Array.isArray(charges)||charges.length!==active.length||new Set(charges.map(c=>c.id)).size!==active.length)failure('Send each original active invoice service exactly once.',400);
  const updates=charges.map(value=>{
   const original=active.find(c=>c.id===value.id);if(!original)failure('Service does not belong to this invoice.',400);
   const quantity=Number(value.quantity),description=String(value.description||'').trim(),unitAmount=moneyToMinor(value.unitAmount,original.currency);
   if(!Number.isFinite(quantity)||quantity<=0||quantity>100000||!description||description.length>300)failure('Enter valid service details and quantities.',400);
   const amount=Math.round(quantity*unitAmount);if(!Number.isSafeInteger(amount)||amount>100000000000000)failure('Service total is invalid.',400);
   return {id:original.id,quantity,description,unitAmount,amount,note:String(value.note||'').trim().slice(0,1000)};
  });
  const statement=database.sqlite.prepare('UPDATE finance_charges SET description=?,quantity=?,unit_amount_minor=?,amount_minor=?,note=? WHERE id=? AND invoice_id=? AND voided_at IS NULL');
  for(const value of updates)statement.run(value.description,value.quantity,value.unitAmount,value.amount,value.note,value.id,row.invoice_id);
  // A correction changes the basis of coverage/exemption approval.
  if(bill.invoice.coverageAt)database.sqlite.prepare('UPDATE finance_invoices SET coverage_at=NULL,coverage_by=NULL WHERE id=?').run(row.invoice_id);
  if(bill.profile.approvalId){
   database.sqlite.prepare("UPDATE finance_invoices SET payment_subtype='FULL',discount_percent=0,discount_amount_minor=0,concession_approval_id='' WHERE id=?").run(row.invoice_id);
   if(patientBill(database,row.patient_key)?.invoice?.id===row.invoice_id)database.sqlite.prepare("UPDATE patient_finance_profiles SET payment_subtype='FULL',discount_percent=0,discount_amount_minor=0,concession_approval_id='' WHERE patient_key=?").run(row.patient_key);
  }
  let after=patientBill(database,row.patient_key,row.invoice_id);
  const balance=Number(after.summary.KHR.balance||0)+Number(after.summary.USD.balance||0);
  database.sqlite.prepare('UPDATE finance_invoices SET closed_at=? WHERE id=?').run(balance>0?null:(bill.invoice.closedAt||Date.now()),row.invoice_id);
  after=patientBill(database,row.patient_key,row.invoice_id);
  database.sqlite.prepare("UPDATE finance_invoice_edit_requests SET status='APPLIED',applied_at=?,after_json=? WHERE id=? AND status='APPROVED'").run(Date.now(),JSON.stringify(snapshot(after)),id);
  // Receipt/payment entries are never deleted, replaced or silently re-recorded.
  database.sqlite.exec('COMMIT');
  return {bill:after,patientKey:row.patient_key,invoiceId:row.invoice_id,balance};
 }catch(error){database.sqlite.exec('ROLLBACK');throw error;}
}

export function applyDirectInvoiceEdit(database, {userId, role}, patientKey, invoiceId, values) {
  failure('ការកែវិក្កយបត្រត្រូវការសំណើអនុម័ត។ មិនអាចកែដោយផ្ទាល់បានទេ។',403);
  if (!database.findPatient(patientKey)) failure('Patient was not found.', 404);
  if (isPatientDischarged(database, patientKey)) {
    failure('អ្នកជំងឺបានចេញពីពេទ្យរួចហើយ (ករណីត្រូវបានបិទ) មិនអាចកែប្រែវិក្កយបត្របានទេ។ / Patient is discharged (case closed). Invoices are locked.', 403);
  }
  const bill = patientBill(database, patientKey, invoiceId);
  if (!bill?.invoice) failure('Invoice was not found.', 404);
  const active = bill.charges.filter(c => !c.voidedAt), charges = values?.charges;
  if (!Array.isArray(charges) || !charges.length) failure('Charges list is required.', 400);
  const updates = charges.map(value => {
    const original = active.find(c => c.id === value.id);
    if (!original) failure('Service does not belong to this invoice.', 400);
    const quantity = Number(value.quantity), description = String(value.description || '').trim();
    const unitAmount = moneyToMinor(value.unitAmount, original.currency);
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 100000 || !description || description.length > 300) {
      failure('Enter valid service details and quantities.', 400);
    }
    const amount = Math.round(quantity * unitAmount);
    if (!Number.isSafeInteger(amount) || amount > 100000000000000) failure('Service total is invalid.', 400);
    return { id: original.id, quantity, description, unitAmount, amount, note: String(value.note || '').trim().slice(0, 1000) };
  });
  database.sqlite.exec('BEGIN IMMEDIATE');
  try {
    const statement = database.sqlite.prepare('UPDATE finance_charges SET description=?,quantity=?,unit_amount_minor=?,amount_minor=?,note=? WHERE id=? AND invoice_id=? AND voided_at IS NULL');
    for (const value of updates) statement.run(value.description, value.quantity, value.unitAmount, value.amount, value.note, value.id, invoiceId);
    if (bill.invoice.coverageAt) database.sqlite.prepare('UPDATE finance_invoices SET coverage_at=NULL,coverage_by=NULL WHERE id=?').run(invoiceId);
    if (bill.profile.approvalId) {
      database.sqlite.prepare("UPDATE finance_invoices SET payment_subtype='FULL',discount_percent=0,discount_amount_minor=0,concession_approval_id='' WHERE id=?").run(invoiceId);
      if (patientBill(database, patientKey)?.invoice?.id === invoiceId) {
        database.sqlite.prepare("UPDATE patient_finance_profiles SET payment_subtype='FULL',discount_percent=0,discount_amount_minor=0,concession_approval_id='' WHERE patient_key=?").run(patientKey);
      }
    }
    let after = patientBill(database, patientKey, invoiceId);
    const balance = Number(after.summary.KHR?.balance || 0) + Number(after.summary.USD?.balance || 0);
    database.sqlite.prepare('UPDATE finance_invoices SET closed_at=? WHERE id=?').run(balance > 0 ? null : (bill.invoice.closedAt || Date.now()), invoiceId);
    after = patientBill(database, patientKey, invoiceId);
    database.sqlite.exec('COMMIT');
    return { bill: after, patientKey, invoiceId, balance };
  } catch (error) {
    database.sqlite.exec('ROLLBACK');
    throw error;
  }
}

