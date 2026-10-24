// Explicit real-browser check; run only in a disposable synthetic project copy.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createEmrServer} from '../server/server.mjs';

test('browser groups patient directory and isolates selected triage and medical visits',async()=>{
 const browser=[process.env.EMR_TEST_BROWSER,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file=>file&&fs.existsSync(file));assert.ok(browser,'Chromium browser is required');
 const app=createEmrServer({demoMode:true,databasePath:':memory:',port:0,nodeEnv:'test'}),db=app.database;
 const userId=db.findUser('admin').id;
 for(const [name,mode,day,temperature] of [['OLD','opd','01','37.1'],['LATEST','ipd','24','38.2']]){
  db.upsertPatient({id:crypto.randomUUID(),patientKey:'case:V438B-'+name,userId,savedAt:Date.now(),
   summary:{caseNumber:'V438B-'+name,healthId:'V438B-SAME',firstName:'Synthetic',lastName:name,fullName:'Synthetic '+name,sex:'M',age:'40',dateOfBirth:'1986-01-01',phone:'012345678',equityCard:'',paymentType:'DIRECT',departmentCode:mode==='opd'?'opd':'medicine',departmentNameKh:'ជំងឺទូទៅ',departmentNameEn:'Medicine',serviceMode:mode,entryDate:'2026-10-'+day,dischargeDate:name==='OLD'?'2026-10-02':''},
   data:{'system:caseType':'old','system:triageStatus':'COMPLETED','system:workflowStage':name==='OLD'?'COMPLETED':'DOCTOR_READY','scope:registration:id:web_first_name':'Synthetic','scope:registration:id:web_last_name':name,'scope:registration:id:web_health_id':'V438B-SAME','scope:triage:id:p2_temp':temperature,'scope:medical:id:diag_input':'Synthetic diagnosis '+name,...(name==='OLD'?{'system:opdDischarge':{dispensedAt:Date.now()}}:{})}});
 }
 const before=db.sqlite.prepare('SELECT patient_key,version,record_json FROM patient_records ORDER BY patient_key').all();
 const native=app.server.listeners('request')[0];app.server.removeAllListeners('request');
 const harness=`<!doctype html><html><body><pre id="result">pending</pre><script>
 (async()=>{
 const checks=[],ok=(value,label)=>{if(!value)throw Error(label)},wait=async(fn,label)=>{for(let i=0;i<700;i++){if(fn())return;await new Promise(r=>setTimeout(r,50))}throw Error('Timeout '+label+' '+JSON.stringify([...document.querySelectorAll('iframe')].map(frame=>({src:frame.src,status:frame.contentDocument?.getElementById('viewer-status')?.textContent,source:[...frame.contentDocument?.querySelectorAll('.viewer-report-source')||[]].map(source=>({url:source.contentWindow.location.href,patient:source.contentWindow.getLoadedEmrPatient?.()?.patientKey,text:source.contentDocument.body.textContent.slice(-500)}))}))))};
 const login=async username=>{const response=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username})});ok(response.ok,'login '+username)};
 const frame=src=>{const node=document.createElement('iframe');node.src=src;document.body.append(node);return node};
 await login('triage');
 const list=frame('/patient-list');await wait(()=>list.contentDocument.querySelector('tr[data-patient-key="case:V438B-LATEST"]'),'directory');
 let rows=list.contentDocument.querySelectorAll('tr[data-patient-key^="case:V438B-"]');ok(rows.length===1,'one row per Health ID');
 const eye=rows[0].querySelector('a.icon-action.view');ok(eye&&new URL(eye.href).pathname==='/record-viewer','Triage View opens visit selector');checks.push('One latest directory row and visit selector');
 const viewer=frame(eye.href);await wait(()=>viewer.contentDocument.querySelectorAll('[data-visit]').length===2,'triage visit list');
 const vdoc=viewer.contentDocument;
 await wait(()=>vdoc.querySelector('#viewer-document .viewer-page iframe')?.contentDocument?.body?.textContent.includes('38.2'),'latest triage snapshot');
 ok(vdoc.querySelectorAll('#viewer-document .viewer-page').length===1,'only triage page');
 vdoc.querySelector('[data-visit="case:V438B-OLD"]').click();
 await wait(()=>vdoc.querySelector('#viewer-document .viewer-page iframe')?.contentDocument?.body?.textContent.includes('37.1'),'old triage snapshot');
 ok(!vdoc.querySelector('#viewer-document .viewer-page iframe').contentDocument.body.textContent.includes('38.2'),'no other visit triage values');
 ok(!vdoc.querySelector('[data-visit="case:V438B-OLD"]').closest('tr').querySelector('a'),'discharged triage has no Edit');checks.push('Selected triage date only; discharged visit locked');
 viewer.remove();list.remove();await login('doctor_opd');
 const medical=frame('/record-viewer?patient=case%3AV438B-LATEST');
 await wait(()=>medical.contentDocument.querySelectorAll('#viewer-document .viewer-page').length===7,'OPD doctor IPD record');
 await wait(()=>medical.contentDocument.querySelector('#viewer-document .viewer-page iframe')?.contentDocument?.querySelector('.viewer-field'),'IPD snapshot');
 ok(medical.contentDocument.querySelectorAll('[data-visit]').length===2,'OPD doctor sees both visits');
 medical.contentDocument.querySelector('[data-visit="case:V438B-OLD"]').click();
 await wait(()=>medical.contentDocument.querySelectorAll('#viewer-document .viewer-page').length===1&&medical.contentDocument.querySelector('#viewer-document .viewer-page iframe')?.contentDocument?.querySelector('.viewer-field'),'OPD snapshot');
 ok(medical.contentDocument.querySelector('#viewer-document .viewer-page iframe').contentDocument.querySelectorAll('input,textarea,select,button,script').length===0,'medical snapshot is static');checks.push('OPD doctor views separate OPD and IPD records');
 medical.remove();
 const send=async(url,body)=>{const me=await(await fetch('/api/auth/me')).json();return fetch(url,{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:JSON.stringify(body)})};
 const requested=await send('/api/requests',{kind:'PATIENT_EDIT',patientKey:'case:V438B-OLD',reason:'Synthetic correction',payload:{scope:'medical'}});ok(requested.ok,'request discharged correction');const request=await requested.json();
 await login('director');const submitted=request.request||request;const reviewed=await send('/api/requests/'+submitted.id+'/review',{approved:true,revision:submitted.revision});ok(reviewed.ok,'Director approves correction '+await reviewed.text());
 await login('doctor_opd');const correction=frame('/emr?patient=case%3AV438B-OLD&view=opd&mode=edit');
 await wait(()=>correction.contentWindow.getLoadedEmrPatient?.()?.recordAccess?.correctionId&&correction.contentDocument.querySelector('[data-editor-toggle]'),'approved correction chart');
 await wait(()=>correction.contentDocument.getElementById('diag_input')&&!correction.contentDocument.getElementById('diag_input').disabled,'approved correction unlock');checks.push('Director-approved discharged OPD correction unlocks for its doctor');
 document.getElementById('result').textContent=JSON.stringify({pass:true,checks});
 })().catch(error=>document.getElementById('result').textContent=JSON.stringify({pass:false,error:error.message}));
 </script></body></html>`;
 app.server.on('request',(request,response)=>{if(request.url==='/__v438_browser'){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(harness);return}native(request,response)});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
 const profile=path.resolve('.browser-v438-'+crypto.randomUUID());
 try{
  const output=await new Promise((resolve,reject)=>{
   const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-networking','--user-data-dir='+profile,'--host-resolver-rules=MAP cdn.jsdelivr.net ~NOTFOUND, MAP cdn.tailwindcss.com ~NOTFOUND, MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND, MAP cdnjs.cloudflare.com ~NOTFOUND','--dump-dom','--virtual-time-budget=180000',origin+'/__v438_browser'],{windowsHide:true});
   let stdout='',stderr='';const timeout=setTimeout(()=>{child.kill();reject(Error('Browser timeout'))},120000);child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);child.on('error',reject);child.on('close',()=>{clearTimeout(timeout);resolve({stdout,stderr})});
  });
  const raw=output.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];assert.ok(raw&&raw!=='pending',output.stderr.slice(-1400));
  const result=JSON.parse(raw.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));console.log(result);assert.equal(result.pass,true,result.error);
  assert.deepEqual(db.sqlite.prepare('SELECT patient_key,version,record_json FROM patient_records ORDER BY patient_key').all(),before,'Viewing must preserve charts');
 }finally{
  await new Promise(resolve=>app.server.close(resolve));db.close();
  assert.equal(path.dirname(profile),process.cwd());assert.ok(path.basename(profile).startsWith('.browser-v438-'));fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200});
 }
});
