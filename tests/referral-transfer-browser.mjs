import fs from 'node:fs';import path from 'node:path';import {openBrowser} from './helpers/context-browser.mjs';
import crypto from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import {createEmrServer} from '../server/server.mjs';import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {checkEnvelope,mac} from '../server/referral-link.mjs';
test('referral popup signs on demand and delivers to receiving inbox',{timeout:180000},async()=>{
 const options={demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false};
 const app=createEmrServer(options),receiver=createEmrServer(options);let browser;
 try{
  for(const x of [app,receiver]){await new Promise(r=>x.server.listen(0,'0.0.0.0',r));x.config.appOrigin='http://127.0.0.1:'+x.server.address().port;}
  receiver.config.appOrigin='http://localhost:'+receiver.server.address().port;const origin=app.config.appOrigin,other=receiver.config.appOrigin,secret='a'.repeat(64);
  app.config.referralLink={role:'sender',peer:other,secret};receiver.config.referralLink={role:'receiver',peer:origin,secret};
  const users={};for(const username of ['registration','triage','clerk','doctor_opd','nurse_opd']){
   const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});const Cookie=r.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();users[username]={Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};}
  const call=async(user,method,route,body)=>{const r=await fetch(origin+route,{method,headers:users[user],body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data};
    const patient=buildCompleteRegistrationPatients()[0],key=patient.patientKey;
    await call('registration','PUT','/api/patient-record',patient);
    const current=(await call('registration','GET','/api/patient-record?patientKey='+encodeURIComponent(key))).patient;
    await call('triage','PUT','/api/patient-record',{patientKey:key,summary:{...patient.summary,departmentCode:'opd',serviceMode:'opd'},expectedVersion:current.version,triageSave:true,data:{'scope:triage:id:p2_temp':'37','scope:triage:id:p2_weight':'60','scope:triage:id:p2_height':'165','scope:triage:id:p2_bp_sys':'120','scope:triage:id:p2_bp_dia':'80','scope:triage:id:p2_pulse':'80','scope:triage:id:p2_resp':'18','scope:triage:id:p2_spo2':'98'}});
    const finance=await call('clerk','GET','/api/finance/patient?patientKey='+encodeURIComponent(key));
    await call('clerk','POST','/api/finance/payments',{patientKey:key,invoiceId:finance.bill.invoice.id,source:'CASH',currency:'KHR',amount:finance.bill.summary.KHR.balance});

  browser=await openBrowser();await browser.send('Network.setBlockedURLs',{urls:['https://*']});
  await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"document.addEventListener('emr:patient-loaded',()=>window.syntheticLoaded=true)"});
  const [name,value]=users.doctor_opd.Cookie.split('=');await browser.send('Network.setCookie',{name,value,url:origin});
  await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'opd'})});
  await browser.waitFor('window.syntheticLoaded && document.querySelector("[data-open-referral]")','OPD loaded',60000);
  await browser.evaluate('document.querySelector("#sub_opd [data-open-referral]").click()');
  await browser.waitFor('document.querySelector(".referral-modal")','popup');
  assert.equal(await browser.evaluate('document.querySelector(".ref-pad").checkVisibility()'),false);
  const evidence=path.resolve('.validation-referral-transfer');fs.mkdirSync(evidence,{recursive:true});
  const shot=async label=>{const p=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,label+'.png'),Buffer.from(p.data,'base64'))};
  for(const width of [1440,390]){await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});assert.ok(await browser.evaluate('document.querySelector(".ref-workspace").scrollWidth<=document.querySelector(".ref-workspace").clientWidth+1'));await shot('popup-'+width)}
  await browser.evaluate('document.querySelector(".ref-signature").click()');assert.equal(await browser.evaluate('document.querySelector(".ref-pad").checkVisibility()'),true);await shot('signature');
  await browser.evaluate('document.querySelector("[data-ref-esign]").click();document.querySelector("[data-ref-signature-done]").click()');assert.equal(await browser.evaluate('document.querySelector(".ref-pad").checkVisibility()'),false);
  await browser.evaluate('(()=>{const n=document.querySelector("[data-ref-field=reason]");n.value="Synthetic specialist review";n.dispatchEvent(new Event("input",{bubbles:true}))})()');
  await browser.evaluate('document.querySelector("[data-ref-send]").click()');
  await browser.waitFor('document.querySelector("[data-ref-send]").disabled && document.querySelector(".ref-status").textContent.length>5','send status');
  await browser.waitFor('fetch("/api/referral-status?patientKey="+encodeURIComponent('+JSON.stringify(key)+')).then(r=>r.json()).then(r=>r.transfer?.status==="PENDING")','delivered',20000);
  const id=app.database.sqlite.prepare('SELECT id FROM referral_outbox').get().id;
  const login=await fetch(other+'/api/auth/login',{method:'POST',headers:{Origin:other,'Content-Type':'application/json'},body:JSON.stringify({username:'nurse_opd'})});const [nc,nv]=login.headers.get('set-cookie').split(';')[0].split('=');await browser.send('Network.setCookie',{name:nc,value:nv,url:other});
  await browser.send('Page.navigate',{url:other+'/referrals'});await browser.waitFor('document.querySelector("[data-inbox-accept]")','incoming queue',60000);await shot('incoming');
  await browser.evaluate('document.querySelector("[data-inbox-view]").click()');await browser.waitFor('document.querySelector(".ref-page")','incoming letter');await shot('incoming-letter');await browser.evaluate('document.querySelector("[data-incoming-close]").click()');
  await browser.evaluate('document.querySelector("[data-inbox-accept]").click()');await browser.waitFor('document.querySelector("[data-inbox-accept]").disabled','accepted');
  await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'opd'})});await browser.waitFor('window.syntheticLoaded && document.querySelector("#sub_opd [data-open-referral]")','return source',60000);await browser.evaluate('document.querySelector("#sub_opd [data-open-referral]").click()');await browser.waitFor('fetch("/api/referral-status?patientKey="+encodeURIComponent('+JSON.stringify(key)+')).then(r=>r.json()).then(r=>r.transfer?.status==="ACCEPTED")','source acceptance');
  assert.equal(receiver.database.sqlite.prepare('SELECT status FROM referral_inbox WHERE id=?').get(id).status,'ACCEPTED');assert.deepEqual(browser.state.errors,[]);await shot('accepted-source');
 }finally{browser?.close();for(const x of [app,receiver]){x.server.closeAllConnections();await new Promise(r=>x.server.close(r));x.database.close()}}
});
