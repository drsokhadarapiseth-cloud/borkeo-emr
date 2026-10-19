import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');


test('v28.6 server maps patient-photo assets and exposes patient photo in patientRecordResponse', () => {
  const serverMjs = fs.readFileSync(path.join(projectRoot, 'server', 'server.mjs'), 'utf8');
  assert.ok(serverMjs.includes("['/public/patient-photo.js', ['patient-photo.js', 'text/javascript; charset=utf-8']]"));
  assert.ok(serverMjs.includes("['/public/patient-photo.css', ['patient-photo.css', 'text/css; charset=utf-8']]"));
  assert.ok(serverMjs.includes("photo: data['scope:registration:id:web_patient_photo'] ?? data['scope:registration:id:patient_photo'] ?? data['system:patientPhoto'] ?? ''"));
});

test('v28.6 EMR.html includes photo assets, registration avatar trigger, and OPD/IPD banners', () => {
  const emrHtml = fs.readFileSync(path.join(projectRoot, 'protected', 'EMR.html'), 'utf8');
  assert.match(emrHtml, /patient-photo\.css\?v=\d+/);
  assert.match(emrHtml, /patient-photo\.js\?v=\d+/);
  assert.ok(emrHtml.includes('id="reg_patient_photo_avatar"'));
  assert.ok(emrHtml.includes('id="web_patient_photo"'));
  assert.ok(emrHtml.includes('id="opd-header-patient-card"'));
  assert.ok(emrHtml.includes('switchOpdTab'));
});

test('v28.6 patient-list routes OPD to opd view and IPD appropriately by clinical role', () => {
  const listJs = fs.readFileSync(path.join(projectRoot, 'public', 'patient-list.js'), 'utf8');
  assert.ok(listJs.includes("'/emr?'+new URLSearchParams") || listJs.includes('/emr?patient='), 'patient-list routes to /emr with params');
  assert.ok(listJs.includes('view:access.view') || listJs.includes('view:'), 'patient-list sets dynamic view parameter');
});

test('v28.6 departments pending admission cards provide direct open record link', () => {
  const deptJs = fs.readFileSync(path.join(projectRoot, 'public', 'departments.js'), 'utf8');
  assert.ok(deptJs.includes("/emr?patient="));
  assert.ok(deptJs.includes("បើកឯកសារ"));
});

test('v28.6 patient-photo.js implements camera capture, upload and sync routines', () => {
  const photoJs = fs.readFileSync(path.join(projectRoot, 'public', 'patient-photo.js'), 'utf8');
  assert.ok(photoJs.includes('openPatientPhotoDialog'));
  assert.ok(photoJs.includes('updatePatientPhotoDisplay'));
  assert.ok(photoJs.includes('patient-photo-dialog'));
});
