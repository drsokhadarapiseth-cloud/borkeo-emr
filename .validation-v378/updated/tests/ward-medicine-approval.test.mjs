import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';

test('IPD drug list requires the dedicated Ward Head and six ordered signatures before Director and Pharmacy',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ward-approval-'));
  const origin='http://127.0.0.1:32215';
  const app=createEmrServer({demoMode:false,host:'127.0.0.1',port:32215,appOrigin:origin,
    databasePath:path.join(directory,'test.sqlite'),autoDatabase:false,nodeEnv:'test'});
  try {
    const password='Ward approval test password 2026!';
    const passwordHash=await hashPassword(password);
    for(const [username,role,wards] of [
      ['warddoctor','DOCTOR',['medicine']],
      ['wardnurse','NURSE',['medicine']],
      ['headnurse','WARD_HEAD',['medicine']],
      ['chiefuser','CHIEF_WARD',['medicine']],
      ['directoruser','DIRECTOR',[]],
      ['wardpharmacy','PHARMACY',[]],
    ]){
      const id=crypto.randomUUID();
      app.database.createUser({id,username,displayName:username,role,passwordHash,createdAt:Date.now()});
      setUserAccess(app.database,id,[role],wards);
    }
    await new Promise(resolve=>app.server.listen(32215,'127.0.0.1',resolve));
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,password})});
      assert.equal(response.status,200,username);
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    };
    const doctor=await login('warddoctor'),nurse=await login('wardnurse'),headnurse=await login('headnurse'),chief=await login('chiefuser'),director=await login('directoruser'),pharmacy=await login('wardpharmacy');
    const now=new Date();
    const today=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    const patientKey='case:APPROVAL-1';
    const save=async headers=>fetch(origin+'/api/patient-record',{method:'PUT',headers,
      body:JSON.stringify({patientKey,summary:{caseNumber:'APPROVAL-1',healthId:'',firstName:'Approved',lastName:'Patient',fullName:'Approved Patient',sex:'ប្រុស',age:'30',departmentCode:'medicine',departmentNameKh:'ផ្នែកសម្រាកពេទ្យ',departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:today},data:{'scope:medical:id:ipd_first_exam_date':today,'system:initialIpdMedications':JSON.stringify([{name:'Approved test medicine',unit:'គ្រាប់',total:'2'}])}})});
    const saved=await save(doctor);assert.equal(saved.status,200,await saved.text());
    const initial=await (await fetch(origin+`/api/reports/ward-medicines?ward=medicine&date=${today}`,{headers:director})).json();
    assert.equal(initial.approval.status,'pending');
    assert.equal(initial.approval.nextAction,'WARD_HEAD');
    assert.equal((await fetch(origin+'/api/reports/ward-medicines/sign',{method:'POST',headers:nurse,body:JSON.stringify({ward:'medicine',date:today,step:1})})).status,400);
    assert.equal((await fetch(origin+'/api/reports/ward-medicines/sign',{method:'POST',headers:headnurse,body:JSON.stringify({ward:'medicine',date:today,step:1})})).status,200);
    const nurseView=await (await fetch(origin+`/api/reports/ward-medicines?ward=medicine&date=${today}`,{headers:nurse})).json();
    assert.equal(nurseView.approval.status,'nurse_signed');
    assert.equal(nurseView.approval.nextAction,'CHIEF_WARD');
    assert.equal((await fetch(origin+'/api/reports/ward-medicines/sign',{method:'POST',headers:director,body:JSON.stringify({ward:'medicine',date:today,step:3})})).status,400);
    assert.equal((await fetch(origin+'/api/reports/ward-medicines/sign',{method:'POST',headers:chief,body:JSON.stringify({ward:'medicine',date:today,step:2})})).status,200);
    const chiefView=await (await fetch(origin+`/api/reports/ward-medicines?ward=medicine&date=${today}`,{headers:chief})).json();
    assert.equal(chiefView.approval.status,'chief_signed');
    assert.equal(chiefView.approval.nextAction,'DIRECTOR');
    const directorSign=await fetch(origin+'/api/reports/ward-medicines/sign',{method:'POST',headers:director,body:JSON.stringify({ward:'medicine',date:today,step:3})});
    const directorPayload=await directorSign.json();assert.equal(directorSign.status,200,JSON.stringify(directorPayload));
    assert.equal(directorPayload.report.approval.status,'director_signed');
    assert.equal(directorPayload.report.approval.nextAction,'PHARMACY');
    const pharmacyMessages=(await(await fetch(origin+'/api/messages?box=inbox',{headers:pharmacy})).json()).messages;
    assert.ok(pharmacyMessages.some(item=>item.subject===`បញ្ជីឱសថផ្នែករួចរាល់ · medicine · ${today}`));
    const directorAgain=await fetch(origin+'/api/reports/ward-medicines/sign',{method:'POST',headers:director,body:JSON.stringify({ward:'medicine',date:today,step:3})});
    assert.equal(directorAgain.status,200);
    const delivered=await fetch(origin+'/api/reports/ward-medicines/sign',{method:'POST',headers:pharmacy,body:JSON.stringify({ward:'medicine',date:today})});
    const deliveredPayload=await delivered.json();assert.equal(delivered.status,200,JSON.stringify(deliveredPayload));
    assert.equal(deliveredPayload.report.approval.status,'pharmacy_signed');
    assert.equal(deliveredPayload.report.approval.nextStep,5);
    assert.equal((await fetch(origin+'/api/reports/ward-medicines/sign',{method:'POST',headers:pharmacy,body:JSON.stringify({ward:'medicine',date:today,step:5})})).status,200);
    const received=await fetch(origin+'/api/reports/ward-medicines/sign',{method:'POST',headers:nurse,body:JSON.stringify({ward:'medicine',date:today,step:6})});
    assert.equal(received.status,200);const final=await received.json();assert.equal(final.report.approval.status,'delivered');assert.equal(final.report.approval.nextAction,'');
    assert.equal(deliveredPayload.report.approval.pharmacy.name,'wardpharmacy');
  } finally {
    await new Promise(resolve=>app.server.close(resolve));
    app.database.close();
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
