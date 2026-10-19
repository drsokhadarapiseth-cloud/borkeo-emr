import crypto from 'node:crypto';
import {ensureEncounterAccessSchema,encounterAccess} from './encounter-access.mjs';
import {getESignature} from './esign.mjs';
import {createStaffMessage} from './messages.mjs';
import {approveAdmission} from './admission-approvals.mjs';
import {invalidatePaymentStatusCache} from './finance.mjs';
export const MANAGEMENT=['ADMIN','DIRECTOR','VICE_DIRECTOR'];
const fail=(message,status=409)=>{throw Object.assign(new Error(message),{status})};
const parse=x=>{try{return JSON.parse(x||'{}')}catch{return {}}};
export function ensureRequestSchema(db){
 ensureEncounterAccessSchema(db);
  db.sqlite.exec(`CREATE TABLE IF NOT EXISTS workflow_legacy_reviews(id TEXT PRIMARY KEY,source_key TEXT NOT NULL,patient_key TEXT NOT NULL,decision TEXT NOT NULL,at INTEGER NOT NULL,note TEXT NOT NULL,signature_json TEXT NOT NULL,snapshot_json TEXT NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS request_decisions(id TEXT PRIMARY KEY,request_id TEXT NOT NULL,revision INTEGER NOT NULL,decision TEXT NOT NULL,actor_id TEXT NOT NULL,at INTEGER NOT NULL,note TEXT NOT NULL,signature_json TEXT NOT NULL,snapshot_json TEXT NOT NULL) STRICT;
CREATE TABLE IF NOT EXISTS finance_service_concessions(request_id TEXT NOT NULL,charge_id TEXT NOT NULL UNIQUE,invoice_id TEXT NOT NULL,amount_minor INTEGER NOT NULL CHECK(amount_minor>=0),kind TEXT NOT NULL,applied_by TEXT NOT NULL,applied_at INTEGER NOT NULL,PRIMARY KEY(request_id,charge_id)) STRICT;`);
  const tableSql=db.sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='workflow_requests'").get()?.sql||'';
  if(!tableSql){
    db.sqlite.exec(`CREATE TABLE workflow_requests(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('ADMISSION','DISCHARGE','FEE','PATIENT_EDIT','PATIENT_DELETE')),patient_key TEXT NOT NULL,source_key TEXT NOT NULL UNIQUE,source_ward TEXT NOT NULL DEFAULT '',source_role TEXT NOT NULL DEFAULT '',submitted_by TEXT NOT NULL,submitted_at INTEGER NOT NULL,snapshot_json TEXT NOT NULL,payload_json TEXT NOT NULL DEFAULT '{}',reason TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','APPLIED')),revision INTEGER NOT NULL DEFAULT 1,reviewed_by TEXT,reviewed_at INTEGER,review_note TEXT NOT NULL DEFAULT '',signature_json TEXT NOT NULL DEFAULT '') STRICT;`);
  }else if(!tableSql.includes('PATIENT_EDIT')){
    db.sqlite.exec(`CREATE TABLE workflow_requests_v285(id TEXT PRIMARY KEY,kind TEXT NOT NULL CHECK(kind IN ('ADMISSION','DISCHARGE','FEE','PATIENT_EDIT','PATIENT_DELETE')),patient_key TEXT NOT NULL,source_key TEXT NOT NULL UNIQUE,source_ward TEXT NOT NULL DEFAULT '',source_role TEXT NOT NULL DEFAULT '',submitted_by TEXT NOT NULL,submitted_at INTEGER NOT NULL,snapshot_json TEXT NOT NULL,payload_json TEXT NOT NULL DEFAULT '{}',reason TEXT NOT NULL DEFAULT '',status TEXT NOT NULL DEFAULT 'PENDING' CHECK(status IN ('PENDING','APPROVED','REJECTED','APPLIED')),revision INTEGER NOT NULL DEFAULT 1,reviewed_by TEXT,reviewed_at INTEGER,review_note TEXT NOT NULL DEFAULT '',signature_json TEXT NOT NULL DEFAULT '') STRICT;
    INSERT INTO workflow_requests_v285 SELECT * FROM workflow_requests;
    DROP TABLE workflow_requests;
    ALTER TABLE workflow_requests_v285 RENAME TO workflow_requests;`);
  }
}
export function signedBy(db,actor){const e=getESignature(db,actor.userId);const user=db.sqlite.prepare('SELECT display_name FROM users WHERE id=?').get(actor.userId);return {userId:actor.userId,name:e?.signerName||user?.display_name||actor.name||'',role:actor.role,wardCode:actor.wardCode||'',signedAt:Date.now(),signatureDataUrl:e?.signatureDataUrl||''}}
export function requestVisible(row,actor){if(actor.role==='PHARMACY')return row.kind==='PATIENT_DELETE'&&row.submitted_by===actor.userId;if(['CLERK','ACCOUNTANT'].includes(actor.role)&&row.kind!=='FEE')return false;return MANAGEMENT.includes(actor.role)||(['CLERK','ACCOUNTANT'].includes(actor.role)&&row.kind==='FEE'&&['APPROVED','APPLIED'].includes(row.status))||row.submitted_by===actor.userId||Boolean(actor.wardCode&&row.source_ward===actor.wardCode)}
function view(row){if(!row)return null;const snapshot=parse(row.snapshot_json);return {id:row.id,kind:row.kind,patientKey:row.patient_key,patientName:snapshot.full_name||'',caseNumber:snapshot.case_number||'',department:snapshot.department_name_kh||snapshot.department_code||'',sourceWard:row.source_ward,sourceRole:row.source_role,submittedBy:row.submitted_by,submittedAt:row.submitted_at,status:row.status,revision:row.revision,reason:row.reason,reviewNote:row.review_note,reviewedAt:row.reviewed_at,signature:parse(row.signature_json),payload:parse(row.payload_json)}}
export function listWorkflowRequests(db,actor){return db.sqlite.prepare('SELECT * FROM workflow_requests ORDER BY submitted_at DESC').all().filter(r=>requestVisible(r,actor)).map(view)}
export function getWorkflowRequest(db,id,actor){const row=db.sqlite.prepare('SELECT * FROM workflow_requests WHERE id=?').get(id);if(!row||!requestVisible(row,actor))fail('Request not found.',404);return {row,...view(row),snapshot:parse(row.snapshot_json),history:db.sqlite.prepare('SELECT revision,decision,at,note,signature_json FROM request_decisions WHERE request_id=? ORDER BY at').all(id).map(x=>({...x,signature:parse(x.signature_json)}))}}
function feeFingerprint(db,invoiceId){return crypto.createHash('sha256').update(JSON.stringify(db.sqlite.prepare('SELECT id,quantity,unit_amount_minor,amount_minor,currency,voided_at FROM finance_charges WHERE invoice_id=? ORDER BY id').all(invoiceId))).digest('hex')}
export function validateFee(db,payload,patientKey){
 const inv=db.sqlite.prepare('SELECT * FROM finance_invoices WHERE id=? AND patient_key=?').get(payload.invoiceId,patientKey);
 if(!inv||inv.closed_at)fail('Choose an open invoice.');
 if(db.sqlite.prepare('SELECT 1 FROM finance_payments WHERE invoice_id=? AND voided_at IS NULL').get(inv.id))fail('An invoice with payments cannot be adjusted here.');
 if(Number(inv.discount_percent)>0||Number(inv.discount_amount_minor)>0)fail('This invoice already has a profile discount. Use its existing approved adjustment process.');
 if(!['CASH','DIRECT','NOT_PAID','DISCOUNT'].includes(inv.payment_type))fail('This request is for direct patient charges. Sponsored payments retain their coverage rules.');
 if(payload.fingerprint&&payload.fingerprint!==feeFingerprint(db,inv.id))fail('Invoice services changed. Correct and resubmit the request.');
 const items=Array.isArray(payload.items)?payload.items:[];
 if(!items.length||new Set(items.map(x=>x.chargeId)).size!==items.length)fail('Select distinct services.');
 const fixed=payload.mode==='FIXED',percent=Number(payload.percent??100);
 if(!fixed&&(!Number.isFinite(percent)||percent<=0||percent>100))fail('Discount must be greater than 0 and at most 100 percent.');
 const selected=items.map(x=>{
  const c=db.sqlite.prepare('SELECT * FROM finance_charges WHERE id=? AND invoice_id=? AND voided_at IS NULL').get(x.chargeId,inv.id);
  if(!c)fail('Service no longer exists.');
  if(db.sqlite.prepare('SELECT 1 FROM finance_service_concessions WHERE charge_id=?').get(x.chargeId))fail('This service already has an applied concession.');
  return {chargeId:c.id,description:c.description,currency:c.currency,originalMinor:c.amount_minor,amountMinor:fixed?0:Math.round(c.amount_minor*percent/100)};
 });
 if(fixed){
  const currency=String(payload.currency||'KHR').toUpperCase(),amount=Number(payload.amount),budget=Math.round(amount*(currency==='USD'?100:1));
  if(!['KHR','USD'].includes(currency)||!Number.isFinite(amount)||!Number.isSafeInteger(budget)||budget<=0)fail('Enter a valid discount amount and currency.');
  if(selected.some(c=>c.currency!==currency))fail('A fixed discount may select services in only its specified currency.');
  const total=selected.reduce((n,c)=>n+c.originalMinor,0);if(budget>total)fail('Discount cannot exceed the selected services.');
  for(const c of selected)c.amountMinor=Math.floor(budget*c.originalMinor/total);
  let remainder=budget-selected.reduce((n,c)=>n+c.amountMinor,0);
  for(const c of [...selected].sort((a,b)=>(budget*b.originalMinor/total-b.amountMinor)-(budget*a.originalMinor/total-a.amountMinor)||a.chargeId.localeCompare(b.chargeId)))if(remainder>0&&c.amountMinor<c.originalMinor){c.amountMinor++;remainder--;}
 }
 return selected;
}

