// Explicit Chromium check with synthetic patients in an in-memory database.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmrServer } from '../server/server.mjs';
import { resetAndSeedThirtyTriagePatients } from '../scripts/seed-v301-thirty-triage-patients.mjs';
import { openBrowser } from './helpers/context-browser.mjs';

test('triage heading stays inside the form and cancel returns without saving', { timeout: 120000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0,
    appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test', npca: { enabled: false } });
  let browser;
  try {
    resetAndSeedThirtyTriagePatients(app.database);
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    app.config.appOrigin = origin;
    browser = await openBrowser();
    await browser.send('Page.navigate', { url: origin + '/login' });
    await browser.waitFor("document.getElementById('login-form')", 'login');
    assert.equal(await browser.evaluate(`(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'triage'})});return r.status})()`), 200);
    const patientKey = await browser.evaluate("(async()=>{const d=await (await fetch('/api/triage/queue')).json();return (d.waiting||d.patients)[0].patientKey})()");
    const before = app.database.findPatient(patientKey).record_json;
    await browser.send('Page.navigate', { url: origin + '/emr?' + new URLSearchParams({ patient: patientKey, view: 'triage', edit: '1' }) });
    await browser.waitFor(`window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(patientKey)} && document.body.dataset.encounterView==='triage'`, 'triage patient', 60000);
    for (const width of [1440, 390]) {
      await browser.send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 600 });
      await browser.evaluate('document.fonts.ready');
      const layout = await browser.evaluate(`(()=>{
        const visible=n=>!!n && getComputedStyle(n).display!=='none' && n.getBoundingClientRect().height>0;
        const page=document.getElementById('page2').getBoundingClientRect();
        const title=document.querySelector('#page2 [data-key="page2_title"]').getBoundingClientRect();
        const save=document.getElementById('triage_save_btn').getBoundingClientRect();
        const cancel=document.getElementById('triage_discard_btn').getBoundingClientRect();
        return {toolbar:[...document.querySelectorAll('.emr-encounter-toolbar')].some(visible),tabs:visible(document.getElementById('emr-chart-tabs-wrapper')),
          contained:title.top>=page.top+8 && title.bottom<=page.bottom && title.left>=page.left && title.right<=page.right,
          sameRow:Math.abs(save.top-cancel.top)<4,cancelEnabled:!document.getElementById('triage_discard_btn').disabled};
      })()`);
      assert.deepEqual(layout, { toolbar: false, tabs: false, contained: true, sameRow: true, cancelEnabled: true }, `width ${width}`);
    }
    await browser.evaluate(`(()=>{window.triageWrites=[];const original=window.fetch;window.fetch=(url,options={})=>{if(['POST','PUT','PATCH','DELETE'].includes((options.method||'GET').toUpperCase()))triageWrites.push(String(url));return original(url,options)};const field=document.getElementById('p2_temp');field.value='';field.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await browser.evaluate("document.getElementById('triage_discard_btn').click()");
    await browser.waitFor("location.pathname==='/triage' && document.getElementById('triage-body-waiting')", 'back to patient list');
    assert.equal(app.database.findPatient(patientKey).record_json, before, 'cancel must preserve persisted patient data');
    const openPatient = async () => {
      await browser.evaluate(`document.querySelector('a.triage-open[href*="'+encodeURIComponent(${JSON.stringify(patientKey)})+'"]').click()`);
      await browser.waitFor(`location.pathname==='/emr' && window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(patientKey)} && !document.getElementById('p2_temp').disabled`, 'direct editable triage', 60000);
      await browser.waitFor("!document.getElementById('triage_skip_btn').hidden", 'skip action');
    };
    await browser.waitFor("document.querySelector('#triage-body-waiting a.triage-open')", 'waiting patients');
    await openPatient();
    assert.equal(await browser.evaluate("Boolean(document.querySelector('#page2 button[onclick*=\"printAdmissionOnly\"]'))"), false);
    assert.equal(await browser.evaluate("Boolean(document.getElementById('print-admission'))"), true, 'admission form is preserved');
    await browser.evaluate(`(()=>{window.realFetch=window.fetch;window.fetch=(url,options)=>String(url)==='/api/queue/skip'?Promise.resolve(new Response(JSON.stringify({error:'PRIVATE DIAGNOSTIC'}),{status:503})):realFetch(url,options);document.getElementById('p2_temp').value='';document.getElementById('p2_temp').dispatchEvent(new Event('input',{bubbles:true}));document.getElementById('triage_skip_btn').click()})()`);
    await browser.waitFor("!document.getElementById('triage_skip_btn').disabled && document.body.textContent.includes('\u179f\u17bc\u1798\u1796\u17d2\u1799\u17b6\u1799\u17b6\u1798\u1798\u17d2\u178f\u1784\u1791\u17c0\u178f\u17d4')", 'safe skip error');
    assert.equal(await browser.evaluate("document.body.textContent.includes('PRIVATE DIAGNOSTIC')"), false);
    assert.equal(app.database.findPatient(patientKey).record_json, before);
    await browser.evaluate("window.fetch=window.realFetch;document.getElementById('triage_skip_btn').click()");
    await browser.waitFor(`location.pathname==='/triage' && [...document.querySelectorAll('#triage-body-skipped a.triage-open')].some(a=>new URL(a.href).searchParams.get('patient')===${JSON.stringify(patientKey)})`, 'skipped patient list');
    const skipped = await browser.evaluate(`(()=>{const a=[...document.querySelectorAll('#triage-body-skipped a.triage-open')].find(a=>new URL(a.href).searchParams.get('patient')===${JSON.stringify(patientKey)});return {text:a.textContent,edit:new URL(a.href).searchParams.get('edit'),view:new URL(a.href).searchParams.get('view')};})()`);
    assert.deepEqual(skipped, { text: '\u1794\u17c6\u1796\u17c1\u1789\u1791\u17d2\u179a\u17b8\u1799\u17c9\u17b6', edit: '1', view: 'triage' });
    assert.equal(await browser.evaluate(`[...document.querySelectorAll('#triage-body-waiting a.triage-open')].some(a=>new URL(a.href).searchParams.get('patient')===${JSON.stringify(patientKey)})`), false, 'skipped patient is removed from the waiting list');
    assert.equal(app.database.findPatient(patientKey).record_json, before, 'skip must not save unfinished fields');
    await openPatient();
    assert.equal(await browser.evaluate("window.EmrEncounterEditor.canWrite() && !document.getElementById('p2_temp').disabled"), true, 'skipped patients reopen directly without requesting edit');
  } catch (error) {
    console.log(await browser?.evaluate("({url:location.href,skip:{hidden:document.getElementById('triage_skip_btn')?.hidden,disabled:document.getElementById('triage_skip_btn')?.disabled},status:document.getElementById('emr-record-status')?.textContent,errors:window.triageWrites})"));
    console.log(browser?.state.errors);
    throw error;
  } finally {
    browser?.close();
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
