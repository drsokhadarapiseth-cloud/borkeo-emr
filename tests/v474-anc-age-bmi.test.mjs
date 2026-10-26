// v47.4 - ANC age read from the Registration text ('13 <year word>', '13 Yrs',
// Khmer digits) or the date of birth; pre-pregnancy weight filled from Triage
// at any GA so the BMI is calculated. Synthetic records only.
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
const TODAY = '2026-10-07';
const YEAR = '\u1786\u17d2\u1793\u17b6\u17c6';
const MONTH = '\u1781\u17c2';
const negative = [{ date: '2026-09-01', hiv: 'Negative', syphilis: 'Negative', hbsag: 'Negative', hb: '12', group: 'O+' }];
const normal = { identity: { age: `25 ${YEAR}`, births: '1', miscarriages: '0', abortions: '0' }, lmp: anc.addDays(TODAY, -27 * 7), heightCm: '158', prePregnancyWeightKg: '52', labs: negative };
const status = (record) => anc.ancStatus({ chart, schedule, record, visits: [{ date: TODAY, bp: '110/70' }], today: TODAY });
const withAge = (age, dateOfBirth = '') => status({ ...normal, identity: { ...normal.identity, age, dateOfBirth } });

test('Registration age text is read: 13 years ticks yellow, 25 years ticks green', () => {
  const young = withAge(`13 ${YEAR}`);
  assert.equal(young.facts.age, 13);
  assert.ok(young.applied.includes('age_risk'), 'age 13: <18 box ticked');
  assert.equal(young.applied.includes('age_normal'), false);
  assert.equal(young.colour, 'yellow');
  const adult = withAge(`25 ${YEAR}`);
  assert.ok(adult.applied.includes('age_normal'));
  assert.equal(adult.applied.includes('age_risk'), false);
  assert.equal(adult.colour, 'green');
  assert.equal(withAge('40 Yrs').colour, 'yellow', 'English age text');
  assert.equal(withAge('\u17e1\u17e3 ' + YEAR).facts.age, 13, 'Khmer digits');
  assert.equal(withAge('34').facts.age, 34, 'plain number still works');
});

test('the date of birth is used first; unknown age ticks neither box', () => {
  assert.equal(withAge(`25 ${YEAR}`, '2010-10-08').facts.age, 15, 'one day before the 16th birthday');
  assert.equal(withAge('', '1990-01-01').facts.age, 36);
  const unknown = withAge('');
  assert.equal(unknown.facts.age, null);
  assert.equal(unknown.applied.includes('age_normal') || unknown.applied.includes('age_risk'), false);
  assert.equal(anc.ageYears(`5 ${MONTH}`), 0, 'months only: under one year');
  assert.equal(anc.ageYears('abc'), null);
});

test('BMI: the Triage weight fills an empty pre-pregnancy weight at any GA (owner setting null)', () => {
  assert.equal(anc.DEFAULT_OPTIONS.prePregnancyWeightFromTriageMaxWeeks, null);
  assert.equal(JSON.parse(read('server/clinical-options.json')).maternal.prePregnancyWeightFromTriageMaxWeeks, null);
  const page = read('public/anc-record.js');
  assert.match(page, /const weightAllowed = maxWeeks == null \|\|/);
  assert.match(page, /record\.prePregnancyWeightSource = 'triage'/);
  // BMI from the filled weight and the Triage height ticks the chart.
  assert.equal(anc.bmi('52', '158'), 20.8);
  assert.ok(status(normal).applied.includes('bmi_normal'));
  assert.ok(status({ ...normal, prePregnancyWeightKg: '80' }).applied.includes('bmi_high'));
});
