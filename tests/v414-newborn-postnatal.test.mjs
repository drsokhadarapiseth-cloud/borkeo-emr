// v41.4 - Newborn record (one section per baby, prefilled from the delivery form,
// on the mother's record) and postnatal care record; the delivery, ANC and
// labour chart forms are unchanged.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';
import { clinicalOptions } from '../server/clinical-summary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const port = 34414;
const origin = `http://127.0.0.1:${port}`;
const password = 'Newborn record test password 414';

test('v41.4 newborn and postnatal records are saved on the mother, one per date, with midwife signatures', async () => {
  const app = createEmrServer({ demoMode: false, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
    const id = crypto.randomUUID();
    app.database.createUser({ id, username: 'midwife414', displayName: 'midwife414', role: 'MIDWIFE', passwordHash: await hashPassword(password), createdAt: Date.now() });
    setUserAccess(app.database, id, ['MIDWIFE'], ['obstetric']);
    app.database.upsertPatient({
      id: crypto.randomUUID(), patientKey: 'case:V414', userId: id, savedAt: Date.now(),
      summary: { caseNumber: 'V414', healthId: '', firstName: 'Synthetic', lastName: 'Mother', fullName: 'Synthetic Mother', sex: 'Female', age: '25', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'EXEMPT', departmentCode: 'obstetric', departmentNameKh: '', departmentNameEn: 'Obstetric', serviceMode: 'ipd', entryDate: '2026-10-20', dischargeDate: '' },
      data: {},
    });
    const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'midwife414', password }) });
    const cookie = login.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookie } })).json();
    const headers = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
    const post = (p, body) => fetch(origin + p, { method: 'POST', headers, body: JSON.stringify(body) });

    const twins = { babyCount: '2', 'b1.outcome': 'live', 'b1.apgar1': 8, 'b1.birthWeight': 2600, 'b2.outcome': 'live', 'b2.apgar1': 7, 'b1.newborn.drying': true, 'b1.vaccine.bcg': '2026-10-21' };
    let result = await (await post('/api/periop-forms', { patientKey: 'case:V414', formType: 'newbornRecord', formDate: '2026-10-21', data: twins })).json();
    const newborn = result.forms.find((f) => f.formType === 'newbornRecord');
    assert.deepEqual([newborn.data['b2.apgar1'], newborn.data['b1.newborn.drying'], newborn.patientSign], [7, true, {}]);
    assert.deepEqual(result.newbornCare.length, 6);
    assert.deepEqual(result.birthVaccines, ['vaccine.bcg', 'vaccine.hepB0']);
    result = await (await post(`/api/periop-forms/${newborn.id}/sign`, { patientKey: 'case:V414', slot: 'midwife' })).json();
    assert.ok(result.forms.find((f) => f.id === newborn.id).signatures.midwife);
    assert.equal((await post(`/api/periop-forms/${newborn.id}/sign`, { patientKey: 'case:V414', slot: 'surgeon' })).status, 400);
    result = await (await post('/api/periop-forms', { patientKey: 'case:V414', formType: 'postnatalCare', formDate: '2026-10-22', data: { dayAfterBirth: 1, lochia: 'Normal' } })).json();
    assert.ok(result.forms.some((f) => f.formType === 'postnatalCare' && f.data.lochia === 'Normal'));
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
  }
});

test('newborn prefill reads the delivery form by its place and maps its Khmer values', () => {
  const source = read('public/periop-forms.js');
  const start = source.indexOf('  function fromDelivery() {');
  const end = source.indexOf('  let prefilled = false;');
  const input = (type, value) => ({ type, value });
  const section = (inputs, selects = []) => ({
    querySelector: (sel) => inputs.find((i) => sel.includes(i.type)) || null,
    querySelectorAll: (sel) => (sel === 'select' ? selects : inputs.filter((i) => sel.includes(`"${i.type}"`))),
  });
  const sections = [section([]), section([]),
    section([input('datetime-local', '2026-10-21T08:30'), input('number', '38'), input('number', '2')]),
    section([input('number', '3100'), input('number', '44')], [{ value: 'កើតរស់' }, { value: 'ស្រី' }])];
  const document = { getElementById: () => ({ querySelectorAll: () => sections }) };
  const context = vm.createContext({ document });
  vm.runInContext(source.slice(start, end), context);
  assert.deepEqual(JSON.parse(JSON.stringify(context.fromDelivery())), {
    babyCount: '2', 'b1.birthAt': '2026-10-21T08:30', 'b2.birthAt': '2026-10-21T08:30', 'b3.birthAt': '2026-10-21T08:30',
    'b1.outcome': 'live', 'b1.babySex': 'female', 'b1.birthWeight': 3100,
  });
});

test('newborn care items and birth vaccines are configurable; existing maternity forms are unchanged', () => {
  const options = clinicalOptions();
  assert.equal(options.newbornCare.length, 6);
  assert.deepEqual(options.birthVaccines, ['vaccine.bcg', 'vaccine.hepB0']);
  // Nothing of Phase 8 is written inside the ANC and delivery forms (the newborn button is added by script).
  const html = read('protected/EMR.html');
  const block = (id, next) => html.slice(html.indexOf(`<div id="${id}"`), html.indexOf(next, html.indexOf(`<div id="${id}"`)));
  for (const [id, next] of [['sub_anc', '<div id="sub_delivery"'], ['sub_delivery', '<div id="sub_partograph"']]) {
    assert.doesNotMatch(block(id, next), /periop|newborn/i, id);
  }
  const source = read('public/periop-forms.js');
  assert.match(source, /newbornRecord: \{ en: 'Newborn record', kh: 'កំណត់ត្រាទារកទើបនឹងកើត'/);
  assert.match(source, /postnatalCare: \{ en: 'Postnatal care record', kh: 'កំណត់ត្រាថែទាំក្រោយសម្រាល'/);
  assert.match(source, /const bar = document\.querySelector\('#sub_delivery > \.action-bar'\);/);
});
