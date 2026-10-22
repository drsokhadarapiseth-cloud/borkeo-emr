// v40.9 - Daily follow-up note in SOAP order: old notes kept exactly as saved,
// vitals in O, treatment in P, main / secondary ICD-10, doctor-only editing.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('protected/EMR.html');
const modal = html.slice(html.indexOf('<div id="mon_modal" class="modal-overlay">'), html.indexOf('<div class="modal-actions"', html.indexOf('<div id="mon_modal"')));
const box = (letter) => {
  const start = modal.indexOf(`<div class="emr-soap-box section-${letter}">`);
  const next = ['s', 'o', 'a', 'p'].map((l) => modal.indexOf(`<div class="emr-soap-box section-${l}">`)).filter((i) => i > start).sort((a, b) => a - b)[0];
  return modal.slice(start, next || modal.length);
};

test('saved daily notes are rebuilt from the saved note itself when a record opens', () => {
  assert.match(html, /function saveDailyMonitoring\(restoreRecord\) \{/);
  assert.match(html, /var restoring = Boolean\(restoreRecord && typeof restoreRecord === 'object' && !\(restoreRecord instanceof Event\)\);/);
  // No required-field check and no ICD-10 validity stop while restoring.
  assert.match(html, /if \(restoring\) \{\s*var savedSoap = restoreRecord\.soap;[\s\S]*?evol = restoreRecord\.evol \|\| '';\s*conclusion = restoreRecord\.conclusion \|\| '';\s*\} else if \(soap/);
  assert.match(html, /if \(!restoring && icd10Field && !icd10Field\.checkValidity\(\)\)/);
  // The card keeps an exact copy of the saved note.
  assert.match(html, /card\._monitoringCopyData = restoring \? JSON\.parse\(JSON\.stringify\(restoreRecord\)\) : \{/);
  const workflow = read('public/emr-inpatient-workflow.js');
  assert.match(workflow, /originalSaveDailyMonitoring\(record\);/);
  assert.match(workflow, /saveAndPersistDailyMonitoring\(restoreRecord\) \{\s*const result = originalSaveDailyMonitoring\(restoreRecord\);/);
});

test('old notes without SOAP still render as the labelled old-note card with their own text', () => {
  const context = vm.createContext({ document: { querySelector: () => null, querySelectorAll: () => [], getElementById: () => null, addEventListener() {} }, addEventListener() {}, setTimeout() {}, currentLang: 'khmer' });
  context.window = context;
  vm.runInContext(read('public/soap-note.js'), context);
  const card = context.EmrSoapNote.renderCardGrid({ soap: null, evol: 'OLD evolution <b>', conclusion: 'OLD conclusion', icd10: 'A09' });
  assert.match(card, /emr-legacy-note-badge/);
  assert.ok(card.includes('OLD evolution &lt;b&gt;'));
  assert.ok(card.includes('OLD conclusion'));
  const soapCard = context.EmrSoapNote.renderCardGrid({ soap: { s: 's', o: 'o', a: 'a', p: 'p' }, icd10: 'J18.9' });
  assert.match(soapCard, / · ICD-10: J18\.9/);
});

test('daily popup: vital signs in O, treatment in P, labelled text boxes, full-width boxes', () => {
  assert.match(box('o'), /class="monitoring-vitals-grid"[\s\S]*id="mon_input_temp"[\s\S]*id="mon_input_spo2"/);
  assert.match(box('o'), /<label for="mon_soap_o" class="mon-soap-field-label">/);
  assert.match(box('a'), /data-diagnosis-editor="followup"[\s\S]*<label for="mon_soap_a" class="mon-soap-field-label">[\s\S]*id="mon_soap_a"/);
  assert.match(box('p'), /id="mon_rx_tbody"[\s\S]*id="mon_rx_protocol_tbody"[\s\S]*<label for="mon_soap_p" class="mon-soap-field-label">[\s\S]*id="mon_soap_p"/);
  assert.match(modal, /<div id="mon_soap_container" class="emr-soap-container single-column">/);
  // The vitals and treatment are no longer outside the boxes.
  const outside = modal.slice(0, modal.indexOf('<div id="mon_soap_container"')) + modal.slice(modal.indexOf('<!-- Legacy fallback fields'));
  assert.doesNotMatch(outside, /id="mon_input_temp"|id="mon_rx_tbody"/);
  // S and A stay required; the old hidden fields stay for printing and PMRS2.
  assert.match(box('s'), /Subjective <span style="color:red;">\*<\/span>/);
  assert.match(box('a'), /Assessment <span style="color:red;">\*<\/span>/);
  assert.match(modal, /<textarea id="mon_input_evol"/);
  assert.match(modal, /<textarea id="mon_input_conclusion"/);
});

test('daily notes store main / secondary ICD-10 with the main code first', () => {
  const elements = { mon_input_icd10: { value: '', dispatchEvent() {} }, mon_input_conclusion: { value: '', dispatchEvent() {} } };
  const document = { getElementById: (id) => elements[id] || null, querySelectorAll: () => [], addEventListener() {} };
  const window = { addEventListener() {}, getBorkeoLanguage: () => 'km' };
  vm.runInNewContext(read('public/emr-diagnoses.js'), { window, document, Event: class { constructor(type) { this.type = type; } }, fetch: async () => ({ ok: false }) });
  window.restoreEmrDiagnoses('followup', [{ icd10: 'A09', text: 'a' }, { icd10: 'J18.9', text: 'b' }]);
  window.setEmrMainDiagnosis('followup', 'J18.9');
  assert.equal(elements.mon_input_icd10.value, 'J18.9');
  const collected = JSON.parse(JSON.stringify(window.collectEmrDiagnoses('followup')));
  assert.deepEqual(collected.map((row) => [row.icd10, row.main]), [['J18.9', true], ['A09', false]]);
  assert.match(html, /class="mon-secondary-heading">/);
});

test('only doctors write the daily note: the check is repeated until the signed-in role is known', () => {
  const soap = read('public/soap-note.js');
  assert.match(soap, /function enforceDoctorOnly\(\)/);
  assert.match(soap, /txt\.disabled = true; txt\.readOnly = true;/);
  assert.match(soap, /\[500, 1500, 3000, 6000\]\.forEach\(function \(delay\) \{ global\.setTimeout\(enforceDoctorOnly, delay\); \}\);/);
  assert.match(soap, /document\.addEventListener\('emr:patient-loaded', enforceDoctorOnly\);/);
});

test('new labels have English values for EN mode', () => {
  const dictionary = read('public/emr-language-data.js');
  for (const english of ['Examination findings', 'Plan notes', 'Conclusion']) assert.match(dictionary, new RegExp(`,"${english}"\\]\\);`));
});
