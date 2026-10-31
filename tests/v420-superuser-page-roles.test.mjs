import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import vm from 'node:vm';
import { createEmrServer } from '../server/server.mjs';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

function loadNavConfig() {
  const context = vm.createContext({ URL, URLSearchParams });
  vm.runInContext(read('public/nav-config.js'), context);
  return context.EmrNavConfig;
}

// v42.1: the Superuser is always exactly one real staff user type, chosen with
// the picker or the switch button. While switched it gets the same menu, pages,
// refusals and message bell as a real account of that type. Opening a page
// never changes the user type (this replaces the v42.0 automatic page roles).
const TYPES = [
  { role: 'REGISTRATION', ward: '', user: 'registration', landing: '/emr?view=register' },
  { role: 'TRIAGE', ward: '', user: 'triage', landing: '/triage' },
  { role: 'DOCTOR', ward: 'opd', user: 'doctor_opd', landing: '/home' },
  { role: 'DOCTOR', ward: 'medicine', user: 'doctor_medicine', landing: '/home' },
  { role: 'NURSE', ward: 'opd', user: 'nurse_opd', landing: '/opd-paraclinic-nurse' },
  { role: 'NURSE', ward: 'medicine', user: 'nurse_medicine', landing: '/departments' },
  { role: 'MIDWIFE', ward: 'obstetric', user: 'nurse_obstetric', landing: '/departments' },
  { role: 'LAB', ward: '', user: 'lab', landing: '/lab' },
  { role: 'IMAGING', ward: '', user: 'imaging', landing: '/imaging' },
  { role: 'PHARMACY', ward: '', user: 'pharmacy', landing: '/home' },
  { role: 'CLERK', ward: '', user: 'clerk', landing: '/billing' },
  { role: 'ACCOUNTANT', ward: '', user: 'accountant', landing: '/billing' },
  { role: 'DIRECTOR', ward: '', user: 'director', landing: '/home' },
  { role: 'ADMIN', ward: '', user: 'admin', landing: '/home' },
];

