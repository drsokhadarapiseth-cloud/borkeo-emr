// v42.5 browser check (explicit, like tests/v378-encounter-browser.mjs; not part of npm test):
//   node --test tests/v425-medicine-list-browser.mjs
// (v42.3 file, updated for the two-step search, the patient filter and the
// maximum dose check.) Synthetic patients only, in-memory database: an adult
// (IPD admission, nursing chart, daily note, discharge), a 5-year-old (OPD) and a
// pregnant woman (Obstetric ward). Type "par", choose the name, then the form
// with the keyboard, add a row with "+", type a dose, save, reopen, print.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createEmrServer } from '../server/server.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function openBrowser() {
  const executable = [process.env.EMR_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe']
    .find(file => file && fs.existsSync(file));
  assert.ok(executable, 'Set EMR_TEST_BROWSER to run this explicit Chromium test.');
  const debugPort = 9400 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-v425-'));
  const child = spawn(executable, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  let url;
  for (let i = 0; i < 80 && !url; i++) {
    try { url = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page')?.webSocketDebuggerUrl; } catch {}
    if (!url) await sleep(250);
  }
  const ws = new WebSocket(url);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let seq = 0;
  const pending = new Map();
  const state = { loads: 0, errors: [] };
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); return; }
    if (message.method === 'Page.loadEventFired') state.loads++;
    if (message.method === 'Runtime.exceptionThrown') state.errors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
    if (message.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, message => message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label, timeout = 20000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) { try { if (await evaluate(expression)) return; } catch {} await sleep(150); }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const key = async (keyName, code) => {
    const keyCode = { ArrowDown: 40, ArrowUp: 38, Enter: 13, Escape: 27, Backspace: 8 }[keyName];
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: keyName, code: code || keyName, windowsVirtualKeyCode: keyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: code || keyName, windowsVirtualKeyCode: keyCode });
  };
  const type = text => send('Input.insertText', { text });
  const close = () => { ws.close(); child.kill(); };
  return { send, evaluate, waitFor, key, type, close, state };
}

