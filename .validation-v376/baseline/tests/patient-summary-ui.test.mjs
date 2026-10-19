import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = fs.readFileSync(path.join(root, 'public', 'emr-inpatient-workflow.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public', 'emr-inpatient-workflow.css'), 'utf8');

test('v12.0 does not inject bed-map navigation into Registration view', () => {
  assert.match(workflow, /requestedView === 'register' \|\| requestedView === 'registration'/);
  assert.match(workflow, /if \(requestedView === 'register' \|\| requestedView === 'registration'\) return;/);
});

test('v12.0 provides a deterministic OPD/IPD patient summary drawer without AI', () => {
  assert.match(workflow, /patient-summary-tab/);
  assert.match(workflow, /\/api\/patient-history/);
  assert.match(workflow, /importantFacts\(record\)/);
  assert.match(workflow, /system:opdMedications/);
  assert.match(workflow, /system:initialIpdMedications/);
  assert.match(css, /\.patient-summary-drawer/);
  assert.match(css, /\.patient-summary-tab/);
});
