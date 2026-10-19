import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');


test('v31.4 emr-inpatient-workflow.js removes the 8 patient context summary boxes', () => {
  const workflowJs = fs.readFileSync(path.join(root, 'public', 'emr-inpatient-workflow.js'), 'utf8');

  // Verify createPatientContext function does not render the 8 context item boxes
  const createPatientContextFn = workflowJs.slice(
    workflowJs.indexOf('function createPatientContext()'),
    workflowJs.indexOf('function createViewToolbar()')
  );
  assert.ok(!createPatientContextFn.includes('inpatient-context-item'), 'createPatientContext must not contain inpatient-context-item divs');
  assert.ok(!createPatientContextFn.includes('data-patient-context="name"'), 'createPatientContext must not render patient name context box');
  assert.ok(!createPatientContextFn.includes('data-patient-context="ward"'), 'createPatientContext must not render ward context box');
  assert.ok(!createPatientContextFn.includes('data-patient-context="bed"'), 'createPatientContext must not render bed context box');

  // Verify payment status banner and view toolbar are preserved
  assert.ok(createPatientContextFn.includes('patient-payment-status-banner'), 'createPatientContext must preserve patient-payment-status-banner');
  assert.ok(workflowJs.includes('createViewToolbar()'), 'createViewToolbar must remain intact');
  assert.ok(workflowJs.includes('inpatient-back-link'), 'inpatient-back-link must remain intact');
  assert.ok(workflowJs.includes('inpatient-view-heading'), 'inpatient-view-heading must remain intact');
});

test('v31.4 emr-inpatient-workflow.css removes grid background container and hides context items', () => {
  const workflowCss = fs.readFileSync(path.join(root, 'public', 'emr-inpatient-workflow.css'), 'utf8');

  // inpatient-context-item is styled to display none
  assert.ok(/\.inpatient-context-item\s*\{\s*display:\s*none\s*!important;/.test(workflowCss), 'inpatient-context-item must be hidden');

  // inpatient-patient-context no longer forces light blue 4-column box styling
  assert.ok(!workflowCss.includes('border: 1px solid #add7e3; border-radius: 12px; background: #eaf8fc;'), 'Box background container styling must be removed');
});
