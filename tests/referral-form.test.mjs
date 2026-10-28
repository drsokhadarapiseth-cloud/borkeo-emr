// Explicit browser/PDF regression; synthetic patient in an in-memory EMR only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createEmrServer} from '../server/server.mjs';
import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {openBrowser} from './helpers/context-browser.mjs';
import {WARDS} from '../server/access.mjs';
import {referralAccess,saveReferral} from '../server/referral-forms.mjs';
test('referral API enforces permissions, signature ownership, validation and immutable revisions',{timeout:180000},async()=>{
  const app=createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false});let browser;
  try{
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
    const users={};for(const username of ['registration','triage','clerk','doctor_opd','nurse_opd','doctor_surgery']){
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      const Cookie=response.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      users[username]={Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    }
    const call=async(user,method,route,body)=>{const response=await fetch(origin+route,{method,headers:users[user],body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result};
    const patient=buildCompleteRegistrationPatients()[0],key=patient.patientKey;
    await call('registration','PUT','/api/patient-record',patient);
    const current=(await call('registration','GET','/api/patient-record?patientKey='+encodeURIComponent(key))).patient;
    await call('triage','PUT','/api/patient-record',{patientKey:key,summary:{...patient.summary,departmentCode:'opd',serviceMode:'opd'},expectedVersion:current.version,triageSave:true,data:{'scope:triage:id:p2_temp':'37','scope:triage:id:p2_weight':'60','scope:triage:id:p2_height':'165','scope:triage:id:p2_bp_sys':'120','scope:triage:id:p2_bp_dia':'80','scope:triage:id:p2_pulse':'80','scope:triage:id:p2_resp':'18','scope:triage:id:p2_spo2':'98'}});
    const pending=await call('doctor_opd','GET','/api/referral-form?patientKey='+encodeURIComponent(key));assert.equal(pending.canEdit,false,'unpaid OPD consultation cannot create a signed referral');
    const unpaid=await fetch(origin+'/api/referral-form',{method:'POST',headers:users.doctor_opd,body:JSON.stringify({patientKey:key,revision:0,data:{},signatureMode:'NONE'})});assert.equal(unpaid.status,403);
    const finance=await call('clerk','GET','/api/finance/patient?patientKey='+encodeURIComponent(key));
    await call('clerk','POST','/api/finance/payments',{patientKey:key,invoiceId:finance.bill.invoice.id,source:'CASH',currency:'KHR',amount:finance.bill.summary.KHR.balance});

    const submit=async extra=>{const response=await fetch(origin+'/api/referral-form',{method:'POST',headers:users.doctor_opd,body:JSON.stringify({patientKey:key,revision:0,data:{reason:'Synthetic referral'},signatureMode:'NONE',...extra})});return {status:response.status,body:await response.json()}};
    assert.equal((await submit({data:{unknown:'forged'}})).status,400);
    assert.equal((await submit({data:{reason:'x'.repeat(4001)}})).status,400);
    assert.equal((await submit({signatureMode:'DRAWN',signatureDataUrl:'data:image/svg+xml;base64,PHN2Zz4='})).status,400);
    const saved=await submit({signatureMode:'SAVED',userId:'forged',signerName:'forged'});assert.equal(saved.status,200,JSON.stringify(saved.body));
    const me=await(await fetch(origin+'/api/auth/me',{headers:users.doctor_opd})).json();assert.equal(saved.body.form.signature.userId,me.user.id);assert.notEqual(saved.body.form.signature.signerName,'forged');
    assert.equal((await submit({signatureMode:'NONE'})).status,409,'old revision cannot replace a signed snapshot');
    const row=app.database.sqlite.prepare('SELECT * FROM referral_form_revisions WHERE patient_key=?').get(key);assert.equal(row.revision,1);
    assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) AS n FROM referral_form_revisions').get().n,1);
    assert.ok(app.database.sqlite.prepare("SELECT 1 FROM audit_events WHERE action='REFERRAL_FORM_SAVED'").get());
    // No stored signature means no simulated fallback is silently used for signing.
    app.database.sqlite.prepare('DELETE FROM user_esignatures WHERE user_id=?').run(me.user.id);
    assert.equal((await submit({revision:1,signatureMode:'SAVED'})).status,400);
    const closed=JSON.parse(app.database.findPatient(key).record_json);closed['system:opdDischarge']={dispensedAt:Date.now()};
    app.database.sqlite.prepare("UPDATE patient_records SET discharge_date='2026-10-28',record_json=? WHERE patient_key=?").run(JSON.stringify(closed),key);
    assert.equal((await submit({revision:1,signatureMode:'NONE'})).status,403,'closed encounter cannot be changed through the referral API');
    app.database.sqlite.prepare("UPDATE patient_records SET service_mode='ipd',department_code='surgery',discharge_date='',record_json='{}' WHERE patient_key=?").run(key);
    const inpatient=await call('doctor_surgery','GET','/api/referral-form?patientKey='+encodeURIComponent(key));assert.equal(inpatient.canEdit,true,'assigned inpatient doctor can complete the referral');
    const wrong=await fetch(origin+'/api/referral-form?patientKey='+encodeURIComponent(key),{headers:users.doctor_opd});assert.equal(wrong.status,403,'another ward cannot read the inpatient referral');
    // Every configured inpatient ward uses the same doctor-only referral policy.
    const doctor=(await(await fetch(origin+'/api/auth/me',{headers:users.doctor_surgery})).json()).user;
    let revision=1;
    for(const ward of WARDS.filter(w=>w.code!=='opd')){
      app.database.sqlite.prepare("UPDATE patient_records SET department_code=?,record_json='{}' WHERE patient_key=?").run(ward.code,key);
      for(const role of ['DOCTOR','CHIEF_WARD']){
        const actor={user_id:doctor.id,active_role:role,active_ward_code:ward.code};
        assert.equal(referralAccess(app.database,actor,key).canEdit,true,role+' can refer from '+ward.code);
        const form=saveReferral(app.database,actor,key,{revision,data:{reason:'Synthetic '+ward.code},signatureMode:'SAVED'});
        assert.equal(form.signature.userId,doctor.id);assert.equal(form.revision,++revision);
      }
      for(const role of ['NURSE','MIDWIFE','WARD_HEAD','REGISTRATION','TRIAGE','CLERK','LAB','IMAGING','PHARMACY','ADMIN','DIRECTOR','VICE_DIRECTOR']){
        assert.throws(()=>saveReferral(app.database,{user_id:doctor.id,active_role:role,active_ward_code:ward.code},key,{revision,data:{},signatureMode:'NONE'}),error=>error.status===403,role+' cannot sign from '+ward.code);
      }
    }
  }finally{app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.database.close()}
});
