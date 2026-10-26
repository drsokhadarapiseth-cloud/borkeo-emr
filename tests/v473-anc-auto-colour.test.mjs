// v47.3 - ANC colour code ticked from the patient data (Registration, Triage,
// page 2 history, previous pregnancies, ultrasound, today's exam, results),
// ultrasound / visit dropdowns and units. Synthetic records only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import * as anc from '../public/anc-engine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const chart = JSON.parse(read('server/catalogues/anc-color-chart.json'));
const schedule = JSON.parse(read('server/catalogues/anc-visit-schedule.json'));
const labels = JSON.parse(read('server/catalogues/anc-record-labels.json'));
const TODAY = '2026-10-07';
const negative = [{ date: '2026-09-01', hiv: 'Negative', syphilis: 'Negative', hbsag: 'Negative', hb: '12', group: 'O+' }];
const normal = { identity: { age: '25', births: '1', miscarriages: '0', abortions: '0' }, lmp: anc.addDays(TODAY, -27 * 7), heightCm: '158', prePregnancyWeightKg: '52', labs: negative };
const status = (record, visits = [{ date: TODAY, bp: '110/70' }]) => anc.ancStatus({ chart, schedule, record, visits, today: TODAY });
const at36 = { ...normal, lmp: anc.addDays(TODAY, -37 * 7) };

test('green items are ticked from the data: age 25, height, BMI, BP, labs, births, normal course', () => {
  const result = status(normal);
  assert.equal(result.colour, 'green');
  for (const key of ['age_normal', 'height_normal', 'bmi_normal', 'no_chronic', 'births_normal', 'no_abortion', 'bp_normal', 'infections_negative', 'hb_normal', 'normal_course']) {
    assert.ok(result.applied.includes(key), key);
    assert.ok(result.automatic.includes(key), `${key} locked`);
  }
  assert.equal(result.applied.includes('age_risk'), false);
});

test('BMI over 30 ticks the red box; age outside 20-34 ticks yellow', () => {
  const heavy = status({ ...normal, prePregnancyWeightKg: '80' });
  assert.equal(heavy.colour, 'red');
  assert.ok(heavy.applied.includes('bmi_high'));
  assert.equal(heavy.applied.includes('bmi_normal'), false);
  const young = status({ ...normal, identity: { ...normal.identity, age: '17' } });
  assert.ok(young.applied.includes('age_risk'));
  assert.equal(young.applied.includes('age_normal'), false);
});

test('page 2 general history ticks the chronic disease items', () => {
  const history = (items) => status({ ...normal, history: { general: items } });
  assert.equal(history({ diabetes: true }).colour, 'yellow');
  assert.ok(history({ diabetes: true }).applied.includes('diabetes'));
  assert.equal(history({ diabetes: true }).applied.includes('no_chronic'), false);
  assert.equal(history({ heart: true }).colour, 'red');
  assert.equal(history({ thyroid: true }).colour, 'red');
  assert.equal(history({ transfusion: true }).colour, 'red');
  const hypertension = history({ hypertension: true });
  assert.equal(hypertension.colour, 'yellow');
  assert.ok(hypertension.applied.includes('bp_risk'), 'chronic hypertension: yellow even with BP 110/70');
  assert.ok(history({ accident: true }).applied.includes('no_chronic'), 'a road accident is not a chronic disease');
});

test('previous pregnancies: vacuum, complication numbers, loss after 12 weeks', () => {
  const previous = (rows) => status({ ...normal, previous: rows });
  assert.ok(previous([{ date: '2022-01-01', deliveryType: 'vacuum' }]).applied.includes('vacuum'));
  const many = previous([{ date: '2022-01-01', complications: '1, 3, 8' }, { date: '2023-05-01', complications: '៩' }]);
  for (const key of ['tear_3', 'varices', 'pph', 'low_birth_weight']) assert.ok(many.applied.includes(key), key);
  assert.equal(many.colour, 'yellow');
  assert.equal(previous([{ date: '2022-01-01', complications: '4' }]).colour, 'red', 'pre-eclampsia before: red');
  assert.equal(previous([{ date: '2022-01-01', complications: '5' }]).colour, 'red', 'seizure before: red');
  assert.equal(previous([{ date: '2022-01-01', complications: '10' }]).colour, 'green', '10 = other: no item');
  assert.ok(previous([{ date: '2022-01-01', over12: true }]).applied.includes('second_trimester_loss'));
});

test('ultrasound dropdowns: fetuses, placenta previa, amniotic fluid; imaging text is read too', () => {
  const scan = (row) => status({ ...normal, ultrasounds: [{ date: '2026-09-20', ...row }] });
  assert.ok(scan({ fetuses: '1' }).applied.includes('singleton'));
  const twins = scan({ fetuses: '2' });
  assert.equal(twins.colour, 'red');
  assert.ok(twins.applied.includes('twins_y') && twins.applied.includes('twins_r'));
  assert.equal(twins.applied.includes('singleton'), false);
  assert.equal(twins.applied.includes('normal_course'), false);
  assert.equal(scan({ placenta: 'previa' }).colour, 'red');
  assert.equal(scan({ placenta: 'anterior' }).colour, 'green');
  assert.equal(scan({ afi: 'low' }).colour, 'red');
  assert.equal(scan({ afi: 'normal' }).colour, 'green');
  assert.equal(scan({ placenta: 'Low lying, placenta previa major' }).colour, 'red', 'released imaging report text');
  assert.equal(scan({ afi: '3.5' }).colour, 'red', 'AFI typed in cm');
  // The latest scan wins: an earlier low-lying placenta that moved up is no longer red.
  const moved = status({ ...normal, ultrasounds: [{ date: '2026-07-01', placenta: 'previa' }, { date: '2026-09-20', placenta: 'fundal' }] });
  assert.equal(moved.colour, 'green');
});

