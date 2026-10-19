import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


test('configurable sticker width, height, and gap inputs exist with persistence', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8');

  // Dimension inputs
  assert.match(emrHtml, /id="card_custom_width"/);
  assert.match(emrHtml, /id="card_custom_height"/);
  assert.match(emrHtml, /id="card_custom_gap(_x)?"/);

  // Persistence logic
  assert.match(emrHtml, /function loadSavedStickerConfig\(\)/);
  assert.match(emrHtml, /function saveStickerConfig\(\)/);
  assert.match(emrHtml, /borkeo_sticker_cfg/);
});

test('single-page clean print layout isolates dialog and prevents page 2 overflow', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8');

  // Print function
  assert.match(emrHtml, /function printPatientCards\(\)/);
  assert.match(emrHtml, /onclick="printPatientCards\(\)"/);

  // Print engine isolates print container without main window bleed
  assert.match(emrHtml, /(?:card_print_iframe|body\s*>\s*\*:not\(#patient_card_dialog\))/);

  // Multi-sticker print container
  assert.match(emrHtml, /id="card_print_container"/);

  // Clean footer with reminder and no date
  assert.match(emrHtml, /សូមយកប័ណ្ណនេះមកជាមួយពេលមកពិនិត្យ/);
  assert.doesNotMatch(emrHtml, /card_lbl_date/);
});
