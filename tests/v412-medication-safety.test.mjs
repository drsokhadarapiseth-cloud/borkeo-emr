// v41.2 - Medication Administration Record, prescribing warning overrides and the
// drug interaction / maximum-dose tables (server API and page wiring).
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const port = 34412;
const origin = `http://127.0.0.1:${port}`;
const password = 'Medication safety test password 412';

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

test('v41.2 MAR, prescribing overrides and drug safety tables: roles, reasons, nothing deleted, audited', async () => {
  const app = createEmrServer({ demoMode: false, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
    const doctorId = await addUser(app, 'doctor412', 'DOCTOR', ['medicine']);
    await addUser(app, 'nurse412', 'NURSE', ['medicine']);
    await addUser(app, 'nurse412s', 'NURSE', ['surgery']);
    await addUser(app, 'admin412', 'ADMIN', []);
    app.database.upsertPatient({
      id: crypto.randomUUID(), patientKey: 'case:V412', userId: doctorId, savedAt: Date.now(),
      summary: { caseNumber: 'V412', healthId: '', firstName: 'Synthetic', lastName: 'Patient', fullName: 'Synthetic Patient', sex: 'Female', age: '40', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'EXEMPT', departmentCode: 'medicine', departmentNameKh: '', departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: '2026-10-01', dischargeDate: '' },
      data: {},
    });
    const doctor = await login('doctor412');
    const nurse = await login('nurse412');
    const otherWard = await login('nurse412s');
    const admin = await login('admin412');
    const post = (headers, p, body) => fetch(origin + p, { method: 'POST', headers, body: JSON.stringify(body) });
    const dose = { patientKey: 'case:V412', orderKey: 'paracetamol|0', medicine: 'Paracetamol 500mg', dose: '1 tab', route: 'PO', scheduledAt: '2026-10-21T01:00:00.000Z', administeredAt: '2026-10-21T01:05:00.000Z' };

    // Who records: nurses and midwives of the ward; never a doctor or another ward.
    assert.equal((await post(doctor, '/api/medication-administrations', { ...dose, status: 'given' })).status, 403);
    assert.equal((await post(otherWard, '/api/medication-administrations', { ...dose, status: 'given' })).status, 404);
    assert.equal((await post({ ...nurse, 'X-CSRF-Token': 'wrong' }, '/api/medication-administrations', { ...dose, status: 'given' })).status, 403);
    // Held or refused needs a reason; the time cannot be in the future.
    assert.equal((await post(nurse, '/api/medication-administrations', { ...dose, status: 'held' })).status, 400);
    assert.equal((await post(nurse, '/api/medication-administrations', { ...dose, status: 'given', administeredAt: new Date(Date.now() + 3600e3).toISOString() })).status, 400);
    assert.equal((await post(nurse, '/api/medication-administrations', { ...dose, status: 'skipped' })).status, 400);
    const given = await post(nurse, '/api/medication-administrations', { ...dose, status: 'given' });
    assert.equal(given.status, 201, await given.clone().text());
    const [entry] = (await given.json()).administrations;
    assert.deepEqual([entry.status, entry.recordedBy, entry.recordedRole], ['given', 'nurse412', 'NURSE']);
    assert.ok(entry.signature?.signatureDataUrl, 'the nurse signature snapshot is kept');
    // The same dose twice is refused; a correction voids with a reason, then records again.
    assert.equal((await post(nurse, '/api/medication-administrations', { ...dose, status: 'refused', note: 'x' })).status, 409);
    assert.equal((await post(nurse, `/api/medication-administrations/${entry.id}/void`, { patientKey: 'case:V412' })).status, 400);
    assert.equal((await post(nurse, `/api/medication-administrations/${entry.id}/void`, { patientKey: 'case:V412', reason: 'Wrong status' })).status, 200);
    assert.equal((await post(nurse, '/api/medication-administrations', { ...dose, status: 'refused', note: 'Patient refused' })).status, 201);
    const list = (await (await fetch(`${origin}/api/medication-administrations?patientKey=case%3AV412`, { headers: doctor })).json()).administrations;
    assert.deepEqual(list.map((a) => [a.status, Boolean(a.voidedAt)]), [['given', true], ['refused', false]]);
    assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) n FROM medication_administrations').get().n, 2);

    // Overrides: doctors only, a reason and a known warning kind are required.
    const override = { patientKey: 'case:V412', medicine: 'Penicillin V', warnings: [{ kind: 'allergy', detail: 'Penicillin (rash)' }], reason: 'Specialist advice' };
    assert.equal((await post(nurse, '/api/prescribing-overrides', override)).status, 403);
    assert.equal((await post(doctor, '/api/prescribing-overrides', { ...override, reason: '' })).status, 400);
    assert.equal((await post(doctor, '/api/prescribing-overrides', { ...override, warnings: [{ kind: 'other', detail: 'x' }] })).status, 400);
    assert.equal((await post(doctor, '/api/prescribing-overrides', override)).status, 201);

    // Drug safety tables start empty; administrators edit; doctors read.
    const tables = await (await fetch(origin + '/api/drug-safety', { headers: doctor })).json();
    // v42.5: the Essential Medicines List maximum doses are loaded as drafts (not used until approved).
    assert.deepEqual([tables.interactions, tables.maxDoses.filter((row) => !row.doseKey), tables.canEdit], [[], [], false]);
    assert.ok(tables.maxDoses.length > 0 && tables.maxDoses.every((row) => row.status === 'draft'));
    assert.equal((await fetch(origin + '/api/drug-safety', { headers: nurse })).status, 403);
    assert.equal((await post(doctor, '/api/drug-safety/interactions', { drugA: 'Warfarin', drugB: 'Aspirin' })).status, 403);
    assert.equal((await post(admin, '/api/drug-safety/interactions', { drugA: 'Warfarin', drugB: 'warfarin' })).status, 400);
    assert.equal((await post(admin, '/api/drug-safety/max-doses', { drug: 'Paracetamol' })).status, 400);
    const added = await (await post(admin, '/api/drug-safety/interactions', { drugA: 'Warfarin', drugB: 'Aspirin', severity: 'major' })).json();
    assert.equal(added.interactions.length, 1);
    assert.equal((await post(admin, '/api/drug-safety/max-doses', { drug: 'Paracetamol', maxPerDose: 2, maxPerDay: 8, unit: 'tab' })).status, 200);
    assert.equal((await post(admin, `/api/drug-safety/interactions/${added.interactions[0].id}/delete`, {})).status, 200);

    const actions = new Set(app.database.sqlite.prepare('SELECT action FROM audit_events').all().map((r) => r.action));
    for (const action of ['MEDICATION_ADMINISTRATION_RECORDED', 'MEDICATION_ADMINISTRATION_VOIDED', 'PRESCRIBING_WARNING_OVERRIDDEN', 'DRUG_SAFETY_ROW_ADDED', 'DRUG_SAFETY_ROW_DELETED']) assert.ok(actions.has(action), action);

    // The admin page is open to management only.
    const page = async (headers) => (await fetch(origin + '/admin/drug-safety', { headers: { Cookie: headers.Cookie }, redirect: 'manual' })).status;
    assert.equal(await page(admin), 200);
    assert.notEqual(await page(nurse), 200);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
  }
});

