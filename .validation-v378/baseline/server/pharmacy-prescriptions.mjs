import crypto from 'node:crypto';
import { createStaffMessage } from './messages.mjs';
import { opdLocalDate } from './opd-queue.mjs';

export function prepareOpdPrescription(data, summary, prescriber) {
  if (summary.serviceMode !== 'opd') throw new Error('Only an OPD prescription can be submitted here.');
  if (!prescriber || prescriber.role !== 'DOCTOR' || !prescriber.userId) throw new Error('A doctor must sign this OPD prescription.');
  // The authenticated doctor's name is a valid attribution when no optional
  // signature image is configured. The snapshot still records whether an
  // actual electronic signature image was available at submission time.
  let rows;
  try { rows = JSON.parse(data['system:opdMedications'] || '[]'); } catch { throw new Error('The OPD prescription cannot be read.'); }
  if (!Array.isArray(rows) || !rows.length) throw new Error('Enter the OPD medicines before sending to Pharmacy.');
  const fields = ['name','route','unit','doseAmount','scheduleType','qHours','m','a','e','n','d','total','note',
    'effectiveAt','timingMode','protocolDose','protocolIntervals','protocolRepeatValue','protocolRepeatUnit','protocolMaxDoses','protocolStopAt'];
  const medications = rows.map(row => {
    if (!row || typeof row.name !== 'string' || !row.name.trim()) throw new Error('Every submitted medicine needs a name.');
    return Object.fromEntries(fields.map(key => [key,String(row[key] ?? '').trim()]));
  });
  return {patient:{fullName:summary.fullName,healthId:summary.healthId,caseNumber:summary.caseNumber,
    age:summary.age,sex:summary.sex,departmentNameKh:summary.departmentNameKh,entryDate:summary.entryDate},medications,prescriber};
}
export function submitOpdPrescription(database, patient, snapshot, actor) {
  // Saving again changes signedAt. Repeated submissions with identical orders
  // and the same configured doctor signature should keep the original message.
  const { patient:identity, medications, prescriber } = snapshot;
  const fingerprint = crypto.createHash('sha256').update(JSON.stringify({identity,medications,
    prescriberUserId:prescriber.userId,signatureConfiguredAt:prescriber.signatureConfiguredAt,
    signerName:prescriber.signerName,signatureDataUrl:prescriber.signatureDataUrl})).digest('hex');
  const latest = database.sqlite.prepare('SELECT * FROM pharmacy_prescriptions WHERE patient_key=? ORDER BY rowid DESC LIMIT 1').get(patient.patient_key);
  if (latest?.dispensed_at) throw new Error('ឱសថស្ថានបានបញ្ជាក់ថាអ្នកជំងឺបានទទួលឱសថរួចហើយ។ មិនអាចកែវេជ្ជបញ្ជានេះបានទេ។');
  if (latest?.fingerprint === fingerprint) return {id:latest.id,messageId:latest.message_id,duplicate:true};
  const message = createStaffMessage(database,{senderUserId:actor.userId,senderRole:actor.role,senderWardCode:actor.wardCode,
    destinationType:'PHARMACY',patientKey:patient.patient_key,
    subject:latest?'វេជ្ជបញ្ជា OPD បានកែប្រែ':'វេជ្ជបញ្ជា OPD ថ្មី',
    body:`${snapshot.patient.fullName} · ${snapshot.patient.healthId || snapshot.patient.caseNumber} · ឱសថ ${snapshot.medications.length} មុខ។ ចុចសារដើម្បីមើលវេជ្ជបញ្ជា។`});
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO pharmacy_prescriptions
    (id,message_id,patient_key,patient_version,fingerprint,submitted_by,submitted_at,snapshot_json) VALUES (?,?,?,?,?,?,?,?)`)
    .run(id,message.id,patient.patient_key,patient.version,fingerprint,actor.userId,Date.now(),JSON.stringify(snapshot));
  return {id,messageId:message.id,duplicate:false};
}
export function prescriptionForMessage(database,messageId) {
  const row=database.sqlite.prepare('SELECT * FROM pharmacy_prescriptions WHERE message_id=?').get(messageId);
  if (!row) return null;
  const latest=database.sqlite.prepare('SELECT id FROM pharmacy_prescriptions WHERE patient_key=? ORDER BY rowid DESC LIMIT 1').get(row.patient_key);
  return {id:row.id,patientVersion:row.patient_version,submittedAt:row.submitted_at,
    dispensedAt:row.dispensed_at || null,
    superseded:latest.id!==row.id,...JSON.parse(row.snapshot_json)};
}

export function listOpdPrescriptions(database) {
  const rows=database.sqlite.prepare(`SELECT r.id,r.patient_key,r.submitted_at,r.dispensed_at,
    u.display_name AS dispensed_by_name,r.snapshot_json
    FROM pharmacy_prescriptions r LEFT JOIN users u ON u.id=r.dispensed_by
    WHERE r.rowid=(SELECT MAX(newer.rowid) FROM pharmacy_prescriptions newer WHERE newer.patient_key=r.patient_key)
    ORDER BY (r.dispensed_at IS NOT NULL),r.submitted_at DESC`).all();
  return rows.map(row=>{
    const snapshot=JSON.parse(row.snapshot_json);
    return {id:row.id,patientKey:row.patient_key,patient:snapshot.patient,medicineCount:snapshot.medications.length,
      doctorName:snapshot.prescriber?.signerName || snapshot.prescriber?.displayName || '',
      submittedAt:row.submitted_at,dispensedAt:row.dispensed_at || null,dispensedByName:row.dispensed_by_name || ''};
  });
}

export function opdPrescriptionForPharmacy(database,id) {
  const row=database.sqlite.prepare('SELECT * FROM pharmacy_prescriptions WHERE id=?').get(id);
  if (!row) return null;
  const latest=database.sqlite.prepare('SELECT id FROM pharmacy_prescriptions WHERE patient_key=? ORDER BY rowid DESC LIMIT 1').get(row.patient_key);
  const dispenser=row.dispensed_by ? database.sqlite.prepare('SELECT display_name FROM users WHERE id=?').get(row.dispensed_by) : null;
  return {id:row.id,patientKey:row.patient_key,submittedAt:row.submitted_at,
    dispensedAt:row.dispensed_at || null,dispensedByName:dispenser?.display_name || '',
    superseded:latest?.id !== row.id,...JSON.parse(row.snapshot_json)};
}

export function markOpdPrescriptionReceived(database,id,userId,now=Date.now()) {
  const latest=database.sqlite.prepare(`SELECT r.id,r.dispensed_at FROM pharmacy_prescriptions r
    WHERE r.patient_key=(SELECT patient_key FROM pharmacy_prescriptions WHERE id=?) ORDER BY r.rowid DESC LIMIT 1`).get(id);
  if (!latest) throw new Error('Prescription was not found.');
  if (latest.id !== id) throw new Error('A newer prescription exists. Open the current prescription before confirming receipt.');
  database.sqlite.exec('SAVEPOINT opd_receipt');
  try {
    if (!latest.dispensed_at) database.sqlite.prepare('UPDATE pharmacy_prescriptions SET dispensed_at=?,dispensed_by=? WHERE id=? AND dispensed_at IS NULL')
      .run(now,userId,id);
    const receipt=database.sqlite.prepare('SELECT * FROM pharmacy_prescriptions WHERE id=?').get(id);
    recordOpdDischarge(database,receipt);
    database.sqlite.exec('RELEASE opd_receipt');
    return opdPrescriptionForPharmacy(database,id);
  } catch(error) {
    database.sqlite.exec('ROLLBACK TO opd_receipt');database.sqlite.exec('RELEASE opd_receipt');throw error;
  }
}

function recordOpdDischarge(database,receipt) {
  const patient=database.findPatient(receipt.patient_key);
  // An older OPD prescription must never discharge someone transferred to IPD.
  if (!patient || patient.service_mode !== 'opd' || !receipt.dispensed_at) return;
  const data=JSON.parse(patient.record_json || '{}');
  if (data['system:opdDischarge']?.prescriptionId === receipt.id && patient.discharge_date) return;
  const date=opdLocalDate(receipt.dispensed_at);
  data['system:opdDischarge']={source:'PHARMACY',prescriptionId:receipt.id,
    dispensedAt:receipt.dispensed_at,dispensedBy:receipt.dispensed_by,dischargeDate:date};
  data['system:workflowStage']='OPD_DISCHARGED';
  database.sqlite.prepare(`UPDATE patient_records SET discharge_date=?,record_json=?,version=version+1,
    updated_by=?,updated_at=? WHERE patient_key=? AND service_mode='opd'`)
    .run(date,JSON.stringify(data),receipt.dispensed_by || receipt.submitted_by,Date.now(),receipt.patient_key);
}

export function ensureOpdReceiptDischarges(database) {
  const receipts=database.sqlite.prepare(`SELECT r.* FROM pharmacy_prescriptions r
    JOIN patient_records p ON p.patient_key=r.patient_key AND p.service_mode='opd'
    WHERE r.dispensed_at IS NOT NULL AND r.rowid=(SELECT MAX(n.rowid) FROM pharmacy_prescriptions n WHERE n.patient_key=r.patient_key)`).all();
  receipts.forEach(receipt=>recordOpdDischarge(database,receipt));
}
