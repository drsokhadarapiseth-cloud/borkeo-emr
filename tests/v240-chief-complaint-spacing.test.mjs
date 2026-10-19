import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


test('v24.0 EMR.html includes vertical spacing for chief complaint above department table', () => {
  const emrHtml = fs.readFileSync(path.join(process.cwd(), 'protected/EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('pmrs_chief_complaint'), 'has pmrs_chief_complaint input');
  assert.ok(emrHtml.includes('chief-complaint-row') || emrHtml.includes('chief-complaint-wrapper'), 'has spacing wrapper around chief complaint');
});
