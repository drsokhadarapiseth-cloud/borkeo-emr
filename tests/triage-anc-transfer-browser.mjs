// Synthetic browser regression for the reported triage-to-ANC navigation failure.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';
import { buildCompleteRegistrationPatients } from '../scripts/create-complete-registration-fixture.mjs';
import { openBrowser } from './helpers/context-browser.mjs';

test('triage transfers ANC without opening the forbidden clinical page; midwife receives the patient', { timeout:180000 }, async () => {
  const app = createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false}});
  let browser;
  try {
    await new Promise(resolve => app.server.listen(0,'127.0.0.1',resolve));
    const origin=`http://127.0.0.1:${app.server.address().port}`; app.config.appOrigin=origin;
    const users={};
    for (const username of ['registration','triage','clerk','nurse_obstetric']) {
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      users[username]={Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    }
    const synthetic=buildCompleteRegistrationPatients()[1], key=synthetic.patientKey;
    const created=await fetch(origin+'/api/patient-record',{method:'PUT',headers:users.registration,body:JSON.stringify(synthetic)});
    assert.equal(created.status,200);
    browser=await openBrowser();
    await browser.send('Network.setBlockedURLs',{urls:['https://*']});
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"document.addEventListener('emr:patient-loaded',()=>{window.syntheticPatientReady=true})"});
    const use=async name => { const [cookieName,value]=users[name].Cookie.split('='); await browser.send('Network.clearBrowserCookies'); await browser.send('Network.setCookie',{name:cookieName,value,url:origin}); };
    await use('triage');
    await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'triage',edit:'1'})});
    await browser.waitFor(`window.syntheticPatientReady===true && window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(key)} && document.body.dataset.encounterView==='triage'`,'fully loaded triage',60000);
    await browser.evaluate(`(() => {
      for(const [id,value] of Object.entries({p2_weight:'55',p2_height:'160',p2_bp_sys:'110',p2_bp_dia:'70',p2_pulse:'80',p2_temp:'37',p2_resp:'18',p2_spo2:'98'})) { const input=document.getElementById(id);input.value=value;input.dispatchEvent(new Event('input',{bubbles:true})); }
      BorkeoChiefComplaint.toggleSymptom('Synthetic ANC transfer',true);
      document.getElementById('cb_dept_other').checked=true;
      const select=document.getElementById('p2_other_dept');select.value='anc';select.dispatchEvent(new Event('change',{bubbles:true}));
      const hidden=document.getElementById('opd-module-select');hidden.value='anc';hidden.dispatchEvent(new Event('change',{bubbles:true}));
    })()`);
    assert.equal(await browser.evaluate('location.pathname'),'/emr');
    const evidence=path.resolve('validation-evidence'); fs.mkdirSync(evidence,{recursive:true});
    const shot=await browser.send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync(path.join(evidence,'triage-anc-selection.png'),Buffer.from(shot.data,'base64'));
    await browser.evaluate("document.getElementById('triage_save_btn').click()");
    try { await browser.waitFor("location.pathname==='/triage'",'native ANC transfer returns to triage',60000); }
    catch(error) { console.log(await browser.evaluate("({url:location.href,status:document.getElementById('emr-record-status')?.textContent,missing:[...document.querySelectorAll('[aria-invalid=true]')].map(e=>e.id)})"));throw error; }
    const row=app.database.findPatient(key), stored=JSON.parse(row.record_json);
    assert.equal(row.department_code,'anc'); assert.equal(stored['system:triageStatus'],'COMPLETED');
    assert.equal(stored['scope:triage:id:p2_temp'],'37');
    // ANC retains its existing cashier step; this fix must not waive payment.
    const finance=await(await fetch(origin+'/api/finance/patient?patientKey='+encodeURIComponent(key),{headers:users.clerk})).json();
    assert.ok(finance.bill.summary.KHR.balance>0);
    const payment=await fetch(origin+'/api/finance/payments',{method:'POST',headers:users.clerk,body:JSON.stringify({patientKey:key,invoiceId:finance.bill.invoice.id,source:'CASH',amount:finance.bill.summary.KHR.balance,currency:'KHR'})});
    assert.equal(payment.status,201);
    const queue=await(await fetch(origin+'/api/maternal/queue',{headers:users.nurse_obstetric})).json();
    assert.ok(queue.patients.some(patient=>patient.patientKey===key),'patient reaches the midwife queue');
    assert.equal((await fetch(origin+'/anc-record?patient='+encodeURIComponent(key),{headers:users.triage})).status,403,'triage gains no ANC clinical-page access');
    await use('nurse_obstetric');
    await browser.send('Page.navigate',{url:origin+'/anc-record?patient='+encodeURIComponent(key)});
    await browser.waitFor("document.querySelector('[data-action=open]')",'midwife can open ANC',60000);
    assert.deepEqual(browser.state.errors,[]);
  } finally { browser?.close();app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.database.close(); }
});
