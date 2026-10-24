import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createEmrServer } from '../server/server.mjs';
import { setUserAccess } from '../server/access.mjs';
import { createOrder, listOrders, addAttachment } from '../server/paraclinic.mjs';
import { accessContexts } from './helpers/access-audit-contexts.mjs';

test('active Obstetric and Gynecology contexts scope direct order reads and writes', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', port: 0, host: '127.0.0.1', appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test', npca: { enabled: false } });
  try {
    const identities = [
      ['obstetric-doctor', 'DOCTOR', 'obstetric'], ['gynecology-doctor', 'DOCTOR', 'gynecology'],
      ['both-doctor', 'DOCTOR', 'obstetric'], ['ward-nurse', 'NURSE', 'gynecology'],
      ['lab-staff', 'LAB', ''], ['imaging-staff', 'IMAGING', ''], ['audit-admin', 'ADMIN', ''],
    ];
    for (const [id, role, ward] of identities) {
      app.database.createUser({ id, username: id, displayName: 'Synthetic audit staff', role, passwordHash: 'synthetic-unused', createdAt: Date.now() });
      setUserAccess(app.database, id, [role], id === 'both-doctor' ? ['obstetric', 'gynecology'] : ward ? [ward] : []);
    }
    const patient = ward => {
      const patientKey = `case:SYNTHETIC-AUDIT-${ward}`;
      app.database.upsertPatient({ id: crypto.randomUUID(), patientKey, userId: 'audit-admin', savedAt: Date.now(),
        summary: { caseNumber: `SYNTHETIC-AUDIT-${ward}`, healthId: `SYNTHETIC-${ward}`, firstName: 'Synthetic', lastName: 'Audit', fullName: 'Synthetic Audit', sex: 'F', age: '25', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'CASH', departmentCode: ward, departmentNameKh: '', departmentNameEn: ward, serviceMode: 'ipd', entryDate: new Date().toISOString().slice(0,10), dischargeDate: '' },
        data: { 'system:currentWardCode': ward },
      });
      return patientKey;
    };
    const gynecology = patient('gynecology'), obstetric = patient('obstetric');
    const order = key => createOrder(app.database, { patientKey: key, modality: 'LAB', request: { items: [{ code: 'CBC' }] }, userId: 'audit-admin', role: 'ADMIN', ward: '' });
    const gynOrder = order(gynecology), obsOrder = order(obstetric);
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    app.config.appOrigin = origin;
    const login = async username => {
      const r = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
      assert.equal(r.status, 200);
      const Cookie = r.headers.get('set-cookie').split(';')[0];
      const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie } })).json();
      return { Cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
    };
    const request = async (headers, method, url, body) => {
      const response = await fetch(origin + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
      return { status: response.status, body: await response.json() };
    };
    const staff = {};
    for (const [id] of identities) staff[id] = await login(id);
    const obs = staff['obstetric-doctor'], gyn = staff['gynecology-doctor'];
    const listed = await request(obs, 'GET', '/api/paraclinic/orders');
    assert.equal(listed.status, 200);
    assert.ok(listed.body.orders.every(o => o.patientKey !== gynecology));
    const create = { patientKey: gynecology, modality: 'XRAY', request: { examination: 'Synthetic audit' } };
    const count = listOrders(app.database).length;
    const crossRead = await request(obs, 'GET', `/api/paraclinic/orders/${gynOrder.id}`);
    const crossWrite = await request(obs, 'POST', '/api/paraclinic/orders', create);
    assert.deepEqual({ read: crossRead.status, write: crossWrite.status }, { read: 403, write: 403 }, 'direct reads/writes must match list scope');
    assert.equal((await request(gyn, 'GET', `/api/paraclinic/orders/${obsOrder.id}`)).status, 403);
    assert.equal((await request(gyn, 'GET', `/api/paraclinic/orders/${gynOrder.id}`)).status, 200);
    assert.equal((await request(obs, 'GET', `/api/paraclinic/orders/${obsOrder.id}`)).status, 200);
    assert.equal(listOrders(app.database).length, count, 'denied write has no side effects');
    assert.equal((await request(gyn, 'POST', '/api/paraclinic/orders', create)).status, 201, 'own-service prescribing retained');
    const imageOrder = listOrders(app.database).find(o => o.modality === 'XRAY');
    for (const [headers, allowed, denied] of [
      [staff['lab-staff'], gynOrder, imageOrder], [staff['imaging-staff'], imageOrder, gynOrder],
    ]) {
      assert.equal((await request(headers, 'GET', `/api/paraclinic/orders/${allowed.id}`)).status, 200);
      assert.equal((await request(headers, 'GET', `/api/paraclinic/orders/${denied.id}`)).status, 403, 'modality restriction also applies to direct IDs');
    }
    // A synthetic attachment path outside all hospital upload directories.
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-audit-attachment-'));
    const storagePath = path.join(directory, 'synthetic.txt');
    fs.writeFileSync(storagePath, 'Synthetic access-audit attachment');
    const attachments = [gynOrder, imageOrder].map(o => addAttachment(app.database, o.id, { filename: 'synthetic.txt', contentType: 'text/plain', storagePath, userId: 'audit-admin' }));
    for (const [name, index, expected] of [['lab-staff', 0, 200], ['lab-staff', 1, 403], ['imaging-staff', 0, 403], ['imaging-staff', 1, 200], ['obstetric-doctor', 0, 403], ['gynecology-doctor', 0, 200]]) {
      const r = await fetch(origin + `/api/paraclinic/attachments/${attachments[index].id}`, { headers: staff[name] });
      assert.equal(r.status, expected, `${name} attachment ${index}`);
      const content = await r.text();
      if (expected === 200) assert.equal(content, 'Synthetic access-audit attachment');
    }
    assert.equal((await request(staff['ward-nurse'], 'POST', '/api/paraclinic/orders', { ...create, request: { examination: 'Nurse denied' } })).status, 403);
    assert.equal((await request(staff['audit-admin'], 'GET', `/api/paraclinic/orders/${gynOrder.id}`)).status, 200);
    const both = staff['both-doctor'];
    assert.equal((await request(both, 'POST', '/api/auth/context', { role: 'DOCTOR', wardCode: 'obstetric' })).status, 200);
    assert.equal((await request(both, 'GET', `/api/paraclinic/orders/${gynOrder.id}`)).status, 403, 'assigned to both still requires explicit active context');
    assert.equal((await request(both, 'POST', '/api/auth/context', { role: 'DOCTOR', wardCode: 'gynecology' })).status, 200);
    assert.equal((await request(both, 'GET', `/api/paraclinic/orders/${gynOrder.id}`)).status, 200);
    assert.equal((await request(both, 'GET', `/api/paraclinic/orders/${obsOrder.id}`)).status, 403);
  } finally {
    if (app.server.listening) await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});

