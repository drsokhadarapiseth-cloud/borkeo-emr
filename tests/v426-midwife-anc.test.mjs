// v42.6 - Maternal services by the midwife and the official ANC record
// (colour code, schedule, referral), vaccination, cervical screening, safe
// abortion in the Gynecology ward. Synthetic patients, in-memory database.
// The browser behaviour is also checked in tests/v426-midwife-anc-browser.mjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { opdLocalDate } from '../server/opd-queue.mjs';
import { addStockItem, listStock } from '../server/stock.mjs';
import * as anc from '../public/anc-engine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const chart = JSON.parse(read('server/catalogues/anc-color-chart.json'));
const schedule = JSON.parse(read('server/catalogues/anc-visit-schedule.json'));
const TODAY = '2026-10-07';
const negative = [{ date: '2026-09-01', hiv: 'Negative', syphilis: 'Negative', hbsag: 'Negative', hb: '12', group: 'O+' }];
const normal = { identity: { age: '25', births: '1', miscarriages: '0', abortions: '0' }, lmp: anc.addDays(TODAY, -27 * 7), heightCm: '158', prePregnancyWeightKg: '52', labs: negative };
const status = (record, visits = [{ date: TODAY, bp: '110/70' }]) => anc.ancStatus({ chart, schedule, record, visits, today: TODAY });

