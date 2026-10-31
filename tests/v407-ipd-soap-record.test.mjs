// v40.7 - IPD admission record in SOAP order, frozen storage keys, and main /
// secondary ICD-10 diagnoses.
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
const ipd = html.slice(html.indexOf('<div id="sub_ipd" class="sub-tab">'), html.indexOf('<!-- ================= SUB-TAB: ANC'));
const record = ipd.slice(ipd.indexOf('id="ipd_soap_record"'), ipd.indexOf('<div class="action-bar no-print">'));
const masked = (text) => text.replace(/<!--[\s\S]*?-->/g, (m) => ' '.repeat(m.length));
const boxText = (letter) => {
  const start = record.indexOf(`data-soap-record-box="${letter}"`);
  const next = record.indexOf('data-soap-record-box="', start + 30);
  return record.slice(start, next < 0 ? record.indexOf('<!-- Footer / Signatures -->') : next);
};

test('IPD record has the four SOAP boxes in order with letter badges and fixed English titles', () => {
  const order = [...record.matchAll(/data-soap-record-box="([soap])"/g)].map((m) => m[1]);
  assert.deepEqual(order, ['s', 'o', 'a', 'p']);
  for (const [letter, title] of [['s', 'Subjective'], ['o', 'Objective'], ['a', 'Assessment'], ['p', 'Plan']]) {
    const box = boxText(letter);
    assert.match(box, new RegExp(`class="emr-soap-badge" data-language-exclude aria-hidden="true">${letter.toUpperCase()}<`));
    assert.match(box, new RegExp(`class="emr-soap-title" id="ipd_soap_${letter}_title" data-language-exclude>${title}<`));
    assert.match(box, /data-soap-collapse aria-expanded="true"/);
    assert.match(box, /data-soap-status/);
  }
  // Header stays above the boxes; first examination time and signature stay below.
  assert.ok(ipd.indexOf('data-key="ipd_title"') < ipd.indexOf('id="ipd_soap_record"'));
  assert.ok(ipd.indexOf('id="ipd_first_exam_date"') > ipd.indexOf('data-key="ipd_plan_notes"'));
  assert.ok(ipd.indexOf('id="ipd-doctor-esign"') > ipd.indexOf('data-key="ipd_plan_notes"'));
});

test('existing IPD sections sit in the agreed SOAP boxes, with the Phase slots left empty', () => {
  const placement = {
    s: ['ipd_sec2', 'ipd_sec3', 'ipd_sec4', 'ipd_sec5', 'ipd_sec6', 'ipd_vaccine', 'ipd_allergy', 'ipd_obgyn_title', 'ipd_v2', 'ipd_v3'],
    o: ['ipd_sec1', 'ipd_sec7', 'ipd_normal_language', 'ipd_heent', 'ipd_inv'],
    a: ['ipd_prob_diag', 'ipd_diff_diag', 'ipd_diag', 'ipd_prog'],
    p: ['ipd_treat_med', 'ipd_treat_other', 'ipd_diet', 'ipd_monitor', 'ipd_plan_notes'],
  };
  for (const [letter, keys] of Object.entries(placement)) {
    const box = boxText(letter);
    for (const key of keys) assert.match(box, new RegExp(`data-key="${key}"`), `${key} must be in ${letter.toUpperCase()}`);
  }
  assert.match(boxText('p'), /id="ipd_rx_container"/);
  assert.match(boxText('a'), /data-diagnosis-editor="ipd"/);
  // Phase 4 slots are filled by script; the Phase 6 slot is still empty.
  for (const [letter, slot] of [['s', 'structured-allergy'], ['a', 'problem-list'], ['p', 'prescribing-warnings']]) {
    assert.match(boxText(letter), new RegExp(`data-soap-slot="${slot}" hidden></div>`));
  }
  // v41.1 (Phase 5): the paediatric and tetanus slots hold their sections, in S.
  assert.match(boxText('s'), /data-soap-slot="paediatric" data-display-rule="paediatric" hidden>/);
  assert.match(boxText('s'), /data-soap-slot="tetanus-status" data-display-rule="tetanus-status" hidden>/);
  // v41.6 (Phase 9): the Early Warning Score panel is in O.
  assert.match(boxText('o'), /<div class="emr-soap-slot ews-panel" data-soap-slot="early-warning-score">/);
  assert.match(boxText('p'), /<textarea id="ipd_plan_notes" data-emr-no-auto-index/);
});

