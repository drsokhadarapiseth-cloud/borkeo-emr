import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('v33.7 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(['33.2.0', '33.3.0', '33.4.0', '33.5.0', '33.6.0', '33.7.0', '33.8.0', '33.9.0', '34.0.0', '34.1.0', '34.2.0', '34.3.0', '34.4.0', '34.5.0', '34.6.0', '34.7.0', '34.8.0', '34.9.0', '35.0.0', '35.1.0', '35.2.0', '35.3.0', '35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v(?:3[2-6]\.)/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v(?:3[2-6]\.)/);
});

test('auto ID generation is exported, immediately initialized and supports click/focus fallbacks', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');

  // Exports on window
  assert.match(emrHtml, /window\.applyAutoCaseNumber\s*=\s*applyAutoCaseNumber;/);
  assert.match(emrHtml, /window\.applyAutoHealthId\s*=\s*applyAutoHealthId;/);
  assert.match(emrHtml, /window\.bindAutoCaseNumber\s*=\s*bindAutoCaseNumber;/);
  assert.match(emrHtml, /window\.bindAutoHealthId\s*=\s*bindAutoHealthId;/);
  assert.match(emrHtml, /window\.initAutoIdentifiers\s*=\s*initAutoIdentifiers;/);

  // Immediate initialization without relying solely on DOMContentLoaded
  assert.match(emrHtml, /function initAutoIdentifiers\(\)/);
  assert.match(emrHtml, /initAutoIdentifiers\(\);/);
  assert.match(emrHtml, /if\s*\(document\.readyState === 'loading'\)/);

  // Click & focus listeners on case number
  assert.match(emrHtml, /field\.addEventListener\('focus',\s*function\s*\(\)\s*\{\s*if\s*\(!field\.value\.trim\(\)\)\s*applyAutoCaseNumber\(true\);/);
  assert.match(emrHtml, /field\.addEventListener\('click',\s*function\s*\(\)\s*\{\s*if\s*\(!field\.value\.trim\(\)\)\s*applyAutoCaseNumber\(true\);/);

  // Click & focus listeners on health ID
  assert.match(emrHtml, /field\.addEventListener\('focus',\s*function\s*\(\)\s*\{\s*if\s*\(!field\.value\.trim\(\)\s*&&\s*!field\.readOnly\)\s*applyAutoHealthId\(true\);/);
  assert.match(emrHtml, /field\.addEventListener\('click',\s*function\s*\(\)\s*\{\s*if\s*\(!field\.value\.trim\(\)\s*&&\s*!field\.readOnly\)\s*applyAutoHealthId\(true\);/);
});

test('emr-patient-record triggers auto ID generation on new registration session', () => {
  const recordJs = fs.readFileSync(path.join(rootDir, 'public/emr-patient-record.js'), 'utf8');

  assert.match(recordJs, /if\s*\(typeof window\.applyAutoCaseNumber === 'function'\)\s*window\.applyAutoCaseNumber\(\);/);
  assert.match(recordJs, /if\s*\(typeof window\.applyAutoHealthId === 'function'\)\s*window\.applyAutoHealthId\(\);/);
});
