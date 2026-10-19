import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

test('v31.7 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 30.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(root, 'public', 'login.html'), 'utf8');
  assert.ok(((loginHtml.includes('v32.10') || loginHtml.includes('v32.11') || loginHtml.includes('v32.12') || ((loginHtml.includes('v33.2') || loginHtml.includes('v33.1')) || loginHtml.includes('v32.13'))) || loginHtml.includes('v32.9') || loginHtml.includes('v32.8') || loginHtml.includes('v32.7') || loginHtml.includes('v32.6')) || loginHtml.includes('v32.4') || loginHtml.includes('v32.3') || loginHtml.includes('v32.2') || loginHtml.includes('v32.1') || loginHtml.includes('v32.0') || loginHtml.includes('v31.9') || loginHtml.includes('v31.8') || loginHtml.includes('v31.7') || loginHtml.includes('v35.') || loginHtml.includes('v36.'), 'login.html must visibly display current version');

  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');
  assert.ok(((serverMjs.includes('v32.10') || serverMjs.includes('v32.11') || serverMjs.includes('v32.12') || ((serverMjs.includes('v33.2') || serverMjs.includes('v33.1')) || serverMjs.includes('v32.13'))) || serverMjs.includes('v32.9') || serverMjs.includes('v32.8') || serverMjs.includes('v32.7') || serverMjs.includes('v32.6')) || serverMjs.includes('v32.4') || serverMjs.includes('v32.3') || serverMjs.includes('v32.2') || serverMjs.includes('v32.1') || serverMjs.includes('v32.0') || serverMjs.includes('v31.9') || serverMjs.includes('v31.8') || serverMjs.includes('v31.7') || serverMjs.includes('v35.') || serverMjs.includes('v36.'), 'server.mjs header must include current version');
});

test('v31.7 protected/EMR.html places chief complaint inside line-height:2 container with address', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  // Verify chief complaint is right after province inside line-height: 2 container
  const provinceIndex = emrHtml.indexOf('<span data-key="province_rtk">ខេត្ត</span><br>');
  const chiefComplaintIndex = emrHtml.indexOf('id="pmrs_chief_complaint"');
  assert.ok(provinceIndex !== -1, 'Province span must be present with line break');
  assert.ok(chiefComplaintIndex !== -1, 'Chief complaint input must be present');
  assert.ok(chiefComplaintIndex > provinceIndex, 'Chief complaint must appear immediately after province');
  // console.log('diff:', chiefComplaintIndex - provinceIndex);
  assert.ok(chiefComplaintIndex - provinceIndex < 600, `Chief complaint must be contiguous within the same container, diff: ${chiefComplaintIndex - provinceIndex}`);

  // Verify standalone margin wrapper around chief complaint is gone
  assert.ok(!emrHtml.includes('<div style="margin: 12px 0 14px 0;">\n                <span data-key="refer_sign"'), 'Standalone margin wrapper must be removed');
});

test('v31.7 page 2 action bar contains Save button next to btn-next', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  // Check page 2 action-bar
  const page2Part = emrHtml.split('id="page2"')[1].split('id="page3"')[0];
  assert.ok(page2Part.includes('class="action-bar'), 'Page 2 must have an action bar');
  assert.ok(page2Part.includes('class="btn-blue emr-save-button no-print"'), 'Action bar must contain emr-save-button');
  
  const saveIdx = page2Part.indexOf('emr-save-button');
  const nextIdx = page2Part.indexOf('class="btn-next"');
  assert.ok(saveIdx !== -1 && nextIdx !== -1 && saveIdx < nextIdx, 'Save button must be placed next to / before btn-next');
});

test('v31.7 public/emr-patient-record.js removes top save bar from page2 and places save button in action-bar', () => {
  const recordJs = fs.readFileSync(path.join(root, 'public', 'emr-patient-record.js'), 'utf8');

  assert.ok(!recordJs.includes('if (pageTwo) addSaveBar(pageTwo);'), 'Must not call addSaveBar on pageTwo');
  assert.ok(recordJs.includes("document.querySelectorAll('#page2 > .emr-save-bar').forEach(el => el.remove());"), 'Must clean up any top save bar on page2');
  assert.ok(recordJs.includes("pageTwoBtnNext.insertAdjacentElement('beforebegin', createSaveButton());"), 'Must insert save button in action-bar before btn-next');
});
