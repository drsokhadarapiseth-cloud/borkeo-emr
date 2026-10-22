// v41.5 - Record field keys no longer depend on page-load timing.
// Browser check (docs/medical-record-map.md section 14): slow and fast loads
// give the same key list for doctor, nurse and midwife; a value saved on a
// slow load reopens in the same field on a fast load.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const record = read('public/emr-patient-record.js');
const prepare = record.slice(record.indexOf('  function prepareStorageKeys() {'), record.indexOf('  function ensureFirstExamDateTime() {'));

test('nursing chart cells are made editable before the keys are counted', () => {
  assert.ok(prepare.indexOf('window.initializeNursingEditableTables?.();') < prepare.indexOf('document.querySelectorAll('));
  // The function it calls is a page-level function of EMR.html (a property of window).
  assert.match(read('protected/EMR.html'), /\n {8}function initializeNursingEditableTables\(\) \{/);
});

test('a text box locked read-only during loading still counts (both locks keep the original)', () => {
  assert.match(prepare, /\[contenteditable="true"\], \[data-original-contenteditable="true"\], \[data-editor-editable="true"\]/);
  assert.match(read('public/emr-permissions.js'), /control\.setAttribute\('data-original-contenteditable', control\.getAttribute\('contenteditable'\) \|\| 'true'\);/);
  assert.match(read('public/emr-encounter-editor.js'), /field\.dataset\.editorEditable=field\.contentEditable;/);
});

test('controls added by script at a varying moment never take a position', () => {
  assert.match(prepare, /\.filter\(control => !control\.matches\('\.emr-palette-input'\) && !control\.closest\('\.ward-service-panel'\)\)/);
  assert.match(read('public/ward-services.js'), /panel\.className='ward-service-panel no-print';/);
  assert.match(read('public/ward-services.js'), /host\.prepend\(panel\);/);
});
