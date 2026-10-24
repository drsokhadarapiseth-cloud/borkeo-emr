/**
 * Test Suite: v43.3 Integrated Clinical Consultation Workspace & View Switcher
 * Aligned with WCAG 2.2 AA and IEC 62366-1.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('v43.6: Version consistency across package.json, server.mjs, and login.html', () => {
  const pkg = JSON.parse(read('package.json'));
  const serverCode = read('server/server.mjs');
  const loginHtml = read('public/login.html');

  assert.equal(pkg.version, '43.6.0', 'package.json version must be 43.6.0');
  assert.match(serverCode, /Borkeo EMR v43\.6/, 'server.mjs must declare v43.6');
  assert.match(loginHtml, /data-app-version[^>]*>v43\.6<\/span>/, 'login.html must display v43.6');
});

test('v43.3: Modern consultation workspace presentation assets exist and are registered in server.mjs', () => {
  const cssPath = 'public/emr-consultation-workspace.css';
  const jsPath = 'public/emr-consultation-workspace.js';

  assert.ok(fs.existsSync(path.join(rootDir, cssPath)), 'emr-consultation-workspace.css must exist');
  assert.ok(fs.existsSync(path.join(rootDir, jsPath)), 'emr-consultation-workspace.js must exist');

  const serverCode = read('server/server.mjs');
  assert.ok(serverCode.includes('emr-consultation-workspace.css'), 'server.mjs must reference emr-consultation-workspace.css');
  assert.match(serverCode, /emr-consultation-workspace\.css\?v=43[3-4]0/, 'server.mjs must inject stylesheet with cache buster');
  assert.match(serverCode, /emr-consultation-workspace\.js\?v=43[3-4]0/, 'server.mjs must inject script with cache buster');
});

test('v43.3: All presentation-layer inputs declare data-emr-transient to protect frozen storage keys', () => {
  const jsCode = read('public/emr-consultation-workspace.js');
  const inputs = jsCode.match(/<(?:input|textarea)\b[^>]*>/g) || [];

  assert.ok(inputs.length >= 8, 'Must declare modern chief complaint, vitals, and notes inputs');
  for (const inputTag of inputs) {
    assert.match(inputTag, /data-emr-transient/, `Control must have data-emr-transient attribute: ${inputTag}`);
    assert.match(inputTag, /data-emr-no-save/, `Control must have data-emr-no-save attribute: ${inputTag}`);
  }
});

test('v43.3: Consultation workspace defines the agreed 2-column layout and vital signs metrics', () => {
  const jsCode = read('public/emr-consultation-workspace.js');
  const cssCode = read('public/emr-consultation-workspace.css');

  // Verify structure
  assert.match(jsCode, /emr-consultation-grid/, 'Must use emr-consultation-grid layout');
  assert.match(jsCode, /consultation-chief-complaint/, 'Must include chief complaint field');
  assert.match(jsCode, /consultation_bp/, 'Must include blood pressure metric');
  assert.match(jsCode, /consultation_pulse/, 'Must include heart rate metric');
  assert.match(jsCode, /consultation_temp/, 'Must include temperature metric');
  assert.match(jsCode, /consultation_spo2/, 'Must include SpO2 metric');
  assert.match(jsCode, /consultation_resp/, 'Must include respiration metric');
  assert.match(jsCode, /consultation_weight/, 'Must include weight metric');
  assert.match(jsCode, /consultation_hpi/, 'Must include history of present illness');
  assert.match(jsCode, /consultation_exam/, 'Must include physical examination');
  assert.match(jsCode, /consultation_diagnosis/, 'Must include diagnosis field');
  assert.match(jsCode, /consultation_plan/, 'Must include treatment plan field');

  // Verify tasks checklist items
  assert.match(jsCode, /task_item_allergy/, 'Must include allergy task item');
  assert.match(jsCode, /task_item_exam/, 'Must include physical exam task item');
  assert.match(jsCode, /task_item_diagnosis/, 'Must include diagnosis task item');
  assert.match(jsCode, /task_item_plan/, 'Must include treatment plan task item');

  // Verify CSS responsive & print rules
  assert.match(cssCode, /@media screen and \(max-width: 1024px\)/, 'Must define tablet breakpoint');
  assert.match(cssCode, /@media screen and \(max-width: 640px\)/, 'Must define mobile breakpoint');
  assert.match(cssCode, /@media print\s*\{\s*\.emr-consultation-workspace[\s\S]*display:\s*none\s*!important;/, 'Print media must hide modern consultation overlay to preserve authentic paper forms');
});

test('v43.3: Integrated view mode switcher and seamless integration of detailed clinical modules', () => {
  const jsCode = read('public/emr-consultation-workspace.js');
  const cssCode = read('public/emr-consultation-workspace.css');

  // View modes
  assert.match(jsCode, /cw-view-mode-bar/, 'Must render view mode switcher container');
  assert.match(jsCode, /cw_mode_integrated/, 'Must render integrated view mode button');
  assert.match(jsCode, /cw_mode_compact/, 'Must render compact view mode button');
  assert.match(jsCode, /cw_mode_classic/, 'Must render classic view mode button');
  assert.match(jsCode, /insert-rx-to-plan/, 'Must include insert prescription to plan dropdown action');
  assert.match(jsCode, /cw_classic_return_bar/, 'Must support return bar for classic mode');

  // CSS integration styles
  assert.match(cssCode, /consultation-mode-integrated[\s\S]*#opd_soap_record\s*\{[\s\S]*display:\s*flex\s*!important;/, 'Integrated mode must display legacy SOAP record');
  assert.match(cssCode, /consultation-mode-compact[\s\S]*#opd_soap_record\s*\{[\s\S]*display:\s*none\s*!important;/, 'Compact mode must hide legacy SOAP record');
  assert.match(cssCode, /consultation-mode-classic[\s\S]*#emr-consultation-workspace\s*\{[\s\S]*display:\s*none\s*!important;/, 'Classic mode must hide modern overlay');
  assert.match(cssCode, /consultation-mode-integrated[\s\S]*\.emr-tb-screening/, 'Must style TB screening matrix in integrated mode');
  assert.match(cssCode, /consultation-mode-integrated[\s\S]*#opd_rx_compact_block/, 'Must style prescription table in integrated mode');
});
