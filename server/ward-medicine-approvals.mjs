import crypto from 'node:crypto';
import { buildMedicineMatrix } from './ward-medicine-matrix.mjs';
import { wardMedicineReport } from './ward-medicines.mjs';
import { patientWorkWard, WARDS } from './access.mjs';
import { userSignerName } from './esign.mjs';

function nextDay(date) {
  const [year,month,day]=date.split('-').map(Number);
  return new Date(Date.UTC(year,month-1,day+1)).toISOString().slice(0,10);
}
function localDate(){return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());}

function addColumnIfMissing(sqlite, table, column, definition) {
  const columns=sqlite.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(item=>item.name===column)) sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
export function approvalFor(database,ward,date) {
  return database.sqlite.prepare('SELECT * FROM ward_medicine_approvals WHERE ward_code=? AND report_date=?').get(ward,date);
}
export function medicineDocumentFingerprint(report){return crypto.createHash('sha256').update(JSON.stringify({date:report.date,wardCode:report.wardCode,patients:report.patients,matrix:report.matrix})).digest('hex');}
const documentView=report=>({...report,fingerprint:medicineDocumentFingerprint(report)});
export function medicineStage(row) {
  if (row?.rejected_at) return {status:'rejected',nextAction:'WARD_HEAD',nextStep:1};
  if (row?.receiver_at || row?.legacy_complete) return {status:'delivered',nextAction:'',nextStep:0};
  if (row?.sender_at) return {status:'handed_over',nextAction:'NURSE',nextStep:6};
  if (row?.pharmacy_at) return {status:'pharmacy_signed',nextAction:'PHARMACY',nextStep:5};
  if (row?.director_at || row?.approved_at) return {status:'director_signed',nextAction:'PHARMACY',nextStep:4};
  if (row?.chief_at) return {status:'chief_signed',nextAction:'DIRECTOR',nextStep:3};
  if (row?.nurse_at) return {status:'nurse_signed',nextAction:'CHIEF_WARD',nextStep:2};
  return {status:'pending',nextAction:'WARD_HEAD',nextStep:1};
}
const stage=medicineStage;
function signer(row,prefix) {
  const at=row?.[`${prefix}_at`] || 0;
  let signature={};try{signature=JSON.parse(row?.[`${prefix}_signature_json`]||'{}')}catch{}
  return at ? {...signature,userId:row[`${prefix}_user_id`]||'',name:row[`${prefix}_name`]||'',signedAt:at,title:prefix==='chief'&&signature.role==='DOCTOR'?'ជ.ប្រធានផ្នែក':undefined} : null;
}
function approvalView(row,database) {
  const current=stage(row);
  return {
    status:current.status,nextAction:current.nextAction,nextStep:current.nextStep,revision:row?.revision||0,legacyComplete:Boolean(row?.legacy_complete),history:row?database.sqlite.prepare("SELECT h.action,h.at,h.note,u.display_name actorName FROM medicine_signature_history h LEFT JOIN users u ON u.id=h.actor_id WHERE h.ward_code=? AND h.report_date=? ORDER BY h.at,h.id").all(row.ward_code,row.report_date):[],rejectionNote:row?.rejection_note||'',
    nurse:signer(row,'nurse'),chief:signer(row,'chief'),director:signer(row,'director'),pharmacy:signer(row,'pharmacy'),sender:signer(row,'sender'),receiver:signer(row,'receiver'),
    nextDate:current.status==='director_signed'||current.status==='delivered' ? null : undefined,
  };
}

export function ensureWardMedicineApprovalSchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS ward_medicine_approvals (
    ward_code TEXT NOT NULL, report_date TEXT NOT NULL,
    approved_by TEXT NOT NULL DEFAULT '', approved_name TEXT NOT NULL DEFAULT '', approved_at INTEGER NOT NULL DEFAULT 0,
    snapshot_json TEXT NOT NULL DEFAULT '',
    PRIMARY KEY(ward_code,report_date)
  ) STRICT;
  CREATE TABLE IF NOT EXISTS ward_medicine_pending (
    ward_code TEXT NOT NULL, report_date TEXT NOT NULL, patient_key TEXT NOT NULL,
    source_date TEXT NOT NULL, patient_json TEXT NOT NULL, added_at INTEGER NOT NULL,
    PRIMARY KEY(ward_code,report_date,patient_key)
  ) STRICT;`);
  const cols=database.sqlite.prepare('PRAGMA table_info(ward_medicine_approvals)').all().map(c=>c.name);
  const defs={
    nurse_user_id:"TEXT NOT NULL DEFAULT ''", nurse_name:"TEXT NOT NULL DEFAULT ''", nurse_at:'INTEGER NOT NULL DEFAULT 0', nurse_signature_json:"TEXT NOT NULL DEFAULT ''",
    chief_user_id:"TEXT NOT NULL DEFAULT ''", chief_name:"TEXT NOT NULL DEFAULT ''", chief_at:'INTEGER NOT NULL DEFAULT 0', chief_signature_json:"TEXT NOT NULL DEFAULT ''",
    director_user_id:"TEXT NOT NULL DEFAULT ''", director_name:"TEXT NOT NULL DEFAULT ''", director_at:'INTEGER NOT NULL DEFAULT 0', director_signature_json:"TEXT NOT NULL DEFAULT ''",
    pharmacy_user_id:"TEXT NOT NULL DEFAULT ''", pharmacy_name:"TEXT NOT NULL DEFAULT ''", pharmacy_at:'INTEGER NOT NULL DEFAULT 0', pharmacy_signature_json:"TEXT NOT NULL DEFAULT ''",
    pharmacy_alerted_at:'INTEGER NOT NULL DEFAULT 0',
    sender_user_id:"TEXT NOT NULL DEFAULT ''",sender_name:"TEXT NOT NULL DEFAULT ''",sender_at:'INTEGER NOT NULL DEFAULT 0',sender_signature_json:"TEXT NOT NULL DEFAULT ''",
    receiver_user_id:"TEXT NOT NULL DEFAULT ''",receiver_name:"TEXT NOT NULL DEFAULT ''",receiver_at:'INTEGER NOT NULL DEFAULT 0',receiver_signature_json:"TEXT NOT NULL DEFAULT ''",
    revision:'INTEGER NOT NULL DEFAULT 1',rejected_at:'INTEGER NOT NULL DEFAULT 0',rejection_note:"TEXT NOT NULL DEFAULT ''",legacy_complete:'INTEGER NOT NULL DEFAULT 0',
  };
  for (const [column,definition] of Object.entries(defs)) if (!cols.includes(column)) database.sqlite.exec(`ALTER TABLE ward_medicine_approvals ADD COLUMN ${column} ${definition}`);
  if(!cols.includes('legacy_complete'))database.sqlite.exec('UPDATE ward_medicine_approvals SET legacy_complete=1 WHERE pharmacy_at>0');
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS medicine_signature_history(id INTEGER PRIMARY KEY,ward_code TEXT NOT NULL,report_date TEXT NOT NULL,action TEXT NOT NULL,actor_id TEXT NOT NULL,at INTEGER NOT NULL,snapshot_json TEXT NOT NULL,note TEXT NOT NULL DEFAULT '') STRICT;`);
  // Legacy director approvals become the director stage in the new workflow.
  database.sqlite.exec(`UPDATE ward_medicine_approvals SET director_user_id=approved_by,director_name=approved_name,director_at=approved_at
    WHERE approved_at>0 AND director_at=0`);
}

export function nextPendingMedicineDate(database,ward,date) {
  let candidate=nextDay(date);
  for (let i=0;i<366;i++) { if (!approvalFor(database,ward,candidate)) return candidate; candidate=nextDay(candidate); }
  throw new Error('Too many approved daily medicine lists.');
}

