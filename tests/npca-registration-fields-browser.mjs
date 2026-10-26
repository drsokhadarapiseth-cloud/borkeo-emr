// v48.0 browser check (explicit, not part of npm test):
//   node --test tests/npca-registration-fields-browser.mjs
// The positions in server/npca/registration-fields.mjs are the ones the real
// Registration form saves, and the NPCA page shows the date-range status check.
// Temporary database with synthetic patients only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';
import { seedHostingTestPatients } from '../scripts/seed-hosting-test-patients.mjs';
import { MARITAL_POSITIONS, OCCUPATION_POSITION, DISABLED_POSITION, NOT_DISABLED_POSITION } from '../server/npca/registration-fields.mjs';
import { openBrowser } from './helpers/context-browser.mjs';

test('NPCA registration positions match the rendered form; NPCA page has the range check', { timeout: 300000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-npca-fields-'));
  const seeded = await seedHostingTestPatients(path.join(dir, 'emr.sqlite'), { log: () => {} });
  const app = createEmrServer({ databasePath: seeded.file, demoMode: false, host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'development',
    npca: { enabled: true, baseUrl: 'http://127.0.0.1:9', localMock: true, clientId: 'x', clientSecret: 'x', username: 'x', password: 'x', systemCode: 'x', facilityCode: 'x' } });
  let browser;
  try {
    await new Promise((resolve) => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    app.config.appOrigin = origin;
    browser = await openBrowser();
    await browser.send('Network.setBlockedURLs', { urls: ['https://*'] });
    await browser.send('Page.navigate', { url: origin + '/login' });
    await browser.waitFor("document.getElementById('login-form')", 'login');
    const role = (name) => browser.evaluate(`(async()=>{const me=await (await fetch('/api/auth/me')).json();const r=await fetch('/api/auth/context',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:JSON.stringify({role:${JSON.stringify(name)}})});return r.status})()`);
    assert.equal(await browser.evaluate("(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Superuser',password:'1234'})});return r.status})()"), 200);
    assert.equal(await role('REGISTRATION'), 200);
    const key = app.database.sqlite.prepare('SELECT patient_key FROM patient_records ORDER BY case_number LIMIT 1').get().patient_key;
    await browser.send('Page.navigate', { url: origin + '/emr?' + new URLSearchParams({ patient: key, view: 'register', edit: '1' }) });
    await browser.waitFor(`window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(key)} && document.querySelector('#page1 input[name="marital"]')?.dataset.emrStorageKey`, 'registration', 60000);
    const keys = await browser.evaluate(`({
      marital: [...document.querySelectorAll('#page1 input[name="marital"]')].map((el) => el.dataset.emrStorageKey),
      occupation: document.querySelector('#page1 select[onchange^="syncOccupationField"]').dataset.emrStorageKey,
      disability: [...document.querySelectorAll('#page1 input[name="disability"]')].map((el) => el.dataset.emrStorageKey),
    })`);
    assert.deepEqual(keys.marital, MARITAL_POSITIONS.map(([, n]) => 'scope:registration:auto:' + n));
    assert.equal(keys.occupation, 'scope:registration:auto:' + OCCUPATION_POSITION);
    assert.deepEqual(keys.disability, [DISABLED_POSITION, NOT_DISABLED_POSITION].map((n) => 'scope:registration:auto:' + n));

    assert.equal(await role('CLERK'), 200);
    await browser.send('Page.navigate', { url: origin + '/npca' });
    await browser.waitFor("document.getElementById('npca-range') && !document.getElementById('npca-range').hidden && document.getElementById('npca-range-check').textContent", 'npca range', 30000);
    const range = await browser.evaluate(`({ title: document.getElementById('npca-range-title').textContent, button: document.getElementById('npca-range-check').textContent,
      from: document.getElementById('npca-range-from').value, to: document.getElementById('npca-range-to').value })`);
    const khmer = (text) => [...text].some((c) => c.codePointAt(0) >= 0x1780 && c.codePointAt(0) <= 0x17ff);
    assert.ok(khmer(range.title), 'Khmer by default');
    assert.ok(khmer(range.button));
    assert.ok(range.from && range.to && range.from <= range.to);
    assert.deepEqual(browser.state.errors, []);
  } finally {
    browser?.close();
    app.npca?.stop?.();
    app.server.closeAllConnections?.();
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
  }
});
