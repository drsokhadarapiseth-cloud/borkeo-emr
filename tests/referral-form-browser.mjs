// Explicit browser/PDF regression; synthetic patient in an in-memory EMR only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createEmrServer} from '../server/server.mjs';
import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {openBrowser} from './helpers/context-browser.mjs';
test('referral popup preserves clinical data, validates overflow and prints one A4 page with authenticated signatures',{timeout:180000},async()=>{
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
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.print=()=>{window.syntheticPrintCount=(window.syntheticPrintCount||0)+1};document.addEventListener('emr:patient-loaded',()=>{window.syntheticLoaded=true})"});
    const [name,value]=users.doctor_opd.Cookie.split('=');await browser.send('Network.setCookie',{name,value,url:origin});
    await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'opd'})});
    await browser.waitFor('window.syntheticLoaded && window.EmrEncounterEditor?.canWrite()','doctor OPD',60000);

    await browser.evaluate(`window.confirm=()=>false;window.labOrders=[];const nativeFetch=window.fetch;window.fetch=async function(input,options){const response=await nativeFetch.apply(this,arguments);if(String(input).includes('/api/paraclinic/orders')&&options?.method==='POST'){window.labOrders.push({payload:JSON.parse(options.body),status:response.status,result:await response.clone().json()})}return response}`);

    const initial=await call('doctor_opd','GET','/api/referral-form?patientKey='+encodeURIComponent(key));assert.equal(initial.canEdit,true);
    for(const username of ['nurse_opd','registration','doctor_surgery']){
      const response=await fetch(origin+'/api/referral-form',{method:'POST',headers:users[username],body:JSON.stringify({patientKey:key,revision:0,data:{reason:'Test'},signatureMode:'NONE'})});assert.equal(response.status,403,username+' cannot save/sign this referral');
    }
    const noCsrf=await fetch(origin+'/api/referral-form',{method:'POST',headers:{Cookie:users.doctor_opd.Cookie,'Content-Type':'application/json'},body:JSON.stringify({patientKey:key,revision:0,data:{},signatureMode:'NONE'})});assert.equal(noCsrf.status,403);
    await browser.waitFor('document.querySelector("#sub_opd [data-open-referral]")','referral trigger');
    await browser.evaluate('document.querySelector("#sub_opd [data-open-referral]").click()');
    await browser.waitFor('document.querySelector(".ref-page")','referral popup');
    await browser.evaluate('document.fonts.ready');
    assert.equal(await browser.evaluate('document.querySelector("[data-ref-field=patientId]").value'),patient.summary.healthId);
    const dimensions=await browser.evaluate('(()=>{const p=document.querySelector(".ref-page");return {width:p.clientWidth,height:p.clientHeight,scrollHeight:p.scrollHeight,scrollWidth:p.scrollWidth,bad:[...p.querySelectorAll(".ref-bad")].map(n=>({key:n.dataset.refField,value:n.value,w:n.clientWidth,h:n.clientHeight,sh:n.scrollHeight}))}})()');console.log('Referral initial layout',JSON.stringify(dimensions));
    const evidence=path.resolve('.validation-referral-evidence');fs.mkdirSync(evidence,{recursive:true});
    const screenshot=async label=>{const shot=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,label+'.png'),Buffer.from(shot.data,'base64'))};
    await screenshot('popup-initial');
    // Native typing in the referral copy must leave the source record unchanged.
    await browser.evaluate('document.querySelector("[data-ref-field=reason]").focus()');await browser.type('Synthetic specialist review');
    assert.equal(await browser.evaluate('document.querySelector("[data-ref-field=reason]").value'),'Synthetic specialist review');
    await browser.evaluate('(()=>{const n=document.querySelector("[data-ref-field=history]");n.value="long ".repeat(500);n.dispatchEvent(new Event("input",{bubbles:true}))})()');
    assert.equal(await browser.evaluate('document.querySelector("[data-ref-print]").disabled'),true,'overflow blocks printing');
    await browser.evaluate('(()=>{const n=document.querySelector("[data-ref-field=history]");n.value="Synthetic history";n.dispatchEvent(new Event("input",{bubbles:true}))})()');
    await browser.evaluate('document.querySelectorAll("[data-ref-field]").forEach(n=>{if(n.type!=="checkbox"&&!n.value){n.value="1";n.dispatchEvent(new Event("input",{bubbles:true}))}})');
    await browser.evaluate('document.querySelector("[data-ref-esign]").click()');
    const fit=await browser.evaluate('({disabled:document.querySelector("[data-ref-print]").disabled,bad:[...document.querySelectorAll(".ref-bad")].map(n=>n.dataset.refField)})');console.log('Referral print readiness',JSON.stringify(fit));
    assert.equal(fit.disabled,false,JSON.stringify(fit));
    await browser.evaluate('document.querySelector("[data-ref-print]").click()');
    try{await browser.waitFor('document.querySelector(".ref-print-frame")?.dataset.ready==="true"','single-page referral print',20000)}catch(error){console.log('Print diagnostics',JSON.stringify(await browser.evaluate('(()=>{const f=document.querySelector(".ref-print-frame"),p=f?.contentDocument.querySelector(".ref-page");return {status:document.querySelector(".ref-status").textContent,ready:f?.contentDocument.readyState,fonts:f?.contentDocument.fonts.status,bad:[...f?.contentDocument.querySelectorAll(".ref-value")||[]].filter(n=>n.textContent&&(n.scrollHeight>n.clientHeight+1||n.scrollWidth>n.clientWidth+1)).map(n=>({key:n.dataset.refPrintField,h:n.clientHeight,sh:n.scrollHeight,w:n.clientWidth,sw:n.scrollWidth})),page:p?{w:p.clientWidth,sw:p.scrollWidth,h:p.clientHeight,sh:p.scrollHeight}:null}})()')));throw error;}
    const saved=(await call('doctor_opd','GET','/api/referral-form?patientKey='+encodeURIComponent(key))).form;
    assert.equal(saved.data.reason,'Synthetic specialist review');assert.equal(saved.signature.source,'saved');
    const me=await(await fetch(origin+'/api/auth/me',{headers:users.doctor_opd})).json();assert.equal(saved.signature.userId,me.user.id);
    const stale=await fetch(origin+'/api/referral-form',{method:'POST',headers:users.doctor_opd,body:JSON.stringify({patientKey:key,revision:0,data:saved.data,signatureMode:'NONE'})});assert.equal(stale.status,409,'stale revision cannot overwrite a signed form');
    assert.equal(app.database.findPatient(key).record_json,before,'referral save/print does not modify original clinical record');
    const markup=await browser.evaluate('document.querySelector(".ref-print-frame").contentDocument.documentElement.outerHTML');
    assert.ok(await browser.evaluate('document.querySelector(".ref-print-frame").contentDocument.body.textContent.includes('+JSON.stringify(patient.summary.healthId)+')'));
    fs.writeFileSync(path.join(evidence,'referral.snapshot.txt'),markup);
    // Draw a replacement signature with pointer input, then append a new revision.
    await browser.evaluate('document.querySelector("[data-ref-clear]").click();document.querySelector("canvas").scrollIntoView({block:"center"})');
    const rect=await browser.evaluate('(()=>{const r=document.querySelector(".ref-pad canvas").getBoundingClientRect();return {x:r.x,y:r.y}})()');
    await browser.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+20,y:rect.y+30});await browser.send('Input.dispatchMouseEvent',{type:'mousePressed',button:'left',clickCount:1,x:rect.x+20,y:rect.y+30});await browser.send('Input.dispatchMouseEvent',{type:'mouseMoved',button:'left',buttons:1,x:rect.x+140,y:rect.y+65});await browser.send('Input.dispatchMouseEvent',{type:'mouseReleased',button:'left',clickCount:1,x:rect.x+140,y:rect.y+65});
    await browser.evaluate('document.querySelector("[data-ref-save]").click()');
    await browser.waitFor('!document.querySelector("[data-ref-save]").disabled','drawn save');
    let drawn;for(let i=0;i<30;i++){drawn=(await call('doctor_opd','GET','/api/referral-form?patientKey='+encodeURIComponent(key))).form;if(drawn.revision===2)break;await new Promise(r=>setTimeout(r,100))}
    assert.equal(drawn.signature.source,'drawn');assert.equal(drawn.signature.userId,me.user.id);assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) AS n FROM referral_form_revisions WHERE patient_key=?').get(key).n,2,'signed history is retained');
    await browser.evaluate('document.querySelector("[data-ref-close]").click()');
    await browser.evaluate('document.querySelector("#sub_opd [data-open-referral]").click()');await browser.waitFor('document.querySelector(".ref-page")','reopened referral');
    assert.equal(await browser.evaluate('document.querySelector("[data-ref-field=reason]").value'),'Synthetic specialist review');
    await browser.evaluate('document.querySelector("[data-ref-close]").click()');
    const closedData=JSON.parse(app.database.findPatient(key).record_json);closedData['system:opdDischarge']={dispensedAt:Date.now()};app.database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(closedData),key);
    await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'opd'})});await browser.waitFor('window.syntheticLoaded','closed record');
    assert.equal(await browser.evaluate('window.EmrEncounterEditor.canWrite()'),false);
    await browser.evaluate('document.querySelector("#sub_opd [data-open-referral]").click()');await browser.waitFor('document.querySelector(".ref-page")','readonly referral');
    assert.equal(await browser.evaluate('document.querySelector("[data-ref-save]").disabled'),true,'closed encounter can reprint but cannot edit');
    await browser.evaluate('document.querySelector("[data-ref-print]").click()');await browser.waitFor('document.querySelector(".ref-print-frame")?.dataset.ready==="true"','readonly reprint',30000);
    assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) AS n FROM referral_form_revisions WHERE patient_key=?').get(key).n,2,'reprint does not append or modify signed history');
    await browser.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});await screenshot('popup-narrow');
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1000,height:1200,deviceScaleFactor:1,mobile:false});
    // The same popup is available and editable from the inpatient medical page.
    app.database.sqlite.prepare("UPDATE patient_records SET service_mode='ipd',department_code='surgery',record_json='{}' WHERE patient_key=?").run(key);
    const [ipdCookie,ipdValue]=users.doctor_surgery.Cookie.split('=');await browser.send('Network.setCookie',{name:ipdCookie,value:ipdValue,url:origin});
    await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'medical'})});
    await browser.waitFor('window.syntheticLoaded && document.querySelector("#sub_ipd [data-open-referral]")','inpatient referral trigger',60000);
    await browser.evaluate('document.querySelector("#sub_ipd [data-open-referral]").click()');
    await browser.waitFor('document.querySelector(".ref-page")','inpatient popup');
    assert.equal(await browser.evaluate('document.querySelector("[data-ref-field=reason]").disabled'),false,'inpatient doctor can write referral');
    await browser.evaluate('document.querySelector("[data-ref-esign]").click();document.querySelector("[data-ref-save]").click()');
    await browser.waitFor('!document.querySelector("[data-ref-save]").disabled','inpatient signed save');
    const ipdForm=(await call('doctor_surgery','GET','/api/referral-form?patientKey='+encodeURIComponent(key))).form;
    const ipdActor=(await call('doctor_surgery','GET','/api/auth/me')).user;
    assert.equal(ipdForm.revision,3);assert.equal(ipdForm.signature.userId,ipdActor.id);
    await screenshot('popup-ipd');
    await browser.evaluate('document.open();document.write('+JSON.stringify(markup)+');document.close()');await browser.evaluate('document.fonts.ready');await browser.send('Emulation.setEmulatedMedia',{media:'print'});
    await screenshot('referral-print');const pdf=await browser.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});const bytes=Buffer.from(pdf.data,'base64');fs.writeFileSync(path.join(evidence,'referral.pdf'),bytes);assert.equal((bytes.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,1,'exactly one A4 page');assert.ok(bytes.length>10000,'populated PDF');
  }finally{browser?.close();app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.database.close()}
});
