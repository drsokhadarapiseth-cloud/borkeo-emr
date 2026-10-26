// v47.5 - The ANC to-do list is ticked from the data entered by Registration,
// Triage, the midwife, the Laboratory and Imaging. Synthetic records only.
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
const negative = [{ date: '2026-09-01', hiv: 'Negative', syphilis: 'Negative', hbsag: 'Negative', hb: '12', group: 'O+' }];
const base = (weeks, extra = {}) => ({ identity: { age: '25', births: '1', miscarriages: '0', abortions: '0' }, lmp: anc.addDays(TODAY, -weeks * 7),
  heightCm: '158', prePregnancyWeightKg: '52', labs: negative, history: {}, ...extra });
const vitals = { bp: '110/70', pulse: '80', temperature: '36.8', spo2: '98' };
const status = (record, visit = {}, more = {}) => anc.ancStatus({ chart, schedule, record, visits: [...(more.earlier || []), { date: TODAY, ...vitals, ...visit }], today: TODAY, vaccinations: more.vaccinations || [] });
const task = (result, action) => result.tasks.find((item) => item.action === action);
const done = (result, action) => { const found = task(result, action); assert.ok(found, `task ${action} is on this visit`); return found.autoDone; };

test('first visit: record tasks always done; weight, height, BMI from Triage; vital signs need BP, pulse, temperature and SpO2', () => {
  const first = status(base(10), { weight: '52' });
  assert.equal(first.visit.visit, 1);
  assert.equal(first.tasks.filter((item) => item.action === 'auto:record').every((item) => item.autoDone), true);
  assert.equal(first.tasks.filter((item) => item.action === 'auto:record').length, 2, 'ANC record and digital system; the paper books stay manual');
  assert.equal(done(first, 'data:weight'), true);
  assert.equal(done(first, 'data:height'), true);
  assert.equal(done(first, 'data:bmi'), true);
  assert.equal(done(first, 'data:vitals'), true);
  assert.equal(done(status(base(10), { spo2: '' }), 'data:vitals'), false, 'SpO2 missing');
  assert.equal(done(status(base(10), { weight: '' }), 'data:weight'), false);
  assert.equal(done(status(base(10, { prePregnancyWeightKg: '' })), 'data:bmi'), false);
});

test('page 2 answers tick anaemia (visit 1), breast and mouth examinations', () => {
  const unanswered = status(base(10));
  for (const action of ['data:anaemia', 'data:breast', 'data:mouth']) assert.equal(done(unanswered, action), false, action);
  const history = { anaemia: { eyelid: 'no', nails: 'no', palms: 'yes' }, mouth: { stomatitis: 'no', caries: 'yes', breast: 'no' } };
  const answered = status(base(10, { history }));
  for (const action of ['data:anaemia', 'data:breast', 'data:mouth']) assert.equal(done(answered, action), true, action);
  assert.equal(done(status(base(10, { history: { anaemia: { eyelid: 'no' } } })), 'data:anaemia'), false, 'all three questions needed');
});

test('today\'s exam: FHR, fundal height, presentation, urine, iron, education; anaemia from today\'s Hb after visit 1', () => {
  const later = (visit) => status(base(24), visit, { earlier: [{ date: anc.addDays(TODAY, -14 * 7), weight: '50' }] });
  const empty = later({});
  assert.equal(empty.visit.visit, 2);
  for (const action of ['data:fhr', 'data:uh', 'data:fp', 'data:education', 'rx:iron', 'data:anaemia']) assert.equal(done(empty, action), false, action);
  const full = later({ fhr: '140', uh: '24', fp: 'cephalic', fer: '30', educationDone: true, rapid: { hb: '11' }, proteinuria: '-' });
  for (const action of ['data:fhr', 'data:uh', 'data:fp', 'data:education', 'rx:iron', 'data:anaemia', 'own:urine']) assert.equal(done(full, action), true, action);
  assert.equal(done(later({ fer: '0' }), 'rx:iron'), false, '0 tablets: not given');
});

test('tetanus: a dose recorded today or the tetanus field "complete"', () => {
  const later = (visit, vaccinations) => status(base(24), visit, { vaccinations });
  assert.equal(done(later({}, []), 'vaccine:tt'), false);
  assert.equal(done(later({}, [{ givenDate: TODAY, doseNumber: 2 }]), 'vaccine:tt'), true);
  assert.equal(done(later({}, [{ givenDate: '2025-01-01', doseNumber: 1 }]), 'vaccine:tt'), false, 'an old dose is not this visit');
  assert.equal(done(later({ legacyDetails: { 44: '\u1782\u17d2\u179a\u1794\u17cb' } }, []), 'vaccine:tt'), true);
});

