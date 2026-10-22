// v41.0 - Structured allergy record, active problem list and resuscitation status
// (server API), and the allergy summary used by the banner and the bed popup.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';
import { RECORD_NONE_WORDS, allergyAlert, ensureClinicalSummarySchema } from '../server/clinical-summary.mjs';

const KHMER_NONE = [...RECORD_NONE_WORDS][0];

const port = 34410;
const origin = `http://127.0.0.1:${port}`;
const password = 'Clinical summary test password 410';

async function addUser(app, username, role, wards) {
  const id = crypto.randomUUID();
  app.database.createUser({ id, username, displayName: username, role, passwordHash: await hashPassword(password), createdAt: Date.now() });
  setUserAccess(app.database, id, [role], wards);
  return id;
}

async function login(username) {
  const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookie } })).json();
  return { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
}

function addPatient(app, userId, patientKey, healthId, data = {}) {
  app.database.upsertPatient({
    id: crypto.randomUUID(), patientKey, userId, savedAt: Date.now(),
    summary: { caseNumber: patientKey.slice(5), healthId, firstName: 'Synthetic', lastName: 'Patient', fullName: 'Synthetic Patient', sex: 'Female', age: '40', dateOfBirth: '1986-01-01', phone: '', equityCard: '', paymentType: 'EXEMPT', departmentCode: 'medicine', departmentNameKh: '', departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: '2026-10-01', dischargeDate: '' },
    data,
  });
}

