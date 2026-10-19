// PMRS2 field preparation. This module never signs in or writes to PMRS2.
// The target UI must verify the patient and the exact ICD-10 choice before saving.
import { summarizeClinicalExamination } from '../public/pmrs2-exam-normal.js';
const gynecologyCodes = new Set([
  'gyneco-obstetric', 'gynecology', 'obstetric', 'anc', 'pnc',
  'family-planning', 'spacing', 'cervix-screening', 'cervix',
  'abortion', 'misabortion', 'miscarriage', 'safe-abortion', 'safe',
]);

const gynecologyNames = new Set([
  'ផ្នែករោគស្ត្រី និងសម្ភព', 'ផ្នែកសម្ភព និងរោគស្ត្រី',
  'ពិនិត្យផ្ទៃពោះ', 'ថែទាំក្រោយសម្រាល', 'ផែនការគ្រួសារ',
  'រំលូតកូនដោយសុវត្ថិភាព', 'ពិនិត្យមហារីកមាត់ស្បូន',
]);

function string(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function field(data, id, scope) {
  return string(data[`scope:${scope}:id:${id}`] ?? data[`id:${id}`]);
}

function records(data, key) {
  try {
    const value = JSON.parse(data[key] || '[]');
    return Array.isArray(value) ? value.slice(0, 500) : [];
  } catch { return []; }
}

function dateTime(raw) {
  const value = string(raw).replace(' ', 'T');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return '';
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value.slice(0, 10)) return '';
  const hours = Number(value.slice(11, 13));
  const minutes = Number(value.slice(14, 16));
  const seconds = value.length > 16 ? Number(value.slice(17, 19)) : 0;
  return hours < 24 && minutes < 60 && seconds < 60 ? value : '';
}

function vital(value) {
  const text = string(value);
  return text === '-' ? '' : text;
}

const countUnits = new Set(['គ្រាប់', 'អំពូល', 'កាប់ស៊ុល']);
const pmrsRoutes = {
  po: 'លេប', topical: 'លាប', drops: 'បន្តក់', inhaled: 'ស្រូប',
  other_iv: 'ចាក់តាមសរសៃ', antibiotic_iv: 'ចាក់តាមសរសៃ', iv_fluid: 'ចាក់តាមសរសៃ',
  other_im: 'ចាក់សាច់ដុំ', antibiotic_im: 'ចាក់សាច់ដុំ',
  subcutaneous: 'ចាក់ក្រោមស្បែក',
};
const routeAliases = {
  'លេប': 'po', 'លាប': 'topical', 'បន្តក់': 'drops', 'ស្រូប': 'inhaled',
  'iv': 'other_iv', 'im': 'other_im', 'sc': 'subcutaneous',
  'ចាក់តាមសរសៃ': 'other_iv', 'ចាក់តាមសរសៃឈាម': 'other_iv',
  'ចាក់សាច់ដុំ': 'other_im', 'ចាក់ក្រោមស្បែក': 'subcutaneous',
};

export function pmrs2Route(value) {
  const raw = string(value);
  // An unspecific "ចាក់" must never become IM or IV by guesswork.
  return pmrsRoutes[routeAliases[raw.toLowerCase()] || raw.toLowerCase()] || '';
}
const scheduledSlots = {
  qd_m: ['morning'], qd_a: ['afternoon'], qd_e: ['evening'], qd_n: ['night'],
  bid: ['morning', 'evening'], tid: ['morning', 'afternoon', 'evening'],
  qid: ['morning', 'afternoon', 'evening', 'night'],
};

