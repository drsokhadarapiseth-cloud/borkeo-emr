import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


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
