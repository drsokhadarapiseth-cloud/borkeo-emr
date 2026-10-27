// v48.1 - NPCA practice mode for the test hosting: 30 seeded patients without
// photos (12 HEF, 12 NSSF, 6 cash, the card check saved, one card not eligible
// in each group); HEF / NSSF / NPCA checks and a practice NPCA answer locally.
// Temporary databases with synthetic patients only; no network.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { loadConfig } from '../server/config.mjs';
import { openDatabase } from '../server/database.mjs';
import { ensureNpcaSchema } from '../server/npca/storage.mjs';
import { NpcaClient } from '../server/npca/client.mjs';
import { NpcaIntegration } from '../server/npca/integration.mjs';
import { assertNpcaPracticeAllowed, createPracticeFetch, npcaPracticeSettings, PRACTICE_FACILITY, PRACTICE_READY_MS } from '../server/npca/practice.mjs';
import { createEmrServer } from '../server/server.mjs';
import { buildHostingTestPatients, seedHostingTestPatients, paymentKind } from '../scripts/seed-hosting-test-patients.mjs';
import { syntheticVisit, syntheticValidation } from './helpers/npca-fixtures.mjs';

const NOW = Date.parse('2026-10-27T03:00:00Z');
const temp = () => path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-v481-')), 'emr.sqlite');
const reg = (p, key) => p.data['scope:registration:id:' + key];

test('30 seeded patients: no photo, 12 HEF / 12 NSSF / 6 cash, card check saved, one card not eligible per group', () => {
  const patients = buildHostingTestPatients(NOW);
  assert.equal(patients.length, 30);
  const count = { HEF: 0, NSSF: 0, CASH: 0 };
  for (const [index, p] of patients.entries()) {
    count[paymentKind(index)]++;
    assert.equal(Object.keys(p.data).some((key) => /photo/i.test(key)), false, p.summary.caseNumber + ' has no photo');
    const hef = reg(p, 'web_equity'), nssf = reg(p, 'web_nssf');
    if (paymentKind(index) === 'HEF') { assert.match(hef, /^\d{10}$/); assert.equal(nssf, ''); assert.equal(JSON.parse(reg(p, 'web_hef_verification')).requestedCard, hef); }
    if (paymentKind(index) === 'NSSF') { assert.match(nssf, /^\d{10}$/); assert.equal(hef, ''); assert.equal(JSON.parse(reg(p, 'web_nssf_verification')).card.number, nssf); }
    if (paymentKind(index) === 'CASH') { assert.equal(hef + nssf, ''); assert.equal(reg(p, 'other_id_yes'), true); }
    // Triage measured and waiting only for the service.
    for (const key of ['p2_temp', 'p2_bp_sys', 'p2_bp_dia', 'p2_pulse', 'p2_resp', 'p2_spo2', 'p2_weight', 'p2_height']) assert.ok(String(p.data['scope:triage:id:' + key] || '').trim(), key);
    assert.equal(p.data['scope:triage:id:p2_other_dept'], '');
    assert.equal(p.data['system:workflowStage'], 'TRIAGE_WAITING');
  }
  assert.deepEqual(count, { HEF: 12, NSSF: 12, CASH: 6 });
  const refused = patients.filter((p) => p.data['system:practiceCardNotEligible'] === true);
  assert.equal(refused.length, 2);
  assert.ok(reg(refused[0], 'web_equity') && reg(refused[1], 'web_nssf'), 'one HEF and one NSSF');
  assert.equal(JSON.parse(reg(refused[0], 'web_hef_verification')).card.valid, false);
  assert.equal(JSON.parse(reg(refused[1], 'web_nssf_verification')).card.valid, false);
});

