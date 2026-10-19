import assert from 'node:assert/strict';import test from 'node:test';import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';
import {createEmrServer} from '../server/server.mjs';import {projectRoot} from '../server/config.mjs';import {seedTwentyAssessedPatients} from '../scripts/seed-v194-patients.mjs';import {DEFAULT_THEME,getInterfaceTheme,INTERFACE_PRESETS} from '../server/interface-theme.mjs';
const read=n=>fs.readFileSync(path.join(projectRoot,n),'utf8');
async function fixture(run){const app=createEmrServer({demoMode:true,databasePath:':memory:',host:'127.0.0.1',port:0,appOrigin:'http://127.0.0.1:0',nodeEnv:'test'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${app.server.address().port}`;
async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:app.config.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return {Cookie,Origin:app.config.appOrigin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};}
async function call(url,headers,body){const r=await fetch(origin+url,{headers,...(body?{method:'POST',body:JSON.stringify(body)}:{})});return {status:r.status,data:await r.json().catch(()=>({}))};}
try{await run({app,db:app.database,origin,login,call})}finally{await new Promise(r=>app.server.close(r));app.database.close()}}
test('twenty demo patients have full registration/vitals, blank destinations and idempotent seeding preserving existing records',()=>fixture(async({db})=>{
const originals=db.sqlite.prepare('SELECT patient_key,record_json FROM patient_records').all();assert.equal(seedTwentyAssessedPatients(db).created,20);const rows=db.sqlite.prepare("SELECT * FROM patient_records WHERE patient_key LIKE 'case:SIM194-%'").all();assert.equal(rows.length,20);for(const p of rows){const d=JSON.parse(p.record_json);assert.equal(p.department_code,'');assert.equal(p.service_mode,'');assert.equal(d['system:triageObservationsComplete'],true);for(const f of ['web_health_id','web_phone','web_dob','web_first_name'])assert(d['scope:registration:id:'+f]);for(const f of ['p2_temp','p2_pulse','p2_spo2','p2_weight','p2_height'])assert(d['scope:triage:id:'+f]);}assert.equal(new Set(rows.map(p=>JSON.parse(p.record_json)['system:registrationQueueNumber'])).size,20);assert.equal(seedTwentyAssessedPatients(db).created,0);for(const p of originals)assert.equal(db.findPatient(p.patient_key).record_json,p.record_json);
}));
test('theme preview performs no write; all managers may apply validated settings while registration and missing CSRF cannot',()=>fixture(async({db,login,call})=>{
const initial=getInterfaceTheme(db);assert.equal(initial.primary,DEFAULT_THEME.primary);const reg=await login('registration');const theme={preset:'02'};assert.equal((await call('/api/interface-theme',reg,theme)).status,403);for(const name of ['admin','director','vice_director']){const h=await login(name);assert.equal((await call('/api/interface-theme',{...h,'X-CSRF-Token':''},theme)).status,403);assert.equal((await call('/api/interface-theme',h,{preset:'evil'})).status,400);assert.equal((await call('/api/interface-theme',h,theme)).status,200);assert.equal((await call('/api/interface-theme',{})).data.theme.primary,INTERFACE_PRESETS[1].primary);}assert.equal(db.sqlite.prepare('SELECT count(*) n FROM interface_theme').get().n,1);
const js=read('public/interface-theme.js');assert.match(js,/form\.addEventListener\('change'/);assert.match(js,/theme-cancel/);
}));
test('management menu removes EMR/TV and groups Pharmacy, Cashier and accounts without changing staff counter access',()=>{
const src=read('public/emr-session.js'),start=src.indexOf('  function allowedLinks('),end=src.indexOf('  function createPasswordDialog',start),context=vm.createContext({});vm.runInContext(src.slice(start,end)+'\nthis.links=allowedLinks;',context);
for(const activeRole of ['ADMIN','DIRECTOR','VICE_DIRECTOR']){const links=context.links({activeRole});assert(!links.some(([p])=>p==='/emr'||p.includes('display')));assert(links.some(([p])=>p==='/billing'));assert(links.some(([p])=>p==='/admin/organization'));}assert(context.links({activeRole:'TRIAGE'}).some(([p])=>p.includes('/queue-display')));assert.match(src,/label:'ផ្នែកឱសថ'/);assert.match(src,/emr-sub-nav/);assert.doesNotMatch(read('protected/home.html'),/id="admin-dashboard"/);assert.match(src,/អនុប្រធានមន្ទីរពេទ្យ/);assert.match(src,/emr-brand-eyebrow/);
});
test('OPD list preserves registration number 2 after number 1 is routed to Medicine, while consultation stays cashier gated',()=>fixture(async({db,origin,login,call})=>{
const rows=db.listPatients().slice(0,2),triage=await login('triage');for(let i=0;i<2;i++){const p=rows[i],d=JSON.parse(p.record_json);d['system:registrationQueueNumber']=String(i+1);db.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(d),p.patient_key);
const summary={caseNumber:p.case_number,healthId:p.health_id,fullName:p.full_name,firstName:p.first_name,lastName:p.last_name,sex:p.sex,age:p.age,dateOfBirth:p.date_of_birth,phone:p.phone,equityCard:p.equity_card,paymentType:'DIRECT',entryDate:p.entry_date,dischargeDate:'',serviceMode:i?'opd':'ipd',departmentCode:i?'opd':'medicine',departmentNameKh:i?'OPD':'Medicine',departmentNameEn:i?'OPD':'Medicine'};
const r=await fetch(origin+'/api/patient-record',{method:'PUT',headers:triage,body:JSON.stringify({patientKey:p.patient_key,expectedVersion:p.version,summary,data:{'scope:triage:id:p2_temp':'36.8'}})});assert.equal(r.status,200,await r.text());}
const admin=await login('admin'),queue=await call('/api/opd/queue',admin);assert.equal(queue.status,200);assert.equal(queue.data.patients.length,1);assert.equal(queue.data.patients[0].number,2);assert.equal(queue.data.patients[0].workflowStage,'CASHIER_PENDING_OPD');assert(queue.data.patients[0].phone);
db.sqlite.prepare("INSERT INTO queue_board_calls(id,service,counter,patient_key,queue_number,called_at,called_by,active) VALUES ('v194-counter-test','OPD','2',?,2,?,?,1)").run(rows[1].patient_key,Date.now(),db.findUser('doctor_opd').id);
assert.equal((await call('/api/opd/queue?counter=1',admin)).data.patients.length,1,'Management sees the waiting list across counters');
const doctor=await login('doctor_opd');assert.equal((await call('/api/opd/queue?counter=1',doctor)).data.patients.length,0,'Doctor counter isolation is preserved');

assert.doesNotMatch(read('protected/opd-queue.html'),/ពេលបញ្ជូន|late-queue-panel/);assert.match(read('public/opd-queue.js'),/esc\(item.number\)/);
}));
test('preset preview and cancel are local; only Apply writes the chosen preset',async()=>{
const domEvents=[],formEvents={},styles=new Map(),requests=[],radios=[];let current={...DEFAULT_THEME,updatedAt:0};
function element(tag){return {tag,children:[],style:{setProperty(){}},dataset:{},append(...items){this.children.push(...items);for(const item of items)if(item.name==='preset')radios.push(item)},addEventListener(){}}}
const button={disabled:false},form={addEventListener:(k,fn)=>formEvents[k]=fn,querySelectorAll:()=>radios,querySelector:selector=>selector==='[type=submit]'?button:radios.find(r=>r.checked)},status={textContent:''},cancel={},grid=element('div');
const document={hidden:false,createElement:element,documentElement:{style:{setProperty:(k,v)=>styles.set(k,v)},dataset:{}},addEventListener:(k,fn)=>domEvents.push(fn),getElementById:k=>({'interface-theme-form':form,'theme-cancel':cancel,'theme-status':status,'theme-presets':grid})[k]||null};
const context={document,setInterval(){},window:{addEventListener(){}},localStorage:{setItem(){}},fetch:async(url,options={})=>{requests.push([url,options.method||'GET']);if(url==='/api/auth/me')return {json:async()=>({csrfToken:'test'})};if(options.method==='POST')current={...INTERFACE_PRESETS.find(t=>t.preset===JSON.parse(options.body).preset),updatedAt:1};return {ok:true,json:async()=>({theme:{...current},presets:INTERFACE_PRESETS})}}};
vm.runInNewContext(read('public/interface-theme.js'),context);await new Promise(r=>setImmediate(r));for(const fn of domEvents)await fn();assert.equal(radios.length,10);
function choose(id){for(const r of radios)r.checked=r.value===id;formEvents.change()}
choose('04');assert.equal(document.documentElement.dataset.emrPreset,'04');assert.equal(current.preset,'06');assert.equal(requests.filter(x=>x[1]==='POST').length,0);
cancel.onclick();assert.equal(document.documentElement.dataset.emrPreset,'06');choose('02');await formEvents.submit({preventDefault(){}});assert.equal(current.preset,'02');assert.equal(requests.filter(x=>x[1]==='POST').length,1);
});
test('navigation settings are scoped by role and do not revoke direct access',()=>fixture(async({login,call,origin})=>{
const staff=await login('registration'),manager=await login('admin');const data={role:'REGISTRATION',order:['/patient-list','/emr','/patient-list?view=appointments'],hidden:['/patient-list']};
assert.equal((await call('/api/navigation-settings',staff,data)).status,403);
assert.equal((await call('/api/navigation-settings',{...manager,'X-CSRF-Token':''},data)).status,403);
assert.equal((await call('/api/navigation-settings',manager,{...data,hidden:['https://evil']})).status,400);
assert.equal((await call('/api/navigation-settings',manager,data)).status,200);
const result=(await call('/api/navigation-settings',staff)).data;assert.deepEqual(result.settings.REGISTRATION.hidden,['/patient-list']);assert.equal(result.settings.REGISTRATION.order[0],'/patient-list');assert.equal(result.settings.DOCTOR,undefined);
assert.equal((await fetch(origin+'/patient-list',{headers:staff})).status,200);
for(const role of ['DIRECTOR','VICE_DIRECTOR']){const account=await login(role.toLowerCase());assert.equal((await call('/api/navigation-settings',account,{role,order:[],hidden:['/admin/interface']})).status,200);assert(!((await call('/api/navigation-settings',account)).data.settings[role].hidden.includes('/admin/interface')))}
}));
test('old color settings resolve to preset 06 without deleting the old settings',()=>fixture(async({db})=>{
const old=JSON.stringify({primary:'#123456',style:'classic'});db.sqlite.prepare("INSERT INTO interface_theme VALUES ('default',?,NULL,?)").run(old,1);assert.equal(getInterfaceTheme(db).preset,'06');assert.equal(db.sqlite.prepare('SELECT settings_json FROM interface_theme').get().settings_json,old);
}));
