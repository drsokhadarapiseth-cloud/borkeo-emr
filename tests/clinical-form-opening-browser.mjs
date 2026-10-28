// Explicit browser/PDF regression; synthetic patient in an in-memory EMR only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createEmrServer} from '../server/server.mjs';
import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {openBrowser} from './helpers/context-browser.mjs';
test('stale browser role cannot hide authenticated OPD or IPD forms',{timeout:180000},async()=>{
  const app=createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false});let browser;
  try{
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
    const users={};for(const username of ['registration','triage','clerk','doctor_opd','nurse_opd','doctor_surgery']){
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      const Cookie=response.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      users[username]={Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    }
    const call=async(user,method,route,body)=>{const response=await fetch(origin+route,{method,headers:users[user],body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result};
    const patient=buildCompleteRegistrationPatients()[0],key=patient.patientKey;
    await call('registration','PUT','/api/patient-record',patient);
    const current=(await call('registration','GET','/api/patient-record?patientKey='+encodeURIComponent(key))).patient;
    await call('triage','PUT','/api/patient-record',{patientKey:key,summary:{...patient.summary,departmentCode:'opd',serviceMode:'opd'},expectedVersion:current.version,triageSave:true,data:{'scope:triage:id:p2_temp':'37','scope:triage:id:p2_weight':'60','scope:triage:id:p2_height':'165','scope:triage:id:p2_bp_sys':'120','scope:triage:id:p2_bp_dia':'80','scope:triage:id:p2_pulse':'80','scope:triage:id:p2_resp':'18','scope:triage:id:p2_spo2':'98'}});
    const finance=await call('clerk','GET','/api/finance/patient?patientKey='+encodeURIComponent(key));
    await call('clerk','POST','/api/finance/payments',{patientKey:key,invoiceId:finance.bill.invoice.id,source:'CASH',currency:'KHR',amount:finance.bill.summary.KHR.balance});
    const before=app.database.findPatient(key).record_json;
    browser=await openBrowser();await browser.send('Network.setBlockedURLs',{urls:['https://*']});
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"sessionStorage.setItem('borkeo-active-role','TRIAGE');window.print=()=>{window.syntheticPrintCount=(window.syntheticPrintCount||0)+1};document.addEventListener('emr:patient-loaded',()=>{window.syntheticLoaded=true})"});
    const [name,value]=users.doctor_opd.Cookie.split('=');await browser.send('Network.setCookie',{name,value,url:origin});
    await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'opd'})});
    await browser.waitFor('window.syntheticLoaded && window.EmrEncounterEditor?.canWrite()','doctor OPD',60000);

    const evidence=path.resolve('.validation-form-opening');fs.mkdirSync(evidence,{recursive:true});
    const verify=async(view,panel)=>{
      await browser.waitFor('document.getElementById('+JSON.stringify(panel)+').checkVisibility()','visible '+view,60000);
      assert.equal(await browser.evaluate('document.documentElement.classList.contains("triage-restricted")'),false);
      assert.equal(await browser.evaluate('new URL(location.href).searchParams.get("view")'),view,'cached role must not rewrite selected view');
      for(const width of [1440,390]){
        await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
        assert.equal(await browser.evaluate('document.getElementById('+JSON.stringify(panel)+').checkVisibility()'),true);
        const shot=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,view+'-'+width+'.png'),Buffer.from(shot.data,'base64'));
      }
    };
    await verify('opd','sub_opd');
    app.database.sqlite.prepare("UPDATE patient_records SET service_mode='ipd',department_code='surgery',record_json='{}' WHERE patient_key=?").run(key);
    const [ic,iv]=users.doctor_surgery.Cookie.split('=');await browser.send('Network.setCookie',{name:ic,value:iv,url:origin});
    await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'medical'})});
    await browser.waitFor('window.syntheticLoaded && window.getLoadedEmrPatient?.()?.serviceMode==="ipd"','IPD loaded',60000);
    await verify('medical','sub_ipd');
    const [tc,tv]=users.triage.Cookie.split('=');await browser.send('Network.setCookie',{name:tc,value:tv,url:origin});
    await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'triage'})});
    await browser.waitFor('window.emrSession?.user?.activeRole==="TRIAGE" && document.getElementById("page2").checkVisibility()','authenticated triage',60000);
    assert.equal(await browser.evaluate('document.getElementById("page3").checkVisibility()'),false,'Triage cannot see physician forms');
    assert.deepEqual(browser.state.errors,[]);
  }finally{browser?.close();app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.database.close()}
});
