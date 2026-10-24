import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';
import { encounterAccess } from '../server/encounter-access.mjs';
import { createOrder, addAttachment } from '../server/paraclinic.mjs';

test('directory groups by Health ID before filters and uses latest entry, never latest edit or name', () => {
  const source=fs.readFileSync(new URL('../public/patient-list.js',import.meta.url),'utf8');
  const context={};vm.runInNewContext(source.slice(source.indexOf('  function latestPatients('),source.indexOf('  function filteredPatients('))+'\nthis.group=latestPatients;',context);
  const rows=[
    {patientKey:'old',healthId:'SAME',entryDate:'2026-10-01',dischargeDate:'2026-10-03',updatedAt:9999,createdAt:1},
    {patientKey:'latest',healthId:'same',entryDate:'2026-10-24',dischargeDate:'',createdAt:2},
    {patientKey:'same-day',healthId:'SAME',entryDate:'2026-10-24',dischargeDate:'2026-10-24',createdAt:1},
    {patientKey:'other',healthId:'OTHER',entryDate:'2026-10-24',fullName:'Same name'},
    {patientKey:'no-id-a',healthId:'',fullName:'Same name'},
    {patientKey:'no-id-b',healthId:'',fullName:'Same name'},
  ];
  const result=context.group(rows);assert.equal(result.length,4);
  assert.ok(result.some(row=>row.patientKey==='latest'&&row.dischargeDate===''));
  assert.equal(rows.length,6);assert.match(source,/triageToday \? patients : latestPatients\(patients\)/);
});

async function fixture(){
  const app=createEmrServer({demoMode:true,databasePath:':memory:',port:0,nodeEnv:'test'}),db=app.database;
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
  const admin=db.findUser('admin').id;
  function seed(name,mode='ipd',closed=false,healthId='SYNTHETIC-SAME'){
    const patientKey='case:V438-'+name;
    const summary={caseNumber:'V438-'+name,healthId,firstName:'Synthetic',lastName:name,fullName:'Synthetic '+name,sex:'M',age:'40',dateOfBirth:'1986-01-01',phone:'012345678',equityCard:'',paymentType:'DIRECT',departmentCode:mode==='opd'?'opd':'medicine',departmentNameKh:'ជំងឺទូទៅ',departmentNameEn:'Medicine',serviceMode:mode,entryDate:name==='Old'?'2026-10-01':'2026-10-24',dischargeDate:closed?'2026-10-24':''};
    const data={'system:caseType':'old','system:triageStatus':'COMPLETED','system:workflowStage':closed?'COMPLETED':'DOCTOR_READY',
      'scope:triage:id:web_temp':name==='Old'?'37.1':'38.2','scope:medical:id:diag_input':'Synthetic diagnosis '+name};
    if(closed&&mode==='ipd')Object.assign(data,{'system:admissionStatus':'discharged','system:discharge':{dischargeAt:'2026-10-24T12:00'}});
    if(closed&&mode==='opd')data['system:opdDischarge']={dispensedAt:Date.now()};
    db.upsertPatient({id:crypto.randomUUID(),patientKey,summary,data,userId:admin,savedAt:Date.now()});return {patientKey,summary};
  }
  async function login(username){
    const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({username})});assert.equal(response.status,200);
    const Cookie=response.headers.get('set-cookie').split(';')[0];
    const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
  }
  const request=(url,headers,body,method=body?'POST':'GET')=>fetch(origin+url,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
  return {db,seed,login,request,close:async()=>{await new Promise(resolve=>app.server.close(resolve));db.close()}};
}

