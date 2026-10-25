// v41.0 - Patient banner (allergy states, clinical row), structured allergy and
// problem list editors, bed popup allergy box, nursing identity fields that keep
// saved typed values, and letterheads on print only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { allergyAlert, RECORD_DRUG_ALLERGY_CHECK, RECORD_DRUG_ALLERGY_TEXT, RECORD_NONE_WORDS } from '../server/clinical-summary.mjs';
import { summaryFixture } from './helpers/clinical-summary-fixture.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('allergy summary reads the frozen record drug-allergy keys, never missing legacy keys', () => {
  assert.equal(RECORD_DRUG_ALLERGY_CHECK, 'scope:medical:auto:82');
  assert.equal(RECORD_DRUG_ALLERGY_TEXT, 'scope:medical:auto:83');
  const html = read('protected/EMR.html');
  assert.match(html, /<input\b[^>]*data-emr-key-index="82"[^>]*data-emr-legacy-index="249"[^>]*type="checkbox"/);
  assert.match(html, /<input\b[^>]*data-emr-key-index="83"[^>]*data-emr-legacy-index="250"[^>]*type="text"/);
  assert.equal(allergyAlert([], { emr_pmrs_ipd_allergy: 'Penicillin' }).state, 'not-recorded');
  assert.equal(allergyAlert([], { [RECORD_DRUG_ALLERGY_TEXT]: 'Sulfa - rash' }).state, 'allergy');
  assert.equal(allergyAlert([], {}).state, 'not-recorded');
});

test('allergy states preserve free text, checkbox, explicit negatives and structured precedence through the provider', async () => {
  const f = summaryFixture();
  const cases = [[{}, [], 'not-recorded'], [{ [RECORD_DRUG_ALLERGY_TEXT]: 'Sulfa - rash' }, [], 'allergy'],
    [{ [RECORD_DRUG_ALLERGY_CHECK]: true }, [], 'allergy'], [{}, [{ allergyType: 'food', substance: 'Egg' }], 'allergy']];
  for (const none of [...RECORD_NONE_WORDS, 'NKDA', 'None']) {
    cases.push([{ [RECORD_DRUG_ALLERGY_TEXT]: none }, [], 'none']);
    // Preserve established server precedence, including a checkbox plus explicit none.
    cases.push([{ [RECORD_DRUG_ALLERGY_CHECK]: true, [RECORD_DRUG_ALLERGY_TEXT]: none }, [], 'none']);
    cases.push([{ [RECORD_DRUG_ALLERGY_TEXT]: none }, [{ allergyType: 'drug', substance: 'Penicillin' }], 'allergy']);
  }
  for (const [data, allergies, expected] of cases) {
    const alert = allergyAlert(allergies, data);
    assert.equal(alert.state, expected);
    const pending = f.api.refresh();
    assert.equal(f.api.allergyState().state, 'unknown', 'loading is never an explicit negative');
    f.reply(f.requests.length - 1, { allergies, problems: [], options: { allergyTypes: ['drug', 'food'], allergySeverities: [] }, allergyAlert: alert });
    await pending;
    assert.deepEqual(JSON.parse(JSON.stringify(f.api.allergyState())), JSON.parse(JSON.stringify(alert)));
  }
});

