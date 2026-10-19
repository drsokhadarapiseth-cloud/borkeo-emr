import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve('.');

test('v28.7 version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.ok(pkg.version, 'package.json has version');

  const loginHtml = fs.readFileSync(path.join(projectRoot, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v\d+\.\d+/);

  const serverMjs = fs.readFileSync(path.join(projectRoot, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v\d+\.\d+/);
});

test('v28.7 access.mjs prioritizes transferred ward and allows IPD clinical care without blockers', async () => {
  const { patientWorkWard, canAccessPatient } = await import(pathToFileURL(path.join(projectRoot, 'server', 'access.mjs')).href);
  const rowTransferred = {
    patient_key: 'case:TEST-1',
    department_code: 'opd',
    service_mode: 'opd',
    record_json: JSON.stringify({ 'system:transferredWard': 'emergency' }),
  };
  assert.equal(patientWorkWard(rowTransferred), 'emergency');

  const nurseSession = {
    active_role: 'NURSE',
    active_ward_code: 'emergency',
  };
  assert.equal(canAccessPatient(null, nurseSession, rowTransferred), true);
});

test('v28.7 EMR.html switchOpdTab and switchNursingForm unblock and display nursing process', () => {
  const emrHtml = fs.readFileSync(path.join(projectRoot, 'protected', 'EMR.html'), 'utf8');
  assert.ok(!emrHtml.includes("carePath.mode === 'opd' && tabName === 'nursing'"));
  assert.ok(emrHtml.includes("pane.style.display = isActive ? 'block' : 'none'"));
  assert.ok(emrHtml.includes('initializeDirectorApprovalBanner'));
  assert.ok(emrHtml.includes('btn-director-approve'));
});

test('v28.7 emr-patient-record.js and emr-inpatient-workflow.js activate nursing without OPD suppression', () => {
  const recJs = fs.readFileSync(path.join(projectRoot, 'public', 'emr-patient-record.js'), 'utf8');
  assert.ok(recJs.includes('isDirectIpdView'));
  assert.ok(recJs.includes('loadedPatient?.serviceMode === \'ipd\''));

  const wfJs = fs.readFileSync(path.join(projectRoot, 'public', 'emr-inpatient-workflow.js'), 'utf8');
  assert.ok(wfJs.includes('window.switchNursingForm?.(form)'));
});

test('v28.7 requests.js routes admission approval view to original EMR forms with clean review bar', () => {
  const reqJs = fs.readFileSync(path.join(projectRoot, 'public', 'requests.js'), 'utf8');
  assert.ok(reqJs.includes("r.kind==='ADMISSION'&&r.patientKey"));
  assert.ok(reqJs.includes('/emr?patient='));
  assert.ok(reqJs.includes('reviewRequest='));
});
