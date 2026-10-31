import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {syntheticImportProfile,syntheticExportProfile} from './helpers/pmrs-profiles.mjs';
import {createEmrServer} from '../server/server.mjs';
import {hashPassword} from '../server/password.mjs';
import {setUserAccess} from '../server/access.mjs';
import {setFinanceProfile} from '../server/finance.mjs';

async function fixture({enabled=true,readOnly=false}={}) {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-pmrs-browser-'));
  let identity={patientId:'PMRS-001',encounterId:'VISIT-001'}, submissions=0,closeCount=0;
  const clinical={diagnosisText:'Verified source diagnosis',diagnosisIcd10:'A90'};
  const adapter={
    identity:async()=>structuredClone(identity),
    capture:async()=>({identity:structuredClone(identity),registration:{fullName:'Synthetic Patient',healthId:identity.patientId,caseNumber:identity.encounterId},clinical:structuredClone(clinical)}),
    plan:async()=>[{path:'clinical.diagnosisText',before:'Old diagnosis',after:'New diagnosis',spec:{}}],
    check:async()=>{}, fill:async()=>{},submit:async()=>{submissions++;},
  };
  const app=createEmrServer({demoMode:false,host:'127.0.0.1',port:0,appOrigin:'http://localhost',databasePath:path.join(directory,'patients.sqlite'),nodeEnv:'test',
    pmrsOptions:{profile:enabled?(readOnly?syntheticImportProfile():syntheticExportProfile()):null,open:async()=>({adapter,close:async()=>{closeCount++;}})}});
  const credentials={};
  for(const [username,role,ward] of [['doctor','DOCTOR','opd'],['other','DOCTOR','opd'],['pediatric','DOCTOR','pediatric'],['registration','REGISTRATION',''],['lab','LAB','']]) {
    const id=crypto.randomUUID();app.database.createUser({id,username,displayName:username,role,passwordHash:await hashPassword('Synthetic password 2026!'),mustChangePassword:false,createdAt:Date.now()});
    setUserAccess(app.database,id,[role],ward?[ward]:[]);credentials[username]={id};
  }
  const patientKey='case:SYNTHETIC-001';
  const summary={caseNumber:'SYNTHETIC-001',healthId:'HOSPITAL-001',firstName:'Patient',lastName:'Synthetic',fullName:'Synthetic Patient',sex:'Female',age:'30',dateOfBirth:'1996-01-01',phone:'',equityCard:'',paymentType:'HEF',departmentCode:'opd',departmentNameKh:'ផ្នែកជំងឺទូទៅ',departmentNameEn:'Medicine',serviceMode:'opd',entryDate:'2026-10-30',dischargeDate:''};
  const data={'system:currentWardCode':'opd','scope:medical:id:emr_pmrs_opd_diagnosis':'Old diagnosis','scope:medical:id:diag_input':'A90','scope:triage:id:pmrs_chief_complaint':'Fever','system:caseType':'new',
    ...Object.fromEntries(Object.entries({weight:'50',height:'160',temp:'37',bp_sys:'120',bp_dia:'80',pulse:'80',resp:'18',spo2:'98'}).map(([k,v])=>['scope:triage:id:p2_'+k,v])),
    'scope:registration:id:web_date':'2026-10-30','scope:registration:id:web_time':'09:00',
    'system:opdMedications':JSON.stringify([{name:'Synthetic tablet',route:'po',unit:'គ្រាប់',scheduleType:'bid',doseAmount:'1',m:'1',a:'0',e:'1',n:'0',d:'2'}])};
  app.database.upsertPatient({id:crypto.randomUUID(),patientKey,userId:credentials.doctor.id,summary,data,savedAt:Date.now()});
  setFinanceProfile(app.database,patientKey,{paymentType:'HEF',hefType:'EQUITY'},credentials.doctor.id);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+app.server.address().port;
  for(const username of Object.keys(credentials)) {
    const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,password:'Synthetic password 2026!'})});
    assert.equal(login.status,200);const cookie=login.headers.get('set-cookie').split(';',1)[0];
    const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie:cookie}})).json();
    credentials[username].headers={Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
  }
  const request=async(action,body={},username='doctor',headers={})=>{
    const response=await fetch(origin+'/api/pmrs/'+action,{method:'POST',headers:{...credentials[username].headers,...headers},body:JSON.stringify(body)});
    return {status:response.status,...await response.json()};
  };
  const version=()=>app.database.findPatient(patientKey).version;
  const close=async()=>{await new Promise(resolve=>app.server.close(resolve));app.database.close();fs.rmSync(directory,{recursive:true,force:true});};
  return {app,origin,request,patientKey,version,close,credentials,clinical,adapter,identity,summary,setIdentity:v=>{identity=v;},counts:()=>({submissions,closeCount})};
}

