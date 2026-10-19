import crypto from 'node:crypto';
import { WARDS } from './access.mjs';
import { ambulanceReferralIncome, paymentStatusForPatient } from './finance.mjs';

const MOVEMENT_TYPES = new Set(['ADMISSION', 'BED_ASSIGN', 'INTERNAL_TRANSFER', 'DISCHARGE', 'EXTERNAL_TRANSFER']);

function parseJson(value) {
  try { return value ? JSON.parse(value) : {}; } catch { return {}; }
}

function localDateKey(ms) {
  const date = new Date(Number(ms));
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function dateBounds(value) {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Date is invalid.');
  const [year, month, day] = date.split('-').map(Number);
  const start = new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
  const end = new Date(year, month - 1, day + 1, 0, 0, 0, 0).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end)) throw new Error('Date is invalid.');
  return { date, start, end };
}

function dateMidday(dateValue, fallback = Date.now()) {
  const value = String(dateValue || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return fallback;
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime();
}

function localDateTimeMs(value, fallback) {
  const raw = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(raw)) return fallback;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeWard(value) {
  return String(value || '').trim().toLowerCase();
}

function wardLabel(code) {
  const normalized = normalizeWard(code);
  const known = WARDS.find(item => item.code === normalized);
  if (known) return { code: normalized, nameKh: known.nameKh, nameEn: known.nameEn };
  if (normalized === 'gyneco-obstetric') return { code: normalized, nameKh: 'ផ្នែករោគស្ត្រី និងសម្ភព', nameEn: 'Gynecology–Obstetric' };
  return { code: normalized || 'unknown', nameKh: normalized || 'មិនបានកំណត់', nameEn: normalized || 'Not specified' };
}

function eventRow(row) {
  return {
    id: row.id,
    patientKey: row.patient_key,
    eventType: row.event_type,
    fromWardCode: row.from_ward_code || '',
    toWardCode: row.to_ward_code || '',
    fromDepartmentCode: row.from_department_code || '',
    toDepartmentCode: row.to_department_code || '',
    eventAt: row.event_at,
    createdBy: row.created_by || '',
    details: parseJson(row.details_json),
  };
}

export function ensureDailyReportSchema(database) {
  database.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS patient_movement_events (
      id TEXT PRIMARY KEY,
      patient_key TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK (event_type IN ('ADMISSION','BED_ASSIGN','INTERNAL_TRANSFER','DISCHARGE','EXTERNAL_TRANSFER')),
      from_ward_code TEXT NOT NULL DEFAULT '',
      to_ward_code TEXT NOT NULL DEFAULT '',
      from_department_code TEXT NOT NULL DEFAULT '',
      to_department_code TEXT NOT NULL DEFAULT '',
      event_at INTEGER NOT NULL,
      created_by TEXT REFERENCES users(id),
      details_json TEXT NOT NULL DEFAULT '{}'
    ) STRICT;
    CREATE INDEX IF NOT EXISTS patient_movement_patient_idx ON patient_movement_events(patient_key, event_at);
    CREATE INDEX IF NOT EXISTS patient_movement_date_idx ON patient_movement_events(event_at, event_type);
  `);
  seedExistingAdmissions(database);
}

function seedExistingAdmissions(database) {
  const patients = database.sqlite.prepare(`SELECT patient_key,department_code,service_mode,entry_date,discharge_date,record_json,created_by
    FROM patient_records WHERE service_mode='ipd'`).all();
  const hasAdmission = database.sqlite.prepare("SELECT 1 found FROM patient_movement_events WHERE patient_key=? AND event_type='ADMISSION' LIMIT 1");
  const insert = database.sqlite.prepare(`INSERT INTO patient_movement_events
    (id,patient_key,event_type,from_ward_code,to_ward_code,from_department_code,to_department_code,event_at,created_by,details_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`);
  patients.forEach(patient => {
    if (hasAdmission.get(patient.patient_key)) return;
    const data = parseJson(patient.record_json);
    const ward = normalizeWard(data['system:currentWardCode'] || patient.department_code);
    insert.run(
      crypto.randomUUID(), patient.patient_key, 'ADMISSION', '', ward, '', normalizeWard(patient.department_code),
      dateMidday(patient.entry_date), patient.created_by || null, JSON.stringify({ seeded: true }),
    );
    const discharge = data['system:discharge'];
    if (data['system:admissionStatus'] === 'discharged' && discharge && typeof discharge === 'object') {
      const destinationType = String(discharge.referralDestinationType || '').toUpperCase();
      const type = discharge.status === 'referred' && destinationType === 'PROVINCIAL_HOSPITAL' ? 'EXTERNAL_TRANSFER' : 'DISCHARGE';
      insert.run(
        crypto.randomUUID(), patient.patient_key, type, ward, '', normalizeWard(patient.department_code), '',
        localDateTimeMs(discharge.dischargeAt, dateMidday(patient.discharge_date)), patient.created_by || null,
        JSON.stringify({ seeded: true, ...discharge }),
      );
    }
  });
}

export function recordMovement(database, values) {
  const eventType = String(values?.eventType || '').toUpperCase();
  if (!MOVEMENT_TYPES.has(eventType)) throw new Error('Movement type is invalid.');
  const patientKey = String(values?.patientKey || '').trim();
  if (!patientKey) throw new Error('Patient is required.');
  const eventAt = Number(values?.eventAt || Date.now());
  if (!Number.isFinite(eventAt)) throw new Error('Movement date is invalid.');
  const id = crypto.randomUUID();
  database.sqlite.prepare(`INSERT INTO patient_movement_events
    (id,patient_key,event_type,from_ward_code,to_ward_code,from_department_code,to_department_code,event_at,created_by,details_json)
    VALUES (?,?,?,?,?,?,?,?,?,?)`).run(
    id, patientKey, eventType,
    normalizeWard(values?.fromWardCode), normalizeWard(values?.toWardCode),
    normalizeWard(values?.fromDepartmentCode), normalizeWard(values?.toDepartmentCode),
    eventAt, values?.createdBy || null, JSON.stringify(values?.details || {}),
  );
  return eventRow(database.sqlite.prepare('SELECT * FROM patient_movement_events WHERE id=?').get(id));
}

export function ensureAdmissionMovement(database, patient, actorId, now = Date.now()) {
  if (!patient) return null;
  const serviceMode = String(patient.service_mode ?? patient.serviceMode ?? '').toLowerCase();
  if (serviceMode !== 'ipd') return null;
  const patientKey = patient.patient_key ?? patient.patientKey;
  if (!patientKey) return null;
  const existing = database.sqlite.prepare("SELECT * FROM patient_movement_events WHERE patient_key=? AND event_type='ADMISSION' ORDER BY event_at DESC LIMIT 1").get(patientKey);
  if (existing) return eventRow(existing);
  const data = parseJson(patient.record_json || '{}');
  return recordMovement(database, {
    patientKey,
    eventType: 'ADMISSION',
    toWardCode: data['system:currentWardCode'] || patient.department_code || patient.departmentCode,
    toDepartmentCode: patient.department_code || patient.departmentCode,
    eventAt: dateMidday(patient.entry_date || patient.entryDate, now),
    createdBy: actorId,
    details: { source: 'patient-record' },
  });
}

export function recordBedAssignment(database, values) {
  const event = recordMovement(database, { ...values, eventType: 'BED_ASSIGN' });
  // If the hospital admission was first created at department level, refine it
  // to the exact ward once the patient receives a bed (especially Gyn/Obstetric).
  const admission = database.sqlite.prepare("SELECT id,event_at,to_ward_code FROM patient_movement_events WHERE patient_key=? AND event_type='ADMISSION' ORDER BY event_at DESC LIMIT 1").get(values.patientKey);
  const exactWard = normalizeWard(values.toWardCode);
  if (admission && exactWard && values?.details?.transferAssignment !== true && localDateKey(admission.event_at) === localDateKey(event.eventAt) && admission.to_ward_code !== exactWard) {
    database.sqlite.prepare("UPDATE patient_movement_events SET to_ward_code=? WHERE id=?").run(exactWard, admission.id);
  }
  return event;
}

function applyMovement(state, row) {
  const event = row.event_type;
  if (event === 'ADMISSION' || event === 'BED_ASSIGN') {
    state.set(row.patient_key, normalizeWard(row.to_ward_code || row.to_department_code));
  } else if (event === 'INTERNAL_TRANSFER' || event === 'DISCHARGE' || event === 'EXTERNAL_TRANSFER') {
    state.set(row.patient_key, '');
  }
}

function addCount(map, code, amount = 1) {
  const key = normalizeWard(code) || 'unknown';
  map.set(key, (map.get(key) || 0) + amount);
}

function paymentTotals(database, patientKeys) {
  const totals = {
    paid: 0,
    notPaid: 0,
    nssf: 0,
    hefEquity: 0,
    hefVulnerable: 0,
    exempt: 0,
    discount: 0,
  };
  patientKeys.forEach(patientKey => {
    const status = paymentStatusForPatient(database, patientKey);
    if (!status) return;
    if (status.code === 'PAID') totals.paid += 1;
    else if (['NSSF','NSSF_OUTSIDE','NSSF_WORKER','NSSF_CIVIL'].includes(status.code)) totals.nssf += 1;
    else if (['HEF_EQUITY','HEF_POOR'].includes(status.code)) totals.hefEquity += 1;
    else if (['HEF_VULNERABLE','HEF_VULNERABLE_FAMILY'].includes(status.code)) totals.hefVulnerable += 1;
    else if (['EXEMPT','FULL_WAIVER'].includes(status.code)) totals.exempt += 1;
    else if (status.code === 'DISCOUNT') totals.discount += 1;
    else totals.notPaid += 1;
  });
  return totals;
}

export function hospitalAnalytics(database, filterWard = '') {
  const normWard = normalizeWard(filterWard);
  let patients = database.listPatients();
  if (normWard) {
    patients = patients.filter(row => {
      const summary = parseJson(row.summary_json || '{}');
      const rec = parseJson(row.record_json || '{}');
      const patientWard = normalizeWard(rec['system:currentWardCode'] || summary.departmentCode || summary.departmentNameEn || row.department_code || '');
      return patientWard === normWard;
    });
  }
  const diagnosisCounts = new Map();
  const wardCounts = new Map();
  const paymentCounts = new Map();
  let male = 0, female = 0;

  patients.forEach(row => {
    const summary = parseJson(row.summary_json || '{}');
    const rec = parseJson(row.record_json || '{}');

    // Gender
    const sex = String(summary.sex || rec['scope:registration:id:web_sex'] || '').toUpperCase();
    if (sex.startsWith('M') || sex.includes('ប្រុស')) male++;
    else if (sex.startsWith('F') || sex.includes('ស្រី')) female++;

    // Ward
    const ward = normalizeWard(rec['system:currentWardCode'] || summary.departmentCode || summary.departmentNameEn || 'opd');
    addCount(wardCounts, ward);

    // Payment
    const status = paymentStatusForPatient(database, row.patient_key);
    const payLabel = status?.labelKh || summary.paymentType || 'មិនទាន់បង់ប្រាក់';
    paymentCounts.set(payLabel, (paymentCounts.get(payLabel) || 0) + 1);

    // IPD Discharge Diagnoses extraction
    const discharge = rec['system:discharge'] && typeof rec['system:discharge'] === 'object'
      ? rec['system:discharge']
      : parseJson(rec['system:discharge'] || '{}');
    const dischargeSummary = rec['system:ipdDischargeSummary']
      ? (typeof rec['system:ipdDischargeSummary'] === 'object' ? rec['system:ipdDischargeSummary'] : parseJson(rec['system:ipdDischargeSummary']))
      : null;

    let diagText = String(
      discharge.dischargeDiagnosis ||
      dischargeSummary?.discharge?.diagnosis ||
      rec['scope:medical:id:diag_output'] ||
      rec['scope:discharge:id:web_diag_out'] ||
      ''
    ).trim();

    let icd10 = String(
      discharge.dischargeIcd10 ||
      dischargeSummary?.discharge?.icd10 ||
      rec['scope:discharge:id:emr_discharge_icd10'] ||
      rec['scope:discharge:id:web_diag_out_icd10'] ||
      ''
    ).trim().toUpperCase();

    if (diagText || icd10) {
      if (!icd10 && diagText) {
        const match = /^([A-Z][0-9]{2}(?:\.[0-9]+)?)\s*[-:—]\s*(.+)$/i.exec(diagText);
        if (match) {
          icd10 = match[1].toUpperCase();
          diagText = match[2].trim();
        }
      }

      const key = (icd10 ? icd10 + '::' : '') + (diagText ? diagText.toLowerCase() : icd10.toLowerCase());
      const existing = diagnosisCounts.get(key);
      if (existing) {
        existing.count++;
        if (!existing.diagnosis && diagText) existing.diagnosis = diagText;
        if (!existing.icd10 && icd10) existing.icd10 = icd10;
      } else {
        diagnosisCounts.set(key, {
          diagnosis: diagText || icd10,
          icd10: icd10 || '',
          count: 1,
        });
      }
    }
  });

  const topDiagnosesList = [...diagnosisCounts.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const maxDiag = Math.max(...topDiagnosesList.map(d => d.count), 1);
  const topDiagnoses = topDiagnosesList.map((d, index) => ({
    rank: index + 1,
    diagnosis: d.diagnosis,
    icd10: d.icd10 || '',
    count: d.count,
    percentage: Math.round((d.count / maxDiag) * 100),
  }));

  const totalPatients = Math.max(patients.length, 1);
  const wardDistribution = [...wardCounts.entries()].map(([code, count]) => ({
    ...wardLabel(code),
    count,
    percentage: Math.round((count / totalPatients) * 100),
  })).sort((a, b) => b.count - a.count);

  const paymentDistribution = [...paymentCounts.entries()].map(([label, count]) => ({
    label,
    count,
    percentage: Math.round((count / totalPatients) * 100),
  })).sort((a, b) => b.count - a.count);

  return {
    totalPatients: patients.length,
    gender: { male, female, other: patients.length - male - female },
    topDiagnoses,
    wardDistribution,
    paymentDistribution,
  };
}

export function dailyHospitalReport(database, dateValue, filterWard = '') {
  const normWard = normalizeWard(filterWard);
  const { date, start, end } = dateBounds(dateValue);
  const rows = database.sqlite.prepare('SELECT * FROM patient_movement_events WHERE event_at<? ORDER BY event_at,id').all(end);
  const before = rows.filter(row => row.event_at < start);
  const during = rows.filter(row => row.event_at >= start);
  const startState = new Map();
  before.forEach(row => applyMovement(startState, row));
  const endState = new Map(startState);
  during.forEach(row => applyMovement(endState, row));

  const restant = new Map();
  startState.forEach((ward, key) => {
    if (ward && (!normWard || ward === normWard)) addCount(restant, ward);
  });
  const current = new Map();
  endState.forEach((ward, key) => {
    if (ward && (!normWard || ward === normWard)) addCount(current, ward);
  });

  let admissionEvents = during.filter(row => row.event_type === 'ADMISSION');
  if (normWard) {
    admissionEvents = admissionEvents.filter(row => normalizeWard(row.to_ward_code || row.to_department_code) === normWard);
  }
  const newAdmissions = new Map();
  admissionEvents.forEach(row => addCount(newAdmissions, row.to_ward_code || row.to_department_code));

  // Filter out OPD from IPD ward census table as OPD has no overnight beds/admissions
  let wardCodes = new Set([...restant.keys(), ...newAdmissions.keys(), ...current.keys()].filter(code => normalizeWard(code) !== 'opd'));
  if (normWard) {
    wardCodes = new Set(normWard === 'opd' ? [] : [normWard]);
  }
  const order = new Map([...WARDS.filter(item => item.code !== 'opd').map((item, index) => [item.code, index]), ['gyneco-obstetric', WARDS.length]]);
  const wards = [...wardCodes].map(code => ({
    ...wardLabel(code),
    restant: restant.get(code) || 0,
    newAdmissions: newAdmissions.get(code) || 0,
    current: current.get(code) || 0,
  })).sort((a, b) => (order.get(a.code) ?? 999) - (order.get(b.code) ?? 999) || a.nameEn.localeCompare(b.nameEn));

  const patientKeys = new Set();
  startState.forEach((ward, key) => {
    if (ward && (!normWard || ward === normWard)) patientKeys.add(key);
  });
  admissionEvents.forEach(row => patientKeys.add(row.patient_key));

  let hcReferrals = 0;
  let hcAmbulance = 0;
  let rhAmbulance = 0;

  patientKeys.forEach(key => {
    const p = database.findPatient(key);
    if (!p) return;
    const rec = parseJson(p.record_json || '{}');
    const entry = String(rec['scope:registration:id:web_entry_type'] || rec['entry_type'] || rec['scope:registration:id:web_refer'] || p.summary?.entry || '').toLowerCase();
    if (entry.includes('មណ្ឌលសុខភាព') || entry.includes('hc') || rec['scope:registration:id:web_refer']) {
      hcReferrals++;
    }
    const transport = String(rec['scope:registration:id:referral_transport'] || rec['scope:registration:id:transport'] || rec['system:discharge']?.referralTransport || '').toUpperCase();
    if (transport.includes('HC') || transport.includes('មណ្ឌលសុខភាព')) {
      hcAmbulance++;
    } else if (transport.includes('RH') || transport.includes('HOSPITAL') || transport.includes('មន្ទីរពេទ្យ')) {
      rhAmbulance++;
    }
  });

  const internalTransfers = during.filter(row => {
    if (row.event_type !== 'INTERNAL_TRANSFER') return false;
    if (!normWard) return true;
    return normalizeWard(row.to_ward_code) === normWard || normalizeWard(row.from_ward_code) === normWard;
  }).length;

  const externalProvincialTransfers = during.filter(row => {
    if (row.event_type !== 'EXTERNAL_TRANSFER' || String(parseJson(row.details_json).referralDestinationType || '').toUpperCase() !== 'PROVINCIAL_HOSPITAL') return false;
    if (!normWard) return true;
    return normalizeWard(row.from_ward_code || row.to_ward_code) === normWard;
  }).length;

  const opdReport = dailyOpdReport(database, date, start, end);

  return {
    date,
    wardCode: normWard || null,
    wardName: normWard ? wardLabel(normWard).nameKh : null,
    generatedAt: Date.now(),
    totalAdmissions: new Set(admissionEvents.map(row => row.patient_key)).size,
    internalTransfers,
    hcReferrals,
    hcAmbulance,
    rhAmbulance,
    externalProvincialTransfers,
    ambulanceReferralIncome: normWard ? { KHR: 0, USD: 0 } : ambulanceReferralIncome(database, start, end),
    wards,
    opdReport,
    paymentStatus: paymentTotals(database, patientKeys),
    patientCountForPaymentStatus: patientKeys.size,
    analytics: hospitalAnalytics(database, normWard),
  };
}

export function dailyOpdReport(database, targetDate, startMs = null, endMs = null) {
  let start = startMs;
  let end = endMs;
  if (!start || !end) {
    const bounds = dateBounds(targetDate);
    start = bounds.start;
    end = bounds.end;
  }

  // 1. Collect OPD queue entries for this target date
  let opdKeys = new Set();
  try {
    const queueRows = database.sqlite.prepare('SELECT patient_key FROM opd_queue_entries WHERE queue_date=?').all(targetDate);
    queueRows.forEach(r => opdKeys.add(r.patient_key));
  } catch {}

  // 2. Collect patient records registered or seen in OPD on target date
  const patientsOnDate = database.sqlite.prepare(`
    SELECT * FROM patient_records
    WHERE entry_date=? OR (created_at>=? AND created_at<?) OR (updated_at>=? AND updated_at<?)
  `).all(targetDate, start, end, start, end);

  patientsOnDate.forEach(p => {
    const mode = String(p.service_mode || '').toLowerCase();
    const dept = normalizeWard(p.department_code || p.department_name_en);
    if (p.entry_date === targetDate && (mode === 'opd' || dept === 'opd')) {
      opdKeys.add(p.patient_key);
    }
  });

  // Clinical forms on target date
  try {
    const formRows = database.sqlite.prepare(`
      SELECT patient_key FROM clinical_form_records
      WHERE (updated_at>=? AND updated_at<?) OR (created_at>=? AND created_at<?)
    `).all(start, end, start, end);
    formRows.forEach(r => opdKeys.add(r.patient_key));
  } catch {}

  const indicators = {
    total: { total: 0, male: 0, female: 0 },
    under5: { total: 0, male: 0, female: 0 },
    familyPlanning: { total: 0, male: 0, female: 0 },
    anc: { total: 0, male: 0, female: 0 },
    pnc: { total: 0, male: 0, female: 0 },
    sti: { total: 0, male: 0, female: 0 },
    diabetesNew: { total: 0, male: 0, female: 0 },
    hypertensionNew: { total: 0, male: 0, female: 0 },
  };

  function tally(indicatorKey, isMale, isFemale) {
    indicators[indicatorKey].total += 1;
    if (isMale) indicators[indicatorKey].male += 1;
    if (isFemale) indicators[indicatorKey].female += 1;
  }

  opdKeys.forEach(patientKey => {
    const patient = database.findPatient(patientKey);
    if (!patient) return;
    const rec = parseJson(patient.record_json || '{}');
    const summary = parseJson(patient.summary_json || '{}');

    // Determine gender
    const sex = String(summary.sex || patient.sex || rec['scope:registration:id:web_sex'] || '').toUpperCase();
    const isMale = sex.startsWith('M') || sex.includes('ប្រុស');
    const isFemale = sex.startsWith('F') || sex.includes('ស្រី');

    // 1. Total consultations
    tally('total', isMale, isFemale);

    // 4. Children < 5 years
    let ageYears = Number.parseFloat(patient.age || summary.age || rec['scope:registration:id:web_age'] || '');
    if (Number.isNaN(ageYears) || ageYears < 0) {
      const dobStr = String(patient.date_of_birth || summary.dateOfBirth || rec['scope:registration:id:web_dob'] || '').trim();
      if (dobStr) {
        const birthDate = new Date(dobStr);
        const refDate = new Date(start);
        if (!Number.isNaN(birthDate.getTime())) {
          ageYears = (refDate.getTime() - birthDate.getTime()) / (365.25 * 24 * 3600 * 1000);
        }
      }
    }
    if (Number.isFinite(ageYears) && ageYears < 5 && ageYears >= 0) {
      tally('under5', isMale, isFemale);
    }

    // Check clinical forms associated with this patient
    let hasSpacingForm = false;
    let hasAncForm = false;
    let hasPncForm = false;
    try {
      const patientForms = database.sqlite.prepare('SELECT form_type FROM clinical_form_records WHERE patient_key=?').all(patientKey);
      patientForms.forEach(f => {
        if (f.form_type === 'spacing') hasSpacingForm = true;
        if (f.form_type === 'anc') hasAncForm = true;
        if (f.form_type === 'pnc') hasPncForm = true;
      });
    } catch {}

    // Collect all diagnosis text and codes
    const diagnoses = [];
    if (rec['scope:medical:id:diag_input']) diagnoses.push(String(rec['scope:medical:id:diag_input']));
    if (rec['scope:medical:id:emr_pmrs_opd_diagnosis']) diagnoses.push(String(rec['scope:medical:id:emr_pmrs_opd_diagnosis']));
    if (rec['scope:medical:id:emr_opd_diagnoses']) {
      const parsedDiag = parseJson(rec['scope:medical:id:emr_opd_diagnoses']);
      if (Array.isArray(parsedDiag)) {
        parsedDiag.forEach(item => {
          if (item?.icd10) diagnoses.push(String(item.icd10));
          if (item?.text) diagnoses.push(String(item.text));
        });
      }
    }
    if (rec['system:opdDiagnosis']) diagnoses.push(String(rec['system:opdDiagnosis']));
    if (patient.department_code) diagnoses.push(String(patient.department_code));
    if (patient.department_name_kh) diagnoses.push(String(patient.department_name_kh));

    const diagBlob = diagnoses.join(' ').toLowerCase();

    // 5. Family Planning (ពន្យាកំណើត / ផែនការគ្រួសារ / spacing / Z30)
    const isFamilyPlanning = hasSpacingForm ||
      diagBlob.includes('spacing') ||
      diagBlob.includes('ពន្យា') ||
      diagBlob.includes('ផែនការគ្រួសារ') ||
      diagBlob.includes('family planning') ||
      /\bz30\b/i.test(diagBlob);
    if (isFamilyPlanning) {
      tally('familyPlanning', isMale, isFemale);
    }

    // 6. ANC (ពិនិត្យផ្ទៃពោះ / anc / Z34, Z35)
    const isAnc = hasAncForm ||
      diagBlob.includes('anc') ||
      diagBlob.includes('ពិនិត្យផ្ទៃពោះ') ||
      diagBlob.includes('antenatal') ||
      /\bz3[45]\b/i.test(diagBlob);
    if (isAnc) {
      tally('anc', false, isFemale || true); // ANC is female
    }

    // 7. PNC (ពិនិត្យថែទាំក្រោយសម្រាល / pnc / Z39)
    const isPnc = hasPncForm ||
      diagBlob.includes('pnc') ||
      diagBlob.includes('ក្រោយសម្រាល') ||
      diagBlob.includes('postnatal') ||
      /\bz39\b/i.test(diagBlob);
    if (isPnc) {
      tally('pnc', false, isFemale || true); // PNC is female
    }

    // 8. STI (ពិនិត្យកាមរោគ / std / sti / A50-A64)
    const isSti = diagBlob.includes('std') ||
      diagBlob.includes('sti') ||
      diagBlob.includes('កាមរោគ') ||
      /\b(a5[0-9]|a6[0-4])\b/i.test(diagBlob);
    if (isSti) {
      tally('sti', isMale, isFemale);
    }

    // 9. Diabetes New Case (ទឹកនោមផ្អែម ករណីថ្មី / E10-E14)
    const isDiabetes = diagBlob.includes('ទឹកនោមផ្អែម') ||
      diagBlob.includes('diabetes') ||
      /\be1[0-4]\b/i.test(diagBlob);
    if (isDiabetes) {
      tally('diabetesNew', isMale, isFemale);
    }

    // 10. Hypertension New Case (លើសសម្ពាធឈាម ករណីថ្មី / I10-I15)
    const isHypertension = diagBlob.includes('លើសឈាម') ||
      diagBlob.includes('លើសសម្ពាធឈាម') ||
      diagBlob.includes('hypertension') ||
      /\bi1[0-5]\b/i.test(diagBlob);
    if (isHypertension) {
      tally('hypertensionNew', isMale, isFemale);
    }
  });

  const paymentStatus = paymentTotals(database, opdKeys);

  return {
    indicators: [
      { no: '១', key: 'total', label: 'ពិគ្រោះសរុប', ...indicators.total },
      { no: '៤', key: 'under5', label: 'កុមារតិចជាង ៥ឆ្នាំ', ...indicators.under5 },
      { no: '៥', key: 'familyPlanning', label: 'ពន្យាកំណើត', ...indicators.familyPlanning },
      { no: '៦', key: 'anc', label: 'ពិនិត្យផ្ទៃពោះ', ...indicators.anc },
      { no: '៧', key: 'pnc', label: 'ពិនិត្យថែទាំក្រោយសម្រាល', ...indicators.pnc },
      { no: '៨', key: 'sti', label: 'ពិនិត្យកាមរោគ', ...indicators.sti },
      { no: '៩', key: 'diabetesNew', label: 'ទឹកនោមផ្អែម ករណីថ្មី', ...indicators.diabetesNew },
      { no: '១០', key: 'hypertensionNew', label: 'លើសសម្ពាធឈាមករណីថ្មី', ...indicators.hypertensionNew },
    ],
    paymentStatus,
    patientCount: opdKeys.size,
  };
}
