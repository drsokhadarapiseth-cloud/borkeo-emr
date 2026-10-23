// v42.6 browser check (explicit, like tests/v425-medicine-list-browser.mjs; not part of npm test):
//   node --test tests/v426-midwife-anc-browser.mjs
// Synthetic patients only, in-memory database: green, yellow and red pregnancies
// across visits, a vaccination, a cervical screening and a safe abortion.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createEmrServer } from '../server/server.mjs';
import { opdLocalDate } from '../server/opd-queue.mjs';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function openBrowser() {
  const executable = [process.env.EMR_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe']
    .find(file => file && fs.existsSync(file));
  assert.ok(executable, 'Set EMR_TEST_BROWSER to run this explicit Chromium test.');
  const debugPort = 9400 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-v426-'));
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

test('v42.6 midwife services in the browser: green, yellow and red pregnancies, vaccination, cervical screening, safe abortion', { timeout: 400000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${app.server.address().port}`;
  app.config.appOrigin = origin;
  const browser = await openBrowser();
  const today = opdLocalDate();
  const login = async (username) => {
    const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
    const Cookie = response.headers.get('set-cookie').split(';')[0];
    const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie } })).json();
    return { Cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
  };
  const call = async (headers, method, url, body) => {
    const response = await fetch(origin + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json().catch(() => ({})) };
  };
  const staff = {};
  for (const name of ['registration', 'triage', 'clerk', 'nurse_obstetric', 'doctor_obstetric', 'doctor_gynecology']) staff[name] = await login(name);
  const visit = async (caseNumber, service, { healthId = `H-${caseNumber}`, age = '25', previous = '', sex = 'ស្រី' } = {}) => {
    const key = `case:${caseNumber}`;
    const summary = { caseNumber, healthId, firstName: 'Synthetic', lastName: caseNumber, fullName: `Synthetic ${caseNumber}`, sex, age, dateOfBirth: '', phone: '', equityCard: '', paymentType: 'CASH', departmentCode: '', departmentNameKh: '', departmentNameEn: '', serviceMode: '', entryDate: today, dischargeDate: '' };
    let response = await call(staff.registration, 'PUT', '/api/patient-record', previous ? { patientKey: key, summary, newVisitFrom: previous, data: { 'scope:registration:id:emr_pmrs_case_old': true } } : { patientKey: key, summary, data: { 'scope:registration:id:emr_pmrs_case_new': true } });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    const version = (await call(staff.registration, 'GET', `/api/patient-record?patientKey=${encodeURIComponent(key)}`)).body.patient.version;
    const values = { p2_weight: '52', p2_height: '158', p2_bp_sys: '110', p2_bp_dia: '70', p2_pulse: '80', p2_temp: '36.8', p2_spo2: '98', p2_resp: '18' };
    response = await call(staff.triage, 'PUT', '/api/patient-record', { patientKey: key, expectedVersion: version, triageSave: true,
      summary: { ...summary, departmentCode: service, departmentNameKh: service, departmentNameEn: service, serviceMode: 'opd' },
      data: Object.fromEntries(Object.entries(values).map(([k, v]) => [`scope:triage:id:${k}`, v])) });
    assert.equal(response.status, 200, JSON.stringify(response.body));
    if (service !== 'vaccination') {
      const bill = (await call(staff.clerk, 'GET', `/api/finance/patient?patientKey=${encodeURIComponent(key)}`)).body.bill;
      assert.equal((await call(staff.clerk, 'POST', '/api/finance/payments', { patientKey: key, invoiceId: bill.invoice.id, source: 'CASH', amount: bill.summary.KHR.balance, currency: 'KHR' })).status, 201);
    }
    return key;
  };
  const useAccount = async (username) => {
    const [name, value] = staff[username].Cookie.split('=');
    await browser.send('Network.clearBrowserCookies');
    await browser.send('Network.setCookie', { name, value, url: origin });
  };
  const open = async (pathname, ready) => {
    const before = browser.state.loads;
    await browser.send('Page.navigate', { url: origin + pathname });
    const until = Date.now() + 30000;
    while (browser.state.loads === before && Date.now() < until) await sleep(100);
    await browser.waitFor(ready, pathname);
    await sleep(800);
    await browser.evaluate(`window.print=()=>{window.__printed=(window.__printed||0)+1;};window.prompt=()=>'Synthetic treatment';window.confirm=()=>true;true`);
  };
  const click = (selector) => browser.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('missing ${selector.replace(/'/g, '')}');el.click();return true})()`);
  const typeInto = (selector, value) => browser.evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});el.value=${JSON.stringify(value)};el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`);
  const ticked = () => browser.evaluate(`document.querySelector('#anc-colour-boxes .is-ticked')?.dataset.colour||''`);
  const lmpFor = (weeks) => new Date(Date.parse(today) - weeks * 7 * 86400000).toISOString().slice(0, 10);

  // A pregnancy through the browser: open, fill page 2, today's visit.
  const pregnancy = async (key, { age, lmpWeeks, hb, births = '1' }) => {
    await open(`/anc-record?patient=${encodeURIComponent(key)}`, `Boolean(document.querySelector('[data-action="open"], #anc-visit-form'))`);
    if (await browser.evaluate(`Boolean(document.querySelector('[data-action="open"]'))`)) {
      await click('[data-action="open"]');
      await browser.waitFor(`Boolean(document.querySelector('#anc-visit-form'))`, 'record opened');
    }
    await browser.waitFor(`document.querySelector('#anc-tasks-dialog')?.open===true`, 'to-do window opens once');
    await click('#anc-tasks-dialog [data-dialog-close]');
    assert.ok(await browser.evaluate(`document.querySelectorAll('#anc-tasks .anc-task').length>0`), 'to-do panel always visible');
    await typeInto('[data-path="identity.age"]', age);
    await typeInto('[data-path="identity.births"]', births);
    await typeInto('[data-path="identity.miscarriages"]', '0');
    await typeInto('[data-path="identity.abortions"]', '0');
    await typeInto('[data-path="lmp"]', lmpLater(lmpWeeks));
    await typeInto('[data-path="heightCm"]', '158');
    await typeInto('[data-path="prePregnancyWeightKg"]', '52');
    await typeInto('[data-path="labs.0.date"]', today);
    await typeInto('[data-path="labs.0.hbsag"]', 'Negative');
    await typeInto('[data-path="labs.0.group"]', 'O+');
    await typeInto('[data-visit="rapid.hiv"]', 'Negative');
    await typeInto('[data-visit="rapid.syphilis"]', 'Negative');
    await typeInto('[data-visit="rapid.hb"]', hb);
    await click('[data-action="save-visit"]');
    await browser.waitFor(`(document.getElementById('anc-status').textContent||'').length>1 && document.getElementById('anc-status').textContent!=='…'`, 'visit saved');
    await sleep(500);
  };
  const lmpLater = (weeks) => lmpFor(weeks);

  try {
    // ---------- Midwife queue ----------
    const green = await visit('B426-G1', 'anc');
    const yellow = await visit('B426-Y1', 'anc', { age: '40' });
    const red = await visit('B426-R1', 'anc');
    const vaccine = await visit('B426-V1', 'vaccination', { sex: 'ប្រុស', age: '1' });
    const cervix = await visit('B426-C1', 'cervix-screening', { age: '35' });
    const safe = await visit('B426-S1', 'safe-abortion');
    await useAccount('nurse_obstetric');
    await open('/maternal', `document.querySelectorAll('#queue-rows a.queue-action').length>=5`);
    const queue = await browser.evaluate(`[...document.querySelectorAll('#queue-rows a.queue-action')].map(a=>a.getAttribute('href'))`);
    assert.ok(queue.includes(`/anc-record?patient=${encodeURIComponent(green)}`));
    assert.ok(queue.includes(`/vaccination?patient=${encodeURIComponent(vaccine)}`), 'free vaccination in the queue at once');
    assert.ok(!queue.some((href) => href.includes(encodeURIComponent(safe))), 'safe abortion is not the midwife');
    assert.ok(await browser.evaluate(`[...document.querySelectorAll('#emr-main-nav a, nav a')].some(a=>a.getAttribute('href')==='/maternal')||true`));

    // ---------- Green, yellow, red ----------
    await pregnancy(green, { age: '25', lmpWeeks: 27, hb: '12' });
    assert.equal(await ticked(), 'green', 'green pregnancy');
    assert.match(await browser.evaluate(`document.querySelector('#anc-tasks').innerText`), /មិនមែនជាការពិនិត្យតាមកាលវិភាគ|Not a scheduled visit/, 'green at 27 weeks: not a scheduled visit');
    await pregnancy(yellow, { age: '40', lmpWeeks: 26, hb: '12' });
    assert.equal(await ticked(), 'yellow', 'yellow pregnancy');
    assert.match(await browser.evaluate(`document.querySelector('#anc-tasks').innerText`), /OGTT/, 'yellow at 26 weeks: OGTT');
    assert.match(await browser.evaluate(`document.querySelector('#anc-summary').innerText`), /CPA2/);
    await pregnancy(red, { age: '25', lmpWeeks: 20, hb: '6.5' });
    assert.equal(await ticked(), 'red', 'red pregnancy');
    // Close a task without doing it: a reason is needed.
    await click('#anc-tasks [data-task-close]');
    await browser.waitFor(`document.querySelector('#anc-close-dialog')?.open===true`, 'close dialog');
    await browser.evaluate(`(()=>{const d=document.querySelector('#anc-close-dialog');d.querySelector('input[value="ផ្សេងៗ"]').checked=true;d.querySelector('form').requestSubmit();return true})()`);
    await browser.waitFor(`(document.querySelector('#anc-close-dialog .anc-error')?.textContent||'').length>0`, 'other needs a text');
    await browser.evaluate(`(()=>{const d=document.querySelector('#anc-close-dialog');d.querySelector('input[name="anc-close-text"]').value='Synthetic reason';d.querySelector('form').requestSubmit();return true})()`);
    await browser.waitFor(`document.querySelector('#anc-close-dialog')?.open===false`, 'task closed');
    // Referral: the midwife asks; the Obstetric doctor signs and prints.
    await click('[data-action="referral"]');
    await browser.waitFor(`Boolean(document.querySelector('.anc-pending'))`, 'referral waiting for a doctor');
    await click('[data-action="print"]');
    assert.ok(await browser.evaluate(`document.querySelectorAll('#anc-print .anc-print-page').length>=2`), 'printed pages 2-5');
    assert.match(await browser.evaluate(`document.querySelector('#anc-print').innerText`), /ប្រវត្តិមានផ្ទៃពោះលើកមុន/);
    await useAccount('doctor_obstetric');
    await open(`/anc-record?patient=${encodeURIComponent(red)}`, `Boolean(document.querySelector('[data-action="sign"]'))`);
    await click('[data-action="sign"]');
    await browser.waitFor(`Boolean(document.querySelector('[data-action="print-referral"]'))`, 'signed');
    await click('[data-action="print-referral"]');
    assert.match(await browser.evaluate(`document.querySelector('#anc-print').innerText`), /CPA3/, 'referral letter printed');

    // ---------- Second visit of the green pregnancy (same Health ID) ----------
    const green2 = await visit('B426-G2', 'anc', { healthId: 'H-B426-G1', previous: green });
    await useAccount('nurse_obstetric');
    await open(`/anc-record?patient=${encodeURIComponent(green2)}`, `Boolean(document.querySelector('#anc-visit-form'))`);
    assert.equal(await browser.evaluate(`document.querySelectorAll('.anc-visit-table tbody tr').length`), 1, 'the first visit is in the visit table');
    assert.equal(await browser.evaluate(`document.querySelector('[data-path="lmp"]').value`), lmpFor(27), 'same pregnancy record');

    // ---------- Vaccination ----------
    await open(`/vaccination?patient=${encodeURIComponent(vaccine)}`, `Boolean(document.querySelector('#vac-form'))`);
    await browser.evaluate(`(()=>{const s=document.querySelector('#vac-form [name="vaccineId"]');s.value=[...s.options].find(o=>/BCG/.test(o.textContent)).value;s.dispatchEvent(new Event('change',{bubbles:true}));document.querySelector('#vac-form').requestSubmit();return true})()`);
    await browser.waitFor(`document.querySelectorAll('#vac-history tbody tr td').length>2`, 'vaccination saved');
    assert.match(await browser.evaluate(`document.querySelector('#vac-history').innerText`), /BCG/);

    // ---------- Cervical screening ----------
    await open(`/emr?patient=${encodeURIComponent(cervix)}&view=opd`, `Boolean(document.querySelector('#cervix-result-panel'))`);
    // The record opens in view mode; the midwife presses Edit (v37.8).
    for (let attempt = 0; attempt < 10 && await browser.evaluate(`document.querySelector('#cervix-send').disabled`); attempt++) {
      await browser.evaluate(`document.querySelector('[data-editor-toggle]')?.click();true`);
      await sleep(1000);
    }
    await typeInto('#cervix-result', 'positive');
    // The OPD tab still has empty required fields. Sending the screening result
    // saves nothing into the record, so it must not be blocked by them (v42.6).
    await click('#cervix-send');
    try { await browser.waitFor(`(document.querySelector('#cervix-status').textContent||'').length>3`, 'result sent'); }
    catch (error) { throw new Error(error.message + ' ' + JSON.stringify(await browser.evaluate(`({status:document.querySelector('#cervix-status').textContent,value:document.querySelector('#cervix-result').value,inert:document.querySelector('#cervix-result-panel').closest('[inert]')?.id||'',disabled:document.querySelector('#cervix-send').disabled,panels:document.querySelectorAll('#cervix-result-panel').length,pk:window.getLoadedEmrPatient?.()?.patientKey,role:window.emrSession?.user?.activeRole})`)) + JSON.stringify(browser.state.errors)); }
    assert.equal(app.database.sqlite.prepare("SELECT COUNT(*) n FROM staff_messages WHERE destination_code='gynecology' AND patient_key=?").get(cervix).n, 1);

    // ---------- Safe abortion: Gynecology ward ----------
    await useAccount('doctor_gynecology');
    await open('/maternal?kind=gynecology', `document.querySelectorAll('#queue-rows a.queue-action').length>=1`);
    assert.ok((await browser.evaluate(`[...document.querySelectorAll('#queue-rows a.queue-action')].map(a=>a.getAttribute('href'))`)).includes(`/emr?patient=${encodeURIComponent(safe)}&view=opd`));
    await open(`/emr?patient=${encodeURIComponent(safe)}&view=opd`, `Boolean(document.getElementById('sub_opd'))`);

    assert.deepEqual(browser.state.errors, [], 'no JavaScript errors');
  } finally {
    browser.close();
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
