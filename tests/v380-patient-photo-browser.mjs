import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createEmrServer} from '../server/server.mjs';

test('photo capture, upload, removal and retry use the current authenticated token and preserve failed changes',async()=>{
 const browser=[process.env.EMR_TEST_BROWSER,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file=>file&&fs.existsSync(file));
 assert.ok(browser,'Set EMR_TEST_BROWSER for this explicit Chromium integration test.');
 const app=createEmrServer({demoMode:true,databasePath:':memory:',port:0,nodeEnv:'test'}),db=app.database;
 const key='case:V380-PHOTO',original='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aM8sAAAAASUVORK5CYII=';
 db.upsertPatient({id:crypto.randomUUID(),patientKey:key,userId:db.findUser('admin').id,savedAt:Date.now(),
  summary:{caseNumber:'V380-PHOTO',fullName:'Synthetic Photo',firstName:'Photo',lastName:'Synthetic',healthId:'V380-ID',sex:'M',age:'40',dateOfBirth:'1986-01-01',phone:'012345678',equityCard:'',paymentType:'DIRECT',departmentCode:'medicine',departmentNameKh:'សាកល្បង',departmentNameEn:'Synthetic',serviceMode:'ipd',entryDate:'2026-10-18',dischargeDate:''},
  data:{'scope:registration:id:web_patient_photo':original,'scope:registration:id:patient_photo':original,'system:patientPhoto':original,'scope:medical:id:diag_input':'Preserve this diagnosis'}});
 const before=db.findPatient(key),native=app.server.listeners('request')[0];app.server.removeAllListeners('request');
 const harness=`<!doctype html><html><head><meta charset="utf-8"><script src="/public/patient-photo.js" defer></script></head><body>
 <input type="hidden" id="web_patient_photo"><div class="registration-avatar"></div><pre id="result">pending</pre>
 <script>document.addEventListener('DOMContentLoaded',()=>{(async()=>{
  window.testErrors=[];window.addEventListener('error',event=>window.testErrors.push(event.message));window.addEventListener('unhandledrejection',event=>window.testErrors.push(String(event.reason)));
  const results=[],ok=(condition,message)=>{if(!condition)throw Error(message)},wait=async(fn,label)=>{for(let i=0;i<600;i++){if(fn())return;await new Promise(r=>setTimeout(r,50))}throw Error('Timeout: '+label+' '+JSON.stringify({errors:window.testErrors,alerts:window.testAlerts,posts:window.testPosts,saveDisabled:document.getElementById('btn-save-photo')?.disabled,hasPreview:Boolean(document.getElementById('upload-preview-img')?.src)}))};
  const nativeFetch=window.fetch.bind(window),alerts=[];window.testAlerts=alerts;window.alert=message=>alerts.push(message);window.confirm=()=>true;
  ok((await nativeFetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'registration'})})).ok,'login');
  const me=await(await nativeFetch('/api/auth/me')).json();
  const patient=(await(await nativeFetch('/api/patient-record?patientKey=${key}&readOnly=1')).json()).patient;
  window.getLoadedEmrPatient=()=>patient;window.emrSession={user:me.user,csrfToken:'STALE'};window.emrCsrfToken='STALE';window.csrfToken='STALE';
  document.getElementById('web_patient_photo').value=patient.photo;
  let forced=0,networkFailure=false,expired=false,posts=0,tokens=[];
  window.fetch=async(url,options)=>{
   if(url==='/api/auth/me'&&expired)return new Response('{}',{status:401});
   if(url==='/api/patient-photo'){
    posts++;window.testPosts=posts;tokens.push(options.headers['X-CSRF-Token']);
    if(networkFailure){networkFailure=false;throw Error('Synthetic connection lost')}
    if(forced){const status=forced;forced=0;return new Response(JSON.stringify({error:'Synthetic rejected write'}),{status})}
   }
   return nativeFetch(url,options);
  };
  const invalid=await nativeFetch('/api/patient-photo',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':'INVALID'},body:JSON.stringify({patientKey:patient.patientKey,photo:''})});
  ok(invalid.status===403,'Server still rejects invalid tokens');results.push('Server CSRF validation remains enforced');
  const $=id=>document.getElementById(id),version=patient.version;
  // Use deterministic pixels instead of depending on a physical camera or media timing in headless mode.
  navigator.mediaDevices.getUserMedia=async()=>new MediaStream();
  window.openPatientPhotoModal();
  const synthetic=document.createElement('canvas');synthetic.width=32;synthetic.height=32;synthetic.getContext('2d').fillRect(0,0,32,32);
  const video=$('photo-video-stream');
  Object.defineProperties(video,{readyState:{get:()=>2},videoWidth:{get:()=>32},videoHeight:{get:()=>32}});
  video.play=async()=>{};
  const drawImage=CanvasRenderingContext2D.prototype.drawImage;
  CanvasRenderingContext2D.prototype.drawImage=function(source,...args){return drawImage.call(this,source===video?synthetic:source,...args)};
  await wait(()=>$('photo-video-stream').readyState>=2,'synthetic camera');
  forced=409;$('btn-capture-photo').click();
  await wait(()=>alerts.length===1&&!$('btn-save-photo').disabled,'failed camera save');
  ok($('patient-photo-dialog').open,'Capture failure keeps dialog open');ok(patient.version===version,'Failure preserves patient version');
  ok($('web_patient_photo').value===patient.photo,'Failure leaves form photo unchanged');
  ok($('photo-captured-preview').src.startsWith('data:image/jpeg'),'Failed capture is available for retry');
  results.push('Failed capture keeps its preview and leaves the saved photo unchanged');
  const attempt=posts;$('btn-save-photo').click();$('btn-save-photo').click();
  await wait(()=>!$('patient-photo-dialog').open,'successful camera retry');
  ok(posts===attempt+1,'Double Save sends one request');ok(patient.version===version+1,'Capture updates local version once');
  ok($('web_patient_photo').value===patient.photo&&patient.photo.startsWith('data:image/jpeg'),'Display updates after capture is saved');
  ok(tokens.every(token=>token===me.csrfToken),'Every request uses the authenticated token despite stale globals');
  results.push('Capture retry saves once with the fresh session token and updates the patient version');
  await new Promise(resolve=>setTimeout(resolve,50));
  window.openPatientPhotoModal();const saved=patient.photo;forced=403;$('btn-remove-photo').click();
  await wait(()=>alerts.length===2&&!$('btn-remove-photo').disabled,'failed removal');
  ok($('patient-photo-dialog').open&&patient.photo===saved&&$('web_patient_photo').value===saved,'Failed removal preserves the photo');
  $('btn-remove-photo').click();await wait(()=>!$('patient-photo-dialog').open,'removal retry');
  ok(patient.photo===''&&$('web_patient_photo').value==='','Approved removal clears photo after save');results.push('Removal failure preserves the photo; retry removes it successfully');
  await new Promise(resolve=>setTimeout(resolve,50));
  window.openPatientPhotoModal();$('tab-btn-upload').click();
  const canvas=document.createElement('canvas');canvas.width=32;canvas.height=32;canvas.getContext('2d').fillRect(0,0,32,32);
  const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png')),transfer=new DataTransfer();transfer.items.add(new File([blob],'synthetic.png',{type:'image/png'}));
  networkFailure=true;$('photo-file-input').files=transfer.files;$('photo-file-input').dispatchEvent(new Event('change'));
  await wait(()=>alerts.length===3&&!$('btn-save-photo').disabled,'failed upload');
  ok($('patient-photo-dialog').open&&patient.photo===''&&$('web_patient_photo').value==='','Upload failure does not apply unsaved photo');
  ok($('upload-preview-img').src.startsWith('data:image/jpeg'),'Upload preview remains available');
  $('btn-save-photo').click();await wait(()=>!$('patient-photo-dialog').open,'upload retry');
  ok(patient.version===version+3&&patient.photo.startsWith('data:image/jpeg'),'Upload retry persists the photo');results.push('Network-failed upload remains available for Save retry');
  expired=true;const sent=posts,prior=patient.photo;
  ok(await window.persistPatientPhotoIfLoaded('')===false,'Expired session is rejected');
  ok(posts===sent&&patient.photo===prior,'Expired session sends no write and leaves the photo intact');
  ok(alerts.every(message=>/[\\u1780-\\u17ff]/.test(message)),'Save errors are shown in Khmer');results.push('Expired sessions stop before writing and display Khmer feedback');
  expired=false;window.getLoadedEmrPatient=()=>null;window.openPatientPhotoModal();$('tab-btn-upload').click();
  const newTransfer=new DataTransfer();newTransfer.items.add(new File([blob],'new-patient.png',{type:'image/png'}));
  $('photo-file-input').files=newTransfer.files;$('photo-file-input').dispatchEvent(new Event('change'));
  await wait(()=>!$('patient-photo-dialog').open,'new registration photo');
  ok(posts===sent&&$('web_patient_photo').value.startsWith('data:image/jpeg'),'New registrations stage the photo locally without a patient POST');
  results.push('Unsaved Registration stages its photo without attempting a database update');
  $('result').textContent=JSON.stringify({pass:true,results});
 })().catch(error=>document.getElementById('result').textContent=JSON.stringify({pass:false,error:error.message}))});</script></body></html>`;
 app.server.on('request',(request,response)=>{
  if(request.url==='/__v380-photo'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(harness);return;}
  native(request,response);
 });
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-v380-photo-'));
 try{
  const run=await new Promise((resolve,reject)=>{
   const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-networking','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream','--user-data-dir='+path.join(directory,'profile'),'--dump-dom','--virtual-time-budget=60000',origin+'/__v380-photo'],{windowsHide:true});
   let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(Error('Browser timed out'))},60000);
   child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
   child.on('error',error=>{clearTimeout(timer);reject(error)});child.on('close',()=>{clearTimeout(timer);resolve({stdout,stderr})});
  });
  const raw=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];assert.ok(raw&&raw!=='pending',run.stderr.slice(-1000));
  const result=JSON.parse(raw.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));console.log(JSON.stringify(result));assert.equal(result.pass,true,result.error);
  const after=db.findPatient(key),data=JSON.parse(after.record_json);assert.equal(after.version,before.version+3);
  assert.ok(data['system:patientPhoto'].startsWith('data:image/jpeg'));assert.equal(data['scope:medical:id:diag_input'],'Preserve this diagnosis');
  assert.equal(data['scope:registration:id:web_patient_photo'],data['system:patientPhoto']);assert.equal(data['scope:registration:id:patient_photo'],data['system:patientPhoto']);
 }finally{
  await new Promise(resolve=>app.server.close(resolve));db.close();
  assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('borkeo-v380-photo-'));
  fs.rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:200});
 }
});
