import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');

test('v29.3 patient-list.js: registration account edits directly without management approval', () => {
  const patientListJs = fs.readFileSync(path.join(projectRoot, 'public/patient-list.js'), 'utf8');

  // Verify registration edit title
  assert.match(patientListJs, /const editTitle =/);
  assert.match(patientListJs, /កែប្រែព័ត៌មានចុះឈ្មោះ \(Edit Registration\)/);
  assert.match(patientListJs, /Edit Registration Information/);

  // Verify registration bypasses approval request and redirects to register view
  assert.match(patientListJs, /\['REGISTRATION',\s*'ADMIN',\s*'VICE_DIRECTOR'\]\.includes\(activeRole\)/);
  assert.match(patientListJs, /window\.location\.assign\(`\/emr\?patient=\$\{encodeURIComponent\(patientKey\)\}&view=register`\)/);

  // Verify non-registration still uses request to Director
  assert.match(patientListJs, /body:\s*JSON\.stringify\(\{\s*kind:\s*'PATIENT_EDIT',\s*patientKey,\s*reason:\s*reason\.trim\(\)\s*\}\)/);
});
