import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {normalizeHefCard,normalizeHefResult,hefDate,createHefLookup} from '../server/hef-lookup.mjs';
import {createEmrServer} from '../server/server.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const fixture=()=>({equityCard:{cardNo:'0000001234',valid:true,validUntil:'2027-05-25',villageCode:'16030103'},householdMembers:[{id:'synthetic-1',fieldValues:{surname:{value:'Synthetic'},name:{value:'One'},gender:{value:'MALE'},dob:{value:'2000-02-29'},relationToHead:{value:'HEAD'}}},{id:'synthetic-2',fieldValues:{surname:{value:'Synthetic'},name:{value:'Two'},gender:{value:'FEMALE'},dob:{value:'2001-04-05'}}}],address:{province:{nameKm:'Province'},district:{nameKm:'District'},commune:{nameKm:'Commune'},village:{nameKm:'Village'}},photoRefId:'PRIVATE-FAMILY-PHOTO',fileExists:true});
const response=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});
test('HEF IDs preserve leading zeroes and support Khmer digits without allowing arbitrary URLs',()=>{
 assert.equal(normalizeHefCard('០០០០០០១២៣៤'),'0000001234');assert.throws(()=>normalizeHefCard('https://other.invalid'));assert.throws(()=>normalizeHefCard('12345'));assert.throws(()=>normalizeHefCard('12345678901'));
});
test('maps documented public response fields, separate household members, strict validity and dates; excludes family photo',()=>{
 const r=normalizeHefResult(fixture(),'0000001234');assert.equal(r.members.length,2);assert.equal(r.members[0].lastName,'Synthetic');assert.equal(r.members[0].firstName,'One');assert.equal(r.members[1].sex,'ស្រី');assert.equal(r.address.communeCode,'160301');assert.equal(r.card.valid,true);assert.doesNotMatch(JSON.stringify(r),/PHOTO|photoRefId/);
 const raw=fixture();raw.equityCard.valid=false;raw.equityCard.disqualified=true;raw.equityCard.cardNo='0000005678';raw.validCardRedirected=true;raw.householdMembers[0].fieldValues.dob.value='2020-02-31';raw.householdMembers[0].fieldValues.gender.value='UNKNOWN';
 const invalid=normalizeHefResult(raw,'0000001234');assert.equal(invalid.card.valid,false);assert.equal(invalid.card.disqualified,true);assert.equal(invalid.card.redirected,true);assert.equal(invalid.requestedCard,'0000001234');assert.equal(invalid.members[0].sex,'');assert.equal(invalid.members[0].dateOfBirth,'');
 assert.equal(hefDate('២០០០-០២-២៩'),'2000-02-29');assert.equal(hefDate('2001-02-29'),'');assert.equal(hefDate('2000-01-01T00:00:00Z'),'2000-01-01');
});
test('recognizes the observed public no-match response and refuses malformed provider data',()=>{
 assert.equal(normalizeHefResult({fileExists:false,validCardRedirected:false},'0000000000').found,false);
 assert.throws(()=>normalizeHefResult({},'0000000000'));assert.throws(()=>normalizeHefResult({...fixture(),householdMembers:Array(101).fill({})},'0000001234'));
 assert.throws(()=>normalizeHefResult(fixture(),'0000009999'));
});
test('uses the exact public endpoint without credentials, bounds errors and enforces per-user request limits',async()=>{
 let seen;const lookup=createHefLookup({fetchImpl:async(url,options)=>{seen={url,options};return response({fileExists:false,validCardRedirected:false});},now:()=>1000});
 for(let i=0;i<12;i++)assert.equal((await lookup('0000000000','synthetic-user')).found,false);
 assert.equal(seen.url.origin,'https://app.idpoor.gov.kh');assert.equal(seen.url.pathname,'/api/reporting/public/equitycards/verification');assert.equal(seen.url.searchParams.get('cardNo'),'0000000000');assert.equal(seen.options.redirect,'error');assert.equal(seen.options.headers.Authorization,undefined);
 await assert.rejects(lookup('0000000000','synthetic-user'),e=>e.status===429);
 const failed=createHefLookup({fetchImpl:async()=>new Response('Denied',{status:403})});await assert.rejects(failed('0000000000','u'),e=>e.status===503);
 const malformed=createHefLookup({fetchImpl:async()=>response({})});await assert.rejects(malformed('0000000000','u'),e=>e.status===503);
 const large=createHefLookup({fetchImpl:async()=>new Response('x'.repeat(524289),{headers:{'Content-Type':'application/json'}})});await assert.rejects(large('0000000000','u'),e=>e.status===503);
});
test('authenticated HEF route enforces registration role, CSRF and method; does not save patients or alter payments',async()=>{
 const origin='http://127.0.0.1:33119';let calls=0;
 const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:33119,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test',hefFetch:async()=>{calls++;return response(fixture());}});
 await new Promise(r=>app.server.listen(33119,'127.0.0.1',r));
 try{
 const login=async username=>{const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return{Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};};
 const post=(headers,cardNumber)=>fetch(origin+'/api/hef/lookup',{method:'POST',headers,body:JSON.stringify({cardNumber})});
 assert.equal((await fetch(origin+'/api/hef/lookup')).status,401);
 const registration=await login('registration'),doctor=await login('doctor_medicine'),clerk=await login('clerk');
 assert.equal((await post(doctor,'0000001234')).status,403);assert.equal((await post(clerk,'0000001234')).status,403);
 assert.equal((await post({...registration,'X-CSRF-Token':'wrong'},'0000001234')).status,403);assert.equal((await fetch(origin+'/api/hef/lookup',{headers:registration})).status,405);
 assert.equal((await post(registration,'not-a-card')).status,400);assert.equal(calls,0);
 const before=JSON.stringify(app.database.listPatients());const r=await post(registration,'0000001234');assert.equal(r.status,200);const result=await r.json();assert.equal(result.members.length,2);assert.equal(r.headers.get('cache-control'),'no-store');assert.equal(JSON.stringify(app.database.listPatients()),before);
 const audit=app.database.sqlite.prepare("SELECT details_json FROM audit_events WHERE action='HEF_LOOKUP'").get();assert.doesNotMatch(audit.details_json,/Synthetic|0000001234/);assert.equal(JSON.parse(audit.details_json).memberCount,2);
 const key='case:SYNTHETIC-HEF331',member=result.members[1];
 const metadata=JSON.stringify({source:result.source,verifiedAt:result.verifiedAt,requestedCard:result.requestedCard,card:result.card,selectedMemberId:member.id});
 const summary={caseNumber:'SYNTHETIC-HEF331',healthId:'SYNTHETIC-HEF331',firstName:member.firstName,lastName:member.lastName,fullName:member.fullName,sex:member.sex,dateOfBirth:member.dateOfBirth,age:'25',equityCard:result.card.number,entryDate:new Date().toISOString().slice(0,10),serviceMode:'',departmentCode:''};
 const saved=await fetch(origin+'/api/patient-record',{method:'PUT',headers:registration,body:JSON.stringify({patientKey:key,summary,data:{'scope:registration:id:web_hef_verification':metadata,'scope:registration:id:web_first_name':member.firstName,'scope:registration:id:web_last_name':member.lastName,'scope:registration:id:web_dob':member.dateOfBirth,'scope:registration:id:emr_pmrs_case_new':true}})});
 assert.equal(saved.status,200,await saved.clone().text());const loaded=await(await fetch(origin+'/api/patient-record?patientKey='+encodeURIComponent(key),{headers:registration})).json();
 assert.equal(loaded.patient.fullName,member.fullName);assert.equal(loaded.patient.dateOfBirth,member.dateOfBirth);assert.equal(loaded.patient.equityCard,result.card.number);assert.equal(loaded.patient.data['scope:registration:id:web_hef_verification'],metadata);
 }finally{await new Promise(r=>app.server.close(r));app.database.close();}
});
test('review defaults protect existing demographics and do not import absent values',()=>{
 const s=read('public/hef-lookup.js'),a=s.indexOf('  function fieldChanges('),b=s.indexOf('  function preview()',a);
 const c={result:{card:{number:'0000001234'}},current:id=>id==='web_first_name'?'Old name':''};vm.runInNewContext(s.slice(a,b)+'\nthis.changes=fieldChanges;',c);
 const changes=c.changes({firstName:'New name',lastName:'',sex:'',dateOfBirth:''});assert.equal(changes.length,2);assert.equal(changes[1].before,'Old name');assert.equal(changes[1].value,'New name');
 assert.match(s,/!c.before\|\|c.before===c.value\?'checked'/);assert.doesNotMatch(s,/paymentType\s*=|web_health_id.*\.value\s*=/);
});
test('a delayed lookup result does not open or fill a different patient after navigation',async()=>{
 const s=read('public/hef-lookup.js'),a=s.indexOf('  async function verify()'),b=s.indexOf('  async function apply()',a);let resolve,opened=false,notice='';
 const pending=new Promise(r=>resolve=r),ctx={allowed:()=>true,cardValue:()=> '0000001234',generation:0,controller:null,context:null,AbortController,window:{emrSession:{csrfToken:'csrf'}},fetch:()=>pending,message:t=>notice=t,ensureDialog:()=>{opened=true;},result:null};
 vm.runInNewContext(s.slice(a,b)+'\nthis.verify=verify;',ctx);const task=ctx.verify();ctx.generation++;resolve({ok:true,json:async()=>({found:true,...normalizeHefResult(fixture(),'0000001234')})});await task;assert.equal(opened,false);
});
test('new hidden verification field and transient modal controls preserve clinical storage indexing; only current EMR page loads assets',()=>{
 const html=read('protected/EMR.html');assert.match(html,/id="web_hef_verification" data-emr-no-auto-index/);assert.match(html,/hef-lookup.js\?v=3310/);assert.match(html,/hef-lookup.css\?v=3310/);assert.match(read('public/hef-lookup.js'),/data-emr-transient/);
 assert.match(read('public/cambodia-address.js'),/if \(!stillCurrent\(\)\) throw/);
});
test('address import prepares all four levels before committing and leaves the form untouched if stale or unmatched',async()=>{
 const s=read('public/cambodia-address.js'),a=s.indexOf('  window.applyVerifiedHefAddress ='),b=s.indexOf('  window.cambodiaAddressManager =',a);
 const calls=[],drop=()=>({setOptions(){calls.push('options')},setDisabled(){},setSelectionManual(name,code){calls.push(code)}});
 const raw=[{code:'1603',local:'District',communes:[{code:'160301',local:'Commune',villages:[{code:'16030103',local:'Village'}]}]}];
 const manager={provinceDropdown:drop(),districtDropdown:drop(),communeDropdown:drop(),villageDropdown:drop(),fetchProvinceDetail:async()=>raw};
 const c={window:{},addressManager:manager,provincesList:[{code:'16',nameKh:'Province'}],padCode:(code,level)=>String(code).padStart({province:2,district:4,commune:6,village:8}[level],'0'),document:{getElementById:()=>({dispatchEvent(){}})},Event:class{},Error};
 vm.runInNewContext(s.slice(a,b),c);
 const address={provinceCode:'16',districtCode:'1603',communeCode:'160301',villageCode:'16030103'};
 await assert.rejects(c.window.applyVerifiedHefAddress(address,()=>false));assert.equal(calls.length,0);
 await assert.rejects(c.window.applyVerifiedHefAddress({...address,villageCode:'16030199'},()=>true));assert.equal(calls.length,0);
 await c.window.applyVerifiedHefAddress(address,()=>true);assert.deepEqual(calls.filter(x=>x!=='options'),['16','1603','160301','16030103']);
});
