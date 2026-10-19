import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createEmrServer} from '../server/server.mjs';
import {encounterAccess,assertEncounterWrite} from '../server/encounter-access.mjs';
import {addCharge,addPayment,patientBill,setFinanceProfile} from '../server/finance.mjs';

async function fixture(){
  const app=createEmrServer({demoMode:true,databasePath:':memory:',port:0,nodeEnv:'test'}),db=app.database;
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
  const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
  const admin=db.findUser('admin').id;
  function seed(name,mode='ipd',data={},healthId='ID-'+name){
    const patientKey='case:V378-'+name;
    const summary={caseNumber:'V378-'+name,healthId,firstName:'Synthetic',lastName:name,fullName:'Synthetic '+name,
      sex:'M',age:'40',dateOfBirth:'1986-01-01',phone:'012345678',equityCard:'',paymentType:'DIRECT',
      departmentCode:mode==='opd'?'opd':mode==='ipd'?'medicine':'',departmentNameKh:'ផ្នែកសាកល្បង',departmentNameEn:'Synthetic',
      serviceMode:mode,entryDate:'2026-10-18',dischargeDate:data['system:admissionStatus']==='discharged'?'2026-10-18':''};
    db.upsertPatient({id:crypto.randomUUID(),patientKey,summary,data:{'system:caseType':'old','system:triageStatus':'COMPLETED','system:workflowStage':'DOCTOR_READY',
      'scope:registration:id:web_first_name':'Original','scope:medical:id:diag_input':'Original diagnosis','scope:nursing:id:care':'Original nursing',...data},userId:admin,savedAt:Date.now()});
    return {patientKey,summary};
  }
  async function login(username){
    const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify({username})});
    assert.equal(response.status,200,await response.clone().text());
    const Cookie=response.headers.get('set-cookie').split(';')[0];
    const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
    return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
  }
  const request=(url,headers,body,method=body?'POST':'GET')=>fetch(origin+url,{method,headers,...(body?{body:JSON.stringify(body)}:{})});
  return {app,db,admin,seed,login,request,close:async()=>{await new Promise(resolve=>app.server.close(resolve));db.close()}};
}

test('clinical role matrix, pharmacy receipt and discharge locks are enforced',async()=>{
 const f=await fixture();try{
  const opd=f.seed('OPD','opd'),ipd=f.seed('IPD'),closed=f.seed('Closed','ipd',{'system:admissionStatus':'discharged','system:discharge':{dischargeAt:'2026-10-18T12:00'}});
  const received=f.seed('Received','opd',{'system:opdDischarge':{dispensedAt:Date.now()}});
  for(const [role,ward,key,view,canEdit] of [
   ['REGISTRATION','',ipd.patientKey,'register',true],['TRIAGE','',ipd.patientKey,'triage',true],
   ['DOCTOR','opd',opd.patientKey,'opd',true],['DOCTOR','medicine',ipd.patientKey,'medical',true],
   ['CHIEF_WARD','medicine',ipd.patientKey,'medical',true],['NURSE','medicine',ipd.patientKey,'nursing',true],
   ['MIDWIFE','medicine',ipd.patientKey,'nursing',true],['DOCTOR','opd',received.patientKey,'opd',false],
   ['DOCTOR','medicine',closed.patientKey,'medical',false],['NURSE','medicine',closed.patientKey,'nursing',false],
  ]){
   const session={active_role:role,active_ward_code:ward,user_id:f.admin},patient=f.db.findPatient(key),access=encounterAccess(f.db,session,patient);
   assert.equal(access.view,view,role);assert.equal(access.canEdit,canEdit,role);
   if(canEdit)assert.doesNotThrow(()=>assertEncounterWrite(f.db,session,patient,access.scope));else assert.throws(()=>assertEncounterWrite(f.db,session,patient,access.scope));
  }
  for(const role of ['ADMIN','VICE_DIRECTOR','DIRECTOR']){
   const access=encounterAccess(f.db,{active_role:role,user_id:f.admin},f.db.findPatient(closed.patientKey),'medical');
   assert.equal(access.requiresApproval,true);assert.equal(access.canEdit,false);
   for(const scope of ['opd','daily','unknown'])assert.throws(()=>assertEncounterWrite(f.db,{active_role:role,user_id:f.admin},f.db.findPatient(closed.patientKey),scope));
  }
  assert.equal(encounterAccess(f.db,{active_role:'DOCTOR',active_ward_code:'opd',user_id:f.admin},f.db.findPatient(ipd.patientKey)).canView,false);
  assert.throws(()=>assertEncounterWrite(f.db,{active_role:'NURSE',active_ward_code:'medicine',user_id:f.admin},f.db.findPatient(ipd.patientKey),'medical'));
 }finally{await f.close()}
});

