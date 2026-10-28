import crypto from 'node:crypto';
import test from 'node:test';import assert from 'node:assert/strict';import {createEmrServer} from '../server/server.mjs';import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {checkEnvelope,mac,linkSettings,peerCall} from '../server/referral-link.mjs';
test('paired referral delivery, retries, staff acceptance and source preservation',{timeout:120000},async()=>{
 const options={demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false};
 const app=createEmrServer(options),receiver=createEmrServer(options);
 try{
  for(const x of [app,receiver]){await new Promise(r=>x.server.listen(0,'127.0.0.1',r));x.config.appOrigin='http://127.0.0.1:'+x.server.address().port;}
  const origin=app.config.appOrigin,other=receiver.config.appOrigin,secret='a'.repeat(64);
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
  const before=app.database.findPatient(key).record_json;const receiverCount=receiver.database.sqlite.prepare('SELECT count(*) n FROM patient_records').get().n;
  await call('doctor_opd','POST','/api/referral-form',{patientKey:key,revision:0,data:{reason:'Synthetic transfer',destination:'Provincial hospital'},signatureMode:'SAVED'});
  const post=body=>fetch(origin+'/api/referral-send',{method:'POST',headers:users.doctor_opd,body:JSON.stringify(body)});
  assert.equal((await post({patientKey:key,revision:99})).status,409);
  assert.equal((await fetch(origin+'/api/referral-send',{method:'POST',headers:users.nurse_opd,body:JSON.stringify({patientKey:key,revision:1})})).status,403);
  app.config.referralLink.peer='http://127.0.0.1:1';assert.equal((await post({patientKey:key,revision:1})).status,503);
  const retryId=app.database.sqlite.prepare('SELECT id FROM referral_outbox').get().id;
  app.config.referralLink.peer=other;const delivered=await(await post({patientKey:key,revision:1})).json();assert.equal(delivered.transfer.status,'PENDING');assert.equal(delivered.transfer.id,retryId);
  await post({patientKey:key,revision:1});assert.equal(receiver.database.sqlite.prepare('SELECT count(*) n FROM referral_inbox').get().n,1);
  assert.equal((await fetch(other+'/api/referral-inbox')).status,401);
  assert.equal((await fetch(other+'/api/referral-link',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({})})).status,403);
  const login=await fetch(other+'/api/auth/login',{method:'POST',headers:{Origin:other,'Content-Type':'application/json'},body:JSON.stringify({username:'nurse_opd'})});const Cookie=login.headers.get('set-cookie').split(';')[0];const me=await(await fetch(other+'/api/auth/me',{headers:{Cookie}})).json();const headers={Cookie,Origin:other,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
  const incoming=await(await fetch(other+'/api/referral-inbox',{headers})).json();assert.equal(incoming.referrals[0].payload.patient.fullName,patient.summary.fullName);assert.equal(incoming.referrals[0].payload.form.signature.userId,(await call('doctor_opd','GET','/api/auth/me')).user.id);
  assert.equal((await fetch(other+'/api/referral-accept',{method:'POST',headers:{Cookie,Origin:other,'Content-Type':'application/json'},body:JSON.stringify({id:retryId})})).status,403);
  for(let i=0;i<2;i++)assert.equal((await fetch(other+'/api/referral-accept',{method:'POST',headers,body:JSON.stringify({id:retryId})})).status,200);
  const status=await call('doctor_opd','GET','/api/referral-status?patientKey='+encodeURIComponent(key));assert.equal(status.transfer.status,'ACCEPTED');assert.ok(status.transfer.acceptedAt);
  assert.equal(app.database.findPatient(key).record_json,before);assert.equal(receiver.database.sqlite.prepare('SELECT count(*) n FROM patient_records').get().n,receiverCount,'acceptance does not automatically admit or overwrite a patient');
  const envelope={timestamp:Date.now(),nonce:crypto.randomUUID(),body:{operation:'status',id:retryId}};envelope.signature=mac(secret,JSON.stringify(envelope));checkEnvelope(receiver.database,receiver.config.referralLink,envelope);assert.throws(()=>checkEnvelope(receiver.database,receiver.config.referralLink,envelope),e=>e.status===409);
  const expired={timestamp:Date.now()-120000,nonce:crypto.randomUUID(),body:envelope.body};expired.signature=mac(secret,JSON.stringify(expired));assert.throws(()=>checkEnvelope(receiver.database,receiver.config.referralLink,expired),e=>e.status===403);
  assert.throws(()=>checkEnvelope(receiver.database,receiver.config.referralLink,{...envelope,nonce:crypto.randomUUID(),signature:'f'.repeat(64)}),e=>e.status===403);
  assert.throws(()=>linkSettings({referralLink:{role:'sender',peer:'http://example.com',secret}}),e=>e.status===503);
  assert.equal(receiver.database.sqlite.prepare("SELECT count(*) n FROM audit_events WHERE action='REFERRAL_ACCEPTED'").get().n,1);
 }finally{for(const x of [app,receiver]){x.server.closeAllConnections();await new Promise(r=>x.server.close(r));x.database.close()}}
});

test('transport refuses unsigned responses and disables redirects',async()=>{
 const original=globalThis.fetch;let redirects;
 globalThis.fetch=async(url,options)=>{redirects=options.redirect;return new Response(JSON.stringify({body:{status:'PENDING'},signature:'0'.repeat(64)}))};
 try{await assert.rejects(peerCall({role:'sender',peer:'http://localhost:3002',secret:'a'.repeat(64)},{operation:'status',id:crypto.randomUUID()}),e=>e.status===503);assert.equal(redirects,'error')}
 finally{globalThis.fetch=original}
});
