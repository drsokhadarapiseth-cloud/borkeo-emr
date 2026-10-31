// v40.8 - OPD record in SOAP order, frozen storage keys, OPD main / secondary
// ICD-10, and the cashier pre-payment lock left unchanged.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { pmrs2Preview } from '../server/pmrs/mapping.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('protected/EMR.html');
const opd = html.slice(html.indexOf('<div id="sub_opd" class="sub-tab'), html.indexOf('<div id="sub_ipd" class="sub-tab">'));
const record = opd.slice(opd.indexOf('id="opd_soap_record"'), opd.indexOf('<div class="action-bar no-print">'));
const footer = record.slice(record.indexOf('<!-- OPD Footer -->'));
const boxText = (letter) => {
  const start = record.indexOf(`data-soap-record-box="${letter}"`);
  const next = record.indexOf('data-soap-record-box="', start + 30);
  return record.slice(start, next < 0 ? record.indexOf('<!-- OPD Footer -->') : next);
};

test('OPD record has the four SOAP boxes in order; title above, signature below', () => {
  assert.deepEqual([...record.matchAll(/data-soap-record-box="([soap])"/g)].map((m) => m[1]), ['s', 'o', 'a', 'p']);
  for (const [letter, title] of [['s', 'Subjective'], ['o', 'Objective'], ['a', 'Assessment'], ['p', 'Plan']]) {
    assert.match(boxText(letter), new RegExp(`class="emr-soap-title" id="opd_soap_${letter}_title" data-language-exclude>${title}<`));
  }
  assert.ok(opd.indexOf('data-key="opd_title"') < opd.indexOf('id="opd_soap_record"'));
  assert.match(footer, /id="opd-doctor-esign"/);
  assert.doesNotMatch(footer, /id="web_opd_followup"/, 'return date moved into P');
});

test('OPD sections sit in the agreed boxes', () => {
  const placement = {
    s: ['opd_sec_history', 'hist_cough', 'hist_tb_contact'],
    o: ['opd_sec_pe', 'vitals_header', 'opd_sec_inv'],
    a: ['opd_sec_diag'],
    p: ['opd_sec_treat', 'rx_counsel', 'opd_followup', 'opd_plan_notes'],
  };
  for (const [letter, keys] of Object.entries(placement)) {
    for (const key of keys) assert.match(boxText(letter), new RegExp(`data-key="${key}"`), `${key} in ${letter.toUpperCase()}`);
  }
  assert.match(boxText('o'), /id="inv_list"/);
  assert.match(boxText('a'), /data-diagnosis-editor="opd"/);
  assert.match(boxText('p'), /id="opd_rx_container"/);
  assert.match(boxText('p'), /id="web_rx_counsel_note"/);
  assert.match(boxText('p'), /id="web_opd_transfer_ward"/);
  assert.match(boxText('p'), /<textarea id="opd_plan_notes" data-emr-no-auto-index/);
  assert.match(boxText('o'), /data-soap-slot="early-warning-score" hidden/);
  assert.match(boxText('a'), /data-soap-slot="problem-list" hidden/);
  assert.match(boxText('p'), /data-soap-slot="prescribing-warnings" hidden/);
});

test('every saved OPD form field keeps exactly the storage keys it had before the move', () => {
  const fixture = JSON.parse(read('tests/fixtures/opd-storage-keys.json')).fields;
  const masked = record.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
  const computed = [];
  for (const m of masked.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const text = m[0];
    const tag = m[1].toLowerCase();
    const type = tag === 'input' ? ((/\btype="([^"]*)"/.exec(text) || [])[1] || 'text') : tag;
    if (['button', 'submit', 'reset', 'file', 'password'].includes(type) || /data-emr-transient/.test(text)) continue;
    const id = (/\bid="([^"]*)"/.exec(text) || [])[1] || '';
    const keyIndex = (/data-emr-key-index="(\d+)"/.exec(text) || [])[1];
    const legacyIndex = (/data-emr-legacy-index="(\d+)"/.exec(text) || [])[1];
    const migrated = /data-emr-migrate-auto-key/.test(text);
    if (!id || migrated) assert.ok(keyIndex && legacyIndex, `position-keyed field must be frozen: ${text.slice(0, 90)}`);
    if (id === 'opd_plan_notes') continue;
    computed.push([id ? `scope:medical:id:${id}` : `scope:medical:auto:${keyIndex}`, id ? `id:${id}` : `auto:${legacyIndex}`,
      migrated ? `scope:medical:auto:${keyIndex}` : '', migrated ? `auto:${legacyIndex}` : ''].join('|'));
  }
  const expected = fixture.map((row) => [row.key, row.legacy, row.previous || '', row.previousLegacy || ''].join('|'));
  assert.deepEqual(computed.sort(), expected.sort());
  assert.equal(computed.length, 28);
});

test('the shift counter selector never takes part in record field numbering', () => {
  assert.match(read('public/emr-session.js'), /select\.setAttribute\('data-emr-transient', ''\);/);
});

function loadDiagnoses(fields) {
  const elements = {};
  for (const [id, value] of Object.entries(fields)) elements[id] = { value, dispatchEvent() {} };
  const listeners = {};
  const document = { getElementById: (id) => elements[id] || null, querySelectorAll: () => [], addEventListener: (type, fn) => { listeners[type] = fn; } };
  const window = { addEventListener() {}, getBorkeoLanguage: () => 'km' };
  vm.runInNewContext(read('public/emr-diagnoses.js'), { window, document, Event: class { constructor(type) { this.type = type; } }, fetch: async () => ({ ok: false }) });
  return { window, elements, loaded: () => listeners['emr:patient-loaded']() };
}

test('OPD main / secondary ICD-10: old records keep their first code; Set as main changes the PMRS2 code', () => {
  const opdList = JSON.stringify([{ icd10: 'A09', text: 'a' }, { icd10: 'J18.9', text: 'b' }]);
  const { window, elements, loaded } = loadDiagnoses({
    diag_input: 'A09', emr_pmrs_opd_diagnosis: 'x', emr_opd_diagnoses: opdList,
    emr_pmrs_ipd_icd10: '', emr_pmrs_ipd_diagnosis: '', emr_ipd_diagnoses: '[]',
  });
  loaded();
  assert.equal(elements.diag_input.value, 'A09');
  assert.deepEqual(JSON.parse(elements.emr_opd_diagnoses.value).map((row) => [row.icd10, row.main]), [['A09', true], ['J18.9', false]]);
  window.setEmrMainDiagnosis('opd', 'J18.9');
  assert.equal(elements.diag_input.value, 'J18.9');
  const list = JSON.parse(elements.emr_opd_diagnoses.value);
  assert.equal(list.filter((row) => row.main).length, 1);
  assert.equal(list[0].icd10, 'J18.9');
  const data = { 'scope:medical:id:diag_input': elements.diag_input.value, 'scope:medical:id:emr_pmrs_opd_diagnosis': 'x' };
  assert.equal(pmrs2Preview({ serviceMode: 'opd', data }).diagnosisIcd10, 'J18.9');
  // OPD and IPD lists stay separate.
  assert.equal(elements.emr_ipd_diagnoses.value, '[]');
});

test('OPD cashier pre-payment lock is unchanged', () => {
  const route = read('server/routes/patients.mjs');
  assert.match(route, /isOpdClinicalSave && \(!\['DOCTOR_READY', 'IN_CONSULTATION'\]\.includes\(workflowStage\) \|\| !opdConsultationPaymentConfirmed\(database, existingPatient\)\)/);
  assert.match(route, /The OPD consultation fee must be confirmed by Cashier before the patient can meet the doctor\./);
});
