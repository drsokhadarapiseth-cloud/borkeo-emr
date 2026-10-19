import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = path.resolve(import.meta.dirname, '..');

test('v12.0 keeps case selection in Registration and splits Triage waiting/completed UI', () => {
  const emr = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');
  const triage = fs.readFileSync(path.join(root, 'protected', 'triage.html'), 'utf8');
  const perms = fs.readFileSync(path.join(root, 'public', 'emr-permissions.js'), 'utf8');

  assert.equal((emr.match(/name="emr_pmrs_case_type"/g) || []).length, 2, 'only the two Registration case radios remain');
  assert.equal(emr.includes('id="pmrs-case-section"'), false);
  assert.match(triage, /id="triage-body-waiting"/);
  assert.match(triage, /id="triage-body-completed"/);
  assert.match(perms, /role === 'TRIAGE' && \[1,2\]\.includes/);
  assert.match(perms, /completedTriage = role === 'TRIAGE'/);
});
