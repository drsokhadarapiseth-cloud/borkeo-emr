import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


test('v25.0 signature and signer name are positioned above the horizontal signature line', () => {
  const sessionCss = fs.readFileSync(path.join(process.cwd(), 'public/emr-session.css'), 'utf8');
  assert.ok(!sessionCss.includes('.emr-esign-stamp{display:inline-flex;min-width:220px;flex-direction:column;align-items:center;justify-content:center;padding:7px 12px;border-top:1px solid #91adba'), 'border-top removed from emr-esign-stamp');
  assert.ok(sessionCss.includes('.emr-esign-line{width:100%'), 'emr-esign-line defined');

  const workflowCss = fs.readFileSync(path.join(process.cwd(), 'public/emr-inpatient-workflow.css'), 'utf8');
  assert.ok(workflowCss.includes('.triage-nurse-esign{display:flex;align-items:center;justify-content:flex-end;gap:12px;margin-top:18px;padding:10px 12px;border-top:0}'), 'triage-nurse-esign border-top removed');

  const recordJs = fs.readFileSync(path.join(process.cwd(), 'public/emr-patient-record.js'), 'utf8');
  assert.ok(recordJs.includes('<strong>${safe(signer)}</strong><div class="emr-esign-line" aria-hidden="true"></div><small>'), 'emr-esign-line placed beneath signer name');
});