test('practice mode is refused in production, with a real NPCA connection, and on a database with real patients', async () => {
  assert.throws(() => loadConfig({ npcaPractice: true, nodeEnv: 'production', emrMode: 'production', databasePath: ':memory:', cookieSecure: true }), /practice/i);
  assert.throws(() => npcaPracticeSettings({ enabled: true }), /real NPCA/);
  assert.throws(() => npcaPracticeSettings({}, { NPCA_ENABLED: 'true' }), /real NPCA/);
  assert.equal(npcaPracticeSettings({}, {}).practice, true);
  const file = temp();
  await seedHostingTestPatients(file, { now: NOW, log: () => {} });
  const db = openDatabase(file);
  try {
    const userId = db.findUser('Superuser').id;
    db.upsertPatient({ id: 'real-1', patientKey: 'case:REAL-1', data: { 'scope:registration:id:web_first_name': 'Real' }, savedAt: NOW, userId,
      summary: { caseNumber: 'REAL-1', healthId: 'REAL-1', fullName: 'Real Patient', firstName: 'Real', lastName: 'Patient', sex: '', age: '', dateOfBirth: '', phone: '', equityCard: '', paymentType: '', departmentCode: '', departmentNameKh: '', departmentNameEn: '', serviceMode: '', entryDate: '', dischargeDate: '' } });
    assert.throws(() => assertNpcaPracticeAllowed(db), /refused: 1 patient/);
    db.sqlite.prepare("DELETE FROM patient_records WHERE patient_key='case:REAL-1'").run();
    assertNpcaPracticeAllowed(db);
    // After the first start, patients registered by hand during the practice are allowed.
    db.upsertPatient({ id: 'hand-1', patientKey: 'case:HAND-1', data: {}, savedAt: NOW, userId,
      summary: { caseNumber: 'HAND-1', healthId: 'HAND-1', fullName: 'Hand Patient', firstName: 'Hand', lastName: 'Patient', sex: '', age: '', dateOfBirth: '', phone: '', equityCard: '', paymentType: '', departmentCode: '', departmentNameKh: '', departmentNameEn: '', serviceMode: '', entryDate: '', dischargeDate: '' } });
    assert.doesNotThrow(() => assertNpcaPracticeAllowed(db));
  } finally { db.close(); }
});

test('practice hosting: HEF, NSSF and NPCA card checks answer from the test patients; Registration saves the SPID', async () => {
  const file = temp();
  const seeded = await seedHostingTestPatients(file, { now: NOW, log: () => {} });
  const app = createEmrServer({ databasePath: seeded.file, demoMode: false, host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'development', npcaPractice: true });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  try {
    const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: app.config.appOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Superuser', password: '1234' }) });
    assert.equal(login.status, 200);
    const Cookie = login.headers.get('set-cookie').split(';')[0];
    const me = await fetch(origin + '/api/auth/me', { headers: { Cookie } }).then((r) => r.json());
    const headers = { Cookie, Origin: app.config.appOrigin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
    const call = (route, body, method = 'POST') => fetch(origin + route, { method, headers, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => ({})) }));
    assert.equal((await call('/api/auth/context', { role: 'REGISTRATION' })).status, 200);
    const availability = await call('/api/npca/availability', undefined, 'GET');
    assert.deepEqual(availability.body, { enabled: true, practice: true });

    const patients = buildHostingTestPatients(NOW);
    const hefPatient = patients[0], nssfPatient = patients[1], refusedHef = patients[10], refusedNssf = patients[11];
    const hef = await call('/api/hef/lookup', { cardNumber: reg(hefPatient, 'web_equity') });
    assert.equal(hef.status, 200); assert.equal(hef.body.found, true); assert.equal(hef.body.card.valid, true);
    assert.equal(hef.body.members[0].firstName, reg(hefPatient, 'web_first_name'));
    assert.equal((await call('/api/hef/lookup', { cardNumber: reg(refusedHef, 'web_equity') })).body.card.valid, false);
    assert.equal((await call('/api/hef/lookup', { cardNumber: '1600000000' })).body.found, false);
    const nssf = await call('/api/nssf/verify', { cardNumber: reg(nssfPatient, 'web_nssf') });
    assert.equal(nssf.status, 200); assert.equal(nssf.body.card.status, 'VALID');
    assert.equal((await call('/api/nssf/verify', { cardNumber: reg(refusedNssf, 'web_nssf') })).body.card.valid, false);
    assert.equal((await call('/api/nssf/verify', { cardNumber: '8200000000' })).body.card.status, 'NOT_FOUND');

    const npcaHef = await call('/api/npca/beneficiaries', { cardNumber: reg(hefPatient, 'web_equity') });
    assert.equal(npcaHef.status, 200, JSON.stringify(npcaHef.body)); assert.equal(npcaHef.body.beneficiaries[0].eligible, true);
    assert.equal((await call('/api/npca/beneficiaries', { cardNumber: reg(nssfPatient, 'web_nssf') })).body.beneficiaries[0].eligible, true);
    assert.equal((await call('/api/npca/beneficiaries', { cardNumber: reg(refusedHef, 'web_equity') })).body.beneficiaries[0].eligible, false);
    assert.deepEqual((await call('/api/npca/beneficiaries', { cardNumber: '1600000000' })).body.beneficiaries, []);

    // Registration save with the chosen member keeps the SPID and the HEF scheme.
    const record = await call('/api/patient-record?patientKey=' + encodeURIComponent(hefPatient.patientKey), undefined, 'GET');
    assert.equal(record.status, 200);
    const saved = await call('/api/patient-record', { patientKey: hefPatient.patientKey, expectedVersion: record.body.patient.version, registrationOnly: true,
      summary: { ...hefPatient.summary, dateOfBirth: reg(hefPatient, 'web_dob') }, data: { ...record.body.patient.data, 'scope:registration:id:npca_selection': npcaHef.body.beneficiaries[0].selectionId } }, 'PUT');
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    const link = app.database.sqlite.prepare('SELECT * FROM npca_patient_links WHERE patient_key=?').get(hefPatient.patientKey);
    assert.equal(link.spid, 'PRACTICE-SPID-' + hefPatient.summary.healthId); assert.equal(link.payment_type, 'PATY-0000N09'); assert.equal(link.eligible, 1);
    assert.equal(JSON.parse(app.database.findPatient(hefPatient.patientKey).record_json)['system:workflowStage'], 'TRIAGE_WAITING', 'still waiting for the service');
    // Nothing left the computer: the practice NPCA answered.
    assert.equal(app.config.npca.baseUrl, 'https://npca-practice.invalid');
  } finally {
    app.npca?.stop?.(); app.server.closeAllConnections?.();
    await new Promise((resolve) => app.server.close(resolve)); app.database.close();
  }
});

