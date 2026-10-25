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
    const before = JSON.stringify(app.database.findPatient(patientKey).data);
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
    assert.equal(JSON.stringify(app.database.findPatient(patientKey).data), before, 'cancel must preserve persisted patient data');
  } finally {
    browser?.close();
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