test('second CBC is not ticked by the first Hb; an Hb within that visit\'s weeks ticks it', () => {
  const plan = schedule.yellowRed;
  const cbc2 = plan.visits.find((visit) => [...(visit.lab || [])].some((text) => /\u179b\u17be\u1780\u1791\u17b8\u17e2/.test(text)));
  assert.ok(cbc2, 'the schedule has CBC 2');
  const weeks = cbc2.gaFrom;
  const yellow = (labs, visit = {}) => status(base(weeks, { identity: { age: '40' }, labs }), visit);
  const old = yellow(negative);
  assert.equal(old.visit.visit, cbc2.visit);
  assert.equal(done(old, 'own:hb-window'), false, 'Hb of 2026-09-01 is before this visit');
  assert.equal(done(yellow([...negative, { date: TODAY, hb: '11.5' }]), 'own:hb-window'), true);
  assert.equal(done(yellow(negative, { rapid: { hb: '11' } }), 'own:hb-window'), true, 'rapid Hb today');
});

test('OGTT: a released glucose result within the visit\'s weeks', () => {
  const visit = schedule.yellowRed.visits.find((item) => (item.lab || []).some((text) => /OGTT/.test(text)));
  const yellow = (labs) => status(base(visit.gaFrom, { identity: { age: '40' }, labs }));
  assert.equal(done(yellow(negative), 'order:OGTT'), false);
  assert.equal(done(yellow([...negative, { date: TODAY, glucose: '5.1' }]), 'order:OGTT'), true);
  assert.match(read('server/maternal.mjs'), /OGTT: 'glucose', GTT: 'glucose', GLU: 'glucose'/);
});

test('ultrasound: dating scan at visit 1; later scans within the visit\'s weeks', () => {
  assert.equal(done(status(base(12)), 'order:ULTRASOUND'), false);
  assert.equal(done(status(base(12, { ultrasounds: [{ date: TODAY, ga: '12' }] })), 'order:ULTRASOUND'), true);
  assert.equal(done(status(base(12, { ultrasoundEdd: '2027-04-21', ultrasoundDate: TODAY })), 'order:ULTRASOUND'), true);
  const later = (ultrasounds) => status(base(24, { ultrasounds }));
  assert.equal(done(later([{ date: anc.addDays(TODAY, -12 * 7), ga: '12' }]), 'order:ULTRASOUND'), false, 'the dating scan is not the growth scan');
  assert.equal(done(later([{ date: anc.addDays(TODAY, -3), ga: '24' }]), 'order:ULTRASOUND'), true);
});

test('overdue: an earlier visit saved in its weeks is not overdue; manual and education tasks still are', () => {
  const lmp = anc.addDays(TODAY, -24 * 7);
  const firstDate = anc.addDays(lmp, 10 * 7);
  const record = base(24, { history: { anaemia: { eyelid: 'no', nails: 'no', palms: 'no' }, mouth: { stomatitis: 'no', caries: 'no', breast: 'no' } } });
  const missed = status(record, {}, {});
  const seen = status(record, {}, { earlier: [{ date: firstDate, weight: '50', ...vitals, proteinuria: '-' }] });
  const overdueActions = (result) => result.overdue.map((item) => item.action);
  assert.ok(overdueActions(missed).includes('data:weight'));
  assert.equal(overdueActions(seen).includes('data:weight'), false);
  assert.equal(overdueActions(seen).includes('data:vitals'), false);
  assert.ok(overdueActions(seen).includes('data:education'), 'no education ticked at visit 1');
});

test('page and server: education box, tick box saving, vaccines and the CBC 2 focus', () => {
  const page = read('public/anc-record.js');
  assert.match(page, /data-visit="educationDone"/);
  assert.match(page, /anc\.educationDone/);
  assert.match(page, /setPath\(draft, target\.dataset\.visit, target\.type === 'checkbox' \? target\.checked : target\.value\)/);
  assert.match(page, /vaccinations: data\.vaccinations \|\| \[\]/);
  assert.match(page, /'own:hb-window': \(\) => '\[data-visit="rapid\.hb"\]'/);
  const server = read('server/maternal.mjs');
  assert.match(server, /'legacyDetails', 'educationDone'\]/);
  assert.match(server, /vaccinations: pregnancyVaccinations\(database, pregnancy\)/);
});