test('PMRS browser import is session-bound, explicitly linked, reviewed, versioned and ward-scoped; legacy tools are retired',async()=>{
  const f=await fixture();try{
    assert.equal((await f.request('open',{},'lab')).status,403);
    assert.equal((await f.request('open',{},'doctor',{'X-CSRF-Token':'bad'})).status,403);
    assert.equal((await f.request('open')).opened,true);
    assert.equal((await f.request('open')).status,409);
    const captured=await f.request('capture');assert.equal(captured.status,200);
    assert.equal((await f.request('import-preview',{patientKey:f.patientKey,version:f.version(),job:captured.job},'other')).code,'SESSION_EXPIRED');
    assert.equal((await f.request('import-preview',{patientKey:f.patientKey,version:f.version(),job:captured.job})).code,'IDENTITY_MISMATCH');
    const link={patientKey:f.patientKey,version:f.version(),job:captured.job,reviewed:true,confirmedPatientId:'PMRS-001',confirmedEncounterId:'VISIT-001',confirmedLocalId:'SYNTHETIC-001'};
    assert.equal((await f.request('link',{...link,confirmedLocalId:'wrong'})).code,'IDENTITY_MISMATCH');
    assert.equal((await f.request('link',link)).linked,true);
    const body={patientKey:f.patientKey,version:f.version(),job:captured.job,reviewed:true};
    assert.equal((await f.request('import',body)).code,'REVIEW_EXPIRED');
    const preview=await f.request('import-preview',body);assert.equal(preview.status,200);assert.equal(preview.changes.length,1);
    f.setIdentity({patientId:'wrong',encounterId:'VISIT-001'});
    assert.equal((await f.request('import',body)).code,'IDENTITY_CHANGED');
    f.setIdentity({patientId:'PMRS-001',encounterId:'VISIT-001'});
    assert.equal((await f.request('import',{...body,reviewed:false})).code,'REVIEW_REQUIRED');
    assert.equal((await f.request('import',body)).imported,true);
    const saved=f.app.database.findPatient(f.patientKey);assert.equal(saved.health_id,'HOSPITAL-001');
    const patient=JSON.parse(saved.record_json);assert.equal(patient['scope:medical:id:emr_pmrs_opd_diagnosis'],'Verified source diagnosis');
    assert.equal((await f.request('import',body)).code,'RECORD_CHANGED');
    assert.equal((await f.request('close')).closed,true);
    assert.equal(f.counts().closeCount,1);
    for(const route of ['/api/pmrs2/preview','/pmrs-import','/public/pmrs2-panel.mjs'])assert.equal((await fetch(f.origin+route,{headers:f.credentials.doctor.headers})).status,404,route);
    const wardPreview=await fetch(f.origin+'/api/pmrs/clinical-preview?patientKey='+encodeURIComponent(f.patientKey),{headers:f.credentials.pediatric.headers});assert.equal(wardPreview.status,403);
  }finally{await f.close();}
});

test('PMRS browser export requires review and separate fill/submit, rejects stale versions, and blocks duplicate/uncertain retries',async()=>{
  const f=await fixture();try{
    await f.request('open');const captured=await f.request('capture');
    await f.request('link',{patientKey:f.patientKey,version:f.version(),job:captured.job,reviewed:true,confirmedPatientId:'PMRS-001',confirmedEncounterId:'VISIT-001',confirmedLocalId:'SYNTHETIC-001'});
    let preview=await f.request('export-preview',{patientKey:f.patientKey,version:f.version()});assert.equal(preview.status,200);assert.ok(preview.job,JSON.stringify(preview));
    const body={patientKey:f.patientKey,version:f.version(),job:preview.job,reviewed:true};
    assert.equal((await f.request('submit',body)).code,'FILL_REQUIRED');
    assert.equal((await f.request('fill',{...body,version:0})).code,'RECORD_CHANGED');
    assert.equal((await f.request('fill',body)).filled,true);
    assert.equal(f.counts().submissions,0);
    assert.equal((await f.request('submit',{...body,reviewed:false})).code,'REVIEW_REQUIRED');
    assert.equal((await f.request('submit',body)).submitted,true);assert.equal(f.counts().submissions,1);
    preview=await f.request('export-preview',{patientKey:f.patientKey,version:f.version()});body.job=preview.job;
    await f.request('fill',body);assert.equal((await f.request('submit',body)).code,'EXPORT_ALREADY_ATTEMPTED');assert.equal(f.counts().submissions,1);
    // A changed clinical payload with an uncertain remote outcome also cannot be retried.
    const row=f.app.database.findPatient(f.patientKey);const data=JSON.parse(row.record_json);data['scope:medical:id:emr_pmrs_opd_diagnosis']='New source';
    f.app.database.upsertPatient({id:crypto.randomUUID(),patientKey:f.patientKey,userId:f.credentials.doctor.id,summary:f.summary,data,savedAt:Date.now()});
    body.version=f.version();preview=await f.request('export-preview',{patientKey:f.patientKey,version:f.version()});body.job=preview.job;
    await f.request('fill',body);f.adapter.submit=async()=>{throw Error('synthetic timeout');};
    assert.equal((await f.request('submit',body)).code,'SUBMISSION_UNKNOWN');
    assert.equal(f.app.database.sqlite.prepare("SELECT count(*) n FROM pmrs_browser_exports WHERE state='unknown'").get().n,1);
  }finally{await f.close();}
});

