// Explicit browser/PDF regression; synthetic patient in an in-memory EMR only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createEmrServer} from '../server/server.mjs';
import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {openBrowser} from './helpers/context-browser.mjs';
test('OPD laboratory grouped multi-selection preserves paid, free and nurse handoffs',{timeout:180000},async()=>{
  const app=createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false});let browser;
  try{
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
    const users={};for(const username of ['registration','triage','clerk','doctor_opd']){
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
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.print=()=>{window.syntheticPrintCount=(window.syntheticPrintCount||0)+1};document.addEventListener('emr:patient-loaded',()=>{window.syntheticLoaded=true})"});
    const [name,value]=users.doctor_opd.Cookie.split('=');await browser.send('Network.setCookie',{name,value,url:origin});
    await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'opd'})});
    await browser.waitFor('window.syntheticLoaded && window.EmrEncounterEditor?.canWrite()','doctor OPD',60000);

    await browser.evaluate(`window.confirm=()=>false;window.labOrders=[];const nativeFetch=window.fetch;window.fetch=async function(input,options){const response=await nativeFetch.apply(this,arguments);if(String(input).includes('/api/paraclinic/orders')&&options?.method==='POST'){window.labOrders.push({payload:JSON.parse(options.body),status:response.status,result:await response.clone().json()})}return response}`);
    const openLab=async()=>{
      await browser.evaluate("document.querySelector('#sub_opd [data-request-lab]').click()");
      await browser.waitFor("document.querySelector('.borkeo-lab-paper-form')",'OPD laboratory order');
    };
    const add=async codes=>{
      await browser.evaluate('(()=>{document.querySelector("[data-other-picker]").open=true;for(const code of '+JSON.stringify(codes)+'){const input=[...document.querySelectorAll("[data-other-pick]")].find(n=>n.value===code);if(!input||input.disabled)throw Error("Unavailable test "+code);input.checked=true;input.dispatchEvent(new Event("change",{bubbles:true}))}})()');
      assert.equal(await browser.evaluate('Number(document.querySelector("[data-other-count]").value)'),codes.length);
      await browser.evaluate('document.querySelector("[data-add-other]").click()');
    };
    await openLab();
    const labels=await browser.evaluate("({fee:document.querySelector('.opd-fee-choice').textContent,buttons:document.querySelector('.actions-right').textContent,hasNote:!!document.querySelector('.opd-handoff-choice')})");
    assert.doesNotMatch(labels.fee+labels.buttons,/[A-Za-z]/,'fee and action labels are Khmer');assert.equal(labels.hasNote,false);
    const catalog=(await call('doctor_opd','GET','/api/lab-catalog')).tests.filter(t=>t.active!==false);
    const groups=await browser.evaluate('[...document.querySelectorAll(".other-test-group legend")].map(n=>n.textContent)');
    assert.deepEqual([...groups].sort(),[...new Set(catalog.map(t=>t.category||'Other / Special'))].sort());
    assert.equal(await browser.evaluate('document.querySelectorAll("[data-other-pick]").length'),catalog.length);
    assert.doesNotMatch(await browser.evaluate('document.querySelector(".other-test-groups").textContent'),/[()]/,'names have no parentheses or repeated code suffix');
    await browser.evaluate('document.querySelector("[data-other-picker]").open=true');
    const evidence=path.resolve('.validation-lab-evidence');fs.mkdirSync(evidence,{recursive:true});
    for(const width of [1440,390]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      await browser.evaluate('document.querySelector(".other-test-picker").scrollIntoView({block:"center"})');
      assert.ok(await browser.evaluate('(()=>{const n=document.querySelector(".paraclinic-modal-card");return n.scrollWidth<=n.clientWidth+1})()'),'lab dialog fits viewport');
      const shot=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'lab-'+width+'.png'),Buffer.from(shot.data,'base64'));
    }
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    await browser.evaluate('(()=>{const n=document.querySelector("[data-other-search]");n.value="coombs";n.dispatchEvent(new Event("input",{bubbles:true}))})()');
    const search=await browser.evaluate('[...document.querySelectorAll(".other-test-option")].filter(n=>!n.hidden&& !n.closest("fieldset").hidden).map(n=>n.textContent.trim())');
    assert.ok(search.length>0&&search.every(text=>/coombs|antiglobulin/i.test(text)),'search finds named tests by code or name');
    await browser.evaluate('(()=>{const n=document.querySelector("[data-other-search]");n.value="";n.dispatchEvent(new Event("input",{bubbles:true}))})()');
    await add(['DIRECT_COOMBS','TROP_I','GLU']);
    await add(['DIRECT_COOMBS']);
    assert.equal(await browser.evaluate('document.querySelectorAll("[data-paper-test][value=DIRECT_COOMBS]").length'),1,'adding again does not duplicate a test');
    assert.equal(await browser.evaluate('document.querySelector("[data-paper-test][value=GLU]").checked'),true,'main-form test selected through grouped picker');
    await browser.evaluate('document.querySelector("[data-paper-test][value=TROP_I]").closest(".test-check-row").querySelector("[data-remove-other]").click()');
    assert.equal(await browser.evaluate('!!document.querySelector("[data-paper-test][value=TROP_I]")'),false);
    await add(['TROP_I']);
    const selected=await browser.evaluate('[...document.querySelectorAll("[data-paper-test]:checked")].map(n=>n.value)');
    assert.deepEqual(selected.sort(),['DIRECT_COOMBS','GLU','TROP_I']);
    assert.equal(app.database.findPatient(key).record_json,before,'choosing tests does not save the clinical record');
    await browser.evaluate('document.querySelector(".actions-right [data-route=DIRECT]").click()');
    await browser.waitFor('window.labOrders.length===1','paid lab submitted');
    let order=await browser.evaluate('window.labOrders[0]');assert.equal(order.status,400,'missing configured fee is still rejected for paid requests');
    await browser.evaluate('document.querySelector("[name=chargeMode][value=FREE]").click();document.querySelector(".actions-right [data-route=DIRECT]").click()');
    await browser.waitFor('window.labOrders.length===2','free multi-test request submitted');
    order=await browser.evaluate('window.labOrders[1]');assert.equal(order.status,201,JSON.stringify(order.result));assert.equal(order.result.order.request.chargeMode,'FREE');assert.equal(Boolean(order.result.cashierPaymentRequired),false);assert.deepEqual(order.payload.request.items.map(i=>i.code).sort(),selected.sort());
    await openLab();
    assert.equal(await browser.evaluate('document.querySelector("[data-other-pick][value=DIRECT_COOMBS]").disabled'),true,'already ordered tests stay disabled');
    await add(['CBC','UREA']);
    await browser.evaluate('document.querySelector(".actions-right [data-route=DIRECT]").click()');
    await browser.waitFor('window.labOrders.length===3','paid lab submitted');
    order=await browser.evaluate('window.labOrders[2]');assert.equal(order.status,201,JSON.stringify(order.result));assert.equal(order.result.cashierPaymentRequired,true);assert.deepEqual(order.payload.request.items.map(i=>i.code).sort(),['CBC','UREA']);
    await openLab();await add(['HBA1C']);
    await browser.evaluate('document.querySelector(".actions-right [data-route=NURSE]").click()');
    await browser.waitFor('window.labOrders.length===4','nurse lab submitted');
    order=await browser.evaluate('window.labOrders[3]');assert.equal(order.status,201,JSON.stringify(order.result));assert.equal(order.result.nurseHandoffRequired,true);assert.equal(order.payload.handoffMode,'NURSE');
    await openLab();await add(['AST']);
    await browser.evaluate('document.querySelector("[name=chargeMode][value=FREE]").click();document.querySelector(".actions-right [data-route=DIRECT]").click()');
    await browser.waitFor('window.labOrders.length===5','free individual AST submitted');
    order=await browser.evaluate('window.labOrders[4]');assert.equal(order.status,201,JSON.stringify(order.result));assert.equal(order.result.order.request.chargeMode,'FREE');assert.equal(Boolean(order.result.cashierPaymentRequired),false);assert.deepEqual(order.payload.request.items.map(i=>i.code),['AST'],'individual catalog choice does not silently include the main form transaminase pair');
    fs.writeFileSync(path.join(evidence,'workflow.json'),JSON.stringify(await browser.evaluate('window.labOrders'),null,2));
  }finally{browser?.close();app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.database.close()}
});
