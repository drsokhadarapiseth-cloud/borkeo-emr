import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { wardMedicineReport } from '../server/ward-medicines.mjs';

test('daily medication diagnosis follows the latest same-day code and keeps admission fallback',()=>{
 const key='case:ICD187',data={
  'scope:medical:id:emr_pmrs_ipd_icd10':'A00',
  'system:dailyMonitoringRecords':JSON.stringify([
   {dtVal:'2026-09-17T09:00',icd10:'J02',medications:[{name:'Morning'}]},
   {dtVal:'2026-09-17T18:00',icd10:'i10',medications:[{name:'Evening'}]},
   {dtVal:'2026-09-18T09:00',icd10:'E11.9',medications:[{name:'Next day'}]},
  ])},row={patient_key:key,full_name:'Test',service_mode:'ipd',entry_date:'2026-09-16',record_json:''};
 const db={sqlite:{prepare:()=>({all:()=>[{patient_key:key,event_type:'ADMISSION',to_ward_code:'medicine'}]})},findPatient:()=>row};
 const report=date=>{row.record_json=JSON.stringify(data);return wardMedicineReport(db,date,'medicine');};
 assert.equal(report('2026-09-17').patients[0].diagnosis,'I10');
 assert.equal(report('2026-09-17').matrix.rows[0].diagnosis,'I10');
 assert.deepEqual(report('2026-09-17').patients[0].medications.map(x=>x.name),['Evening']);
 assert.equal(report('2026-09-18').patients[0].diagnosis,'E11.9');
 assert.equal(report('2026-09-19').patients[0].diagnosis,'A00');
 data['system:doctorDailyMedicineOrders']=JSON.stringify([{dtVal:'2026-09-17T16:00',icd10:'J02.9',medications:[{name:'Doctor order'}]}]);
 assert.equal(report('2026-09-17').patients[0].diagnosis,'J02.9');
 assert.deepEqual(report('2026-09-17').patients[0].medications.map(x=>x.name),['Doctor order']);
 data['system:doctorDailyMedicineOrders']=JSON.stringify([{dtVal:'2026-09-17T16:00',icd10:'J02.9',diagnoses:[{icd10:'J02.9',text:'First'},{icd10:'i10',text:'Second'},{icd10:'E11.9',text:'Third'},{icd10:'I10',text:'Duplicate'}],medications:[{name:'Doctor order'}]}]);
 assert.equal(report('2026-09-17').patients[0].diagnosis,'J02.9, I10, E11.9');
 assert.equal(report('2026-09-17').matrix.rows[0].diagnosis,'J02.9, I10, E11.9');
 delete data['system:doctorDailyMedicineOrders'];
 data['system:dailyMonitoringRecords']=JSON.stringify([{dtVal:'2026-09-17T18:00',conclusion:'Old note',medications:[{name:'Legacy'}]}]);
 assert.equal(report('2026-09-17').patients[0].diagnosis,'A00');
 data['scope:medical:id:emr_ipd_diagnoses']=JSON.stringify([{icd10:'A00',text:'Admission'},{icd10:'I10',text:'Other'}]);
 assert.equal(report('2026-09-17').patients[0].diagnosis,'A00, I10');
 delete data['scope:medical:id:emr_ipd_diagnoses'];
 data['scope:medical:id:emr_pmrs_ipd_icd10']='';
 assert.equal(report('2026-09-17').patients[0].diagnosis,'');
});

test('doctor JSON follow-ups persist their ICD-10 source and nursing cannot overwrite it',async()=>{
 const port=32487,origin=`http://127.0.0.1:${port}`,app=createEmrServer({demoMode:true,host:'127.0.0.1',port,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 try{
  const login=async username=>{
   const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(response.status,200);
   const Cookie=response.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
   return{Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
  };
  const doctor=await login('doctor_medicine'),nurse=await login('nurse_medicine');
  const body={patientKey:'case:ICD-HTTP187',summary:{caseNumber:'ICD-HTTP187',healthId:'',fullName:'Test Patient',firstName:'Patient',lastName:'Test',sex:'Male',age:'30',dateOfBirth:'',phone:'',equityCard:'',paymentType:'DIRECT',departmentCode:'medicine',departmentNameKh:'ផ្នែកជំងឺទូទៅ',departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:'2026-09-16',dischargeDate:''},data:{
   'scope:medical:id:emr_pmrs_ipd_icd10':'A00',
   'system:dailyMonitoringRecords':JSON.stringify([{dtVal:'2026-09-17T09:00',icd10:'J02.9',diagnoses:[{icd10:'J02.9',text:'Doctor notes'},{icd10:'I10',text:'Second diagnosis'}],conclusion:'Doctor notes',medications:[{name:'Doctor medicine',total:'3',unit:'tablet'}]}]),
  }};
  const save=async headers=>{const response=await fetch(origin+'/api/patient-record',{method:'PUT',headers,body:JSON.stringify(body)});const result=await response.json();assert.equal(response.status,200,JSON.stringify(result));return result;};
  await save(doctor);
  let stored=JSON.parse(app.database.findPatient(body.patientKey).record_json);
  assert.equal(JSON.parse(stored['system:doctorDailyMedicineOrders'])[0].icd10,'J02.9');
  let report=wardMedicineReport(app.database,'2026-09-17','medicine');assert.equal(report.patients.find(x=>x.patientKey===body.patientKey).diagnosis,'J02.9, I10');
  body.data={'system:dailyMonitoringRecords':JSON.stringify([{dtVal:'2026-09-17T09:00',icd10:'E11.9',conclusion:'Nurse overwrite',temp:'37',medications:[{name:'Nurse overwrite'}]}])};
  await save(nurse);
  stored=JSON.parse(app.database.findPatient(body.patientKey).record_json);
  assert.equal(JSON.parse(stored['system:dailyMonitoringRecords'])[0].icd10,'J02.9');
  assert.equal(JSON.parse(stored['system:dailyMonitoringRecords'])[0].temp,'37');
  assert.equal(JSON.parse(stored['system:dailyMonitoringRecords'])[0].diagnoses[1].icd10,'I10');
  assert.equal(JSON.parse(stored['system:doctorDailyMedicineOrders'])[0].diagnoses[1].icd10,'I10');
  assert.equal(JSON.parse(stored['system:doctorDailyMedicineOrders'])[0].icd10,'J02.9');
  report=wardMedicineReport(app.database,'2026-09-17','medicine');assert.equal(report.patients.find(x=>x.patientKey===body.patientKey).diagnosis,'J02.9, I10');
 }finally{await new Promise(r=>app.server.close(r));app.database.close();}
});