function pmrs2Medication(order) {
  const legacy = ['m', 'a', 'e', 'n'].map(key => string(order?.[key]));
  const inferredFrequency = legacy.filter(value => Number(value) > 0).length;
  const scheduleType = string(order?.scheduleType).toLowerCase() ||
    ({ 2: 'bid', 3: 'tid', 4: 'qid' }[inferredFrequency] || '');
  const unit = string(order?.unit);
  const doseAmount = string(order?.doseAmount);
  const warnings = [];
  const slots = { morning: '', afternoon: '', evening: '', night: '' };
  if (!countUnits.has(unit)) warnings.push('MEDICATION_UNIT_REVIEW');
  const route = string(order?.route);
  const pmrsRoute = pmrs2Route(route);
  if (!pmrsRoute) warnings.push('MEDICATION_ROUTE_REVIEW');
  if (order?.timingMode === 'protocol' || scheduleType === 'protocol' || scheduleType === 'qh') {
    warnings.push('MEDICATION_TIMING_REVIEW');
  } else {
    const selectedSlots = scheduledSlots[scheduleType];
    if (!selectedSlots) warnings.push('MEDICATION_SCHEDULE_REVIEW');
    else if (countUnits.has(unit)) {
      // PMRS2 columns describe the number of tablets/ampoules per administration,
      // never the strength printed on the package (for example 500 mg).
      const perDose = /^(?:\d+\.?\d*|\.\d+)$/.test(doseAmount) && Number(doseAmount) > 0
        ? doseAmount : legacy.find(value => Number(value) > 0 && /^(?:\d+\.?\d*|\.\d+)$/.test(value));
      if (!perDose) warnings.push('MEDICATION_DOSE_REVIEW');
      else for (const slot of Object.keys(slots)) slots[slot] = selectedSlots.includes(slot) ? perDose : '0';
      for (const [legacy, slot] of [['m', 'morning'], ['a', 'afternoon'], ['e', 'evening'], ['n', 'night']]) {
        const actual = string(order?.[legacy]);
        if (actual && /^(?:\d+\.?\d*|\.\d+)$/.test(actual)) {
          if (perDose && Number(actual) !== Number(slots[slot])) warnings.push('MEDICATION_DOSE_CONFLICT');
          slots[slot] = actual;
        }
      }
    }
  }
  if (!string(order?.name)) warnings.push('MEDICATION_NAME_REQUIRED');
  return {
    name: string(order?.name), route, pmrsRoute, unit, scheduleType,
    doseAmount, ...slots, days: string(order?.d), quantity: string(order?.total),
    note: string(order?.note), effectiveAt: string(order?.effectiveAt),
    protocolIntervals: string(order?.protocolIntervals), warnings: [...new Set(warnings)],
  };
}

function latestDailyRecord(data) {
  return records(data, 'system:dailyMonitoringRecords')
    .filter(record => record && dateTime(record.dtVal))
    .sort((a, b) => dateTime(a.dtVal).localeCompare(dateTime(b.dtVal))).at(-1) || null;
}

function dischargeRecord(patient) {
  const data = patient.data && typeof patient.data === 'object' ? patient.data : {};
  const saved = patient.discharge || data['system:discharge'];
  return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : null;
}

export function pmrs2Prescription(patient) {
  const data = patient.data && typeof patient.data === 'object' ? patient.data : {};
  const mode = string(patient.serviceMode).toLowerCase();
  if (mode === 'opd') {
    const medications = records(data, 'system:opdMedications').map(pmrs2Medication);
    return {
      source: 'opd', sourceDateTime: '', medications,
      counselling: field(data, 'web_rx_counsel_note', 'medical'),
      followUpDate: field(data, 'web_opd_followup', 'medical'),
      warnings: [...(medications.length ? [] : ['PRESCRIPTION_EMPTY_REVIEW']),
        ...(medications.some(med => med.warnings.length) ? ['PRESCRIPTION_MEDICATION_REVIEW'] : [])],
    };
  }
  if (mode !== 'ipd') return null;
  const latest = latestDailyRecord(data);
  const discharge = dischargeRecord(patient);
  // Once the doctor saves an edited discharge prescription, keep that exact
  // prescription; otherwise show only the latest dated follow-up's medicines.
  const savedMedications = discharge && Array.isArray(discharge.medications) ? discharge.medications : null;
  const medications = (savedMedications || (Array.isArray(latest?.medications) ? latest.medications : []))
    .map(pmrs2Medication);
  return {
    source: savedMedications ? 'discharge' : 'last-follow-up',
    sourceDateTime: latest ? dateTime(latest.dtVal) : '', medications,
    warnings: [...(latest ? [] : ['LAST_FOLLOW_UP_REQUIRED']),
      ...(medications.length ? [] : ['PRESCRIPTION_EMPTY_REVIEW']),
      ...(medications.some(med => med.warnings.length) ? ['PRESCRIPTION_MEDICATION_REVIEW'] : [])],
  };
}

