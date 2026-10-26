// v47.8 - ANC orders (Laboratory, Imaging, ask a doctor) are sent once per
// visit; the page shows a notice and a "sent" note. Synthetic patients, in-memory database.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { opdLocalDate } from '../server/opd-queue.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

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
  for (const name of ['registration', 'triage', 'clerk', 'nurse_obstetric']) staff[name] = await login(name);
  const today = opdLocalDate();
  const caseNumber = 'V478-1', key = `case:${caseNumber}`;
  const summary = { caseNumber, healthId: 'H-V478-1', firstName: 'Synthetic', lastName: caseNumber, fullName: `Synthetic ${caseNumber}`, sex: '\u179f\u17d2\u179a\u17b8', age: '25', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'CASH', departmentCode: '', departmentNameKh: '', departmentNameEn: '', serviceMode: '', entryDate: today, dischargeDate: '' };
  assert.equal((await call(staff.registration, 'PUT', '/api/patient-record', { patientKey: key, summary, data: { 'scope:registration:id:emr_pmrs_case_new': true } })).status, 200);
  const version = (await call(staff.registration, 'GET', `/api/patient-record?patientKey=${encodeURIComponent(key)}`)).body.patient.version;
  const vitals = { p2_weight: '55', p2_height: '158', p2_bp_sys: '110', p2_bp_dia: '70', p2_pulse: '80', p2_temp: '36.8', p2_spo2: '98', p2_resp: '18' };
  assert.equal((await call(staff.triage, 'PUT', '/api/patient-record', { patientKey: key, expectedVersion: version, triageSave: true,
    summary: { ...summary, departmentCode: 'anc', departmentNameKh: 'anc', departmentNameEn: 'anc', serviceMode: 'opd' },
    data: Object.fromEntries(Object.entries(vitals).map(([k, v]) => [`scope:triage:id:${k}`, v])) })).status, 200);
  const bill = (await call(staff.clerk, 'GET', `/api/finance/patient?patientKey=${encodeURIComponent(key)}`)).body.bill;
  assert.equal((await call(staff.clerk, 'POST', '/api/finance/payments', { patientKey: key, invoiceId: bill.invoice.id, source: 'CASH', amount: bill.summary.KHR.balance, currency: 'KHR' })).status, 201);
  const db = app.database.sqlite;
  db.prepare(`INSERT INTO finance_service_catalog (id,code,category_code,name_kh,name_en,default_amount_minor,currency,active,sort_order,created_at,updated_at,department_code,unit_label)
    SELECT 'v478-hbsag-fee','HBSAG',category_code,name_kh,'HBsAg',10000,'KHR',1,999,created_at,updated_at,'lab',unit_label FROM finance_service_catalog WHERE code='LAB_SERVICE'`).run();
  db.prepare("UPDATE finance_service_catalog SET default_amount_minor=20000, currency='KHR', active=1 WHERE code='ULTRASOUND'").run();
  const close = async () => { await new Promise((resolve) => app.server.close(resolve)); app.database.close(); };
  return { app, db, call, midwife: staff.nurse_obstetric, key, close };
}