test('all 15 active roles: context, landing, visible menu links and privileged read APIs', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', port: 0, host: '127.0.0.1', appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test', npca: { enabled: false } });
  try {
    const context = vm.createContext({ URL, URLSearchParams });
    vm.runInContext(fs.readFileSync(new URL('../public/nav-config.js', import.meta.url), 'utf8'), context);
    const nav = context.EmrNavConfig;
    assert.equal(new Set(accessContexts.map(c => c.role)).size, 15);
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    app.config.appOrigin = origin;
    for (const { id, role, ward, landing } of accessContexts) {
      app.database.createUser({ id, username: id, displayName: 'Synthetic role audit', role, passwordHash: 'synthetic-unused', createdAt: Date.now() });
      setUserAccess(app.database, id, [role], ward ? [ward] : []);
      const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: id }) });
      assert.equal(login.status, 200, `${role}@${ward} login`);
      const Cookie = login.headers.get('set-cookie').split(';')[0];
      const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie } })).json();
      assert.equal(me.user.activeRole, role);
      assert.equal(me.user.activeWard?.code || '', ward);
      const root = await fetch(origin + '/', { headers: { Cookie }, redirect: 'manual' });
      assert.equal(root.status, 302);
      assert.equal(root.headers.get('location'), landing, `${role}@${ward} landing`);
      await root.text();
      for (const item of nav.visibleGroups(me.user).flatMap(g => g.items)) {
        const response = await fetch(origin + item.href, { headers: { Cookie }, redirect: 'manual' });
        assert.equal(response.status, 200, `${role}@${ward} visible ${item.href}`);
        await response.text();
      }
      for (const [url, allowed] of [
        ['/api/admin/users', ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR']],
        ['/api/finance/expenses', ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'ACCOUNTANT']],
        ['/api/npca/mappings', ['ADMIN', 'DIRECTOR']],
      ]) {
        const response = await fetch(origin + url, { headers: { Cookie } });
        assert.equal(response.status, allowed.includes(role) ? 200 : 403, `${role}@${ward} ${url}`);
        await response.text();
      }
    }
  } finally {
    if (app.server.listening) await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