test('every saved IPD field keeps exactly the storage keys it had before the move', () => {
  const fixture = JSON.parse(read('tests/fixtures/ipd-storage-keys.json')).fields;
  const computed = [];
  const V411_FIELDS = ['ipd_tb_contact', 'ipd_paed_birth_history', 'ipd_paed_feeding', 'ipd_paed_head_circumference', 'ipd_paed_growth_notes', 'ipd_paed_milestones', 'ipd_tetanus_status', 'ipd_tetanus_last_dose',
    // v41.6: Early Warning Score inputs
    'ipd_ews_oxygen', 'ipd_ews_acvpu'];
  const newFields = [];
  for (const m of masked(record).matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = m[1].toLowerCase();
    const text = m[0];
    const type = tag === 'input' ? ((/\btype="([^"]*)"/.exec(text) || [])[1] || 'text') : tag === 'select' ? 'select-one' : 'textarea';
    if (['button', 'submit', 'reset', 'file', 'password'].includes(type) || /data-emr-transient/.test(text)) continue;
    const id = (/\bid="([^"]*)"/.exec(text) || [])[1] || '';
    const keyIndex = (/data-emr-key-index="(\d+)"/.exec(text) || [])[1];
    const legacyIndex = (/data-emr-legacy-index="(\d+)"/.exec(text) || [])[1];
    const noAuto = /data-emr-no-auto-index/.test(text);
    if (!id) assert.ok(keyIndex && legacyIndex, `unnamed field must have frozen keys: ${text.slice(0, 90)}`);
    if (/data-emr-migrate-auto-key/.test(text)) assert.ok(keyIndex && legacyIndex, `migrated field must have frozen keys: ${id}`);
    if (id === 'ipd_plan_notes') { assert.ok(noAuto); continue; }
    // v41.1 new fields: named, outside the position numbering, listed below.
    if (V411_FIELDS.includes(id)) { assert.ok(noAuto, id); newFields.push(id); continue; }
    computed.push({
      key: id ? `scope:medical:id:${id}` : `scope:medical:auto:${keyIndex}`,
      legacy: id ? `id:${id}` : `auto:${legacyIndex}`,
      previous: /data-emr-migrate-auto-key/.test(text) ? `scope:medical:auto:${keyIndex}` : undefined,
      previousLegacy: /data-emr-migrate-auto-key/.test(text) ? `auto:${legacyIndex}` : undefined,
    });
  }
  // Rows created by scripts (medicine table) have no key in the fixture.
  const sig = (row) => [row.key, row.legacy, row.previous || '', row.previousLegacy || ''].join('|');
  assert.deepEqual(computed.map(sig).sort(), fixture.map(sig).sort());
  assert.equal(computed.length, 113);
  assert.deepEqual(newFields.sort(), [...V411_FIELDS].sort());
});

test('storage keys honour frozen positions and search boxes are never saved', () => {
  const recordJs = read('public/emr-patient-record.js');
  assert.match(recordJs, /if \(control\.hasAttribute\('data-emr-no-save'\)\) return;/);
  assert.match(recordJs, /const keyIndex = control\.dataset\.emrKeyIndex \?\? localIndex;/);
  assert.match(recordJs, /const legacyIndex = control\.dataset\.emrLegacyIndex \?\? \(index - addedControls\);/);
  // The counter still advances before the no-save return, so later positions do not shift.
  assert.ok(recordJs.indexOf('counters[scope] = localIndex + 1') < recordJs.indexOf("hasAttribute('data-emr-no-save')"));
  assert.match(read('public/emr-diagnoses.js'), /class="diag-search-input no-print" data-emr-no-save/);
});

function loadDiagnoses(fields) {
  const elements = {};
  for (const [id, value] of Object.entries(fields)) elements[id] = { value, dispatchEvent() {} };
  const listeners = {};
  const document = {
    getElementById: (id) => elements[id] || null,
    querySelectorAll: () => [],
    addEventListener: (type, fn) => { listeners[type] = fn; },
  };
  const window = { addEventListener() {}, getBorkeoLanguage: () => 'km' };
  vm.runInNewContext(read('public/emr-diagnoses.js'), { window, document, Event: class { constructor(type) { this.type = type; } }, fetch: async () => ({ ok: false }) });
  return { window, elements, loaded: () => listeners['emr:patient-loaded']() };
}

