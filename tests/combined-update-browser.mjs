// All records and screenshots in this explicit browser test are synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';
import { buildCompleteRegistrationPatients } from '../scripts/create-complete-registration-fixture.mjs';
import { openBrowser } from './helpers/context-browser.mjs';
import { completeAncRequired } from './helpers/anc-complete.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label, timeout = 30000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) { if (check()) return; await sleep(100); }
  throw new Error('Timed out: ' + label);
}

test('registration actions, shared OPD fields and integrated ANC work on desktop/mobile and print', { timeout: 300000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', nodeEnv: 'test', host: '127.0.0.1', port: 0, npca: { enabled: false } });
  let browser;
  const evidence = path.resolve('validation-evidence'); fs.mkdirSync(evidence, { recursive: true });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`; app.config.appOrigin = origin;
    const users = {};
    for (const username of ['registration', 'triage', 'clerk', 'doctor_opd', 'nurse_obstetric']) {
      const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
      const cookie = response.headers.get('set-cookie').split(';')[0];
      const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookie } })).json();
      users[username] = { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
    }
    const call = async (user, method, route, body) => {
      const response = await fetch(origin + route, { method, headers: users[user], body: body === undefined ? undefined : JSON.stringify(body) });
      const result = await response.json(); assert.ok(response.ok, JSON.stringify(result)); return result;
    };
    const patients = buildCompleteRegistrationPatients();
    const register = patients[0], opd = patients[1], maternal = patients[2];
    await call('registration', 'PUT', '/api/patient-record', { ...register, registrationOnly: true, editorScope: 'registration' });
    await call('registration', 'PUT', '/api/patient-record', opd);
    let current = (await call('registration', 'GET', '/api/patient-record?patientKey=' + encodeURIComponent(opd.patientKey))).patient;
    const opdSummary = { ...opd.summary, departmentCode: 'opd', departmentNameEn: 'OPD', serviceMode: 'opd' };
    await call('triage', 'PUT', '/api/patient-record', { patientKey: opd.patientKey, summary: opdSummary, expectedVersion: current.version, triageSave: true, data: {
      'scope:triage:id:p2_temp': '37', 'scope:triage:id:p2_weight': '55', 'scope:triage:id:p2_height': '160', 'scope:triage:id:p2_bp_sys': '110', 'scope:triage:id:p2_bp_dia': '70',
      'scope:triage:id:p2_pulse': '80', 'scope:triage:id:p2_resp': '18', 'scope:triage:id:p2_spo2': '98',
      'scope:triage:id:pmrs_chief_complaint': 'Synthetic complaint', 'scope:triage:id:pmrs_chief_complaint_items': '["Synthetic complaint"]',
    } });
    const bill = (await call('clerk', 'GET', '/api/finance/patient?patientKey=' + encodeURIComponent(opd.patientKey))).bill;
    await call('clerk', 'POST', '/api/finance/payments', { patientKey: opd.patientKey, invoiceId: bill.invoice.id, source: 'CASH', amount: bill.summary.KHR.balance, currency: 'KHR' });
    await call('registration', 'PUT', '/api/patient-record', maternal);
    current = (await call('registration', 'GET', '/api/patient-record?patientKey=' + encodeURIComponent(maternal.patientKey))).patient;
    await call('triage', 'PUT', '/api/patient-record', { patientKey: maternal.patientKey, summary: { ...maternal.summary, departmentCode: 'anc', serviceMode: 'opd' }, expectedVersion: current.version, triageSave: true, data: {
      'scope:triage:id:p2_weight':'52', 'scope:triage:id:p2_height':'160', 'scope:triage:id:p2_bp_sys':'110', 'scope:triage:id:p2_bp_dia':'70', 'scope:triage:id:p2_pulse':'80', 'scope:triage:id:p2_temp':'37', 'scope:triage:id:p2_spo2':'98',
    } });
    const userId = app.database.findUser('registration').id;
    app.database.upsertPatient({ ...maternal, userId, summary: { ...maternal.summary, departmentCode: 'anc', serviceMode: 'opd' }, data: { ...JSON.parse(app.database.findPatient(maternal.patientKey).record_json),
      'scope:medical:auto:36': 'SYNTHETIC OLD ANC NOTE <img src=x onerror=alert(1)>', 'scope:medical:auto:38': '2',
      'scope:triage:id:p2_temp': '37', 'scope:triage:id:p2_weight': '52', 'scope:triage:id:p2_height': '160', 'scope:triage:id:p2_bp_sys': '110', 'scope:triage:id:p2_bp_dia': '70',
      'scope:triage:id:p2_pulse': '80', 'scope:triage:id:p2_spo2': '98', 'system:triageStatus': 'COMPLETED',
    } });
    const maternalBefore = app.database.findPatient(maternal.patientKey).record_json;
    browser = await openBrowser(); await browser.send('Network.setBlockedURLs', { urls: ['https://*'] });
    const use = async name => {
      const [cookieName, value] = users[name].Cookie.split('=');
      await browser.send('Network.clearBrowserCookies'); await browser.send('Network.setCookie', { name: cookieName, value, url: origin });
    };
    const navigate = async (route, condition) => { await browser.send('Page.navigate', { url: origin + route }); await browser.waitFor(condition, route, 60000); };
    const screenshot = async name => { const image = await browser.send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(evidence, name), Buffer.from(image.data, 'base64')); };
    await use('registration');
    await navigate('/emr?' + new URLSearchParams({ patient: register.patientKey, view: 'register', edit: '1' }), `window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(register.patientKey)} && document.getElementById('web_village').value && document.querySelector('[data-editor-toggle]')`);
    assert.equal(await browser.evaluate("getComputedStyle(document.getElementById('emr-chart-tabs-wrapper')).display"), 'none');
    await browser.evaluate("window.registerWrites=[];const nativeFetch=window.fetch;window.fetch=(url,options={})=>{if(String(url)==='/api/patient-record'&&options.method==='PUT')registerWrites.push(JSON.parse(options.body));return nativeFetch(url,options)};document.querySelector('[data-editor-toggle]').click()");
    await until(() => app.database.findPatient(register.patientKey).version > 1, 'registration save');
    const payload = await browser.evaluate('registerWrites.at(-1)');
    assert.equal(payload.registrationOnly, true); assert.equal(payload.transferToTriage, false);
    assert.equal(JSON.parse(app.database.findPatient(register.patientKey).record_json)['system:workflowStage'], 'REGISTRATION_SAVED');
    assert.equal(JSON.parse(app.database.findPatient(register.patientKey).record_json)['scope:registration:id:web_village_code'], register.data['scope:registration:id:web_village_code']);
    await screenshot('registration-desktop.png');

    await use('doctor_opd');
    await navigate('/emr?' + new URLSearchParams({ patient: opd.patientKey, view: 'opd', edit: '1' }), `window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(opd.patientKey)} && document.getElementById('opd_temp')?.readOnly===false && document.querySelector('.opd-shared-complaint')`);
    assert.equal(await browser.evaluate("Boolean(document.getElementById('emr-consultation-workspace'))"), false);
    assert.equal(await browser.evaluate("getComputedStyle(document.getElementById('emr-chart-tabs-wrapper')).display"), 'none');
    await browser.evaluate("(()=>{const f=document.getElementById('opd_temp');f.value='38.2';f.dispatchEvent(new Event('input',{bubbles:true}));BorkeoChiefComplaint.toggleSymptom('Synthetic added symptom',true)})()");
    assert.equal(await browser.evaluate("document.getElementById('pmrs_chief_complaint').value.includes('Synthetic added symptom')"), true);
    await browser.evaluate('BorkeoChiefComplaint.clear()');
    assert.equal(await browser.evaluate("document.getElementById('p2_temp').value"), '38.2');
    const beforeVersion = app.database.findPatient(opd.patientKey).version;
    await browser.evaluate("document.querySelector('#sub_opd .emr-save-bar .emr-save-button').click()");
    try { await until(() => app.database.findPatient(opd.patientKey).version > beforeVersion, 'OPD shared save'); }
    catch (error) { console.log(await browser.evaluate("({status:document.getElementById('emr-record-status')?.textContent,missing:[...document.querySelectorAll('[aria-invalid=true]')].map(e=>({id:e.id,key:e.dataset.emrStorageKey,label:e.closest('.input-group')?.querySelector('label')?.textContent,html:e.outerHTML.slice(0,400)}))})")); throw error; }
    assert.equal(JSON.parse(app.database.findPatient(opd.patientKey).record_json)['scope:triage:id:p2_temp'], '38.2');
    assert.equal(JSON.parse(app.database.findPatient(opd.patientKey).record_json)['scope:triage:id:pmrs_chief_complaint'], '');
    await screenshot('opd-desktop.png');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await screenshot('opd-mobile.png');

    await use('nurse_obstetric');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
    await navigate('/emr?' + new URLSearchParams({ patient: maternal.patientKey, view: 'opd', mode: 'view' }), `location.pathname==='/anc-record' || (window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(maternal.patientKey)} && document.getElementById('opd-module-select'))`);
    await browser.evaluate("if(location.pathname!=='/anc-record'){const select=document.getElementById('opd-module-select');select.value='anc';select.dispatchEvent(new Event('change',{bubbles:true}))}");
    await browser.waitFor("location.pathname==='/anc-record' && document.querySelector('[data-action=open]')", 'unified ANC entry', 60000);
    await browser.evaluate("document.querySelector('[data-action=open]').click()");
    await browser.waitFor("document.querySelector('[data-anc-nav=visit]') && document.querySelector('[data-action=save-visit]')", 'ANC record open');
    const type = async (selector, value) => browser.evaluate(`(()=>{const input=document.querySelector(${JSON.stringify(selector)});input.value=${JSON.stringify(value)};input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));})()`);
    await browser.evaluate("document.querySelector('[data-action=save-visit]').click()");
    await browser.waitFor("document.querySelector('[data-anc-nav=pregnancy]').getAttribute('aria-selected')==='true'", 'missing required field reveals its section');
    assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) AS n FROM anc_visits').get().n, 0);
    assert.ok(await browser.evaluate("document.querySelectorAll('.anc-required-mark').length>=18"));
    await browser.evaluate("document.querySelector('[data-anc-nav=pregnancy]').click()");
    assert.equal(await browser.evaluate("document.querySelector('[data-path=lmp]').value"), '', 'legacy LMP is not migrated');
    await type('[data-path=lmp]', '2026-08-01');
    await browser.evaluate("document.querySelector('[data-anc-nav=visit]').click()");
    await type('[data-visit=weight]', '54'); await type('[data-visit=complaint]', 'Synthetic current visit');
    await browser.evaluate("document.querySelector('[data-anc-nav=care]').click()");
    await type('[data-visit="legacyDetails.43"]', '1');
    await completeAncRequired(browser);
    await browser.evaluate("document.querySelector('[data-anc-nav=visit]').click()");
    assert.equal(await browser.evaluate("document.querySelector('[data-visit=complaint]').value"), 'Synthetic current visit');
    await browser.evaluate("document.querySelector('[data-action=save-visit]').click()");
    await until(() => app.database.sqlite.prepare('SELECT COUNT(*) AS n FROM anc_visits').get().n === 1, 'atomic ANC save');
    await browser.waitFor("document.getElementById('anc-status').textContent===window.newText('anc.saved','Saved.')", 'ANC saved');
    const savedAnc = await call('nurse_obstetric', 'GET', '/api/anc/record?patientKey=' + encodeURIComponent(maternal.patientKey));
    assert.equal(savedAnc.visits[0].legacyDetails['37'], 'Z36.4.0');
    assert.equal(savedAnc.visits[0].legacyDetails['41'], '1');
    assert.equal(savedAnc.visits[0].legacyDetails['44'], 'TT2');
    assert.equal(savedAnc.visits[0].fer, '0');
    await browser.evaluate("document.querySelector('[data-anc-nav=care]').click()");
    await screenshot('anc-required-care.png');
    await browser.evaluate("document.querySelector('[data-anc-nav=pregnancy]').click()");
    await screenshot('anc-required-pregnancy.png');
    assert.equal(app.database.findPatient(maternal.patientKey).record_json, maternalBefore);
    await browser.evaluate("document.querySelector('[data-anc-nav=legacy]').click()");
    assert.equal(await browser.evaluate("document.querySelector('.anc-legacy').textContent.includes('SYNTHETIC OLD ANC NOTE') && !document.querySelector('.anc-legacy img')"), true);
    await browser.evaluate("document.querySelector('[data-anc-nav=visit]').click();document.querySelector('#anc-tasks details').open=false");
    await screenshot('anc-desktop.png');
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    assert.equal(await browser.evaluate('document.documentElement.scrollWidth<=innerWidth+1'), true, 'no ANC page overflow on phone');
    await screenshot('anc-mobile.png');
    await browser.evaluate("window.print=()=>{};document.querySelector('[data-action=print]').click()");
    assert.equal(await browser.evaluate("document.querySelectorAll('#anc-print .anc-print-page').length"), 2);
    await browser.send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 900, deviceScaleFactor: 1, mobile: false });
    await browser.send('Emulation.setEmulatedMedia', { media: 'print' });
    await screenshot('anc-print.png');
    const pdf = await browser.send('Page.printToPDF', { printBackground: true, preferCSSPageSize: true, landscape: true });
    fs.writeFileSync(path.join(evidence, 'anc.pdf'), Buffer.from(pdf.data, 'base64'));
    assert.ok(Buffer.from(pdf.data, 'base64').length > 10000);
  } catch (error) { console.log(browser?.state.errors); throw error; }
  finally { browser?.close(); await new Promise(resolve => app.server.close(resolve)); app.database.close(); }
});