export function reviewedWardMedicineReport(database,date,ward) {
  const live=wardMedicineReport(database,date,ward);
  const approval=approvalFor(database,ward,date);
  if (approval && !approval.rejected_at && Number(approval.nurse_at||approval.director_at||approval.approved_at||0)>0) {
    const snapshot=approval.snapshot_json ? JSON.parse(approval.snapshot_json) : live;
    const status=stage(approval).status;
    return documentView({...snapshot,approval:{...approvalView(approval,database),nextDate:nextPendingMedicineDate(database,ward,date)}});
  }
  const queued=database.sqlite.prepare('SELECT patient_json,source_date FROM ward_medicine_pending WHERE ward_code=? AND report_date=? ORDER BY added_at,patient_key').all(ward,date);
  const patients=[...live.patients];
  for (const item of queued) {
    const patient=JSON.parse(item.patient_json);
    const current=patients.find(existing=>existing.patientKey===patient.patientKey);
    if (current?.medications.length) continue;
    if (current) patients.splice(patients.indexOf(current),1);
    patients.push({...patient,source:'pending-after-approval',sourceDate:item.source_date});
  }
  patients.sort((a,b)=>String(a.bedLabel).localeCompare(String(b.bedLabel),'km',{numeric:true}) || a.fullName.localeCompare(b.fullName,'km'));
  const status=stage(approval);
  return documentView({...live,patients,patientCount:patients.length,
    medicineOrderCount:patients.reduce((sum,item)=>sum+item.medications.length,0),
    matrix:buildMedicineMatrix(patients),approval:{...approvalView(approval,database),carryOverCount:queued.length,pharmacyAlertedAt:Number(approval?.pharmacy_alerted_at||0)||0}});
}

export function signWardMedicineReport(database,date,ward,role,actorId,signature={},requestedStep=0,expectedRevision=undefined,expectedFingerprint="") {
  const normalizedRole=String(role||'').toUpperCase();
  const existing=approvalFor(database,ward,date),current=stage(existing);
  const step=Number(requestedStep)||current.nextStep;
  const prefixes=['','nurse','chief','director','pharmacy','sender','receiver'];
  if(!Number.isInteger(step)||step<1||step>6)throw Error('This form is complete.');
  const allowed=step===1?['WARD_HEAD']:step===2?['CHIEF_WARD','DOCTOR']:step===3?['ADMIN','DIRECTOR','VICE_DIRECTOR']:step===6?['NURSE','MIDWIFE']:['PHARMACY'];
  if(!allowed.includes(normalizedRole))throw Error('Your role cannot sign this position.');
  if(expectedRevision!==undefined&&expectedRevision!==(existing?.revision||0))throw Object.assign(Error('This form was resubmitted. Refresh before signing.'),{status:409});
  const prefix=prefixes[step];
  if(existing?.[prefix+'_at'] && !existing.rejected_at)return reviewedWardMedicineReport(database,date,ward);
  if(step!==current.nextStep)throw Error('Complete the previous signatures first.');
  if(step<=3 && date>localDate())throw Error('Cannot sign a future daily medicine request.');
  const report=reviewedWardMedicineReport(database,date,ward);
  if(expectedFingerprint&&expectedFingerprint!==report.fingerprint)throw Object.assign(Error('Medicine orders changed. Refresh the form before signing.'),{status:409});
  if(!report.matrix.patientCount)throw Error('There are no medicine orders for this ward and date.');
  const actorName=userSignerName(database,actorId,database.sqlite.prepare('SELECT display_name FROM users WHERE id=?').get(actorId)?.display_name||'',normalizedRole);
  const now=Date.now(),sig=JSON.stringify({...signature,role:normalizedRole,step});
  if(!existing)database.sqlite.prepare("INSERT INTO ward_medicine_approvals(ward_code,report_date) VALUES(?,?)").run(ward,date);
  if(step===1 && existing?.rejected_at){database.sqlite.prepare("UPDATE ward_medicine_approvals SET revision=revision+1,nurse_at=0,chief_at=0,director_at=0,pharmacy_at=0,sender_at=0,receiver_at=0,approved_at=0,rejected_at=0,pharmacy_alerted_at=0,snapshot_json='',legacy_complete=0 WHERE ward_code=? AND report_date=?").run(ward,date);}
  // Prefixes are server constants, never client-controlled SQL names.
  database.sqlite.prepare(`UPDATE ward_medicine_approvals SET ${prefix}_user_id=?,${prefix}_name=?,${prefix}_at=?,${prefix}_signature_json=? WHERE ward_code=? AND report_date=?`).run(actorId,actorName,now,sig,ward,date);
  if(step===1)database.sqlite.prepare('UPDATE ward_medicine_approvals SET snapshot_json=? WHERE ward_code=? AND report_date=?').run(JSON.stringify(report),ward,date);
  if(step===3)database.sqlite.prepare('UPDATE ward_medicine_approvals SET approved_by=?,approved_name=?,approved_at=? WHERE ward_code=? AND report_date=?').run(actorId,actorName,now,ward,date);
  database.sqlite.prepare('INSERT INTO medicine_signature_history(ward_code,report_date,action,actor_id,at,snapshot_json,note) VALUES(?,?,?,?,?,?,?)').run(ward,date,`SIGNED_${step}`,actorId,now,JSON.stringify({...report,signature:JSON.parse(sig)}),'');
  return reviewedWardMedicineReport(database,date,ward);
}
export function rejectWardMedicineReport(database,date,ward,actorId,note,expectedRevision=undefined,expectedFingerprint=""){
  if(!String(note||'').trim())throw Error('Rejection feedback is required.');
  const row=approvalFor(database,ward,date);if(expectedRevision!==undefined&&expectedRevision!==(row?.revision||0))throw Object.assign(Error('This request was resubmitted. Refresh before rejecting it.'),{status:409});if(expectedFingerprint&&expectedFingerprint!==reviewedWardMedicineReport(database,date,ward).fingerprint)throw Object.assign(Error('This form changed. Refresh before rejecting it.'),{status:409});if(stage(row).nextStep!==3)throw Error('Only requests awaiting management approval can be rejected.');
  database.sqlite.prepare('INSERT INTO medicine_signature_history(ward_code,report_date,action,actor_id,at,snapshot_json,note) VALUES(?,?,?,?,?,?,?)').run(ward,date,'REJECTED',actorId,Date.now(),JSON.stringify(row),String(note).trim().slice(0,1000));
  database.sqlite.prepare('UPDATE ward_medicine_approvals SET rejected_at=?,rejection_note=? WHERE ward_code=? AND report_date=?').run(Date.now(),String(note).trim().slice(0,1000),ward,date);
  return reviewedWardMedicineReport(database,date,ward);
}
// Backwards-compatible function name for older callers. The endpoint now enforces the signature sequence.
export function approveWardMedicineReport(database,date,ward,actorId) {
  return signWardMedicineReport(database,date,ward,'DIRECTOR',actorId,{});
}

