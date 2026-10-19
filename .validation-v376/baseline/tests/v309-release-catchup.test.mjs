import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createEmrServer} from '../server/server.mjs';
const source=fs.readFileSync(new URL('../public/paraclinic.js',import.meta.url),'utf8');
test('requisition demographics resolve real registration fields and keep saved snapshots independent of the current patient',()=>{
 const current={patientKey:'case:NOW',fullName:'Current Patient',dateOfBirth:'1990-01-02',healthId:'PATIENT-123',sex:'ស្រី',serviceMode:'ipd',data:{'scope:registration:id:web_village':'Village A','scope:registration:id:web_commune':'Commune A','scope:registration:id:web_district':'District A','scope:registration:id:web_province':'Province A'}};
 const fields={emr_pmrs_ipd_diagnosis:{value:'Current IPD diagnosis'},web_dob:{value:'2000-01-01'},web_village:{value:'WRONG CURRENT VILLAGE'}};
 const ctx={patient:current,document:{getElementById:id=>fields[id],querySelector:()=>null},esc:v=>String(v),Date};
 const a=source.indexOf('  function resolvePatientDemographics('),b=source.indexOf('  function printHtmlContent(',a);
 vm.runInNewContext(source.slice(a,b)+'\nthis.resolve=resolvePatientDemographics;this.signature=requisitionSignatureHtml;',ctx);
 const live=ctx.resolve();assert.equal(live.dob,'1990-01-02');assert.equal(live.village,'Village A');assert.equal(live.pmrs,'PATIENT-123');assert.equal(live.diag,'Current IPD diagnosis');
 const past=ctx.resolve({patientKey:'case:NOW',fullName:'Original Patient',dateOfBirth:'1980-05-06',village:'Original Village',diagnosis:'Original diagnosis'});
 assert.equal(past.dob,'1980-05-06');assert.equal(past.village,'Original Village');assert.equal(past.diag,'Original diagnosis');
 assert.doesNotMatch(ctx.signature(null,'Doctor'),/Signed:/);
 assert.match(ctx.signature({signerName:'Doctor',signedAt:1,signatureDataUrl:'data:image/png;base64,AAAA'}),/<img/);
});

test('photo persistence reports its new version; stale saves and another ward cannot overwrite it; order snapshots are server-owned',async()=>{
 const origin='http://127.0.0.1:32719';const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32719,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});await new Promise(r=>app.server.listen(32719,'127.0.0.1',r));
 try {
  async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken}}
  const admin=await login('admin'),doctor=await login('doctor_medicine'),nurse=await login('nurse_medicine');
  const call=(path,method,headers,body)=>fetch(origin+path,{method,headers,body:JSON.stringify(body)});
  const key='case:CATCHUP309',summary={caseNumber:'CATCHUP309',healthId:'PATIENT-309',fullName:'Original Requisition Patient',sex:'ប្រុស',age:'35',dateOfBirth:'1991-03-04',departmentCode:'surgery',departmentNameKh:'វះកាត់',serviceMode:'ipd',entryDate:new Date().toISOString().slice(0,10)};
  let r=await call('/api/patient-record','PUT',admin,{patientKey:key,summary,data:{'scope:registration:id:web_village':'Original Village'}});assert.equal(r.status,200);let version=(await r.json()).patient.version;
  const photo='data:image/jpeg;base64,'+Buffer.from([255,216,255,224,0,0]).toString('base64');
  r=await call('/api/patient-photo','POST',nurse,{patientKey:key,photo,expectedVersion:version});assert.equal(r.status,403);
  r=await call('/api/patient-photo','POST',admin,{patientKey:key,photo,expectedVersion:version});assert.equal(r.status,200);const saved=await r.json();assert.equal(saved.patientVersion,version+1);
  r=await call('/api/patient-photo','POST',admin,{patientKey:key,photo,expectedVersion:version});assert.equal(r.status,409);
  r=await call('/api/patient-record','PUT',admin,{patientKey:key,summary,expectedVersion:saved.patientVersion,data:{'scope:medical:id:emr_pmrs_ipd_diagnosis':'Follow-up diagnosis'}});assert.equal(r.status,200,await r.clone().text());
  r=await call('/api/paraclinic/orders','POST',doctor,{patientKey:key,modality:'LAB',request:{items:[{code:'HGB'}],clinicalInfo:'Original diagnosis',patientSnapshot:{fullName:'FORGED'},requesterSignature:{signerName:'FORGED'}}});assert.equal(r.status,201,await r.clone().text());const order=(await r.json()).order;
  assert.equal(order.request.patientSnapshot.fullName,summary.fullName);assert.equal(order.request.patientSnapshot.dateOfBirth,summary.dateOfBirth);assert.equal(order.request.patientSnapshot.village,'Original Village');assert.equal(order.request.requesterSignature.username,'doctor_medicine');assert.ok(order.request.requesterSignature.signatureDataUrl);
  r=await call('/api/lab-catalog/HGB','PATCH',admin,{active:false});assert.equal(r.status,200);
  r=await call('/api/paraclinic/orders','POST',doctor,{patientKey:key,modality:'LAB',request:{items:[{code:'HGB'},{code:'GLU'}]}});assert.equal(r.status,400,'must reject the whole unavailable selection instead of silently removing HGB');
  r=await call('/api/imaging-catalog/CT','PATCH',admin,{active:false});assert.equal(r.status,200);
  r=await call('/api/paraclinic/orders','POST',doctor,{patientKey:key,modality:'CT',request:{examination:'CT Brain'}});assert.equal(r.status,400);
  app.database.sqlite.prepare('UPDATE patient_records SET full_name=? WHERE patient_key=?').run('Changed Name',key);
  const kept=(await(await fetch(origin+'/api/paraclinic/orders/'+order.id,{headers:doctor})).json()).order;assert.equal(kept.request.patientSnapshot.fullName,summary.fullName);assert.equal(kept.request.requesterSignature.userId,order.request.requesterSignature.userId);
 } finally {await new Promise(r=>app.server.close(r));app.database.close()}
});

