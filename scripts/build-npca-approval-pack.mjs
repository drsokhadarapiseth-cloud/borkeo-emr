// v48.0 - NPCA approval pack: the sample JSON listed in "Related documents" of
// the NPCA EMR Clinical Data Integration Specification v1.4 (OPD, IPD,
// transfer OPD to IPD, referral, clinical form), built by the EMR's own payload
// builder from SYNTHETIC visits and checked by the EMR's own validation with the
// real ICD-10 list, CMS medicine codes and NCDD village list. Usage:
//   node scripts/build-npca-approval-pack.mjs [output folder]
// (default docs/npca/approval-pack). No database file, no patient data, no network.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { openDatabase } from '../server/database.mjs';
import { ensureNpcaSchema } from '../server/npca/storage.mjs';
import { setCodeOverride } from '../server/npca/codes.mjs';
import { buildVisitPayload } from '../server/npca/visit-builder.mjs';
import { validateVisitPayload } from '../server/npca/validation.mjs';
import { canonicalAddress, validAddress } from '../server/npca/address.mjs';
import { createDiagnosisSearch } from '../server/icd10.mjs';
import { medicineCatalogue } from '../server/medicine-catalogue.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// Placeholders NPCA supplies; the service code is entered by ADMIN at /admin/npca.
export const FACILITY_PLACEHOLDER = 'FACILITY-CODE-FROM-NPCA';
const SERVICE_PLACEHOLDER = 'NPCA-SERVICE-CODE-TO-CONFIRM';
const at = (day, time) => `2026-10-${day}T${time}`;
const vitals = (temp, pulse, resp, sys, dia, spo2) => [['Temperature', temp], ['Heart Rate', pulse], ['Respiratory Rate', resp], ['Systolic Blood Pressure', sys], ['Diastolic Blood Pressure', dia], ['Blood Oxygen', spo2]].map(([name, value]) => ({ name, value }));
const medicine = (code) => { const item = medicineCatalogue().items.find((m) => m.code === code); return { cmsCode: code, medicine_name: item.name, strength: item.strength, form: item.form }; };

function patient(key, { surname, name, sex, birthdate, phone }) {
  return { patientKey: 'case:SYNTHETIC-' + key, healthId: 'SYNTHETIC-' + key, surname, name, sex, birthdate, phone, nationality: 'KHM', maritalStatus: 'Married',
    occupation: 'Farmer', disabilities: [],
    address: canonicalAddress({ province: { code: '16' }, district: { code: '1603' }, commune: { code: '160301' }, village: { code: '16030104' } }),
    identifications: [{ card_code: 'SYNTHETIC-CARD-' + key, card_type: 'HEF' }] };
}
function base(key, person, mode, { day = '20', start = '08:00', end = '10:00' } = {}) {
  const encounterId = 'initial-' + mode;
  return { patient: patient(key, person), link: { spid: 'SYNTHETIC-SPID-' + key, eligible: 1, payment_type: 'PATY-0000N09' },
    createdAt: at(day, start), updatedAt: at(day, end), visitType: mode, admissionType: 'Walk-in', admittedAt: at(day, start), completed: true,
    dischargeType: 'Authorized', outcome: 'Improved', outpatients: [], inpatients: [], emergencies: [], surgeries: [], progress_notes: [], dailyVitals: [],
    medical_histories: [{ encounterId, name: 'History of Present Illness', value: ['Synthetic history: symptoms for 3 days.'] }, { encounterId, name: 'Allergies', value: ['No known drug allergy'] }],
    physical_examinations: [{ encounterId, name: 'General Appearance', value: ['Alert, mildly ill'], value_type: 'array', value_unit: null }],
    laboratories: [], imageries: [], diagnoses: [], soaps: [], prescriptions: [], consultations: ['Drink more water', 'Return if fever persists'], invoices: [], forms: [], sourceIssues: [],
    triages: [{ id: 'initial', chief_complaint: 'Synthetic complaint', height: 160, weight: 55, recorded_at: at(day, start.replace(/:00$/, ':10')), recorded_by: 'Synthetic triage nurse', title: 'Nurse', observations: vitals(38.2, 96, 20, 118, 76, 97) }],
    encounterId };
}
const diagnosis = (encounterId, type, code, name, when, who = 'Dr. Synthetic Doctor') => ({ encounterId, diagnosis_type_name: type, diagnosis_code: code, diagnosis_name: name, diagnosed_at: when, diagnosed_by: who, title: 'Doctor' });
const invoice = (id, when, total, medicines = []) => ({ id, paymentType: 'HEF_POOR', date: when, total, cashier: 'Synthetic cashier',
  services: [{ localCode: 'SYNTHETIC_SERVICE', service_name: 'Consultation', service_category: 'Consultation', quantity: 1, price: total, paid: false }], medications: medicines });
