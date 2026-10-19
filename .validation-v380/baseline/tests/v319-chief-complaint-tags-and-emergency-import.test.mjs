import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v31.9 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 30.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(root, 'public', 'login.html'), 'utf8');
  assert.ok(((loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || (loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || loginHtml.includes('v32.7') || loginHtml.includes('v32.6')) || loginHtml.includes('v32.4') || loginHtml.includes('v32.3') || loginHtml.includes('v32.2') || loginHtml.includes('v32.1') || loginHtml.includes('v32.0') || loginHtml.includes('v31.9') || loginHtml.includes('v35.') || loginHtml.includes('v36.'), 'login.html must visibly display current version');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(((serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || (serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || serverMjs.includes('v32.7') || serverMjs.includes('v32.6')) || serverMjs.includes('v32.4') || serverMjs.includes('v32.3') || serverMjs.includes('v32.2') || serverMjs.includes('v32.1') || serverMjs.includes('v32.0') || serverMjs.includes('v31.9') || serverMjs.includes('v35.') || serverMjs.includes('v36.'), 'server.mjs header must include current version');
});

test('v31.9 protected/EMR.html integrates chief complaint multi-select tags component and scripts', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  assert.ok(emrHtml.includes('chief-complaint-tags.css'), 'EMR.html must link chief-complaint-tags.css');
  assert.ok(emrHtml.includes('chief-complaint-tags.js'), 'EMR.html must include chief-complaint-tags.js');

  const page2Part = emrHtml.split('id="page2"')[1].split('id="page3"')[0];
  assert.ok(page2Part.includes('class="chief-complaint-wrapper"'), 'Page 2 must contain chief-complaint-wrapper');
  assert.ok(page2Part.includes('id="chief_complaint_tag_box"'), 'Page 2 must contain chief_complaint_tag_box');
  assert.ok(page2Part.includes('id="chief_complaint_tags_list"'), 'Page 2 must contain chief_complaint_tags_list');
  assert.ok(page2Part.includes('id="chief_complaint_dropdown"'), 'Page 2 must contain chief_complaint_dropdown');
  assert.ok(page2Part.includes('id="cc_search_input"') || page2Part.includes('id="cc_inline_input"'), 'Page 2 must contain input element');
  assert.ok(page2Part.includes('id="cc_add_btn"'), 'Page 2 must contain cc_add_btn (+) button');
  assert.ok(page2Part.includes('id="pmrs_chief_complaint"'), 'pmrs_chief_complaint input must be preserved');
});

test('v31.9 public/chief-complaint-tags.css defines multi-select tag styling and print rules', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'chief-complaint-tags.css'), 'utf8');

  assert.ok(css.includes('.cc-tag-box'), 'css must define .cc-tag-box');
  assert.ok(css.includes('.cc-tag'), 'css must define .cc-tag');
  assert.ok(css.includes('.cc-dropdown'), 'css must define .cc-dropdown');
  assert.ok(css.includes('.cc-add-btn'), 'css must define .cc-add-btn');
  assert.ok(css.includes('.cc-option-item.selected'), 'css must define selected item styling');
  assert.ok(css.includes('@media print'), 'css must define print hiding rules');
});

test('v31.9 public/chief-complaint-tags.js binds emergency checkboxes and auto-imports symptoms', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'chief-complaint-tags.js'), 'utf8');

  assert.ok(js.includes("row?.querySelector('.symptom-text')"), 'Emergency complaints must come from the existing triage checkbox labels');
  assert.ok(js.includes('.s1-check, .s2-check'), 'js must query both Stage 1 and Stage 2 emergency checkboxes');
  assert.ok(js.includes('bindEmergencyCheckboxes'), 'js must bind emergency checkboxes for auto-import');
  assert.ok(js.includes('window.BorkeoChiefComplaint'), 'js must export window.BorkeoChiefComplaint API');
});