test('today\'s exam: malpresentation from 36 weeks, FHR outside 110-160, severe pre-eclampsia, large uterus', () => {
  assert.equal(status(normal, [{ date: TODAY, bp: '110/70', fp: 'breech' }]).colour, 'green', 'breech at 27 weeks is not counted');
  const breech = status(at36, [{ date: TODAY, bp: '110/70', fp: 'breech' }]);
  assert.equal(breech.colour, 'yellow');
  assert.ok(breech.applied.includes('malpresentation'));
  assert.ok(status(at36, [{ date: TODAY, bp: '110/70', fp: 'cephalic' }]).applied.includes('malpresentation') === false);
  assert.ok(status(at36, [{ date: TODAY, bp: '110/70' }], ).applied.includes('malpresentation') === false);
  assert.equal(status({ ...at36, ultrasounds: [{ date: TODAY, presentation: 'transverse' }] }).colour, 'yellow', 'presentation from the scan');

  assert.equal(status(normal, [{ date: TODAY, bp: '110/70', fhr: '180' }]).colour, 'red');
  assert.equal(status(normal, [{ date: TODAY, bp: '110/70', fhr: '100' }]).colour, 'red');
  assert.equal(status(normal, [{ date: TODAY, bp: '110/70', fhr: '140' }]).colour, 'green');

  const pe = status(normal, [{ date: TODAY, bp: '145/92', proteinuria: '++' }]);
  assert.equal(pe.colour, 'red');
  assert.ok(pe.applied.includes('severe_preeclampsia'));
  assert.equal(status(normal, [{ date: TODAY, bp: '145/92', proteinuria: '+' }]).colour, 'yellow', 'one plus: high BP only');
  assert.equal(status(normal, [{ date: TODAY, bp: '120/80', proteinuria: '+++' }]).colour, 'green', 'protein without high BP');

  assert.ok(status(normal, [{ date: TODAY, bp: '110/70', uh: '31' }]).applied.includes('uterus_large'), '31 cm at 27 weeks');
  assert.equal(status(normal, [{ date: TODAY, bp: '110/70', uh: '30' }]).applied.includes('uterus_large'), false, '27 + 3 = 30 is not more');
  const early = { ...normal, lmp: anc.addDays(TODAY, -18 * 7) };
  assert.equal(status(early, [{ date: TODAY, bp: '110/70', uh: '30' }]).applied.includes('uterus_large'), false, 'before 20 weeks: not checked');
});

test('manual ticks still count for items without data; automatic ticks are not undone by the midwife', () => {
  const asthma = status({ ...normal, ticks: { asthma: true } });
  assert.equal(asthma.colour, 'red');
  assert.ok(asthma.applied.includes('asthma'));
  assert.equal(asthma.automatic.includes('asthma'), false);
  assert.equal(status({ ...normal, ticks: { age_normal: false } }).applied.includes('age_normal'), true);
});

test('helpers: plus counts and presentation codes', () => {
  assert.equal(anc.plusCount('-'), 0);
  assert.equal(anc.plusCount('++'), 2);
  assert.equal(anc.plusCount(''), null);
  assert.equal(anc.presentationCode('Breech'), 'breech');
  assert.equal(anc.presentationCode('ក្បាល'), 'cephalic');
  assert.deepEqual(anc.PROTEINURIA, ['-', '+', '++', '+++', '++++']);
  assert.deepEqual(anc.GLUCOSURIA, ['-', '+', '++', '+++']);
});

test('page: no automatic word, dropdowns, units and the renamed urine fields', () => {
  const js = read('public/anc-record.js');
  assert.equal(/anc\.auto'/.test(js), false, 'the word automatic is no longer shown');
  assert.match(js, /visitPick\('fp'/);
  assert.match(js, /visitPick\('proteinuria'/);
  assert.match(js, /visitPick\('glucosuria'/);
  assert.match(js, /anc\.unit\.perMinute/);
  assert.match(js, /refreshChart\(status\)/);
  const columns = Object.fromEntries(labels.visits.columns.map((c) => [c.key, c.kh]));
  assert.equal(columns.proteinuria, 'ជាតិសាច់ក្នុងទឹកនោម');
  assert.equal(columns.glucosuria, 'ជាតិស្ករក្នុងទឹកនោម');
  assert.ok(labels.ultrasound.columns.some((c) => c.key === 'fetuses'));
  // The official chart file is unchanged (69 items).
  assert.equal(chart.sections.reduce((sum, section) => sum + section.items.length, 0), 69);
});
