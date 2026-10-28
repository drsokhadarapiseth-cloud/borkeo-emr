import fs from 'node:fs';import path from 'node:path';import {openBrowser} from './helpers/context-browser.mjs';
import crypto from 'node:crypto';
import {seedReferralHistory} from './helpers/referral-history.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import {createEmrServer} from '../server/server.mjs';import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {checkEnvelope,mac} from '../server/referral-link.mjs';
import {networkLocal,apiToken,savePeer} from '../server/emr-network.mjs';
test('referral popup signs on demand and delivers to receiving inbox',{timeout:180000},async()=>{
 const options={demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false};
 const app=createEmrServer(options),receiver=createEmrServer(options);let browser;
 try{
  for(const x of [app,receiver]){await new Promise(r=>x.server.listen(0,'0.0.0.0',r));x.config.appOrigin='http://127.0.0.1:'+x.server.address().port;}
  receiver.config.appOrigin='http://localhost:'+receiver.server.address().port;const origin=app.config.appOrigin,other=receiver.config.appOrigin,secret='a'.repeat(64);
  app.config.referralLink={role:'sender',peer:other,secret};receiver.config.referralLink={role:'receiver',peer:origin,secret};
  const modern=process.env.EMR_NETWORK_BROWSER==='1';
  if(modern){for(const [from,to] of [[app,receiver],[receiver,app]]){from.database.sqlite.prepare('UPDATE emr_network_local SET managed=1,enabled=1').run();savePeer(from.database,from.config,{name:'Synthetic partner',origin:to.config.appOrigin,apiKey:apiToken(networkLocal(to.database)),enabled:true,incoming:true,outgoing:true,search:true,messages:true})}savePeer(app.database,app.config,{name:'Another synthetic facility',origin:'http://127.0.0.1:1',apiKey:'EMR1:'+crypto.randomUUID()+':'+'c'.repeat(64),enabled:true,incoming:false,outgoing:true,search:false,messages:false})}
  const users={};for(const username of ['registration','triage','clerk','doctor_opd','nurse_opd']){
   const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});const Cookie=r.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();users[username]={Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};}
  const call=async(user,method,route,body)=>{const r=await fetch(origin+route,{method,headers:users[user],body:body===undefined?undefined:JSON.stringify(body)});const data=await r.json();assert.ok(r.ok,JSON.stringify(data));return data};
    const patient=buildCompleteRegistrationPatients()[0],key=patient.patientKey;
    await call('registration','PUT','/api/patient-record',patient);
    const current=(await call('registration','GET','/api/patient-record?patientKey='+encodeURIComponent(key))).patient;
    await call('triage','PUT','/api/patient-record',{patientKey:key,summary:{...patient.summary,departmentCode:'opd',serviceMode:'opd'},expectedVersion:current.version,triageSave:true,data:{'scope:triage:id:p2_temp':'37','scope:triage:id:p2_weight':'60','scope:triage:id:p2_height':'165','scope:triage:id:p2_bp_sys':'120','scope:triage:id:p2_bp_dia':'80','scope:triage:id:p2_pulse':'80','scope:triage:id:p2_resp':'18','scope:triage:id:p2_spo2':'98'}});
    const finance=await call('clerk','GET','/api/finance/patient?patientKey='+encodeURIComponent(key));
    await call('clerk','POST','/api/finance/payments',{patientKey:key,invoiceId:finance.bill.invoice.id,source:'CASH',currency:'KHR',amount:finance.bill.summary.KHR.balance});

  seedReferralHistory(app,patient,(await call('doctor_opd','GET','/api/auth/me')).user.id);
  browser=await openBrowser();await browser.send('Network.setBlockedURLs',{urls:['https://*']});
  await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"document.addEventListener('emr:patient-loaded',()=>window.syntheticLoaded=true)"});
  const [name,value]=users.doctor_opd.Cookie.split('=');await browser.send('Network.setCookie',{name,value,url:origin});
  await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'opd'})});
  await browser.waitFor('window.syntheticLoaded && document.querySelector("[data-open-referral]")','OPD loaded',60000);
  await browser.evaluate('document.querySelector("#sub_opd [data-open-referral]").click()');
  await browser.waitFor('document.querySelector(".referral-modal")','popup');
  if(modern){const peer=app.database.sqlite.prepare('SELECT id FROM emr_network_peers WHERE instance_id=?').get(networkLocal(receiver.database).id);assert.equal(await browser.evaluate('document.querySelector("[data-ref-peer]").options.length'),3);await browser.evaluate('(()=>{const p=document.querySelector("[data-ref-peer]");p.value='+JSON.stringify(peer.id)+';p.dispatchEvent(new Event("change"))})()')}
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
  assert.equal(await browser.evaluate('!!document.querySelector("#emr-sidebar-nav a[data-nav-id=incoming-referrals]")'),modern,'incoming menu follows instance capabilities');
  await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
  await browser.send('Page.navigate',{url:other+'/home'});
  await browser.waitFor('document.querySelector("#emr-sidebar-nav a[data-nav-id=incoming-referrals]")','receiving sidebar entry',60000);
  assert.equal(await browser.evaluate('!!document.querySelector(".ref-inbox-link")'),false,'floating shortcut is removed');
  await browser.evaluate('document.querySelector("#emr-sidebar-nav a[data-nav-id=incoming-referrals]").click()');
  await browser.waitFor('document.querySelector("[data-inbox-accept]") && document.querySelector("#emr-sidebar-nav a[data-nav-id=incoming-referrals][aria-current=page]")','incoming queue and active sidebar entry',60000);await shot('incoming');
  await browser.send('Emulation.setDeviceMetricsOverride',{width:390,height:900,deviceScaleFactor:1,mobile:false});
  assert.equal(await browser.evaluate('!!document.querySelector("#emr-sidebar-nav a[data-nav-id=incoming-referrals]")'),true);await shot('incoming-mobile');
  assert.equal(await browser.evaluate('!!document.querySelector("[data-inbox-reject]")'),false,'nursing staff cannot reject');
  await browser.evaluate('document.querySelector("[data-inbox-view]").click()');await browser.waitFor('document.querySelector(".ref-page") && document.querySelector("[data-review-visit]").options.length>=2','incoming letter and dated visits');await shot('incoming-letter');
  await browser.evaluate('(()=>{const k=document.querySelector("[data-review-kind]");k.value="opd";k.dispatchEvent(new Event("change"))})()');
  await browser.waitFor('document.querySelector(".referred-record-frame")?.srcdoc.includes("sub_opd")','read-only OPD form');
  await browser.evaluate('(()=>{const v=document.querySelector("[data-review-visit]");v.value=[...v.options].find(o=>o.textContent.includes("HIST-IPD-001")).value;v.dispatchEvent(new Event("change"));const k=document.querySelector("[data-review-kind]");k.value="medical";k.dispatchEvent(new Event("change"))})()');
  await browser.waitFor('document.querySelector(".referred-record-frame")?.srcdoc.includes("Historical illness sentinel")','selected historical medical record');await browser.waitFor('document.querySelector(".referred-record-frame")?.contentDocument?.body?.textContent.includes("Historical illness sentinel")','rendered historical medical record');await shot('historical-medical');
  assert.equal(await browser.evaluate('document.querySelector(".referred-record-frame").getAttribute("sandbox")'),'allow-same-origin');
  assert.equal(await browser.evaluate('document.querySelector(".referred-record-frame").srcdoc.includes("<script")'),false);
  assert.equal(await browser.evaluate('window.referralXss===undefined'),true,'transferred clinical text cannot execute scripts');
  const treatment=await browser.evaluate('(()=>{const d=document.querySelector(".referred-record-frame").contentDocument,t=d.querySelector(".medication-review");t.scrollIntoView();return {rows:t.querySelectorAll("tbody tr").length,text:t.textContent,script:!!t.querySelector("script")}})()');
  assert.equal(treatment.rows,1);assert.ok(treatment.text.includes('AA0050-Amoxicillin'));assert.ok(!treatment.text.includes('regularRow'));assert.equal(treatment.script,false);await shot('clean-ipd-treatment');
  await browser.evaluate('(()=>{const k=document.querySelector("[data-review-kind]");k.value="nursing";k.dispatchEvent(new Event("change"))})()');
  await browser.waitFor('document.querySelector(".referred-record-frame")?.srcdoc.includes("Historical nursing sentinel")','selected historical nursing chart');await browser.waitFor('document.querySelector(".referred-record-frame")?.contentDocument?.body?.textContent.includes("Historical nursing sentinel") && document.querySelector(".referred-record-frame")?.contentDocument?.body?.textContent.includes("Structured nursing sentinel")','rendered historical nursing chart');await shot('historical-nursing');
  await browser.evaluate('document.querySelector("[data-incoming-close]").click()');
  await browser.evaluate('document.querySelector("[data-inbox-accept]").click()');await browser.waitFor('document.querySelector("[data-inbox-accept]").disabled','accepted');
  await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'opd'})});await browser.waitFor('window.syntheticLoaded && document.querySelector("#sub_opd [data-open-referral]")','return source',60000);await browser.evaluate('document.querySelector("#sub_opd [data-open-referral]").click()');await browser.waitFor('fetch("/api/referral-status?patientKey="+encodeURIComponent('+JSON.stringify(key)+')).then(r=>r.json()).then(r=>r.transfer?.status==="ACCEPTED")','source acceptance');
  assert.equal(receiver.database.sqlite.prepare('SELECT status FROM referral_inbox WHERE id=?').get(id).status,'ACCEPTED');assert.deepEqual(browser.state.errors,[]);await shot('accepted-source');
  const rejectedId=crypto.randomUUID(),incoming=receiver.database.sqlite.prepare('SELECT * FROM referral_inbox WHERE id=?').get(id);
  receiver.database.sqlite.prepare("INSERT INTO referral_inbox(id,payload,digest,status,received_at) VALUES(?,?,?,'PENDING',?)").run(rejectedId,incoming.payload,incoming.digest,Date.now());
  const doctorLogin=await fetch(other+'/api/auth/login',{method:'POST',headers:{Origin:other,'Content-Type':'application/json'},body:JSON.stringify({username:'doctor_surgery'})});const [dc,dv]=doctorLogin.headers.get('set-cookie').split(';')[0].split('=');await browser.send('Network.setCookie',{name:dc,value:dv,url:other});
  await browser.send('Page.navigate',{url:other+'/referrals'});await browser.waitFor('document.querySelector("[data-inbox-reject]:not(:disabled)")','doctor rejection action',60000);
  await browser.evaluate('document.querySelector("[data-inbox-reject]:not(:disabled)").click()');await browser.waitFor('document.querySelector(".ref-reject-dialog[open]")','required rejection reason');await shot('reject-dialog');
  await browser.evaluate('document.querySelector("[data-reject-reason]").value="Synthetic specialist rejection reason";document.querySelector("[data-confirm-reject]").click()');
  await browser.waitFor('!document.querySelector(".ref-reject-dialog")','rejection saved');
  assert.equal(receiver.database.sqlite.prepare('SELECT status,rejection_reason FROM referral_inbox WHERE id=?').get(rejectedId).status,'REJECTED');assert.deepEqual(browser.state.errors,[]);
 }finally{browser?.close();for(const x of [app,receiver]){x.server.closeAllConnections();await new Promise(r=>x.server.close(r));x.database.close()}}
});
