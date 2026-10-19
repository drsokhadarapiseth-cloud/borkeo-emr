import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';

const ROOT = path.resolve('.');

test('v36.5 - Version metadata consistency across package.json, login.html, server.mjs and templates', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(['36.5.0', '36.6.0', '36.7.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v36\.[5-7]/);

  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v36\.[5-7]/);

  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('/public/emr-permissions.js?v=3660') || emrHtml.includes('/public/emr-permissions.js?v=3670'));
  assert.ok(emrHtml.includes('/public/emr-patient-record.js?v=3660') || emrHtml.includes('/public/emr-patient-record.js?v=3670'));

  const patientListHtml = fs.readFileSync(path.join(ROOT, 'protected', 'patient-list.html'), 'utf8');
  assert.ok(patientListHtml.includes('/public/patient-list.js?v=3660') || patientListHtml.includes('/public/patient-list.js?v=3670'));

  const triageHtml = fs.readFileSync(path.join(ROOT, 'protected', 'triage.html'), 'utf8');
  assert.ok(triageHtml.includes('/public/patient-list.js?v=3660') || triageHtml.includes('/public/patient-list.js?v=3670'));
});

test('v36.5 - public/emr-permissions.js never sets Triage to read-only and removes read-only badge', () => {
  const perms = fs.readFileSync(path.join(ROOT, 'public', 'emr-permissions.js'), 'utf8');

  // Verify setReadonly(triage, false) is called
  assert.ok(perms.includes('setReadonly(triage, false);'));

  // Verify emr-permission-readonly class is removed from triage
  assert.ok(perms.includes("if (triage) triage.classList.remove('emr-permission-readonly');"));

  // Verify save bar and save button are not hidden
  assert.ok(perms.includes("triageSaveBar.removeAttribute('hidden');"));
  assert.ok(perms.includes("triageSaveBtn.removeAttribute('hidden');"));
});

test('v36.5 - public/emr-patient-record.js keeps triage controls unlocked and ready to save', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'emr-patient-record.js'), 'utf8');

  // setTriageControlsLocked sets locked = false
  assert.ok(js.includes('function setTriageControlsLocked(locked)'));
  assert.ok(js.includes('locked = false;'));

  // updateTriageSaveButtonState sets canEditTriage = true and displays save_transfer
  assert.ok(js.includes('function updateTriageSaveButtonState'));
  assert.ok(js.includes('const canEditTriage = true;'));
  assert.ok(js.includes("btn.dataset.mode = 'save_transfer'"));
  assert.ok(js.includes('រក្សាទុក និងបញ្ជូនទៅផ្នែក'));
});

test('v36.5 - server/server.mjs merges triage data across clinical roles when saving triage', () => {
  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');

  // Verify effectiveRoleForMerge logic
  assert.ok(serverMjs.includes("const effectiveRoleForMerge = registrationSave ? 'REGISTRATION' : (triageSave ? 'TRIAGE' : activeRoleBeforeSave);"));
  assert.ok(serverMjs.includes("summary = mergePatientSummaryForRole(existingPatient, submittedSummary, effectiveRoleForMerge);"));
  assert.ok(serverMjs.includes("const data = mergeRecordDataForRole(existingData, submittedData, effectiveRoleForMerge, Boolean(existingPatient));"));
});
