import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';
import { setFinanceProfile } from '../server/finance.mjs';
import { ensureAdmissionMovement, recordMovement } from '../server/daily-report.mjs';

test('real PMRS2 medicine import is reviewed, HEF-only, identity-matched, idempotent, and stored in EMR daily follow-up',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-pmrs-import-'));
  const origin='http://127.0.0.1:32203';
  const app=createEmrServer({ demoMode: false,host:'127.0.0.1',port:32203,appOrigin:origin,
    databasePath:path.join(directory,'patients.sqlite'),autoDatabase:false,nodeEnv:'test'});
  try {
    const userId=crypto.randomUUID();
    app.database.createUser({id:userId,username:'reviewdoctor',displayName:'Review Doctor',role:'DOCTOR',
      passwordHash:await hashPassword('Example secure password 2026!'),createdAt:Date.now()});
    setUserAccess(app.database,userId,['DOCTOR'],['medicine']);
    const patientKey='case:PMRS-IMPORT-EXAMPLE';
    app.database.upsertPatient({id:crypto.randomUUID(),patientKey,userId,savedAt:Date.now(),
      summary:{caseNumber:'PMRS-IMPORT-EXAMPLE',healthId:'003-111-222-3',firstName:'Example',lastName:'Patient',
        fullName:'Example Patient',sex:'ស្រី',age:'28 ឆ្នាំ',dateOfBirth:'',phone:'',equityCard:'HEF-EXAMPLE',
        paymentType:'HEF',departmentCode:'medicine',departmentNameKh:'ផ្នែកជំងឺទូទៅ',departmentNameEn:'Medicine',
        serviceMode:'ipd',entryDate:'2026-09-17',dischargeDate:''},
      data:{'system:currentWardCode':'medicine','system:dailyMonitoringRecords':JSON.stringify([{
        dtVal:'2026-09-17T09:30',evol:'Existing note',conclusion:'Existing diagnosis',
        temp:'37',bp_sys:'120',bp_dia:'80',pulse:'80',resp:'18',spo2:'98',medications:[],
      }])},
    });
    ensureAdmissionMovement(app.database,app.database.findPatient(patientKey),userId);
    setFinanceProfile(app.database,patientKey,{paymentType:'HEF',hefType:'EQUITY'},userId);
    await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(32203,'127.0.0.1',resolve)});
    const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},
      body:JSON.stringify({username:'reviewdoctor',password:'Example secure password 2026!'})});
    assert.equal(login.status,200);
    const cookie=login.headers.get('set-cookie').split(';',1)[0];
    const me=await (await fetch(origin+'/api/auth/me',{headers:{Cookie:cookie}})).json();
    const headers={Origin:origin,Cookie:cookie,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    assert.equal((await fetch(origin+'/pmrs-import',{headers:{Cookie:cookie}})).status,200);
    const candidatesResponse=await fetch(origin+'/api/pmrs2/import-candidates',{method:'POST',headers,
      body:JSON.stringify({sourcePid:'0031112223'})});
    assert.equal(candidatesResponse.status,200);
    const candidates=(await candidatesResponse.json()).patients;
    assert.equal(candidates.length,1);
    assert.equal(candidates[0].paymentStatus,'HEF_EQUITY');
    const body={patientKey,reviewedVersion:candidates[0].version,sourcePid:'003-111-222-3',
      sourceVisit:'EXAMPLE-VISIT',target:'daily',recordAt:'2026-09-17T09:30',reviewed:true,
      medications:[{sourceRowIndex:0,name:'Example medicine',route:'po',unit:'គ្រាប់',m:'1',a:'0',e:'1',n:'0',d:'1'}]};
    const invalid=await fetch(origin+'/api/pmrs2/import-medicines',{method:'POST',headers:{...headers,'X-CSRF-Token':'invalid'},body:JSON.stringify(body)});
    assert.equal(invalid.status,403);
    const saved=await fetch(origin+'/api/pmrs2/import-medicines',{method:'POST',headers,body:JSON.stringify(body)});
    const savedJson=await saved.json();
    assert.equal(saved.status,200,JSON.stringify(savedJson));
    assert.equal(savedJson.added,1);
    const record=await (await fetch(origin+'/api/patient-record?patientKey='+encodeURIComponent(patientKey),{headers:{Cookie:cookie}})).json();
    const daily=JSON.parse(record.patient.data['system:dailyMonitoringRecords']);
    assert.equal(daily[0].evol,'Existing note');
    assert.equal(daily[0].medications[0].name,'Example medicine');
    const wardReportResponse=await fetch(origin+'/api/reports/ward-medicines?date=2026-09-17&ward=medicine',{headers:{Cookie:cookie}});
    assert.equal(wardReportResponse.status,200);
    const wardReport=await wardReportResponse.json();
    assert.equal(wardReport.patientCount,1);
    assert.equal(wardReport.medicineOrderCount,1);
    assert.equal(wardReport.patients[0].medications[0].name,'Example medicine');
    assert.equal(wardReport.patients[0].medications[0].m,'1');
    assert.equal(wardReport.patients[0].medications[0].e,'1');
    assert.equal((await fetch(origin+'/api/reports/ward-medicines?date=2026-09-17&ward=surgery',{headers:{Cookie:cookie}})).status,403);
    assert.equal((await fetch(origin+'/api/reports/ward-medicines?date=2026-09-17&ward=medicine')).status,401);
    assert.equal((await fetch(origin+'/ward-medicines',{headers:{Cookie:cookie}})).status,200);
    assert.equal((await fetch(origin+'/public/ward-medicines.js')).status,200);
    recordMovement(app.database,{patientKey,eventType:'DISCHARGE',fromWardCode:'medicine',eventAt:new Date('2026-09-18T10:00:00').getTime(),createdBy:userId});
    const followingDay=await (await fetch(origin+'/api/reports/ward-medicines?date=2026-09-18&ward=medicine',{headers:{Cookie:cookie}})).json();
    assert.equal(followingDay.patientCount,0);
    const earlierDay=await (await fetch(origin+'/api/reports/ward-medicines?date=2026-09-17&ward=medicine',{headers:{Cookie:cookie}})).json();
    assert.equal(earlierDay.patientCount,1);
    body.reviewedVersion=savedJson.patientVersion;
    const again=await (await fetch(origin+'/api/pmrs2/import-medicines',{method:'POST',headers,body:JSON.stringify(body)})).json();
    assert.deepEqual({added:again.added,skipped:again.skipped},{added:0,skipped:1});
    body.sourcePid='ANOTHER-IDENTITY';
    const wrong=await fetch(origin+'/api/pmrs2/import-medicines',{method:'POST',headers,body:JSON.stringify(body)});
    assert.equal(wrong.status,400);
    body.sourcePid='003-111-222-3';
    setFinanceProfile(app.database,patientKey,{paymentType:'CASH'},userId);
    const nonHef=await fetch(origin+'/api/pmrs2/import-medicines',{method:'POST',headers,body:JSON.stringify(body)});
    assert.equal(nonHef.status,403);
  } finally {
    await new Promise(resolve=>app.server.close(resolve));
    app.database.close();fs.rmSync(directory,{recursive:true,force:true});
  }
});
