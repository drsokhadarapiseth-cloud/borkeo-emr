import assert from 'node:assert/strict';
import test from 'node:test';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';
import { loadConfig, projectRoot } from '../server/config.mjs';
import { setESignature } from '../server/esign.mjs';

test('the local demo uses username-only accounts and cannot access the patient database', async () => {
  const defaultConfig = loadConfig();
  assert.equal(defaultConfig.demoMode, true);
  assert.equal(defaultConfig.databasePath, path.join(projectRoot, 'data', 'demo.sqlite'));
  assert.equal(defaultConfig.host, '127.0.0.1');
  const oldSettings = ['DATABASE_PATH', 'HOST', 'APP_ORIGIN'].map(key => [key, process.env[key]]);
  try {
    process.env.DATABASE_PATH = 'auto';
    process.env.HOST = '0.0.0.0';
    process.env.APP_ORIGIN = 'http://192.168.1.6:3000';
    const stillDemo = loadConfig();
    assert.equal(stillDemo.databasePath, defaultConfig.databasePath);
    assert.equal(stillDemo.host, '127.0.0.1');
    assert.equal(stillDemo.appOrigin, `http://localhost:${defaultConfig.port}`);
  } finally {
    for (const [key, value] of oldSettings) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
  assert.throws(() => createEmrServer({
    demoMode: true, host: '198.51.100.1', databasePath: ':memory:',
  }), /localhost/);
  assert.throws(() => createEmrServer({
    demoMode: true, host: '127.0.0.1', databasePath: 'auto',
  }), /cannot use the patient database/);

  const origin = 'http://127.0.0.1:32239';
  const app = createEmrServer({
    demoMode: true, host: '127.0.0.1', port: 32239, appOrigin: origin,
    databasePath: ':memory:', nodeEnv: 'test',
  });
  try {
    assert.equal(app.config.demoMode, true);
    assert.equal(app.config.autoDatabase, false);
    assert.match(app.database.findUser('admin').password_hash, /^demo-disabled\$/);
    await new Promise((resolve, reject) => {
      app.server.once('error', reject);
      app.server.listen(32239, '127.0.0.1', resolve);
    });
    const request = (pathname, options = {}) => fetch(origin + pathname, options);
    const config = await (await request('/api/auth/config')).json();
    assert.equal(config.demoMode, true);
    const loginPage = await (await request('/login')).text();
    assert.match(loginPage, /v2[0-9]\./);
    assert.match(loginPage, /id="login-password-group" hidden/);
    const unknown = await request('/api/auth/login', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'somebody_else' }),
    });
    assert.equal(unknown.status, 401);
    const login = async username => request('/api/auth/login', {
      method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });
    const admin = await login('admin');
    assert.equal(admin.status, 200);
    const cookie = admin.headers.get('set-cookie').split(';')[0];
    const me = await (await request('/api/auth/me', { headers: { Cookie: cookie } })).json();
    assert.equal(me.demoMode, true);
    assert.equal(me.user.activeRole, 'ADMIN');
    assert.equal((await login('doctor_medicine')).status, 200);
    const opdDoctor = await login('doctor_opd');
    assert.equal(opdDoctor.status, 200);
    assert.equal((await login('pharmacy')).status, 200);
    const opdCookie = opdDoctor.headers.get('set-cookie').split(';')[0];
    const doctorMe = await (await request('/api/auth/me', { headers: { Cookie: opdCookie } })).json();
    const doctorId = app.database.findUser('doctor_opd').id;
    setESignature(app.database, doctorId, {
      signerName:'Demo OPD Doctor',
      signatureDataUrl:'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==',
    }, doctorId);
    const prescription = await request('/api/patient-record', {
      method: 'PUT',
      headers: { Cookie: opdCookie, Origin: origin, 'Content-Type': 'application/json',
        'X-CSRF-Token': doctorMe.csrfToken },
      body: JSON.stringify({
        patientKey: 'case:DEMO-OPD-1',
        summary: { caseNumber: 'DEMO-OPD-1', healthId: 'DEMO-1',
          fullName: 'Demo Patient', firstName: 'Demo', lastName: 'Patient',
          sex: 'ស្រី', age: '20', departmentCode: 'opd', departmentNameKh: 'ពិគ្រោះក្រៅ',
          departmentNameEn: 'OPD', serviceMode: 'opd', entryDate: '2026-09-17' },
        data: { 'system:opdMedications': JSON.stringify([{
          name: 'Demo medicine 10mg', route: 'po', unit: 'គ្រាប់', scheduleType: 'bid',
          doseAmount: '1', m: '1', a: '0', e: '1', n: '0', d: '5', total: '10',
        }]) },
        submitOpdPrescription: true,
      }),
    });
    assert.equal(prescription.status, 200, await prescription.text());
    const pharmacyLogin = await login('pharmacy');
    const pharmacyCookie = pharmacyLogin.headers.get('set-cookie').split(';')[0];
    const inbox = await (await request('/api/messages', { headers: { Cookie: pharmacyCookie } })).json();
    assert.equal(inbox.messages.length, 1);
    const message = await (await request(`/api/messages/${inbox.messages[0].id}/prescription`,
      { headers: { Cookie: pharmacyCookie } })).json();
    assert.equal(message.prescription.medications[0].name, 'Demo medicine 10mg');
    const headers = {
      Cookie: cookie, Origin: origin, 'Content-Type': 'application/json',
      'X-CSRF-Token': me.csrfToken,
    };
    const created = await request('/api/admin/users', {
      method: 'POST', headers,
      body: JSON.stringify({ username: 'demodoctor', displayName: 'Demo Doctor',
        roles: ['DOCTOR'], wards: ['opd'] }),
    });
    assert.equal(created.status, 201, await created.text());
    assert.equal((await login('demodoctor')).status, 200);
    assert.equal((await request('/api/auth/change-password', { method: 'POST', headers,
      body: '{}' })).status, 404);
    assert.equal((await request('/api/pmrs2/import-medicines', { method: 'POST', headers,
      body: '{}' })).status, 403);
    app.database.sqlite.prepare('UPDATE users SET is_active=0 WHERE username=?').run('demodoctor');
    assert.equal((await login('demodoctor')).status, 401);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});

test('v20.4 login fields eliminate browser rectangular focus rings and autofill highlights', async () => {
  const fs = await import('node:fs');
  const css = fs.readFileSync(path.join(projectRoot, 'public', 'login.css'), 'utf8');
  assert.match(css, /\.field\s+input\s*\{[^}]*outline:\s*none\s*!important/);
  assert.match(css, /\.field\s+input\s*\{[^}]*box-shadow:\s*none\s*!important/);
  assert.match(css, /\.field\s+input:focus-visible\s*\{[^}]*outline:\s*none\s*!important/);
  assert.match(css, /\.field\s+input:-webkit-autofill/);
  assert.match(css, /\.reveal:focus-visible\s*\{[^}]*outline:\s*none\s*!important/);
});

