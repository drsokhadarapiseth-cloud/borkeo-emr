import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {openDatabase} from '../server/database.mjs';
import {ensureSymptomSchema,listSymptoms,addCustomSymptom,normalizeSymptom} from '../server/symptoms.mjs';
import {createEmrServer} from '../server/server.mjs';
const source=fs.readFileSync(new URL('../public/chief-complaint-tags.js',import.meta.url),'utf8');
const seed=JSON.parse(fs.readFileSync(new URL('../server/catalogues/symptoms-v327.json',import.meta.url),'utf8'));

test('v32.7 imports exactly the 842 edited Excel entries, with original codes and bilingual labels',()=>{
 const db=openDatabase(':memory:');try{
 ensureSymptomSchema(db);const list=listSymptoms(db);assert.equal(list.length,842);
 for(const row of seed.items){const saved=list.find(x=>x.code===row.code);assert.ok(saved);assert.equal(saved.nameKh,row.nameKh.normalize('NFKC'));assert.equal(saved.nameEn,row.nameEn);}
 assert.equal(new Set(list.map(x=>x.code)).size,842);
 ensureSymptomSchema(db);assert.equal(listSymptoms(db).length,842);
 }finally{db.close();}
});
test('uncoded custom symptoms persist across connections and repeated initialization without duplicates',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-symptoms-')),file=path.join(dir,'synthetic.sqlite');
 let db=openDatabase(file);try{
 ensureSymptomSchema(db);const a=addCustomSymptom(db,{text:'  Synthetic   new complaint  '},null);assert.equal(a.created,true);assert.equal(a.item.code,null);
 const b=addCustomSymptom(db,{text:'SYNTHETIC new\u200b complaint',code:'SYMP:FORGED'},null);assert.equal(b.created,false);assert.equal(b.item.id,a.item.id);
 db.close();db=openDatabase(file);ensureSymptomSchema(db);assert.equal(listSymptoms(db).length,843);
 assert.equal(addCustomSymptom(db,{text:'Synthetic new complaint'},null).item.id,a.item.id);
 const second=openDatabase(file);try{ensureSymptomSchema(second);assert.equal(addCustomSymptom(second,{text:'synthetic new complaint'},null).created,false);}finally{second.close();}
 }finally{db.close();fs.rmSync(dir,{recursive:true,force:true});}
});
test('duplicates resolve existing Khmer, English and source synonyms; invalid or conflicting bilingual names are rejected',()=>{
 const db=openDatabase(':memory:');try{
 ensureSymptomSchema(db);
 for(const text of ['cough',' COUGH ','ក្អក']){const r=addCustomSymptom(db,{text},null);assert.equal(r.created,false);assert.equal(r.item.nameEn,'cough');}
 const synonym=seed.items.find(x=>x.synonyms.length);assert.equal(addCustomSymptom(db,{text:synonym.synonyms[0]},null).created,false);
 assert.throws(()=>addCustomSymptom(db,{text:' \u200b '},null));assert.throws(()=>addCustomSymptom(db,{text:'x'.repeat(241)},null));
 assert.throws(()=>addCustomSymptom(db,{nameKh:'ក្អក',nameEn:'fever'},null));
 assert.equal(listSymptoms(db).length,842);assert.equal(normalizeSymptom(' ＣＯＵＧＨ\u200b '),'cough');
 }finally{db.close();}
});
test('real HTTP catalogue creation checks authentication, role, CSRF, code omission and concurrent duplicate requests',async()=>{
 const origin='http://127.0.0.1:32727';
 const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32727,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
 await new Promise(r=>app.server.listen(32727,'127.0.0.1',r));
 try{
 const login=async username=>{const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return{Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};};
 const post=(headers,body)=>fetch(origin+'/api/symptoms',{method:'POST',headers,body:JSON.stringify(body)});
 assert.equal((await fetch(origin+'/api/symptoms')).status,401);
 const triage=await login('triage'),doctor=await login('doctor_medicine'),clerk=await login('clerk');
 assert.equal((await post(clerk,{text:'Denied cashier symptom'})).status,403);
 assert.equal((await post({...triage,'X-CSRF-Token':'wrong'},{text:'Denied CSRF symptom'})).status,403);
 assert.equal((await post({...triage,Origin:'https://other.invalid'},{text:'Denied origin symptom'})).status,403);
 const results=await Promise.all([post(triage,{text:'Synthetic simultaneous symptom',code:'SYMP:FORGED'}),post(doctor,{text:' SYNTHETIC simultaneous symptom '})]);
 assert.deepEqual(results.map(x=>x.status).sort(),[200,201]);const saved=await Promise.all(results.map(x=>x.json()));assert.equal(saved[0].item.id,saved[1].item.id);assert.equal(saved[0].item.code,null);
 const duplicate=await post(triage,{text:'COUGH'});assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).created,false);
 const listing=await(await fetch(origin+'/api/symptoms',{headers:doctor})).json();assert.equal(listing.items.length,843);assert.equal(listing.canCreate,true);
 assert.equal(app.database.sqlite.prepare("SELECT COUNT(*) count FROM audit_events WHERE action='SYMPTOM_CREATED'").get().count,1);
 assert.equal((await post(triage,{text:''})).status,400);
 const registration=await login('registration'),key='case:SYMPTOM327';
 const summary={caseNumber:'SYMPTOM327',healthId:'SYMPTOM327',fullName:'Synthetic Symptom Patient',sex:'ប្រុស',age:'40',phone:'010111111',entryDate:new Date().toISOString().slice(0,10),serviceMode:'',departmentCode:''};
 let record=await fetch(origin+'/api/patient-record',{method:'PUT',headers:registration,body:JSON.stringify({patientKey:key,summary,data:{'scope:registration:id:emr_pmrs_case_new':true}})});assert.equal(record.status,200,await record.clone().text());
 const labels=['Pain, left side','ក្អក'],complaint=labels.join(', '),items=JSON.stringify(labels);
 record=await fetch(origin+'/api/patient-record',{method:'PUT',headers:triage,body:JSON.stringify({patientKey:key,summary:{...summary,departmentCode:'medicine',serviceMode:'ipd'},data:{'scope:triage:id:pmrs_chief_complaint':complaint,'scope:triage:id:pmrs_chief_complaint_items':items}})});assert.equal(record.status,200,await record.clone().text());
 const loaded=await(await fetch(origin+'/api/patient-record?patientKey='+encodeURIComponent(key),{headers:triage})).json();
 assert.equal(loaded.patient.data['scope:triage:id:pmrs_chief_complaint'],complaint);assert.equal(loaded.patient.data['scope:triage:id:pmrs_chief_complaint_items'],items);
 }finally{await new Promise(r=>app.server.close(r));app.database.close();}
});
test('client shares one Khmer option for identical translated labels and preserves normalized selection and comma-containing labels',()=>{
 const selectedSymptoms=new Set(),catalogDetails=new Map();const ctx={catalog:[],catalogDetails,selectedSymptoms,normalize:normalizeSymptom};
 const a=source.indexOf('  function remember('),b=source.indexOf('  async function securityToken()',a);
 vm.runInNewContext(source.slice(a,b)+'\nthis.remember=remember;this.selectUnique=selectUnique;this.findLabel=findLabel;',ctx);
 ctx.remember({id:'1',nameKh:'ក្អក',nameEn:'cough',code:'SYMP:1'});ctx.remember({id:'2',nameKh:'ក្អក',nameEn:'second name',code:'SYMP:2'});
 assert.equal(ctx.catalog.length,1);assert.equal(catalogDetails.get('ក្អក').length,2);
 ctx.selectUnique('COUGH');ctx.selectUnique('ក្អក');assert.equal(selectedSymptoms.size,1);
 const target={value:'',disabled:false,dispatchEvent(){}};const details={value:''};
 const c={selectedSymptoms:new Set(['Pain, left side','ក្អក']),document:{getElementById:id=>id==='pmrs_chief_complaint_items'?details:target},getTargetInput:()=>target,renderTags(){},renderOptions(){},Event:class{},JSON};
 c.selectUnique=text=>c.selectedSymptoms.add(text);
 const start=source.indexOf('  function syncToInput()'),end=source.indexOf('  function renderTags()',start);
 vm.runInNewContext(source.slice(start,end)+'\nthis.syncToInput=syncToInput;this.syncFromInput=syncFromInput;',c);
 c.syncToInput();c.selectedSymptoms.clear();c.syncFromInput();assert.deepEqual([...c.selectedSymptoms],['Pain, left side','ក្អក']);
});
test('async custom creation does not attach a result to a different patient and exposes failures without claiming a save',async()=>{
 const selectedSymptoms=new Set();let resolve;const promise=new Promise(r=>resolve=r);const button={};let message='';let sync=0;
 const c={canCreate:true,adding:false,patientGeneration:1,editable:()=>true,persist:()=>promise,document:{getElementById:()=>button},selectedSymptoms,selectUnique:x=>selectedSymptoms.add(x),syncToInput:()=>sync++,renderOptions(){},status:x=>message=x,String};
 const a=source.indexOf('  async function addCustomSymptom('),b=source.indexOf('  function toggleDropdown(',a);
 vm.runInNewContext(source.slice(a,b)+'\nthis.add=addCustomSymptom;',c);
 const pending=c.add('Delayed symptom');c.patientGeneration=2;resolve({item:{nameKh:'Delayed symptom'},created:true});await pending;assert.equal(sync,0);assert.equal(selectedSymptoms.size,0);
 c.persist=async()=>{throw Error('Network down');};await c.add('Failed symptom');assert.match(message,/Network down/);assert.equal(sync,0);
});
test('new symptom controls preserve old anonymous clinical storage keys and legacy complaint restoration',()=>{
 const html=fs.readFileSync(new URL('../protected/EMR.html',import.meta.url),'utf8');
 assert.match(html,/id="pmrs_chief_complaint_items" data-emr-no-auto-index/);
 assert.match(source,/cb.dataset.emrTransient = '1'/);
 const record=fs.readFileSync(new URL('../public/emr-patient-record.js',import.meta.url),'utf8');
 const start=record.indexOf('  function prepareStorageKeys()'),end=record.indexOf('  function ensureFirstExamDateTime()',start);
 // v41.5: prepareStorageKeys also asks window for the nursing chart initializer and filters with matches/closest.
 function control(id='',attrs=[]){return{id,dataset:{},hasAttribute:x=>attrs.includes(x),matches:()=>false,closest:()=>null};}
 function keys(controls){const ctx={window:{},document:{querySelectorAll:()=>controls},storageScope:()=> 'triage',storagePrepared:false};vm.runInNewContext(record.slice(start,end)+'\nprepareStorageKeys();',ctx);return controls.filter(c=>!c.hasAttribute('data-emr-no-auto-index')&&!c.hasAttribute('data-emr-transient')).map(c=>({...c.dataset}));}
 const old=keys([control('pmrs_chief_complaint'),control(),control('next_field')]);
 const updated=keys([control('pmrs_chief_complaint'),control('pmrs_chief_complaint_items',['data-emr-no-auto-index']),control('', ['data-emr-transient']),control(),control('next_field')]);
 assert.deepEqual(updated,old);
});
test('emergency checkbox selections still populate the complaint field',()=>{
 let onChange,saved,selected;
 const cb={checked:true,addEventListener:(name,fn)=>onChange=fn,closest:()=>({querySelector:()=>({textContent:'Synthetic emergency complaint'})})};
 const ctx={document:{querySelectorAll:()=>[cb],getElementById:()=>({value:''})},saveCatalog:text=>saved=text,selectUnique:text=>selected=text,findLabel:x=>x,syncToInput(){},selectedSymptoms:new Set(),renderOptions(){}};
 const a=source.indexOf('  function bindEmergencyCheckboxes()'),b=source.indexOf('  function syncCheckedEmergencyBoxes()',a);
 vm.runInNewContext(source.slice(a,b)+'\nbindEmergencyCheckboxes();',ctx);onChange();assert.equal(saved,'Synthetic emergency complaint');assert.equal(selected,saved);
});
test('both repaired encounter-ID SQL expressions execute with the existing JSON key',()=>{
 const server=fs.readFileSync(new URL('../server/server.mjs',import.meta.url),'utf8');
 const literals=[...server.matchAll(/database\.sqlite\.prepare\(("SELECT COUNT\(\*\) as c FROM patient_records WHERE json_extract[^\n]*?LIKE \?")\)/g)].map(m=>m[1]);
 assert.ok([2, 3].includes(literals.length));const database=openDatabase(':memory:');try{
 for(const literal of literals)assert.equal(vm.runInNewContext('database.sqlite.prepare('+literal+').get("OPD-%").c',{database}),0);
 }finally{database.close();}
});
