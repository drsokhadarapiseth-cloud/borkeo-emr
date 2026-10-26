// v47.9 browser check (explicit, not part of npm test):
//   node --test tests/hosting-test-patients-browser.mjs
// The 30 hosting test patients: every Registration field that applies is filled
// and passes the form's own required check; Triage shows the measurements and
// waits for the service. Temporary database only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';
import { seedHostingTestPatients } from '../scripts/seed-hosting-test-patients.mjs';
import { openBrowser } from './helpers/context-browser.mjs';

const TRIAGE = ['p2_temp', 'p2_bp_sys', 'p2_bp_dia', 'p2_pulse', 'p2_resp', 'p2_spo2', 'p2_weight', 'p2_height'];

test('hosting test patients: complete registration, triage measured and waiting', { timeout: 900000 }, async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-hosting-browser-'));
  const seeded = await seedHostingTestPatients(path.join(dir, 'emr.sqlite'), { log: () => {} });
  const app = createEmrServer({ databasePath: seeded.file, demoMode: false, host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'development', npca: { enabled: false } });
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
    assert.equal(await browser.evaluate("(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Superuser',password:'1234'})});return r.status})()"), 200, 'Superuser / 1234');
    assert.equal(await role('REGISTRATION'), 200);
    const rows = app.database.sqlite.prepare('SELECT patient_key, health_id, record_json FROM patient_records ORDER BY case_number').all();
    assert.equal(rows.length, 30);
    for (const row of rows) {
      const data = JSON.parse(row.record_json);
      await browser.send('Page.navigate', { url: origin + '/emr?' + new URLSearchParams({ patient: row.patient_key, view: 'register', edit: '1' }) });
      await browser.waitFor(`window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(row.patient_key)} && window.BorkeoRequiredFields`, 'registration runtime', 60000);
      await browser.waitFor("window.cambodiaAddressManager?.provinceDropdown && document.getElementById('web_province').options.length>1", 'address catalogue');
      await browser.evaluate('cambodiaAddressManager.restoreAddress(getLoadedEmrPatient().data)');
      await browser.waitFor("document.getElementById('web_village').value", 'loaded address', 30000);
      const result = await browser.evaluate(`(() => {
        const root = document.getElementById('sub_reg');
        const valid = BorkeoRequiredFields.validate(root);
        const notApplicable = new Set([${data['scope:registration:id:web_equity'] ? '' : "'web_equity'"}${data['scope:registration:id:web_nssf'] ? '' : ", 'web_nssf'"}].filter(Boolean));
        const empty = [...document.querySelectorAll('#page1 input, #page1 select, #page1 textarea')]
          .filter((el) => el.offsetParent && !['hidden', 'checkbox', 'radio', 'file', 'button'].includes(el.type) && !el.readOnly && !el.disabled && !String(el.value || '').trim())
          .map((el) => el.id || el.dataset.emrStorageKey).filter((id) => !notApplicable.has(id));
        return { valid, empty, id: document.getElementById('web_health_id').value, photo: Boolean(document.getElementById('web_patient_photo').value) };
      })()`);
      assert.equal(result.valid, true, `${row.health_id}: required check ${JSON.stringify(result)}`);
      assert.deepEqual(result.empty, [], `${row.health_id}: nothing left empty`);
      assert.equal(result.id, row.health_id);
      assert.equal(result.photo, true);
    }
    assert.equal(await role('TRIAGE'), 200);
    for (const row of rows.slice(0, 5)) {
      await browser.send('Page.navigate', { url: origin + '/emr?' + new URLSearchParams({ patient: row.patient_key, view: 'triage', edit: '1' }) });
      await browser.waitFor(`window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(row.patient_key)} && document.getElementById('p2_temp')`, 'triage runtime', 60000);
      await browser.waitFor("document.getElementById('p2_weight').value", 'triage values', 30000);
      const triage = await browser.evaluate(`({ values: ${JSON.stringify(TRIAGE)}.map((id) => document.getElementById(id).value), service: document.getElementById('p2_other_dept').value })`);
      assert.ok(triage.values.every(Boolean), `${row.health_id}: ${JSON.stringify(triage)}`);
      assert.equal(triage.service, '', 'the service is chosen by the nurse');
    }
    const queue = await browser.evaluate("(async()=>{const r=await (await fetch('/api/triage/queue')).json();return (Array.isArray(r)?r:(r.patients||r.queue||[])).length})()");
    assert.equal(queue, 30, 'all 30 wait in the Triage list');
    assert.deepEqual(browser.state.errors, []);
  } finally {
    browser?.close();
    app.server.closeAllConnections?.();
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
  }
});
