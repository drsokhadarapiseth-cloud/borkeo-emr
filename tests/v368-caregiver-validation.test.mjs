import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';

const ROOT = path.resolve('.');


test('v36.8 - Caregiver info (ព័ត៌មានអ្នកកំដរ) has red asterisks on title and all fields in protected and legacy EMR.html', () => {
  const protectedHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), 'utf8');

  for (const html of [protectedHtml, legacyHtml]) {
    assert.ok(html.includes('ព័ត៌មានអ្នកកំដរ <span style="color:red">*</span>'), 'Title must have red asterisk');
    assert.ok(html.includes('ឈ្មោះអ្នកកំដរ <span style="color:red">*</span>'), 'Name label must have red asterisk');
    assert.ok(html.includes('លេខទូរសព្ទ <span style="color:red">*</span>'), 'Phone label must have red asterisk');
    assert.ok(html.includes('ទំនាក់ទំនង <span style="color:red">*</span>'), 'Relation label must have red asterisk');
    assert.ok(html.includes('ភេទ <span style="color:red">*</span>'), 'Sex label must have red asterisk');
  }
});

test('v36.8 - CSS contains .field-missing red highlight styles', () => {
  const protectedHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), 'utf8');

  for (const html of [protectedHtml, legacyHtml]) {
    assert.ok(html.includes('.field-missing {'), 'Must include .field-missing CSS');
    assert.ok(html.includes('border-color: #dc2626 !important;'), 'Must have red border');
  }
});

test('v36.8 - public/emr-patient-record.js validates caregiver info and prevents saving / transfer if incomplete', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'emr-patient-record.js'), 'utf8');

  assert.ok(code.includes('function validateCaregiverInfo()'), 'Must define validateCaregiverInfo');
  assert.ok(code.includes('window.validateCaregiverInfo = validateCaregiverInfo'), 'Must expose validateCaregiverInfo');
  assert.ok(code.includes('web_caregiver_name'), 'Must check caregiver name');
  assert.ok(code.includes('web_caregiver_phone'), 'Must check caregiver phone');
  assert.ok(code.includes('web_caregiver_relation'), 'Must check caregiver relation');
  assert.ok(code.includes('web_caregiver_sex'), 'Must check caregiver sex');
  assert.ok(code.includes('field-missing'), 'Must highlight missing fields with class field-missing');
  assert.ok(code.includes('សូមបំពេញព័ត៌មានអ្នកកំដរឱ្យបានគ្រប់ជ្រុងជ្រោយ'), 'Must provide Khmer alert message');

  // Verify validatePatient checks caregiver info
  assert.ok(code.includes('const caregiverError = validateCaregiverInfo()'), 'validatePatient must invoke validateCaregiverInfo');
  assert.ok(code.includes('if (caregiverError) return caregiverError'), 'validatePatient must block when caregiver info is incomplete');
});

test('v36.8 - switchPage blocks navigation to page 2 or 3 when caregiver info is incomplete on page 1', () => {
  const protectedHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), 'utf8');

  for (const html of [protectedHtml, legacyHtml]) {
    assert.ok(html.includes('validateCaregiverInfoForForm'), 'Must have validateCaregiverInfoForForm helper');
    assert.ok(html.includes("document.getElementById('page1')?.classList.contains('active')"), 'Must check if page 1 is active');
    assert.ok(html.includes('Number(pageNumber) > 1'), 'Must check if attempting to navigate past page 1');
  }
});

test('v36.8 - Database persistence of registration record with caregiver data continues to work', () => {
  const db = openDatabase(':memory:');
  try {
    const patientKey = 'TEST-CAREGIVER-V368';
    const patientData = {
      'scope:registration:id:web_last_name': 'ខៀវ',
      'scope:registration:id:web_first_name': 'សុភ័ក្ត្រ',
      'scope:registration:id:web_caregiver_name': 'ម៉ែន ចាន់ដា',
      'scope:registration:id:web_caregiver_phone': '011 223 344',
      'scope:registration:id:web_caregiver_relation': 'ឪពុក/ម្ដាយ',
      'scope:registration:id:web_caregiver_sex': 'ស្រី',
    };

    const summary = {
      caseNumber: '160201-REG-261017-002',
      healthId: '160201-261017-002',
      fullName: 'ខៀវ សុភ័ក្ត្រ',
      lastName: 'ខៀវ',
      firstName: 'សុភ័ក្ត្រ',
      dateOfBirth: '1998-03-12',
      age: '28',
      sex: 'ប្រុស',
      phone: '012 999 888',
      equityCard: '',
      paymentType: 'PAYING',
      departmentCode: 'triage',
      departmentNameKh: 'ផ្នែកពិនិត្យជំងឺទូទៅ',
      departmentNameEn: 'General OPD',
      serviceMode: 'opd',
      entryDate: '2026-10-17',
      dischargeDate: '',
    };

    db.sqlite.prepare(`
      INSERT INTO users (id, username, display_name, password_hash, role, is_active, created_at, updated_at)
      VALUES ('user_reg', 'registration', 'Registration Clerk', 'hash', 'REGISTRATION', 1, 1000, 1000)
    `).run();

    db.upsertPatient({
      id: 'test-cg-v368',
      patientKey,
      summary,
      data: patientData,
      userId: 'user_reg',
      savedAt: Date.now(),
    });

    const row = db.findPatient(patientKey);
    assert.ok(row, 'Patient record must exist');

    const parsed = JSON.parse(row.record_json);
    assert.equal(parsed['scope:registration:id:web_caregiver_name'], 'ម៉ែន ចាន់ដា');
    assert.equal(parsed['scope:registration:id:web_caregiver_phone'], '011 223 344');
    assert.equal(parsed['scope:registration:id:web_caregiver_relation'], 'ឪពុក/ម្ដាយ');
    assert.equal(parsed['scope:registration:id:web_caregiver_sex'], 'ស្រី');
  } finally {
    db.close();
  }
});
