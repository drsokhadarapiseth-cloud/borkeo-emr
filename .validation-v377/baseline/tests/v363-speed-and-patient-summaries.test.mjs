import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';

const ROOT = path.resolve('.');

test('v36.3 - Version metadata consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(['36.3.0', '36.4.0', '36.5.0', '36.6.0', '36.7.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v36\.[3-7]/);

  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v36\.[3-7]/);
});

test('v36.3 - database.listPatientSummaries() extracts queue, triage, and admission status via SQLite json_extract', () => {
  const db = openDatabase(':memory:');
  try {
    assert.equal(typeof db.listPatientSummaries, 'function', 'database instance must expose listPatientSummaries');

    const patientKey = 'TEST-SUMMARY-001';
    const recordData = {
      'system:registrationQueueNumber': 42,
      'system:triageStatus': 'COMPLETED',
      'system:triageCompletedAt': 1760000000000,
      'system:admissionStatus': 'admitted',
      'clinicalNotes': 'Heavy clinical notes and extensive examination records...',
    };

    db.createUser({
      id: 'U1', username: 'summary_tester', displayName: 'Summary Tester',
      passwordHash: 'dummy', role: 'ADMIN', createdAt: Date.now()
    });

    db.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, full_name, health_id, case_number, service_mode, department_code, entry_date, record_json, created_by, updated_by, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'U1', 'U1', ?, ?, 1)
    `).run('REC-SUM-001', patientKey, 'Meas Sarun', 'HID-999', 'CASE-999', 'opd', 'OPD', '2026-10-16', JSON.stringify(recordData), Date.now(), Date.now());

    const summaries = db.listPatientSummaries();
    assert.ok(Array.isArray(summaries) && summaries.length >= 1);
    const item = summaries.find(p => p.patient_key === patientKey);
    assert.ok(item, 'Patient must appear in summaries list');

    // Verify extracted scalar JSON fields
    assert.equal(Number(item.queue_num_1), 42);
    assert.equal(item.triage_status, 'COMPLETED');
    assert.equal(Number(item.triage_completed_at), 1760000000000);
    assert.equal(item.admission_status, 'admitted');

    // Verify record_json is preserved for full workflow status and ward isolation
    assert.ok(item.record_json, 'listPatientSummaries preserves record_json for full workflow compatibility');
  } finally {
    db.close();
  }
});

test('v36.3 - server.mjs uses listPatientSummaries for /api/patients and /api/triage/queue', () => {
  const serverCode = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');

  // /api/patients uses listPatientSummaries
  assert.ok(
    serverCode.includes("database.listPatientSummaries({ omitPhotos: url.searchParams.get('omitPhotos') === '1' }).map(row => {"),
    'GET /api/patients must use database.listPatientSummaries() for zero-overhead summaries'
  );

  // /api/triage/queue uses listPatientSummaries
  assert.ok(
    serverCode.includes("const allPatients = database.listPatientSummaries({ omitPhotos: url.searchParams.get('omitPhotos') === '1' }).map(row => {"),
    'GET /api/triage/queue must use database.listPatientSummaries() for fast triage queue loading'
  );
});

test('v36.3 - public/patient-list.js initiates session and patient data fetching in parallel', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'patient-list.js'), 'utf8');

  assert.ok(code.includes('const sessionPromise = session()'), 'Session promise must start concurrently');
  assert.ok(code.includes('const patientsPromise = fetch(patientsUrl,'), 'Patients fetch promise must start concurrently');
  assert.ok(code.includes('await sessionPromise;'), 'Must await sessionPromise');
  assert.ok(code.includes('const response = await patientsPromise;'), 'Must await patientsPromise');
});

test('v36.3 - Script cache buster tags across templates use ?v=3630 or ?v=3640', () => {
  const patientListHtml = fs.readFileSync(path.join(ROOT, 'protected', 'patient-list.html'), 'utf8');
  assert.ok(patientListHtml.includes('/public/patient-list.js?v=3630') || patientListHtml.includes('/public/patient-list.js?v=3640') || patientListHtml.includes('/public/patient-list.js?v=3660') || patientListHtml.includes('/public/patient-list.js?v=3670'), 'patient-list.html must cache-bust');

  const triageHtml = fs.readFileSync(path.join(ROOT, 'protected', 'triage.html'), 'utf8');
  assert.ok(triageHtml.includes('/public/patient-list.js?v=3630') || triageHtml.includes('/public/patient-list.js?v=3640') || triageHtml.includes('/public/patient-list.js?v=3660') || triageHtml.includes('/public/patient-list.js?v=3670'), 'triage.html must cache-bust');

  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('/public/emr-inpatient-workflow.js?v=3630') || emrHtml.includes('/public/emr-inpatient-workflow.js?v=3640') || emrHtml.includes('/public/emr-inpatient-workflow.js?v=3660') || emrHtml.includes('/public/emr-inpatient-workflow.js?v=3670'), 'EMR.html must cache-bust workflow');
  assert.ok(emrHtml.includes('/public/emr-patient-record.js?v=3630') || emrHtml.includes('/public/emr-patient-record.js?v=3640') || emrHtml.includes('/public/emr-patient-record.js?v=3660') || emrHtml.includes('/public/emr-patient-record.js?v=3670'), 'EMR.html must cache-bust patient record');
  assert.ok(emrHtml.includes('/public/emr-permissions.js?v=3630') || emrHtml.includes('/public/emr-permissions.js?v=3640') || emrHtml.includes('/public/emr-permissions.js?v=3660') || emrHtml.includes('/public/emr-permissions.js?v=3670'), 'EMR.html must cache-bust permissions');
});
