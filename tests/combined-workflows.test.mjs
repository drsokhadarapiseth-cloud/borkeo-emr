import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';
import { opdLocalDate } from '../server/opd-queue.mjs';

async function fixture() {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', nodeEnv: 'test', host: '127.0.0.1', port: 0, npca: { enabled: false } });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`; app.config.appOrigin = origin;
  const login = async username => {
    const r = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify({ username }) });
    const Cookie = r.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie } })).json();
    return { Cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
  };
  const call = async (headers, method, route, body) => {
    const response = await fetch(origin + route, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  };
  const headers = {};
  for (const name of ['registration', 'triage', 'doctor_opd', 'doctor_medicine', 'nurse_obstetric', 'clerk']) headers[name] = await login(name);
  const summary = (name, departmentCode = '', serviceMode = '') => ({ caseNumber: name, healthId: `SYNTHETIC-${name}`, firstName: 'Synthetic', lastName: name, fullName: `Synthetic ${name}`, sex: 'Female', age: '25', dateOfBirth: '2001-01-01', phone: '', equityCard: '', paymentType: 'CASH', departmentCode, departmentNameKh: '', departmentNameEn: '', serviceMode, entryDate: opdLocalDate(), dischargeDate: '' });
  return { app, call, headers, summary, close: async () => { await new Promise(resolve => app.server.close(resolve)); app.database.close(); } };
}

