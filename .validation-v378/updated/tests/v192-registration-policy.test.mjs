import assert from 'node:assert/strict';
import test from 'node:test';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {createEmrServer} from '../server/server.mjs';
import {roleCanPage,validContexts,getUserAccess} from '../server/access.mjs';
import {appointmentWindow,createAppointment,listAppointments} from '../server/appointments.mjs';
import {projectRoot} from '../server/config.mjs';

async function fixture(run){
 const app=createEmrServer({demoMode:true,databasePath:':memory:',host:'127.0.0.1',port:0,appOrigin:'http://127.0.0.1:0',nodeEnv:'test'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${app.server.address().port}`;
 async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:app.config.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return {headers:{Cookie,Origin:app.config.appOrigin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},me};}
 const call=async(h,url,body,method='POST')=>{const r=await fetch(origin+url,{headers:h,...(body?{method,body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>({}))};};
 try{await run({app,db:app.database,origin,login,call})}finally{await new Promise(r=>app.server.close(r));app.database.close()}
}

test('Vice-Director retains its identity and has administrative pages, account management and price-setting access without a ward',()=>fixture(async({db,login,call})=>{
 const {headers,me}=await login('vice_director');assert.equal(me.user.activeRole,'VICE_DIRECTOR');assert.equal(me.user.activeWard,null);
 assert.deepEqual(validContexts(getUserAccess(db,me.user.id)).map(x=>x.role),['VICE_DIRECTOR']);
 for(const p of ['/admin/users','/admin/organization','/billing','/finance','/lab','/imaging','/emr','/departments'])assert.equal(roleCanPage('VICE_DIRECTOR',p),true,p);
 assert.equal((await call(headers,'/api/admin/users')).status,200);
 assert.equal((await call(headers,'/api/admin/organization-branding',{nameKh:'មន្ទីរពេទ្យបង្អែក បរកែវ',nameEn:'Borkeo Referral Hospital'})).status,200);
 assert.equal((await call(headers,'/api/admin/users',{username:'vice-created',displayName:'Created by Vice',roles:['REGISTRATION'],wards:[]})).status,201);
 assert.equal((await call(headers,'/api/finance/payment-settings',{facilityLevel:'CPA2'})).status,200);
 assert.equal((await call(headers,'/api/finance/payer-tariffs',{paymentType:'NSSF',code:'VICE_TEST',nameKh:'ពិគ្រោះ',nameEn:'Consultation',unitLabel:'visit',categoryCode:'CONSULTATION',defaultAmount:5000,currency:'KHR',active:true})).status,200);
 const summary={phone:'',dateOfBirth:'',equityCard:'',paymentType:'DIRECT',departmentNameKh:'',departmentNameEn:'',dischargeDate:'',sex:'M',age:'40',firstName:'Demo',lastName:'Patient',caseNumber:'VICE-IPD',healthId:'VICE-IPD',fullName:'Demo IPD approval',entryDate:appointmentWindow().endDate,serviceMode:'ipd',departmentCode:'medicine'};
 db.upsertPatient({id:crypto.randomUUID(),patientKey:'case:VICE-IPD',userId:me.user.id,savedAt:Date.now(),summary,data:{}});
 for(const approverRole of ['ADMIN','DIRECTOR'])assert.equal((await call(headers,'/api/admission-approvals',{patientKey:'case:VICE-IPD',approverRole})).status,200);
 const approval=await call(headers,'/api/admission-approvals?patientKey=case:VICE-IPD');assert.equal(approval.data.approval.complete,true);

}));

test('returning visit must stay Old Case, keep Patient ID, preserve the old encounter, and enter the Triage queue',()=>fixture(async({db,login,call})=>{
 const {headers}=await login('registration'),admin=db.findUser('admin').id;
 const summary={phone:'',dateOfBirth:'',equityCard:'',paymentType:'DIRECT',departmentNameKh:'',departmentNameEn:'',caseNumber:'OLD-192',healthId:'H192',fullName:'Returning Patient',firstName:'Patient',lastName:'Returning',sex:'M',age:'40',entryDate:appointmentWindow().endDate,serviceMode:'opd',departmentCode:'opd',dischargeDate:''};
 db.upsertPatient({id:crypto.randomUUID(),patientKey:'case:OLD-192',userId:admin,savedAt:Date.now(),summary,data:{'system:caseType':'new','system:triageStatus':'COMPLETED','scope:medical:id:opd_history':'Keep original history'}});
 const original=db.findPatient('case:OLD-192');
 const payload={patientKey:'case:RETURN-192',newVisitFrom:'case:OLD-192',editorScope:'registration',transferToTriage:true,summary:{...summary,caseNumber:'RETURN-192'},data:{'scope:registration:id:emr_pmrs_case_new':true}};
 assert.equal((await call(headers,'/api/patient-record',payload,'PUT')).status,409,'Cannot submit returning patient as New Case');
 payload.data={'scope:registration:id:emr_pmrs_case_old':true};payload.summary.healthId='DIFFERENT';assert.equal((await call(headers,'/api/patient-record',payload,'PUT')).status,409);
 payload.summary.healthId='H192';const result=await call(headers,'/api/patient-record',payload,'PUT');assert.equal(result.status,200,JSON.stringify(result.data));assert.equal(result.data.patient.data['system:caseType'],'old');assert.equal(result.data.patient.triageStatus,'WAITING');assert.equal(result.data.patient.data['system:workflowStage'],'TRIAGE_WAITING');assert.equal(result.data.patient.data['scope:medical:id:opd_history'],undefined);
 const savedReturning=db.findPatient('case:RETURN-192');
 const reopen={...payload,newVisitFrom:undefined,expectedVersion:savedReturning.version,data:{'scope:registration:id:emr_pmrs_case_new':true,'scope:registration:id:emr_pmrs_case_old':false}};
 assert.equal((await call(headers,'/api/patient-record',reopen,'PUT')).status,409,'Reopening cannot turn Old Case into New Case');
 reopen.data={'scope:registration:id:emr_pmrs_case_old':true};reopen.summary={...payload.summary,healthId:'CHANGED-AFTER-SAVE'};
 assert.equal((await call(headers,'/api/patient-record',reopen,'PUT')).status,409,'Reopening cannot change the Patient ID');
 assert.equal(db.findPatient('case:OLD-192').record_json,original.record_json);assert.equal(db.findPatient('case:OLD-192').version,original.version);
 const duplicate={...payload,patientKey:'case:FORGED-192',newVisitFrom:undefined,summary:{...summary,caseNumber:'FORGED-192'},data:{'scope:registration:id:emr_pmrs_case_new':true}};assert.equal((await call(headers,'/api/patient-record',duplicate,'PUT')).status,409);
 const first={...duplicate,patientKey:'case:FIRST-192',summary:{...duplicate.summary,caseNumber:'FIRST-192',healthId:'NEVER-RECORDED-192'}};assert.equal((await call(headers,'/api/patient-record',first,'PUT')).status,200);
 const triage=await login('triage'),queue=await call(triage.headers,'/api/triage/queue');assert(queue.data.patients.some(p=>p.patientKey==='case:RETURN-192'));
}));

test('calendar-month appointment window uses Cambodia dates, clamps month ends and never deletes expired appointments',()=>fixture(async({db})=>{
 assert.deepEqual(appointmentWindow(Date.parse('2026-10-06T12:00:00+07:00')),{startDate:'2026-09-06',endDate:'2026-10-06'});
 assert.equal(appointmentWindow(Date.parse('2026-03-31T12:00:00+07:00')).startDate,'2026-02-28');
 assert.equal(appointmentWindow(Date.parse('2026-01-01T00:30:00+07:00')).startDate,'2025-12-01');
 const w=appointmentWindow(),actor=db.findUser('admin').id;
 createAppointment(db,{patientName:'Expired patient retained',appointmentDate:'2000-01-01',patientKey:'case:expired'},actor);
 createAppointment(db,{patientName:'Cutoff included',appointmentDate:w.startDate},actor);
 createAppointment(db,{patientName:'Today included',appointmentDate:w.endDate},actor);
 const rows=listAppointments(db,'1999-01-01',w.endDate,true);assert(rows.some(x=>x.patientName==='Cutoff included'));assert(rows.some(x=>x.patientName==='Today included'));assert(!rows.some(x=>x.patientName==='Expired patient retained'));
 assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM patient_appointments').get().n,3);
}));

test('registration has only send-to-Triage saving and patient ID replaces New visit while names omit case numbers',()=>{
 const read=p=>fs.readFileSync(path.join(projectRoot,p),'utf8'),patient=read('public/patient-list.js'),record=read('public/emr-patient-record.js');
 assert.match(patient,/data-new-record=/);assert.doesNotMatch(patient,/class="new-visit-action"/);assert.doesNotMatch(patient,/class="patient-secondary"/);
 assert.match(record,/control\.disabled=true/);assert.doesNotMatch(record,/if \(pageOne\) addSaveBar/);assert.match(record,/options\.transferToTriage/);
 assert.match(read('protected/EMR.html'),/បញ្ជូនទៅផ្នែកទ្រីយ៉ា<\/button>/);
 assert.match(read('public/emr-session.js'),/មន្ទីរពេទ្យបង្អែក បរកែវ/);
});