const lab = (encounterId, when) => ({ released: true, encounterId, request_code: 'SYNTHETIC-LAB-1', requested_at: when, requested_by: 'Dr. Synthetic Doctor', title: 'Doctor',
  results: [{ name: 'Hemoglobin', category: 'Hematology', value: 11.2, value_type: 'float', value_unit: 'g/dL', reference_range: '12.0-16.0', interpretation: 'Low',
    verified_at: when.replace(/T(\d\d)/, (m, h) => 'T' + String(Number(h) + 1).padStart(2, '0')), verified_by: 'Synthetic lab doctor', recorded_at: when.replace(/T(\d\d)/, (m, h) => 'T' + String(Number(h) + 1).padStart(2, '0')), recorded_by: 'Synthetic lab technician' }] });

export function sampleSources() {
  // 1. OPD: consultation, lab, home prescription, invoice.
  const opd = base('OPD', { surname: 'Synthetic', name: 'Opd', sex: 'F', birthdate: '1990-05-15', phone: '012345678' }, 'opd');
  opd.dischargedAt = at('20', '10:00');
  opd.outpatients.push({ id: opd.encounterId, is_new: true, name: 'OPD General Medicine', service_type: 'General Consultation', started_at: at('20', '08:30'), ended_at: at('20', '10:00'), encountered_by: 'Dr. Synthetic Doctor', title: 'Doctor', symptoms: ['Fever', 'Diarrhoea'] });
  opd.diagnoses.push(diagnosis(opd.encounterId, 'In', 'A09', 'Infectious gastroenteritis and colitis, unspecified', at('20', '08:40')), diagnosis(opd.encounterId, 'Out', 'A09', 'Infectious gastroenteritis and colitis, unspecified', at('20', '09:50')));
  opd.soaps.push({ id: 'initial', encounterId: opd.encounterId, subjective: 'Fever and loose stools for 3 days.', objective: 'T 38.2, mild dehydration.', assessment: 'Acute gastroenteritis.', plan: 'Oral rehydration, paracetamol, review in 3 days.', recorded_at: at('20', '08:45'), recorded_by: 'Dr. Synthetic Doctor', title: 'Doctor' });
  opd.laboratories.push(lab(opd.encounterId, at('20', '08:50')));
  opd.prescriptions.push({ id: 'opd', home: true, encounterId: null, prescribed_at: at('20', '09:50'), prescribed_by: 'Dr. Synthetic Doctor', title: 'Doctor',
    medications: [{ ...medicine('AA0060'), method: 'Oral', unit: 'Tablet', morning: 2, afternoon: 0, evening: 2, night: 0, days: 5, dispense: { quantity: 20, unit: 'Tablet' } }] });
  opd.invoices.push(invoice('opd', at('20', '10:00'), 15000));
  opd.followupAt = at('23', '08:00');

  // 2. IPD: admission, two daily progress notes with vital signs and SOAP, discharge medicines.
  const ipd = base('IPD', { surname: 'Synthetic', name: 'Ipd', sex: 'M', birthdate: '1975-02-01', phone: '097123456' }, 'ipd', { day: '18', start: '09:00' });
  ipd.dischargedAt = at('21', '10:00');
  ipd.inpatients.push({ id: ipd.encounterId, is_new: true, name: 'Internal Medicine Ward', service_type: 'Internal Medicine', started_at: at('18', '09:30'), ended_at: at('21', '10:00'), encountered_by: 'Dr. Synthetic Doctor', title: 'Doctor', symptoms: ['Cough', 'Fever'] });
  ipd.diagnoses.push(diagnosis(ipd.encounterId, 'In', 'J18.9', 'Pneumonia, unspecified organism', at('18', '09:40')), diagnosis(ipd.encounterId, 'Out', 'J18.9', 'Pneumonia, unspecified organism', at('21', '09:50')));
  for (const [index, day] of ['19', '20'].entries()) {
    const id = 'daily-' + day;
    ipd.progress_notes.push({ id, encounterId: ipd.encounterId, started_at: at(day, '08:00'), ended_at: at(day, '08:20'), encountered_by: 'Dr. Synthetic Doctor', title: 'Doctor' });
    ipd.dailyVitals.push({ encounterId: id, recorded_at: at(day, '08:00'), recorded_by: 'Synthetic ward nurse', title: 'Nurse', observations: vitals(index ? 37 : 37.8, index ? 84 : 92, 18, 120, 78, 97) });
    ipd.soaps.push({ id, encounterId: id, subjective: 'Less cough.', objective: 'Crackles right base.', assessment: 'Pneumonia improving.', plan: 'Continue antibiotic.', evaluation: 'Improving', recorded_at: at(day, '08:10'), recorded_by: 'Dr. Synthetic Doctor', title: 'Doctor' });
  }
  ipd.prescriptions.push({ id: 'admission', home: false, encounterId: ipd.encounterId, prescribed_at: at('18', '09:45'), prescribed_by: 'Dr. Synthetic Doctor', title: 'Doctor',
    medications: [{ ...medicine('AA0060'), method: 'Oral', unit: 'Tablet', morning: 2, afternoon: 2, evening: 2, night: 0, days: 3, dispense: { quantity: 18, unit: 'Tablet' } }] },
  { id: 'home', home: true, encounterId: null, prescribed_at: at('21', '09:55'), prescribed_by: 'Dr. Synthetic Doctor', title: 'Doctor',
    medications: [{ ...medicine('AA0060'), method: 'Oral', unit: 'Tablet', interval: '8h', days: 4, note: 'Complete the course.', dispense: { quantity: 24, unit: 'Tablet' } }] });
  ipd.invoices.push(invoice('ipd', at('21', '10:00'), 120000));

  // 3. Transfer OPD to IPD: the OPD consultation stays as the first encounter of the same visit.
  const transfer = base('TRANSFER', { surname: 'Synthetic', name: 'Transfer', sex: 'F', birthdate: '1988-07-07', phone: '011223344' }, 'ipd', { day: '19', start: '08:00' });
  transfer.dischargedAt = at('21', '15:00');
  transfer.outpatients.push({ id: 'before-admission', is_new: true, name: 'OPD General Medicine', service_type: 'OPD', started_at: at('19', '08:30'), ended_at: at('19', '09:30'), encountered_by: 'Dr. Synthetic Doctor', title: 'Doctor' });
  transfer.inpatients.push({ id: transfer.encounterId, is_new: true, name: 'Internal Medicine Ward', service_type: 'Internal Medicine', started_at: at('19', '09:40'), ended_at: at('21', '15:00'), encountered_by: 'Dr. Synthetic Doctor', title: 'Doctor' });
  transfer.soaps.push({ id: 'opd', encounterId: 'before-admission', subjective: 'High fever.', objective: 'T 39.4.', assessment: 'Malaria suspected, admit.', plan: 'Admit to ward.', recorded_at: at('19', '09:00'), recorded_by: 'Dr. Synthetic Doctor', title: 'Doctor' });
  transfer.diagnoses.push(diagnosis(transfer.encounterId, 'In', 'B50', 'Plasmodium falciparum malaria', at('19', '09:40')), diagnosis(transfer.encounterId, 'Out', 'B50', 'Plasmodium falciparum malaria', at('21', '14:50')));
  transfer.progress_notes.push({ id: 'daily-20', encounterId: transfer.encounterId, started_at: at('20', '08:00'), ended_at: at('20', '08:15'), encountered_by: 'Dr. Synthetic Doctor', title: 'Doctor' });
  transfer.dailyVitals.push({ encounterId: 'daily-20', recorded_at: at('20', '08:00'), recorded_by: 'Synthetic ward nurse', title: 'Nurse', observations: vitals(37.4, 88, 18, 116, 74, 98) });
  transfer.soaps.push({ id: 'daily-20', encounterId: 'daily-20', subjective: 'No fever since night.', objective: 'Afebrile.', assessment: 'Responding.', plan: 'Continue treatment.', recorded_at: at('20', '08:10'), recorded_by: 'Dr. Synthetic Doctor', title: 'Doctor' });
  transfer.prescriptions.push({ id: 'home', home: true, encounterId: null, prescribed_at: at('21', '14:55'), prescribed_by: 'Dr. Synthetic Doctor', title: 'Doctor',
    medications: [{ ...medicine('AA0060'), method: 'Oral', unit: 'Tablet', morning: 1, afternoon: 0, evening: 1, night: 0, days: 3, dispense: { quantity: 6, unit: 'Tablet' } }] });
  transfer.invoices.push(invoice('transfer', at('21', '15:00'), 90000));

  // 4. Referral out from OPD (to a referral hospital).
  const referral = base('REFERRAL', { surname: 'Synthetic', name: 'Referral', sex: 'M', birthdate: '1960-03-03', phone: '016778899' }, 'opd', { day: '20', start: '13:00', end: '14:30' });
  referral.dischargedAt = at('20', '14:30'); referral.dischargeType = 'Refer Out'; referral.outcome = 'Unchanged';
  referral.outpatients.push({ id: referral.encounterId, is_new: true, name: 'OPD Surgery', service_type: 'General Consultation', started_at: at('20', '13:20'), ended_at: at('20', '14:30'), encountered_by: 'Dr. Synthetic Doctor', title: 'Doctor', symptoms: ['Right lower abdominal pain'] });
  referral.diagnoses.push(diagnosis(referral.encounterId, 'In', 'K35.8', 'Other and unspecified acute appendicitis', at('20', '13:40')), diagnosis(referral.encounterId, 'Out', 'K35.8', 'Other and unspecified acute appendicitis', at('20', '14:20')));
  referral.soaps.push({ id: 'initial', encounterId: referral.encounterId, subjective: 'Abdominal pain 1 day.', objective: 'McBurney tenderness.', assessment: 'Acute appendicitis.', plan: 'Refer for surgery.', recorded_at: at('20', '13:45'), recorded_by: 'Dr. Synthetic Doctor', title: 'Doctor' });
  referral.invoices.push(invoice('referral', at('20', '14:30'), 15000));
  referral.referral = { referred_to: { referral_number: 'SYNTHETIC/REF/2026/001', transportation: 'Ambulance', reason: 'Acute appendicitis needing surgery', has_called: true,
    caretaker_name: 'Synthetic caretaker', caretaker_phone: '012999888', referred_by: 'Dr. Synthetic Doctor', referred_by_phone: '012111222', referred_at: at('20', '14:30'),
    medications: 'IV fluid started 14:00', document_file: 'https://hospital.example/referrals/SYNTHETIC-REF-2026-001.pdf', health_facility: { name: 'Synthetic Referral Hospital', code: 'RECEIVING-FACILITY-CODE-FROM-NPCA', label: 'Referral hospital', type: 'CPA3' } } };

  // 5. Clinical data form: OPD ANC visit with form ENTY-000H014.
  const anc = base('ANC', { surname: 'Synthetic', name: 'Anc', sex: 'F', birthdate: '1998-09-09', phone: '010556677' }, 'opd', { day: '22', start: '08:00', end: '09:00' });
  anc.dischargedAt = at('22', '09:00'); anc.consultations = ['Iron and folic acid daily', 'Danger signs explained'];
  anc.outpatients.push({ id: anc.encounterId, is_new: false, name: 'ANC', service_type: 'Antenatal care', started_at: at('22', '08:20'), ended_at: at('22', '09:00'), encountered_by: 'Synthetic Midwife', title: 'Midwife' });
  anc.diagnoses.push(diagnosis(anc.encounterId, 'In', 'Z34.9', 'Encounter for supervision of normal pregnancy, unspecified', at('22', '08:30'), 'Synthetic Midwife'), diagnosis(anc.encounterId, 'Out', 'Z34.9', 'Encounter for supervision of normal pregnancy, unspecified', at('22', '08:55'), 'Synthetic Midwife'));
  anc.soaps.push({ id: 'initial', encounterId: anc.encounterId, subjective: 'No complaint.', objective: 'Fundal height 26 cm, FHR 140.', assessment: 'Normal pregnancy 26 weeks.', plan: 'Next ANC in 4 weeks.', recorded_at: at('22', '08:40'), recorded_by: 'Synthetic Midwife', title: 'Midwife' });
  anc.forms.push({ encounterId: anc.encounterId, form_code: 'ENTY-000H014', form_data: { pregnancy_number_of_pregnancies: 2, pregnancy_age: 26, uterine_height_cm: 26, fetal_heart_rate: 140, pregnancy_last_menstrual_period_date: '2026-04-24' } });
  anc.invoices.push(invoice('anc', at('22', '09:00'), 5000));

  return [['opd-sample.json', 'OPD Sample JSON', opd], ['ipd-sample.json', 'IPD Sample JSON', ipd], ['transfer-opd-to-ipd-sample.json', 'Transfer OPD to IPD Sample JSON', transfer],
    ['referral-sample.json', 'Referral Sample JSON', referral], ['form-anc-sample.json', 'Form Sample JSON (OPD ANC, ENTY-000H014)', anc]];
}

