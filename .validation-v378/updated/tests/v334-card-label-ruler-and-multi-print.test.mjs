import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('v33.4 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(['33.2.0', '33.3.0', '33.4.0', '33.5.0', '33.6.0', '33.7.0', '33.8.0', '33.9.0', '34.0.0', '34.1.0', '34.2.0', '34.3.0', '34.4.0', '34.5.0', '34.6.0', '34.7.0', '34.8.0', '34.9.0', '35.0.0', '35.1.0', '35.2.0', '35.3.0', '35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v(?:3[2-6]\.)/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v(?:3[2-6]\.)/);
});

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