test('new controls never join the saved record or shift the position keys', () => {
  const editors = read('public/clinical-summary.js');
  for (const source of [editors]) {
    const controls = source.match(/<(input|select|textarea)\b[^>]*>/g) || [];
    assert.ok(controls.length > 0);
    for (const control of controls) assert.match(control, /data-emr-transient/, control);
    assert.doesNotMatch(source, /contenteditable/);
  }
  const record = read('public/emr-patient-record.js');
  const prepare = record.slice(record.indexOf('  function prepareStorageKeys()'), record.indexOf('  function ensureFirstExamDateTime()'));
  const control = (scope, transient = false) => ({ id: '', dataset: {}, scope,
    matches: () => false, closest: () => null, hasAttribute: name => transient && name === 'data-emr-transient' });
  const a = control('medical'), b = control('medical'), c = control('nursing');
  let controls = [a, b, c];
  const context = vm.createContext({ window: {}, storagePrepared: false,
    document: { querySelectorAll: () => controls }, storageScope: input => input.scope });
  vm.runInContext(prepare, context); context.prepareStorageKeys();
  const original = [a, b, c].map(input => ({ ...input.dataset }));
  const auxiliary = [control('medical', true), control('medical', true), control('nursing', true)];
  controls = [auxiliary[0], a, auxiliary[1], b, c, auxiliary[2]];
  context.prepareStorageKeys();
  assert.deepEqual([a, b, c].map(input => ({ ...input.dataset })), original);
  for (const input of auxiliary) assert.equal(input.dataset.emrStorageKey, undefined);
  assert.deepEqual(controls.filter(input => input.dataset.emrStorageKey).map(input => input.dataset.emrStorageKey),
    ['scope:medical:auto:0', 'scope:medical:auto:1', 'scope:nursing:auto:0']);
});

test('editors fill the Phase 1 slots; forms only for doctors while the record can be edited', async () => {
  const html = read('protected/EMR.html');
  assert.equal((html.match(/data-soap-slot="structured-allergy"/g) || []).length, 1);
  assert.equal((html.match(/data-soap-slot="problem-list"/g) || []).length, 2);
  const ipd = html.slice(html.indexOf('<div id="sub_ipd"'), html.indexOf('<div id="sub_nursing"'));
  assert.ok(ipd.indexOf('data-soap-slot="structured-allergy"') > ipd.indexOf('section-s emr-soap-record-box'));
  assert.ok(ipd.indexOf('data-soap-slot="structured-allergy"') < ipd.indexOf('section-o emr-soap-record-box'));
  const editors = read('public/clinical-summary.js');
  assert.match(editors, /const canEdit = \(slot\) => Boolean\(api\(\)\?\.canWrite\(\)\) && !window\.EmrEncounterEditor\?\.isReadOnly\?\.\(slot\);/);
  const f = summaryFixture();
  let locked = false;
  f.window.EmrEncounterEditor = { isReadOnly: () => locked };
  for (const [role, readOnly] of [['DOCTOR', false], ['DOCTOR', true], ['NURSE', false], ['MIDWIFE', false], ['ADMIN', false]]) {
    f.window.emrSession.user.activeRole = role; locked = readOnly;
    const pending = f.api.refresh();
    f.reply(f.requests.length - 1, { allergies: [], problems: [], allergyAlert: allergyAlert([], {}), options: { allergyTypes: ['drug'], allergySeverities: [] } });
    await pending;
    assert.equal(f.slots['structured-allergy'].innerHTML.includes('data-allergy-add-form'), role === 'DOCTOR' && !readOnly);
    assert.equal(f.slots['problem-list'].innerHTML.includes('data-problem-add-form'), role === 'DOCTOR' && !readOnly);
  }
  // Removing an allergy asks for a reason (the server keeps the row).
  assert.match(editors, /data-allergy-remove-reason/);
});

test('clinical-summary assets load on the medical record page only', async () => {
  const port = 34411;
  const origin = `http://127.0.0.1:${port}`;
  const app = createEmrServer({ demoMode: true, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
    const login = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'doctor_medicine' }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const page = async (url) => (await fetch(origin + url, { headers: { Cookie: cookie } })).text();
    const emr = await page('/emr');
    assert.match(emr, /\/public\/clinical-summary\.js\?v=4100/);
    assert.match(emr, /\/public\/clinical-summary\.css\?v=4100/);
    assert.match(emr, /\/public\/patient-banner\.js\?v=4170/);
    assert.doesNotMatch(await page('/departments'), /clinical-summary\.js/);
    for (const asset of ['clinical-summary.js', 'clinical-summary.css']) {
      const response = await fetch(`${origin}/public/${asset}`, { headers: { Cookie: cookie } });
      assert.equal(response.status, 200, asset);
    }
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
  }
});

