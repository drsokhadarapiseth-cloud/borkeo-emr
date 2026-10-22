// v41.6 - Phase 9: discharge main / secondary ICD-10 and patient instructions,
// intake / output daily balance, NEWS2 early warning score, critical result
// escalation.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { clinicalOptions } from '../server/clinical-summary.mjs';
import { escalateCriticalResults } from '../server/critical-escalation.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const port = 34416;
const origin = `http://127.0.0.1:${port}`;

function patient(app, key, ward = 'medicine') {
  const userId = app.database.sqlite.prepare("SELECT id FROM users WHERE username='doctor_medicine'").get().id;
  app.database.upsertPatient({
    id: crypto.randomUUID(), patientKey: key, userId, savedAt: Date.now(),
    summary: { caseNumber: key.slice(5), healthId: '', firstName: 'Synthetic', lastName: 'Patient', fullName: 'Synthetic Patient', sex: 'Male', age: '60', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'EXEMPT', departmentCode: ward, departmentNameKh: '', departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: '2026-10-18', dischargeDate: '' },
    data: {},
  });
  return userId;
}

test('v41.6 discharge keeps main / secondary ICD-10 (main first) and patient instructions; escalation of unacknowledged critical results', async () => {
  const app = createEmrServer({ demoMode: true, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
    const doctorId = patient(app, 'case:V416');
    const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'doctor_medicine' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookie } })).json();
    const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
    const discharge = (extra) => fetch(origin + '/api/patient-admission', { method: 'PATCH', headers, body: JSON.stringify({
      patientKey: 'case:V416', action: 'discharge', dischargeDate: '2026-10-21', dischargeDepartment: 'Medicine',
      admissionDiagnosis: 'Pneumonia', admissionIcd10: 'J18.9', admissionAt: '2026-10-18T08:00',
      dischargeDiagnosis: 'Pneumonia, improved', dischargeIcd10: 'J18.9', dischargeAt: '2026-10-21T09:30',
      outcome: 'improved', status: 'ordered', followUpDate: '2026-10-28', deceased: false, ...extra }) });

    assert.equal((await discharge({ dischargeDiagnoses: [{ icd10: 'not a code', text: 'x', main: true }] })).status, 400);
    const response = await discharge({
      dischargeDiagnoses: [{ icd10: 'E11', text: 'Type 2 diabetes', main: false }, { icd10: 'j18.9', text: 'Pneumonia', main: true }],
      patientInstructions: 'Take all antibiotics.\nCome back if fever returns.',
    });
    assert.equal(response.status, 200, await response.clone().text());
    const saved = (await response.json()).patient.discharge;
    assert.deepEqual(saved.dischargeDiagnoses, [{ icd10: 'J18.9', text: 'Pneumonia', main: true }, { icd10: 'E11', text: 'Type 2 diabetes', main: false }]);
    assert.equal(saved.patientInstructions, 'Take all antibiotics.\nCome back if fever returns.');
    assert.equal(saved.dischargeIcd10, 'J18.9', 'existing fields unchanged');

    // Critical result escalation.
    const order = (id, releasedAgo, ack = null) => app.database.sqlite.prepare(`INSERT INTO paraclinic_orders
      (id, patient_key, modality, priority, status, request_json, result_json, requested_by, requested_role, requested_ward, created_at, updated_at, released_at, has_critical, critical_ack_at)
      VALUES (?, 'case:V416', 'LAB', 'ROUTINE', 'RELEASED', '{"tests":["Potassium"]}', '{}', ?, 'DOCTOR', 'medicine', ?, ?, ?, 1, ?)`)
      .run(id, doctorId, Date.now() - releasedAgo, Date.now(), Date.now() - releasedAgo, ack);
    order('crit-old', 45 * 60_000);
    order('crit-new', 10 * 60_000);
    order('crit-acked', 45 * 60_000, Date.now());
    const options = clinicalOptions().criticalEscalation;
    assert.deepEqual(options, { minutes: 30, roles: ['DOCTOR', 'CHIEF_WARD', 'WARD_HEAD'] });
    const first = escalateCriticalResults(app.database, options);
    assert.deepEqual(first.map((e) => [e.orderId, e.ward, e.messages]), [['crit-old', 'medicine', 3]]);
    assert.deepEqual(escalateCriticalResults(app.database, options), [], 'each result is escalated once');
    const messages = app.database.sqlite.prepare("SELECT destination_type, destination_code, destination_role, subject, patient_key FROM staff_messages WHERE patient_key='case:V416' ORDER BY destination_role").all();
    assert.deepEqual(messages.map((m) => [m.destination_type, m.destination_code, m.destination_role]), [['WARD', 'medicine', 'CHIEF_WARD'], ['WARD', 'medicine', 'DOCTOR'], ['WARD', 'medicine', 'WARD_HEAD']]);
    assert.ok(messages.every((m) => m.subject.startsWith('ការជូនដំណឹងបន្ទាន់អំពីលទ្ធផលគ្រោះថ្នាក់')));
    // The existing acknowledgement is unchanged.
    assert.equal(app.database.sqlite.prepare("SELECT critical_ack_at FROM paraclinic_orders WHERE id='crit-old'").get().critical_ack_at, null);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
  }
});

