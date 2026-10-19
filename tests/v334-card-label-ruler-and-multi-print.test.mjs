import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


test('patient card footer removes issue date and preserves clean reminder notice', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8');
  assert.match(emrHtml, /សូមយកប័ណ្ណនេះមកជាមួយពេលមកពិនិត្យ/);
  // Ensure the old date label inside the card footer is removed
  assert.doesNotMatch(emrHtml, /កាលបរិច្ឆេទចេញប័ណ្ណ/);
  assert.doesNotMatch(emrHtml, /card_lbl_date/);
});

test('patient card dialog contains calibration toolbar with rulers, offsets and type selection', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8') + '\n' + fs.readFileSync(path.join(rootDir, 'public/patient-card-print.js'), 'utf8');

  // Toolbar controls
  assert.match(emrHtml, /id="card_print_type"/);
  assert.match(emrHtml, /value="thermal_80x35"/);
  assert.match(emrHtml, /value="card_85x54"/);
  assert.match(emrHtml, /value="a4_sheet"/);

  // Multi-label count
  assert.match(emrHtml, /id="card_label_count"/);

  // Calibration offsets & scale
  assert.match(emrHtml, /id="card_offset_top"/);
  assert.match(emrHtml, /id="card_offset_left"/);
  assert.match(emrHtml, /id="card_scale"/);

  // Visual rulers
  assert.match(emrHtml, /class="ruler-viewport"/);
  assert.match(emrHtml, /class="ruler-top"/);
  assert.match(emrHtml, /class="ruler-left"/);

  // Functions
  assert.match(emrHtml, /function updatePatientCardPreview\(\)/);
  assert.match(emrHtml, /function renderCardQR\(/);
  assert.match(emrHtml, /id="card_print_container"/);
});