test('medicine name matching for warnings: generic name, allergy substance, table entries', () => {
  const source = read('public/medication-safety.js');
  const start = source.indexOf('  const normalize = (value) =>');
  const end = source.indexOf('  const number = (value) =>');
  const context = vm.createContext({});
  vm.runInContext(source.slice(start, end).replace(/^  const /gm, '  var '), context);
  assert.equal(context.sameMedicine('Paracetamol 500mg', 'paracetamol 1g'), true);
  assert.equal(context.sameMedicine('Paracetamol 500mg', 'Ibuprofen 400mg'), false);
  assert.equal(context.sameMedicine('ORS', 'ORS'), false, 'names shorter than 4 letters are not compared');
  assert.equal(context.names('Penicillin V 500mg', 'Penicillin'), true);
  assert.equal(context.names('Amoxicillin 500mg', 'Penicillin'), false);
  assert.equal(context.names('Aspirin 100mg', 'aspirin'), true);
  assert.equal(context.names('Paracetamol', 'Pa'), false);
});

test('the chart, the prescriptions and the record stay as they were', () => {
  const source = read('public/medication-safety.js');
  for (const control of source.match(/<(input|select|textarea)\b[^>]*>/g) || []) assert.match(control, /data-emr-transient/, control);
  // The old tick no longer changes the cell by itself: the click is captured and opens the form.
  assert.match(source, /event\.target\.closest\?\.\('#sub_nursing \.nursing-med-dose-check'\)/);
  assert.match(source, /event\.preventDefault\(\);\s*event\.stopImmediatePropagation\(\);/);
  // Warnings only for prescribers (v42.5: doctors and midwives), on the medical record page
  // (v42.5: discharge medicines included).
  assert.match(source, /const PRESCRIBERS = \['DOCTOR', 'MIDWIFE'\];/);
  assert.match(source, /if \(!isPrescriber\(\)\) return;/);
  assert.match(source, /if \(field && \(field\.closest\('#page3'\) \|\| field\.closest\('#emr-discharge-rx-body'\)\)\) checkPrescription\(field\);/);
  // The EMR page loads the script; the admin page has a menu entry with a translation key.
  assert.match(read('server/server.mjs'), /medication-safety\.js\?v=4120/);
  assert.match(read('public/nav-config.js'), /id: 'admin-drug-safety'.*newTextKey: 'nav\.drugSafety'/);
  // v42.5: the Head of Pharmacy approves the maximum doses on this page.
  assert.match(read('server/access.mjs'), /if \(pathname === '\/admin\/drug-safety'\) return \['ADMIN','DIRECTOR','VICE_DIRECTOR','PHARMACY'\]\.includes\(role\);/);
});
