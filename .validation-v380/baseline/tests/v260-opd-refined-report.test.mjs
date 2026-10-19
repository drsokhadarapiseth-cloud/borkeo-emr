import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { ensureFinanceSchema } from '../server/finance.mjs';
import { dailyHospitalReport, dailyOpdReport, ensureDailyReportSchema } from '../server/daily-report.mjs';

function createTestDb() {
  const db = openDatabase(':memory:');
  ensureAccessSchema(db);
  ensureFinanceSchema(db);
  ensureDailyReportSchema(db);
  const uid = 'admin-1';
  db.createUser({ id: uid, username: 'admin', displayName: 'Admin', passwordHash: 'x', role: 'ADMIN', createdAt: Date.now() });
  return { db, uid };
}

test('dailyHospitalReport filters out OPD from inpatient ward census table', () => {
  const { db } = createTestDb();
  const report = dailyHospitalReport(db, '2026-10-10');
  
  // Verify OPD is NOT in inpatient wards list
  const opdInWards = report.wards.find(w => w.code === 'opd');
  assert.equal(opdInWards, undefined, 'OPD must not be in IPD wards census list');
  
  // Verify report has opdReport object with indicators
  const indicators = report.opdReport?.indicators || report.opdReport;
  assert.ok(Array.isArray(indicators), 'opdReport indicators should be an array');
  assert.equal(indicators.length, 8, 'opdReport should have 8 indicator rows');
  
  const labels = indicators.map(r => r.label);
  assert.ok(labels.includes('ពិគ្រោះសរុប'));
  assert.ok(labels.includes('កុមារតិចជាង ៥ឆ្នាំ'));
  assert.ok(labels.includes('ពន្យាកំណើត'));
  assert.ok(labels.includes('ពិនិត្យផ្ទៃពោះ'));
  assert.ok(labels.includes('ពិនិត្យថែទាំក្រោយសម្រាល'));
  assert.ok(labels.includes('ពិនិត្យកាមរោគ'));
  assert.ok(labels.includes('ទឹកនោមផ្អែម ករណីថ្មី'));
  assert.ok(labels.includes('លើសសម្ពាធឈាមករណីថ្មី'));
});

test('dailyOpdReport calculates indicators correctly for simulated OPD patients', () => {
  const { db, uid } = createTestDb();
  
  // 1. Adult male with hypertension
  db.sqlite.prepare(`
    INSERT INTO patient_records
    (id, patient_key, case_number, health_id, first_name, last_name, full_name, sex, age, entry_date, service_mode, department_code, department_name_kh, record_json, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'p1', 'case:OPD-01', 'OPD-01', 'HID-01', 'Sok', 'Chan', 'Sok Chan', 'ប្រុស', '45', '2026-10-10', 'opd', 'opd', 'ផ្នែកពិគ្រោះក្រៅ',
    JSON.stringify({
      'scope:medical:id:diag_input': 'I10',
      'scope:medical:id:emr_pmrs_opd_diagnosis': 'លើសសម្ពាធឈាមករណីថ្មី',
    }),
    uid, uid, Date.now(), Date.now()
  );

  // 2. Child under 5 (female, age 3)
  db.sqlite.prepare(`
    INSERT INTO patient_records
    (id, patient_key, case_number, health_id, first_name, last_name, full_name, sex, age, entry_date, service_mode, department_code, department_name_kh, record_json, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'p2', 'case:OPD-02', 'OPD-02', 'HID-02', 'Bopha', 'Keo', 'Keo Bopha', 'ស្រី', '3', '2026-10-10', 'opd', 'opd', 'ផ្នែកពិគ្រោះក្រៅ',
    JSON.stringify({
      'scope:medical:id:diag_input': 'J00',
      'scope:medical:id:emr_pmrs_opd_diagnosis': 'ផ្តាសាយ',
    }),
    uid, uid, Date.now(), Date.now()
  );

  // 3. Female with ANC & Family Planning
  db.sqlite.prepare(`
    INSERT INTO patient_records
    (id, patient_key, case_number, health_id, first_name, last_name, full_name, sex, age, entry_date, service_mode, department_code, department_name_kh, record_json, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'p3', 'case:OPD-03', 'OPD-03', 'HID-03', 'Davy', 'Chea', 'Chea Davy', 'ស្រី', '26', '2026-10-10', 'opd', 'opd', 'ផ្នែកពិគ្រោះក្រៅ',
    JSON.stringify({
      'scope:medical:id:diag_input': 'Z34',
      'scope:medical:id:emr_pmrs_opd_diagnosis': 'ពិនិត្យផ្ទៃពោះ ANC',
    }),
    uid, uid, Date.now(), Date.now()
  );

  // Add clinical form for ANC
  db.sqlite.prepare(`
    INSERT INTO clinical_form_records
    (id, patient_key, form_type, patient_json, form_data_json, version, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
  `).run('f1', 'case:OPD-03', 'anc', '{}', '{}', uid, uid, Date.now(), Date.now());

  // 4. Male with Diabetes
  db.sqlite.prepare(`
    INSERT INTO patient_records
    (id, patient_key, case_number, health_id, first_name, last_name, full_name, sex, age, entry_date, service_mode, department_code, department_name_kh, record_json, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    'p4', 'case:OPD-04', 'OPD-04', 'HID-04', 'Vannak', 'Mao', 'Mao Vannak', 'ប្រុស', '50', '2026-10-10', 'opd', 'opd', 'ផ្នែកពិគ្រោះក្រៅ',
    JSON.stringify({
      'scope:medical:id:diag_input': 'E11',
      'scope:medical:id:emr_pmrs_opd_diagnosis': 'ជំងឺទឹកនោមផ្អែម',
    }),
    uid, uid, Date.now(), Date.now()
  );

  const res = dailyOpdReport(db, '2026-10-10');
  const indicators = res.indicators || res;
  const getInd = key => indicators.find(r => r.key === key);

  // Total: 4 (2 Male, 2 Female)
  const total = getInd('total');
  assert.equal(total.total, 4);
  assert.equal(total.male, 2);
  assert.equal(total.female, 2);

  // Under 5: 1 (p2, female)
  const under5 = getInd('under5');
  assert.equal(under5.total, 1);
  assert.equal(under5.female, 1);
  assert.equal(under5.male, 0);

  // ANC: 1 (p3, female)
  const anc = getInd('anc');
  assert.equal(anc.total, 1);
  assert.equal(anc.female, 1);

  // Diabetes New: 1 (p4, male)
  const diabetes = getInd('diabetesNew');
  assert.equal(diabetes.total, 1);
  assert.equal(diabetes.male, 1);

  // Hypertension New: 1 (p1, male)
  const htn = getInd('hypertensionNew');
  assert.equal(htn.total, 1);
  assert.equal(htn.male, 1);
});