test('visit history returns separate triage visits and OPD/IPD medical records without writing charts or granting cross-ward edits',async()=>{
  const f=await fixture();try{
    const old=f.seed('Old','opd',true),latest=f.seed('Latest','ipd'),unrelated=f.seed('Other','ipd',false,'UNRELATED');
    const before=f.db.sqlite.prepare('SELECT patient_key,record_json,version FROM patient_records ORDER BY patient_key').all();
    for(const username of ['triage','doctor_opd']){
      const actor=await f.login(username);
      const response=await f.request('/api/record-viewer?patientKey='+encodeURIComponent(latest.patientKey),actor);assert.equal(response.status,200,await response.clone().text());
      const result=await response.json();assert.equal(result.encounters.length,2);assert.ok(!result.encounters.some(entry=>entry.patient.patientKey===unrelated.patientKey));
      const historyOld=result.encounters.find(entry=>entry.patient.patientKey===old.patientKey);
      assert.equal(historyOld.patient.data['scope:triage:id:web_temp'],'37.1');assert.ok(historyOld.patient.paymentStatus);
      if(username==='triage'){
        assert.equal(result.scope,'triage');assert.equal(historyOld.patient.data['scope:medical:id:diag_input'],undefined);assert.deepEqual(historyOld.orders,[]);assert.equal(historyOld.resume,null);
      }else{
        assert.equal(result.scope,'medical');assert.equal(historyOld.patient.data['scope:medical:id:diag_input'],'Synthetic diagnosis Old');
        const view=await f.request('/api/patient-record?readOnly=1&patientKey='+encodeURIComponent(latest.patientKey),actor);assert.equal(view.status,200);
        assert.equal((await f.request('/emr?patient='+encodeURIComponent(latest.patientKey)+'&mode=view&view=medical&recordPage=medical',actor)).status,200);
        assert.equal((await f.request('/emr?patient='+encodeURIComponent(latest.patientKey)+'&mode=edit&view=medical',actor)).status,403);
        const edit=await f.request('/api/patient-record',actor,{...latest,editorScope:'medical',editOnly:true,expectedVersion:f.db.findPatient(latest.patientKey).version,data:{'scope:medical:id:diag_input':'FORGED'}},'PUT');assert.equal(edit.status,403);
        assert.equal((await f.request('/api/patient-record?readOnly=0&patientKey='+encodeURIComponent(latest.patientKey),actor)).status,403);
      }
    }
    assert.deepEqual(f.db.sqlite.prepare('SELECT patient_key,record_json,version FROM patient_records ORDER BY patient_key').all(),before);
    for(const username of ['clerk','doctor_surgery']){
      const actor=await f.login(username);assert.equal((await f.request('/api/record-viewer?patientKey='+encodeURIComponent(latest.patientKey),actor)).status,403);
    }
  }finally{await f.close()}
});

test('discharge locks Triage per visit while Registration and a new active visit stay editable',async()=>{
 const f=await fixture();try{
   const actor=await f.login('triage');
   for(const mode of ['opd','ipd']){
     const closed=f.seed('Closed-'+mode,mode,true),active=f.seed('Active-'+mode,mode);
     const policy=item=>encounterAccess(f.db,{active_role:'TRIAGE'},f.db.findPatient(item.patientKey));
     assert.equal(policy(closed).canEdit,false);assert.equal(policy(closed).requiresApproval,false);assert.equal(policy(active).canEdit,true);
     assert.equal(encounterAccess(f.db,{active_role:'REGISTRATION'},f.db.findPatient(closed.patientKey)).canEdit,true);
     const response=await f.request('/api/patient-record',actor,{...closed,editorScope:'triage',editOnly:true,expectedVersion:f.db.findPatient(closed.patientKey).version,data:{'scope:triage:id:web_temp':'99'}},'PUT');assert.equal(response.status,403);
   }
 }finally{await f.close()}
});

test('medical history keeps laboratory and imaging results on their original visit; attachment history remains role restricted',async()=>{
 const f=await fixture(),directory=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-v438-results-'));try{
   const first=f.seed('Results-OPD','opd'),second=f.seed('Results-IPD','ipd');
   const userId=f.db.findUser('admin').id;
   const lab=createOrder(f.db,{patientKey:first.patientKey,modality:'LAB',request:{items:[{code:'HGB'}]},userId,role:'ADMIN'});
   const image=createOrder(f.db,{patientKey:second.patientKey,modality:'XRAY',request:{examination:'Synthetic chest'},userId,role:'ADMIN'});
   for(const [order,result] of [[lab,{items:[{code:'HGB',name:'Haemoglobin',value:'12.5',unit:'g/dL'}]}],[image,{findings:'Synthetic finding',conclusion:'Synthetic conclusion'}]]){
     f.db.sqlite.prepare("UPDATE paraclinic_orders SET result_json=?,status='RELEASED',released_at=? WHERE id=?").run(JSON.stringify(result),Date.now(),order.id);
   }
   const storagePath=path.join(directory,'synthetic.txt');fs.writeFileSync(storagePath,'Synthetic imaging attachment');
   const attachment=addAttachment(f.db,image.id,{filename:'synthetic.txt',contentType:'text/plain',storagePath,userId});
   const doctor=await f.login('doctor_opd');
   const response=await f.request('/api/record-viewer?patientKey='+encodeURIComponent(first.patientKey),doctor);assert.equal(response.status,200);
   const {encounters}=await response.json();
   const opd=encounters.find(entry=>entry.patient.patientKey===first.patientKey),ipd=encounters.find(entry=>entry.patient.patientKey===second.patientKey);
   assert.deepEqual(opd.orders.map(order=>order.id),[lab.id]);assert.equal(opd.orders[0].result.items[0].value,'12.5');
   assert.deepEqual(ipd.orders.map(order=>order.id),[image.id]);assert.equal(ipd.orders[0].result.conclusion,'Synthetic conclusion');
   const url='/api/paraclinic/attachments/'+attachment.id;
   assert.equal((await f.request(url,doctor)).status,403);
   const download=await f.request(url+'?history=1',doctor);assert.equal(download.status,200);assert.equal(await download.text(),'Synthetic imaging attachment');
   for(const username of ['triage','clerk','doctor_surgery'])assert.equal((await f.request(url+'?history=1',await f.login(username))).status,403);
 }finally{
   await f.close();assert.equal(path.dirname(directory),path.resolve(os.tmpdir()));assert.ok(path.basename(directory).startsWith('borkeo-v438-results-'));fs.rmSync(directory,{recursive:true,force:true});
 }
});

