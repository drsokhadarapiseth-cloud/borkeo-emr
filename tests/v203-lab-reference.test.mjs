import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {openDatabase} from '../server/database.mjs';
import {ensureAccessSchema} from '../server/access.mjs';
import {ensureParaclinicSchema,labCatalog,findLabTest,updateLabTest,createLabTest,deleteLabTest,normalizeLabResults,createOrder,updateOrder,getOrder} from '../server/paraclinic.mjs';
import {clinicalLimits,convertValue,patientContext,resultFlag,rebaseTest,snapshotLimits,LIMIT_KEYS} from '../public/lab-reference.mjs';
import {REFERENCE_DEFAULTS} from '../server/lab-reference-defaults.mjs';
const adult={age:'40 ឆ្នាំ',sex:'ប្រុស'};
function db(){const d=openDatabase(':memory:');ensureAccessSchema(d);ensureParaclinicSchema(d);return d}
function approx(actual,expected){assert.ok(Math.abs(actual-expected)<1e-8*Math.max(1,Math.abs(expected)),`${actual} != ${expected}`)}
function user(d,name='lab203',role='ADMIN'){const id=crypto.randomUUID();d.createUser({id,username:name,displayName:name,role,passwordHash:'unused',createdAt:Date.now()});return id}
function patient(d,id,key='case:REF203'){d.upsertPatient({id:crypto.randomUUID(),patientKey:key,userId:id,savedAt:Date.now(),summary:{caseNumber:'REF203',healthId:'REF203',firstName:'Synthetic',lastName:'Patient',fullName:'Synthetic Patient',sex:'ប្រុស',age:'40 ឆ្នាំ',dateOfBirth:'1986-01-01',phone:'',equityCard:'',paymentType:'DIRECT',departmentCode:'medicine',departmentNameKh:'',departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:'2026-10-07',dischargeDate:''},data:{}});return key}

test('v20.3 all numeric catalog units round-trip results and limits without changing their flags',()=>{const d=db();try{
 let checked=0;
 for(const catalog of labCatalog(d,true).filter(t=>t.resultType==='NUMERIC')){
  const t=clinicalLimits(catalog,adult,'2026-10-07');
  const values=[0,1,15,100,...LIMIT_KEYS.map(k=>t[k]).filter(v=>v!=null)];
  for(const unit of t.units){
   for(const n of values){const converted=convertValue(n,t.baseUnit,unit.unit,t);approx(convertValue(converted,unit.unit,t.baseUnit,t),n);assert.equal(resultFlag(converted,unit.unit,t),resultFlag(n,t.baseUnit,t),`${t.code} ${unit.unit} ${n}`);checked++}
   let n=values.at(-1);for(let i=0;i<25;i++){n=Number(convertValue(n,t.baseUnit,unit.unit,t).toPrecision(12));n=Number(convertValue(n,unit.unit,t.baseUnit,t).toPrecision(12))}approx(n,values.at(-1));
  }
 }
 assert.ok(checked>500);
}finally{d.close()}});

test('v20.3 affine HbA1c conversions include the offset and an exclusive decision threshold',()=>{const d=db();try{const t=clinicalLimits(findLabTest(d,'HBA1C'),adult);const ifcc=convertValue(5.7,'%', 'mmol/mol',t);approx(ifcc,(5.7-2.152)/.09148);assert.equal(resultFlag(ifcc,'mmol/mol',t),'HIGH');assert.equal(resultFlag(5.65,'%',t),'');assert.equal(t.criticalHigh,null);const r=rebaseTest(t,'mmol/mol');approx(r.referenceHigh,ifcc);assert.equal(resultFlag(ifcc,r.baseUnit,r),'HIGH')}finally{d.close()}});

