import assert from 'node:assert/strict';
import test from 'node:test';
import { pmrs2Discharge, pmrs2FollowUps, pmrs2Icd10, pmrs2Prescription, pmrs2Preview, pmrs2Route, pmrs2Ward } from '../server/pmrs2-mapping.mjs';
import { buildPmrs2TransferPackage } from '../server/pmrs2-transfer.mjs';
import { NORMAL_EXAM, normalExamText, summarizeClinicalExamination } from '../public/pmrs2-exam-normal.js';

test('all three normal examination languages retain normal summaries and edited findings', () => {
  for (const language of ['kh', 'en', 'fr']) {
    const data = { 'scope:medical:id:ipd_exam_neuro_conscious': true };
    for (const system of Object.values(NORMAL_EXAM)) {
      for (const [id, [, normal]] of Object.entries(system.fields)) {
        const text = normalExamText(normal, language);
        if (language !== 'kh') assert.doesNotMatch(text, /[\u1780-\u17ff]/);
        data[`scope:medical:id:${id}`] = text;
      }
    }
    const summaries = summarizeClinicalExamination(data);
    assert.equal(summaries.filter(value => value.endsWith(': normal')).length, 9);
    data['scope:medical:id:ipd_exam_cvs_auscultation'] = 'Irregular rhythm';
    const edited = summarizeClinicalExamination(data).join('\n');
    assert.match(edited, /Auscultation: Irregular rhythm/);
    assert.doesNotMatch(edited, /Cardiovascular system: normal/);
  }
});

