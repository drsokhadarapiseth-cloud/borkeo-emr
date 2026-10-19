import crypto from 'node:crypto';
import { WARDS } from './access.mjs';

export function opdLocalDate(timestamp = Date.now()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone:'Asia/Phnom_Penh', year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date(timestamp));
}

export function ensureOpdQueueSchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS opd_queue_entries (
    id TEXT PRIMARY KEY,
    patient_key TEXT NOT NULL UNIQUE,
    queue_date TEXT NOT NULL,
    queue_number INTEGER NOT NULL CHECK(queue_number > 0),
    status TEXT NOT NULL CHECK(status IN ('WAITING','IN_CONSULTATION','SENT_TO_PHARMACY','RECEIVED')),
    referred_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(queue_date,queue_number)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS opd_queue_date_status ON opd_queue_entries(queue_date,status,queue_number);`);
  // Earlier triaged OPD patients should appear in the queue after upgrading.
  // Backfill in referral order without sending duplicate alerts.
  const older = database.sqlite.prepare(`SELECT patient_key,record_json,created_at FROM patient_records
    WHERE service_mode='opd' AND patient_key NOT IN (SELECT patient_key FROM opd_queue_entries)
    ORDER BY created_at,patient_key`).all();
  const insert = database.sqlite.prepare(`INSERT OR IGNORE INTO opd_queue_entries
    (id,patient_key,queue_date,queue_number,status,referred_at,updated_at) VALUES (?,?,?,?,?,?,?)`);
  for (const row of older) {
    let data={}; try { data=JSON.parse(row.record_json); } catch {}
    if (data['system:triageStatus'] !== 'COMPLETED') continue;
    const at=Number(data['system:triageCompletedAt']) || row.created_at;
    const date=opdLocalDate(at);
    let next=Number(data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || 0);
    if (!Number.isInteger(next) || next < 1) next=database.sqlite.prepare('SELECT COALESCE(MAX(queue_number),0)+1 AS number FROM opd_queue_entries WHERE queue_date=?').get(date).number;
    else if (database.sqlite.prepare('SELECT patient_key FROM opd_queue_entries WHERE queue_date=? AND queue_number=?').get(date,next)) next=database.sqlite.prepare('SELECT COALESCE(MAX(queue_number),0)+1 AS number FROM opd_queue_entries WHERE queue_date=?').get(date).number;
    const dispensed=database.sqlite.prepare('SELECT dispensed_at FROM pharmacy_prescriptions WHERE patient_key=? ORDER BY rowid DESC LIMIT 1').get(row.patient_key);
    const status=dispensed ? dispensed.dispensed_at ? 'RECEIVED' : 'SENT_TO_PHARMACY' : 'WAITING';
    insert.run(crypto.randomUUID(),row.patient_key,date,next,status,at,at);
  }
}

export function referToOpd(database, patientKey, now = Date.now()) {
  const existing=database.sqlite.prepare('SELECT * FROM opd_queue_entries WHERE patient_key=?').get(patientKey);
  if (existing) return {entry:existing,created:false};
  const date=opdLocalDate(now);
  let number=0;
  const patient=database.findPatient(patientKey);
  try {
    const data=JSON.parse(patient?.record_json || '{}');
    number=Number(data['system:registrationQueueNumber'] || data['scope:registration:id:registration_queue_number'] || 0);
  } catch {}
  if (!Number.isInteger(number) || number < 1) {
    number=database.sqlite.prepare('SELECT COALESCE(MAX(queue_number),0)+1 AS number FROM opd_queue_entries WHERE queue_date=?').get(date).number;
  } else {
    const duplicate=database.sqlite.prepare('SELECT patient_key FROM opd_queue_entries WHERE queue_date=? AND queue_number=?').get(date,number);
    if (duplicate) throw new Error(`Queue number ${number} is already in use for OPD today.`);
  }
  database.sqlite.prepare(`INSERT INTO opd_queue_entries
    (id,patient_key,queue_date,queue_number,status,referred_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
    .run(crypto.randomUUID(),patientKey,date,number,'WAITING',now,now);
  return {entry:getOpdQueueEntry(database,patientKey),created:true};
}

export function getOpdQueueEntry(database, patientKey) {
  const row=database.sqlite.prepare('SELECT * FROM opd_queue_entries WHERE patient_key=?').get(patientKey);
  return row ? {patientKey:row.patient_key,date:row.queue_date,number:row.queue_number,status:row.status,
    referredAt:row.referred_at,updatedAt:row.updated_at} : null;
}

export function updateOpdQueueStatus(database, patientKey, status, now = Date.now()) {
  const allowed={IN_CONSULTATION:['WAITING'],SENT_TO_PHARMACY:['WAITING','IN_CONSULTATION','RECEIVED'],RECEIVED:['SENT_TO_PHARMACY']};
  if (!allowed[status]) throw new Error('OPD queue status is invalid.');
  const previous=allowed[status];
  database.sqlite.prepare(`UPDATE opd_queue_entries SET status=?,updated_at=?
    WHERE patient_key=? AND status IN (${previous.map(()=>'?').join(',')})`)
    .run(status,now,patientKey,...previous);
  return getOpdQueueEntry(database,patientKey);
}

export function listOpdQueue(database, date = opdLocalDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid OPD queue date.');
  return database.sqlite.prepare(`SELECT q.patient_key AS patientKey,q.queue_date AS date,q.queue_number AS number,
    q.status,q.referred_at AS referredAt,q.updated_at AS updatedAt,
    p.full_name AS fullName,p.health_id AS healthId,p.case_number AS caseNumber,
    p.sex,p.age,p.phone,p.equity_card AS equityCard,p.payment_type AS paymentType,p.service_mode AS serviceMode,p.department_code AS departmentCode,p.department_name_kh AS departmentNameKh,p.record_json
    FROM opd_queue_entries q JOIN patient_records p ON p.patient_key=q.patient_key
    WHERE q.queue_date=? ORDER BY q.queue_number`).all(date).map(row=>{
      let data={}; try { data=JSON.parse(row.record_json||'{}'); } catch {}
      return {
        patientKey:row.patientKey,date:row.date,number:row.number,status:row.status,referredAt:row.referredAt,updatedAt:row.updatedAt,
        fullName:row.fullName,healthId:row.healthId,caseNumber:row.caseNumber,sex:row.sex,age:row.age,phone:row.phone,equityCard:row.equityCard,paymentType:row.paymentType,serviceMode:row.serviceMode,departmentCode:row.departmentCode,departmentNameKh:row.departmentNameKh,
        workflowStage:String(data['system:workflowStage']||''),
        triageParaclinic:data['system:triageParaclinic']===true || data['system:triageParaclinic']==='true',
        transferredToIpdAt:Number(data['system:opdTransferredToIpdAt']||0),
        transferredToIpdWardCode:String(data['system:opdTransferredToIpdWardCode']||''),
        transferredToIpdWardNameKh:WARDS.find(ward=>ward.code===data['system:opdTransferredToIpdWardCode'])?.nameKh||'',
      };
    });
}