test('v20.3 patient context recognizes Khmer age units, birthdays and neonatal days',()=>{
 assert.equal(patientContext({age:'45 ឆ្នាំ',sex:'ស្រី'}).age,45);assert.equal(patientContext({age:'6 ខែ'}).age,.5);assert.equal(patientContext({age:'10 ថ្ងៃ'}).days,10);
 const birthday=patientContext({dateOfBirth:'2008-10-07'},'2026-10-07T00:00:00Z');assert.equal(birthday.age,18);assert.ok(patientContext({dateOfBirth:'2008-10-08'},'2026-10-07T00:00:00Z').age<18);
 assert.equal(patientContext({dateOfBirth:'2027-01-01'},'2026-10-07').age,null);assert.equal(patientContext({}).sex,'');assert.equal(patientContext({dateOfBirth:'2026-02-30',age:40},'2026-10-07').age,null);assert.ok(patientContext({dateOfBirth:'2008-02-29'},'2026-02-27').age<18);assert.equal(patientContext({dateOfBirth:'2026-01-31'},'2026-04-30').age,.25);
});

test('v20.3 hemoglobin selects sex, pediatric and neonatal limits without assigning adults to missing demographics',()=>{const d=db();try{const t=findLabTest(d,'HGB');const at='2026-10-07';
 assert.equal(clinicalLimits(t,adult,at).referenceLow,13);assert.equal(clinicalLimits(t,{age:40,sex:'F'},at).referenceHigh,16.5);
 assert.equal(clinicalLimits(t,{age:3},at).referenceLow,10.1);assert.equal(clinicalLimits(t,{dateOfBirth:'2026-10-07'},at).referenceLow,14.9);
 assert.equal(clinicalLimits(t,{age:40},at).referenceLow,null);assert.equal(clinicalLimits(t,{},at).referenceHigh,null);
 assert.equal(clinicalLimits(t,{dateOfBirth:'2026-08-19'},at).criticalHigh,24);assert.equal(clinicalLimits(t,{dateOfBirth:'2026-08-18'},at).criticalHigh,20);
 assert.equal(clinicalLimits(findLabTest(d,'CREAT'),{age:4,sex:'M'},at).referenceLow,null);
}finally{d.close()}});

test('v20.3 critical boundaries are inclusive where published; neutrophil percent never receives an absolute ANC limit',()=>{const d=db();try{
 const k=clinicalLimits(findLabTest(d,'K'),adult);assert.equal(resultFlag(2.5,'mmol/L',k),'CRITICAL_LOW');assert.equal(resultFlag(6,'mEq/L',k),'CRITICAL_HIGH');assert.equal(resultFlag(2.500001,'mmol/L',k),'LOW');
 const neut=clinicalLimits(findLabTest(d,'NEUT'),adult);assert.equal(neut.criticalLow,null);assert.equal(resultFlag(.4,'%',neut),'LOW');
 for(const code of ['TROP_I','TROP_T','CORTISOL']){const t=findLabTest(d,code);if(t){assert.equal(t.referenceLow,null);assert.equal(t.referenceHigh,null);assert.equal(t.criticalLow,null);assert.equal(t.criticalHigh,null)}}
 const hiv=normalizeLabResults(d,{items:[{code:'HIV',value:'Reactive',unit:''}]}).items[0];assert.equal(hiv.value,'Reactive');assert.equal(hiv.flag,'');assert.equal(hiv.criticalLow,null);
}finally{d.close()}});

test('v20.3 one-time migration backs up previous rows, preserves local settings and never restores retired limits',()=>{const d=db();try{
 // Simulate a legacy installation with a stock starter row and local overrides.
 d.sqlite.exec('DROP TABLE lab_reference_migrations');
 d.sqlite.prepare("UPDATE lab_catalog SET reference_low=3.5,reference_high=5.1,critical_low=2.8,critical_high=6.2,reference_note='International starter interval; verify locally.',reference_config_json='{}' WHERE code='K'").run();
 d.sqlite.prepare("UPDATE lab_catalog SET reference_low=70,reference_high=130,critical_low=NULL,critical_high=500,reference_note='Hospital verified method',reference_config_json='{}' WHERE code='CREAT'").run();
 ensureParaclinicSchema(d);
 const previous=JSON.parse(d.sqlite.prepare("SELECT previous_json FROM lab_reference_migrations WHERE code='K'").get().previous_json);assert.equal(previous.critical_low,2.8);
 assert.equal(findLabTest(d,'K').criticalLow,2.5);assert.equal(findLabTest(d,'K').criticalHigh,6);
 const custom=findLabTest(d,'CREAT');assert.equal(custom.referenceLow,70);assert.equal(custom.referenceHigh,130);assert.equal(custom.criticalHigh,500);assert.equal(custom.referenceConfig.referenceSource,'Local configuration');
 const before=labCatalog(d,true);ensureParaclinicSchema(d);assert.deepEqual(labCatalog(d,true),before);
 updateLabTest(d,'K',{criticalLow:null,criticalHigh:null});ensureParaclinicSchema(d);assert.equal(findLabTest(d,'K').criticalLow,null);assert.equal(findLabTest(d,'K').criticalHigh,null);
 assert.equal(findLabTest(d,'HGB').referenceLow,null);assert.equal(findLabTest(d,'NEUT').criticalLow,null);
}finally{d.close()}});