test('NEWS2 table and scoring (owner choice), adults only', async () => {
  const config = clinicalOptions().earlyWarning;
  assert.equal(config.name, 'NEWS2');
  assert.equal(config.minAge, 16);
  const window = { addEventListener() {} };
  const document = { addEventListener() {}, querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, dispatchEvent() {} };
  vm.runInNewContext(read('public/early-warning.js'), { window, document, fetch: () => Promise.resolve({ ok: false }), setTimeout, clearTimeout, CustomEvent: class {} });
  const score = (v) => window.EmrEarlyWarning.compute({ respRate: 16, spo2: 97, onOxygen: false, systolic: 120, pulse: 70, consciousness: 'A', temperature: 37, ...v }, config);
  assert.deepEqual([score({}).total, score({}).level], [0, 'low']);
  assert.deepEqual([score({ respRate: 25 }).total, score({ respRate: 25 }).level], [3, 'lowMedium']);
  assert.deepEqual([score({ respRate: 22, pulse: 105, temperature: 38.5, systolic: 105 }).total, score({ respRate: 22, pulse: 105, temperature: 38.5, systolic: 105 }).level], [5, 'medium']);
  const sick = score({ respRate: 22, spo2: 93, onOxygen: true, systolic: 105, pulse: 115, temperature: 38.5 });
  assert.deepEqual([sick.total, sick.level], [10, 'high']);
  assert.deepEqual(score({ consciousness: 'V' }).parts.consciousness, 3);
  // Edges of the bands.
  assert.deepEqual([score({ respRate: 8 }).parts.respRate, score({ respRate: 9 }).parts.respRate, score({ systolic: 220 }).parts.systolic, score({ temperature: 39.1 }).parts.temperature], [3, 1, 3, 2]);
  const incomplete = score({ onOxygen: null, consciousness: '' });
  assert.deepEqual([...incomplete.missing], ['onOxygen', 'consciousness']);
});

test('discharge summary prints saved data only; I/O balance row is never editable or counted', () => {
  const workflow = read('public/emr-inpatient-workflow.js');
  assert.match(workflow, /const saved = patient\.discharge \|\| patient\.data\?\.\['system:discharge'\] \|\| \{\};\r?\n    if \(!saved\.dischargeAt\) return;/);
  assert.match(workflow, /dischargeDiagnoses: window\.collectEmrDiagnoses\?\.\('discharge'\) \|\| \[\],/);
  assert.match(read('public/emr-diagnoses.js'), /discharge: \{ code: 'emr_discharge_icd10', text: 'emr_discharge_diagnosis', hidden: 'emr_discharge_diagnoses', mainSecondary: true \}/);
  const balance = read('public/fluid-balance.js');
  assert.match(balance, /if \(index > 0\) \{ cell\.classList\.add\('nursing-calculated-cell'\); cell\.textContent = ''; \}/);
  assert.match(balance, /cell\.removeAttribute\('contenteditable'\);/);
  // initializeNursingEditableTables skips calculated cells (EMR.html), so the row never takes a key.
  assert.match(read('protected/EMR.html'), /if \(cell\.classList\.contains\('nursing-calculated-cell'\) \|\| cell\.classList\.contains\('nursing-med-time-cell'\)/);
});