export function deletePatientRecord(db,patientKey){
 db.sqlite.exec('SAVEPOINT del_pat');
 try{
  db.sqlite.prepare('DELETE FROM queue_board_calls WHERE patient_key=?').run(patientKey);
  db.sqlite.prepare('DELETE FROM opd_queue_entries WHERE patient_key=?').run(patientKey);
  db.sqlite.prepare('DELETE FROM admission_approvals WHERE patient_key=?').run(patientKey);
  db.sqlite.prepare('DELETE FROM clinical_form_records WHERE patient_key=?').run(patientKey);
  db.sqlite.prepare('DELETE FROM patient_editor_history WHERE patient_key=?').run(patientKey);
  db.sqlite.prepare('DELETE FROM patient_records WHERE patient_key=?').run(patientKey);
  db.sqlite.exec('RELEASE SAVEPOINT del_pat');
 }catch(err){
  db.sqlite.exec('ROLLBACK TO SAVEPOINT del_pat');
  throw err;
 }
}

function capture(db,p){return JSON.stringify({...p,_clinicalForms:db.sqlite.prepare('SELECT form_type,form_data_json,updated_at FROM clinical_form_records WHERE patient_key=? ORDER BY updated_at').all(p.patient_key)})}
export function submitWorkflowRequest(db,body,actor,{system=false}={}){
 const patient=db.findPatient(String(body.patientKey||''));
 if(!patient)fail('Patient not found.',404);
 const kind=String(body.kind||'').toUpperCase();
 if(['LAB','IMAGING','PHARMACY'].includes(actor.role)&&kind!=='PATIENT_DELETE')fail('គណនីនេះអាចស្នើសុំលុបកំណត់ត្រាតែប៉ុណ្ណោះ។',403);
 if(!['ADMISSION','DISCHARGE','FEE','PATIENT_EDIT','PATIENT_DELETE'].includes(kind))fail('Invalid request type.',400);
 if(!system&&['CLERK','ACCOUNTANT'].includes(actor.role)&&kind!=='FEE')fail('Cashier may submit only fee concession requests.',403);
 if(!system&&!MANAGEMENT.includes(actor.role)&&!['LAB','IMAGING','PHARMACY','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','CLERK','ACCOUNTANT','REGISTRATION'].includes(actor.role))fail('Request access required.',403);
 if(kind==='ADMISSION'&&patient.service_mode!=='ipd')fail('Admission requests require an IPD referral.');
 if(kind==='DISCHARGE'&&!patient.discharge_date)fail('Complete the clinical discharge first.');
 if(['PATIENT_EDIT','PATIENT_DELETE'].includes(kind)&&!String(body.reason||'').trim())fail('A reason is required.',400);
 const payload={...(body.payload||{})};
 if(kind==='PATIENT_EDIT'){
  const scope=String(payload.scope||(['NURSE','MIDWIFE'].includes(actor.role)?'nursing':'medical'));
  if(!['medical','nursing'].includes(scope))fail('សំណើកែប្រែត្រូវកំណត់ទម្រង់ឱ្យច្បាស់។',400);
  const access=encounterAccess(db,{user_id:actor.userId,role:actor.role,active_role:actor.role,active_ward_code:actor.wardCode},patient,scope);
  if(!access.requiresApproval)fail(access.message||'កំណត់ត្រានេះមិនត្រូវការសំណើកែប្រែទេ។',403);
  payload.scope=scope;payload.version=patient.version;
 }
 if(kind==='FEE'){
  payload.percent=Number(payload.percent??100);
  payload.mode=payload.mode==='FIXED'?'FIXED':'PERCENT';
  if(payload.mode==='FIXED'){payload.amount=Number(payload.amount);payload.currency=String(payload.currency||'KHR').toUpperCase();}
  if(!String(body.reason||'').trim())fail('A reason is required.');
  payload.items=validateFee(db,payload,patient.patient_key);
  payload.fingerprint=feeFingerprint(db,payload.invoiceId);
  payload.invoiceNo=db.sqlite.prepare('SELECT invoice_no FROM finance_invoices WHERE id=?').get(payload.invoiceId).invoice_no;
 }
 const source=kind==='FEE'
  ? `FEE:${patient.patient_key}:${payload.invoiceId}:${payload.fingerprint}:${payload.items.map(x=>x.chargeId).sort().join(',')}:${payload.percent??100}:${payload.mode}:${payload.amount||0}:${payload.currency||''}`
  : kind==='PATIENT_EDIT' ? `${kind}:${patient.patient_key}:${payload.scope}:${patient.version}` : `${kind}:${patient.patient_key}`;
 const existing=db.sqlite.prepare('SELECT * FROM workflow_requests WHERE source_key=?').get(source);
 if(existing&&existing.status!=='REJECTED')return view(existing);
 const now=Date.now(),snapshot=capture(db,patient);
 if(existing){
  if(!system&&!requestVisible(existing,actor))fail('This request belongs to another department.',403);
  db.sqlite.prepare("UPDATE workflow_requests SET status='PENDING',revision=revision+1,submitted_by=?,submitted_at=?,snapshot_json=?,payload_json=?,reason=?,reviewed_by=NULL,reviewed_at=NULL,review_note='',signature_json='' WHERE id=?").run(actor.userId,now,snapshot,JSON.stringify(payload),String(body.reason||'').slice(0,1000),existing.id);
  return view(db.sqlite.prepare('SELECT * FROM workflow_requests WHERE id=?').get(existing.id));
 }
 const id=crypto.randomUUID();
 db.sqlite.prepare('INSERT INTO workflow_requests(id,kind,patient_key,source_key,source_ward,source_role,submitted_by,submitted_at,snapshot_json,payload_json,reason) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,kind,patient.patient_key,source,actor.wardCode||'',actor.role,actor.userId||patient.updated_by||patient.created_by,now,snapshot,JSON.stringify(payload),String(body.reason||'').slice(0,1000));
 if(kind==='PATIENT_EDIT')db.sqlite.prepare('INSERT INTO encounter_corrections(request_id,patient_key,scope,requested_by,version) VALUES(?,?,?,?,?)').run(id,patient.patient_key,payload.scope,actor.userId,patient.version);
 return view(db.sqlite.prepare('SELECT * FROM workflow_requests WHERE id=?').get(id));
}

export function syncClinicalRequests(db,patient,actor){for(const kind of ['ADMISSION',...(patient.discharge_date?['DISCHARGE']:[])]){if(patient.service_mode!=='ipd'&&kind==='ADMISSION')continue;const existing=db.sqlite.prepare('SELECT * FROM workflow_requests WHERE source_key=?').get(`${kind}:${patient.patient_key}`);if(!existing)submitWorkflowRequest(db,{kind,patientKey:patient.patient_key},actor,{system:true});else if(existing.status==='PENDING')db.sqlite.prepare('UPDATE workflow_requests SET snapshot_json=? WHERE id=?').run(capture(db,patient),existing.id)}}
export function seedExistingRequests(db){for(const p of db.sqlite.prepare("SELECT * FROM patient_records WHERE service_mode='ipd'").all()){const d=parse(p.record_json),sig=parse(d['system:signature:triage']);syncClinicalRequests(db,p,{role:sig.role||'NURSE',wardCode:sig.wardCode||p.department_code,userId:sig.userId||p.updated_by||p.created_by});const old=db.sqlite.prepare('SELECT * FROM admission_approvals WHERE patient_key=? ORDER BY approved_at LIMIT 1').get(p.patient_key);if(old)db.sqlite.prepare("UPDATE workflow_requests SET status='APPROVED',reviewed_by=?,reviewed_at=?,signature_json=? WHERE source_key=? AND status='PENDING'").run(old.approved_by,old.approved_at,JSON.stringify({userId:old.approved_by,name:old.approved_name,role:old.approver_role,signedAt:old.approved_at}),`ADMISSION:${p.patient_key}`)}}
export function notifyRequestFeedback(db,r,actor,note){const dest=r.source_ward?'WARD':(['TRIAGE','REGISTRATION','CLERK','ACCOUNTANT'].includes(r.source_role)?r.source_role:'WARD');createStaffMessage(db,{senderUserId:actor.userId,senderRole:actor.role,senderWardCode:actor.wardCode||'',destinationType:dest,destinationCode:r.source_ward||'',subject:`សំណើត្រូវកែតម្រូវ · ${r.kind}`,body:note,patientKey:r.patient_key})}

export function reviewWorkflowRequest(db,id,body,actor){
 if(!MANAGEMENT.includes(actor.role))fail('Management approval required.',403);
 const r=getWorkflowRequest(db,id,actor);
 if(r.status!=='PENDING')fail('This request was already reviewed.');
 if(body.revision!==r.revision)fail('The request changed. Refresh before signing.');
 if(typeof body.approved!=='boolean')fail('Choose approve or reject.',400);
 const note=String(body.note||'').trim().slice(0,1000);
 if(!body.approved&&!note)fail('Rejection feedback is required.',400);
 const signature=signedBy(db,actor);
 if(r.kind==='FEE'&&body.approved)validateFee(db,r.payload,r.patientKey);
 const status=body.approved?'APPROVED':'REJECTED';
 db.sqlite.prepare('UPDATE workflow_requests SET status=?,reviewed_by=?,reviewed_at=?,review_note=?,signature_json=? WHERE id=? AND status=\'PENDING\'').run(status,actor.userId,Date.now(),note,JSON.stringify(signature),id);
 db.sqlite.prepare('INSERT INTO request_decisions VALUES(?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),id,r.revision,status,actor.userId,Date.now(),note,JSON.stringify(signature),r.row.snapshot_json);
 if(body.approved&&r.kind==='ADMISSION')approveAdmission(db,r.patientKey,actor.role,actor.userId);
 if(body.approved&&r.kind==='PATIENT_DELETE')deletePatientRecord(db,r.patientKey);
 if(!body.approved)notifyRequestFeedback(db,r.row,actor,note);
 return getWorkflowRequest(db,id,actor);
}

export function bulkReviewWorkflowRequests(db,body,actor){
 if(!MANAGEMENT.includes(actor.role))fail('Management approval required.',403);
 const reviews=Array.isArray(body?.reviews)?body.reviews:[];
 if(!reviews.length)fail('No requests selected.',400);
 const note=String(body.note||'Bulk approved by Management').trim().slice(0,1000);
 const signature=signedBy(db,actor);
 const results=[];
 const inTx=db.sqlite.inTransaction;
 if(!inTx)db.sqlite.exec('BEGIN IMMEDIATE');
 try{
  for(const item of reviews){
   const id=String(item.id||'');
   const row=db.sqlite.prepare('SELECT * FROM workflow_requests WHERE id=?').get(id);
   if(!row||row.status!=='PENDING')continue;
   if(item.revision!==undefined&&item.revision!==row.revision)continue;
   const r=getWorkflowRequest(db,id,actor);
   if(r.kind==='FEE')validateFee(db,r.payload,r.patientKey);
   db.sqlite.prepare("UPDATE workflow_requests SET status='APPROVED',reviewed_by=?,reviewed_at=?,review_note=?,signature_json=? WHERE id=? AND status='PENDING'").run(actor.userId,Date.now(),note,JSON.stringify(signature),id);
   db.sqlite.prepare('INSERT INTO request_decisions VALUES(?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),id,r.revision,'APPROVED',actor.userId,Date.now(),note,JSON.stringify(signature),r.row.snapshot_json);
   if(r.kind==='ADMISSION')approveAdmission(db,r.patientKey,actor.role,actor.userId);
   if(r.kind==='PATIENT_DELETE')deletePatientRecord(db,r.patientKey);
   results.push(id);
  }
  if(!inTx)db.sqlite.exec('COMMIT');
 }catch(err){
  if(!inTx)db.sqlite.exec('ROLLBACK');
  throw err;
 }
 return results;
}

export function applyServiceConcession(db,id,actor){if(!['CLERK','ACCOUNTANT',...MANAGEMENT].includes(actor.role))fail('Cashier access required.',403);const row=db.sqlite.prepare('SELECT * FROM workflow_requests WHERE id=?').get(id);if(!row||row.kind!=='FEE')fail('Fee request not found.',404);if(row.status==='APPLIED')return view(row);if(row.status!=='APPROVED')fail('Approval is required before applying the concession.',403);const payload=parse(row.payload_json),items=validateFee(db,payload,row.patient_key);for(const x of items)db.sqlite.prepare('INSERT INTO finance_service_concessions VALUES(?,?,?,?,?,?,?)').run(id,x.chargeId,payload.invoiceId,x.amountMinor,x.amountMinor===x.originalMinor?'FULL':'DISCOUNT',actor.userId,Date.now());db.sqlite.prepare("UPDATE workflow_requests SET status='APPLIED' WHERE id=?").run(id);invalidatePaymentStatusCache(row.patient_key);return view(db.sqlite.prepare('SELECT * FROM workflow_requests WHERE id=?').get(id))}

export function legacyReviewHistory(db,sourceKey){return db.sqlite.prepare('SELECT decision,at,note,signature_json FROM workflow_legacy_reviews WHERE source_key=? ORDER BY at,id').all(sourceKey).map(r=>({decision:r.decision,at:r.at,note:r.note,signature:parse(r.signature_json)}));}
export function recordLegacyReview(db,sourceKey,result,actor){const signature=signedBy(db,actor);db.sqlite.prepare('INSERT INTO workflow_legacy_reviews VALUES(?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),sourceKey,result.patientKey,result.status||result.waiverStatus,Date.now(),result.reviewNote||'',JSON.stringify(signature),JSON.stringify(result));return signature;}