test('medicine and reproductive services use the hospital-confirmed PMRS2 wards', () => {
  assert.equal(pmrs2Ward({ departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ' }), 'ផ្នែកសម្រាកពេទ្យ');
  for (const code of ['gyneco-obstetric','anc','pnc','family-planning','cervix-screening','abortion','misabortion','safe-abortion']) {
    assert.equal(pmrs2Ward({ departmentCode: code }), 'ផ្នែកសម្ភព និងរោគស្ត្រី', code);
  }
  assert.equal(pmrs2Ward({ departmentCode: 'pediatric', departmentNameKh: 'ផ្នែកជំងឺកុមារ' }), 'ផ្នែកជំងឺកុមារ');
});

test('registration-owned case type is reused by OPD/IPD clinical preview', () => {
  const patient = {
    patientKey: 'case:REG-CASE-001', serviceMode: 'opd', departmentCode: 'opd',
    data: {
      'system:caseType': 'old',
      'scope:triage:auto:pmrs_chief_complaint': 'cough',
      'scope:triage:id:pmrs_chief_complaint': 'cough',
      'scope:medical:id:emr_pmrs_opd_diagnosis': 'A90 - diagnosis',
      'scope:medical:id:diag_input': 'A90',
    },
  };
  const preview = pmrs2Preview(patient);
  assert.equal(preview.caseType, 'ករណីចាស់');
});

test('preview preserves doctor text and complaint, maps OPD/IPD, and requires a real ICD-10 code', () => {
  const data = {
    'scope:medical:id:emr_pmrs_case_new': true,
    'scope:medical:id:emr_pmrs_case_old': false,
    'scope:triage:id:pmrs_chief_complaint': 'ក្តៅខ្លួន និងឈឺក្បាល',
    'scope:medical:id:emr_pmrs_ipd_diagnosis': 'គ្រុនឈាម',
    'scope:medical:id:emr_pmrs_ipd_icd10': 'A90 - Dengue fever',
  };
  const ipd = pmrs2Preview({ patientKey: 'case:123', serviceMode: 'ipd', departmentCode: 'medicine', data });
  assert.equal(ipd.caseType, 'ករណីថ្មី');
  assert.equal(ipd.chiefComplaint, 'ក្តៅខ្លួន និងឈឺក្បាល');
  assert.equal(ipd.diagnosisText, 'គ្រុនឈាម');
  assert.equal(ipd.diagnosisIcd10, 'A90');
  assert.equal(ipd.ancillaryService, 'មិនមាន');
  assert.equal(ipd.serviceType, 'សម្រាកពេទ្យ');
  assert.equal(ipd.fieldsComplete, true);

  const opd = pmrs2Preview({ serviceMode: 'opd', departmentCode: 'anc', data: {
    ...data,
    'scope:medical:id:emr_pmrs_case_new': false,
    'scope:medical:id:emr_pmrs_case_old': true,
    'scope:medical:id:emr_pmrs_opd_diagnosis': 'A90 - clinical note',
    'scope:medical:id:diag_input': 'A90',
  } });
  assert.equal(opd.serviceType, 'ពិគ្រោះក្រៅ');
  assert.equal(opd.caseType, 'ករណីចាស់');
  assert.equal(opd.receivingWard, 'ផ្នែកសម្ភព និងរោគស្ត្រី');
  assert.equal(opd.fieldsComplete, true);
  assert.equal(pmrs2Icd10('malaria'), '');
  assert.equal(pmrs2Preview({ serviceMode: 'ipd', departmentCode: 'medicine', data: {
    ...data, 'scope:medical:id:emr_pmrs_ipd_icd10': '',
  } }).warnings.includes('ICD10_REQUIRED'), true);
});

test('historical records without a saved case choice or named complaint require review', () => {
  const preview = pmrs2Preview({ serviceMode: 'ipd', departmentNameKh: 'ផ្នែកជំងឺកុមារ', data: {
    'scope:triage:auto:17': 'unverified legacy value',
    'scope:medical:id:emr_pmrs_ipd_diagnosis': 'unspecified condition',
  } });
  assert.deepEqual(preview.warnings, ['CASE_TYPE_REQUIRED','CHIEF_COMPLAINT_REQUIRED','ICD10_REQUIRED']);
  assert.equal(preview.chiefComplaint, '');
});

test('admission uses the actual date/time, triage vitals, history, normal exam, diagnosis, and BID per-dose units', () => {
  const data = {
    'scope:registration:id:web_time': '14:20',
    'scope:triage:id:p2_temp': '37.2',
    'scope:triage:id:p2_bp_sys': '120',
    'scope:triage:id:p2_bp_dia': '80',
    'scope:triage:id:p2_pulse': '78',
    'scope:triage:id:p2_resp': '18',
    'scope:triage:id:p2_spo2': '98',
    'scope:medical:id:ipd_history_present_illness': 'Fever for 2 days',
    'scope:medical:id:emr_pmrs_ipd_diagnosis': 'Suspected dengue',
    'system:initialIpdMedications': JSON.stringify([
      { name: 'Medicine A', route: 'po', unit: 'គ្រាប់', scheduleType: 'bid', doseAmount: '2', m: '2', a: '0', e: '2', n: '0', d: '5' },
      { name: 'Medicine B', route: 'other_im', unit: 'អំពូល', scheduleType: 'bid', doseAmount: '1', m: '1', a: '0', e: '1', n: '0' },
    ]),
    'system:dailyMonitoringRecords': JSON.stringify([
      { dtVal: '2026-09-18T08:10', temp: '36.8', bp_sys: '118', bp_dia: '77', pulse: '75', resp: '18', spo2: '99', evol: 'Better', conclusion: 'Recovery', medications: [
        { name: 'Medicine A', route: 'po', unit: 'គ្រាប់', scheduleType: 'bid', doseAmount: '1', m: '1', a: '0', e: '1', n: '0' },
      ] },
    ]),
  };
  for (const [id, [, normal]] of Object.entries(NORMAL_EXAM.cardiovascular.fields)) {
    data[`scope:medical:id:${id}`] = normal;
  }
  const entries = pmrs2FollowUps({ serviceMode: 'ipd', entryDate: '2026-09-17', data });
  assert.equal(entries.length, 2);
  assert.equal(entries[0].dateTime, '2026-09-17T14:20');
  assert.equal(entries[0].vitals.systolic, '120');
  assert.match(entries[0].evolution, /^Fever for 2 days\nClinical examination:/);
  assert.match(entries[0].evolution, /Cardiovascular system: normal/);
  assert.equal(entries[0].conclusion, 'Suspected dengue');
  assert.deepEqual(entries[0].medications.map(({ morning, afternoon, evening, night }) =>
    [morning, afternoon, evening, night]), [['2','0','2','0'],['1','0','1','0']]);
  assert.deepEqual(entries[0].warnings, []);
  assert.equal(entries[1].dateTime, '2026-09-18T08:10');
  assert.equal(entries[1].evolution, 'Better');
  assert.equal(entries[1].medications[0].morning, '1');
  assert.deepEqual(entries[1].warnings, []);
});

test('edited exam findings remain visible; unsupported dosing and missing dates require review', () => {
  const data = {};
  for (const [id, [, normal]] of Object.entries(NORMAL_EXAM.cardiovascular.fields)) {
    data[`scope:medical:id:${id}`] = normal;
  }
  data['scope:medical:id:ipd_exam_cvs_auscultation'] = 'irregular rhythm';
  assert.match(summarizeClinicalExamination(data).join('\n'), /Auscultation: irregular rhythm/);
  assert.doesNotMatch(summarizeClinicalExamination(data).join('\n'), /Cardiovascular system: normal/);
  data['system:initialIpdMedications'] = JSON.stringify([
    { name: 'Medicine C', unit: 'ម.ក្រ', scheduleType: 'bid', doseAmount: '500' },
    { name: 'Medicine D', unit: 'គ្រាប់', scheduleType: 'qh', doseAmount: '1' },
  ]);
  data['system:dailyMonitoringRecords'] = JSON.stringify([
    { dtVal: '2026-09-18T09:00', medications: [] },
    { dtVal: '2026-09-17T10:30', medications: [] },
  ]);
  const entries = pmrs2FollowUps({ serviceMode: 'ipd', entryDate: '2026-09-17', data });
  assert.equal(entries[0].dateTime, '2026-09-17T10:30');
  assert.equal(entries[1].source, 'daily');
  assert.equal(entries[2].source, 'admission'); // missing admission time never becomes midnight
  assert.equal(entries[2].dateTime, '');
  assert.ok(entries[2].warnings.includes('FOLLOW_UP_DATE_TIME_REQUIRED'));
  assert.equal(entries[2].medications[0].morning, '');
  assert.ok(entries[2].medications[0].warnings.includes('MEDICATION_UNIT_REVIEW'));
  assert.ok(entries[2].medications[1].warnings.includes('MEDICATION_TIMING_REVIEW'));
  assert.deepEqual(pmrs2FollowUps({ serviceMode: 'opd', data }), []);
});

test('separate reviews on the admission day keep their times and an identical timestamp is flagged', () => {
  const data = {
    'scope:registration:id:web_time': '09:00',
    'system:dailyMonitoringRecords': JSON.stringify([
      { dtVal: '2026-09-17T15:00', evol: 'Afternoon review' },
      { dtVal: '2026-09-17T09:00', evol: 'Same timestamp review' },
    ]),
  };
  const entries = pmrs2FollowUps({ serviceMode: 'ipd', entryDate: '2026-09-17', data });
  assert.deepEqual(entries.map(entry => entry.dateTime), [
    '2026-09-17T09:00', '2026-09-17T09:00', '2026-09-17T15:00',
  ]);
  assert.equal(entries[0].source, 'admission');
  assert.ok(entries[0].warnings.includes('SAME_TIME_AS_ADMISSION_REVIEW'));
  assert.ok(entries[1].warnings.includes('SAME_TIME_AS_ADMISSION_REVIEW'));
});

test('BID, TID, and QID retain actual per-dose counts in the four PMRS2 columns and known routes', () => {
  const orders = [
    { name: 'A', route: 'po', unit: 'គ្រាប់', scheduleType: 'bid', doseAmount: '2', m: '2', a: '0', e: '2', n: '0' },
    { name: 'B', route: 'antibiotic_iv', unit: 'អំពូល', scheduleType: 'tid', doseAmount: '0.5', m: '0.5', a: '0.5', e: '0.5', n: '0' },
    { name: 'C', route: 'subcutaneous', unit: 'អំពូល', scheduleType: 'qid', doseAmount: '1.5', m: '1.5', a: '1.5', e: '1.5', n: '1.5' },
    { name: 'D', route: 'injection_unspecified', unit: 'អំពូល', scheduleType: 'bid', doseAmount: '1' },
  ];
  const prescription = pmrs2Prescription({ serviceMode: 'opd', data: { 'system:opdMedications': JSON.stringify(orders) } });
  assert.deepEqual(prescription.medications.slice(0, 3).map(({ morning, afternoon, evening, night }) =>
    [morning, afternoon, evening, night]), [
    ['2','0','2','0'], ['0.5','0.5','0.5','0'], ['1.5','1.5','1.5','1.5'],
  ]);
  assert.deepEqual(prescription.medications.slice(0, 3).map(med => med.pmrsRoute),
    ['លេប', 'ចាក់តាមសរសៃ', 'ចាក់ក្រោមស្បែក']);
  assert.equal(prescription.medications[3].pmrsRoute, '');
  assert.ok(prescription.medications[3].warnings.includes('MEDICATION_ROUTE_REVIEW'));
  assert.equal(pmrs2Route('ចាក់សាច់ដុំ'), 'ចាក់សាច់ដុំ');
  assert.equal(pmrs2Route('ចាក់'), '');
});

test('OPD prescription comes from OPD treatment and never creates IPD daily or discharge steps', () => {
  const data = {
    'system:opdMedications': JSON.stringify([{ name: 'OPD treatment', route: 'topical', unit: 'គ្រាប់', scheduleType: 'bid', doseAmount: '1' }]),
    'system:dailyMonitoringRecords': JSON.stringify([{ dtVal: '2026-09-17T08:30', medications: [{ name: 'IPD treatment' }] }]),
  };
  const preview = pmrs2Preview({ serviceMode: 'opd', data });
  assert.equal(preview.followUps.length, 0);
  assert.equal(preview.discharge, null);
  assert.equal(preview.prescription.source, 'opd');
  assert.equal(preview.prescription.medications[0].name, 'OPD treatment');
  assert.equal(preview.prescription.medications[0].pmrsRoute, 'លាប');
});

test('IPD discharge prescription takes the last dated follow-up, then saved doctor edits', () => {
  const latest = { dtVal: '2026-09-19T08:00', medications: [
    { name: 'Last-day medicine', route: 'po', unit: 'គ្រាប់', scheduleType: 'tid', doseAmount: '3' },
  ] };
  const patient = { serviceMode: 'ipd', departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
    entryDate: '2026-09-17', data: {
      'scope:registration:id:web_time': '14:20',
      'system:dailyMonitoringRecords': JSON.stringify([latest,
        { dtVal: '2026-09-18T08:00', medications: [{ name: 'Prior-day medicine' }] },
        { dtVal: 'wrong date', medications: [{ name: 'Undated medicine' }] }]),
    } };
  let prescription = pmrs2Prescription(patient);
  assert.equal(prescription.source, 'last-follow-up');
  assert.equal(prescription.sourceDateTime, '2026-09-19T08:00');
  assert.equal(prescription.medications[0].name, 'Last-day medicine');
  assert.deepEqual(['morning','afternoon','evening','night'].map(slot => prescription.medications[0][slot]), ['3','3','3','0']);
  patient.data['system:discharge'] = {
    department: 'ផ្នែកជំងឺទូទៅ', admissionAt: '2026-09-17T14:20', admissionDiagnosis: 'Admission Dx',
    admissionIcd10: 'A90', dischargeAt: '2026-09-19T18:00', dischargeDiagnosis: 'Discharge Dx',
    dischargeIcd10: 'A90', outcome: 'improved', status: 'ordered', followUpDate: '2026-09-27',
    medications: [{ name: 'Edited discharge medicine', route: 'po', unit: 'គ្រាប់', scheduleType: 'qid', doseAmount: '1' }],
  };
  prescription = pmrs2Prescription(patient);
  assert.equal(prescription.source, 'discharge');
  assert.equal(prescription.medications[0].name, 'Edited discharge medicine');
  assert.deepEqual(['morning','afternoon','evening','night'].map(slot => prescription.medications[0][slot]), ['1','1','1','1']);
  const discharge = pmrs2Discharge(patient);
  assert.equal(discharge.dischargeWard, 'ផ្នែកសម្រាកពេទ្យ');
  assert.equal(discharge.dischargeAt, '2026-09-19T18:00');
  assert.equal(discharge.dischargeIcd10, 'A90');
  assert.equal(discharge.outcome, 'ធូរស្រាល');
  assert.equal(discharge.statusCode, 'ordered');
  assert.deepEqual(discharge.warnings, []);
  // An intentionally medicine-free final day must not reuse a prior day's orders.
  latest.medications = [];
  delete patient.data['system:discharge'];
  patient.data['system:dailyMonitoringRecords'] = JSON.stringify([latest, { dtVal: '2026-09-18T08:00', medications: [{ name: 'Prior-day medicine' }] }]);
  prescription = pmrs2Prescription(patient);
  assert.equal(prescription.medications.length, 0);
  assert.ok(prescription.warnings.includes('PRESCRIPTION_EMPTY_REVIEW'));
});

test('reviewed transfer package contains mapped triage, every dated day, discharge prescription, and warnings', () => {
  const patient = { patientKey: 'case:TEST-001', caseNumber: 'TEST-001', healthId: 'HC-TEST-001',
    fullName: 'Test Patient', sex: 'ស្រី', age: '40 ឆ្នាំ', serviceMode: 'ipd',
    departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ',
    entryDate: '2026-09-17', version: 7, updatedAt: 123456789, data: {
      'scope:registration:id:web_time': '09:15',
      'scope:triage:id:p2_weight': '40', 'scope:triage:id:p2_height': '150',
      'scope:triage:id:p2_temp': '37', 'scope:triage:id:p2_bp_sys': '125',
      'scope:triage:id:p2_bp_dia': '60', 'scope:triage:id:p2_pulse': '80',
      'scope:triage:id:p2_resp': '20', 'scope:triage:id:p2_spo2': '99',
      'scope:triage:id:pmrs_chief_complaint': 'Fever',
      'scope:medical:id:emr_pmrs_case_new': true,
      'scope:medical:id:emr_pmrs_case_old': false,
      'scope:medical:id:ipd_history_present_illness': 'Two days of fever',
      'scope:medical:id:emr_pmrs_ipd_diagnosis': 'Dengue fever',
      'scope:medical:id:emr_pmrs_ipd_icd10': 'A90',
      'system:initialIpdMedications': JSON.stringify([{ name: 'A', route: 'po', unit: 'គ្រាប់',
        scheduleType: 'bid', doseAmount: '2' }]),
      'system:dailyMonitoringRecords': JSON.stringify([
        { dtVal: '2026-09-19T08:00', temp: '36', bp_sys: '120', bp_dia: '75', pulse: '78',
          resp: '19', spo2: '99', evol: 'Improving', conclusion: 'Dengue fever', medications: [] },
        { dtVal: '2026-09-18T08:00', temp: '37', bp_sys: '124', bp_dia: '80', pulse: '80',
          resp: '20', spo2: '98', evol: 'Stable', conclusion: 'Dengue fever', medications: [] },
      ]),
      'system:discharge': { department: 'ផ្នែកជំងឺទូទៅ', admissionAt: '2026-09-17T09:15',
        admissionDiagnosis: 'Dengue fever', admissionIcd10: 'A90',
        dischargeAt: '2026-09-19T17:00', dischargeDiagnosis: 'Dengue fever', dischargeIcd10: 'A90',
        outcome: 'improved', status: 'ordered', medications: [{ name: 'B', route: 'po',
          unit: 'គ្រាប់', scheduleType: 'qid', doseAmount: '1' }] },
    } };
  const bundle = buildPmrs2TransferPackage(patient, '2026-09-20T10:00:00.000Z');
  assert.equal(bundle.identity.healthId, 'HC-TEST-001');
  assert.equal(bundle.source.patientVersion, 7);
  assert.equal(bundle.triage.weight, '40');
  assert.equal(bundle.triage.dateTime, '2026-09-17T09:15');
  assert.deepEqual(bundle.followUps.map(day => day.dateTime),
    ['2026-09-17T09:15', '2026-09-18T08:00', '2026-09-19T08:00']);
  assert.equal(bundle.prescription.medications[0].name, 'B');
  assert.equal(bundle.discharge.dischargeAt, '2026-09-19T17:00');
  assert.equal(bundle.readyWithoutWarnings, true);
  assert.deepEqual(bundle.reviewIssues, []);
  assert.equal('data' in bundle, false);
  patient.data['system:discharge'].medications[0].route = 'injection_unspecified';
  const warningBundle = buildPmrs2TransferPackage(patient, '2026-09-20T10:00:00.000Z');
  assert.ok(warningBundle.reviewIssues.some(issue => issue.path === 'prescription.medications[0]' &&
    issue.code === 'MEDICATION_ROUTE_REVIEW'));
  assert.equal(warningBundle.readyWithoutWarnings, false);
});
