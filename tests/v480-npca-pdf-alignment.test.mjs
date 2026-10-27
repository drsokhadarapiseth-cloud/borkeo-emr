// v48.0 - NPCA guide v1.4 (PDF) alignment: marital status / occupation /
// disability from the current Registration positions, encounter class, PDF and
// Excel field names, single CMS codes, date-range status check, approval pack.
// Synthetic data, in-memory databases and the loopback mock only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';
import { ensureNpcaSchema } from '../server/npca/storage.mjs';
import { setCodeOverride } from '../server/npca/codes.mjs';
import { buildVisitPayload } from '../server/npca/visit-builder.mjs';
import { validateVisitPayload } from '../server/npca/validation.mjs';
import { npcaSettings } from '../server/npca/settings.mjs';
import { NpcaIntegration } from '../server/npca/integration.mjs';
import { sourceForPatient } from '../server/npca/source.mjs';
import { registrationMarital, registrationOccupation, registrationDisabilities } from '../server/npca/registration-fields.mjs';
import { createEmrServer } from '../server/server.mjs';
import { buildHostingTestPatients } from '../scripts/seed-hosting-test-patients.mjs';
import { buildApprovalSamples, writeApprovalPack } from '../scripts/build-npca-approval-pack.mjs';
import { syntheticVisit, syntheticValidation } from './helpers/npca-fixtures.mjs';
import { startNpcaMock } from './helpers/npca-mock.mjs';

const OTHER = 'ផ្សេងៗ';
const DISABLED = 'ពិការ';
const auto = (n, v) => ({ ['scope:registration:auto:' + n]: v });
const mockSettings = (mock) => npcaSettings({ enabled: true, baseUrl: mock.url, localMock: true, clientId: 'MOCK-CLIENT', clientSecret: 'MOCK-CLIENT-SECRET', username: 'MOCK-USER', password: 'MOCK-PASSWORD', systemCode: 'MOCK-SYSTEM', facilityCode: 'MOCK-FACILITY', timeoutMs: 1000, pollHours: 8 }, {});
function database() {
  const db = openDatabase(':memory:'); ensureNpcaSchema(db);
  db.createUser({ id: 'synthetic-admin', username: 'synthetic-admin', displayName: 'synthetic-admin', role: 'ADMIN', passwordHash: 'synthetic-unused-hash', createdAt: Date.now() });
  setCodeOverride(db, 'service', 'SYNTHETIC_SERVICE', 'MOCK-SERVICE', 'synthetic-admin');
  return db;
}

test('Registration marital status, occupation and disability are read from the current form positions', () => {
  assert.equal(registrationMarital({ ...auto(32, true), ...auto(33, false) }), 'Married');
  assert.equal(registrationMarital({ ...auto(33, true) }), 'Single');
  assert.equal(registrationMarital({ ...auto(32, true), ...auto(33, true) }), '', 'two answers are not guessed');
  assert.equal(registrationMarital({ ...auto(22, true) }), '', 'the old position is not used');
  assert.equal(registrationOccupation(auto(37, 'Farmer')), 'Farmer');
  assert.equal(registrationOccupation({ ...auto(37, OTHER), 'scope:registration:id:reg_occupation_other': 'Fisher' }), 'Fisher');
  assert.deepEqual(registrationDisabilities({ ...auto(38, true), ...auto(39, false) }), [DISABLED]);
  assert.deepEqual(registrationDisabilities({ ...auto(38, false), ...auto(39, true) }), []);
  assert.deepEqual(registrationDisabilities({}), []);
});