test('each ANC order is sent once per visit; the record lists what was sent', async () => {
  const s = await startServer();
  try {
    const order = (modality, request) => s.call(s.midwife, 'POST', '/api/paraclinic/orders', { patientKey: s.key, modality, request, chargeMode: 'PAID', handoffMode: 'DIRECT' });
    const ask = (test) => s.call(s.midwife, 'POST', '/api/maternal/ask-doctor', { patientKey: s.key, test });
    assert.equal((await s.call(s.midwife, 'POST', '/api/anc/record/open', { patientKey: s.key })).status, 201);

    assert.equal((await order('LAB', { items: [{ code: 'HBSAG' }] })).status, 201);
    const again = await order('LAB', { items: [{ code: 'HBSAG' }] });
    assert.equal(again.status, 409);
    assert.equal(again.body.code, 'ALREADY_SENT');
    assert.equal((await order('ULTRASOUND', { clinicalInfo: 'ANC' })).status, 201);
    assert.equal((await order('ULTRASOUND', { clinicalInfo: 'ANC' })).body.code, 'ALREADY_SENT');
    assert.equal((await ask('OGTT')).status, 201);
    const askAgain = await ask('ogtt');
    assert.equal(askAgain.status, 409, 'the same test in lower case is the same request');
    assert.equal(askAgain.body.code, 'ALREADY_SENT');
    assert.equal((await ask('HBSAG')).status, 409, 'HBsAg is already ordered and waiting');
    assert.equal((await ask('CBC')).status, 201, 'another test is still possible');

    const record = (await s.call(s.midwife, 'GET', `/api/anc/record?patientKey=${encodeURIComponent(s.key)}`)).body;
    const sent = Object.fromEntries(record.sentOrders.map((item) => [`${item.kind}:${item.code}`, item]));
    assert.equal(sent['lab:HBSAG'].pending, true);
    assert.equal(sent['imaging:ULTRASOUND'].date, record.today);
    assert.ok(sent['doctor:OGTT'] && sent['doctor:CBC']);

    // Next visit: a released order and yesterday's doctor request no longer block;
    // an ultrasound still waiting for its result does.
    const twoDaysAgo = Date.now() - 2 * 86400000;
    s.db.prepare("UPDATE paraclinic_orders SET created_at=?, released_at=? WHERE modality='LAB'").run(twoDaysAgo, twoDaysAgo + 3600000);
    s.db.prepare("UPDATE paraclinic_orders SET created_at=? WHERE modality='ULTRASOUND'").run(twoDaysAgo);
    s.db.prepare("UPDATE staff_messages SET created_at=? WHERE subject LIKE 'ANC · %'").run(twoDaysAgo);
    // (A new visit is a new encounter; the Laboratory itself refuses the same test twice in one encounter.)
    const later = (await s.call(s.midwife, 'GET', `/api/anc/record?patientKey=${encodeURIComponent(s.key)}`)).body.sentOrders;
    assert.equal(later.some((item) => item.code === 'HBSAG'), false, 'a released HBsAg of an earlier day no longer blocks');
    assert.equal((await order('ULTRASOUND', { clinicalInfo: 'ANC' })).body.code, 'ALREADY_SENT', 'still waiting for the earlier ultrasound');
    assert.equal((await ask('OGTT')).status, 201, 'a new visit can ask again');
  } finally { await s.close(); }
});

test('page: the button becomes a note, a notice is shown and kept, orders by doctors are not limited', () => {
  const page = read('public/anc-record.js');
  assert.match(page, /if \(sent\) return `<span class="anc-order-sent no-print" data-sent=/);
  assert.match(page, /t\('anc\.sentToday', 'Sent today'\)/);
  assert.match(page, /t\('anc\.waitingResult', 'Waiting for the result'\)/);
  assert.match(page, /if \(typeof result === 'string'\) \{ setStatus\(result\); showToast\(result\); \}/);
  assert.match(page, /error\.body\?\.code !== 'ALREADY_SENT'/);
  assert.match(page, /button\.disabled = true;\n\s+return run\(\(\) => sendOnce\(code, code === 'ULTRASOUND' \? 'imaging' : 'lab'/);
  const route = read('server/routes/paraclinic.mjs');
  const midwifeBlock = route.slice(route.indexOf("if (role === 'MIDWIFE') {"), route.indexOf('if (!canAccessPatient(database, session, patient)'));
  assert.match(midwifeBlock, /ancOrderAlreadySent\(database, patient, requested\)/, 'the limit is inside the midwife branch only');
  assert.match(read('server/routes/maternal.mjs'), /sentOrders: ancSentOrders\(ctx\.database, row, today\)/);
  assert.match(read('public/new-text-data.js'), /"anc\.alreadySent": "\u1794\u17b6\u1793\u1794\u1789\u17d2\u1787\u17bc\u1793\u179a\u17bd\u1785\u17a0\u17be\u1799\u17d4"/);
});