async function startServer() {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test' });
  await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  const login = async (username) => {
    const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: app.config.appOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    assert.equal(response.status, 200, username);
    const Cookie = response.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie } })).json();
    return { Cookie, Origin: app.config.appOrigin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
  };
  const call = async (headers, method, url, body) => {
    const response = await fetch(origin + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  const staff = {};
  for (const name of ['registration', 'triage', 'clerk', 'doctor_opd', 'nurse_obstetric', 'doctor_obstetric', 'doctor_gynecology', 'pharmacy', 'admin']) staff[name] = await login(name);
  const today = opdLocalDate();
  // Registration, then Triage to a service (Triage fills every value).
  const visit = async (caseNumber, service, { healthId = `H-${caseNumber}`, sex = 'ស្រី', age = '25', serviceKh = service, vitals = true, previous = '' } = {}) => {
    const key = `case:${caseNumber}`;
    const summary = { caseNumber, healthId, firstName: 'Synthetic', lastName: caseNumber, fullName: `Synthetic ${caseNumber}`, sex, age, dateOfBirth: '', phone: '', equityCard: '', paymentType: 'CASH', departmentCode: '', departmentNameKh: '', departmentNameEn: '', serviceMode: '', entryDate: today, dischargeDate: '' };
    let response = await call(staff.registration, 'PUT', '/api/patient-record', previous
      ? { patientKey: key, summary, newVisitFrom: previous, data: { 'scope:registration:id:emr_pmrs_case_old': true } }
      : { patientKey: key, summary, data: { 'scope:registration:id:emr_pmrs_case_new': true } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const version = (await call(staff.registration, 'GET', `/api/patient-record?patientKey=${encodeURIComponent(key)}`)).body.patient.version;
    const values = vitals ? { p2_weight: '55', p2_height: '158', p2_bp_sys: '110', p2_bp_dia: '70', p2_pulse: '80', p2_temp: '36.8', p2_spo2: '98', p2_resp: '18' } : { p2_temp: '36.8' };
    response = await call(staff.triage, 'PUT', '/api/patient-record', { patientKey: key, expectedVersion: version, triageSave: true,
      summary: { ...summary, departmentCode: service, departmentNameKh: serviceKh, departmentNameEn: service, serviceMode: 'opd' },
      data: Object.fromEntries(Object.entries(values).map(([k, v]) => [`scope:triage:id:${k}`, v])) });
    return { key, response };
  };
  const pay = async (key) => {
    const bill = (await call(staff.clerk, 'GET', `/api/finance/patient?patientKey=${encodeURIComponent(key)}`)).body.bill;
    assert.ok(bill.summary.KHR.balance > 0, 'consultation fee at the Cashier');
    const paid = await call(staff.clerk, 'POST', '/api/finance/payments', { patientKey: key, invoiceId: bill.invoice.id, source: 'CASH', amount: bill.summary.KHR.balance, currency: 'KHR' });
    assert.equal(paid.status, 201, JSON.stringify(paid.body));
  };
  const close = async () => { await new Promise((resolve) => app.server.close(resolve)); app.database.close(); };
  return { app, origin, staff, call, visit, pay, close, today };
}

// ---------------------------------------------------------------- engine
test('EDD = LMP + 280 days; a dating ultrasound before 14 weeks more than 7 days apart is used', () => {
  assert.equal(anc.eddFromLmp('2026-01-01'), '2026-10-08');
  assert.deepEqual(anc.datingEdd({ lmp: '2026-01-01', ultrasoundEdd: '2026-10-20', ultrasoundDate: '2026-02-20' }), { edd: '2026-10-20', source: 'ultrasound', lmpEdd: '2026-10-08' });
  assert.equal(anc.datingEdd({ lmp: '2026-01-01', ultrasoundEdd: '2026-10-12', ultrasoundDate: '2026-02-20' }).source, 'lmp', '4 days apart: LMP');
  assert.equal(anc.datingEdd({ lmp: '2026-01-01', ultrasoundEdd: '2026-10-25', ultrasoundDate: '2026-06-20' }).source, 'lmp', 'scan after 14 weeks: LMP');
  assert.equal(anc.gestationalAge('2026-10-08', '2026-07-09').label, '27+0');
});

test('colour: all normal green; 40 years yellow; Hb 6.5, BP 165/112 and two caesareans red', () => {
  assert.equal(status(normal).colour, 'green');
  assert.equal(status({ ...normal, identity: { ...normal.identity, age: '40' } }).colour, 'yellow');
  assert.equal(status({ ...normal, labs: [{ ...negative[0], hb: '6.5' }] }).colour, 'red');
  assert.equal(status(normal, [{ date: TODAY, bp: '165/112' }]).colour, 'red');
  assert.equal(status(normal, [{ date: TODAY, bp: '145/92' }]).colour, 'yellow');
  assert.equal(status({ ...normal, ticks: { csection_2: true } }).colour, 'red', 'two previous caesareans ticked');
  assert.equal(status({ ...normal, previous: [{ date: '2020-01-01', deliveryType: 'caesarean' }, { date: '2023-01-01', deliveryType: 'caesarean' }] }).colour, 'red');
  assert.equal(status({ ...normal, identity: { ...normal.identity, age: '18' } }).colour, 'yellow', '18-19 years: yellow');
  assert.equal(status({ ...normal, identity: { ...normal.identity, births: '4' } }).colour, 'yellow', '4 births yellow');
  assert.equal(status({ ...normal, identity: { ...normal.identity, births: '5' } }).colour, 'red', '5 births red');
  assert.equal(status({ ...normal, ticks: { twins_y: true } }).colour, 'red', 'twins red');
  assert.equal(status({ ...normal, labs: [] }).colour, 'yellow', 'not tested for HIV, syphilis, hepatitis B: yellow');
  const short = status({ ...normal, heightCm: '143' });
  assert.equal(short.colour, 'yellow');
  assert.deepEqual(short.flags, ['height-check']);
});

test('schedule: yellow at 26 weeks shows OGTT; green at 27 weeks is not a scheduled visit; missed HBsAg is overdue', () => {
  const yellow = status({ ...normal, identity: { ...normal.identity, age: '40' }, lmp: anc.addDays(TODAY, -26 * 7) });
  assert.equal(yellow.plan, 'yellowRed');
  assert.equal(yellow.visitsPlanned, 8);
  assert.equal(yellow.visit.visit, 3);
  assert.ok(yellow.tasks.some((task) => /OGTT/.test(task.text) && task.action === 'order:OGTT'));
  const green = status(normal);
  assert.equal(green.visitsPlanned, 4);
  assert.equal(green.scheduled, false);
  assert.equal(green.next.visit, 3);
  assert.equal(green.appointment, anc.addDays(TODAY, 3 * 7), 'next visit at 30 weeks');
  const missed = status({ ...normal, identity: { ...normal.identity, age: '40' }, labs: [{ date: '2026-06-01', hiv: 'Negative', syphilis: 'Negative', hb: '12' }], lmp: anc.addDays(TODAY, -21 * 7) });
  assert.ok(missed.overdue.some((task) => task.action === 'order:HBSAG'), 'HBsAg not done at visit 1');
  assert.ok(!missed.overdue.some((task) => task.action === 'own:hiv'), 'HIV result typed: done');
  // Single-week visits accept +/- 1 week.
  assert.equal(status({ ...normal, identity: { ...normal.identity, age: '40' }, lmp: anc.addDays(TODAY, -25 * 7) }).visit.visit, 3);
});

test('the official files: 69 chart items in 4 sections; 4 green visits and 8 yellow / red visits', () => {
  assert.equal(chart.sections.length, 4);
  assert.equal(chart.sections.reduce((sum, section) => sum + section.items.length, 0), 69);
  assert.equal(schedule.green.visits.length, 4);
  assert.equal(schedule.yellowRed.visits.length, 8);
  // Copied unchanged from the owner's input folder (when it is next to the project).
  if (fs.existsSync(path.join(root, 'borkeo-update-files/anc'))) {
    assert.equal(read('server/catalogues/anc-color-chart.json'), read('borkeo-update-files/anc/anc-color-chart.json'));
    assert.equal(read('server/catalogues/anc-visit-schedule.json'), read('borkeo-update-files/anc/anc-visit-schedule.json'));
  }
  const options = JSON.parse(read('server/clinical-options.json')).maternal;
  assert.deepEqual(options.taskCloseReasons, ['មិនមានតេស្ត', 'អ្នកជំងឺបដិសេធ', 'ធ្វើរួចនៅកន្លែងផ្សេង', 'ផ្សេងៗ']);
  assert.deepEqual(options.midwifeLabTests, ['HBSAG']);
});

// ---------------------------------------------------------------- routing
test('routing: ANC after the Cashier to the midwife (not the OPD doctor); vaccination free; safe abortion to Gynecology', async () => {
  const s = await startServer();
  try {
    const { key: ancKey, response } = await s.visit('V426-ANC-1', 'anc');
    assert.equal(response.status, 200, JSON.stringify(response.body));
    let queue = await s.call(s.staff.nurse_obstetric, 'GET', '/api/maternal/queue');
    assert.equal(queue.status, 200);
    assert.ok(!queue.body.patients.some((item) => item.patientKey === ancKey), 'not before the Cashier');
    await s.pay(ancKey);
    queue = await s.call(s.staff.nurse_obstetric, 'GET', '/api/maternal/queue');
    const ancRow = queue.body.patients.find((item) => item.patientKey === ancKey);
    assert.ok(ancRow, 'in the midwife queue after the Cashier');
    assert.equal(ancRow.form, `/anc-record?patient=${encodeURIComponent(ancKey)}`);
    const opd = await s.call(s.staff.doctor_opd, 'GET', '/api/opd/queue');
    assert.ok(!opd.body.patients.some((item) => item.patientKey === ancKey), 'not in the OPD doctor queue');
    assert.equal((await s.call(s.staff.nurse_obstetric, 'POST', '/api/queue/call', { service: 'OPD', counter: '1', patientKey: ancKey })).status, 200, 'the midwife calls her patient');

    const { key: vaccineKey } = await s.visit('V426-VAC-1', 'vaccination', { sex: 'ប្រុស', age: '1' });
    const bill = (await s.call(s.staff.clerk, 'GET', `/api/finance/patient?patientKey=${encodeURIComponent(vaccineKey)}`)).body.bill;
    assert.ok(!bill?.summary?.KHR?.balance, 'vaccination is free: nothing at the Cashier');
    queue = await s.call(s.staff.nurse_obstetric, 'GET', '/api/maternal/queue');
    assert.equal(queue.body.patients.find((item) => item.patientKey === vaccineKey)?.form, `/vaccination?patient=${encodeURIComponent(vaccineKey)}`);

    const { key: safeKey } = await s.visit('V426-SAFE-1', 'safe-abortion');
    const safeData = JSON.parse(s.app.database.findPatient(safeKey).record_json);
    assert.equal(safeData['system:cashierQueueRequest'].wardCode, 'gynecology', 'billed under Gynecology');
    await s.pay(safeKey);
    assert.ok(!(await s.call(s.staff.doctor_opd, 'GET', '/api/opd/queue')).body.patients.some((item) => item.patientKey === safeKey), 'not the OPD doctor');
    assert.ok(!(await s.call(s.staff.nurse_obstetric, 'GET', '/api/maternal/queue')).body.patients.some((item) => item.patientKey === safeKey), 'not the midwife');
    const gyn = await s.call(s.staff.doctor_gynecology, 'GET', '/api/maternal/queue');
    assert.equal(gyn.body.kind, 'gynecology');
    assert.equal(gyn.body.patients.find((item) => item.patientKey === safeKey)?.form, `/emr?patient=${encodeURIComponent(safeKey)}&view=opd`);
    const page = await fetch(`${s.origin}/emr?patient=${encodeURIComponent(safeKey)}&view=opd`, { headers: { Cookie: s.staff.doctor_gynecology.Cookie }, redirect: 'manual' });
    assert.equal(page.status, 200, 'the Gynecology doctor opens the safe abortion form');
    const fees = s.app.database.sqlite.prepare("SELECT department_code FROM finance_service_catalog WHERE code IN ('GO_VACUUM_ABORTION','GO_MEDICAL_ABORTION')").all();
    assert.ok(fees.length && fees.every((fee) => fee.department_code === 'gynecology'));

    // Triage must fill every value for ANC.
    const { response: blank } = await s.visit('V426-ANC-BLANK', 'anc', { vitals: false });
    assert.equal(blank.status, 400);
  } finally { await s.close(); }
});

// ---------------------------------------------------------------- ANC record
test('one ANC record per pregnancy reused across 3 visits; Triage values imported; colour history; tasks need a reason; referral signed', async () => {
  const s = await startServer();
  try {
    const midwife = s.staff.nurse_obstetric;
    const keys = [];
    for (const n of [1, 2, 3]) {
      const { key, response } = await s.visit(`V426-REC-${n}`, 'anc', { healthId: 'H-V426-REC', age: '40', previous: keys[0] || '' });
      assert.equal(response.status, 200, JSON.stringify(response.body));
      await s.pay(key);
      keys.push(key);
    }
    let read = await s.call(midwife, 'GET', `/api/anc/record?patientKey=${encodeURIComponent(keys[0])}`);
    assert.equal(read.status, 200);
    assert.equal(read.body.pregnancy, null);
    assert.deepEqual([read.body.imported.weightKg, read.body.imported.heightCm, read.body.imported.bp, read.body.imported.pulse, read.body.imported.temperature, read.body.imported.spo2],
      ['55', '158', '110/70', '80', '36.8', '98'], 'Triage values of this visit');
    const opened = await s.call(midwife, 'POST', '/api/anc/record/open', { patientKey: keys[0] });
    assert.equal(opened.status, 201);
    const id = opened.body.pregnancy.id;
    assert.equal(opened.body.pregnancy.record.identity.name, 'Synthetic V426-REC-1', 'name from Registration');
    const lmp = anc.addDays(s.today, -10 * 7);
    const saved = await s.call(midwife, 'POST', `/api/anc/record/${id}/save`, { patientKey: keys[0], record: { lmp, identity: { name: 'Synthetic V426-REC-1', age: '40', births: '1', miscarriages: '0', abortions: '0' }, heightCm: '158', prePregnancyWeightKg: '54' } });
    assert.equal(saved.status, 200, JSON.stringify(saved.body));
    assert.equal(saved.body.status.dating.edd, anc.addDays(lmp, 280), 'EDD = LMP + 280 days');
    assert.equal(saved.body.status.colour, 'yellow', '40 years');
    assert.equal(saved.body.colourHistory.at(-1).colour, 'yellow');
    const visit = await s.call(midwife, 'POST', `/api/anc/record/${id}/visit`, { patientKey: keys[0], visit: { bp: '110/70', weight: '55', rapid: { hiv: 'Negative', syphilis: 'Negative', hb: '6.5' } } });
    assert.equal(visit.status, 200, JSON.stringify(visit.body));
    assert.equal(visit.body.status.colour, 'red', 'Hb 6.5 typed by the midwife');
    assert.ok(visit.body.visits[0].staffName, 'midwife name from the login');
    // Visits 2 and 3 (other patient records, same Health ID) reuse the record.
    const second = await s.call(midwife, 'POST', '/api/anc/record/open', { patientKey: keys[1] });
    assert.equal(second.status, 200);
    assert.equal(second.body.pregnancy.id, id, 'the same pregnancy record');
    await s.call(midwife, 'POST', `/api/anc/record/${id}/visit`, { patientKey: keys[1], visit: { bp: '112/72' } });
    read = await s.call(midwife, 'GET', `/api/anc/record?patientKey=${encodeURIComponent(keys[2])}`);
    assert.equal(read.body.pregnancy.id, id);
    assert.equal(s.app.database.sqlite.prepare('SELECT COUNT(*) n FROM anc_pregnancies').get().n, 1);
    assert.equal(read.body.visits.length, 2);
    assert.equal(read.body.colourHistory.map((entry) => entry.colour).join(','), 'yellow,red');
    // Tasks: closing undone needs one of the reasons; "other" needs the text.
    const task = read.body.status.tasks.find((item) => item.category === 'exam');
    assert.equal((await s.call(midwife, 'POST', `/api/anc/record/${id}/task`, { patientKey: keys[2], key: task.key, action: 'close' })).status, 400);
    assert.equal((await s.call(midwife, 'POST', `/api/anc/record/${id}/task`, { patientKey: keys[2], key: task.key, action: 'close', reason: 'ផ្សេងៗ' })).status, 400);
    const closed = await s.call(midwife, 'POST', `/api/anc/record/${id}/task`, { patientKey: keys[2], key: task.key, action: 'close', reason: 'អ្នកជំងឺបដិសេធ' });
    assert.equal(closed.status, 200);
    assert.equal(closed.body.pregnancy.record.tasks[task.key].reason, 'អ្នកជំងឺបដិសេធ');
    // The patient banner badge.
    assert.equal((await s.call(midwife, 'GET', `/api/anc/badge?patientKey=${encodeURIComponent(keys[2])}`)).body.colour, 'red');
    // Red: the midwife asks, a doctor of the Obstetric ward signs, the visit is referred.
    const asked = await s.call(midwife, 'POST', `/api/anc/record/${id}/referral`, { patientKey: keys[2], treatment: 'Synthetic iron' });
    assert.equal(asked.status, 200, JSON.stringify(asked.body));
    assert.equal((await s.call(midwife, 'POST', `/api/anc/record/${id}/sign`, { patientKey: keys[2] })).status, 403, 'the midwife cannot sign');
    assert.equal((await s.call(s.staff.doctor_opd, 'POST', `/api/anc/record/${id}/sign`, { patientKey: keys[2] })).status, 403, 'an OPD doctor cannot sign');
    const signed = await s.call(s.staff.doctor_obstetric, 'POST', `/api/anc/record/${id}/sign`, { patientKey: keys[2] });
    assert.equal(signed.status, 200, JSON.stringify(signed.body));
    assert.ok(signed.body.referral.signed.signedAt);
    assert.equal(signed.body.pregnancy.status, 'referred');
    assert.equal(s.app.database.sqlite.prepare('SELECT COUNT(*) n FROM anc_visits WHERE referred=1').get().n, 1, 'the visit counts as referred to CPA3');
    const actions = new Set(s.app.database.sqlite.prepare('SELECT action FROM audit_events').all().map((row) => row.action));
    for (const action of ['ANC_RECORD_OPENED', 'ANC_VISIT_SAVED', 'ANC_REFERRAL_REQUESTED', 'ANC_REFERRAL_SIGNED']) assert.ok(actions.has(action), action);
  } finally { await s.close(); }
});

test('midwife orders HBsAg and ultrasound only; prescribes only the maternal medicines', async () => {
  const s = await startServer();
  try {
    const midwife = s.staff.nurse_obstetric;
    const { key } = await s.visit('V426-ORD-1', 'anc');
    await s.pay(key);
    // Fees of the hospital (set by Admin): HBsAg and ultrasound.
    const db = s.app.database.sqlite;
    db.prepare(`INSERT INTO finance_service_catalog (id,code,category_code,name_kh,name_en,default_amount_minor,currency,active,sort_order,created_at,updated_at,department_code,unit_label)
      SELECT 'v426-hbsag-fee','HBSAG',category_code,name_kh,'HBsAg',10000,'KHR',1,999,created_at,updated_at,'lab',unit_label FROM finance_service_catalog WHERE code='LAB_SERVICE'`).run();
    db.prepare("UPDATE finance_service_catalog SET default_amount_minor=20000, currency='KHR', active=1 WHERE code='ULTRASOUND'").run();
    const order = (modality, request) => s.call(midwife, 'POST', '/api/paraclinic/orders', { patientKey: key, modality, request, chargeMode: 'PAID', handoffMode: 'DIRECT' });
    const hbsag = await order('LAB', { items: [{ code: 'HBSAG' }] });
    assert.equal(hbsag.status, 201, JSON.stringify(hbsag.body));
    assert.equal(hbsag.body.cashierPaymentRequired, true, 'paid at the Cashier first');
    assert.equal((await order('LAB', { items: [{ code: 'CBC' }] })).status, 403, 'not other lab tests');
    assert.equal((await order('LAB', { items: [{ code: 'HBSAG' }, { code: 'HIV' }] })).status, 403);
    assert.equal((await order('XRAY', {})).status, 403, 'not other imaging');
    const us = await order('ULTRASOUND', { clinicalInfo: 'ANC' });
    assert.equal(us.status, 201, JSON.stringify(us.body));
    const { pregnancy } = (await s.call(midwife, 'POST', '/api/anc/record/open', { patientKey: key })).body;
    const iron = { name: 'AA0210-Ferrous salt + folic acid-Tablet-equivalent to 60 mg elemental iron + 400 micrograms folic acid NB', unit: 'គ្រាប់', route: 'po', doseAmount: '1', scheduleType: 'qd_m', d: '30', total: '30' };
    const refused = await s.call(midwife, 'POST', `/api/anc/record/${pregnancy.id}/prescription`, { patientKey: key, medications: [iron, { ...iron, name: 'AA0411-Paracetamol-Tablet-500 mg' }] });
    assert.equal(refused.status, 403);
    const sent = await s.call(midwife, 'POST', `/api/anc/record/${pregnancy.id}/prescription`, { patientKey: key, medications: [iron] });
    assert.equal(sent.status, 200, JSON.stringify(sent.body));
    const pharmacy = await s.call(s.staff.pharmacy, 'GET', '/api/pharmacy/opd-prescriptions');
    assert.ok(JSON.stringify(pharmacy.body).includes('H-V426-ORD-1'), 'Pharmacy receives it');
    // Patients of the OPD doctor are not the midwife's.
    const { key: other } = await s.visit('V426-OPD-1', 'opd');
    await s.pay(other);
    assert.equal((await s.call(midwife, 'GET', `/api/anc/record?patientKey=${encodeURIComponent(other)}`)).status, 403);
  } finally { await s.close(); }
});

// ---------------------------------------------------------------- vaccination, cervical screening
test('vaccination deducts stock, warns on the same dose, and the tetanus vaccine appears in the ANC record', async () => {
  const s = await startServer();
  try {
    const midwife = s.staff.nurse_obstetric;
    addStockItem(s.app.database, 'medicine', { name: 'Tetanus toxoid vaccine', unit: 'mL', quantity: 10 }, 'pharmacist');
    const { key: ancKey } = await s.visit('V426-TT-1', 'anc');
    await s.pay(ancKey);
    const { pregnancy } = (await s.call(midwife, 'POST', '/api/anc/record/open', { patientKey: ancKey })).body;
    const vaccines = (await s.call(midwife, 'GET', `/api/vaccinations?patientKey=${encodeURIComponent(ancKey)}`)).body.vaccines;
    assert.equal(vaccines.length, 11, 'vaccine lines of the medicine list');
    const tt = vaccines.find((item) => item.name === 'Tetanus toxoid vaccine');
    const dose = { patientKey: ancKey, vaccineId: tt.id, doseNumber: 1, givenDate: s.today, batchNumber: 'SYN-1', injectionSite: 'left arm', nextAppointment: anc.addDays(s.today, 28), reaction: '' };
    const given = await s.call(midwife, 'POST', '/api/vaccinations', dose);
    assert.equal(given.status, 201, JSON.stringify(given.body));
    assert.equal(given.body.pregnancyId, pregnancy.id, 'linked to the open pregnancy');
    assert.equal(listStock(s.app.database, 'medicine').find((item) => item.name === 'Tetanus toxoid vaccine').balance, 9.5, '0.5 mL deducted');
    const movement = s.app.database.sqlite.prepare("SELECT source FROM stock_movements WHERE source LIKE 'VACCINATION:%'").get();
    assert.equal(movement.source, `VACCINATION:${given.body.vaccination.id}`, 'stock movement reference = the vaccination id');
    const again = await s.call(midwife, 'POST', '/api/vaccinations', dose);
    assert.equal(again.status, 409);
    assert.equal(again.body.duplicate, true, 'same vaccine and dose number: warning');
    assert.equal((await s.call(midwife, 'POST', '/api/vaccinations', { ...dose, confirmDuplicate: true })).status, 201, 'given again after the warning');
    const record = await s.call(midwife, 'GET', `/api/anc/record?patientKey=${encodeURIComponent(ancKey)}`);
    assert.equal(record.body.vaccinations.length, 2, 'TT in the ANC record (visit table Vaccination)');
    assert.equal(record.body.vaccinations[0].doseNumber, 1);
    // A free vaccination patient (child) and the history by Health ID.
    const { key: child } = await s.visit('V426-VAC-2', 'vaccination', { sex: 'ប្រុស', age: '1' });
    const bcg = vaccines.find((item) => item.name === 'BCG');
    assert.equal((await s.call(midwife, 'POST', '/api/vaccinations', { patientKey: child, vaccineId: bcg.id, doseNumber: 1 })).status, 201);
    assert.equal((await s.call(midwife, 'GET', `/api/vaccinations?patientKey=${encodeURIComponent(child)}`)).body.history.length, 1);
    assert.equal((await s.call(s.staff.doctor_opd, 'POST', '/api/vaccinations', { patientKey: child, vaccineId: bcg.id, doseNumber: 2 })).status, 403, 'only the midwife');
  } finally { await s.close(); }
});

test('cervical screening result creates a message for the Gynecology doctors; their acknowledgement completes it', async () => {
  const s = await startServer();
  try {
    const { key } = await s.visit('V426-CX-1', 'cervix-screening', { age: '35' });
    await s.pay(key);
    const page = await fetch(`${s.origin}/emr?patient=${encodeURIComponent(key)}&view=opd`, { headers: { Cookie: s.staff.nurse_obstetric.Cookie }, redirect: 'manual' });
    assert.equal(page.status, 200, 'the midwife opens the OPD form of the service');
    const sent = await s.call(s.staff.nurse_obstetric, 'POST', '/api/maternal/cervix-result', { patientKey: key, result: 'VIA positive', note: 'Synthetic' });
    assert.equal(sent.status, 201, JSON.stringify(sent.body));
    const message = s.app.database.sqlite.prepare('SELECT * FROM staff_messages WHERE id=?').get(sent.body.messageId);
    assert.deepEqual([message.destination_type, message.destination_code, message.destination_role, message.patient_key], ['WARD', 'gynecology', 'DOCTOR', key]);
    assert.match(message.body, /VIA positive/);
    assert.match(message.body, new RegExp(`/emr\\?patient=${encodeURIComponent(key).replace(/[%]/g, '%')}`));
    const inbox = await s.call(s.staff.doctor_gynecology, 'GET', '/api/messages');
    assert.ok(JSON.stringify(inbox.body).includes(sent.body.messageId), "in the Gynecology doctors' inbox");
    assert.equal((await s.call(s.staff.doctor_opd, 'POST', '/api/maternal/cervix-result', { patientKey: key, result: 'x' })).status, 403);
  } finally { await s.close(); }
});

test('pages, menus and the old ANC form', async () => {
  const nav = read('public/nav-config.js');
  assert.match(nav, /id: 'maternal-queue', group: 'care', href: '\/maternal', icon: 'icon-heart-pulse', label: 'បញ្ជីអ្នកជំងឺសេវាមាតា', labelEn: 'Maternal services queue', access: \['MIDWIFE'\]/);
  assert.match(nav, /id: 'gynecology-outpatients'.*access: \['DOCTOR@gynecology', 'CHIEF_WARD@gynecology'\]/);
  const access = read('server/access.mjs');
  assert.match(access, /if \(pathname === '\/maternal'\) return \['MIDWIFE','DOCTOR','CHIEF_WARD'\]\.includes\(role\);/);
  const emr = read('public/maternal-emr.js');
  assert.match(emr, /panel\.inert = true;/, 'the old ANC form is read-only; its saved values stay');
  assert.match(read('protected/EMR.html'), /<option value="vaccination" data-key="opt_vaccination">ចាក់វ៉ាក់សាំង<\/option>/);
  assert.match(read('public/anc-referral-letter.mjs'), /export function referralLetterHtml\(/, 'the referral layout is one replaceable function');
  const s = await startServer();
  try {
    for (const [user, path, expected] of [['nurse_obstetric', '/maternal', 200], ['nurse_obstetric', '/anc-record?patient=x', 200], ['nurse_obstetric', '/vaccination?patient=x', 200],
      ['registration', '/maternal', 403], ['pharmacy', '/anc-record', 403]]) {
      const response = await fetch(s.origin + path, { headers: { Cookie: s.staff[user]?.Cookie || (await (async () => '')()) }, redirect: 'manual' });
      assert.equal(response.status, expected, `${user} ${path}`);
    }
    for (const file of ['anc-engine.mjs', 'anc-record.js', 'anc-record.css', 'anc-referral-letter.mjs', 'maternal.js', 'maternal.css', 'vaccination.js', 'maternal-emr.js']) {
      assert.equal((await fetch(`${s.origin}/public/${file}`)).status, 200, file);
    }
    const config = await s.call(s.staff.nurse_obstetric, 'GET', '/api/maternal/config');
    assert.equal(config.body.chart.sections.length, 4);
    assert.ok(config.body.midwifeMedicines.every((item) => ['Ferrous salt', 'Ferrous salt + folic acid', 'Folic acid', 'Mebendazole', 'Calcium'].includes(item.name)));
    assert.equal(config.body.labels.title, 'កំណត់ត្រាការពិនិត្យផ្ទៃពោះមុនសម្រាល');
  } finally { await s.close(); }
});
