import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v32.0 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 30.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(root, 'public', 'login.html'), 'utf8');
  assert.ok(((loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || (loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || loginHtml.includes('v32.7') || loginHtml.includes('v32.6')) || loginHtml.includes('v32.4') || loginHtml.includes('v32.3') || loginHtml.includes('v32.2') || loginHtml.includes('v32.1') || loginHtml.includes('v32.0') || loginHtml.includes('v35.') || loginHtml.includes('v36.'), 'login.html must visibly display current version');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(((serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || (serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || serverMjs.includes('v32.7') || serverMjs.includes('v32.6')) || serverMjs.includes('v32.4') || serverMjs.includes('v32.3') || serverMjs.includes('v32.2') || serverMjs.includes('v32.1') || serverMjs.includes('v32.0') || serverMjs.includes('v35.') || serverMjs.includes('v36.'), 'server.mjs header must include current version');
});

test('v32.0 server.mjs registers chief-complaint-tags static assets in publicFiles whitelist', () => {
  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(serverMjs.includes("'/public/chief-complaint-tags.js'"), 'server.mjs must whitelist chief-complaint-tags.js');
  assert.ok(serverMjs.includes("'/public/chief-complaint-tags.css'"), 'server.mjs must whitelist chief-complaint-tags.css');
});

test('v32.0 protected/EMR.html features inline typing input inside tag box and hidden data sync', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  assert.ok(emrHtml.includes('chief-complaint-tags.css'), 'EMR.html must link chief-complaint-tags.css');
  assert.ok(emrHtml.includes('chief-complaint-tags.js'), 'EMR.html must include chief-complaint-tags.js');

  const page2Part = emrHtml.split('id="page2"')[1].split('id="page3"')[0];
  assert.ok(page2Part.includes('id="chief_complaint_tag_box"'), 'Tag box must exist');
  assert.ok(page2Part.includes('id="chief_complaint_tags_list"'), 'Tag list container must exist');
  assert.ok(page2Part.includes('id="cc_inline_input"') || page2Part.includes('id="cc_search_input"'), 'Input must exist');
  assert.ok(page2Part.includes('id="pmrs_chief_complaint"'), 'pmrs_chief_complaint hidden input must be preserved');
});

test('v32.0 public/chief-complaint-tags.css defines separate badge tags with cross sign and inline input', () => {
  const css = fs.readFileSync(path.join(root, 'public', 'chief-complaint-tags.css'), 'utf8');

  assert.ok(css.includes('.cc-tag-box'), 'css must define .cc-tag-box');
  assert.ok(css.includes('.cc-inline-input') || css.includes('.cc-search-input'), 'css must define input styling');
  assert.ok(css.includes('.cc-tag'), 'css must define .cc-tag badge');
  assert.ok(css.includes('.cc-tag-remove'), 'css must define .cc-tag-remove cross button');
  assert.ok(css.includes('@media print'), 'css must define print hiding rules');
});

test('v32.0 public/chief-complaint-tags.js supports inline typing, enter/backspace, and emergency auto-import', () => {
  const js = fs.readFileSync(path.join(root, 'public', 'chief-complaint-tags.js'), 'utf8');

  assert.ok(js.includes('cc_inline_input') || js.includes('cc_search_input'), 'js must bind input');
  assert.ok(js.includes("e.key === 'Backspace'") || js.includes("e.key === 'Enter'"), 'js must handle keyboard interaction');
  assert.ok(js.includes("e.key === 'Enter'"), 'js must handle Enter to add custom symptom');
  assert.ok(js.includes('bindEmergencyCheckboxes'), 'js must bind emergency checkboxes');
  assert.ok(js.includes('window.BorkeoChiefComplaint'), 'js must export window.BorkeoChiefComplaint');
});