test('v42.5 medicine list and dose check in the OPD, IPD admission, daily note and discharge prescriptions', { timeout: 400000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  app.config.appOrigin = origin;
  const db = app.database;
  const browser = await openBrowser();
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Phnom_Penh' }).format(new Date());
  const api = async (username) => {
    const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    const Cookie = response.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie } })).json();
    return { Cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
  };
  const useAccount = async username => {
    const headers = await api(username);
    const [name, value] = headers.Cookie.split('=');
    await browser.send('Network.clearBrowserCookies');
    await browser.send('Network.setCookie', { name, value, url: origin });
  };
  const open = async (pathname, ready) => {
    const before = browser.state.loads;
    await browser.send('Page.navigate', { url: origin + pathname });
    const until = Date.now() + 30000;
    while (browser.state.loads === before && Date.now() < until) await sleep(100);
    await browser.waitFor(ready, pathname);
    await sleep(1500);
    // Capture what would be printed instead of opening the print window.
    await browser.evaluate(`window.__printed=[];window.printEmrReport=async(o)=>{window.__printed.push((o.selectors||[]).map(s=>[...document.querySelectorAll(s)].map(e=>e.innerText).join('\\n')).join('\\n'));};true`);
  };
  // Type "par" into a name box (the last match of the selector). Step 1 must show
  // the one name Paracetamol; Enter opens step 2 (forms for this patient), where
  // the form containing `form` (default: the 2nd line) is chosen with the keyboard.
  // Returns { label, names, forms }.
  const choosePar = async (nameSelector, form = null, query = 'par', expectedName = 'Paracetamol') => {
    await browser.evaluate(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(nameSelector)})].at(-1);el.scrollIntoView({block:'center'});el.focus();el.value='';return true})()`);
    await browser.type(query);
    try {
      await browser.waitFor(`document.querySelectorAll('.bk-med-list .bk-med-name, .bk-med-list .bk-med-form').length>0`, 'medicine list');
    } catch (error) {
      const why = await browser.evaluate(`(()=>{const el=[...document.querySelectorAll(${JSON.stringify(nameSelector)})].at(-1);return JSON.stringify({value:el.value,focused:document.activeElement===el,list:document.querySelectorAll('.bk-med-list').length,lib:Boolean(window.BorkeoMedicine)})})()`);
      throw new Error(`${error.message}: ${why}`);
    }
    const names = await browser.evaluate(`[...document.querySelectorAll('.bk-med-list .bk-med-name .bk-med-label')].map(e=>e.innerText)`);
    assert.deepEqual(names, [expectedName], `step 1 shows the name once (${query})`);
    await browser.key('Enter');
    await browser.waitFor(`document.querySelectorAll('.bk-med-list .bk-med-form').length>0 || !document.querySelector('.bk-med-list')`, 'step 2');
    const forms = await browser.evaluate(`[...document.querySelectorAll('.bk-med-list .bk-med-form .bk-med-label')].map(e=>e.innerText)`);
    if (forms.length) {
      // Backspace returns to the names; Enter opens the forms again.
      await browser.key('Backspace');
      await browser.waitFor(`document.querySelectorAll('.bk-med-list .bk-med-name').length===1`, 'back to step 1');
      await browser.key('Enter');
      await browser.waitFor(`document.querySelectorAll('.bk-med-list .bk-med-form').length>0`, 'step 2 again');
      const index = form === null ? 1 : forms.findIndex(text => text.split('\n')[0] === form);
      assert.ok(index >= 0, `form ${form} offered: ${forms.join(' | ')}`);
      for (let i = 0; i < index; i++) await browser.key('ArrowDown');
      await browser.key('Enter');
    }
    await browser.waitFor(`!document.querySelector('.bk-med-list')`, 'list closed');
    const label = await browser.evaluate(`[...document.querySelectorAll(${JSON.stringify(nameSelector)})].at(-1).value`);
    return { label, names, forms: forms.map(text => text.split('\n')[0]) };
  };
  const rowState = (rowSelector, prefix) => browser.evaluate(`(()=>{const rows=[...document.querySelectorAll(${JSON.stringify(rowSelector)})];return rows.map(r=>{
      const q=s=>r.querySelector(s);const name=q(${JSON.stringify(prefix ? `.${prefix}-name` : '[data-med="name"]')}),dose=q(${JSON.stringify(prefix ? `.${prefix}-dose` : '[data-med="doseAmount"]')}),
      unit=q(${JSON.stringify(prefix ? `.${prefix}-unit` : '[data-med="unit"]')}),route=q(${JSON.stringify(prefix ? `.${prefix}-route` : '[data-med="route"]')}),total=q(${JSON.stringify(prefix ? `.${prefix}-total` : '[data-med="total"]')});
      return {name:name?.value||'',cms:name?.dataset.cmsCode||'',dose:dose?.value??'',unit:unit?.value||'',route:route?.value??'',total:total?.value??'',focused:document.activeElement===dose,
        routeMessage:r.querySelector('.medication-route-message')?.textContent||''}})})()`);
  const labelOf = choice => choice.label.trim();
  // A record may open in view mode; the doctor presses Edit (v37.8).
  const ensureEditMode = async (controlSelector) => {
    const editable = `(()=>{const c=document.querySelector(${JSON.stringify(controlSelector)});return Boolean(c&&!c.disabled&&!c.readOnly)})()`;
    // The Edit button may be pressed before the page's editor is ready: retry.
    for (let attempt = 0; attempt < 10 && !(await browser.evaluate(editable)); attempt++) {
      await browser.evaluate(`document.querySelector('[data-editor-toggle]')?.click();true`);
      await sleep(1000);
    }
    await browser.waitFor(editable, 'edit mode');
    await sleep(1000);
  };
  // The record page builds the patient summary from these registration fields.
  const registrationFields = (caseNumber, firstName, age) => ({
    'scope:registration:id:web_adm_no': caseNumber, 'scope:registration:id:web_health_id': 'H-' + caseNumber,
    'scope:registration:id:web_first_name': firstName, 'scope:registration:id:web_last_name': 'Synthetic',
    'scope:registration:id:web_age': age, 'scope:registration:id:web_date': today,
  });
  // Existing required fields of the record (allergy substance, problem list ...)
  // get synthetic text, so the save is decided only by the medication rules.
  const fillRequired = () => browser.evaluate(`(()=>{const scope=document.querySelector('.page.active .sub-tab.active')||document.querySelector('.page.active');
    window.BorkeoRequiredFields?.validate(scope);
    document.querySelectorAll('.emr-required-missing').forEach(e=>{if('value' in e && !e.value){e.value='Synthetic';e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}});
    return window.BorkeoRequiredFields?.validate(scope)!==false})()`);
  const catalogue = JSON.parse(fs.readFileSync(new URL('../server/catalogues/medicines-eml-2024.json', import.meta.url), 'utf8'));
  const expectedUnit = label => {
    const item = catalogue.find(entry => entry.label === label);
    return { 'ក្រាម': 'g', 'ដង': 'បាញ់' }[item.unit] || item.unit;
  };
  const doseNote = rowSelector => browser.evaluate(`[...document.querySelectorAll(${JSON.stringify(rowSelector)})].map(r=>r.querySelector('.medication-dose-note')?.textContent||'')`);
  const warningOpen = () => browser.evaluate(`Boolean(document.querySelector('#safety-warning-dialog[open]'))`);
  const warningText = () => browser.evaluate(`document.querySelector('#safety-warning-dialog[open]')?.innerText||''`);
  // Writes the reason in the open warning and continues.
  const continueWithReason = async reason => {
    await browser.evaluate(`(()=>{const d=document.querySelector('#safety-warning-dialog[open]');d.querySelector('[name="safety-reason"]').value=${JSON.stringify(reason)};d.querySelector('[data-safety-continue]').click();return true})()`);
    await browser.waitFor(`!document.querySelector('#safety-warning-dialog[open]')`, 'warning closed');
  };

  try {
    // ---------- Synthetic patients ----------
    const admin = db.findUser('admin').id;
    const ipdKey = 'case:V423-IPD';
    const oldLine = { rowType: 'regularRow', name: 'Old saved line', route: 'po', unit: 'ម.ក្រ', m: '1', a: '0', e: '1', n: '0', d: '3', total: '6', note: '', doseAmount: '1', scheduleType: 'bid' };
    const sixLines = Array.from({ length: 6 }, (_, i) => ({ ...oldLine, name: `Old saved line ${i + 1}` }));
    db.upsertPatient({ id: crypto.randomUUID(), patientKey: ipdKey, userId: admin, savedAt: Date.now(),
      summary: { caseNumber: 'V423-IPD', healthId: 'H-V423-IPD', firstName: 'Ipd', lastName: 'Synthetic', fullName: 'Ipd Synthetic', sex: 'ប្រុស', age: '45', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'DIRECT', departmentCode: 'medicine', departmentNameKh: 'ផ្នែកជំងឺទូទៅ', departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: today, dischargeDate: '' },
      data: { ...registrationFields('V423-IPD', 'Ipd', '45'), 'system:triageStatus': 'COMPLETED', 'system:admissionStatus': 'admitted', 'system:currentWardCode': 'medicine',
        'scope:medical:id:ipd_first_exam_date': today, 'system:initialIpdMedications': JSON.stringify(sixLines) } });

    // The maximum dose (approved before the record opens) of paracetamol is approved by the Head of Pharmacy.
    const pharmacist = await api('pharmacy');
    const doseLine = (await (await fetch(origin + '/api/drug-safety', { headers: pharmacist })).json()).maxDoses.find(row => row.doseKey === 'paracetamol|ORAL');
    assert.equal((await fetch(origin + `/api/drug-safety/max-doses/${doseLine.id}/approve`, { method: 'POST', headers: pharmacist, body: '{}' })).status, 200);
    // ---------- IPD admission prescription ----------
    await useAccount('doctor_medicine');
    await open(`/emr?patient=${encodeURIComponent(ipdKey)}&view=medical`, `document.querySelectorAll('#rx_tbody tr.rx-main-row').length>=6`);
    let rows = await rowState('#rx_tbody tr.rx-main-row', 'rx');
    assert.equal(rows.length, 6, 'a saved record with 6 lines shows all 6');
    assert.deepEqual([rows[0].name, rows[0].unit, rows[0].route, rows[0].dose], ['Old saved line 1', 'mg', 'po', '1'], 'old line: unit shown as mg, route PO, dose 1');
    await browser.evaluate(`addRxRow(true);true`);
    rows = await rowState('#rx_tbody tr.rx-main-row', 'rx');
    assert.deepEqual([rows[6].dose, rows[6].route, rows[6].total], ['', '', ''], '"+" row: blank number, route and total (no NaN)');
    const ipdChoice = await choosePar('#rx_tbody tr.rx-main-row .rx-name', 'AA0411 · Tablet · 500 mg');
    assert.ok(!ipdChoice.forms.some(form => /\[c\]/.test(form)), 'adult: child-only lines (marked [c]) hidden');
    const ipdLabel = labelOf(ipdChoice);
    rows = await rowState('#rx_tbody tr.rx-main-row', 'rx');
    let chosen = rows.at(-1);
    assert.equal(chosen.name, ipdLabel, 'name box gets CMS code-Name-Form-Strength');
    assert.equal(chosen.unit, expectedUnit(ipdLabel));
    assert.deepEqual([chosen.dose, chosen.route, chosen.focused], ['', '', true], 'number cleared and focused; route not filled');
    assert.notEqual(chosen.total, 'NaN');
    // 4 tablets of 500 mg TID: red alert (2 g per dose, 6 g per day).
    await browser.type('4');
    await browser.evaluate(`(()=>{const t=[...document.querySelectorAll('#rx_tbody tr.rx-main-row .med-schedule-type')].at(-1);t.value='tid';t.dispatchEvent(new Event('change',{bubbles:true}));handleMedicationScheduleChange(t);return true})()`);
    await browser.waitFor(`Boolean(document.querySelector('#safety-warning-dialog[open]'))`, 'red maximum dose alert');
    assert.match(await warningText(), /2000 mg/);
    assert.match(await warningText(), /6000 mg/);
    // Closed without a reason: the save is refused and the alert opens again.
    await browser.evaluate(`document.querySelector('#safety-warning-dialog').close();true`);
    await browser.evaluate(`(()=>{const s=[...document.querySelectorAll('#rx_tbody tr.rx-main-row .rx-route')].at(-1);s.value='po';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
    assert.equal(await fillRequired(), true, 'required record fields filled');
    assert.equal(await browser.evaluate(`window.savePatientRecord()`), false, 'above the maximum without a reason: not saved');
    assert.equal(await warningOpen(), true, 'the alert opens again on save');
    await continueWithReason('Synthetic evidence: loading dose');
    // The route is chosen again below (the save without a route is refused first).
    await browser.evaluate(`(()=>{const s=[...document.querySelectorAll('#rx_tbody tr.rx-main-row .rx-route')].at(-1);s.value='';s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
    // Save without a route: refused with the Khmer message next to the row.
    assert.equal(await fillRequired(), true, 'required record fields filled');
    assert.equal(await browser.evaluate(`window.savePatientRecord()`), false);
    rows = await rowState('#rx_tbody tr.rx-main-row', 'rx');
    assert.equal(rows.at(-1).routeMessage, 'សូមជ្រើសរើសផ្លូវប្រើថ្នាំ');
    assert.equal(rows[0].routeMessage, '', 'rows with a route are fine; empty rows are ignored');
    await browser.evaluate(`(()=>{const s=[...document.querySelectorAll('#rx_tbody tr.rx-main-row .rx-route')].at(-1);s.value='po';s.dispatchEvent(new Event('change',{bubbles:true}));const t=[...document.querySelectorAll('#rx_tbody tr.rx-main-row .med-schedule-type')].at(-1);t.value='bid';handleMedicationScheduleChange(t);return true})()`);
    assert.equal(await warningOpen(), false);
    assert.equal(await browser.evaluate(`window.savePatientRecord()`), true, 'saved once a route is chosen');
    let stored = JSON.parse(JSON.parse(db.findPatient(ipdKey).record_json)['system:initialIpdMedications']);
    assert.equal(stored.length, 7);
    // An old line keeps its values; when the user saves the record again, the
    // unit is written in the new form (mg) and no cmsCode is added.
    assert.deepEqual([stored[0].name, stored[0].route, stored[0].doseAmount, stored[0].d, stored[0].total, stored[0].unit, 'cmsCode' in stored[0]],
      ['Old saved line 1', 'po', '1', '3', '6', 'mg', false]);
    const ipdItem = catalogue.find(entry => entry.label === ipdLabel);
    assert.equal(stored[6].cmsCode || '', ipdItem.code, 'cmsCode saved with the chosen medicine');
    assert.equal(stored[6].doseAmount, '4');
    assert.equal(stored[6].doseOverrideReason, 'Synthetic evidence: loading dose', 'the reason is saved with the line');
    await browser.evaluate(`window.printPrescription('ipd')`);
    const ipdPrint = await browser.evaluate(`window.__printed.join('\\n')`);
    assert.match(ipdPrint, new RegExp(ipdItem.name.replace(/[()]/g, '.')), 'printed prescription has the medicine');
    assert.match(ipdPrint, /\bmg\b/, 'printed unit is mg, not the old Khmer label');
    // Reopen.
    await open(`/emr?patient=${encodeURIComponent(ipdKey)}&view=medical`, `document.querySelectorAll('#rx_tbody tr.rx-main-row').length>=7`);
    rows = await rowState('#rx_tbody tr.rx-main-row', 'rx');
    assert.deepEqual([rows[6].name, rows[6].cms, rows[6].dose, rows[6].route], [ipdLabel, ipdItem.code, '4', 'po'], 'reopened with name, CMS code, dose and route');
    // Adult man: oxytocin (women only) is not offered.
    await browser.evaluate(`(()=>{const el=[...document.querySelectorAll('#rx_tbody tr.rx-main-row .rx-name')].at(-1);el.focus();el.value='';return true})()`);
    await browser.type('oxyt');
    await browser.waitFor(`Boolean(document.querySelector('.bk-med-list .bk-med-empty'))`, 'no match for a man');
    assert.equal(await browser.evaluate(`document.querySelector('.bk-med-list .bk-med-empty').innerText`), 'រកមិនឃើញឱសថ');
    await browser.key('Escape');
    await browser.evaluate(`(()=>{const el=[...document.querySelectorAll('#rx_tbody tr.rx-main-row .rx-name')].at(-1);el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
    await browser.key('Escape');

    // ---------- Nursing medication chart (MAR) ----------
    await useAccount('nurse_medicine');
    await open(`/emr?patient=${encodeURIComponent(ipdKey)}&view=nursing`, `Boolean(document.getElementById('sub_nursing'))`);
    await browser.waitFor(`document.getElementById('sub_nursing').innerText.includes('Old saved line 1')`, 'nursing chart medicines');
    const chart = await browser.evaluate(`document.getElementById('sub_nursing').innerText`);
    assert.match(chart, new RegExp(ipdItem.name.replace(/[()]/g, '.')), 'the chosen medicine is on the nursing chart');
    assert.equal(chart.includes('ម.ក្រ'), false, 'old unit labels are shown as mg on the chart');
    await useAccount('doctor_medicine');

    // ---------- Daily note prescription ----------
    await open(`/emr?patient=${encodeURIComponent(ipdKey)}&view=daily`, `document.querySelectorAll('#mon_rx_tbody tr.mrx-main-row').length===3`);
    rows = await rowState('#mon_rx_tbody tr.mrx-main-row', 'mrx');
    assert.equal(rows.length, 3, 'the daily note starts with 3 rows');
    assert.ok(rows.every(row => row.dose === '' && row.route === ''), 'blank number and route');
    await browser.evaluate(`addMonRxRow(true);true`);
    assert.equal((await rowState('#mon_rx_tbody tr.mrx-main-row', 'mrx')).length, 4, '"+" adds a row');
    const dailyLabel = labelOf(await choosePar('#mon_rx_tbody tr.mrx-main-row:first-child .mrx-name'));
    await browser.type('1');
    await browser.evaluate(`(()=>{document.getElementById('mon_input_date').value=${JSON.stringify(today + 'T09:00')};
      for (const id of ['mon_input_temp']) document.getElementById(id).value='37';
      const s=document.querySelector('#mon_rx_tbody tr.mrx-main-row .mrx-route');s.value='po';s.dispatchEvent(new Event('change',{bubbles:true}));
      const t=document.querySelector('#mon_rx_tbody tr.mrx-main-row .med-schedule-type');t.value='bid';handleMedicationScheduleChange(t);
      if (window.EmrSoapNote) { for (const [id,v] of [['mon_soap_s','Synthetic S'],['mon_soap_a','Synthetic A']]) { const f=document.getElementById(id); if (f) { f.value=v; f.dispatchEvent(new Event('input',{bubbles:true})); } } }
      return true})()`);
    await fillRequired();
    await browser.evaluate(`window.saveDailyMonitoring()`);
    const savedDaily = () => JSON.parse(JSON.parse(db.findPatient(ipdKey).record_json)['system:dailyMonitoringRecords'] || '[]');
    for (let i = 0; i < 60 && !savedDaily().length; i++) await sleep(250);
    const daily = savedDaily();
    const dailyStatus = await browser.evaluate(`[document.getElementById('emr-record-status')?.textContent, document.querySelectorAll('#daily_monitoring_feed .ipd-mon-card').length, [...document.querySelectorAll('.medication-route-message')].length].join(' | ')`);
    assert.equal(daily.length, 1, `the daily note is saved (${dailyStatus})`);
    const dailyItem = catalogue.find(entry => entry.label === dailyLabel);
    assert.equal(daily[0].medications[0].name, dailyLabel);
    assert.equal(daily[0].medications[0].cmsCode || '', dailyItem.code);
    assert.equal(daily[0].medications[0].unit, expectedUnit(dailyLabel));
    await open(`/emr?patient=${encodeURIComponent(ipdKey)}&view=daily`, `document.querySelectorAll('#daily_monitoring_feed .ipd-mon-card').length===1`);
    assert.match(await browser.evaluate(`document.querySelector('#daily_monitoring_feed .ipd-mon-card').innerText`), new RegExp(dailyItem.name.replace(/[()]/g, '.')), 'reopened note shows the medicine');
    await browser.evaluate(`window.__printed=[];printMonitoringRecord(document.querySelector('#daily_monitoring_feed .ipd-mon-card button[onclick*="printMonitoringRecord"]'));true`);
    const dailyPrint = await browser.evaluate(`document.getElementById('monitoring-print-layout')?.innerText || ''`);
    assert.match(dailyPrint, new RegExp(dailyItem.name.replace(/[()]/g, '.')), 'printed daily note has the medicine');

    // ---------- Discharge medicines ----------
    // The discharge list starts as a copy of the latest daily note (existing behaviour).
    await open(`/emr?patient=${encodeURIComponent(ipdKey)}&view=discharge`, `document.querySelectorAll('#emr-discharge-rx-body tr').length===1`);
    rows = await rowState('#emr-discharge-rx-body tr', '');
    assert.deepEqual([rows[0].name, rows[0].route], [dailyLabel, 'po'], 'copied from the latest daily note');
    await sleep(2000);
    // The discharge form opens in view mode; the doctor presses Edit (v37.8).
    await browser.evaluate(`(()=>{if(document.getElementById('emr-discharge-add-rx').disabled)document.querySelector('[data-editor-toggle]')?.click();return true})()`);
    await browser.waitFor(`!document.getElementById('emr-discharge-add-rx').disabled`, 'discharge edit mode');
    await sleep(1000);
    await browser.evaluate(`document.getElementById('emr-discharge-add-rx').click();true`);
    await browser.waitFor(`document.querySelectorAll('#emr-discharge-rx-body tr').length===2`, 'discharge "+" row');
    rows = await rowState('#emr-discharge-rx-body tr', '');
    assert.deepEqual([rows.length, rows[1].route, rows[1].dose], [2, '', ''], '"+" discharge row: blank route and number');
    const dischargeLabel = labelOf(await choosePar('#emr-discharge-rx-body tr [data-med="name"]'));
    // v42.5: discharge medicines are checked too: a second paracetamol line is a duplicate.
    await browser.waitFor(`Boolean(document.querySelector('#safety-warning-dialog[open] .safety-duplicate'))`, 'duplicate warning');
    await continueWithReason('Synthetic: two forms on purpose');
    rows = await rowState('#emr-discharge-rx-body tr', '');
    assert.deepEqual([rows[1].name, rows[1].unit, rows[1].dose, rows[1].route, rows[1].focused], [dischargeLabel, expectedUnit(dischargeLabel), '', '', true]);
    await browser.type('1');
    await browser.evaluate(`(()=>{const v=(id,x)=>{const e=document.getElementById(id);if(e){e.value=x;e.dispatchEvent(new Event('input',{bubbles:true}));e.dispatchEvent(new Event('change',{bubbles:true}));}};
      v('emr_discharge_datetime',${JSON.stringify(today + 'T10:00')});v('emr_discharge_diagnosis','Synthetic diagnosis');
      const o=document.getElementById('emr_discharge_outcome');o.value=o.options[1].value;o.dispatchEvent(new Event('change',{bubbles:true}));
      const s=document.getElementById('emr_discharge_status');s.value=s.options[1].value;s.dispatchEvent(new Event('change',{bubbles:true}));
      document.getElementById('emr-save-discharge').click();return true})()`);
    await sleep(800);
    rows = await rowState('#emr-discharge-rx-body tr', '');
    assert.equal(rows[1].routeMessage, 'សូមជ្រើសរើសផ្លូវប្រើថ្នាំ', 'discharge medicine without a route is refused');
    assert.equal(rows[0].routeMessage, '');
    assert.equal(JSON.parse(db.findPatient(ipdKey).record_json)['system:discharge'], undefined, 'not saved');
    await browser.evaluate(`(()=>{const r=[...document.querySelectorAll('#emr-discharge-rx-body tr [data-med="route"]')].at(-1);r.value='po';r.dispatchEvent(new Event('change',{bubbles:true}));document.getElementById('emr-save-discharge').click();return true})()`);
    await browser.waitFor(`document.getElementById('emr-discharge-status')?.dataset.state==='saved'`, 'discharge saved');
    const discharge = JSON.parse(db.findPatient(ipdKey).record_json)['system:discharge'];
    const dischargeItem = catalogue.find(entry => entry.label === dischargeLabel);
    assert.equal(discharge.medications.length, 2);
    assert.equal(discharge.medications[1].name, dischargeLabel);
    assert.equal(discharge.medications[1].cmsCode || '', dischargeItem.code);
    assert.equal(discharge.medications[1].doseAmount, '1');
    assert.equal(discharge.medications[0].cmsCode || '', dailyItem.code, 'the copied daily line keeps its CMS code');
    await browser.evaluate(`window.__printed=[];window.printDischargeSummary();true`);
    assert.match(await browser.evaluate(`window.__printed.join('\\n')`), new RegExp(dischargeItem.name.replace(/[()]/g, '.')), 'printed discharge summary has the medicine');
    await open(`/emr?patient=${encodeURIComponent(ipdKey)}&view=discharge`, `document.querySelectorAll('#emr-discharge-rx-body tr').length>0`);
    rows = await rowState('#emr-discharge-rx-body tr', '');
    assert.deepEqual([rows[1].name, rows[1].cms, rows[1].route], [dischargeLabel, dischargeItem.code, 'po'], 'reopened discharge medicine');

    // ---------- OPD prescription ----------
    const opdKey = 'case:V423-OPD';
    const registration = await api('registration'), triage = await api('triage'), clerk = await api('clerk');
    const opdReg = { caseNumber: 'V423-OPD', healthId: 'H-V423-OPD', firstName: 'Opd', lastName: 'Synthetic', fullName: 'Opd Synthetic', sex: 'ស្រី', age: '5', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'CASH', departmentCode: '', departmentNameKh: '', departmentNameEn: '', serviceMode: '', entryDate: today, dischargeDate: '' };
    assert.equal((await fetch(origin + '/api/patient-record', { method: 'PUT', headers: registration, body: JSON.stringify({ patientKey: opdKey, summary: opdReg, data: { ...registrationFields('V423-OPD', 'Opd', '5'), 'scope:registration:id:emr_pmrs_case_new': true } }) })).status, 200);
    const version = (await (await fetch(origin + `/api/patient-record?patientKey=${encodeURIComponent(opdKey)}`, { headers: registration })).json()).patient.version;
    const opdSummary = { ...opdReg, departmentCode: 'opd', departmentNameKh: 'ពិគ្រោះក្រៅ', departmentNameEn: 'OPD', serviceMode: 'opd' };
    assert.equal((await fetch(origin + '/api/patient-record', { method: 'PUT', headers: triage, body: JSON.stringify({ patientKey: opdKey, summary: opdSummary, expectedVersion: version, data: { 'scope:triage:id:p2_temp': '37.1' } }) })).status, 200);
    const bill = (await (await fetch(origin + `/api/finance/patient?patientKey=${encodeURIComponent(opdKey)}`, { headers: clerk })).json()).bill;
    assert.equal((await fetch(origin + '/api/finance/payments', { method: 'POST', headers: clerk, body: JSON.stringify({ patientKey: opdKey, invoiceId: bill.invoice.id, source: 'CASH', amount: bill.summary.KHR.balance, currency: 'KHR' }) })).status, 201);
    await useAccount('doctor_opd');
    await open(`/emr?patient=${encodeURIComponent(opdKey)}&view=opd`, `document.querySelectorAll('#opd_rx_tbody tr.orx-main-row').length===3`);
    rows = await rowState('#opd_rx_tbody tr.orx-main-row', 'orx');
    assert.equal(rows.length, 3, 'the OPD prescription starts with 3 rows');
    assert.ok(rows.every(row => row.dose === '' && row.route === ''), 'blank number and route, no default PO');
    await ensureEditMode('#opd_rx_tbody .orx-name');
    await browser.evaluate(`document.querySelector('[onclick="addOpdRxRow()"]').click();true`);
    assert.equal((await rowState('#opd_rx_tbody tr.orx-main-row', 'orx')).length, 4, '"+" adds a row');
    // 5-year-old: the adult-only tablet line is hidden, the child syrup is offered.
    const opdChoice = await choosePar('#opd_rx_tbody tr.orx-main-row:first-child .orx-name', 'AA0410 · Tablet · 250 mg');
    assert.ok(!opdChoice.forms.includes('AA0410, AA0411 · Tablet · 500 mg'), 'adult-only line hidden for a child');
    assert.ok(opdChoice.forms.includes('AA0413 · Oral liquid · 125 mg/ 5mL [c]'), 'child line shown');
    const opdLabel = labelOf(opdChoice);
    await browser.type('1');
    // No weight recorded: orange note, no red alert.
    await browser.evaluate(`(()=>{const d=document.querySelector('#opd_rx_tbody tr.orx-main-row .orx-dose');d.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
    await browser.waitFor(`(document.querySelector('#opd_rx_tbody tr.orx-main-row .medication-dose-note')?.textContent||'').includes('បញ្ចូលទម្ងន់ ដើម្បីពិនិត្យកម្រិតថ្នាំ')`, 'orange weight note');
    assert.equal(await warningOpen(), false, 'no red alert without a weight');
    // Weight 10 kg: 250 mg is above 15 mg/kg (150 mg): red alert.
    await browser.evaluate(`(()=>{const w=document.getElementById('p2_weight');w.value='10';const d=document.querySelector('#opd_rx_tbody tr.orx-main-row .orx-dose');d.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
    await browser.waitFor(`Boolean(document.querySelector('#safety-warning-dialog[open]'))`, 'child red alert');
    assert.match(await warningText(), /250 mg/);
    assert.match(await warningText(), /150 mg/);
    await continueWithReason('Synthetic evidence: specialist advice');
    await browser.evaluate(`(()=>{const r=document.querySelector('#opd_rx_tbody tr.orx-main-row .orx-route');r.value='po';r.dispatchEvent(new Event('change',{bubbles:true}));
      const t=document.querySelector('#opd_rx_tbody tr.orx-main-row .med-schedule-type');t.value='bid';handleMedicationScheduleChange(t);
      const d=document.querySelector('#opd_rx_tbody tr.orx-main-row .orx-d');d.value='3';d.dispatchEvent(new Event('input',{bubbles:true}));return true})()`);
    // Free text is still allowed in another row.
    await browser.evaluate(`(()=>{const n=document.querySelectorAll('#opd_rx_tbody tr.orx-main-row .orx-name')[1];n.focus();return true})()`);
    await browser.type('Synthetic free text medicine');
    await browser.key('Escape');
    await browser.evaluate(`(()=>{const r=document.querySelectorAll('#opd_rx_tbody tr.orx-main-row .orx-route')[1];r.value='topical';r.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
    await fillRequired();
    assert.equal(await browser.evaluate(`window.savePatientRecord({submitOpdPrescription:true})`), true, 'OPD prescription saved and sent to Pharmacy');
    const opdStored = JSON.parse(JSON.parse(db.findPatient(opdKey).record_json)['system:opdMedications']);
    const opdItem = catalogue.find(entry => entry.label === opdLabel);
    assert.deepEqual(opdStored.map(med => [med.name, med.cmsCode || '', med.route]), [[opdLabel, opdItem.code, 'po'], ['Synthetic free text medicine', '', 'topical']]);
    assert.equal(opdStored[0].doseOverrideReason, 'Synthetic evidence: specialist advice');
    const total = Number(opdStored[0].total);
    assert.ok(Number.isFinite(total) && total === 6, `total 1 x BID x 3 days = 6 (got ${opdStored[0].total})`);
    const pharmacy = await api('pharmacy');
    const list = await (await fetch(origin + '/api/pharmacy/opd-prescriptions', { headers: pharmacy })).json();
    const rx = list.patients.find(item => item.patient?.healthId === 'H-V423-OPD');
    assert.ok(rx, 'Pharmacy received the prescription');
    const detail = await (await fetch(origin + `/api/pharmacy/opd-prescriptions/${rx.id}`, { headers: pharmacy })).json();
    assert.equal(detail.prescription.medications[0].name, opdLabel, 'Pharmacy sees the full list name');
    assert.equal((await fetch(origin + `/api/pharmacy/opd-prescriptions/${rx.id}/received`, { method: 'POST', headers: pharmacy })).status, 200, 'dispensed');
    await browser.evaluate(`window.__printed=[];window.printPrescription('opd');true`);
    assert.match(await browser.evaluate(`window.__printed.join('\\n')`), new RegExp(opdItem.name.replace(/[()]/g, '.')), 'printed OPD prescription has the medicine');
    await open(`/emr?patient=${encodeURIComponent(opdKey)}&view=opd`, `document.querySelectorAll('#opd_rx_tbody tr.orx-main-row').length>=3`);
    rows = await rowState('#opd_rx_tbody tr.orx-main-row', 'orx');
    assert.deepEqual([rows[0].name, rows[0].cms, rows[0].route, rows[0].dose], [opdLabel, opdItem.code, 'po', '1'], 'reopened OPD prescription');
    assert.equal(rows.length, 3, '2 saved lines + 1 empty row = 3 rows');

    // ---------- Pregnant woman (Obstetric ward) ----------
    const obKey = 'case:V425-OB';
    db.upsertPatient({ id: crypto.randomUUID(), patientKey: obKey, userId: admin, savedAt: Date.now(),
      summary: { caseNumber: 'V425-OB', healthId: 'H-V425-OB', firstName: 'Ob', lastName: 'Synthetic', fullName: 'Ob Synthetic', sex: 'ស្រី', age: '24', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'DIRECT', departmentCode: 'obstetric', departmentNameKh: 'ផ្នែកសម្ភព', departmentNameEn: 'Maternity', serviceMode: 'ipd', entryDate: today, dischargeDate: '' },
      data: { ...registrationFields('V425-OB', 'Ob', '24'), 'system:triageStatus': 'COMPLETED', 'system:admissionStatus': 'admitted', 'system:currentWardCode': 'obstetric',
        'scope:medical:id:ipd_first_exam_date': today } });
    await useAccount('doctor_obstetric');
    await open(`/emr?patient=${encodeURIComponent(obKey)}&view=medical`, `document.querySelectorAll('#rx_tbody tr.rx-main-row').length>=3`);
    const obChoice = await choosePar('#rx_tbody tr.rx-main-row:first-child .rx-name', null, 'oxyt', 'Oxytocin');
    assert.equal(obChoice.label, 'AB0440-Oxytocin-Injection-10 IU in 1-mL in ampoule', 'the only allowed line is chosen automatically');
    rows = await rowState('#rx_tbody tr.rx-main-row', 'rx');
    assert.deepEqual([rows[0].unit, rows[0].route, rows[0].dose], ['IU', '', ''], 'unit IU; route and number blank');
    const routeChoices = await browser.evaluate(`[...document.querySelector('#rx_tbody tr.rx-main-row .rx-route').options].map(o=>o.textContent)`);
    assert.deepEqual(routeChoices.slice(0, 4), ['-- ជ្រើស --', 'ចាក់សរសៃ (IV)', 'ចាក់សាច់ដុំ (IM)', 'ចាក់ក្រោមស្បែក (SC)'], 'simple injection routes');
    assert.equal(routeChoices.length, 11, 'blank + 10 routes: the old injection choices are not offered');

    assert.deepEqual(browser.state.errors, [], 'no JavaScript errors');
  } finally {
    browser.close();
    await new Promise(resolve => app.server.close(resolve));
    db.close();
  }
});
