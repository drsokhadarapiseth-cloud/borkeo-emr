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

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

test('the banner reads the record drug-allergy fields that exist, not the old missing keys', () => {
  const banner = read('public/patient-banner.js');
  assert.doesNotMatch(banner, /emr_pmrs_(ipd|opd)_allergy/);
  assert.match(banner, /const RECORD_DRUG_ALLERGY_CHECK = 'scope:medical:auto:82';/);
  assert.match(banner, /const RECORD_DRUG_ALLERGY_TEXT = 'scope:medical:auto:83';/);
  // The server summary uses the same two keys.
  const server = read('server/clinical-summary.mjs');
  assert.match(server, /RECORD_DRUG_ALLERGY_CHECK = 'scope:medical:auto:82'/);
  assert.match(server, /RECORD_DRUG_ALLERGY_TEXT = 'scope:medical:auto:83'/);
  // Three states: an unrecorded allergy is no longer shown as "no allergy".
  assert.match(banner, /'banner\.allergy\.notRecorded', 'Allergy not recorded'/);
  assert.match(banner, /info\.allergyState === 'none'/);
});

test('banner allergy state: free text, tick, "none" words and the structured record', () => {
  const source = read('public/patient-banner.js');
  const start = source.indexOf('  const RECORD_DRUG_ALLERGY_CHECK');
  const end = source.indexOf('  // Same sources as the summary card');
  const context = vm.createContext({ summaryState: { patientKey: '', summary: null } });
  vm.runInContext(source.slice(start, end).replace(/^  const /gm, '  var '), context);
  const state = (data, extra = {}) => context.allergyState({ patientKey: 'case:1', data, ...extra }).state;
  assert.equal(state({}), 'not-recorded');
  assert.equal(state({ 'scope:medical:auto:83': 'none' }), 'none');
  assert.equal(state({ 'scope:medical:auto:83': 'NKDA' }), 'none');
  assert.equal(state({ 'scope:medical:auto:83': 'Sulfa - rash' }), 'allergy');
  assert.equal(state({ 'scope:medical:auto:82': true }), 'allergy');
  assert.equal(state({}, { allergyAlert: { items: [{ substance: 'Egg' }] } }), 'allergy');
  context.summaryState.patientKey = 'case:1';
  context.summaryState.summary = { allergies: [{ substance: 'Penicillin' }] };
  assert.deepEqual(JSON.parse(JSON.stringify(context.allergyState({ patientKey: 'case:1', data: {} }))), { state: 'allergy', items: [{ substance: 'Penicillin' }], freeText: '', ticked: false });
});

test('new controls never join the saved record or shift the position keys', () => {
  const editors = read('public/clinical-summary.js');
  const banner = read('public/patient-banner.js');
  for (const source of [editors, banner]) {
    const controls = source.match(/<(input|select|textarea)\b[^>]*>/g) || [];
    assert.ok(controls.length > 0);
    for (const control of controls) assert.match(control, /data-emr-transient/, control);
    assert.doesNotMatch(source, /contenteditable/);
  }
  // prepareStorageKeys skips data-emr-transient controls entirely.
  assert.match(read('public/emr-patient-record.js'), /if \(control\.hasAttribute\('data-emr-transient'\)\) \{ addedControls \+= 1; return; \}/);
});

test('editors fill the Phase 1 slots; forms only for doctors while the record can be edited', () => {
  const html = read('protected/EMR.html');
  assert.equal((html.match(/data-soap-slot="structured-allergy"/g) || []).length, 1);
  assert.equal((html.match(/data-soap-slot="problem-list"/g) || []).length, 2);
  const ipd = html.slice(html.indexOf('<div id="sub_ipd"'), html.indexOf('<div id="sub_nursing"'));
  assert.ok(ipd.indexOf('data-soap-slot="structured-allergy"') > ipd.indexOf('section-s emr-soap-record-box'));
  assert.ok(ipd.indexOf('data-soap-slot="structured-allergy"') < ipd.indexOf('section-o emr-soap-record-box'));
  const editors = read('public/clinical-summary.js');
  assert.match(editors, /const canEdit = \(slot\) => Boolean\(api\(\)\?\.canWrite\(\)\) && !window\.EmrEncounterEditor\?\.isReadOnly\?\.\(slot\);/);
  assert.match(read('public/patient-banner.js'), /const canWriteSummary = \(\) => currentRole\(\) === 'DOCTOR';/);
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