test('v20.3 changing a catalog base unit converts profiles, thresholds and conversion rules across restarts',()=>{const d=db();try{
 const original=findLabTest(d,'CREAT'),resolved=clinicalLimits(original,adult);const updated=updateLabTest(d,'CREAT',{baseUnit:'mg/dL'}),active=clinicalLimits(updated,adult);
 approx(active.referenceLow,53/88.4);approx(active.criticalHigh,354/88.4);assert.equal(updated.units.find(r=>r.unit==='mg/dL').factorToBase,1);
 for(const key of LIMIT_KEYS)if(resolved[key]!=null)approx(active[key],convertValue(resolved[key],original.baseUnit,updated.baseUnit,original));
 assert.equal(resultFlag(1,'mg/dL',active),'');ensureParaclinicSchema(d);assert.deepEqual(findLabTest(d,'CREAT'),updated);
 updateLabTest(d,'HGB',{baseUnit:'g/L'});ensureParaclinicSchema(d);assert.equal(findLabTest(d,'HGB').baseUnit,'g/L');
 assert.throws(()=>updateLabTest(d,'CREAT',{baseUnit:'mmol/L'}),/not approved/);
}finally{d.close()}});

test('v20.3 local rule and scalar edits are validated and review state is explicit',()=>{const d=db();try{
 const t=findLabTest(d,'HGB');const unchanged=updateLabTest(d,'HGB',{referenceRules:t.referenceConfig.referenceRules,criticalRules:t.referenceConfig.criticalRules,locallyReviewed:true});assert.equal(unchanged.referenceConfig.referenceSource,t.referenceConfig.referenceSource);assert.equal(unchanged.referenceConfig.reviewed,true);
 const edited=updateLabTest(d,'HGB',{referenceLow:12,referenceHigh:16});assert.deepEqual(edited.referenceConfig.referenceRules,[]);assert.equal(edited.referenceConfig.reviewed,false);assert.equal(clinicalLimits(edited,{}).referenceLow,12);
 assert.throws(()=>updateLabTest(d,'HGB',{referenceRules:[{sex:'UNKNOWN',referenceLow:1}]}),/sex/);assert.throws(()=>updateLabTest(d,'HGB',{referenceRules:[{minAge:20,maxAge:10}]}),/bounds/);assert.throws(()=>updateLabTest(d,'HGB',{criticalRules:[{criticalLow:10,criticalHigh:2}]}),/lower/);
 const local=createLabTest(d,{code:'LOCAL203',name:'Local test',category:'Local',baseUnit:'U/L',referenceRules:[{minAge:18,referenceLow:1,referenceHigh:2}],locallyReviewed:true});assert.equal(local.referenceConfig.reviewed,true);ensureParaclinicSchema(d);assert.deepEqual(findLabTest(d,'LOCAL203'),local);
}finally{d.close()}});

test('v20.3 blank results stay blank and invalid/negative conversion factors or nonnumeric results are rejected',()=>{const d=db();try{
 const t=findLabTest(d,'K');assert.equal(convertValue('','mmol/L','mEq/L',t),'');assert.equal(convertValue(null,'mmol/L','mEq/L',t),null);
 assert.equal(normalizeLabResults(d,{items:[{code:'K',value:null,unit:'mmol/L'}]},adult).items[0].value,'');
 for(const value of ['bad',Infinity])assert.throws(()=>normalizeLabResults(d,{items:[{code:'K',value,unit:'mmol/L'}]},adult),/finite/);
 assert.throws(()=>updateLabTest(d,'K',{units:[{unit:'mmol/L',factorToBase:-1}]}),/conversion/);assert.throws(()=>updateLabTest(d,'K',{units:[{unit:'mmol/L',factorToBase:2}]}),/identity/);assert.throws(()=>convertValue(1,'unknown','mEq/L',t),/not approved/);
}finally{d.close()}});

