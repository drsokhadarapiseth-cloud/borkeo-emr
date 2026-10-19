import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');

test('v29.3 patient-list.js: registration account edits directly without management approval', () => {
  const patientListJs = fs.readFileSync(path.join(projectRoot, 'public/patient-list.js'), 'utf8');

  // Verify registration role check and direct register view
  assert.ok(patientListJs.includes("if (activeRole === 'REGISTRATION') return true;"));
  assert.ok(patientListJs.includes("if (activeRole === 'REGISTRATION') return 'register';"));

  // Verify edit routing and approval request
  assert.ok(patientListJs.includes("location.assign('/emr?'+new URLSearchParams({patient:patient.patientKey,view:access.view,mode:'edit'}));"));
  assert.ok(patientListJs.includes("submitPatientRequest('PATIENT_EDIT',patient,access.scope)"));
});