// Every sample built and checked exactly as /npca does before a real submission.
export function buildApprovalSamples() {
  const database = openDatabase(':memory:');
  const diagnoses = createDiagnosisSearch();
  try {
    ensureNpcaSchema(database);
    database.createUser({ id: 'synthetic-admin', username: 'synthetic-admin', displayName: 'Synthetic', role: 'ADMIN', passwordHash: 'synthetic-unused', createdAt: 0 });
    setCodeOverride(database, 'service', 'SYNTHETIC_SERVICE', SERVICE_PLACEHOLDER, 'synthetic-admin');
    const cms = new Set(medicineCatalogue().items.map((m) => m.code).filter((code) => /^[A-Z]{2}\d{3,4}$/.test(code || '')));
    const options = { eligible: true, sendForms: true, addressValid: validAddress, medicineExists: (code) => cms.has(code),
      diagnosisExists: (code) => typeof code === 'string' && diagnoses.search(code).items.some((d) => d.code === code) };
    return sampleSources().map(([file, title, source]) => {
      const built = buildVisitPayload(source, { facilityCode: FACILITY_PLACEHOLDER, sendForms: true }, database);
      return { file, title, payload: built.payload, issues: built.issues, errors: validateVisitPayload(built.payload, { ...options, completed: source.completed }) };
    });
  } finally { diagnoses.close(); database.close(); }
}

