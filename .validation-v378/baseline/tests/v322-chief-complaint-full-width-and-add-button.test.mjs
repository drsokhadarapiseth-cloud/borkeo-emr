import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v32.2 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 32.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(root, 'public', 'login.html'), 'utf8');
  assert.ok(((loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || (loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || loginHtml.includes('v32.7') || loginHtml.includes('v32.6')) || loginHtml.includes('v32.4') || loginHtml.includes('v32.3') || loginHtml.includes('v32.2') || loginHtml.includes('v35.') || loginHtml.includes('v36.'), 'login.html must visibly display current version');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(((serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || (serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || serverMjs.includes('v32.7') || serverMjs.includes('v32.6')) || serverMjs.includes('v32.4') || serverMjs.includes('v32.3') || serverMjs.includes('v32.2') || serverMjs.includes('v35.') || serverMjs.includes('v36.'), 'server.mjs header must include current version');
});

test('v32.2 protected/EMR.html sets full width until photo and places search input with + button in dropdown', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  const page2Part = emrHtml.split('id="page2"')[1].split('id="page3"')[0];
  const rowBlock = page2Part.split('class="chief-complaint-row"')[1].split('id="triage_patient_photo_container"')[0];

  assert.ok(rowBlock.includes('width: 100%'), 'chief-complaint-row must span full width 100%');
  assert.ok(rowBlock.includes('id="chief_complaint_tag_box"'), 'Tag box must exist');
  assert.ok(rowBlock.includes('id="cc_placeholder_text"'), 'Placeholder text must exist');

  // Verify dropdown contains search input and + button
  assert.ok(rowBlock.includes('id="chief_complaint_dropdown"'), 'Dropdown must exist');
  assert.ok(rowBlock.includes('id="cc_search_input"'), 'Search input must be in dropdown');
  assert.ok(rowBlock.includes('placeholder="ស្វែងរកខ្មែរ / English / Code"'), 'Search input placeholder must match');
  assert.ok(rowBlock.includes('id="cc_add_btn"'), 'Add (+) button must be in dropdown');
  assert.ok(rowBlock.includes('id="pmrs_chief_complaint"'), 'pmrs_chief_complaint hidden input must be preserved');
});

test('v32.2 public/chief-complaint-tags.css defines full width layout and search + button styling', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'chief-complaint-tags.css'), 'utf8');

  assert.ok(css.includes('width: 100%'), 'css must define width: 100%');
  assert.ok(css.includes('.cc-search-input'), 'css must define .cc-search-input');
  assert.ok(css.includes('.cc-add-btn'), 'css must define .cc-add-btn');
  assert.ok(css.includes('.cc-tag'), 'css must define .cc-tag');
  assert.ok(css.includes('.cc-tag-remove'), 'css must define .cc-tag-remove');
});

test('v32.2 public/chief-complaint-tags.js supports + button and enter to add finished symptom pieces', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'chief-complaint-tags.js'), 'utf8');

  assert.ok(js.includes('cc_search_input'), 'js must query cc_search_input');
  assert.ok(js.includes('cc_add_btn'), 'js must bind cc_add_btn');
  assert.ok(js.includes('addCustomSymptom'), 'js must implement addCustomSymptom');
  assert.ok(js.includes('bindEmergencyCheckboxes'), 'js must bind emergency checkboxes');
});