export function pmrs2Discharge(patient) {
  if (string(patient.serviceMode).toLowerCase() !== 'ipd') return null;
  const data = patient.data && typeof patient.data === 'object' ? patient.data : {};
  const saved = dischargeRecord(patient);
  const admissionDay = string(patient.entryDate) || field(data, 'web_date', 'registration');
  const admissionTime = field(data, 'web_time', 'registration');
  const admissionAt = dateTime(saved?.admissionAt) ||
    dateTime(admissionDay && admissionTime ? `${admissionDay}T${admissionTime}` : '');
  const dischargeAt = dateTime(saved?.dischargeAt);
  const admissionDiagnosis = string(saved?.admissionDiagnosis) || field(data, 'emr_pmrs_ipd_diagnosis', 'medical');
  const admissionIcd10 = pmrs2Icd10(saved?.admissionIcd10) || pmrs2Icd10(field(data, 'emr_pmrs_ipd_icd10', 'medical'));
  const outcomeLabels = { recovered: 'ជាសះស្បើយ', improved: 'ធូរស្រាល', unchanged: 'មិនធូរស្រាល', referred: 'បញ្ជូនបន្ត', died: 'ស្លាប់' };
  const statusLabels = { ordered: 'បញ្ចេញតាមការបញ្ជារបស់គ្រូពេទ្យ', 'against-advice': 'ចេញផ្ទុយពីការណែនាំ', absconded: 'ចេញដោយមិនបានជូនដំណឹង', referred: 'បញ្ជូនបន្ត', died: 'ស្លាប់' };
  const outcomeCode = string(saved?.outcome);
  const statusCode = string(saved?.status);
  const warnings = [];
  if (!saved) warnings.push('DISCHARGE_NOT_SAVED');
  if (!admissionAt) warnings.push('DISCHARGE_ADMISSION_TIME_REQUIRED');
  if (!admissionIcd10) warnings.push('DISCHARGE_ADMISSION_ICD10_REQUIRED');
  if (!dischargeAt) warnings.push('DISCHARGE_DATE_TIME_REQUIRED');
  if (admissionAt && dischargeAt && dischargeAt < admissionAt) warnings.push('DISCHARGE_BEFORE_ADMISSION_REVIEW');
  if (!string(saved?.dischargeDiagnosis)) warnings.push('DISCHARGE_DIAGNOSIS_REQUIRED');
  if (!pmrs2Icd10(saved?.dischargeIcd10)) warnings.push('DISCHARGE_ICD10_REQUIRED');
  if (!outcomeLabels[outcomeCode]) warnings.push('DISCHARGE_OUTCOME_REVIEW');
  if (!statusLabels[statusCode]) warnings.push('DISCHARGE_STATUS_REVIEW');
  if (saved && (outcomeCode === 'died') !== (saved.deceased === true)) {
    warnings.push('DISCHARGE_DECEASED_CONFLICT');
  }
  return {
    admissionWard: pmrs2Ward(patient),
    dischargeWard: string(saved?.department) === string(patient.departmentNameKh) ||
      string(saved?.department) === string(patient.departmentNameEn)
      ? pmrs2Ward(patient) : string(saved?.department) || pmrs2Ward(patient),
    admissionAt, admissionDiagnosis, admissionIcd10,
    dischargeAt, dischargeDiagnosis: string(saved?.dischargeDiagnosis),
    dischargeIcd10: pmrs2Icd10(saved?.dischargeIcd10),
    outcomeCode, outcome: outcomeLabels[outcomeCode] || outcomeCode,
    statusCode, status: statusLabels[statusCode] || statusCode,
    followUpDate: string(saved?.followUpDate), deceased: saved?.deceased === true,
    referralDestination: string(saved?.referralDestinationName), warnings,
  };
}

