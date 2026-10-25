import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('recorded DNR and severe allergy risks remain visible in the read-only clinical section, never a banner', () => {
  const source = fs.readFileSync('public/clinical-summary.js', 'utf8');
  const start = source.indexOf('  function recordedStatusHtml(summary)');
  const end = source.indexOf('  function current()', start);
  assert.ok(start >= 0 && end > start, 'the current clinical status renderer must exist');
  const context = vm.createContext({ label: (_key, en) => en, unavailableMessage: () => 'Unavailable',
    optionLabel: (_group, code) => code, escapeHtml: value => String(value).replaceAll('<', '&lt;').replaceAll('>', '&gt;') });
  vm.runInContext(source.slice(start, end), context);
  const html = context.recordedStatusHtml({ resuscitation: { status: 'dnr' }, allergies: [
    { substance: '<Synthetic Penicillin>', severity: 'severe' },
    { substance: 'Synthetic Sulfa', severity: 'life-threatening' }, { substance: 'Mild allergy', severity: 'mild' },
  ] });
  assert.match(html, /data-clinical-resuscitation class="clinical-recorded-warning" role="alert">DNR/);
  assert.match(html, /data-clinical-recorded-risks/);
  assert.match(html, /&lt;Synthetic Penicillin&gt; \(severe\)/);
  assert.match(html, /Synthetic Sulfa \(life-threatening\)/);
  assert.doesNotMatch(html, /Mild allergy|emr-patient-banner|<input|<select|<button/);
  const unknown = context.recordedStatusHtml({ resuscitation: null, allergies: [] });
  assert.match(unknown, />Not recorded<\/p>/);
  assert.doesNotMatch(unknown, /DNR|Full resuscitation|data-clinical-recorded-risks/);
  assert.match(context.recordedStatusHtml(null), />Unavailable<\/p>/);
  const full = context.recordedStatusHtml({ resuscitation: { status: 'full' }, allergies: [] });
  assert.match(full, />Full resuscitation<\/p>/);
  assert.doesNotMatch(full, /DNR|role="alert"/);
});

test('IPD early warning remains independently rendered with its configured exclusions and missing-data states', async () => {
  const table = JSON.parse(fs.readFileSync('server/clinical-options.json', 'utf8')).earlyWarning;
  const out = { innerHTML: '' }, slot = { hidden: true, querySelector: () => out };
  const patient = { age: '40', data: {} };
  const fields = Object.fromEntries(Object.entries({ ipd_resp: '40', ipd_spo2: '80', ipd_bp_sys: '70', ipd_pulse: '140', ipd_temp: '39', ipd_ews_acvpu: 'A' }).map(([id, value]) => [id, { value }]));
  fields.ipd_ews_oxygen = { checked: false };
  const document = new EventTarget();
  Object.assign(document, { querySelector: () => slot, querySelectorAll: () => [], getElementById: id => fields[id] });
  const window = new EventTarget();
  Object.assign(window, { getLoadedEmrPatient: () => patient });
  vm.runInNewContext(fs.readFileSync('public/early-warning.js', 'utf8'), {
    window, document, CustomEvent, fetch: async () => ({ ok: true, json: async () => ({ earlyWarning: table }) }),
    setTimeout: callback => { callback(); return 1; }, clearTimeout() {},
  });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(slot.hidden, false);
  assert.match(out.innerHTML, /ews-score ews-high/);
  assert.equal(window.EmrEarlyWarning.forPatient(patient).level, 'high');
  window.EmrDisplayRules = { ageYears: () => 10 };
  window.EmrEarlyWarning.refresh();
  assert.match(out.innerHTML, /NEWS2 is not used/);
  assert.doesNotMatch(out.innerHTML, /ews-score/);
  window.EmrDisplayRules = { ageYears: () => 40, pregnant: () => true };
  window.EmrEarlyWarning.refresh();
  assert.doesNotMatch(out.innerHTML, /ews-score/);
  window.EmrDisplayRules = { ageYears: () => 40, pregnant: () => false };
  for (const field of Object.values(fields)) field.value = '';
  window.EmrEarlyWarning.refresh();
  assert.match(out.innerHTML, /No vital signs recorded yet/);
  assert.doesNotMatch(out.innerHTML, /ews-score/);
});
