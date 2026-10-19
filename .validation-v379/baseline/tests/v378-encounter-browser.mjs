import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import {spawn} from 'node:child_process';
import {createEmrServer} from '../server/server.mjs';

test('actual browser isolates View/Edit/Save and renders all seven management pages without chart writes',async()=>{
  const browser=[process.env.EMR_TEST_BROWSER,'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','C:/Program Files/Google/Chrome/Application/chrome.exe'].find(file=>file&&fs.existsSync(file));
  assert.ok(browser,'Set EMR_TEST_BROWSER to run this explicit Chromium test.');
  const app=createEmrServer({demoMode:true,databasePath:':memory:',port:0,nodeEnv:'test'}),db=app.database;
  const user=db.findUser('admin').id,key='case:V378-BROWSER';
  db.upsertPatient({id:crypto.randomUUID(),patientKey:key,userId:user,savedAt:Date.now(),
    summary:{caseNumber:'V378-BROWSER',healthId:'BROWSER-ID',firstName:'Browser',lastName:'Synthetic',fullName:'Synthetic Browser',sex:'M',age:'40',dateOfBirth:'1986-01-01',phone:'012345678',equityCard:'',paymentType:'DIRECT',departmentCode:'medicine',departmentNameKh:'ជំងឺទូទៅ',departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:'2026-10-18',dischargeDate:''},
    data:{'system:caseType':'old','system:triageStatus':'COMPLETED','system:admissionStatus':'admitted',
      'scope:registration:id:web_first_name':'Browser','scope:registration:id:web_last_name':'Synthetic','scope:registration:id:web_health_id':'BROWSER-ID',
      'scope:medical:id:diag_input':'Synthetic IPD diagnosis','scope:nursing:id:care':'Synthetic nursing',
      'system:dailyMonitoringRecords':JSON.stringify(Array.from({length:6},(_,index)=>({dtVal:'2026-10-18T'+String(index+10).padStart(2,'0')+':00',evol:'Follow-up '+(index+1),conclusion:'Synthetic plan',medications:[]})))}});
  const before=db.findPatient(key);
  const native=app.server.listeners('request')[0];app.server.removeAllListeners('request');
  const required=fs.readFileSync('public/emr-required-fields.js','utf8'),editor=fs.readFileSync('public/emr-encounter-editor.js','utf8');
  function editorFixture(role='REGISTRATION',view='register'){return `<!doctype html><html lang="km"><head><meta charset="utf-8"><style>.page:not(.active){display:none}</style><script>
    window.emrSession={user:{activeRole:${JSON.stringify(role)}},csrfToken:'synthetic'};
    window.policy={view:${JSON.stringify(view)},scope:'registration',canView:true,canEdit:true};window.saved=0;window.legacySaved=0;window.printed=0;
    window.patient={patientKey:'synthetic',version:1,data:{'scope:registration:id:reg':'Original','scope:medical:id:diagnosis':'Keep medical'}};
    window.getLoadedEmrPatient=()=>window.patient;
    window.fetch=async()=>({ok:true,json:async()=>({access:window.policy})});
    window.savePatientRecord=async()=>{window.saved++;document.dispatchEvent(new CustomEvent('emr:patient-saved'));return true};
    </script><script>${required}</script><script>${editor}</script></head><body>
    <div id="page1" class="page active"><div id="sub_reg"><label>ឈ្មោះ *<input id="reg" value="Original" data-emr-storage-key="scope:registration:id:reg"></label><button onclick="window.legacySaved++">រក្សាទុក</button><button onclick="window.printed++">បោះពុម្ព</button></div></div>
    <div id="page2" class="page"><input></div><div id="page3" class="page"><div class="sub-tab" id="sub_ipd"><input data-emr-storage-key="scope:medical:id:diagnosis"></div><div id="sub_nursing" class="sub-tab"></div><div id="sub_opd" class="sub-tab"></div></div>
    <script>for(const id of ['sub_ipd','sub_nursing','sub_opd']){const panel=document.getElementById(id);if(!panel.querySelector('input'))panel.innerHTML='<input value="Synthetic">'}document.addEventListener('DOMContentLoaded',()=>document.dispatchEvent(new CustomEvent('emr:patient-loaded')))</script></body></html>`}
  const harness=`<!doctype html><html lang="km"><head><meta charset="utf-8"></head><body><pre id="result">pending</pre><script>
  (async()=>{
    const results=[];const ok=(condition,message)=>{if(!condition)throw Error(message)};
    const wait=async(fn,label)=>{for(let i=0;i<800;i++){if(fn())return;await new Promise(r=>setTimeout(r,50))}throw Error('Timeout '+label)};
    const editor=document.createElement('iframe');editor.src='/emr?patient=synthetic&view=register&mode=view&__editorFixture=1';document.body.append(editor);
    await wait(()=>editor.contentWindow.EmrEncounterEditor&&editor.contentDocument.querySelector('[data-editor-toggle]'),'editor toolbar');
    const win=editor.contentWindow,doc=editor.contentDocument,input=doc.getElementById('reg');await wait(()=>input.disabled,'initial lock');
    ok(doc.querySelector('.emr-encounter-toolbar').previousElementSibling===doc.getElementById('page1'),'Registration controls follow the form');
    ok(!doc.querySelector('[data-editor-print]'),'Registration toolbar has no Print button');
    doc.querySelector('#sub_reg button').click();ok(win.legacySaved===0,'View must not save');ok(input.disabled,'View disables editing');results.push('Registration View is read-only and blocks the legacy save');
    doc.querySelectorAll('#sub_reg button')[1].click();ok(win.printed===1,'View permits printing');
    doc.querySelector('[data-editor-toggle]').click();await wait(()=>!input.disabled,'edit unlock');
    const filtered=win.EmrEncounterEditor.filterData({'scope:registration:id:reg':'Changed','scope:medical:id:diagnosis':'FORGED'});ok(filtered['scope:medical:id:diagnosis']==='Keep medical','Edit cannot overwrite another form');results.push('Edit unlocks only its form and preserves other forms');
    input.value='';doc.querySelector('[data-editor-toggle]').click();await new Promise(r=>setTimeout(r,30));ok(win.saved===0,'Required fields block inline Save');
    input.value='Changed';doc.querySelector('[data-editor-toggle]').click();await wait(()=>win.saved===1&&input.disabled,'save and relock');ok(win.legacySaved===0,'Inline Save cannot trigger another handler');results.push('Inline Save validates, saves once and returns to read-only');
    win.policy={...win.policy,canEdit:false,requiresApproval:false,received:true,message:'កំណត់ត្រាបិទ'};win.dispatchEvent(new Event('focus'));await wait(()=>doc.querySelector('[data-editor-toggle]').disabled,'closed lock');ok(input.disabled,'Closed case remains read-only');results.push('Fresh receipt policy prevents editing');editor.remove();
    for(const [role,view,root] of [['TRIAGE','triage','page2'],['DOCTOR','opd','sub_opd'],['DOCTOR','medical','sub_ipd'],['NURSE','nursing','sub_nursing'],['MIDWIFE','nursing','sub_nursing'],['CHIEF_WARD','medical','sub_ipd']]){
      const frame=document.createElement('iframe');frame.src='/emr?patient=synthetic&mode=view&__editorFixture=1&role='+role+'&view='+view;document.body.append(frame);
      await wait(()=>frame.contentDocument.querySelector('[data-editor-toggle]')&&!frame.contentDocument.querySelector('[data-editor-toggle]').disabled,role+' toolbar');
      const page=frame.contentDocument.getElementById(root),field=page.querySelector('input');ok(field.disabled,role+' View locks fields');
      const toolbar=frame.contentDocument.querySelector('.emr-encounter-toolbar');
      ok(toolbar.previousElementSibling===(page.closest('.page')||page),role+' controls follow the form');
      ok(toolbar.querySelector('[data-editor-print]'),role+' keeps Print');
      ok(!page.hidden,role+' displays its own form');
      frame.contentDocument.querySelector('[data-editor-toggle]').click();await wait(()=>!field.disabled,role+' Edit');
      frame.contentDocument.querySelector('[data-editor-toggle]').click();await wait(()=>frame.contentWindow.saved===1&&field.disabled,role+' Save');
      results.push(role+' '+view+' View/Edit/Save stay isolated');frame.remove();
    }
    const login=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'registration'})});ok(login.ok,'Registration login');
    const list=document.createElement('iframe');list.src='/patient-list';document.body.append(list);
    await wait(()=>list.contentDocument.querySelector('tr[data-patient-key="${key}"]'),'patient list');
    const row=list.contentDocument.querySelector('tr[data-patient-key="${key}"]'),eye=row.querySelector('a.icon-action.view'),edit=row.querySelector('[data-request-edit]'),trash=row.querySelector('[data-action-delete]');
    ok(eye&&edit&&trash,'Three separate actions');const url=new URL(eye.href);ok(url.searchParams.get('view')==='register'&&url.searchParams.get('mode')==='view','Registration eye targets read-only Registration');
    ok(!row.querySelector('.payment-badge'),'No second payment badge');ok(row.querySelectorAll('[data-column=paymentType] span').length===1,'Single payment category');results.push('Actual Registration list separates icons and uses a single payment label');
    const chart=document.createElement('iframe');chart.src=eye.href;document.body.append(chart);
    await wait(()=>chart.contentWindow.getLoadedEmrPatient?.()?.patientKey==='${key}'&&chart.contentDocument.querySelector('[data-editor-toggle]')&&!chart.contentDocument.querySelector('[data-editor-toggle]').disabled,'actual Registration chart');
    const actualName=chart.contentDocument.getElementById('web_first_name');ok(actualName.disabled,'Actual Registration opens locked');
    const actualBar=chart.contentDocument.querySelector('.emr-encounter-toolbar'),actualPage=chart.contentDocument.getElementById('page1');
    ok(actualBar.previousElementSibling===actualPage,'Actual Registration controls follow the form');
    ok(actualBar.getBoundingClientRect().top>=actualPage.getBoundingClientRect().bottom,'Actual Registration toolbar appears below the form');
    ok(!actualBar.querySelector('[data-editor-print]'),'Actual Registration has no toolbar Print button');
    chart.contentDocument.querySelector('[data-editor-toggle]').click();await wait(()=>!actualName.disabled,'actual Registration unlock');
    results.push('Actual Registration form unlocks for an explicit Edit');chart.remove();
    list.remove();await fetch('/api/auth/logout',{method:'POST'});
    const manager=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin'})});ok(manager.ok,'Management login');
    const viewer=document.createElement('iframe');viewer.src='/record-viewer?patient=${key}';document.body.append(viewer);
    await wait(()=>viewer.contentDocument.querySelectorAll('.viewer-page').length===7,'seven viewer pages');
    const pages=viewer.contentDocument.querySelectorAll('.viewer-page');ok(pages[3].querySelectorAll('.viewer-followup').length===6,'All six follow-ups stay on page 4');ok(pages[6].textContent.includes('ការចេញពីពេទ្យ'),'Page 7 resume');
    await wait(()=>[...viewer.contentDocument.querySelectorAll('.viewer-page iframe')].every(frame=>frame.contentDocument?.body?.querySelector('.viewer-field')),'static snapshots');
    for(const paper of viewer.contentDocument.querySelectorAll('.viewer-page iframe')){ok(paper.contentDocument.querySelectorAll('input,textarea,select,button,script').length===0,'Viewer pages contain no editing controls or scripts')}
    ok(viewer.contentDocument.querySelectorAll('.viewer-report-source').length===0,'Live chart is disposed after snapshot');results.push('Management viewer has seven static pages, all follow-ups and a case resume');
    document.getElementById('result').textContent=JSON.stringify({results,pass:true});
  })().catch(error=>document.getElementById('result').textContent=JSON.stringify({pass:false,error:error.message}));
  </script></body></html>`;
  app.server.on('request',(request,response)=>{
    const url=new URL(request.url,'http://localhost');
    if(url.pathname==='/__v378_browser'||url.searchParams.has('__editorFixture')){response.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});response.end(url.pathname==='/__v378_browser'?harness:editorFixture(url.searchParams.get('role')||'REGISTRATION',url.searchParams.get('view')||'register'));return;}
    native(request,response);
  });
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-v378-browser-'));
  try{
    const run=await new Promise((resolve,reject)=>{
      const child=spawn(browser,['--headless=new','--disable-gpu','--no-first-run','--disable-extensions','--disable-background-networking',
        '--user-data-dir='+path.join(directory,'profile'),'--host-resolver-rules=MAP cdn.jsdelivr.net ~NOTFOUND, MAP cdn.tailwindcss.com ~NOTFOUND, MAP fonts.googleapis.com ~NOTFOUND, MAP fonts.gstatic.com ~NOTFOUND, MAP cdnjs.cloudflare.com ~NOTFOUND',
        '--dump-dom','--virtual-time-budget=60000',origin+'/__v378_browser'],{windowsHide:true});
      let stdout='',stderr='';const timer=setTimeout(()=>{child.kill();reject(Error('Browser process timed out'))},60000);
      child.stdout.on('data',chunk=>stdout+=chunk);child.stderr.on('data',chunk=>stderr+=chunk);
      child.on('error',error=>{clearTimeout(timer);reject(error)});child.on('close',()=>{clearTimeout(timer);resolve({stdout,stderr})});
    });
    const raw=run.stdout.match(/<pre id="result">([\s\S]*?)<\/pre>/)?.[1];assert.ok(raw&&raw!=='pending',run.stderr.slice(-1200));
    const result=JSON.parse(raw.replaceAll('&quot;','"').replaceAll('&amp;','&').replaceAll('&lt;','<').replaceAll('&gt;','>'));console.log(JSON.stringify(result));
    assert.equal(result.pass,true,result.error);
    const after=db.findPatient(key);assert.equal(after.version,before.version);assert.equal(after.record_json,before.record_json,'Viewing cannot write patient data');
  }finally{
    await new Promise(resolve=>app.server.close(resolve));db.close();
    assert.equal(path.dirname(path.resolve(directory)),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('borkeo-v378-browser-'));
    fs.rmSync(directory,{recursive:true,force:true,maxRetries:3,retryDelay:200});
  }
});
