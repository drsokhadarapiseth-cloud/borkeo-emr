import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


test('triage waiting and skipped lists use បំពេញទ្រីយ៉ា without ហៅ', () => {
  const triageJs = fs.readFileSync(path.join(rootDir, 'public/triage.js'), 'utf8');
  assert.match(triageJs, /បំពេញទ្រីយ៉ា/);
  assert.doesNotMatch(triageJs, /ហៅ និងបំពេញទ្រីយ៉ា/);
});

test('new ID formats use hospital facility code 160201 and YYMMDD structure', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');

  // Verify hospital facility code
  assert.match(emrHtml, /HOSPITAL_FACILITY_CODE\s*=\s*['"]160201['"]/);

  // Case number format: 160201-OPD-YYMMDD-001
  assert.match(emrHtml, /HOSPITAL_FACILITY_CODE\s*\+\s*'-(?:OPD|REG)-'\s*\+\s*yyDate\s*\+\s*'-'\s*\+\s*pad\(current,\s*3\)/);

  // Health ID format: 160201-YYMMDD-001
  assert.match(emrHtml, /HOSPITAL_FACILITY_CODE\s*\+\s*'-'\s*\+\s*yyDate\s*\+\s*'-'\s*\+\s*pad\(current,\s*3\)/);

  // Triage ID format: 160201-TR-YYMMDD-001
  assert.match(emrHtml, /HOSPITAL_FACILITY_CODE\s*\+\s*'-TR-'\s*\+\s*yyDate\s*\+\s*'-'\s*\+\s*pad\(current,\s*3\)/);

  // Placeholders
  assert.match(emrHtml, /HOSPITAL_FACILITY_CODE\s*\+\s*'-(?:OPD|REG)-YYMMDD-001'/);
  assert.match(emrHtml, /HOSPITAL_FACILITY_CODE\s*\+\s*'-YYMMDD-001'/);
});

test('patient card print dialog and button exist with qrcode library and print styles', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');

  // Print card button beside web_health_id
  assert.match(emrHtml, /id="btn_print_patient_card"/);
  assert.match(emrHtml, /onclick="openPatientCardPrintModal\(\)"/);

  // Patient card dialog with print layout and labels
  assert.match(emrHtml, /<dialog id="patient_card_dialog"/);
  assert.match(emrHtml, /id="card_lbl_name"/);
  assert.match(emrHtml, /id="card_lbl_id"/);
  assert.match(emrHtml, /id="card_qr_container"/);

  // QRCode library included
  assert.match(emrHtml, /public\/qrcode\.min\.js/);

  // Print media styles
  assert.match(emrHtml, /@media print/);
  assert.match(fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8'), /#patient_card_dialog/);
});

test('occupation dropdown has Cambodian jobs with custom other input protected from auto index', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');

  // Cambodian jobs
  assert.match(emrHtml, /<option value="កសិករ">កសិករ<\/option>/);
  assert.match(emrHtml, /<option value="អាជីវករ \/ អ្នកលក់ដូរ">/);
  assert.match(emrHtml, /<option value="ផ្សេងៗ">ផ្សេងៗ<\/option>/);

  // Custom other input with data-emr-no-auto-index
  assert.match(emrHtml, /id="reg_occupation_other"[^>]*data-emr-no-auto-index/);
});

test('HEF / IDPoor dialog translates poverty status correctly into authentic Khmer and English', () => {
  const hefJs = fs.readFileSync(path.join(rootDir, 'public/hef-lookup.js'), 'utf8');

  // Khmer poverty status mappings
  assert.match(hefJs, /NEAR_POOR.*txt\('ងាយរងហានិភ័យ'/);
  assert.match(hefJs, /POOR_1.*txt\('ក្រកម្រិត១'/);
  assert.match(hefJs, /POOR_2.*txt\('ក្រកម្រិត២'/);
  assert.match(hefJs, /NOT_POOR.*txt\('មិនក្រីក្រ'/);

  // Status check and cross banners
  assert.match(hefJs, /hef-banner/);
  assert.match(hefJs, /hef-member-card/);
});