test('v42.1 Superuser switch user type: same menus, pages, refusals and bell as real staff', async () => {
  const port = 32421;
  const origin = `http://127.0.0.1:${port}`;
  const app = createEmrServer({ demoMode: true, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  const db = app.database;
  await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
  const nav = loadNavConfig();

  async function login(username) {
    const response = await fetch(`${origin}/api/auth/login`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }),
    });
    assert.equal(response.status, 200, username);
    const result = await response.json();
    const Cookie = response.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(`${origin}/api/auth/me`, { headers: { Cookie } })).json();
    return { result, headers: { Cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken } };
  }
  const get = (headers, pathname, dest = 'document') => fetch(`${origin}${pathname}`, { headers: { ...headers, 'Sec-Fetch-Dest': dest }, redirect: 'manual' });
  const json = async (headers, pathname) => (await get(headers, pathname, 'empty')).json();
  const post = (headers, pathname, body) => fetch(`${origin}${pathname}`, { method: 'POST', headers, body: JSON.stringify(body) });
  async function menu(headers) {
    const { user } = await json(headers, '/api/auth/me');
    const settings = (await json(headers, '/api/navigation-settings')).settings || {};
    return { user, items: [...nav.visibleItemIds(user, settings[user.activeRole])] };
  }
  const label = user => user.activeRole + (user.activeWard ? `@${user.activeWard.code}` : '');

  try {
    // After login the Superuser has no user type and goes to the picker.
    const superuser = await login('Superuser');
    assert.equal(superuser.result.needsContext, true);
    assert.equal(superuser.result.user.isSuperuser, true);
    assert.equal(superuser.result.user.activeRole, '');
    const su = superuser.headers;
    assert.equal((await get(su, '/home')).headers.get('location'), '/context');
    assert.equal((await get(su, '/context')).status, 200);
    assert.deepEqual((await menu(su)).items, [], 'no user type, no menu');
    const { user: picker } = await json(su, '/api/auth/me');
    assert.equal(picker.roles.length, 15);
    assert.equal(picker.roles.includes('SUPERUSER'), false);

    async function switchTo(role, wardCode = '') {
      const response = await post(su, '/api/auth/context', { role, wardCode });
      assert.equal(response.status, 200, `${role}@${wardCode}`);
      return response.json();
    }

    // Every user type: the exact menu of a real account of that type, the
    // same landing page as a real login, and every menu button opens.
    for (const type of TYPES) {
      const switched = await switchTo(type.role, type.ward);
      assert.equal(switched.landingPath, type.landing, `${type.role}@${type.ward} landing page`);
      const real = await login(type.user);
      const mine = await menu(su);
      const theirs = await menu(real.headers);
      assert.equal(label(mine.user), label(theirs.user), type.user);
      assert.deepEqual(mine.items, theirs.items, `${label(mine.user)} menu equals ${type.user}`);
      assert.equal(mine.user.isSuperuser, true);
      assert.equal(theirs.user.isSuperuser, false, 'the switch button is only for the Superuser');
      if (type.role === 'REGISTRATION') assert.deepEqual(mine.items, ['pmrs', 'register', 'patient-list', 'appointments']);
      for (const id of mine.items) {
        const item = nav.ITEMS.find(entry => entry.id === id);
        assert.equal((await get(su, item.href)).status, 200, `${label(mine.user)} opens ${item.href}`);
      }
      assert.equal(label((await json(su, '/api/auth/me')).user), label(theirs.user), 'opening pages never changes the user type');
    }

    // As Registration: the same server refusals as a real Registration account.
    await switchTo('REGISTRATION');
    const registration = (await login('registration')).headers;
    for (const page of ['/lab', '/billing', '/finance']) {
      assert.equal((await get(su, page)).status, 403, `Superuser as Registration: ${page}`);
      assert.equal((await get(registration, page)).status, 403, `registration: ${page}`);
    }
    assert.equal(label((await json(su, '/api/auth/me')).user), 'REGISTRATION');

    // As a Medicine nurse a Surgery patient is refused, as for a real nurse.
    const admin = db.findUser('admin').id;
    const surgeryKey = 'case:V421-SURGERY';
    db.upsertPatient({
      id: crypto.randomUUID(), patientKey: surgeryKey, userId: admin, savedAt: Date.now(),
      summary: { caseNumber: 'V421-SURGERY', healthId: 'H421', firstName: 'Surgery', lastName: 'Patient', fullName: 'Surgery Patient', sex: 'ប្រុស', age: '40', dateOfBirth: '', phone: '012345678', equityCard: '', paymentType: 'DIRECT', departmentCode: 'surgery', departmentNameKh: 'ផ្នែកវះកាត់', departmentNameEn: 'Surgery', serviceMode: 'ipd', entryDate: '2026-10-22', dischargeDate: '' },
      data: {},
    });
    await switchTo('NURSE', 'medicine');
    const record = key => `/api/patient-record?patientKey=${encodeURIComponent(key)}`;
    assert.equal((await get(su, record(surgeryKey), 'empty')).status, 403);
    assert.equal((await get((await login('nurse_medicine')).headers, record(surgeryKey), 'empty')).status, 403);
    assert.equal((await get((await login('nurse_surgery')).headers, record(surgeryKey), 'empty')).status, 200);

    // The bell shows only the active team's messages; completing a task as
    // Laboratory completes it for the real Laboratory staff.
    await switchTo('DOCTOR', 'opd');
    const sent = await post(su, '/api/messages', { destinationType: 'LAB', destinationCode: '', subject: 'V421 lab task', body: 'Check the sample' });
    assert.equal(sent.status, 201);
    const messageId = (await sent.json()).message.id;
    const inbox = async headers => (await json(headers, '/api/messages')).messages.map(m => m.id);
    assert.equal((await inbox(su)).includes(messageId), false, 'the OPD doctor inbox has no Laboratory tasks');
    const lab = (await login('lab')).headers;
    assert.equal((await inbox(lab)).includes(messageId), true);
    await switchTo('REGISTRATION');
    assert.equal((await inbox(su)).includes(messageId), false);
    await switchTo('LAB');
    assert.equal((await inbox(su)).includes(messageId), true);
    assert.equal((await post(su, `/api/messages/${messageId}/complete`, {})).status, 200);
    assert.equal((await inbox(lab)).includes(messageId), false, 'completed for the real Laboratory staff');
    const done = (await json(lab, '/api/messages?state=completed')).messages.find(m => m.id === messageId);
    assert.equal(done.completedBy, superuser.result.user.id);

    // Every switch is audited.
    const audits = db.sqlite.prepare("SELECT details_json FROM audit_events WHERE action='WORK_CONTEXT_CHANGED' AND details_json LIKE '%switchedBy%'").all()
      .map(row => JSON.parse(row.details_json));
    assert.ok(audits.some(item => item.role === 'LAB' && item.wardCode === '' && item.switchedBy === 'Superuser'));
    assert.ok(audits.some(item => item.role === 'NURSE' && item.wardCode === 'medicine' && item.switchedBy === 'Superuser'));
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    db.close();
  }
});