test('practice NPCA: closed visit goes Processing, then Ready after a minute; a not-eligible card fails with its reason', async () => {
  const file = temp();
  await seedHostingTestPatients(file, { now: NOW, log: () => {} });
  const db = openDatabase(file);
  let now = NOW;
  try {
    ensureNpcaSchema(db);
    const patients = buildHostingTestPatients(NOW), config = npcaPracticeSettings({}, {}), actor = db.findUser('Superuser').id;
    const sources = new Map();
    for (const [n, p] of [[0, patients[0]], [10, patients[10]]]) {
      const s = syntheticVisit('opd'); s.patient.patientKey = p.patientKey; s.link = { spid: 'PRACTICE-SPID-' + p.summary.healthId, eligible: 1, payment_type: 'PATY-0000N09' };
      sources.set(p.patientKey, s); void n;
    }
    db.findPatient = (key) => sources.has(key) ? { patient_key: key, version: 1 } : null;
    const client = new NpcaClient(config, db, { fetchImpl: createPracticeFetch(db, { clock: () => now }) });
    const manager = new NpcaIntegration(config, db, { client, sourceFactory: (database, row) => sources.get(row.patient_key), validationOptions: syntheticValidation, clock: () => now });
    try {
      const status = (key) => db.sqlite.prepare('SELECT status, queue_state, errors FROM npca_submissions WHERE patient_key=?').get(key);
      assert.equal(manager.enqueue(patients[0].patientKey, actor).queued, true);
      await manager.tick();
      assert.equal(status(patients[0].patientKey).status, 5, 'Processing');
      assert.equal(db.sqlite.prepare("SELECT npca_code FROM npca_codes WHERE category='service' AND local_value='SYNTHETIC_SERVICE'").get().npca_code, 'PRACTICE-SYNTHETIC_SERVICE', 'practice service code given automatically');
      assert.equal(JSON.parse(db.sqlite.prepare('SELECT payload FROM npca_submissions WHERE patient_key=?').get(patients[0].patientKey).payload).visits[0].health_facility_code, PRACTICE_FACILITY);
      now += PRACTICE_READY_MS + 1000; await manager.tick();
      assert.equal(status(patients[0].patientKey).status, 1, 'Ready');
      assert.equal(status(patients[0].patientKey).queue_state, 'terminal');
      // Date-range check also reports it.
      const range = await manager.checkProcessed({ from: '2026-10-01', to: '2026-10-31' }, actor);
      assert.deepEqual(range, { checked: 1, updated: 1 });
      // The not-eligible card: practice NPCA refuses with the reason.
      now += 1000; manager.enqueue(patients[10].patientKey, actor); await manager.tick();
      const refused = status(patients[10].patientKey);
      assert.equal(refused.status, 2, 'Failed'); assert.equal(refused.queue_state, 'blocked');
      assert.match(refused.errors, /not eligible/);
    } finally { manager.stop(); }
  } finally { db.close(); }
});
