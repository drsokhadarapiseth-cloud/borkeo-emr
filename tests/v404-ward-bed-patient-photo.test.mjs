import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('v40.4 ward bed popup photo: bed dialog displays patient photo and fallback next to patient identity', () => {
  const departmentsJs = fs.readFileSync(path.join(projectRoot, 'public', 'departments.js'), 'utf8');
  const departmentsCss = fs.readFileSync(path.join(projectRoot, 'public', 'departments.css'), 'utf8');

  // 1. departments.js defines patientAvatarHtml helper
  assert.match(departmentsJs, /function patientAvatarHtml\(patient,\s*name\)/, 'departments.js must define patientAvatarHtml');
  assert.match(departmentsJs, /bed-patient-avatar-img/, 'departments.js must render bed-patient-avatar-img for patient photo');
  assert.match(departmentsJs, /bed-patient-avatar-empty/, 'departments.js must render bed-patient-avatar-empty as fallback');

  // 2. departments.js includes avatar in bed dialogs
  assert.match(departmentsJs, /has-patient-avatar/, 'departments.js must use has-patient-avatar class on patient cards');
  assert.match(departmentsJs, /patientAvatarHtml\(patient,\s*pName\)/, 'openBedModal and transfer dialog must call patientAvatarHtml');

  // 3. departments.css styles the avatar next to details
  assert.match(departmentsCss, /\.bed-transfer-patient-card\.has-patient-avatar/, 'departments.css must define flex layout for card with avatar');
  assert.match(departmentsCss, /\.bed-patient-avatar\s*\{/, 'departments.css must define styles for .bed-patient-avatar');
  assert.match(departmentsCss, /\.bed-transfer-patient-details/, 'departments.css must define layout for patient details');
});