test('Registration Save stays out of the triage queue until explicit transfer; OPD routes differ by paraclinic', async () => {
  const f = await fixture();
  try {
    for (const para of [false, true]) {
      const name = `REGISTER-${para}`, patientKey = `case:${name}`, summary = f.summary(name);
      let r = await f.call(f.headers.registration, 'PUT', '/api/patient-record', { patientKey, summary, registrationOnly: true, data: { 'scope:registration:id:emr_pmrs_case_new': true, 'scope:triage:id:p2_temp': '99' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.patient.workflowStage, 'REGISTRATION_SAVED');
      assert.equal(JSON.parse(f.app.database.findPatient(patientKey).record_json)['scope:triage:id:p2_temp'], undefined, 'registration-only does not write triage');
      const queue = await f.call(f.headers.triage, 'GET', '/api/triage/queue');
      assert.equal(queue.body.waiting.some(row => row.patientKey === patientKey), false);
      r = await f.call(f.headers.registration, 'PUT', '/api/patient-record', { patientKey, summary, transferToTriage: true, expectedVersion: r.body.patient.version, data: {} });
      assert.equal(r.status, 200); assert.equal(r.body.patient.data['system:triageStatus'], 'WAITING');
      r = await f.call(f.headers.triage, 'PUT', '/api/patient-record', { patientKey, summary: { ...summary, departmentCode: 'opd', serviceMode: 'opd' }, triageSave: true, expectedVersion: r.body.patient.version,
        data: { 'scope:triage:id:triage_paraclinic': para, 'scope:triage:id:p2_temp': '37', 'scope:triage:id:p2_weight': '55' } });
      assert.equal(r.status, 200, JSON.stringify(r.body));
      assert.equal(r.body.patient.workflowStage, para ? 'OPD_PARACLINIC_ORDERING' : 'CASHIER_PENDING_OPD');
      const stored = JSON.parse(f.app.database.findPatient(patientKey).record_json);
      assert.equal(Boolean(stored['system:cashierQueueRequest']), !para);
    }
  } finally { await f.close(); }
});

test('authorized OPD shared edits and explicit clears update only the current encounter', async () => {
  const f = await fixture();
  try {
    const userId = f.app.database.findUser('registration').id;
    const summary = f.summary('SHARED', 'opd', 'opd');
    await f.call(f.headers.registration, 'PUT', '/api/patient-record', { patientKey: 'case:SHARED', summary: { ...summary, departmentCode: '', serviceMode: '' }, data: { 'scope:registration:id:emr_pmrs_case_new': true } });
    let current = (await f.call(f.headers.registration, 'GET', '/api/patient-record?patientKey=case%3ASHARED')).body.patient;
    await f.call(f.headers.triage, 'PUT', '/api/patient-record', { patientKey: 'case:SHARED', summary, triageSave: true, expectedVersion: current.version, data: { 'scope:triage:id:p2_temp': '37', 'scope:triage:id:pmrs_chief_complaint': 'Synthetic complaint' } });
    const bill = (await f.call(f.headers.clerk, 'GET', '/api/finance/patient?patientKey=case%3ASHARED')).body.bill;
    const payment = await f.call(f.headers.clerk, 'POST', '/api/finance/payments', { patientKey: 'case:SHARED', invoiceId: bill.invoice.id, source: 'CASH', amount: bill.summary.KHR.balance, currency: 'KHR' });
    assert.equal(payment.status, 201, JSON.stringify(payment.body));
    for (const key of ['case:PREVIOUS']) f.app.database.upsertPatient({ id: crypto.randomUUID(), patientKey: key, userId, savedAt: Date.now(), summary: { ...summary, caseNumber: key.slice(5), paymentType: 'EXEMPT' }, data: {
      'system:triageStatus': 'COMPLETED', 'system:workflowStage': 'DOCTOR_READY', 'system:opdConsultationPaidAt': Date.now(),
      'scope:triage:id:p2_temp': '37', 'scope:triage:id:pmrs_chief_complaint': 'Synthetic complaint',
    } });
    const previous = f.app.database.findPatient('case:PREVIOUS').record_json;
    const patient = (await f.call(f.headers.doctor_opd, 'GET', '/api/patient-record?patientKey=case%3ASHARED')).body.patient;
    const body = { patientKey: 'case:SHARED', summary, editorScope: 'medical', clinicalSubTab: 'opd', expectedVersion: patient.version, data: {}, sharedTriage: { p2_temp: '38.2', pmrs_chief_complaint: '', pmrs_chief_complaint_items: '[]' } };
    const r = await f.call(f.headers.doctor_opd, 'PUT', '/api/patient-record', body);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.patient.data['scope:triage:id:p2_temp'], '38.2');
    assert.equal(r.body.patient.data['scope:triage:id:pmrs_chief_complaint'], '');
    assert.equal(f.app.database.findPatient('case:PREVIOUS').record_json, previous);
    assert.equal((await f.call(f.headers.doctor_opd, 'PUT', '/api/patient-record', body)).status, 409);
    assert.equal((await f.call(f.headers.triage, 'PUT', '/api/patient-record', { ...body, expectedVersion: r.body.patient.version })).status, 403);
    assert.equal((await f.call(f.headers.doctor_medicine, 'PUT', '/api/patient-record', { ...body, expectedVersion: r.body.patient.version })).status, 403);
    assert.equal((await f.call(f.headers.doctor_opd, 'PUT', '/api/patient-record', { ...body, expectedVersion: r.body.patient.version, sharedTriage: { p2_ward: 'surgery' } })).status, 400);
  } finally { await f.close(); }
});

test('unified ANC save is atomic, preserves old fields and rejects another patient pregnancy', async () => {
  const f = await fixture();
  try {
    const userId = f.app.database.findUser('registration').id;
    for (const name of ['ANC-A', 'ANC-B']) f.app.database.upsertPatient({ id: crypto.randomUUID(), patientKey: `case:${name}`, userId, savedAt: Date.now(), summary: f.summary(name, 'anc', 'opd'),
      data: { 'scope:medical:auto:36': `Legacy ${name}`, 'scope:medical:auto:38': '2', 'scope:medical:auto:40': '2026-01-01', 'system:triageStatus': 'COMPLETED' } });
    const old = f.app.database.findPatient('case:ANC-A').record_json;
    let r = await f.call(f.headers.nurse_obstetric, 'GET', '/api/anc/record?patientKey=case%3AANC-A');
    assert.ok(r.body.legacyAnc.entries.some(entry => entry.value === 'Legacy ANC-A'));
    const opened = await f.call(f.headers.nurse_obstetric, 'POST', '/api/anc/record/open', { patientKey: 'case:ANC-A' });
    const pregnancy = opened.body.pregnancy;
    assert.equal(pregnancy.record.lmp, undefined, 'no automatic legacy clinical migration');
    const route = `/api/anc/record/${pregnancy.id}/save-all`;
    const incomplete = { patientKey: 'case:ANC-A', expectedVersion: pregnancy.version, record: { ...pregnancy.record, lmp: '2026-08-01' }, visit: {} };
    r = await f.call(f.headers.nurse_obstetric, 'POST', route, incomplete);
    assert.equal(r.status, 400); assert.ok(r.body.missing.length);
    assert.equal(f.app.database.sqlite.prepare('SELECT COUNT(*) n FROM anc_visits').get().n, 0);
    const body = { ...incomplete, record: { ...incomplete.record, identity: { ...pregnancy.record.identity, gravida:'1' }, heightCm:'160' }, visit: { weight:'55', bp:'110/70', pulse:'80', temperature:'37', spo2:'98', complaint:'Synthetic', fer:'0', legacyDetails: { '32':'Synthetic new', '34':'Synthetic none', '37':'Z36.4.0', '41':'1', '43':'1', '44':'TT2', '49':'Synthetic unknown', '51':'Synthetic counselling' } } };
    r = await f.call(f.headers.nurse_obstetric, 'POST', route, body);
    assert.equal(r.status, 200, JSON.stringify(r.body));
    assert.equal(r.body.visits[0].legacyDetails['43'], '1');
    assert.equal(f.app.database.findPatient('case:ANC-A').record_json, old);
    assert.equal((await f.call(f.headers.nurse_obstetric, 'POST', route, { ...body, patientKey: 'case:ANC-B', expectedVersion: r.body.pregnancy.version })).status, 403);
    const before = f.app.database.sqlite.prepare('SELECT record_json,version FROM anc_pregnancies WHERE id=?').get(pregnancy.id);
    const bad = await f.call(f.headers.nurse_obstetric, 'POST', route, { ...body, expectedVersion: r.body.pregnancy.version, visit: { ...body.visit, legacyDetails: { ...body.visit.legacyDetails, unknown: 'bad' } } });
    assert.equal(bad.status, 400);
    assert.deepEqual(f.app.database.sqlite.prepare('SELECT record_json,version FROM anc_pregnancies WHERE id=?').get(pregnancy.id), before, 'failed visit rolls back pregnancy edit');
    assert.equal((await f.call(f.headers.triage, 'GET', '/api/anc/record?patientKey=case%3AANC-A')).status, 403);
    await f.call(f.headers.nurse_obstetric, 'POST', `/api/anc/record/${pregnancy.id}/close`, { patientKey: 'case:ANC-A', status: 'delivered' });
    f.app.database.upsertPatient({ id: crypto.randomUUID(), patientKey: 'case:ANC-NEW', userId, savedAt: Date.now(), summary: { ...f.summary('ANC-NEW', 'anc', 'opd'), healthId: f.summary('ANC-A').healthId }, data: {} });
    const next = await f.call(f.headers.nurse_obstetric, 'POST', '/api/anc/record/open', { patientKey: 'case:ANC-NEW' });
    assert.equal(next.status, 201);
    assert.notEqual(next.body.pregnancy.id, pregnancy.id);
    const historical = await f.call(f.headers.nurse_obstetric, 'GET', '/api/anc/record?patientKey=case%3AANC-A');
    assert.equal(historical.body.pregnancy.id, pregnancy.id, 'old encounter retains its pregnancy after a new one opens');
    assert.equal(historical.body.pregnancy.status, 'delivered');
  } finally { await f.close(); }
});
