import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');


test('v31.8 protected/EMR.html displays small Triage ID note on the left side of page 2 action bar', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');
  const page2Part = emrHtml.split('id="page2"')[1].split('id="page3"')[0];

  assert.ok(page2Part.includes('class="triage-id-meta"'), 'Page 2 must contain triage-id-meta container');
  assert.ok(page2Part.includes('id="display_triage_id"'), 'Page 2 must contain display_triage_id element');
  assert.ok(page2Part.includes('id="web_triage_id"'), 'Page 2 must contain web_triage_id input');
  assert.ok(page2Part.includes('font-size: 11px'), 'Page 2 Triage ID must be styled as small text');
  assert.ok(page2Part.includes('justify-content: space-between'), 'Action bar must use space-between to position triage ID on the left');
  assert.ok(emrHtml.includes('function nextTriageId()'), 'EMR.html must define nextTriageId generator');
});

test('v31.8 public/emr-patient-record.js collects triageId and brings it as data to json', () => {
  const recordJs = fs.readFileSync(path.join(root, 'public', 'emr-patient-record.js'), 'utf8');

  assert.ok(recordJs.includes("data['scope:triage:id:web_triage_id'] = triageIdVal"), 'readRecordData must collect scope:triage:id:web_triage_id');
  assert.ok(recordJs.includes("data['system:triageId'] = triageIdVal"), 'readRecordData must collect system:triageId');
  assert.ok(recordJs.includes("triageId: currentTriageId"), 'patientContext summary must include triageId');
  assert.ok(recordJs.includes('function syncTriageId()'), 'emr-patient-record.js must define syncTriageId');
});

test('v31.8 server/server.mjs serializes and preserves triageId in patient json', () => {
  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');

  assert.ok(serverMjs.includes("triageId: data['system:triageId'] || data['scope:triage:id:web_triage_id'] || data['triageId'] || ''"), 'findPatient must serialize triageId in patient response');
  assert.ok(serverMjs.includes("triageId: text('triageId', 120)"), 'sanitizePatientSummary must include triageId');
  assert.ok(serverMjs.includes("merged['system:triageId'] = submittedData['system:triageId']"), 'mergeRecordDataForRole must preserve system:triageId');
});
