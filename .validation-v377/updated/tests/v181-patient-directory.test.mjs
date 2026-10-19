import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {createEmrServer} from '../server/server.mjs';
import {setUserAccess,roleCanPage} from '../server/access.mjs';
import {USER_ROLES} from '../server/database.mjs';
import {opdLocalDate} from '../server/opd-queue.mjs';

test('completed Triage resets at Cambodia midnight; every staff role can search summaries while clinical writes remain restricted',async()=>{
 const port=32981,origin=`http://127.0.0.1:${port}`;
 const app=createEmrServer({demoMode:true,host:'127.0.0.1',port,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'}),db=app.database;
 const date=opdLocalDate(),midnight=Date.parse(date+'T00:00:00+07:00'),admin=db.findUser('admin').id;
 function seed(name,at,mode='ipd',discharged=false){
  const patientKey='case:V181-'+name;const summary={caseNumber:'V181-'+name,healthId:'H181',firstName:'Returning',lastName:name,fullName:'Returning '+name,sex:'ប្រុស',age:'40',dateOfBirth:'',phone:'012345678',equityCard:'EQ181',paymentType:'DIRECT',departmentCode:'surgery',departmentNameKh:'ផ្នែកវះកាត់',departmentNameEn:'Surgery',serviceMode:mode,entryDate:opdLocalDate(midnight-86400000),dischargeDate:discharged?date:''};
  const data={'system:triageStatus':'COMPLETED','system:triageCompletedAt':at,'scope:medical:id:ipd_history_present_illness':'Old history'};
  if(discharged){data['system:admissionStatus']='discharged';data['system:discharge']={dischargeAt:date+'T01:00'};}
  db.upsertPatient({id:crypto.randomUUID(),patientKey,userId:admin,savedAt:Date.now(),summary,data});return {patientKey,summary};
 }
 const before=seed('before-midnight',midnight-1),today=seed('midnight',midnight),done=seed('discharged',midnight+1000,'ipd',true),future=seed('tomorrow',midnight+86400000);
 const chief='directory181-chief';db.createUser({id:crypto.randomUUID(),username:chief,displayName:'Ward Chief',role:'CHIEF_WARD',passwordHash:'unused',createdAt:Date.now()});setUserAccess(db,db.findUser(chief).id,['CHIEF_WARD'],['medicine']);
 const users=['admin','registration','triage','doctor_medicine','nurse_medicine','nurse_obstetric','lab','imaging','pharmacy','accountant','clerk','director',chief];
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200,username);const Cookie=r.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};}
 try{
  for(const role of USER_ROLES)assert.equal(roleCanPage(role,'/patient-list'),true,role);
  for(const username of users){const headers=await login(username);assert.equal((await fetch(origin+'/patient-list',{headers,redirect:'manual'})).status,200,username);const response=await fetch(origin+'/api/patients?includePayment=1',{headers});assert.equal(response.status,200);const list=(await response.json()).patients;assert(list.some(p=>p.patientKey===before.patientKey),username);const p=list.find(p=>p.patientKey===today.patientKey);assert.equal(p.data,undefined,'directory responses do not include form contents');if(['doctor_medicine','nurse_medicine','accountant','clerk',chief].includes(username))assert.equal(p.canOpenRecord,false,username);}
  const triage=await login('triage'),queue=await(await fetch(origin+'/api/triage/queue',{headers:triage})).json();assert.equal(queue.date,date);const keys=queue.completed.map(p=>p.patientKey);assert(keys.includes(today.patientKey));assert(keys.includes(done.patientKey),'completed patients remain listed after same-day discharge');assert(!keys.includes(before.patientKey));assert(!keys.includes(future.patientKey));
  const ward=await login('doctor_medicine');assert.equal((await fetch(origin+'/api/patient-record?patientKey='+encodeURIComponent(today.patientKey),{headers:ward})).status,403,'all-ward directory access does not permit editing another ward record');
  const reg=await login('registration'),original=db.findPatient(today.patientKey);
  const newKey='case:V181-NEW';const payload={patientKey:newKey,newVisitFrom:today.patientKey,summary:{...today.summary,caseNumber:'V181-NEW',departmentCode:'',departmentNameKh:'',departmentNameEn:'',serviceMode:'',entryDate:date,dischargeDate:''},data:{'scope:registration:id:emr_pmrs_case_old':true}};
  const created=await fetch(origin+'/api/patient-record',{method:'PUT',headers:reg,body:JSON.stringify(payload)});assert.equal(created.status,200,await created.clone().text());const patient=(await created.json()).patient;assert.equal(patient.triageStatus,'WAITING');assert.equal(patient.healthId,'H181');assert.equal(patient.data['system:previousPatientKey'],today.patientKey);assert.equal(patient.data['scope:medical:id:ipd_history_present_illness'],undefined);assert.equal(db.findPatient(today.patientKey).record_json,original.record_json);assert.equal(db.findPatient(today.patientKey).version,original.version);
  const overwrite=await fetch(origin+'/api/patient-record',{method:'PUT',headers:reg,body:JSON.stringify({...payload,patientKey:today.patientKey,summary:today.summary})});assert.equal(overwrite.status,409);assert.equal(db.findPatient(today.patientKey).record_json,original.record_json);
  const clerk=await login('clerk');assert.equal((await fetch(origin+'/api/patient-record',{method:'PUT',headers:clerk,body:JSON.stringify(payload)})).status,403);
  assert.equal((await fetch(origin+'/api/patients')).status,401);
 }finally{await new Promise(r=>app.server.close(r));db.close();}
});
