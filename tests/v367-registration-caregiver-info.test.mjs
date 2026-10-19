import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';

const ROOT = path.resolve('.');

test('v36.7 - Version metadata consistency across package.json, login.html, server.mjs and templates', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '36.7.0');

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v36\.7/);

  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v36\.7/);

  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('/public/emr-patient-record.js?v=3670'));
  assert.ok(emrHtml.includes('/public/emr-permissions.js?v=3670'));

  const patientListHtml = fs.readFileSync(path.join(ROOT, 'protected', 'patient-list.html'), 'utf8');
  assert.ok(patientListHtml.includes('/public/patient-list.js?v=3670'));

  const triageHtml = fs.readFileSync(path.join(ROOT, 'protected', 'triage.html'), 'utf8');
  assert.ok(triageHtml.includes('/public/patient-list.js?v=3670'));
});

test('v36.7 - Caregiver info section (ព័ត៌មានអ្នកកំដរ) in protected and legacy EMR.html', () => {
  const protectedHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), 'utf8');

  for (const html of [protectedHtml, legacyHtml]) {
    assert.ok(html.includes('id="caregiver_section"'), 'Must have caregiver_section');
    assert.ok(html.includes('ព័ត៌មានអ្នកកំដរ'), 'Must display title ព័ត៌មានអ្នកកំដរ');
    assert.ok(html.includes('id="web_caregiver_name"'), 'Must have caregiver name input');
    assert.ok(html.includes('id="web_caregiver_phone"'), 'Must have caregiver phone input');
    assert.ok(html.includes('id="web_caregiver_relation"'), 'Must have caregiver relation dropdown');
    assert.ok(html.includes('id="web_caregiver_sex_male"'), 'Must have male sex radio');
    assert.ok(html.includes('id="web_caregiver_sex_female"'), 'Must have female sex radio');
    assert.ok(html.includes('placeholder="000 000 0000"'), 'Must have phone placeholder 000 000 0000');
    assert.ok(html.includes('ជ្រើសរើស'), 'Must have default dropdown option ជ្រើសរើស');
    assert.ok(html.includes('ឪពុក/ម្ដាយ'), 'Must contain ឪពុក/ម្ដាយ option');
    assert.ok(html.includes('ប្ដី/ប្រពន្ធ'), 'Must contain ប្ដី/ប្រពន្ធ option');
  }
});

test('v36.7 - public/emr-patient-record.js reads and restores caregiver fields', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'emr-patient-record.js'), 'utf8');

  assert.ok(code.includes("data['scope:registration:id:web_caregiver_name'] = caregiverName"));
  assert.ok(code.includes("data['scope:registration:id:web_caregiver_phone'] = caregiverPhone"));
  assert.ok(code.includes("data['scope:registration:id:web_caregiver_relation'] = caregiverRelation"));
  assert.ok(code.includes("data['scope:registration:id:web_caregiver_sex'] = caregiverSex"));

  assert.ok(code.includes("const cName = data['scope:registration:id:web_caregiver_name']"));
  assert.ok(code.includes("const cPhone = data['scope:registration:id:web_caregiver_phone']"));
  assert.ok(code.includes("const cRelation = data['scope:registration:id:web_caregiver_relation']"));
  assert.ok(code.includes("const cSex = data['scope:registration:id:web_caregiver_sex']"));
});

test('v36.7 - Database persistence of registration record with caregiver data', () => {
  const db = openDatabase(':memory:');
  try {
    const patientKey = 'TEST-CAREGIVER-001';
    const patientData = {
      'scope:registration:id:web_last_name': 'សុខ',
      'scope:registration:id:web_first_name': 'ចន្ថា',
      'scope:registration:id:web_caregiver_name': 'កែវ វិបុល',
      'scope:registration:id:web_caregiver_phone': '012 345 678',
      'scope:registration:id:web_caregiver_relation': 'ប្ដី/ប្រពន្ធ',
      'scope:registration:id:web_caregiver_sex': 'ប្រុស',
    };

    const summary = {
      caseNumber: '160201-REG-261016-001',
      healthId: '160201-261016-001',
      fullName: 'សុខ ចន្ថា',
      lastName: 'សុខ',
      firstName: 'ចន្ថា',
      dateOfBirth: '1995-05-10',
      age: '29',
      sex: 'ស្រី',
      phone: '098 765 432',
      equityCard: '',
      paymentType: 'PAYING',
      departmentCode: 'triage',
      departmentNameKh: 'ផ្នែកពិនិត្យជំងឺទូទៅ',
      departmentNameEn: 'General OPD',
      serviceMode: 'opd',
      entryDate: '2026-10-16',
      dischargeDate: '',
    };

    db.sqlite.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, role, is_active, created_at, updated_at)
      VALUES ('user_reg', 'registration', 'Registration Clerk', 'hash', 'REGISTRATION', 1, 1000, 1000)
    `).run();

    db.upsertPatient({
      id: 'test-cg-id',
      patientKey,
      summary,
      data: patientData,
      userId: 'user_reg',
      savedAt: Date.now(),
    });
    const row = db.findPatient(patientKey);
    assert.ok(row, 'Patient record must exist');

    const parsed = JSON.parse(row.record_json);
    assert.equal(parsed['scope:registration:id:web_caregiver_name'], 'កែវ វិបុល');
    assert.equal(parsed['scope:registration:id:web_caregiver_phone'], '012 345 678');
    assert.equal(parsed['scope:registration:id:web_caregiver_relation'], 'ប្ដី/ប្រពន្ធ');
    assert.equal(parsed['scope:registration:id:web_caregiver_sex'], 'ប្រុស');
  } finally {
    db.close();
  }
});

test('v36.7 - HEF ID panel formats date of birth in international numerals DD/MM/YYYY', () => {
  const hefJs = fs.readFileSync(path.join(ROOT, 'public', 'hef-lookup.js'), 'utf8');

  // Verify formatHefDate returns international numerals
  assert.ok(hefJs.includes('return `${parts[2]}/${parts[1]}/${parts[0]}`;'));
  assert.ok(!hefJs.includes('String.fromCharCode(0x17e0'));
});

test('v36.7 - Cambodia address updates operational district coverage area (តំបន់ទទួលខុសត្រូវ)', () => {
  const addrJs = fs.readFileSync(path.join(ROOT, 'public', 'cambodia-address.js'), 'utf8');
  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');

  // Verify onDistrictChange triggers updateCoverageAreaFromDistrict
  assert.ok(addrJs.includes("window.updateCoverageAreaFromDistrict(districtItem ? districtItem.code : '', districtItem ? districtItem.nameKh : '')"));
  assert.ok(addrJs.includes("window.updateCoverageAreaFromDistrict(d.code, d.nameKh)"));

  // Verify syncFields syncs coverage area from district
  assert.ok(emrHtml.includes("window.updateCoverageAreaFromDistrict(distCode, distVal)"));
});

test('v36.7 - Report print preview hardening against off-screen RAF and network errors', () => {
  const printJs = fs.readFileSync(path.join(ROOT, 'public', 'report-print.js'), 'utf8');

  assert.ok(printJs.includes('nextFrame'));
  assert.ok(printJs.includes('nextFrame(view)'));
  assert.ok(printJs.includes('nextFrame(frame.contentWindow)'));
  assert.ok(!printJs.includes('if(!response.ok)throw new Error(\'Could not load print layout'));
});