function followUp(source, rawDateTime, values, medications, evolution, conclusion) {
  const normalizedDateTime = dateTime(rawDateTime);
  const vitals = {
    temperature: vital(values.temp), systolic: vital(values.bp_sys),
    diastolic: vital(values.bp_dia), pulse: vital(values.pulse),
    respiratoryRate: vital(values.resp), oxygenSaturation: vital(values.spo2),
  };
  const warnings = [];
  if (!normalizedDateTime) warnings.push('FOLLOW_UP_DATE_TIME_REQUIRED');
  if (Object.values(vitals).some(value => !value)) warnings.push('FOLLOW_UP_VITALS_INCOMPLETE');
  if (!evolution) warnings.push('FOLLOW_UP_EVOLUTION_REQUIRED');
  if (!conclusion) warnings.push('FOLLOW_UP_CONCLUSION_REQUIRED');
  const mapped = medications.map(pmrs2Medication);
  if (mapped.some(medication => medication.warnings.length)) warnings.push('FOLLOW_UP_MEDICATION_REVIEW');
  return {
    source, dateTime: normalizedDateTime, originalDateTime: string(rawDateTime),
    vitals, evolution, conclusion, medications: mapped, warnings,
  };
}

export function pmrs2FollowUps(patient) {
  if (string(patient.serviceMode).toLowerCase() !== 'ipd') return [];
  const data = patient.data && typeof patient.data === 'object' ? patient.data : {};
  const exam = summarizeClinicalExamination(data);
  const history = field(data, 'ipd_history_present_illness', 'medical');
  const evolution = [history, exam.length ? `Clinical examination:\n${exam.join('\n')}` : '']
    .filter(Boolean).join('\n');
  const admissionDay = string(patient.entryDate) || field(data, 'web_date', 'registration');
  const admissionTime = field(data, 'web_time', 'registration');
  const initial = followUp('admission', admissionDay && admissionTime ? `${admissionDay}T${admissionTime}` : admissionDay,
    {
      temp: field(data, 'p2_temp', 'triage'), bp_sys: field(data, 'p2_bp_sys', 'triage'),
      bp_dia: field(data, 'p2_bp_dia', 'triage'), pulse: field(data, 'p2_pulse', 'triage'),
      resp: field(data, 'p2_resp', 'triage'), spo2: field(data, 'p2_spo2', 'triage'),
    }, records(data, 'system:initialIpdMedications'), evolution,
    field(data, 'emr_pmrs_ipd_diagnosis', 'medical'));
  const subsequent = records(data, 'system:dailyMonitoringRecords').map(record =>
    followUp('daily', record?.dtVal, record || {}, Array.isArray(record?.medications) ? record.medications : [],
      vital(record?.evol), vital(record?.conclusion)));
  if (subsequent.some(record => record.dateTime && record.dateTime === initial.dateTime)) {
    initial.warnings.push('SAME_TIME_AS_ADMISSION_REVIEW');
    subsequent.filter(record => record.dateTime === initial.dateTime).forEach(record =>
      record.warnings.push('SAME_TIME_AS_ADMISSION_REVIEW'));
  }
  return [initial, ...subsequent].sort((a, b) =>
    (a.dateTime || '9999').localeCompare(b.dateTime || '9999') ||
    (a.source === 'admission' ? -1 : 1));
}

export function pmrs2Ward(patient) {
  const code = string(patient.departmentCode).toLowerCase();
  const kh = string(patient.departmentNameKh);
  if (code === 'medicine' || kh === 'ផ្នែកជំងឺទូទៅ') return 'ផ្នែកសម្រាកពេទ្យ';
  if (gynecologyCodes.has(code) || gynecologyNames.has(kh)) return 'ផ្នែកសម្ភព និងរោគស្ត្រី';
  // The hospital confirmed that other ward labels match exactly in PMRS2.
  return kh;
}

