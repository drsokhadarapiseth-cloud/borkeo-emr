import { WARDS } from './access.mjs';
import { buildMedicineMatrix } from './ward-medicine-matrix.mjs';
import { pmrs2Icd10 } from './pmrs2-mapping.mjs';

const inpatientWards = WARDS.filter(item => item.code !== 'opd');

function diagnosisCodes(primary, diagnoses) {
  const rows = arrayFromJson(diagnoses);
  const entries = [primary || rows[0]?.icd10, ...rows.slice(1).map(item => item?.icd10)];
  return [...new Set(entries.map(pmrs2Icd10).filter(Boolean))].join(', ');
}

function validDate(value) {
  const date = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid report date.');
  const [year, month, day] = date.split('-').map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid report date.');
  }
  return { date, end: new Date(year, month - 1, day + 1).getTime() };
}

function arrayFromJson(value) {
  if (!value) return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function objectFromJson(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value || '{}') : value;
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch { return {}; }
}

function sameDay(value, date) {
  return typeof value === 'string' && value.startsWith(date) &&
    (value.length === 10 || /^[T ]\d{2}:\d{2}/.test(value.slice(10)));
}

export function ordersForDate(data, entryDate, date) {
  // Daily IPD drug orders are copied by the server only from a doctor's save.
  // Nursing edits cannot alter this source, so the pharmacy sees the doctor's order.
  const doctorOrders = arrayFromJson(data['system:doctorDailyMedicineOrders'])
    .filter(item => item && sameDay(item.dtVal, date))
    .sort((left, right) => String(left.dtVal).localeCompare(String(right.dtVal)));
  const legacyFollowUps = arrayFromJson(data['system:dailyMonitoringRecords'])
    .filter(item => item && sameDay(item.dtVal, date))
    .sort((left, right) => String(left.dtVal).localeCompare(String(right.dtVal)));
  const latest = doctorOrders.at(-1) || legacyFollowUps.at(-1);
  const source = doctorOrders.length ? 'doctor-follow-up' : (legacyFollowUps.length ? 'legacy-follow-up' : 'missing');
  // The registration date can precede the first doctor's treatment order.
  const examinationDate = String(data['scope:medical:id:ipd_first_exam_date'] || '');
  const initialOrderDate = /^\d{4}-\d{2}-\d{2}$/.test(examinationDate) ? examinationDate : entryDate;
  const admissionSource = initialOrderDate === date ? data['system:initialIpdMedications'] : [];
  const finalSource = latest ? latest.medications : admissionSource;
  const finalType = latest ? source : (initialOrderDate === date ? 'admission' : 'missing');
  const raw = finalSource;
  const medications = arrayFromJson(raw).filter(med => med && typeof med.name === 'string' && med.name.trim())
    .map(med => ({
      name:med.name.trim().slice(0, 240), route:String(med.route || '').slice(0, 40),
      unit:String(med.unit || '').slice(0, 40), doseAmount:String(med.doseAmount || '').slice(0, 24),
      scheduleType:String(med.scheduleType || '').slice(0, 40),
      m:String(med.m ?? '').slice(0, 24), a:String(med.a ?? '').slice(0, 24),
      e:String(med.e ?? '').slice(0, 24), n:String(med.n ?? '').slice(0, 24),
      days:String(med.d || '').slice(0, 24),
      total:String(med.total ?? '').slice(0, 40),
    }));
  return { source:finalType, medications, icd10:diagnosisCodes(latest?.icd10 || latest?.diagnoses?.[0]?.icd10, latest?.diagnoses), conclusion:String(latest?.conclusion || '').trim().slice(0, 500) };
}

export function wardMedicineReport(database, dateValue, wardValue) {
  const { date, end } = validDate(dateValue);
  const wardCode = String(wardValue || '').toLowerCase();
  const ward = inpatientWards.find(item => item.code === wardCode);
  if (!ward) throw new Error('Choose an inpatient ward.');
  const events = database.sqlite.prepare(`SELECT patient_key,event_type,to_ward_code,to_department_code,details_json
    FROM patient_movement_events WHERE event_at<? ORDER BY event_at,id`).all(end);
  const placements = new Map();
  for (const event of events) {
    if (event.event_type === 'ADMISSION') {
      placements.set(event.patient_key, {
        wardCode:String(event.to_ward_code || event.to_department_code || '').toLowerCase(),bedLabel:'',roomId:'',
      });
    } else if (event.event_type === 'BED_ASSIGN') {
      const details = objectFromJson(event.details_json);
      placements.set(event.patient_key, {
        wardCode:String(event.to_ward_code || event.to_department_code || '').toLowerCase(),
        bedLabel:String(details.bedLabel || '').slice(0, 80),roomId:String(details.roomId || '').slice(0, 80),
      });
    } else if (['INTERNAL_TRANSFER','DISCHARGE','EXTERNAL_TRANSFER'].includes(event.event_type)) {
      placements.delete(event.patient_key);
    }
  }
  const patients=[];
  for (const [patientKey, placement] of placements) {
    if (placement.wardCode !== wardCode) continue;
    const row=database.findPatient(patientKey);
    if (!row || row.service_mode !== 'ipd') continue;
    const data=objectFromJson(row.record_json);
    const treatment=ordersForDate(data,row.entry_date,date);
    const bedLabel=placement.bedLabel ||
      (placement.roomId && placement.roomId === data['system:currentRoomId']
        ? String(data['system:currentBedLabel'] || '') : '');
    patients.push({
      patientKey,caseNumber:row.case_number || '',fullName:row.full_name || row.case_number || '',
      bedLabel,roomName:placement.roomId === data['system:currentRoomId']
        ? String(data['system:currentRoomNameKh'] || '') : '',
      diagnosis:treatment.icd10 || diagnosisCodes(data['scope:medical:id:emr_pmrs_ipd_icd10'] ?? data['id:emr_pmrs_ipd_icd10'], data['scope:medical:id:emr_ipd_diagnoses']),
      source:treatment.source,medications:treatment.medications,
    });
  }
  patients.sort((left,right) => String(left.bedLabel).localeCompare(String(right.bedLabel),'km',{numeric:true}) ||
    left.fullName.localeCompare(right.fullName,'km'));
  return {
    date,wardCode,wardNameKh:ward.nameKh,patientCount:patients.length,
    medicineOrderCount:patients.reduce((sum,item)=>sum+item.medications.length,0),patients,
    matrix:buildMedicineMatrix(patients),
  };
}

export function medicineReportWards(role,activeWardCode) {
  if (['ADMIN','VICE_DIRECTOR','PHARMACY','DIRECTOR'].includes(String(role || ''))) return inpatientWards;
  return inpatientWards.filter(item => item.code === activeWardCode);
}
