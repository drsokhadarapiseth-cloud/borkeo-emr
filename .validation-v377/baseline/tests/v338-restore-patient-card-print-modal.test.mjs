import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('v33.8 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(['33.2.0', '33.3.0', '33.4.0', '33.5.0', '33.6.0', '33.7.0', '33.8.0', '33.9.0', '34.0.0', '34.1.0', '34.2.0', '34.3.0', '34.4.0', '34.5.0', '34.6.0', '34.7.0', '34.8.0', '34.9.0', '35.0.0', '35.1.0', '35.2.0', '35.3.0', '35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v(?:3[2-6]\.)/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v(?:3[2-6]\.)/);
});

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
