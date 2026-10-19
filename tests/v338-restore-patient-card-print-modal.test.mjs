import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


test('openPatientCardPrintModal is defined, wired to window and opens patient card dialog', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8');

  // Button exists and triggers modal function
  assert.match(emrHtml, /id="btn_print_patient_card"[^>]*onclick="openPatientCardPrintModal\(\)"/);

  // Function is properly declared
  assert.match(emrHtml, /function openPatientCardPrintModal\(\)\s*\{/);
  assert.match(emrHtml, /window\.openPatientCardPrintModal\s*=\s*openPatientCardPrintModal;/);

  // Dialog retrieval and opening
  assert.match(emrHtml, /const dialog=el\('patient_card_dialog'\)/);
  assert.match(emrHtml, /dialog\.showModal\(\)/);

  // Core initialization inside modal opener
  assert.match(emrHtml, /loadSavedStickerConfig\(\);/);
  assert.match(emrHtml, /renderCardQR\('card_qr_container'/);
  assert.match(emrHtml, /updatePatientCardPreview\(\);/);
});
