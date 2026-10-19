import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';

test('saving a new IPD patient order does not alert Pharmacy before the signature workflow', async () => {
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-ward-alert-'));
  const app=createEmrServer({demoMode:false,host:'127.0.0.1',port:32213,
    appOrigin:'http://127.0.0.1:32213',databasePath:path.join(directory,'test.sqlite'),autoDatabase:false,nodeEnv:'test'});
  try {
    const password='Example secure ward test password 2026!';
    const passwordHash=await hashPassword(password);
    for (const [username,role,wards] of [['warddoc','DOCTOR',['medicine']],['pharmacyuser','PHARMACY',[]]]) {
      const id=crypto.randomUUID();
      app.database.createUser({id,username,displayName:username,role,passwordHash,createdAt:Date.now()});
      setUserAccess(app.database,id,[role],wards);
    }
    await new Promise(resolve=>app.server.listen(32213,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:32213';
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
        body:JSON.stringify({username,password})});
      assert.equal(response.status,200);
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    };
    const doctor=await login('warddoc');
    const pharmacy=await login('pharmacyuser');
    const body={patientKey:'case:WARD-NEW-PATIENT',summary:{caseNumber:'WARD-NEW-PATIENT',healthId:'',
      fullName:'Example Inpatient',firstName:'Example',lastName:'Inpatient',sex:'ប្រុស',age:'45',
      dateOfBirth:'',phone:'',equityCard:'',paymentType:'CASH',departmentCode:'medicine',
      departmentNameKh:'ផ្នែកសម្រាកពេទ្យ',departmentNameEn:'Medicine',serviceMode:'ipd',
      entryDate:'2026-09-16',dischargeDate:''},data:{}};
    const save=async()=>{
      const response=await fetch(origin+'/api/patient-record',{method:'PUT',headers:doctor,body:JSON.stringify(body)});
      const payload=await response.json();assert.equal(response.status,200,JSON.stringify(payload));return payload;
    };
    const inbox=async()=>(await(await fetch(origin+'/api/messages?box=inbox',{headers:pharmacy})).json()).messages;
    assert.equal((await save()).wardMedicineNotification,null);
    assert.equal((await inbox()).length,0);
    body.data={
      'scope:medical:id:ipd_first_exam_date':'2026-09-17',
      'scope:medical:id:ipd_first_exam_time':'08:30',
      'system:initialIpdMedications':JSON.stringify([{name:'Test treatment',route:'po',unit:'គ្រាប់',total:'6'}]),
    };
    const saved=await save();assert.equal(saved.wardMedicineNotification,null);
    const blocked=await fetch(origin+'/api/reports/ward-medicines?ward=medicine&date=2026-09-17',{headers:pharmacy});assert.equal(blocked.status,403);
    const report=(await(await fetch(origin+'/api/reports/ward-medicines?ward=medicine&date=2026-09-17',{headers:doctor})).json());
    assert.equal(report.patientCount,1);
    assert.equal(report.matrix.columns[0].name,'Test treatment');
    assert.equal(report.matrix.rows[0].cells[0].quantity,6);
    assert.equal((await inbox()).length,0);
  } finally {
    await new Promise(resolve=>app.server.close(resolve));app.database.close();
    fs.rmSync(directory,{recursive:true,force:true});
  }
});