export function markPharmacyAlerted(database,date,ward) {
  const now=Date.now();
  database.sqlite.prepare('UPDATE ward_medicine_approvals SET pharmacy_alerted_at=? WHERE ward_code=? AND report_date=? AND pharmacy_alerted_at=0')
    .run(now,ward,date);
  return now;
}

export function queueLateWardMedicineOrder(database,patient,ward,dates) {
  let nextDate='';
  for (const sourceDate of dates) {
    const approved=approvalFor(database,ward,sourceDate);
    if (!approved || !(Number(approved.nurse_at||approved.director_at||approved.approved_at||0)>0) || approved.rejected_at) continue;
    const target=nextPendingMedicineDate(database,ward,sourceDate);
    const current=wardMedicineReport(database,sourceDate,ward).patients.find(item=>item.patientKey===patient.patient_key && item.medications.length);
    const old=approved.snapshot_json ? JSON.parse(approved.snapshot_json).patients.find(item=>item.patientKey===patient.patient_key) : null;
    if (!current || (old && JSON.stringify(old.medications)===JSON.stringify(current.medications))) {
      database.sqlite.prepare('DELETE FROM ward_medicine_pending WHERE ward_code=? AND report_date=? AND patient_key=? AND source_date=?').run(ward,target,patient.patient_key,sourceDate);
      continue;
    }
    const pending=database.sqlite.prepare('SELECT patient_json FROM ward_medicine_pending WHERE ward_code=? AND report_date=? AND patient_key=?').get(ward,target,patient.patient_key);
    if (pending?.patient_json===JSON.stringify(current)) continue;
    database.sqlite.prepare(`INSERT INTO ward_medicine_pending (ward_code,report_date,patient_key,source_date,patient_json,added_at) VALUES (?,?,?,?,?,?)
      ON CONFLICT(ward_code,report_date,patient_key) DO UPDATE SET source_date=excluded.source_date,patient_json=excluded.patient_json,added_at=excluded.added_at`)
      .run(ward,target,patient.patient_key,sourceDate,JSON.stringify(current),Date.now());
    nextDate=target;
  }
  return nextDate;
}