test('v42.1 Triage to Infectious diseases: the ward doctor and nurse can open the patient', async () => {
  const port = 32422;
  const origin = `http://127.0.0.1:${port}`;
  const app = createEmrServer({ demoMode: true, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  const db = app.database;
  await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
  async function login(username) {
    const response = await fetch(`${origin}/api/auth/login`, {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }),
    });
    assert.equal(response.status, 200, username);
    const Cookie = response.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(`${origin}/api/auth/me`, { headers: { Cookie } })).json();
    return { Cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
  }
  const call = (headers, pathname, method = 'GET', body) => fetch(`${origin}${pathname}`, { method, headers, body: body ? JSON.stringify(body) : undefined });
  try {
    const su = await login('Superuser');
    const switchTo = async (role, wardCode = '') => assert.equal((await call(su, '/api/auth/context', 'POST', { role, wardCode })).status, 200);
    const patientKey = 'case:V421-INFECTIOUS';
    const summary = { caseNumber: 'V421-INFECTIOUS', healthId: 'H421-INF', fullName: 'Infectious Patient', sex: 'ស្រី', age: '35', phone: '012345678', departmentCode: '', serviceMode: '', entryDate: '2026-10-22' };

    await switchTo('REGISTRATION');
    const registered = await call(su, '/api/patient-record', 'PUT', {
      patientKey, editorScope: 'registration', summary, data: { 'scope:registration:id:emr_pmrs_case_new': true },
    });
    assert.equal(registered.status, 200, await registered.clone().text());

    await switchTo('TRIAGE');
    const triaged = await call(su, '/api/patient-record', 'PUT', {
      patientKey, editorScope: 'triage', triageSave: true,
      summary: { ...summary, departmentCode: 'infectious', departmentNameKh: 'ផ្នែកជំងឺឆ្លង', departmentNameEn: 'Infectious Diseases Ward', serviceMode: 'ipd' },
      data: { 'scope:triage:id:temp': '38.5' },
    });
    assert.equal(triaged.status, 200, await triaged.clone().text());
    const saved = db.findPatient(patientKey);
    assert.equal(saved.department_code, 'infectious');
    const data = JSON.parse(saved.record_json);
    assert.equal(data['system:triageReferredWardCode'], 'infectious');
    // Signatures saved while switched name the user type.
    assert.equal(JSON.parse(data['system:signature:triage']).signerName, `Superuser · ${'ផ្នែកទ្រីយ៉ា'}`);

    const record = `/api/patient-record?patientKey=${encodeURIComponent(patientKey)}`;
    for (const username of ['doctor_infectious', 'nurse_infectious']) {
      const headers = await login(username);
      assert.equal((await call(headers, record)).status, 200, username);
      const list = (await (await call(headers, '/api/patients?includePayment=1')).json()).patients;
      assert.equal(list.find(p => p.patientKey === patientKey)?.canOpenRecord, true, `${username} sees the patient in Wards and beds`);
      assert.equal((await call(headers, '/departments')).status, 200);
    }
    await switchTo('DOCTOR', 'infectious');
    assert.equal((await call(su, record)).status, 200, 'Superuser as Infectious ward doctor');
    await switchTo('NURSE', 'infectious');
    assert.equal((await call(su, record)).status, 200, 'Superuser as Infectious ward nurse');
    assert.equal((await call(await login('doctor_medicine'), record)).status, 403, 'other wards stay refused');

    // Ward medicines and the daily report include the ward.
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(new Date());
    const medicines = await call(await login('nurse_infectious'), `/api/reports/ward-medicines?ward=infectious&date=${today}`);
    assert.equal(medicines.status, 200, await medicines.clone().text());
    assert.ok((await medicines.json()).wards.some(ward => ward.code === 'infectious'));
    const pharmacyWards = (await (await call(await login('director'), `/api/reports/ward-medicines?ward=infectious&date=${today}`)).json()).wards;
    assert.ok(pharmacyWards.some(ward => ward.code === 'infectious'));
    const daily = await (await call(await login('director'), `/api/reports/daily?ward=infectious&date=${today}`)).json();
    assert.equal(daily.wards[0].code, 'infectious');
    assert.equal(daily.wards[0].nameKh, 'ផ្នែកជំងឺឆ្លង');
    assert.ok((await (await call(su, '/api/messages/destinations')).json()).destinations.some(d => d.type === 'WARD' && d.code === 'infectious'));
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    db.close();
  }
});

test('v42.0 side menu items do not move when the collapsed rail expands', () => {
  const css = read('public/app-shell.css');
  const rail = css.slice(css.indexOf('/* Collapsed rail'), css.indexOf('/* Tooltip for the collapsed rail */'));
  const title = rail.match(/\.emr-sidebar:not\(\.is-expanded\) \.emr-sidebar-section-title \{([^}]*)\}/);
  assert.ok(title, 'collapsed section heading rule exists');
  assert.doesNotMatch(title[1], /height|margin|padding/, 'collapsed headings keep the expanded height');
  assert.match(rail, /\.emr-sidebar-section-title::after/, 'collapsed headings draw a divider line');
});

test('v42.0 the IPD transfer page script and stylesheet are served', () => {
  const server = read('server/server.mjs');
  assert.match(server, /'\/public\/ipd-transfer\.js'/);
  assert.match(server, /'\/public\/ipd-transfer\.css'/);
});