test('completed Triage edits stay in Triage for staff and management without rerouting the encounter',async()=>{
 const f=await fixture();try{
  for(const username of ['triage','admin']){
   const actor=await f.login(username),item=f.seed('Triage-'+username),before=f.db.findPatient(item.patientKey);
   const response=await f.request('/api/patient-record',actor,{...item,editorScope:'triage',editOnly:true,expectedVersion:before.version,
    data:{'scope:triage:id:web_temp':'38.1','scope:medical:id:diag_input':'FORGED','scope:nursing:id:care':'FORGED'}},'PUT');
   assert.equal(response.status,200,await response.clone().text());
   const after=f.db.findPatient(item.patientKey),data=JSON.parse(after.record_json);
   assert.equal(data['scope:triage:id:web_temp'],'38.1');
   assert.equal(data['scope:medical:id:diag_input'],'Original diagnosis');assert.equal(data['scope:nursing:id:care'],'Original nursing');
   assert.equal(data['system:triageStatus'],'COMPLETED');assert.equal(after.department_code,before.department_code);assert.equal(after.service_mode,before.service_mode);
  }
 }finally{await f.close()}
});

test('IPD corrections require requester/scope/version-bound management approval, consumed by one save',async()=>{
 const f=await fixture();try{
  const item=f.seed('Correction','ipd',{'system:admissionStatus':'discharged','system:discharge':{dischargeAt:'2026-10-18T12:00'}});
  const doctor=await f.login('doctor_medicine'),manager=await f.login('admin');
  const save=()=>f.request('/api/patient-record',doctor,{...item,editorScope:'medical',editOnly:true,
    expectedVersion:f.db.findPatient(item.patientKey).version,data:{'scope:medical:id:diag_input':'Corrected diagnosis','scope:registration:id:web_first_name':'FORGED','scope:nursing:id:care':'FORGED'}},'PUT');
  assert.equal((await save()).status,403);
  const sent=await f.request('/api/requests',doctor,{kind:'PATIENT_EDIT',patientKey:item.patientKey,reason:'Synthetic correction',payload:{scope:'medical'}});
  assert.equal(sent.status,200,await sent.clone().text());const sentBody=await sent.json(),id=sentBody.id||sentBody.request?.id||sentBody.result?.id;
  assert.ok(id,JSON.stringify(sentBody));
  const row=f.db.sqlite.prepare('SELECT * FROM workflow_requests WHERE id=?').get(id);
  const review=await f.request('/api/requests/'+id+'/review',manager,{approved:true,revision:row.revision});assert.equal(review.status,200,await review.clone().text());
  const response=await save();assert.equal(response.status,200,await response.clone().text());
  const patient=f.db.findPatient(item.patientKey),data=JSON.parse(patient.record_json);
  assert.equal(data['scope:medical:id:diag_input'],'Corrected diagnosis');
  assert.equal(data['scope:registration:id:web_first_name'],'Original');assert.equal(data['scope:nursing:id:care'],'Original nursing');
  assert.equal(patient.discharge_date,'2026-10-18');assert.equal(data['system:admissionStatus'],'discharged');
  assert.equal((await save()).status,403);
  assert.equal(f.db.sqlite.prepare('SELECT status FROM workflow_requests WHERE id=?').get(id).status,'APPLIED');
 }finally{await f.close()}
});

test('patient trash always requests approval and deletes only the selected encounter after review',async()=>{
 const f=await fixture();try{
  const item=f.seed('Delete','',{},'SAME-IDENTITY'),other=f.seed('Keep','',{},'SAME-IDENTITY');
  const registration=await f.login('registration'),admin=await f.login('admin');
  for(const headers of [registration,admin])assert.equal((await f.request('/api/patient-record',headers,{patientKey:item.patientKey},'DELETE')).status,403);
  assert.equal((await f.request('/api/patient-triage',registration,{patientKey:item.patientKey},'DELETE')).status,403);
  const response=await f.request('/api/requests',registration,{kind:'PATIENT_DELETE',patientKey:item.patientKey,reason:'Synthetic duplicate'});
  assert.equal(response.status,200,await response.clone().text());assert.ok(f.db.findPatient(item.patientKey));
  const row=f.db.sqlite.prepare("SELECT * FROM workflow_requests WHERE patient_key=? AND kind='PATIENT_DELETE'").get(item.patientKey);
  const review=await f.request('/api/requests/'+row.id+'/review',admin,{approved:true,revision:row.revision});assert.equal(review.status,200,await review.clone().text());
  assert.equal(f.db.findPatient(item.patientKey),null);assert.ok(f.db.findPatient(other.patientKey));
 }finally{await f.close()}
});

