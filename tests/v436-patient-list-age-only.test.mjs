import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('v43.6: Patient list table row renders age badge only and omits date of birth', () => {
  const code = read('public/patient-list.js');

  // Verify that the age column markup no longer renders formatDate(patient.dateOfBirth)
  assert.ok(
    code.includes('<td data-column="age" class="patient-age"><span class="age-badge" data-patient-value>${escapeHtml(ageLabel(patient))}</span></td>'),
    'patient-list.js age column must render only ageLabel inside .age-badge'
  );
  assert.ok(
    !code.includes('data-column="age" class="patient-age"><span data-patient-value>${escapeHtml(formatDate(patient.dateOfBirth))}</span>'),
    'patient-list.js age column must not render patient.dateOfBirth'
  );
});

test('v43.6: ageLabel formats numerical age and falls back to calculating age from dateOfBirth if age is blank', () => {
  const code = read('public/patient-list.js');

  // Extract the ageLabel function definition
  assert.ok(code.includes('function ageLabel(patient)'), 'ageLabel function must be defined');
  assert.ok(code.includes('if(!value && patient.dateOfBirth)'), 'ageLabel should have fallback for blank age with dateOfBirth');
});
