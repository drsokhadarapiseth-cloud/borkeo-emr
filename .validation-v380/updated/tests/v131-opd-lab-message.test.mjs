import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';
import { createOrder, ensureParaclinicSchema } from '../server/paraclinic.mjs';

const origin = 'http://127.0.0.1:32331';
const passwords = { doctor: 'Doctor v13.2 test password!', lab: 'Laboratory v13.2 test password!' };

async function addUser(app, username, displayName, role, wards = []) {
  const id = crypto.randomUUID();
  app.database.createUser({
    id, username, displayName, role, passwordHash: await hashPassword(passwords[username]), createdAt: Date.now(),
  });
  setUserAccess(app.database, id, [role], wards);
  return id;
}

async function login(username) {
  const response = await fetch(origin + '/api/auth/login', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password: passwords[username] }),
  });
  assert.equal(response.status, 200);
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookie } })).json();
  return { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
}

test('v13.2 OPD laboratory release sends the result directly to the OPD doctor inbox', async () => {
  const app = createEmrServer({ demoMode: false, host: '127.0.0.1', port: 32331, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  const patientKey = 'case:V131-LAB-MESSAGE';
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(32331, '127.0.0.1', resolve); });
    const doctorId = await addUser(app, 'doctor', 'OPD Doctor', 'DOCTOR', ['opd']);
    const labId = await addUser(app, 'lab', 'Laboratory Technician', 'LAB');
    ensureParaclinicSchema(app.database);
    app.database.upsertPatient({
      id: crypto.randomUUID(), patientKey, userId: doctorId, savedAt: Date.now(),
      summary: { caseNumber: 'V131-LAB-MESSAGE', healthId: 'H131', firstName: 'OPD', lastName: 'Message', fullName: 'OPD Message', sex: 'Female', age: '30', dateOfBirth: '1996-01-01', phone: '', equityCard: '', paymentType: 'EXEMPT', departmentCode: 'opd', departmentNameKh: 'ពិគ្រោះក្រៅ', departmentNameEn: 'OPD', serviceMode: 'opd', entryDate: '2026-09-21', dischargeDate: '' },
      data: JSON.stringify({ 'system:workflowStage': 'DOCTOR_READY', 'system:triageStatus': 'COMPLETED' }),
    });
    const order = createOrder(app.database, { patientKey, modality: 'LAB', priority: 'ROUTINE', request: { items: [{ code: 'HGB', urgent: false }] }, userId: doctorId, role: 'DOCTOR', ward: 'opd' });
    const lab = await login('lab');
    const patch = await fetch(origin + `/api/paraclinic/orders/${order.id}`, {
      method: 'PATCH', headers: lab,
      body: JSON.stringify({ status: 'PROCESSING', performed: true, result: { items: [{ code: 'HGB', value: 140, unit: 'g/L' }] }, release: true }),
    });
    assert.equal(patch.status, 200, await patch.text());
    const doctor = await login('doctor');
    const messages = await (await fetch(origin + '/api/messages', { headers: { Cookie: doctor.Cookie } })).json();
    assert.ok(messages.messages.some(message => message.patientKey === patientKey && /Laboratory result ready for OPD doctor/.test(message.subject)));
    const target = messages.messages.find(message => message.patientKey === patientKey && /Laboratory result ready for OPD doctor/.test(message.subject));
    assert.equal(target.destinationType, 'WARD');
    assert.equal(target.destinationCode, 'opd');
    assert.equal(target.destinationRole, 'DOCTOR');
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