export function writeApprovalPack(directory = path.join(root, 'docs', 'npca', 'approval-pack')) {
  const samples = buildApprovalSamples();
  fs.mkdirSync(directory, { recursive: true });
  for (const sample of samples) fs.writeFileSync(path.join(directory, sample.file), JSON.stringify(sample.payload, null, 2) + '\n');
  const lines = ['# Validation of the sample JSON', '', 'Built by `node scripts/build-npca-approval-pack.mjs` from synthetic visits (no patient data).',
    'Each file is the exact body the EMR would POST to the visit submission endpoint, checked by the EMR validation that runs before every real submission.', '',
    '| File | Sample | Builder issues | Validation errors |', '| --- | --- | --- | --- |',
    ...samples.map((s) => `| ${s.file} | ${s.title} | ${s.issues.length} | ${s.errors.length ? s.errors.map((e) => e.field + ' (' + e.code + ')').join(', ') : 0} |`), '',
    `Placeholders to replace with NPCA values: \`${FACILITY_PLACEHOLDER}\` (health_facility_code), \`${SERVICE_PLACEHOLDER}\` (service_code, entered by ADMIN at /admin/npca after NPCA confirms the service codes), the SPID / card numbers (returned by the beneficiary search) and the receiving facility code of the referral.`, ''];
  fs.writeFileSync(path.join(directory, 'VALIDATION.md'), lines.join('\n'));
  return { directory, samples: samples.map((s) => ({ file: s.file, issues: s.issues.length, errors: s.errors.length })) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = writeApprovalPack(process.argv[2] ? path.resolve(process.argv[2]) : undefined);
  console.log(JSON.stringify(result, null, 2));
  if (result.samples.some((s) => s.issues || s.errors)) process.exitCode = 1;
}