test('v20.3 finalized report snapshots survive catalog edits, unit changes, deletion and explicit revised releases',()=>{const d=db();try{
 const id=user(d),key=patient(d,id);const order=createOrder(d,{patientKey:key,modality:'LAB',userId:id,role:'ADMIN',request:{items:[{code:'CREAT'}]}});
 const first=updateOrder(d,order.id,{release:true,result:{items:[{code:'CREAT',value:1,unit:'mg/dL'}]}},{userId:id,role:'ADMIN'}),original=structuredClone(first.result),saved=snapshotLimits(original.items[0],findLabTest(d,'CREAT'));
 updateLabTest(d,'CREAT',{referenceLow:1,referenceHigh:2,criticalHigh:3,referenceRules:[],criticalRules:[]});updateLabTest(d,'CREAT',{baseUnit:'mg/dL'});ensureParaclinicSchema(d);
 assert.deepEqual(getOrder(d,order.id).result,original);assert.equal(saved.referenceLow,original.items[0].referenceLow);
 assert.throws(()=>updateOrder(d,order.id,{result:{items:[{code:'CREAT',value:2,unit:'mg/dL'}]}},{userId:id,role:'ADMIN'}),/read-only/);
 const revised=updateOrder(d,order.id,{release:true,result:{items:[{code:'CREAT',value:2,unit:'mg/dL'}]}},{userId:id,role:'ADMIN'});assert.ok(revised.releasedAt>first.releasedAt);assert.equal(revised.reportVersions.length,2);assert.deepEqual(revised.reportVersions[0].result,original);assert.equal(revised.reportVersions[0].validatorName,'lab203');
 deleteLabTest(d,'CREAT');const snapshot=snapshotLimits(original.items[0],{code:'CREAT',name:'Deleted test',baseUnit:'mg/dL',units:[]});assert.equal(snapshot.name,'Creatinine');assert.equal(snapshot.referenceLow,original.items[0].referenceLow);assert.equal(convertValue(1,'mg/dL','mg/dL',snapshot),1);
 ensureParaclinicSchema(d);assert.equal(findLabTest(d,'CREAT'),null,'deleted tests stay deleted after restart');
 const unrecorded=snapshotLimits({unit:'mg/dL',value:1},{baseUnit:'µmol/L',referenceLow:53,referenceHigh:97});assert.equal(unrecorded.referenceLow,null);
}finally{d.close()}});