test('bed popup shows a red allergy box only for an allergy, a note when not recorded', () => {
  const source = read('public/departments.js');
  const start = source.indexOf('  function bedAllergyHtml(patient) {');
  const end = source.indexOf('  function openBedModal(bedId) {');
  const context = vm.createContext({ language: 'kh', window: {}, escapeHtml: (v) => String(v ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`) });
  vm.runInContext(source.slice(start, end), context);
  assert.equal(context.bedAllergyHtml({ allergyAlert: { state: 'none', items: [] } }), '');
  assert.equal(context.bedAllergyHtml({}), '');
  assert.match(context.bedAllergyHtml({ allergyAlert: { state: 'not-recorded', items: [] } }), /class="bed-allergy-unknown"/);
  const html = context.bedAllergyHtml({ allergyAlert: { state: 'allergy', items: [{ substance: '<Penicillin>' }], freeText: 'Sulfa' } });
  assert.match(html, /class="bed-allergy-alert" role="alert"/);
  assert.match(html, /&#60;Penicillin&#62;/);
  assert.match(html, /<p>Sulfa<\/p>/);
  assert.match(read('public/departments.css'), /\.bed-allergy-alert \{/);
});

test('nursing identity fields: empty fields are filled, a saved typed value that differs is kept', () => {
  const source = read('public/emr-inpatient-workflow.js');
  const start = source.indexOf('  function setAutofillTarget(target, nextValue) {');
  const end = source.indexOf('  function rowTargets(row) {');
  const notes = [];
  const field = (value) => ({
    value, dataset: {}, classList: { set: new Set(), add(c) { this.set.add(c); }, remove(c) { this.set.delete(c); }, contains(c) { return this.set.has(c); } },
    nextElementSibling: null,
    insertAdjacentElement(position, element) { notes.push(element); this.nextElementSibling = element; },
  });
  const document = { createElement: () => ({ className: '', dataset: {}, innerHTML: '', text: '', append(t) { this.text += t; }, hasAttribute(name) { return name === 'data-banner-differs'; }, remove() {} }) };
  const context = vm.createContext({ window: {}, document });
  vm.runInContext(source.slice(start, end), context);

  const empty = field('');
  context.setAutofillTarget(empty, 'Synthetic Patient');
  assert.equal(empty.value, 'Synthetic Patient');

  const typed = field('Typed name');
  context.setAutofillTarget(typed, 'Synthetic Patient');
  assert.equal(typed.value, 'Typed name');
  assert.ok(typed.classList.contains('nursing-banner-differs'));
  assert.match(notes.at(-1).text, /Synthetic Patient/);

  // A value filled here earlier follows the patient; an empty patient value never clears a typed one.
  context.setAutofillTarget(empty, 'Renamed Patient');
  assert.equal(empty.value, 'Renamed Patient');
  const typedAge = field('41');
  context.setAutofillTarget(typedAge, '');
  assert.equal(typedAge.value, '41');
});

test('letterheads are hidden on screen only; print and the print frame keep them', () => {
  const css = read('public/clinical-summary.css');
  assert.match(css, /@media screen \{\s*body:not\(\.emr-report-print\) \.emr-print-letterhead,/);
  const html = read('protected/EMR.html');
  const page2 = html.slice(html.indexOf('<div id="page2" class="page">'), html.indexOf('data-key="page2_title"'));
  assert.match(page2, /class="emr-print-letterhead-space"/);
  assert.match(page2, /data-key="kingdom" class="moul-font emr-print-letterhead"/);
  assert.match(page2, /<img src="\/emr-assets\/Tacteing-6\.png"/);
  const agreement = html.slice(html.indexOf('<div id="sub_agreement"'), html.indexOf('<div id="sub_agreement"') + 400);
  assert.match(agreement, /<div class="emr-print-letterhead"/);
});