test('old IPD records keep their first ICD-10 code as the main diagnosis', () => {
  const { elements, loaded } = loadDiagnoses({
    emr_pmrs_ipd_icd10: 'A09', emr_pmrs_ipd_diagnosis: '', emr_ipd_diagnoses: JSON.stringify([{ icd10: 'A09', text: 'a' }, { icd10: 'J18.9', text: 'b' }]),
    diag_input: '', emr_pmrs_opd_diagnosis: '', emr_opd_diagnoses: '[]',
  });
  loaded();
  assert.equal(elements.emr_pmrs_ipd_icd10.value, 'A09');
  const list = JSON.parse(elements.emr_ipd_diagnoses.value);
  assert.deepEqual(list.map((row) => [row.icd10, row.main]), [['A09', true], ['J18.9', false]]);
  // An OPD record without codes keeps an empty list (OPD main/secondary: v40.8).
  assert.equal(elements.emr_opd_diagnoses.value, '[]');
});

test('Set as main moves the code first, changes the PMRS2 primary code, and there is always exactly one main', () => {
  const { window, elements, loaded } = loadDiagnoses({
    emr_pmrs_ipd_icd10: 'A09', emr_pmrs_ipd_diagnosis: 'x', emr_ipd_diagnoses: JSON.stringify([{ icd10: 'A09', text: 'a' }, { icd10: 'J18.9', text: 'b' }, { icd10: 'E11', text: 'c' }]),
    diag_input: '', emr_pmrs_opd_diagnosis: '', emr_opd_diagnoses: '[]',
  });
  loaded();
  window.setEmrMainDiagnosis('ipd', 'E11');
  assert.equal(elements.emr_pmrs_ipd_icd10.value, 'E11');
  const list = JSON.parse(elements.emr_ipd_diagnoses.value);
  assert.deepEqual(list.map((row) => row.icd10), ['E11', 'A09', 'J18.9']);
  assert.equal(list.filter((row) => row.main === true).length, 1);
  const data = { 'scope:medical:id:emr_pmrs_ipd_icd10': elements.emr_pmrs_ipd_icd10.value, 'scope:medical:id:emr_pmrs_ipd_diagnosis': 'x' };
  assert.equal(pmrs2Preview({ serviceMode: 'ipd', data }).diagnosisIcd10, 'E11');
});

test('a saved main flag wins when a record is opened', () => {
  const { elements, loaded } = loadDiagnoses({
    emr_pmrs_ipd_icd10: 'A09', emr_pmrs_ipd_diagnosis: '', emr_ipd_diagnoses: JSON.stringify([{ icd10: 'A09', text: 'a', main: false }, { icd10: 'J18.9', text: 'b', main: true }]),
    diag_input: '', emr_pmrs_opd_diagnosis: '', emr_opd_diagnoses: '[]',
  });
  loaded();
  assert.equal(elements.emr_pmrs_ipd_icd10.value, 'J18.9');
  assert.equal(JSON.parse(elements.emr_ipd_diagnoses.value).filter((row) => row.main).length, 1);
});

test('SOAP component: record boxes are separate from the daily follow-up boxes; print keeps two A4 pages', () => {
  const soap = read('public/soap-note.js');
  assert.match(soap, /function noteBox\(section\)[\s\S]*?:not\(\[data-soap-record-box\]\)/);
  assert.doesNotMatch(soap, /document\.querySelector\('\.emr-soap-box\.section-'/);
  assert.match(soap, /function refreshRecordBoxes\(\)/);
  const css = read('public/soap-note.css');
  assert.match(css, /\.emr-soap-record-box\.is-collapsed \.emr-soap-body,\s*\.emr-soap-record-box \.emr-soap-body \{\s*display: flex !important;/);
  assert.match(css, /html\[data-theme="dark"\] \{\s*--soap-s-bg/);
  const print = read('public/report-print.js');
  assert.match(print, /const soap = ipd\?\.querySelector\('#ipd_soap_record'\);/);
  assert.match(print, /soapPage\(\[clone\(box\('s'\)\), oPart\(0\)\]\)/);
  assert.match(print, /soapPage\(\[oPart\(1\), clone\(box\('a'\)\), clone\(box\('p'\)\)\]\)/);
});
