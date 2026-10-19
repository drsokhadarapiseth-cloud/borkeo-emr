import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');


test('v31.6 protected/EMR.html renames hosp_code to លេខកូដអ្នកជំងឺ and assigns id p2_patient_code', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  // Verify label is renamed to លេខកូដអ្នកជំងឺ and input has id p2_patient_code
  assert.ok(emrHtml.includes('<span data-key="hosp_code">លេខកូដអ្នកជំងឺ</span>'), 'Page 2 label must be renamed to លេខកូដអ្នកជំងឺ');
  assert.ok(emrHtml.includes('id="p2_patient_code"'), 'Page 2 patient code input must have id p2_patient_code');
  assert.ok(!emrHtml.includes('<span data-key="hosp_code">លេខកូដមន្ទីរព្យាបាល</span>'), 'Old label លេខកូដមន្ទីរព្យាបាល must not exist');

  // Verify Khmer translation dictionary
  assert.ok(emrHtml.includes('hosp_code: "លេខកូដអ្នកជំងឺ"'), 'Khmer translation for hosp_code must be លេខកូដអ្នកជំងឺ');

  // Verify English translation dictionary
  assert.ok(emrHtml.includes('hosp_code: "Patient Code"'), 'English translation for hosp_code must be Patient Code');

  // Verify syncFields populates p2_patient_code
  assert.ok(emrHtml.includes("document.getElementById('p2_patient_code')"), 'syncFields must reference p2_patient_code');
});

test('v31.6 public/emr-patient-record.js auto-populates p2_patient_code during banner sync', () => {
  const recordJs = fs.readFileSync(path.join(root, 'public', 'emr-patient-record.js'), 'utf8');

  assert.ok(recordJs.includes("document.getElementById('p2_patient_code')"), 'syncPatientPhotoHeaderBanners must sync p2_patient_code');
  assert.ok(recordJs.includes("p2PatientCode.value = code"), 'p2_patient_code value must be assigned the patient code');
});

test('v31.6 public/emr-language-data.js includes លេខកូដអ្នកជំងឺ translation pair', () => {
  const langJs = fs.readFileSync(path.join(root, 'public', 'emr-language-data.js'), 'utf8');

  assert.ok(langJs.includes('["លេខកូដអ្នកជំងឺ","Patient Code"]'), 'Language data must include ["លេខកូដអ្នកជំងឺ","Patient Code"]');
});
