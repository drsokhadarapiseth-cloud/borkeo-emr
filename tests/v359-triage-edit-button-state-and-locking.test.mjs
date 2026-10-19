import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');


test('v35.9 - public/emr-patient-record.js contains robust updateTriageSaveButtonState and handleTriageSaveOrEdit', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'emr-patient-record.js'), 'utf8');

  // isTriageTransferred checks departments and completed state
  assert.ok(js.includes('function isTriageTransferred'));
  assert.ok(js.includes('hasTransferredDept'));
  assert.ok(js.includes('system:triageCompletedAt'));

  // updateTriageSaveButtonState sets edit mode with កែប្រែ
  assert.ok(js.includes('function updateTriageSaveButtonState'));
  assert.ok(js.includes("btn.dataset.mode = 'edit'"));
  assert.ok(js.includes('<span>កែប្រែ</span>'));
  assert.ok(js.includes('setTriageControlsLocked(true)'));

  // handleTriageSaveOrEdit toggles to save mode when user clicks កែប្រែ
  assert.ok(js.includes('function handleTriageSaveOrEdit'));
  assert.ok(js.includes("btn.dataset.userEditing = 'true'"));
  assert.ok(js.includes("btn.dataset.mode = 'save'"));
  assert.ok(js.includes('setTriageControlsLocked(false)'));

  // savePatientRecord transmits triage options and refreshes button state
  assert.ok(js.includes('triageSave: options.triageSave === true'));
  assert.ok(js.includes('triageWardChanged: options.triageWardChanged === true'));
  assert.ok(js.includes('updateTriageSaveButtonState();'));
});

test('v35.9 - public/emr-permissions.js triggers updateTriageSaveButtonState on switchPage to page 2', () => {
  const js = fs.readFileSync(path.join(ROOT, 'public', 'emr-permissions.js'), 'utf8');
  assert.match(js, /Number\(pageNumber\)\s*===\s*2\s*&&\s*typeof window\.updateTriageSaveButtonState/);
});
