function parseJson(value) {
  try { return JSON.parse(value || '{}'); } catch { return {}; }
}

export function ensurePharmacyDischargeSchema(database) {
  database.sqlite.exec(`CREATE TABLE IF NOT EXISTS pharmacy_discharge_dispensing (
    patient_key TEXT NOT NULL,
    discharge_at TEXT NOT NULL,
    dispensed_at INTEGER NOT NULL,
    dispensed_by TEXT NOT NULL REFERENCES users(id),
    PRIMARY KEY(patient_key, discharge_at)
  ) STRICT;
  CREATE INDEX IF NOT EXISTS pharmacy_discharge_dispensing_date_idx
    ON pharmacy_discharge_dispensing(dispensed_at DESC);`);
}

function medicationRows(discharge) {
  return Array.isArray(discharge?.medications)
    ? discharge.medications.filter(medication => medication && String(medication.name || '').trim())
    : [];
}

export function listDischargeMedicationOrders(database) {
  const rows=database.sqlite.prepare(`SELECT patient_key,case_number,health_id,full_name,sex,age,
      discharge_date,record_json,updated_at
    FROM patient_records WHERE LOWER(service_mode)='ipd' AND discharge_date IS NOT NULL
    ORDER BY discharge_date DESC,updated_at DESC`).all();
  return rows.flatMap(row=>{
    const data=parseJson(row.record_json);
    const discharge=data['system:discharge'];
    if(data['system:admissionStatus']!=='discharged'||!discharge||typeof discharge!=='object')return [];
    const medications=medicationRows(discharge);
    if(!medications.length)return [];
    const dischargeAt=String(discharge.dischargeAt||row.discharge_date||'');
    if(!dischargeAt)return [];
    const receipt=database.sqlite.prepare(`SELECT d.dispensed_at,u.display_name
      FROM pharmacy_discharge_dispensing d LEFT JOIN users u ON u.id=d.dispensed_by
      WHERE d.patient_key=? AND d.discharge_at=?`).get(row.patient_key,dischargeAt);
    const registrationQueueNumber=Number(data['system:registrationQueueNumber']||data['scope:registration:id:registration_queue_number']||0)||null;
    return [{patientKey:row.patient_key,caseNumber:row.case_number,healthId:row.health_id,fullName:row.full_name,
      sex:row.sex,age:row.age,registrationQueueNumber,dischargeDate:row.discharge_date,dischargeAt,
      departmentNameKh:discharge.department||'',medications,medicineCount:medications.length,
      dispensedAt:receipt?.dispensed_at||null,dispensedByName:receipt?.display_name||''}];
  });
}

export function markDischargeMedicationReceived(database,{patientKey,dischargeAt,userId,now=Date.now()}) {
  const row=database.sqlite.prepare(`SELECT discharge_date,record_json FROM patient_records
    WHERE patient_key=? AND LOWER(service_mode)='ipd'`).get(patientKey);
  if(!row)throw new Error('IPD patient was not found.');
  const data=parseJson(row.record_json);
  const discharge=data['system:discharge'];
  if(data['system:admissionStatus']!=='discharged'||!discharge||typeof discharge!=='object')
    throw new Error('The IPD discharge has not been completed.');
  const currentDischargeAt=String(discharge.dischargeAt||row.discharge_date||'');
  if(!currentDischargeAt||currentDischargeAt!==String(dischargeAt||''))
    throw new Error('This discharge record has changed. Refresh the list and try again.');
  if(!medicationRows(discharge).length)throw new Error('No discharge medicines are listed for this patient.');
  database.sqlite.prepare(`INSERT OR IGNORE INTO pharmacy_discharge_dispensing
    (patient_key,discharge_at,dispensed_at,dispensed_by) VALUES (?,?,?,?)`).run(patientKey,currentDischargeAt,now,userId);
  return listDischargeMedicationOrders(database).find(item=>item.patientKey===patientKey&&item.dischargeAt===currentDischargeAt);
}