export function directorWardMedicineInbox(database) {
  const candidates=new Set();
  const wards=new Map(WARDS.filter(ward=>ward.code!=='opd').map(ward=>[ward.code,ward]));
  for (const patient of database.sqlite.prepare("SELECT * FROM patient_records WHERE service_mode='ipd'").all()) {
    const ward=patientWorkWard(patient); if (!wards.has(ward)) continue;
    let data; try { data=JSON.parse(patient.record_json || '{}'); } catch { continue; }
    try {
      const initial=JSON.parse(data['system:initialIpdMedications'] || '[]');
      if (Array.isArray(initial) && initial.some(item=>item?.name?.trim())) candidates.add(JSON.stringify([ward,data['scope:medical:id:ipd_first_exam_date'] || patient.entry_date]));
      const doctorOrders=JSON.parse(data['system:doctorDailyMedicineOrders'] || '[]');
      const followUps=Array.isArray(doctorOrders) && doctorOrders.length ? doctorOrders : JSON.parse(data['system:dailyMonitoringRecords'] || '[]');
      if (Array.isArray(followUps)) for (const followUp of followUps) if (Array.isArray(followUp?.medications) && followUp.medications.some(item=>item?.name?.trim()) && /^\d{4}-\d{2}-\d{2}/.test(followUp.dtVal || '')) candidates.add(JSON.stringify([ward,followUp.dtVal.slice(0,10)]));
    } catch {}
  }
  for (const row of database.sqlite.prepare('SELECT ward_code,report_date FROM ward_medicine_pending').all()) candidates.add(JSON.stringify([row.ward_code,row.report_date]));
  const items=[];
  for (const entry of candidates) {
    const [ward,date]=JSON.parse(entry);
    try {
      const report=reviewedWardMedicineReport(database,date,ward);
      if (report.approval?.status!=='chief_signed') continue;
      if (!report.matrix.patientCount) continue;
      items.push({ward,date,wardNameKh:report.wardNameKh,patientCount:report.matrix.patientCount,medicineCount:report.matrix.columns.length,carryOverCount:report.approval.carryOverCount||0,availableForApproval:date<=localDate()});
    } catch {}
  }
  return items.sort((a,b)=>a.date.localeCompare(b.date) || a.ward.localeCompare(b.ward));
}

export function wardMedicineRequestKeys(database){
  const candidates=new Set();
  const wards=new Map(WARDS.filter(ward=>ward.code!=='opd').map(ward=>[ward.code,ward]));
  for (const patient of database.sqlite.prepare("SELECT * FROM patient_records WHERE service_mode='ipd'").all()) {
    const ward=patientWorkWard(patient); if (!wards.has(ward)) continue;
    let data; try { data=JSON.parse(patient.record_json || '{}'); } catch { continue; }
    try {
      const initial=JSON.parse(data['system:initialIpdMedications'] || '[]');
      if (Array.isArray(initial) && initial.some(item=>item?.name?.trim())) candidates.add(JSON.stringify([ward,data['scope:medical:id:ipd_first_exam_date'] || patient.entry_date]));
      const doctorOrders=JSON.parse(data['system:doctorDailyMedicineOrders'] || '[]');
      const followUps=Array.isArray(doctorOrders) && doctorOrders.length ? doctorOrders : JSON.parse(data['system:dailyMonitoringRecords'] || '[]');
      if (Array.isArray(followUps)) for (const followUp of followUps) if (Array.isArray(followUp?.medications) && followUp.medications.some(item=>item?.name?.trim()) && /^\d{4}-\d{2}-\d{2}/.test(followUp.dtVal || '')) candidates.add(JSON.stringify([ward,followUp.dtVal.slice(0,10)]));
    } catch {}
  }
  for (const row of database.sqlite.prepare('SELECT ward_code,report_date FROM ward_medicine_pending').all()) candidates.add(JSON.stringify([row.ward_code,row.report_date]));
  for(const row of database.sqlite.prepare('SELECT ward_code,report_date FROM ward_medicine_approvals').all())candidates.add(JSON.stringify([row.ward_code,row.report_date]));
  return [...candidates].map(x=>{const [ward,date]=JSON.parse(x);return {ward_code:ward,report_date:date};}).filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.report_date));
}