test('captured PMRS medicines retain the HEF restriction, explicit units/routes and idempotency ledger',async()=>{
  const f=await fixture();try{
    f.clinical.prescription={sourceDateTime:'2026-10-30T09:00',medications:[{name:'Synthetic medicine',route:'po',unit:'mg',morning:'1',afternoon:'0',evening:'1',night:'0',days:'2'}]};
    await f.request('open');let captured=await f.request('capture');
    await f.request('link',{patientKey:f.patientKey,version:f.version(),job:captured.job,reviewed:true,confirmedPatientId:'PMRS-001',confirmedEncounterId:'VISIT-001',confirmedLocalId:'SYNTHETIC-001'});
    let body={patientKey:f.patientKey,version:f.version(),job:captured.job,reviewed:true};
    setFinanceProfile(f.app.database,f.patientKey,{paymentType:'CASH'},f.credentials.doctor.id);
    assert.equal((await f.request('import-preview',body)).code,'HEF_REQUIRED');
    setFinanceProfile(f.app.database,f.patientKey,{paymentType:'HEF',hefType:'EQUITY'},f.credentials.doctor.id);
    assert.equal((await f.request('import-preview',body)).medicinesAdded,1);
    assert.equal((await f.request('import',body)).imported,true);
    captured=await f.request('capture');body={...body,version:f.version(),job:captured.job};
    const again=await f.request('import-preview',body);assert.equal(again.medicinesAdded,0);assert.equal(again.skipped,1);
    const data=JSON.parse(f.app.database.findPatient(f.patientKey).record_json),meds=JSON.parse(data['system:opdMedications']);
    assert.equal(meds.filter(m=>m.name==='Synthetic medicine').length,1);assert.equal(meds.at(-1).unit,'mg');assert.equal(meds.at(-1).scheduleType,'bid');
  }finally{await f.close();}
});

test('PMRS remains disabled without verified configuration, and registration role cannot submit clinical changes',async()=>{
  const f=await fixture({enabled:false});try{
    const response=await fetch(f.origin+'/api/pmrs/status',{headers:f.credentials.doctor.headers});assert.equal((await response.json()).configured,false);
    assert.equal((await f.request('open')).code,'PROFILE_UNVERIFIED');
    assert.equal((await f.request('submit',{},'registration')).status,403);
    const html=await(await fetch(f.origin+'/pmrs',{headers:f.credentials.registration.headers})).text();assert.match(html,/pmrs-preview/);assert.doesNotMatch(html,/pmrs2-paste|prepare-export/);
  }finally{await f.close();}
});

test('import-only connection can capture, link and import while every export API remains blocked',async()=>{
  const f=await fixture({readOnly:true});try{
    const status=await(await fetch(f.origin+'/api/pmrs/status',{headers:f.credentials.doctor.headers})).json();
    assert.equal(status.configured,true);assert.equal(status.importReady,true);assert.equal(status.exportReady,false);
    assert.equal((await f.request('open')).opened,true);
    const captured=await f.request('capture');assert.ok(captured.job);
    f.adapter.plan=async()=>{throw Error('Unverified export adapter must never be called');};
    for(const action of ['export-preview','fill','submit']){
      const result=await f.request(action,{patientKey:f.patientKey,version:f.version(),job:captured.job,reviewed:true});
      assert.equal(result.status,503,action);assert.equal(result.code,'EXPORT_UNVERIFIED',action);
    }
    // Failed export must not consume the pending import job.
    const linked=await f.request('link',{patientKey:f.patientKey,version:f.version(),job:captured.job,reviewed:true,confirmedPatientId:'PMRS-001',confirmedEncounterId:'VISIT-001',confirmedLocalId:'SYNTHETIC-001'});assert.equal(linked.linked,true);
    const body={patientKey:f.patientKey,version:f.version(),job:captured.job,reviewed:true};
    assert.equal((await f.request('import-preview',body)).status,200);
    assert.equal((await f.request('import',body)).imported,true);
    assert.equal(f.counts().submissions,0);
    assert.equal(f.app.database.sqlite.prepare('SELECT count(*) n FROM pmrs_browser_exports').get().n,0);
  }finally{await f.close();}
});