test('paid invoice history, approved correction and approved cancellation preserve audited receipt entries',async()=>{
 const f=await fixture();try{
  const item=f.seed('Invoice');setFinanceProfile(f.db,item.patientKey,{paymentType:'DIRECT',paymentSubtype:'FULL'},f.admin);
  const charge=addCharge(f.db,item.patientKey,{description:'Synthetic service',category:'Synthetic',quantity:1,unitAmount:1000,currency:'KHR'},f.admin);
  let bill=patientBill(f.db,item.patientKey),invoiceId=bill.invoice.id;
  addPayment(f.db,item.patientKey,{invoiceId,source:'CASH',amount:1000,currency:'KHR'},f.admin);
  const clerk=await f.login('clerk'),manager=await f.login('admin');
  const history=await(await f.request('/api/finance/invoice-history?patientKey='+encodeURIComponent(item.patientKey),clerk)).json();
  assert.ok(history.invoices.length>0);assert.ok(history.invoices.every(entry=>entry.settled));
  const receipt=patientBill(f.db,item.patientKey,invoiceId).payments.find(payment=>!payment.voidedAt);
  for(const actor of [clerk,manager]){
    const blocked=await f.request('/api/finance/void',actor,{kind:'payment',id:receipt.id,reason:'Attempt direct reversal'});
    assert.equal(blocked.status,actor===clerk?403:400);assert.ok((await blocked.json()).error);
  }
  assert.equal(f.db.sqlite.prepare('SELECT voided_at FROM finance_payments WHERE id=?').get(receipt.id).voided_at,null);
  assert.equal((await f.request('/api/finance/invoices/'+invoiceId+'/direct-edit',clerk,{patientKey:item.patientKey,charges:[]})).status,403);
  const correction=await f.request('/api/finance/invoice-edit-requests',clerk,{patientKey:item.patientKey,invoiceId,reason:'Synthetic correction'});assert.equal(correction.status,201,await correction.clone().text());
  const id=(await correction.json()).id;
  bill=patientBill(f.db,item.patientKey,invoiceId);const charges=bill.charges.filter(c=>!c.voidedAt).map(c=>({id:c.id,description:c.description,quantity:c.quantity,unitAmount:c.unitAmount,note:'Corrected note'}));
  assert.equal((await f.request('/api/finance/invoice-edit-requests/'+id+'/apply',clerk,{charges})).status,409);
  assert.equal((await f.request('/api/finance/invoice-edit-requests/'+id+'/review',manager,{approved:true})).status,200);
  const applied=await f.request('/api/finance/invoice-edit-requests/'+id+'/apply',clerk,{charges});assert.equal(applied.status,200,await applied.clone().text());
  assert.equal((await f.request('/api/finance/invoice-edit-requests/'+id+'/apply',clerk,{charges})).status,409);
  const count=f.db.sqlite.prepare('SELECT COUNT(*) n FROM finance_payments WHERE invoice_id=?').get(invoiceId).n;
  const cancel=await f.request('/api/finance/invoice-edit-requests',clerk,{patientKey:item.patientKey,invoiceId,reason:'Synthetic cancellation',operation:'VOID'});assert.equal(cancel.status,201,await cancel.clone().text());
  const cancelId=(await cancel.json()).id;
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM finance_payments WHERE invoice_id=? AND voided_at IS NULL').get(invoiceId).n,count);
  const reviewed=await f.request('/api/finance/invoice-edit-requests/'+cancelId+'/review',manager,{approved:true});assert.equal(reviewed.status,200,await reviewed.clone().text());
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM finance_payments WHERE invoice_id=?').get(invoiceId).n,count);
  assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM finance_payments WHERE invoice_id=? AND voided_at IS NULL').get(invoiceId).n,0);
 }finally{await f.close()}
});

test('management viewer separates encounters, includes all follow-ups and performs no patient writes',async()=>{
 const f=await fixture();try{
  const historyId='VIEWER-IDENTITY',opd=f.seed('ViewerOPD','opd',{},historyId),ipd=f.seed('ViewerIPD','ipd',{'system:dailyMonitoringRecords':JSON.stringify(Array.from({length:6},(_,index)=>({dtVal:'2026-10-18T'+String(index+10).padStart(2,'0')+':00',evol:'Synthetic follow-up '+index,medications:[]})))},historyId);
  f.seed('Unrelated','ipd',{},'OTHER-IDENTITY');
  const admin=await f.login('admin'),clerk=await f.login('clerk');
  const before=f.db.sqlite.prepare('SELECT patient_key,version,record_json FROM patient_records ORDER BY patient_key').all();
  const response=await f.request('/api/record-viewer?patientKey='+encodeURIComponent(ipd.patientKey),admin);assert.equal(response.status,200,await response.clone().text());
  const data=await response.json();assert.equal(data.encounters.length,2);
  assert.equal(data.encounters.find(entry=>entry.patient.patientKey===ipd.patientKey).resume.evolution.length,6);
  assert.ok(data.encounters.some(entry=>entry.patient.patientKey===opd.patientKey));
  assert.deepEqual(f.db.sqlite.prepare('SELECT patient_key,version,record_json FROM patient_records ORDER BY patient_key').all(),before);
  assert.equal((await f.request('/api/record-viewer?patientKey='+encodeURIComponent(ipd.patientKey),clerk)).status,403);
 }finally{await f.close()}
});