test('fixed paper checklist excludes inactive codes and disables already ordered tests',()=>{
 const a=source.indexOf('    const activeCodes = new Set(tests.map'),b=source.indexOf('    const formHtml =',a);
 const ctx={tests:[{code:'CBC'}],hasExistingLabTest:()=>true,esc:v=>v};vm.runInNewContext(source.slice(a,b)+'\nthis.row=testRow;',ctx);
 assert.equal(ctx.row('HGB','Inactive'), '');assert.match(ctx.row('CBC','CBC'),/disabled/);
 const photo=fs.readFileSync(new URL('../public/patient-photo.js',import.meta.url),'utf8');assert.match(photo,/p\.version = result\.patientVersion/);assert.match(photo,/expectedVersion:/);assert.match(photo,/alert\(err.message/);
});

test('admission retains the originating OPD doctor and diagnosis after an IPD transfer',()=>{
 const js=fs.readFileSync(new URL('../public/emr-patient-record.js',import.meta.url),'utf8');
 const a=js.indexOf('  function getAdmissionOrigin()'),b=js.indexOf('  async function loadCurrentSessionSignature()',a);
 const ctx={window:{getEmrCarePath:()=>({mode:'ipd'}),emrSession:{user:{activeRole:'DOCTOR'}}},loadedPatient:{data:{'system:opdConsultedAt':123}},parsedSignature:key=>({signerName:key}),currentDoctorIdentitySignature:()=>({signerName:'Current'})};
 vm.runInNewContext(js.slice(a,b)+'\nthis.admissionSignature=getAdmissionDoctorSignature;',ctx);
 assert.equal(ctx.window.getAdmissionOrigin(),'opd');assert.equal(ctx.admissionSignature().signerName,'opdDoctor');
 ctx.loadedPatient={data:{}};ctx.parsedSignature=key=>key==='opdDoctor'?null:{signerName:key};assert.equal(ctx.admissionSignature().signerName,'ipdDoctor');
 const html=fs.readFileSync(new URL('../protected/EMR.html',import.meta.url),'utf8');
 const start=html.indexOf('        function syncAdmissionDiagnosis()'),end=html.indexOf('        window.syncAdmissionDiagnosis =',start);let diagnosis='';
 const env={window:{getEmrCarePath:()=>({mode:'ipd'}),getAdmissionOrigin:()=> 'opd'},document:{getElementById:id=>id==='print_diag_in'?{set value(v){diagnosis=v}}:null},getPrimaryDiagnosis:mode=>mode==='opd'?'Original OPD diagnosis':'Later ward diagnosis',syncAdmissionDates(){},syncAdmissionReferralWard(){},populateAdmissionDoctorPrintSignature(){}};
 vm.runInNewContext(html.slice(start,end)+'\nsyncAdmissionDiagnosis();',env);assert.equal(diagnosis,'Original OPD diagnosis');
});