test('OPD treatment correction requires Director, is single use, and preserves discharge and completed queue',async()=>{
 const f=await fixture();try{
   const item=f.seed('Correction','opd',true),doctor=await f.login('doctor_opd'),admin=await f.login('admin'),director=await f.login('director');
   const save=()=>f.request('/api/patient-record',doctor,{...item,editorScope:'medical',editOnly:true,expectedVersion:f.db.findPatient(item.patientKey).version,data:{'scope:medical:id:diag_input':'Corrected synthetic diagnosis'}},'PUT');
   assert.equal((await save()).status,403);
   const response=await f.request('/api/requests',doctor,{kind:'PATIENT_EDIT',patientKey:item.patientKey,reason:'Synthetic correction',payload:{scope:'medical'}});assert.equal(response.status,200,await response.clone().text());
   const row=f.db.sqlite.prepare("SELECT * FROM workflow_requests WHERE patient_key=? AND kind='PATIENT_EDIT'").get(item.patientKey);
   assert.equal((await f.request('/api/requests/'+row.id+'/review',admin,{approved:true,revision:row.revision})).status,403);
   const bulk=await f.request('/api/requests/bulk-review',admin,{reviews:[{id:row.id,revision:row.revision}]});assert.equal(bulk.status,200);assert.equal((await bulk.json()).approvedCount,0);
   assert.equal(f.db.sqlite.prepare('SELECT status FROM workflow_requests WHERE id=?').get(row.id).status,'PENDING');
   assert.equal((await f.request('/api/requests/'+row.id+'/review',director,{approved:true,revision:row.revision})).status,200);
   const before=JSON.parse(f.db.findPatient(item.patientKey).record_json);
   const saved=await save();assert.equal(saved.status,200,await saved.clone().text());
   const after=f.db.findPatient(item.patientKey),data=JSON.parse(after.record_json);
   assert.equal(data['scope:medical:id:diag_input'],'Corrected synthetic diagnosis');assert.deepEqual(data['system:opdDischarge'],before['system:opdDischarge']);assert.equal(data['system:workflowStage'],'COMPLETED');assert.equal(after.discharge_date,'2026-10-24');
   assert.equal((await save()).status,403);
 }finally{await f.close()}
});

test('a correction saved through an embedded clinical form is also consumed atomically',async()=>{
 const f=await fixture();try{
   const item=f.seed('Embedded','ipd',true),doctor=await f.login('doctor_medicine'),director=await f.login('director');
   const save=()=>f.request('/api/clinical-forms/anc',doctor,{patientKey:item.patientKey,patient:{caseNumber:item.summary.caseNumber,firstName:'Synthetic',lastName:'Embedded'},data:{'field:synthetic':'Corrected'}},'PUT');
   assert.equal((await save()).status,403);
   assert.equal((await f.request('/api/requests',doctor,{kind:'PATIENT_EDIT',patientKey:item.patientKey,reason:'Synthetic embedded form correction',payload:{scope:'medical'}})).status,200);
   const row=f.db.sqlite.prepare("SELECT * FROM workflow_requests WHERE patient_key=? AND kind='PATIENT_EDIT'").get(item.patientKey);
   assert.equal((await f.request('/api/requests/'+row.id+'/review',director,{approved:true,revision:row.revision})).status,200);
   const before=f.db.findPatient(item.patientKey),response=await save();assert.equal(response.status,200,await response.clone().text());
   const after=f.db.findPatient(item.patientKey);assert.equal(after.version,before.version+1);assert.equal(after.record_json,before.record_json);assert.equal(after.discharge_date,before.discharge_date);
   assert.equal(f.db.sqlite.prepare('SELECT status FROM workflow_requests WHERE id=?').get(row.id).status,'APPLIED');
   assert.equal((await save()).status,403);
 }finally{await f.close()}
});
