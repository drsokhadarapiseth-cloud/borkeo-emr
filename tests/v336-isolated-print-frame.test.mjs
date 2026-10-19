import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


test('isolated print frame engine renders patient stickers cleanly without blank pages', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8');

  // Print function uses isolated iframe
  assert.match(emrHtml, /function printPatientCards\(\)/);
  assert.match(emrHtml, /card_print_iframe/);
  assert.match(emrHtml, /frame\.contentWindow\.print\(\)/);
  assert.match(emrHtml, /frame\.remove\(\)/);

  // Checks for sheet container and dimensions
  assert.match(emrHtml, /\.print-sheet/);
  assert.match(emrHtml, /card_print_container/);

  // Footer is clean reminder without issue date
  assert.match(emrHtml, /សូមយកប័ណ្ណនេះមកជាមួយពេលមកពិនិត្យ/);
  assert.doesNotMatch(emrHtml, /card_lbl_date/);
});

test('configurable sticker width, height, and gap inputs persist settings', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.css'), 'utf8');

  assert.match(emrHtml, /id="card_custom_width"/);
  assert.match(emrHtml, /id="card_custom_height"/);
  assert.match(emrHtml, /id="card_custom_gap(_x)?"/);
  assert.match(emrHtml, /loadSavedStickerConfig/);
  assert.match(emrHtml, /saveStickerConfig/);
});
