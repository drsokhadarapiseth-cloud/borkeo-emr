import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createEmrServer } from '../server/server.mjs';

test('compact lists preserve non-photo fields, access flags and stored photos', async () => {
 const app=createEmrServer({demoMode:true,databasePath:':memory:',port:0,nodeEnv:'test'});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
 try {
  const photo='data:image/jpeg;base64,'+Buffer.concat([Buffer.from([255,216,255]),Buffer.alloc(48000,42)]).toString('base64');
  for(const row of app.database.listPatients()) {
   const data=JSON.parse(row.record_json);
   for(const key of ['scope:registration:id:web_patient_photo','scope:registration:id:patient_photo','system:patientPhoto'])data[key]=photo;
   app.database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(data),row.patient_key);
  }
  const before=app.database.listPatients();
  for(const username of ['admin','triage']) {
   const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
   assert.equal(login.status,200);const Cookie=login.headers.get('set-cookie').split(';')[0];
   for(const url of ['/api/patients?includePayment=1','/api/triage/queue?counter=1']) {
    const full=await fetch(origin+url,{headers:{Cookie}});const fullText=await full.text();assert.equal(full.status,200);
    const compact=await fetch(origin+url+'&omitPhotos=1',{headers:{Cookie}});const compactText=await compact.text();assert.equal(compact.status,200);
    assert.equal(compact.headers.get('cache-control'),'no-store');
    const expected=JSON.parse(fullText);for(const key of ['patients','waiting','completed'])for(const p of expected[key]||[])p.photo='';
    assert.deepEqual(JSON.parse(compactText),expected);
    assert.ok(compactText.length < fullText.length/2);
    if(username==='admin' && url.startsWith('/api/patients'))console.log('Synthetic 30-patient list bytes:',Buffer.byteLength(fullText),'->',Buffer.byteLength(compactText));
   }
   const record=await(await fetch(origin+'/api/patient-record?patientKey='+encodeURIComponent(before[0].patient_key),{headers:{Cookie}})).json();assert.equal(record.patient.photo,photo);
  }
  assert.deepEqual(app.database.listPatients(),before);
  assert.equal((await fetch(origin+'/api/patients?omitPhotos=1')).status,401);
 }finally{await new Promise(r=>app.server.close(r));app.database.close();}
});
const listSource=fs.readFileSync(new URL('../public/patient-list.js',import.meta.url),'utf8');
function listHarness(){
 const snippet=listSource.slice(listSource.indexOf('  async function refreshPaymentStatuses()'),listSource.indexOf('  async function updateDates'));
 let calls=0,renders=0,payload={patients:[{patientKey:'one',version:1}]};
 const c=vm.createContext({document:{hidden:false,activeElement:null},console,patientsUrl:'/api/patients',triageToday:false,patientLoads:0,refreshInFlight:false,patientRequestGeneration:0,lastPatientSnapshot:null,patients:[],fetch:async()=>{calls++;return{ok:true,json:async()=>payload}},renderDepartmentFilter:()=>renders++,renderPaymentFilter:()=>renders++,renderTable:()=>renders++});
 vm.runInContext(snippet,c);return{c,run:()=>c.refreshPaymentStatuses(),calls:()=>calls,renders:()=>renders,setPayload:p=>payload=p};
}
test('unchanged list polls avoid DOM rebuilds; changed data remains live',async()=>{
 const h=listHarness();await h.run();assert.equal(h.renders(),3);await h.run();assert.equal(h.renders(),3);
 h.setPayload({patients:[{patientKey:'one',version:2}]});await h.run();assert.equal(h.renders(),6);
 h.c.document.hidden=true;await h.run();assert.equal(h.calls(),3);
});
test('overlapping list polls coalesce and pre-edit responses are discarded',async()=>{
 const h=listHarness();let release,calls=0;h.c.fetch=async()=>{calls++;await new Promise(r=>release=r);return{ok:true,json:async()=>({patients:[{patientKey:'old'}]})}};
 const first=h.run();await h.run();assert.equal(calls,1);h.c.patientRequestGeneration++;release();await first;assert.equal(h.renders(),0);assert.equal(h.c.refreshInFlight,false);
 h.c.patientLoads=1;await h.run();assert.equal(calls,1);
});
const paraSource=fs.readFileSync(new URL('../public/paraclinic.js',import.meta.url),'utf8');
function paraHarness(){
 const snippet=paraSource.slice(paraSource.indexOf('  let refreshRequest ='),paraSource.indexOf('  function modal('));
 let writes=0;const panel={querySelector:()=>({set innerHTML(v){writes++}})};
 const c=vm.createContext({console,patient:{patientKey:'one'},panels:[panel],catalog:{},currentOrders:[],user:{id:'staff',activeRole:'DOCTOR'},window:{getBorkeoLanguage:()=> 'kh'},document:{hidden:false},json:async()=>({orders:[]}),isPrePaymentOpdReview:()=>false,isWardNursingRole:()=>false,pendingBanner:()=>'',getCatalog:async()=>{},esc:String});
 vm.runInContext(snippet,c);return{c,run:()=>c.refresh(),writes:()=>writes};
}
test('unchanged order panels retain DOM and switched patients reject stale responses',async()=>{
 const h=paraHarness();await h.run();assert.equal(h.writes(),2);await h.run();assert.equal(h.writes(),2);
 let release;h.c.json=async()=>{await new Promise(r=>release=r);return{orders:[]}};const pending=h.run();h.c.patient={patientKey:'two'};release();await pending;assert.equal(h.writes(),2);
 h.c.json=async()=>({orders:[]});await h.run();assert.equal(h.writes(),4);
});
test('an in-flight order refresh queues one follow-up after a mutation',async()=>{
 const h=paraHarness();let release,calls=0;h.c.json=async()=>{calls++;if(calls===1)await new Promise(r=>release=r);return{orders:[]}};
 const first=h.run();const second=h.run();assert.equal(calls,1);release();await Promise.all([first,second]);await new Promise(r=>setImmediate(r));assert.equal(calls,2);assert.equal(h.writes(),2);
});

test('startup seeding leaves every non-empty demo database untouched',()=>{
 const source=fs.readFileSync(new URL('../server/server.mjs',import.meta.url),'utf8');
 // Normalize Windows newlines before extracting the actual startup block.
 const normalized=source.replace(/\r\n/g,'\n');
 const a=normalized.indexOf('  if (config.demoMode) {\n    const existingCount');
 const block=normalized.slice(a,normalized.indexOf('  ensureAppointmentSchema',a));
 assert.ok(a>0 && block.includes('resetAndSeedThirtyTriagePatients'));
 for(const count of [0,1,29,30,31,100]) {
  let seeds=0;
  vm.runInNewContext(block,{config:{demoMode:true},database:{sqlite:{prepare:()=>({get:()=>({count})})}},resetAndSeedThirtyTriagePatients:()=>seeds++});
  assert.equal(seeds,count===0?1:0,'existing patient count '+count);
 }
});
