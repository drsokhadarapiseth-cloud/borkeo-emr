/**
 * Test Suite: v43.2 Modern Clinical Consultation Workspace & Task Checklist
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

test('v43.2: Version consistency across package.json, server.mjs, and login.html', () => {
  const pkg = JSON.parse(read('package.json'));
  const serverCode = read('server/server.mjs');
  const loginHtml = read('public/login.html');

  assert.equal(pkg.version, '43.2.0', 'package.json version must be 43.2.0');
  assert.match(serverCode, /Borkeo EMR v43\.2/, 'server.mjs must declare v43.2');
  assert.match(loginHtml, /data-app-version[^>]*>v43\.2<\/span>/, 'login.html must display v43.2');
});

test('v43.2: Modern consultation workspace presentation assets exist and are registered in server.mjs', () => {
  const cssPath = 'public/emr-consultation-workspace.css';
  const jsPath = 'public/emr-consultation-workspace.js';

  assert.ok(fs.existsSync(path.join(rootDir, cssPath)), 'emr-consultation-workspace.css must exist');
  assert.ok(fs.existsSync(path.join(rootDir, jsPath)), 'emr-consultation-workspace.js must exist');

  const serverCode = read('server/server.mjs');
  assert.ok(serverCode.includes('emr-consultation-workspace.css'), 'server.mjs must reference emr-consultation-workspace.css');
  assert.ok(serverCode.includes('emr-consultation-workspace.js'), 'server.mjs must reference emr-consultation-workspace.js');
  assert.match(serverCode, /emr-consultation-workspace\.css\?v=4320/, 'server.mjs must inject stylesheet with cache buster v=4320');
  assert.match(serverCode, /emr-consultation-workspace\.js\?v=4320/, 'server.mjs must inject script with cache buster v=4320');
});

test('v43.2: All presentation-layer inputs declare data-emr-transient to protect frozen storage keys', () => {
  const jsCode = read('public/emr-consultation-workspace.js');
  const inputs = jsCode.match(/<(?:input|textarea)\b[^>]*>/g) || [];

  assert.ok(inputs.length >= 8, 'Must declare modern chief complaint, vitals, and notes inputs');
  for (const inputTag of inputs) {
    assert.match(inputTag, /data-emr-transient/, `Control must have data-emr-transient attribute: ${inputTag}`);
    assert.match(inputTag, /data-emr-no-save/, `Control must have data-emr-no-save attribute: ${inputTag}`);
  }
});

test('v43.2: Consultation workspace defines the agreed 2-column layout and vital signs metrics', () => {
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
  assert.match(cssCode, /@media print\s*\{\s*\.emr-consultation-workspace\s*\{\s*display:\s*none\s*!important;\s*\}\s*\}/, 'Print media must hide modern consultation overlay to preserve authentic paper forms');
});
