import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import {createEmrServer} from '../server/server.mjs';
import {hashPassword} from '../server/password.mjs';
import {setUserAccess} from '../server/access.mjs';
import {setESignature} from '../server/esign.mjs';

test('OPD submit sends a pharmacy message with an immutable medicine snapshot, isolated by role',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-pharmacy-'));
  const origin='http://127.0.0.1:32211';
  const app=createEmrServer({ demoMode: false,host:'127.0.0.1',port:32211,appOrigin:origin,databasePath:path.join(directory,'test.sqlite'),autoDatabase:false,nodeEnv:'test'});
  try{
    const password='Example secure pharmacy password 2026!';
    const passwordHash=await hashPassword(password);
    let doctorId='';
    for(const [username,role,wards] of [['opddoc','DOCTOR',['opd']],['pharmacist','PHARMACY',[]],['otherdoc','DOCTOR',['medicine']],['opdnurse','NURSE',['opd']],['register','REGISTRATION',[]],['triage','TRIAGE',[]],['clerk','CLERK',[]]]){
      const id=crypto.randomUUID();app.database.createUser({id,username,displayName:username,role,passwordHash,createdAt:Date.now()});setUserAccess(app.database,id,[role],wards);
      if(username==='opddoc') doctorId=id;
    }
    const doctorPng='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';
    setESignature(app.database,doctorId,{signerName:'Doctor Test',signatureDataUrl:doctorPng},doctorId);
    await new Promise(resolve=>app.server.listen(32211,'127.0.0.1',resolve));
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,password})});
      assert.equal(response.status,200);const cookie=response.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie:cookie}})).json();
      return {Cookie:cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    };
    const doctor=await login('opddoc'),pharmacy=await login('pharmacist'),other=await login('otherdoc'),nurse=await login('opdnurse'),registration=await login('register'),triage=await login('triage'),clerk=await login('clerk');
    const body={patientKey:'case:OPD-PHARMACY-TEST',summary:{caseNumber:'OPD-PHARMACY-TEST',healthId:'TEST-ID',fullName:'Example Patient',firstName:'Example',lastName:'Patient',sex:'ស្រី',age:'20',dateOfBirth:'',phone:'',equityCard:'',paymentType:'CASH',departmentCode:'opd',departmentNameKh:'ពិគ្រោះក្រៅ',departmentNameEn:'OPD',serviceMode:'opd',entryDate:'2026-09-17',dischargeDate:''},data:{'system:opdMedications':JSON.stringify([{name:'Example medicine 10mg',route:'po',unit:'គ្រាប់',scheduleType:'bid',doseAmount:'1',m:'1',a:'0',e:'1',n:'0',d:'5',total:'10'}])}};
    const save=async(headers,payload)=>fetch(origin+'/api/patient-record',{method:'PUT',headers,body:JSON.stringify(payload)});
    const registrationSummary={...body.summary,departmentCode:'',departmentNameKh:'',departmentNameEn:'',serviceMode:''};
    const registered=await save(registration,{patientKey:body.patientKey,summary:registrationSummary,data:{'scope:registration:id:emr_pmrs_case_new':true}});
    assert.equal(registered.status,200,await registered.text());
    const triageSummary={...body.summary};
    const triaged=await save(triage,{patientKey:body.patientKey,summary:triageSummary,data:{'scope:triage:id:triage_paraclinic':false}});
    assert.equal(triaged.status,200,await triaged.text());
    const charge=await fetch(origin+'/api/finance/charges',{method:'POST',headers:clerk,body:JSON.stringify({patientKey:body.patientKey,description:'OPD Consultation',quantity:1,unitAmount:10000,currency:'KHR'})});
    assert.equal(charge.status,201,await charge.text());
    const cashierBill=await(await fetch(origin+'/api/finance/patient?patientKey='+encodeURIComponent(body.patientKey),{headers:clerk})).json();
    const payment=await fetch(origin+'/api/finance/payments',{method:'POST',headers:clerk,body:JSON.stringify({patientKey:body.patientKey,source:'CASH',amount:cashierBill.bill.summary.KHR.balance,currency:'KHR'})});
    assert.equal(payment.status,201,await payment.text());
    const inbox=async()=> (await(await fetch(origin+'/api/messages',{headers:pharmacy})).json()).messages;
    let response=await save(doctor,body);assert.equal(response.status,200);body.expectedVersion=(await response.json()).patient.version;
    assert.equal((await inbox()).length,0,'draft save must not notify Pharmacy');
    body.submitOpdPrescription=true;
    response=await save(doctor,body);const sent=await response.json();assert.equal(response.status,200,JSON.stringify(sent));assert.ok(sent.pharmacySubmission.messageId);
    assert.equal((await save(doctor,body)).status,409,'stale submission must not overwrite the patient');
    body.expectedVersion=sent.patient.version;
    const messages=await inbox();assert.equal(messages.length,1);assert.ok(messages[0].prescriptionId);
    const endpoint=origin+`/api/messages/${messages[0].id}/prescription`;
    const prescription=await(await fetch(endpoint,{headers:pharmacy})).json();
    assert.equal(prescription.prescription.medications[0].total,'10');assert.equal(prescription.prescription.patient.fullName,'Example Patient');
    assert.equal(prescription.prescription.prescriber.userId,doctorId);
    assert.equal(prescription.prescription.prescriber.signerName,'Doctor Test');
    assert.equal(prescription.prescription.prescriber.signatureDataUrl,doctorPng);
    assert.equal(JSON.parse(sent.patient.data['system:signature:medical']).userId,doctorId);
    assert.equal((await fetch(endpoint,{headers:other})).status,404);
    assert.equal((await fetch(endpoint)).status,401);
    response=await save(doctor,body);assert.equal(response.status,200);const duplicate=await response.json();assert.equal(duplicate.pharmacySubmission.duplicate,true);body.expectedVersion=duplicate.patient.version;assert.equal((await inbox()).length,1);
    assert.equal((await save(nurse,body)).status,403);
    const updated=JSON.parse(body.data['system:opdMedications']);updated[0].total='20';body.data['system:opdMedications']=JSON.stringify(updated);
    response=await save(doctor,body);assert.equal(response.status,200);body.expectedVersion=(await response.json()).patient.version;assert.equal((await inbox()).length,2);
    const old=await(await fetch(endpoint,{headers:pharmacy})).json();assert.equal(old.prescription.medications[0].total,'10');assert.equal(old.prescription.superseded,true);
    assert.equal(old.prescription.prescriber.signatureDataUrl,doctorPng,'past pharmacy messages keep the prescribing doctor signature');
    const empty={...body,data:{'system:opdMedications':'[]'}};
    assert.equal((await save(doctor,empty)).status,400);assert.equal((await inbox()).length,2);
    const persisted=app.database.findPatient(body.patientKey);assert.equal(JSON.parse(JSON.parse(persisted.record_json)['system:opdMedications'])[0].total,'20');
    assert.equal((await fetch(origin+`/api/messages/${messages[0].id}/read`,{method:'POST',headers:pharmacy})).status,200);
    assert.equal((await fetch(origin+'/home',{headers:pharmacy})).status,200);
  }finally{await new Promise(resolve=>app.server.close(resolve));app.database.close();fs.rmSync(directory,{recursive:true,force:true});}
});