test('a complete test patient now gives NPCA its marital status and occupation (was blocked as unmapped)', () => {
  const app = createEmrServer({ demoMode: false, databasePath: ':memory:', host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test', npca: { enabled: false } });
  try {
    const userId = app.database.sqlite.prepare('SELECT id FROM users LIMIT 1').get().id;
    const patient = buildHostingTestPatients(Date.parse('2026-10-26T03:00:00Z'))[3];
    app.database.upsertPatient({ ...patient, userId });
    const source = sourceForPatient(app.database, app.database.findPatient(patient.patientKey));
    assert.equal(source.patient.maritalStatus, 'Married');
    assert.ok(source.patient.occupation);
    assert.deepEqual(source.patient.disabilities, []);
    const built = buildVisitPayload(source, { facilityCode: 'MOCK-FACILITY', sendForms: true }, app.database);
    assert.ok(!built.issues.some((issue) => issue.field === 'patient.marital_status'), JSON.stringify(built.issues));
    const sent = built.payload.visits[0].patient;
    assert.equal(sent.occupation, source.patient.occupation);
    assert.equal('disabilities' in sent, false, 'not disabled: nothing sent');
  } finally { app.npca?.stop?.(); app.database.close(); }
});

test('payload carries the PDF names next to the Excel names and the encounter class', () => {
  const db = database();
  try {
    for (const mode of ['opd', 'ipd']) {
      const source = syntheticVisit(mode);
      source.patient.occupation = 'Teacher'; source.patient.disabilities = ['Hearing impairment'];
      source.prescriptions[0].medications[0].form = 'Tablet';
      source.emergencies = [{ ...syntheticVisit('opd').outpatients[0], id: 'emergency', emergency_notes: 'Synthetic emergency note' }];
      const built = buildVisitPayload(source, { facilityCode: 'MOCK-FACILITY', sendForms: true }, db);
      assert.deepEqual(validateVisitPayload(built.payload, syntheticValidation), [], mode);
      const v = built.payload.visits[0];
      assert.equal(v.patient.occupation, 'Teacher');
      assert.deepEqual(v.patient.disabilities, ['Hearing impairment']);
      assert.equal((mode === 'opd' ? v.outpatients : v.inpatients)[0].class, mode.toUpperCase());
      assert.equal(v.emergencies[0].class, 'EMERGENCY');
      for (const d of v.diagnoses) assert.equal(d.diagnosis_type, d.diagnosis_type_name);
      const m = v.prescriptions[0].medications[0];
      assert.equal(m.medicine_code, m.code); assert.equal(m.form, 'Tablet');
    }
  } finally { db.close(); }
});

test('only single CMS codes pass; catalogue notes or double codes are listed for correction', () => {
  const db = database();
  try {
    const manager = new NpcaIntegration({ ...npcaSettings({}, {}), facilityCode: 'MOCK-FACILITY' }, db);
    try {
      assert.equal(manager.cmsCodes.has('AA0060'), true);
      for (const bad of ['AA0410, AA0411', 'Core', 'Comp', 'WHO', 'Reserve 9th']) assert.equal(manager.cmsCodes.has(bad), false, bad);
    } finally { manager.stop(); }
  } finally { db.close(); }
});

test('date-range status check updates every submitted visit, follows pages and accepts text statuses', async () => {
  const mock = await startNpcaMock(); const db = database();
  let now = Date.parse('2026-10-23T05:00:00Z');
  const sources = new Map();
  for (const n of [1, 2, 3]) { const s = syntheticVisit('opd'); s.patient.patientKey = 'case:NPCA-RANGE-' + n; s.link.payment_type = 'PATY-0000N09'; sources.set(s.patient.patientKey, s); }
  db.findPatient = (key) => sources.has(key) ? { patient_key: key, version: 1 } : null;
  const manager = new NpcaIntegration(mockSettings(mock), db, { sourceFactory: (database, row) => sources.get(row.patient_key), validationOptions: syntheticValidation, clock: () => now });
  try {
    for (const key of sources.keys()) { manager.enqueue(key, 'synthetic-admin'); await manager.tick(); now += 1000; }
    assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM npca_submissions WHERE status=5').get().n, 3);
    mock.state.finalStatus = 1; mock.state.statusAsText = true;
    // per_page is fixed at 100 by the EMR; the mock pages are checked with a smaller page size.
    const original = manager.client.request.bind(manager.client);
    const pages = [];
    manager.client.request = (name, values, options) => { if (name === 'processed') { pages.push(values.page); values = { ...values, per_page: 2 }; } return original(name, values, options); };
    const result = await manager.checkProcessed({ from: '2026-10-01', to: '2026-10-31', by: 'discharged' }, 'synthetic-admin');
    assert.deepEqual(result, { checked: 3, updated: 3 });
    assert.deepEqual(pages, [1, 2]);
    assert.equal(db.sqlite.prepare("SELECT COUNT(*) n FROM npca_submissions WHERE status=1 AND queue_state='terminal'").get().n, 3);
    const request = mock.state.requests.find((r) => r.path.endsWith('/visits/processed') && !r.body.visit_code);
    assert.ok(request);
    for (const bad of [{ from: '2026-10-31', to: '2026-10-01' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '2025-01-01', to: '2026-10-01' }, { from: '2026-10-01', to: '2026-10-02', by: 'other' }]) {
      await assert.rejects(manager.checkProcessed(bad, 'synthetic-admin'), (e) => e.status === 400, JSON.stringify(bad));
    }
    assert.ok(db.sqlite.prepare("SELECT COUNT(*) n FROM audit_events WHERE action='NPCA_STATUS_RANGE_CHECK'").get().n >= 1);
  } finally { manager.stop(); db.close(); await mock.close(); }
  const off = new NpcaIntegration(npcaSettings({}, {}), database());
  try { await assert.rejects(off.checkProcessed({ from: '2026-10-01', to: '2026-10-02' }), (e) => e.code === 'disabled'); } finally { off.stop(); off.database.close(); }
});

test('date-range check is for cashier, accountant and ADMIN only, with CSRF', async () => {
  const mock = await startNpcaMock();
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test', npca: mockSettings(mock) });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve)); const origin = 'http://127.0.0.1:' + app.server.address().port;
  const login = async (username) => { const r = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: app.config.appOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) }); assert.equal(r.status, 200, username); const Cookie = r.headers.get('set-cookie').split(';')[0]; const me = await fetch(origin + '/api/auth/me', { headers: { Cookie } }).then((x) => x.json()); return { Cookie, Origin: app.config.appOrigin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken }; };
  const call = (headers, body) => fetch(origin + '/api/npca/check-processed', { method: 'POST', headers, body: JSON.stringify(body) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
  try {
    const clerk = await login('clerk'), director = await login('director'), doctor = await login('doctor_opd');
    const range = { from: '2026-10-01', to: '2026-10-31', by: 'discharged' };
    assert.equal((await call(director, range)).status, 403);
    assert.equal((await call(doctor, range)).status, 403);
    assert.equal((await call({ ...clerk, 'X-CSRF-Token': '' }, range)).status, 403);
    const ok = await call(clerk, range); assert.equal(ok.status, 200, JSON.stringify(ok.body)); assert.deepEqual(ok.body, { checked: 0, updated: 0 });
    assert.equal((await call(clerk, { from: 'x', to: 'y' })).status, 400);
    const page = await fetch(origin + '/npca', { headers: clerk }).then((r) => r.text());
    assert.match(page, /id="npca-range-check"/);
  } finally { app.npca?.stop?.(); await new Promise((resolve) => app.server.close(resolve)); app.database.close(); await mock.close(); }
});

test('approval pack: the five sample JSON pass the EMR validation with the real ICD-10, CMS and NCDD lists', () => {
  const samples = buildApprovalSamples();
  assert.deepEqual(samples.map((s) => s.file), ['opd-sample.json', 'ipd-sample.json', 'transfer-opd-to-ipd-sample.json', 'referral-sample.json', 'form-anc-sample.json']);
  for (const s of samples) { assert.deepEqual(s.issues, [], s.file); assert.deepEqual(s.errors, [], s.file); }
  const text = JSON.stringify(samples.map((s) => s.payload));
  assert.ok(!/data:image|password|secret|token/i.test(text), 'no photo, credential or token in the samples');
  const transfer = samples[2].payload.visits[0];
  assert.equal(transfer.outpatients.length, 1); assert.equal(transfer.inpatients.length, 1);
  assert.equal(samples[3].payload.visits[0].discharge_type, 'DITY-000Y00F');
  assert.equal(samples[4].payload.visits[0].forms[0].form_code, 'ENTY-000H014');
  // The committed pack is what the script builds today.
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-v480-pack-'));
  writeApprovalPack(dir);
  // Line endings may be CRLF in a Windows Git copy.
  const read = (file) => fs.readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const s of samples) assert.equal(read(path.join('docs/npca/approval-pack', s.file)), read(path.join(dir, s.file)), s.file);
});