export function pmrs2Icd10(value) {
  const match = /^([A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?)(?=$|[\s\-–—])/i.exec(string(value));
  return match ? match[1].toUpperCase() : '';
}

export function pmrs2Triage(patient) {
  const data = patient.data && typeof patient.data === 'object' ? patient.data : {};
  const mode = string(patient.serviceMode).toLowerCase();
  const day = string(patient.entryDate) || field(data, 'web_date', 'registration');
  const time = field(data, 'web_time', 'registration');
  return {
    dateTime: dateTime(day && time ? `${day}T${time}` : ''),
    receivingWard: pmrs2Ward(patient),
    serviceType: mode === 'opd' ? 'ពិគ្រោះក្រៅ' : mode === 'ipd' ? 'សម្រាកពេទ្យ' : '',
    weight: field(data, 'p2_weight', 'triage'),
    height: field(data, 'p2_height', 'triage'),
    temperature: vital(field(data, 'p2_temp', 'triage')),
    systolic: vital(field(data, 'p2_bp_sys', 'triage')),
    diastolic: vital(field(data, 'p2_bp_dia', 'triage')),
    pulse: vital(field(data, 'p2_pulse', 'triage')),
    respiratoryRate: vital(field(data, 'p2_resp', 'triage')),
    oxygenSaturation: vital(field(data, 'p2_spo2', 'triage')),
  };
}

export function pmrs2Preview(patient) {
  const data = patient.data && typeof patient.data === 'object' ? patient.data : {};
  const mode = string(patient.serviceMode).toLowerCase();
  const ward = pmrs2Ward(patient);
  const triage = pmrs2Triage(patient);
  const registeredCaseType = String(data['system:caseType'] || '').toLowerCase();
  const caseNew = registeredCaseType === 'new' || data['scope:registration:id:emr_pmrs_case_new'] === true || data['scope:medical:id:emr_pmrs_case_new'] === true;
  const caseOld = registeredCaseType === 'old' || data['scope:registration:id:emr_pmrs_case_old'] === true || data['scope:medical:id:emr_pmrs_case_old'] === true;
  const caseType = caseNew === caseOld ? '' : (caseNew ? 'ករណីថ្មី' : 'ករណីចាស់');
  const chiefComplaint = field(data, 'pmrs_chief_complaint', 'triage');
  const doctorDiagnosis = mode === 'ipd'
    ? field(data, 'emr_pmrs_ipd_diagnosis', 'medical')
    : field(data, 'emr_pmrs_opd_diagnosis', 'medical');
  const doctorIcd10Entry = mode === 'ipd'
    ? field(data, 'emr_pmrs_ipd_icd10', 'medical')
    : field(data, 'diag_input', 'medical');
  const diagnosisIcd10 = pmrs2Icd10(doctorIcd10Entry) || pmrs2Icd10(doctorDiagnosis);
  const diagnosisText = doctorDiagnosis || (mode === 'opd' ? doctorIcd10Entry : '');
  const warnings = [];
  if (!ward) warnings.push('WARD_REQUIRED');
  if (mode !== 'opd' && mode !== 'ipd') warnings.push('SERVICE_MODE_REQUIRED');
  if (!caseType) warnings.push('CASE_TYPE_REQUIRED');
  if (!chiefComplaint) warnings.push('CHIEF_COMPLAINT_REQUIRED');
  if (!diagnosisText) warnings.push('DOCTOR_DIAGNOSIS_REQUIRED');
  if (!diagnosisIcd10) warnings.push('ICD10_REQUIRED');
  const followUps = pmrs2FollowUps(patient);
  const prescription = pmrs2Prescription(patient);
  const discharge = pmrs2Discharge(patient);
  return {
    patientKey: string(patient.patientKey),
    patientVersion: Number.isInteger(patient.version) ? patient.version : 0,
    patientName: string(patient.fullName),
    healthId: string(patient.healthId),
    caseNumber: string(patient.caseNumber),
    receivingWard: ward,
    serviceType: triage.serviceType,
    triage,
    caseType,
    // On PMRS2, enter this in រោគសញ្ញា, press +, and select the added symptom.
    chiefComplaint,
    diagnosisText,
    diagnosisIcd10,
    // The user specified this default; an actual ordered service must be reviewed.
    ancillaryService: 'មិនមាន',
    // Review each dated entry before pressing "បន្ថែមការពិនិត្យតាមដានប្រចាំថ្ងៃ" in PMRS2.
    followUps,
    followUpsReady: followUps.every(record => record.warnings.length === 0),
    prescription,
    discharge,
    warnings,
    fieldsComplete: warnings.length === 0,
  };
}