test('v20.3 every built-in entry records sourced or local configuration status without fake universal critical thresholds',()=>{const d=db();try{
 for(const t of labCatalog(d,true)){assert.equal(t.referenceConfig.revision,'20.3',t.code);for(const kind of ['reference','critical']){const source=t.referenceConfig[kind+'Source'];if(source&&!source.startsWith('Local'))assert.match(source,/^https:\/\//)}}
 assert.ok(Object.keys(REFERENCE_DEFAULTS).length>50);assert.equal(findLabTest(d,'CHOL').criticalHigh,null);assert.equal(findLabTest(d,'TG').criticalHigh,null);
 assert.equal(clinicalLimits(findLabTest(d,'GLU'),{age:2}).criticalHigh,null);assert.equal(clinicalLimits(findLabTest(d,'HGB'),{}).criticalHigh,null);
}finally{d.close()}});

test('v20.3 lab staff can edit ranges with CSRF but cannot rename, create or delete tests; management editing remains available',async()=>{
 const {createEmrServer}=await import('../server/server.mjs');const app=createEmrServer({demoMode:true,databasePath:':memory:',host:'127.0.0.1',port:0,appOrigin:'http://127.0.0.1:0',nodeEnv:'test'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${app.server.address().port}`;
 try{
  async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:app.config.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return {Cookie,Origin:app.config.appOrigin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken}}
  const lab=await login('lab'),patch=(body,headers=lab)=>fetch(origin+'/api/lab-catalog/K',{method:'PATCH',headers,body:JSON.stringify(body)});
  assert.equal((await patch({referenceLow:3.4,referenceHigh:5.3,locallyReviewed:true})).status,200);assert.equal(findLabTest(app.database,'K').referenceConfig.reviewed,true);
  assert.equal((await patch({name:'Unauthorized rename'})).status,403);assert.equal((await patch({referenceLow:3},{...lab,'X-CSRF-Token':'wrong'})).status,403);
  assert.equal((await fetch(origin+'/api/lab-catalog',{method:'POST',headers:lab,body:JSON.stringify({code:'NO203',name:'No',category:'Other'})})).status,403);assert.equal((await fetch(origin+'/api/lab-catalog/K',{method:'DELETE',headers:lab})).status,403);
  const director=await login('director'),vice=await login('vice_director');assert.equal((await patch({criticalHigh:6.5},director)).status,200);assert.equal((await patch({criticalHigh:6.4},vice)).status,200);
  const admin=await login('admin');assert.equal((await patch({name:'Potassium local'},admin)).status,200);
  assert.equal((await fetch(origin+'/public/lab-reference.mjs?v=2030')).status,200);
  const html=await(await fetch(origin+'/lab',{headers:lab})).text();assert.match(html,/lab\.js\?v=2030&build=\d+\./);
 }finally{await new Promise(r=>app.server.close(r));app.database.close()}
});

test('v20.3 the actual laboratory unit selector converts an entered result, refreshes limits, keeps blanks and reverses invalid selections',async()=>{
 const fs=await import('node:fs'),vm=await import('node:vm'),referenceTools=await import('../public/lab-reference.mjs');
 const source=fs.readFileSync(new URL('../public/lab.js',import.meta.url),'utf8');
 const segment=(start,end)=>source.slice(source.indexOf(start),source.indexOf(end,source.indexOf(start)));
 const d=db();try{
  const item=clinicalLimits(findLabTest(d,'HGB'),adult),handlers={},nodes={
   '[data-value]':{value:'14',classList:{toggle(){},remove(){}}},
   '[data-unit]':{value:'g/dL',addEventListener(type,fn){handlers[type]=fn}},
   '[data-reference]':{textContent:''},'[data-critical]':{textContent:''},'[data-flag]':{textContent:'',className:''},'[data-comment]':{addEventListener(){}}
  };
  const row={dataset:{code:'HGB',resultType:'NUMERIC'},querySelector:s=>nodes[s],addEventListener(){}};
  const detail={querySelectorAll:s=>s==='tr[data-code]'?[row]:[],querySelector:()=>null};let dirty=0,lastError='';
  const context={referenceTools,selected:{id:'test'},el:()=>detail,resolvedTest:()=>item,resultMap:()=>new Map(),fromBase:(v,u,t)=>v==null?null:convertValue(v,t.baseUnit,u,t),localFlag:resultFlag,flagLabel:f=>f,setDirty:()=>dirty++,setStatus:e=>{lastError=e}};
  vm.runInNewContext(segment('  function criticalText(', '  function rangeNote(')+segment('  function formatNumberClean(', '  function openCatalogManager(')+segment('  function refreshRow(', '  async function addExtraFee(')+'\nattachDetailHandlers();',context);
  nodes['[data-unit]'].value='g/L';handlers.change();assert.equal(nodes['[data-value]'].value,140);assert.match(nodes['[data-reference]'].textContent,/130.*180.*g\/L/);assert.match(nodes['[data-critical]'].textContent,/60.*200.*g\/L/);assert.equal(nodes['[data-flag]'].className,'flag ');assert.equal(dirty,1);
  nodes['[data-unit]'].value='g/dL';handlers.change();assert.equal(nodes['[data-value]'].value,14);
  nodes['[data-value]'].value='';nodes['[data-unit]'].value='g/L';handlers.change();assert.equal(nodes['[data-value]'].value,'');
  nodes['[data-unit]'].value='bad unit';handlers.change();assert.equal(nodes['[data-unit]'].value,'g/L');assert.match(lastError,/not approved/);
 }finally{d.close()}
});
