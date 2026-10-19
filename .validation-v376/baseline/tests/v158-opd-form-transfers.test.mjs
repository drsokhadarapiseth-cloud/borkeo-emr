import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { projectRoot } from '../server/config.mjs';

test('OPD form offers IPD and Provincial Hospital dispositions and records external referral', async () => {
  const workflow=fs.readFileSync(path.join(projectRoot,'public/emr-inpatient-workflow.js'),'utf8');
  assert.match(workflow,/opd-open-ipd-transfer/);
  assert.match(workflow,/opd-open-provincial-referral/);
  assert.match(workflow,/referralDestinationType: 'PROVINCIAL_HOSPITAL'/);
  const port=32358,origin=`http://127.0.0.1:${port}`;
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
  try{
    const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'doctor_opd'})});
    assert.equal(login.status,200);
    const Cookie=login.headers.get('set-cookie').split(';')[0];
    const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
    const doctor={Cookie,Origin:origin,'X-CSRF-Token':me.csrfToken,'Content-Type':'application/json'};
    const now=Date.now(),registration=app.database.findUser('registration'),key='case:OPD-PROVINCIAL-REFERRAL';
    app.database.upsertPatient({id:crypto.randomUUID(),patientKey:key,userId:registration.id,savedAt:now,
      summary:{caseNumber:'OPD-PROVINCIAL-REFERRAL',healthId:'ID-OPD-REFERRAL',firstName:'DARA',lastName:'SOK',fullName:'SOK DARA',sex:'ស្រី',age:'35',dateOfBirth:'1991-01-01',phone:'012345678',equityCard:'',paymentType:'DIRECT',departmentCode:'opd',departmentNameKh:'ផ្នែកពិគ្រោះក្រៅ',departmentNameEn:'OPD',serviceMode:'opd',entryDate:new Date(now).toISOString().slice(0,10),dischargeDate:''},
      data:{'system:triageStatus':'COMPLETED','system:workflowStage':'DOCTOR_READY','scope:medical:id:diag_input':'Abdominal pain'}});
    const dischargeAt=new Date(Date.now()-60_000);const local=new Date(dischargeAt.getTime()-dischargeAt.getTimezoneOffset()*60_000).toISOString().slice(0,16);
    const referral=await fetch(origin+'/api/patient-admission',{method:'PATCH',headers:doctor,body:JSON.stringify({patientKey:key,action:'discharge',dischargeDate:local.slice(0,10),dischargeAt:local,dischargeDiagnosis:'Abdominal pain; requires provincial-level evaluation',outcome:'referred',status:'referred',referralDestinationType:'PROVINCIAL_HOSPITAL',referralDestinationName:'មន្ទីរពេទ្យខេត្ត',referralTransport:'AMBULANCE',followUpDate:'',deceased:false})});
    assert.equal(referral.status,200,await referral.clone().text());
    const patient=(await referral.json()).patient;
    assert.equal(patient.serviceMode,'opd');
    assert.equal(patient.admissionStatus,'discharged');
    assert.equal(patient.data['system:discharge'].referralDestinationType,'PROVINCIAL_HOSPITAL');
    assert.ok(app.database.sqlite.prepare("SELECT 1 FROM patient_movement_events WHERE patient_key=? AND event_type='EXTERNAL_TRANSFER'").get(key));
  }finally{await new Promise(resolve=>app.server.close(resolve));app.database.close();}
});
