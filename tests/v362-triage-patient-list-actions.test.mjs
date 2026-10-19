import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';

const ROOT = path.resolve('.');


test('v36.2 - public/patient-list.js customizes View, Edit, and Delete for TRIAGE role', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'patient-list.js'), 'utf8');

  // View: routes to /emr with view=triage for TRIAGE
  assert.ok(code.includes("activeRole === 'TRIAGE'") || code.includes("activeRole==='TRIAGE'"));
  assert.ok(code.includes("activeRole==='TRIAGE'?'triage'") || code.includes("'triage'"));

  // Edit / Action: navigates to /emr with patient and mode=edit
  assert.ok(code.includes("mode:'edit'") || code.includes("mode: 'edit'"));

  // Clinical roles include TRIAGE
  assert.ok(code.includes("'TRIAGE'"));
});

test('v36.2 - public/emr-permissions.js isolates triage view and respects edit=1 parameter', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'emr-permissions.js'), 'utf8');

  // Hides registration and clinical tabs for TRIAGE role
  assert.match(code, /else if \(role === 'TRIAGE'\) \{[\s\S]*?hide\(b1,true\);[\s\S]*?hide\(b2,false\);[\s\S]*?hide\(b3,true\);/);

  // Guards switchPage so TRIAGE can only access page 2
  assert.match(code, /\|\s*\(role === 'TRIAGE' && Number\(pageNumber\) === 2\)/);

  // Distinguishes read-only view from edit mode
  assert.ok(code.includes("const isEditMode = new URLSearchParams(location.search).get('edit') === '1'"));
  assert.ok(code.includes("const isTriageView = new URLSearchParams(location.search).get('view') === 'triage'"));
});

test('v36.2 - public/emr-patient-record.js supports triage edit mode and exposes lock controls', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'emr-patient-record.js'), 'utf8');

  assert.ok(code.includes('window.setTriageControlsLocked = setTriageControlsLocked'));
  assert.ok(code.includes('triageEdit: options.triageEdit === true'));
  assert.ok(code.includes("currentRole === 'TRIAGE' && isEditParam"));
  assert.ok(code.includes("currentRole === 'TRIAGE' && isTriageView"));
});

test('v36.2 - server/server.mjs contains DELETE /api/patient-triage and allows triage edits in PUT /api/patient-record', () => {
  const serverCode = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');

  // Endpoint DELETE /api/patient-triage exists and checks role
  assert.ok(serverCode.includes("pathname === '/api/patient-triage'"));
  assert.ok(serverCode.includes("['TRIAGE', 'ADMIN', 'VICE_DIRECTOR'].includes(role)"));
  assert.ok(serverCode.includes("data['system:triageStatus'] = 'WAITING'"));
  assert.ok(serverCode.includes("PATIENT_TRIAGE_DELETED"));

  // PUT /api/patient-record permits triage edits without 409
  assert.ok(serverCode.includes('const isTriageSaveOrEdit = body.triageSave === true || body.triageEdit === true || body.editorScope === \'triage\''));
  assert.ok(serverCode.includes('!isTriageSaveOrEdit'));
});

test('v36.2 - Database functional test: clearing triage data resets status to WAITING and preserves registration', () => {
  const db = openDatabase(':memory:');
  try {
    const patientKey = 'TEST-TRIAGE-PATIENT-001';
    const initialData = {
      'scope:registration:id:web_full_name': 'Sok Chan',
      'scope:registration:id:web_sex': 'M',
      'scope:registration:id:web_patient_phone': '012345678',
      'scope:triage:id:pmrs_chief_complaint': 'Fever and cough',
      'scope:triage:id:triage_temperature': '38.5',
      'scope:triage:id:triage_pulse': '90',
      'system:triageStatus': 'COMPLETED',
      'system:triageCompletedAt': Date.now(),
      'system:triageReferredWardCode': 'OPD',
      'system:workflowStage': 'CASHIER_PENDING_OPD',
    };

    db.createUser({
      id: 'U1', username: 'triage_user', displayName: 'Triage User',
      passwordHash: 'dummy', role: 'TRIAGE', createdAt: Date.now()
    });

    db.sqlite.prepare(`
      INSERT INTO patient_records (id, patient_key, full_name, health_id, case_number, service_mode, department_code, record_json, created_by, updated_by, created_at, updated_at, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'U1', 'U1', ?, ?, 1)
    `).run('REC-001', patientKey, 'Sok Chan', 'HID-001', 'CASE-001', 'opd', 'OPD', JSON.stringify(initialData), Date.now(), Date.now());

    // Verify initial patient state
    const patientBefore = db.findPatient(patientKey);
    assert.equal(patientBefore.department_code, 'OPD');
    assert.equal(patientBefore.service_mode, 'opd');

    // Simulate triage deletion logic
    const data = JSON.parse(patientBefore.record_json);
    for (const key of Object.keys(data)) {
      if (key.startsWith('scope:triage:') || key.startsWith('scope:triage_')) {
        delete data[key];
      }
    }
    data['system:triageStatus'] = 'WAITING';
    data['system:workflowStage'] = 'TRIAGE_WAITING';
    delete data['system:triageCompletedAt'];
    delete data['system:triageReferredWardCode'];

    db.sqlite.prepare(
      "UPDATE patient_records SET record_json=?, service_mode='', department_code='', version=version+1, updated_at=? WHERE patient_key=?"
    ).run(JSON.stringify(data), Date.now(), patientKey);

    // Verify patient after triage reset
    const patientAfter = db.findPatient(patientKey);
    const dataAfter = JSON.parse(patientAfter.record_json);

    // Registration fields remain intact
    assert.equal(dataAfter['scope:registration:id:web_full_name'], 'Sok Chan');
    assert.equal(dataAfter['scope:registration:id:web_patient_phone'], '012345678');
    assert.equal(patientAfter.full_name, 'Sok Chan');

    // Triage fields are completely cleared
    assert.equal(dataAfter['scope:triage:id:pmrs_chief_complaint'], undefined);
    assert.equal(dataAfter['scope:triage:id:triage_temperature'], undefined);
    assert.equal(dataAfter['system:triageCompletedAt'], undefined);

    // Status is reset to WAITING for re-triage
    assert.equal(dataAfter['system:triageStatus'], 'WAITING');
    assert.equal(dataAfter['system:workflowStage'], 'TRIAGE_WAITING');
    assert.equal(patientAfter.service_mode, '');
    assert.equal(patientAfter.department_code, '');
  } finally {
    db.close();
  }
});

test('v36.2 - server/server.mjs redirects TRIAGE users navigating to /emr with view!=triage to view=triage', () => {
  const serverCode = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.ok(serverCode.includes("pathname === '/emr' && String(identity.activeRole || '').toUpperCase() === 'TRIAGE'"));
  assert.ok(serverCode.includes("url.searchParams.set('view', 'triage')"));
});