test('v41.0 clinical summary: doctors record allergies, problems and resuscitation status; others read; nothing is deleted', async () => {
  const app = createEmrServer({ demoMode: false, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
    ensureClinicalSummarySchema(app.database); // idempotent: already created at start-up
    const doctorId = await addUser(app, 'doctor410', 'DOCTOR', ['medicine']);
    await addUser(app, 'nurse410', 'NURSE', ['medicine']);
    await addUser(app, 'surgeon410', 'DOCTOR', ['surgery']);
    addPatient(app, doctorId, 'case:V410-A', 'H410');
    addPatient(app, doctorId, 'case:V410-B', 'H410'); // a second visit of the same person
    addPatient(app, doctorId, 'case:V410-C', 'H411', { 'scope:medical:auto:83': KHMER_NONE });
    const doctor = await login('doctor410');
    const nurse = await login('nurse410');
    const surgeon = await login('surgeon410');
    const post = (headers, path, body) => fetch(origin + path, { method: 'POST', headers, body: JSON.stringify(body) });
    const summary = async (headers, key) => (await fetch(`${origin}/api/clinical-summary?patientKey=${encodeURIComponent(key)}`, { headers })).json();

    // Reading: empty summary, nothing recorded yet.
    const empty = await summary(nurse, 'case:V410-A');
    assert.deepEqual([empty.allergies.length, empty.problems.length, empty.resuscitation], [0, 0, null]);
    assert.equal(empty.allergyAlert.state, 'not-recorded');
    assert.deepEqual(empty.options.allergyTypes, ['drug', 'food', 'other']);

    // Only doctors write; the security token is required; other wards cannot see the patient.
    assert.equal((await post(nurse, '/api/clinical-summary/allergies', { patientKey: 'case:V410-A', allergyType: 'drug', substance: 'Penicillin' })).status, 403);
    assert.equal((await post({ ...doctor, 'X-CSRF-Token': 'wrong' }, '/api/clinical-summary/allergies', { patientKey: 'case:V410-A', allergyType: 'drug', substance: 'Penicillin' })).status, 403);
    assert.equal((await post(surgeon, '/api/clinical-summary/allergies', { patientKey: 'case:V410-A', allergyType: 'drug', substance: 'Penicillin' })).status, 404);
    assert.equal((await post(doctor, '/api/clinical-summary/allergies', { patientKey: 'case:V410-A', allergyType: 'drug', substance: 'Penicillin', severity: 'extreme' })).status, 400);
    assert.equal((await post(doctor, '/api/clinical-summary/allergies', { patientKey: 'case:V410-A', allergyType: 'drug', substance: '' })).status, 400);

    const added = await post(doctor, '/api/clinical-summary/allergies', { patientKey: 'case:V410-A', allergyType: 'drug', substance: 'Penicillin', reaction: 'Rash', severity: 'severe', notedOn: '2026-10-01' });
    assert.equal(added.status, 201, await added.clone().text());
    await post(doctor, '/api/clinical-summary/allergies', { patientKey: 'case:V410-A', allergyType: 'food', substance: 'Peanut', severity: 'moderate' });

    // The allergy follows the person to another visit (same Health ID).
    const otherVisit = await summary(nurse, 'case:V410-B');
    assert.deepEqual(otherVisit.allergies.map((a) => [a.allergyType, a.substance, a.recordedBy]), [['drug', 'Penicillin', 'doctor410'], ['food', 'Peanut', 'doctor410']]);
    assert.equal(otherVisit.allergyAlert.state, 'allergy');

    // Removing needs a reason and keeps the row.
    const penicillin = otherVisit.allergies[0];
    assert.equal((await post(doctor, `/api/clinical-summary/allergies/${penicillin.id}/remove`, { patientKey: 'case:V410-A' })).status, 400);
    assert.equal((await post(doctor, `/api/clinical-summary/allergies/${penicillin.id}/remove`, { patientKey: 'case:V410-A', reason: 'Entered in error' })).status, 200);
    assert.deepEqual((await summary(nurse, 'case:V410-A')).allergies.map((a) => a.substance), ['Peanut']);
    const kept = app.database.sqlite.prepare('SELECT removed_at, removed_by_name, remove_reason FROM patient_allergies WHERE id=?').get(penicillin.id);
    assert.ok(kept.removed_at);
    assert.equal(kept.remove_reason, 'Entered in error');

    // Problem list: add, resolve, reactivate.
    assert.equal((await post(doctor, '/api/clinical-summary/problems', { patientKey: 'case:V410-A', problem: 'Type 2 diabetes', icd10: 'E11', notedOn: '2025-01-01' })).status, 201);
    assert.equal((await post(doctor, '/api/clinical-summary/problems', { patientKey: 'case:V410-A', problem: 'x', icd10: 'not-a-code' })).status, 400);
    const problem = (await summary(doctor, 'case:V410-B')).problems[0];
    assert.deepEqual([problem.problem, problem.icd10, problem.status], ['Type 2 diabetes', 'E11', 'active']);
    assert.equal((await post(doctor, `/api/clinical-summary/problems/${problem.id}/status`, { patientKey: 'case:V410-A', status: 'resolved' })).status, 200);
    assert.equal((await summary(doctor, 'case:V410-A')).problems[0].status, 'resolved');

    // Resuscitation status belongs to this encounter only; history is kept.
    assert.equal((await post(doctor, '/api/clinical-summary/resuscitation', { patientKey: 'case:V410-A', status: 'unknown-code' })).status, 400);
    assert.equal((await post(doctor, '/api/clinical-summary/resuscitation', { patientKey: 'case:V410-A', status: 'full' })).status, 201);
    assert.equal((await post(doctor, '/api/clinical-summary/resuscitation', { patientKey: 'case:V410-A', status: 'dnr' })).status, 201);
    assert.equal((await summary(nurse, 'case:V410-A')).resuscitation.status, 'dnr');
    assert.equal((await summary(nurse, 'case:V410-B')).resuscitation, null);
    assert.equal(app.database.sqlite.prepare("SELECT COUNT(*) AS n FROM patient_resuscitation_status WHERE patient_key='case:V410-A'").get().n, 2);

    // Every change is audited.
    const actions = app.database.sqlite.prepare("SELECT action FROM audit_events WHERE action LIKE 'ALLERGY_%' OR action LIKE 'PROBLEM_%' OR action LIKE 'RESUSCITATION_%'").all().map((r) => r.action);
    for (const action of ['ALLERGY_RECORDED', 'ALLERGY_REMOVED', 'PROBLEM_RECORDED', 'PROBLEM_STATUS_CHANGED', 'RESUSCITATION_STATUS_RECORDED']) assert.ok(actions.includes(action), action);

    // The ward patient list carries the allergy summary for the bed popup.
    const list = (await (await fetch(origin + '/api/patients', { headers: { Cookie: doctor.Cookie } })).json()).patients;
    const byKey = Object.fromEntries(list.map((p) => [p.patientKey, p.allergyAlert]));
    assert.equal(byKey['case:V410-A'].state, 'allergy');
    assert.deepEqual(byKey['case:V410-A'].items.map((i) => i.substance), ['Peanut']);
    assert.equal(byKey['case:V410-C'].state, 'none');
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
  }
});

test('v41.0 allergy summary: the record free-text drug allergy counts; "none" is not an allergy; empty is not recorded', () => {
  assert.equal(allergyAlert([], {}).state, 'not-recorded');
  assert.equal(allergyAlert([], { 'scope:medical:auto:83': 'None' }).state, 'none');
  assert.deepEqual(allergyAlert([], { 'scope:medical:auto:83': 'Sulfa - rash' }), { state: 'allergy', items: [], freeText: 'Sulfa - rash', ticked: false });
  assert.equal(allergyAlert([], { 'scope:medical:auto:82': true }).state, 'allergy');
  assert.equal(allergyAlert([{ allergyType: 'food', substance: 'Egg', severity: '' }], {}).state, 'allergy');
});
