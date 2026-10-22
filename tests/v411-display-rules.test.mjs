// v41.1 - Display rules by age and sex, paediatric section, tetanus vaccine
// status, ob/gyn history rule (owner's rule of 2026-10-21) and the TB screening
// block shared by OPD and IPD.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { displayRules } from '../server/clinical-summary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const html = read('protected/EMR.html');
const ipd = html.slice(html.indexOf('<div id="sub_ipd" class="sub-tab">'), html.indexOf('<div id="sub_nursing"'));

test('display rule numbers are configurable and match the agreed rules', () => {
  assert.deepEqual(displayRules(), {
    immunizationMaxAge: 14, substanceUseMinAge: 10, paediatricMaxAge: 14, headCircumferenceMaxAge: 2,
    tetanusFemaleMinAge: 15, tetanusFemaleMaxAge: 49, tetanusWhenPregnant: true,
    obgynFemaleMinAge: 15, obgynYoungerWhenPregnant: true, obstetricWardCodes: ['obstetric', 'gyneco-obstetric'],
  });
  assert.match(read('server/routes/clinical-summary.mjs'), /router\.get\('\/api\/clinical-options'/);
});

// Runs public/display-rules.js against a stub page: age, sex, ward and EDD.
async function rulesFor({ age = null, sex = '', ward = '', edd = '' }) {
  const sexValue = { female: 'ស្រី', male: 'ប្រុស' }[sex] || '';
  const document = {
    readyState: 'complete',
    addEventListener() {},
    querySelector: (selector) => (selector.includes('sex_radio') && sexValue ? { value: sexValue } : null),
    querySelectorAll: () => [],
    getElementById: (id) => (id === 'ipd_obgyn_edd' ? { value: edd } : null),
  };
  const window = {
    addEventListener() {},
    getExactAge: () => ({ years: age }),
    getLoadedEmrPatient: () => ({ departmentCode: ward }),
    getEmrCarePath: () => null,
  };
  const fetch = async () => ({ ok: true, json: async () => ({ displayRules: displayRules() }) });
  vm.runInNewContext(read('public/display-rules.js'), { window, document, fetch });
  for (let i = 0; i < 5; i++) await new Promise((resolve) => setImmediate(resolve));
  assert.equal(window.EmrDisplayRules.rulesLoaded(), true);
  return window.EmrDisplayRules;
}

test('ob/gyn history: female 15+, younger only when pregnant or in the obstetric ward, never male', async () => {
  assert.equal((await rulesFor({ age: 15, sex: 'female' })).obgynVisible(), true);
  assert.equal((await rulesFor({ age: 60, sex: 'female' })).obgynVisible(), true);
  assert.equal((await rulesFor({ age: 13, sex: 'female', ward: 'medicine' })).obgynVisible(), false);
  assert.equal((await rulesFor({ age: 13, sex: 'female', ward: 'obstetric' })).obgynVisible(), true);
  assert.equal((await rulesFor({ age: 13, sex: 'female', ward: 'gyneco-obstetric' })).obgynVisible(), true);
  assert.equal((await rulesFor({ age: 13, sex: 'female', edd: '2027-01-10' })).obgynVisible(), true);
  assert.equal((await rulesFor({ age: 30, sex: 'male' })).obgynVisible(), false);
  // Unknown sex: no decision, the page keeps its own rule.
  assert.equal((await rulesFor({ age: 30 })).obgynVisible(), null);
});

test('age and sex rules for immunization, substance use, paediatric, head circumference, tetanus', async () => {
  const child = await rulesFor({ age: 1, sex: 'male' });
  assert.deepEqual(['immunization', 'substance-use', 'paediatric', 'head-circumference', 'tetanus-status'].map(child.ruleVisible), [true, false, true, true, false]);
  const fourteen = await rulesFor({ age: 14, sex: 'female' });
  assert.deepEqual(['immunization', 'substance-use', 'paediatric', 'head-circumference', 'tetanus-status'].map(fourteen.ruleVisible), [true, true, true, false, false]);
  const fifteen = await rulesFor({ age: 15, sex: 'female' });
  assert.deepEqual(['immunization', 'paediatric', 'tetanus-status'].map(fifteen.ruleVisible), [false, false, true]);
  assert.equal((await rulesFor({ age: 50, sex: 'female' })).ruleVisible('tetanus-status'), false);
  assert.equal((await rulesFor({ age: 13, sex: 'female', ward: 'obstetric' })).ruleVisible('tetanus-status'), true);
  assert.equal((await rulesFor({ age: 9, sex: 'female' })).ruleVisible('substance-use'), false);
  // Unknown age shows everything.
  const unknown = await rulesFor({ sex: 'male' });
  assert.deepEqual(['immunization', 'substance-use', 'paediatric', 'head-circumference'].map(unknown.ruleVisible), [true, true, true, true]);
});

test('hiding never clears a field; a block with saved values is always shown', () => {
  const source = read('public/display-rules.js');
  assert.match(source, /const show = ruleVisible\(block\.dataset\.displayRule\) \|\| hasSavedValue\(block\);/);
  assert.doesNotMatch(source, /\.value = ''|\.checked = false/);
  const record = read('public/emr-patient-record.js');
  assert.match(record, /const visible = hasValues \|\| \(ruled === null \|\| ruled === undefined \? isFemale : ruled\);/);
});

test('paediatric and tetanus sections: approved Khmer labels, id-keyed fields, in the S box', () => {
  const paediatric = ipd.slice(ipd.indexOf('data-soap-slot="paediatric"'), ipd.indexOf('data-soap-slot="tetanus-status"'));
  for (const label of ['ផ្នែកកុមារ', 'ប្រវត្តិកំណើត', 'ការបំបៅ', 'ការលូតលាស់', 'ដំណាក់កាលអភិវឌ្ឍន៍']) assert.ok(paediatric.includes(`>${label}<`), label);
  for (const id of ['ipd_paed_birth_history', 'ipd_paed_feeding', 'ipd_paed_head_circumference', 'ipd_paed_growth_notes', 'ipd_paed_milestones']) {
    assert.match(paediatric, new RegExp(`id="${id}" data-emr-no-auto-index`), id);
  }
  assert.match(paediatric, /data-display-rule="head-circumference"/);
  const tetanus = ipd.slice(ipd.indexOf('data-soap-slot="tetanus-status"'), ipd.indexOf('data-soap-record-box="o"'));
  assert.ok(tetanus.includes('>ស្ថានភាពទទួលថ្នាំការពាររោគតេតាណូស<'));
  assert.match(tetanus, /<select id="ipd_tetanus_status" data-emr-no-auto-index/);
  assert.match(tetanus, /<input type="date" id="ipd_tetanus_last_dose" data-emr-no-auto-index/);
  // Existing blocks only gain a rule attribute; their fields keep the frozen keys.
  assert.match(ipd, /<div data-display-rule="immunization" style="display: flex;/);
  assert.equal((ipd.match(/<label data-display-rule="substance-use"><input data-emr-key-index="(90|91|92)"/g) || []).length, 3);
});

test('TB screening: one shared block in OPD and IPD with the same items and labels', () => {
  const opd = html.slice(html.indexOf('<div id="sub_opd"'), html.indexOf('<div id="sub_ipd"'));
  const block = (text) => text.slice(text.indexOf('emr-tb-screening'), text.indexOf('</div>\r\n', text.indexOf('data-key="hist_weight"')));
  const keys = (text) => [...block(text).matchAll(/data-key="(hist_[a-z_]+)"/g)].map((m) => m[1]);
  const items = ['hist_cough', 'hist_fever', 'hist_sweat', 'hist_weight'];
  assert.deepEqual(keys(opd).slice(0, 4), items);
  assert.deepEqual(keys(ipd).slice(0, 4), items);
  assert.match(opd, /data-key="hist_tb_contact"/);
  assert.match(ipd, /<input id="ipd_tb_contact" data-emr-no-auto-index type="checkbox"> <span\s+data-key="hist_tb_contact">/);
  assert.match(read('public/display-rules.css'), /#sub_ipd \.emr-tb-screening,\s*#sub_opd \.emr-tb-screening \{/);
});
