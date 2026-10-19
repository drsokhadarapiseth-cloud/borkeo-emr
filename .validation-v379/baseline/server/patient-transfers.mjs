// Administration sees patient handoffs separately from messages addressed to staff.
// These entries reuse the recorded triage and movement data; reading the list
// never creates another transfer or changes a patient's ward assignment.
export function recentPatientTransfers(database) {
  const sqlite=database.sqlite;
  const opd=sqlite.prepare(`SELECT q.id,p.patient_key AS patientKey,p.full_name AS fullName,
      q.referred_at AS at,'TRIAGE_REFERRAL' AS eventType,'' AS fromWard,'opd' AS toWard,
      q.queue_number AS queueNumber
    FROM opd_queue_entries q JOIN patient_records p ON p.patient_key=q.patient_key
    ORDER BY q.referred_at DESC LIMIT 100`).all();
  const inpatient=sqlite.prepare(`SELECT p.patient_key AS patientKey,p.full_name AS fullName,
      json_extract(p.record_json,'$."system:triageCompletedAt"') AS at,
      json_extract(p.record_json,'$."system:triageReferredWardCode"') AS toWard
    FROM patient_records p
    WHERE p.service_mode='ipd' AND json_valid(p.record_json)
      AND json_extract(p.record_json,'$."system:triageStatus"')='COMPLETED'
    ORDER BY at DESC LIMIT 100`).all().filter(row=>Number(row.at)>0).map(row=>({
      ...row,id:`triage:${row.patientKey}`,eventType:'TRIAGE_REFERRAL',fromWard:'',queueNumber:null,
    }));
  const movements=sqlite.prepare(`SELECT m.id,m.patient_key AS patientKey,p.full_name AS fullName,
      m.event_at AS at,m.event_type AS eventType,m.from_ward_code AS fromWard,
      m.to_ward_code AS toWard
    FROM patient_movement_events m JOIN patient_records p ON p.patient_key=m.patient_key
    WHERE m.event_type IN ('INTERNAL_TRANSFER','EXTERNAL_TRANSFER')
    ORDER BY m.event_at DESC LIMIT 100`).all();
  return [...opd,...inpatient,...movements].sort((a,b)=>b.at-a.at || b.id.localeCompare(a.id)).slice(0,100);
}
