// Explicit Chromium integration. In-memory synthetic records only; no hospital .env/data.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';
import { setResuscitationStatus } from '../server/clinical-summary.mjs';
import { openBrowser } from './helpers/context-browser.mjs';

test('management viewer logs the displayed encounter, Khmer audit UI and direct role/ward guards survive', { timeout: 240000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0,
    appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test', npca: { enabled: false } });
  let browser;
  try {
    const doctor = app.database.findUser('doctor_medicine').id;
    for (const [suffix, ward] of [['A', 'medicine'], ['B', 'surgery']]) app.database.upsertPatient({
      id: crypto.randomUUID(), patientKey: `case:FINISH-${suffix}`, userId: doctor, savedAt: Date.now(),
      summary: { caseNumber: `FINISH-${suffix}`, healthId: 'SYNTHETIC-FINISH', firstName: 'Synthetic', lastName: suffix,
        fullName: `Synthetic ${suffix}`, sex: 'Female', age: '40', dateOfBirth: '1986-01-01', phone: '', equityCard: '',
        paymentType: 'EXEMPT', departmentCode: ward, departmentNameKh: '', departmentNameEn: ward,
        serviceMode: 'ipd', entryDate: '2026-10-01', dischargeDate: '' }, data: {},
    });
    setResuscitationStatus(app.database, app.database.findPatient('case:FINISH-A'),
      { user_id: doctor, display_name: 'Synthetic Doctor', activeRole: 'DOCTOR' }, 'dnr');
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    app.config.appOrigin = origin;
    browser = await openBrowser();
    await browser.send('Page.navigate', { url: origin + '/login' });
    await browser.waitFor("location.pathname==='/login' && document.getElementById('login-form')", 'login');
    const login = async username => assert.equal(await browser.evaluate(`(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:${JSON.stringify(username)}})});return r.status})()`), 200);
    await login('admin');
    await browser.send('Page.navigate', { url: origin + '/record-viewer?patient=case%3AFINISH-A' });
    await browser.waitFor("window.getLoadedEmrPatient?.()?.patientKey==='case:FINISH-A'", 'read-only viewer A', 80000);
    assert.ok(app.database.sqlite.prepare("SELECT COUNT(*) AS n FROM record_access_log WHERE patient_key='case:FINISH-A' AND action='open'").get().n > 0);
    await browser.waitFor("[...document.querySelectorAll('.viewer-page iframe')].some(f=>f.contentDocument?.body.textContent.includes('DNR'))", 'clinical status snapshot');
    assert.equal(await browser.evaluate("document.querySelectorAll('.viewer-page iframe').length"), 5);
    assert.equal(await browser.evaluate("[...document.querySelectorAll('.viewer-page iframe')].every(f=>!f.contentDocument?.querySelector('script,input,textarea,select,button'))"), true);
    assert.equal(await browser.evaluate("logRecordAccess('print','Synthetic viewer A')"), true);
    await browser.evaluate("document.getElementById('viewer-encounter').value='case:FINISH-B';document.getElementById('viewer-encounter').dispatchEvent(new Event('change'))");
    assert.equal(await browser.evaluate("getLoadedEmrPatient()===null"), true);
    assert.equal(await browser.evaluate("logRecordAccess('print','Blocked during loading')"), false);
    await browser.waitFor("window.getLoadedEmrPatient?.()?.patientKey==='case:FINISH-B'", 'read-only viewer B', 80000);
    assert.equal(await browser.evaluate("logRecordAccess('export','Synthetic viewer B')"), true);
    const logged = app.database.sqlite.prepare("SELECT patient_key,action FROM record_access_log WHERE detail IN ('Synthetic viewer A','Synthetic viewer B') ORDER BY occurred_at").all();
    assert.deepEqual(logged.map(row => [row.patient_key, row.action]), [['case:FINISH-A', 'print'], ['case:FINISH-B', 'export']]);
    await browser.send('Page.navigate', { url: origin + '/record-viewer?patient=case%3ASYNTHETIC-MISSING' });
    await browser.waitFor("document.getElementById('viewer-status')?.textContent.includes('។')", 'localized unavailable record');
    assert.match(await browser.evaluate("document.getElementById('viewer-status').textContent"), /[\u1780-\u17ff]/);
    assert.doesNotMatch(await browser.evaluate("document.getElementById('viewer-status').textContent"), /Patient not found|Failed to fetch/);
    assert.equal(await browser.evaluate("getLoadedEmrPatient()"), null);
    await browser.send('Page.navigate', { url: origin + '/admin/record-log' });
    await browser.waitFor("document.querySelector('#rl-table tbody') && window.emrSession?.user?.activeRole==='ADMIN'", 'audit viewer');
    assert.match(await browser.evaluate("document.querySelector('#rl-table thead').textContent"), /[\u1780-\u17ff]/);
    assert.doesNotMatch(await browser.evaluate("document.querySelector('#rl-table thead').textContent"), /Staff|Action|Patient|Time/);
    assert.equal(await browser.evaluate("Boolean(document.querySelector('[data-nav-id=\"admin-record-log\"]'))"), true);
    await browser.evaluate("window.getBorkeoLanguage=()=> 'en';window.dispatchEvent(new Event('borkeo-language-change'))");
    await browser.waitFor("document.querySelector('#rl-table thead')?.textContent.includes('Staff')", 'English audit labels');
    await browser.evaluate("window.getBorkeoLanguage=()=> 'kh';window.dispatchEvent(new Event('borkeo-language-change'))");
    await browser.waitFor("!document.querySelector('#rl-table thead')?.textContent.includes('Staff')", 'Khmer audit labels');
    // All management roles retain viewer access; other roles cannot read the log or viewer.
    for (const name of ['director', 'vice_director']) {
      await login(name);
      assert.equal(await browser.evaluate("fetch('/admin/record-log').then(r=>r.status)"), 200);
      assert.equal(await browser.evaluate("fetch('/record-viewer?patient=case%3AFINISH-A').then(r=>r.status)"), 200);
    }
    await login('doctor_medicine');
    for (const url of ['/admin/record-log', '/api/record-access-log', '/record-viewer?patient=case%3AFINISH-A']) {
      assert.equal(await browser.evaluate(`fetch(${JSON.stringify(url)}).then(r=>r.status)`), 403);
    }
    assert.equal(await browser.evaluate("fetch('/api/patient-record?patientKey=case%3AFINISH-B').then(r=>r.status)"), 403);
    assert.equal(await browser.evaluate("fetch('/api/record-access-log',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({patientKey:'case:FINISH-A',action:'print'})}).then(r=>r.status)"), 403);
    await login('triage');
    await browser.send('Page.navigate', { url: origin + '/triage' });
    await browser.waitFor("document.querySelector('[data-nav-id=\"queue-display-triage\"]')", 'staff counter display');
    assert.equal(await browser.evaluate("Boolean(document.querySelector('[data-nav-id=\"admin-record-log\"]'))"), false);
    assert.deepEqual(browser.state.errors, []);
  } finally {
    browser?.close();
    if (app.server.listening) await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
