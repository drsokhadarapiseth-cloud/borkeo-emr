import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const projectRoot = path.resolve('.');

test('current release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.equal(pkg.version, '30.3.0');

  const loginHtml = fs.readFileSync(path.join(projectRoot, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v30\.3/);

  const serverMjs = fs.readFileSync(path.join(projectRoot, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v30\.3/);
});

test('v28.8 access.mjs allows doctor cross-ward access and enforces nurse ward scope', async () => {
  const { patientWorkWard, canAccessPatient } = await import(pathToFileURL(path.join(projectRoot, 'server', 'access.mjs')).href);

  const emergencyPatient = {
    patient_key: 'case:BK-20261010-0033',
    department_code: 'emergency',
    service_mode: 'ipd',
    record_json: JSON.stringify({ 'system:currentRoomId': 'room-emergency-1' }),
  };
  assert.equal(patientWorkWard(emergencyPatient), 'emergency');

  // Doctor in medicine can access emergency IPD patient
  const medicineDoctorSession = {
    active_role: 'DOCTOR',
    active_ward_code: 'medicine',
  };
  assert.equal(canAccessPatient(null, medicineDoctorSession, emergencyPatient), true);

  // Doctor in opd can access emergency IPD patient
  const opdDoctorSession = {
    active_role: 'DOCTOR',
    active_ward_code: 'opd',
  };
  assert.equal(canAccessPatient(null, opdDoctorSession, emergencyPatient), true);

  // Emergency nurse can access emergency patient
  const emergencyNurseSession = {
    active_role: 'NURSE',
    active_ward_code: 'emergency',
  };
  assert.equal(canAccessPatient(null, emergencyNurseSession, emergencyPatient), true);

  // Pediatric nurse CANNOT access emergency patient (ward isolation preserved)
  const pediatricNurseSession = {
    active_role: 'NURSE',
    active_ward_code: 'pediatric',
  };
  assert.equal(canAccessPatient(null, pediatricNurseSession, emergencyPatient), false);

  // Transferred patient is accessible to receiving ward nurse
  const transferredPatient = {
    patient_key: 'case:BK-TRANSFER-1',
    department_code: 'opd',
    service_mode: 'ipd',
    record_json: JSON.stringify({ 'system:transferredWard': 'pediatric' }),
  };
  assert.equal(canAccessPatient(null, pediatricNurseSession, transferredPatient), true);
});

test('v28.8 EMR.html DOMContentLoaded and switchOpdTab handle Page 3 and strict OPD rules', () => {
  const emrHtml = fs.readFileSync(path.join(projectRoot, 'protected', 'EMR.html'), 'utf8');

  // Direct bed view handles Page 3 switching
  assert.ok(emrHtml.includes("var isDirectBedView = ['opd', 'medical', 'daily', 'nursing', 'discharge'].indexOf(requestedBedView) !== -1;"));
  assert.ok(emrHtml.includes("switchPage(3);"));

  // switchOpdTab unblocks nursing tab so admitted patients are never trapped
  assert.ok(!emrHtml.includes("carePath.mode === 'opd' && tabName === 'nursing'"));
});

test('v28.8 emr-inpatient-workflow.js and emr-patient-record.js maintain dedicated before-style bed view and workflow separation', () => {
  const wfJs = fs.readFileSync(path.join(projectRoot, 'public', 'emr-inpatient-workflow.js'), 'utf8');
  assert.ok(wfJs.includes("createWorkspaceNavigation();"));
  assert.ok(wfJs.includes("createPatientSummaryDrawer();"));
  assert.ok(wfJs.includes("showOnlyPage('page3');"));

  const recJs = fs.readFileSync(path.join(projectRoot, 'public', 'emr-patient-record.js'), 'utf8');
  assert.ok(recJs.includes("setWorkflowHidden(opdButton, !isOpd);"));
  assert.ok(recJs.includes("setWorkflowHidden(ipdButton, isOpd);"));
  assert.ok(recJs.includes("setWorkflowHidden(nursingButton, isOpd);"));
});

test('v28.8 departments.js includes medical record option for all staff', () => {
  const deptJs = fs.readFileSync(path.join(projectRoot, 'public', 'departments.js'), 'utf8');
  assert.ok(deptJs.includes("option('medical', text('medicalRecord'))"));
});

test('v28.8 requests.js routes admission approval cleanly to original EMR forms', () => {
  const reqJs = fs.readFileSync(path.join(projectRoot, 'public', 'requests.js'), 'utf8');
  assert.ok(reqJs.includes("r.kind==='ADMISSION'&&r.patientKey"));
  assert.ok(reqJs.includes('/emr?patient='));
  assert.ok(reqJs.includes('reviewRequest='));
});
