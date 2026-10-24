import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.mjs';
import { ensureNpcaSchema } from '../server/npca/storage.mjs';
import { buildVisitPayload, npcaTime } from '../server/npca/visit-builder.mjs';
import { validateVisitPayload } from '../server/npca/validation.mjs';
import { codeValues, setCodeOverride, formDefinitions, referenceSheets, mapCode } from '../server/npca/codes.mjs';
import { syntheticVisit, syntheticValidation } from './helpers/npca-fixtures.mjs';
import { startNpcaMock } from './helpers/npca-mock.mjs';
import { npcaSettings, publicSettings } from '../server/npca/settings.mjs';
import { NpcaClient } from '../server/npca/client.mjs';
import { NpcaIntegration } from '../server/npca/integration.mjs';
import { searchBeneficiaries,selectionFor,saveBeneficiaryLink,beneficiaryPayment } from '../server/npca/beneficiaries.mjs';
import { sourceForPatient } from '../server/npca/source.mjs';
import { createEmrServer } from '../server/server.mjs';

const mockSettings=mock=>npcaSettings({enabled:true,baseUrl:mock.url,localMock:true,clientId:'MOCK-CLIENT',clientSecret:'MOCK-CLIENT-SECRET',username:'MOCK-USER',password:'MOCK-PASSWORD',systemCode:'MOCK-SYSTEM',facilityCode:'MOCK-FACILITY',timeoutMs:1000,pollHours:8},{});

function database(){const db=openDatabase(':memory:');ensureNpcaSchema(db);for(const [id,role]of [['synthetic-clerk','REGISTRATION'],['synthetic-admin','ADMIN'],['synthetic-cashier','CLERK'],['synthetic-accountant','ACCOUNTANT']])db.createUser({id,username:id,displayName:id,role,passwordHash:'synthetic-unused-hash',createdAt:Date.now()});setCodeOverride(db,'service','SYNTHETIC_SERVICE','MOCK-SERVICE','synthetic-admin');return db;}
const config={facilityCode:'MOCK-FACILITY',sendForms:true};
test('NPCA workbook lists and every form value set map only to official values',()=>{
  for(const category of ['sex','marital','visit','admission','discharge','outcome','payment','diagnosis','nationality','history','physical','vital']){
    assert.ok(codeValues(category).length,category);for(const code of codeValues(category))assert.equal(mapCode(category,code),code);
  }
  for(const [set,code]of referenceSheets['Form Values'].slice(1))assert.equal(mapCode('form:'+set,code),code);
  assert.equal(codeValues('history').length,9);assert.equal(codeValues('physical').length,11);assert.equal(formDefinitions.size,7);
  assert.equal(mapCode('payment','NGO'),null);assert.equal(mapCode('nationality','not-a-country'),null);
});
for(const mode of ['opd','ipd'])test('NPCA synthetic '+mode+' payload follows Excel with stable codes, triage links, dispense, and Cambodia times',()=>{
  const db=database();try{
    const source=syntheticVisit(mode),built=buildVisitPayload(source,config,db);
    assert.deepEqual(built.issues,[]);assert.deepEqual(validateVisitPayload(built.payload,syntheticValidation),[]);
    assert.equal(buildVisitPayload(source,config,db).visitCode,built.visitCode);
    const v=built.payload.visits[0];assert.equal(v.triages.length,1);assert.equal(v.vital_signs[0].encounter_code,v.triages[0].code);
    assert.equal(v.prescriptions[0].encounter_code===null,mode==='opd');assert.equal(v.prescriptions[0].medications[0].dispense.quantity,6);
    assert.ok(v.admitted_at.endsWith('+07:00'));assert.equal(v.patient.address.village.code,'16030104');
    v.prescriptions[0].medications[0].code='';delete v.prescriptions[0].medications[0].dispense;
    const errors=validateVisitPayload(built.payload,syntheticValidation);assert.ok(errors.some(e=>e.code==='cms'));assert.ok(errors.some(e=>e.code==='dispense'));
  }finally{db.close();}
});
test('NPCA forms use Excel ANC and child codes; forms can be disabled',()=>{
  const db=database();try{const s=syntheticVisit();s.forms=[{encounterId:'initial-opd',form_code:'ENTY-000H014',form_data:{pregnancy_number_of_pregnancies:2,pregnancy_age:26,uterine_height_cm:26,fetal_heart_rate:140,pregnancy_last_menstrual_period_date:'2026-04-24'}}];
    const b=buildVisitPayload(s,config,db);assert.deepEqual(validateVisitPayload(b.payload,syntheticValidation),[]);assert.ok(formDefinitions.has('ENTY-00000A9M'));
    assert.equal(buildVisitPayload(s,{...config,sendForms:false},db).payload.visits[0].forms,undefined);
  }finally{db.close();}
});
test('NPCA times do not depend on the computer timezone',()=>{
  assert.equal(npcaTime('2026-10-23T08:30'),'2026-10-23T08:30:00.000+07:00');
  assert.equal(npcaTime('2026-10-23T01:30:00Z'),'2026-10-23T08:30:00.000+07:00');assert.equal(npcaTime('invalid'),null);
});
test('NPCA tokens are cached, refreshed after 401, and never exposed by settings or audit',async()=>{
  const mock=await startNpcaMock(),db=database();try{
    const settings=mockSettings(mock),client=new NpcaClient(settings,db);
    await client.request('search',{card_number:'MOCK-CARD'});await client.request('search',{card_number:'MOCK-CARD'});assert.equal(mock.state.tokens,1);
    mock.state.expiredOnce=true;await client.request('search',{card_number:'MOCK-CARD'});assert.equal(mock.state.tokens,2);assert.equal(mock.state.refreshes,1);
    mock.state.alwaysUnauthorized=true;await assert.rejects(client.request('search',{card_number:'MOCK-CARD'}),e=>e.httpStatus===401);assert.equal(mock.state.tokens,3);
    const audit=JSON.stringify(db.sqlite.prepare('SELECT * FROM audit_events').all()),visible=JSON.stringify(publicSettings(settings));
    for(const secret of ['MOCK-PASSWORD','MOCK-CLIENT-SECRET','MOCK-TOKEN-','MOCK-REFRESH-']){assert.ok(!audit.includes(secret));assert.ok(!visible.includes(secret));}
    assert.ok(audit.includes('NPCA_TOKEN_REQUEST'));assert.ok(audit.includes('NPCA_BENEFICIARY_SEARCH'));
  }finally{db.close();await mock.close();}
});
test('NPCA beneficiary SPID is saved only from a recent server selection and an eligible card',async()=>{
  const mock=await startNpcaMock(),db=database();try{
    const client=new NpcaClient(mockSettings(mock),db),rows=await searchBeneficiaries(client,db,'synthetic-clerk','MOCK-CARD');assert.equal(rows[0].eligible,true);
    const person=selectionFor(db,rows[0].selectionId,'synthetic-clerk');saveBeneficiaryLink(db,'case:synthetic',person,beneficiaryPayment(person),'synthetic-clerk');
    const link=db.sqlite.prepare('SELECT * FROM npca_patient_links').get();assert.equal(link.spid,'MOCK-SPID');assert.equal(link.payment_type,'PATY-0000N09');
    assert.throws(()=>selectionFor(db,rows[0].selectionId,'another-clerk'));
    mock.state.beneficiaries[0].eligible=false;const ineligible=await searchBeneficiaries(client,db,'synthetic-clerk','MOCK-CARD');assert.equal(ineligible[0].eligible,false);assert.throws(()=>selectionFor(db,ineligible[0].selectionId,'synthetic-clerk'));
  }finally{db.close();await mock.close();}
});
test('NPCA disabled sends nothing, and HTTP is restricted to the explicitly configured loopback mock',async()=>{
  const db=database();let calls=0;try{
    const client=new NpcaClient(npcaSettings({},{}),db,{fetchImpl:async()=>{calls++;throw Error('must not call');}});
    await assert.rejects(client.request('search',{}),e=>e.code==='disabled');assert.equal(calls,0);
    assert.throws(()=>npcaSettings({baseUrl:'http://example.com'},{}));assert.throws(()=>npcaSettings({baseUrl:'http://127.0.0.1'},{}));assert.throws(()=>npcaSettings({baseUrl:'http://example.com',localMock:true},{}));
    assert.equal(npcaSettings({},{}).sendForms,true);assert.equal(npcaSettings({},{}).pollHours,8);
  }finally{db.close();}
});
function queueFixture(mock,{mode='opd'}={}){
  const db=database();let source=syntheticVisit(mode),now=Date.parse('2026-10-23T05:00:00Z');source.link.payment_type='PATY-0000N09';
  const patientKey=source.patient.patientKey;
  // Integration accepts a source adapter dependency for synthetic testing;
  // no patient file or external address is used.
  db.findPatient=key=>key===patientKey?{patient_key:patientKey,version:1}:null;
  const manager=new NpcaIntegration(mockSettings(mock),db,{sourceFactory:()=>source,validationOptions:syntheticValidation,clock:()=>now});
  return {db,manager,patientKey,get source(){return source;},set source(v){source=v;},advance:ms=>{now+=ms;},close(){manager.stop();db.close();}};
}
test('NPCA queue survives offline errors, reconciles, retries the same visit, and stops polling Ready',async()=>{
  const mock=await startNpcaMock(),f=queueFixture(mock);try{
    const first=f.manager.enqueue(f.patientKey,'synthetic-cashier');assert.equal(first.queued,true);mock.state.offline=true;await f.manager.tick();
    assert.equal(f.db.sqlite.prepare('SELECT queue_state FROM npca_submissions').get().queue_state,'reconcile');
    mock.state.offline=false;f.advance(120000);await f.manager.tick();assert.equal(f.db.sqlite.prepare('SELECT queue_state FROM npca_submissions').get().queue_state,'retry');
    f.advance(120000);await f.manager.tick();assert.equal(mock.state.submissions.length,1);assert.equal(mock.state.submissions[0].visits[0].code,first.visitCode);
    f.advance(9*3600000);await f.manager.tick();assert.equal(f.db.sqlite.prepare('SELECT status FROM npca_submissions').get().status,1);
    const polls=mock.state.polls;f.advance(9*3600000);await f.manager.tick();assert.equal(mock.state.polls,polls);assert.throws(()=>f.manager.enqueue(f.patientKey,'synthetic-cashier'));
  }finally{f.close();await mock.close();}
});
test('NPCA Failed stops polling; correction and resubmission retain the visit code',async()=>{
  const mock=await startNpcaMock(),f=queueFixture(mock);try{
    const first=f.manager.enqueue(f.patientKey,'synthetic-accountant');await f.manager.tick();mock.state.finalStatus=2;f.advance(9*3600000);await f.manager.tick();
    assert.equal(f.db.sqlite.prepare('SELECT status FROM npca_submissions').get().status,2);const polls=mock.state.polls;f.advance(9*3600000);await f.manager.tick();assert.equal(mock.state.polls,polls);
    assert.throws(()=>f.manager.enqueue(f.patientKey,'synthetic-accountant'));f.source.updatedAt='2026-10-23T11:00';f.source.patient.phone='012345679';
    const second=f.manager.enqueue(f.patientKey,'synthetic-accountant');assert.equal(second.visitCode,first.visitCode);await f.manager.tick();assert.equal(mock.state.submissions.length,2);
  }finally{f.close();await mock.close();}
});
test('NPCA HEF poor admission is Pending and discharge updates the same visit',async()=>{
  const mock=await startNpcaMock(),f=queueFixture(mock,{mode:'ipd'});try{
    f.source.completed=false;const first=f.manager.enqueue(f.patientKey,'synthetic-cashier');assert.equal(first.queued,true);await f.manager.tick();assert.equal(f.db.sqlite.prepare('SELECT status FROM npca_submissions').get().status,3);
    f.source.completed=true;f.source.updatedAt='2026-10-23T11:00';assert.equal(f.manager.enqueue(f.patientKey,'synthetic-cashier').visitCode,first.visitCode);await f.manager.tick();assert.equal(f.db.sqlite.prepare('SELECT status FROM npca_submissions').get().status,5);
  }finally{f.close();await mock.close();}
});
test('NPCA missing CMS or dispense never enters the network queue',async()=>{
  const mock=await startNpcaMock(),f=queueFixture(mock);try{
    delete f.source.prescriptions[0].medications[0].cmsCode;delete f.source.prescriptions[0].medications[0].dispense;
    const result=f.manager.enqueue(f.patientKey,'synthetic-cashier');assert.equal(result.queued,false);await f.manager.tick();assert.equal(mock.state.requests.length,0);assert.equal(f.db.sqlite.prepare('SELECT COUNT(*) n FROM npca_submissions').get().n,0);
  }finally{f.close();await mock.close();}
});
for(const status of [400,403,422,500])test('NPCA HTTP '+status+' is stored safely with the correct retry policy',async()=>{
  const mock=await startNpcaMock(),f=queueFixture(mock);try{
    await f.manager.client.getToken();mock.state.failNext=status;f.manager.enqueue(f.patientKey,'synthetic-cashier');await f.manager.tick();
    const row=f.db.sqlite.prepare('SELECT * FROM npca_submissions').get();assert.equal(row.last_http,status);assert.equal(row.queue_state,status===500?'reconcile':'blocked');if(status===422)assert.match(row.errors,/The visits.0.code field is required/);
  }finally{f.close();await mock.close();}
});
test('NPCA OPD-to-IPD, progress, emergency, surgery and referral links retain their distinct encounter codes',()=>{
  const db=database();try{
    const source=syntheticVisit('ipd'),opd=syntheticVisit('opd').outpatients[0];source.outpatients.push(opd);
    source.progress_notes=[{id:'day-1',encounterId:'initial-ipd',started_at:'2026-10-23T09:00',ended_at:'2026-10-23T09:10',encountered_by:'Synthetic doctor',title:'DOCTOR'}];
    source.soaps.push({id:'progress',encounterId:'day-1',subjective:'Synthetic',objective:'Synthetic',assessment:'Synthetic',plan:'Synthetic',recorded_at:'2026-10-23T09:10',recorded_by:'Synthetic doctor',title:'DOCTOR'},...syntheticVisit('opd').soaps);
    source.dailyVitals=[{encounterId:'day-1',recorded_at:'2026-10-23T09:00',recorded_by:'Synthetic doctor',title:'DOCTOR',observations:[{name:'Temperature',value:37}]}];
    source.emergencies=[{...opd,id:'emergency',emergency_notes:'Synthetic emergency note'}];
    source.surgeries=[{id:'operation',encounterId:'initial-ipd',is_new:true,theater_name:'Synthetic theater',service_type:'Synthetic surgery',started_at:'2026-10-23T09:00',ended_at:'2026-10-23T09:30',reason:'Synthetic indication',anesthesia_type:'Synthetic anesthetic',procedure_notes:'Synthetic procedure',pre_operative_diagnosis:'Synthetic diagnosis',post_operative_diagnosis:'Synthetic diagnosis',surgeon_name:'Synthetic surgeon',anesthetist_name:'Synthetic anesthetist',assistant_names:['Synthetic assistant'],type_of_surgery:'Routine',anesthetist_assistant_name:['Synthetic assistant'],surgical_technique:'Synthetic technique',surgical_approach:'Synthetic approach'}];
    source.dischargeType='Refer Out';source.referral={referred_to:{referral_number:'MOCK-REFERRAL',transportation:'Synthetic ambulance',reason:'Synthetic referral',health_facility:{name:'Synthetic CPA3',code:'MOCK-CPA3',type:'CPA3'},referred_by:'Synthetic doctor',referred_by_phone:'012345678',referred_at:'2026-10-23T10:00',document_file:'https://example.invalid/synthetic-only'}};
    const built=buildVisitPayload(source,config,db);assert.deepEqual(validateVisitPayload(built.payload,syntheticValidation),[]);
    const v=built.payload.visits[0];assert.notEqual(v.outpatients[0].code,v.inpatients[0].code);assert.equal(v.progress_notes[0].encounter_code,v.inpatients[0].code);assert.equal(v.vital_signs[1].encounter_code,v.progress_notes[0].code);assert.equal(v.referral.referred_to.health_facility.code,'MOCK-CPA3');
    v.referral.referred_to.health_facility.code='';assert.ok(validateVisitPayload(built.payload,syntheticValidation).some(e=>e.field.endsWith('health_facility.code')));
  }finally{db.close();}
});
test('NPCA endpoints enforce roles, CSRF and selection identity; actual chart adapter produces correction problems safely',async()=>{
  const mock=await startNpcaMock();const app=createEmrServer({demoMode:true,databasePath:':memory:',host:'127.0.0.1',port:0,appOrigin:'http://127.0.0.1:0',nodeEnv:'test',npca:mockSettings(mock)});
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+app.server.address().port;
  async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:app.config.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200,username);const Cookie=r.headers.get('set-cookie').split(';')[0];const me=await fetch(origin+'/api/auth/me',{headers:{Cookie}}).then(r=>r.json());return {Cookie,Origin:app.config.appOrigin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};}
  async function call(headers,path,body,method='POST'){const r=await fetch(origin+path,{method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,body:await r.json().catch(()=>({}))};}
  try{
    const registration=await login('registration'),clerk=await login('clerk'),director=await login('director'),admin=await login('admin'),doctor=await login('doctor_opd');
    assert.equal((await call(director,'/api/npca/test',{})).status,403);assert.equal((await call(doctor,'/api/npca/submissions',undefined,'GET')).status,403);
    assert.equal((await call({...clerk,'X-CSRF-Token':''},'/api/npca/submit',{patientKey:'case:synthetic'})).status,403);
    const search=await call(registration,'/api/npca/beneficiaries',{cardNumber:'MOCK-CARD'});assert.equal(search.status,200);
    const token=search.body.beneficiaries[0].selectionId;
    const patientKey='case:MOCK-NPCA',summary={caseNumber:'MOCK-NPCA',healthId:'MOCK-HEALTH-ID',firstName:'Patient',lastName:'Synthetic',fullName:'Synthetic Patient',sex:'F',age:'36',dateOfBirth:'1990-01-01',phone:'012345678',equityCard:'MOCK-CARD',paymentType:'HEF_POOR',serviceMode:'',departmentCode:'',entryDate:'2026-10-23'};
    const saved=await call(registration,'/api/patient-record',{patientKey,summary,data:{'scope:registration:id:npca_selection':token,'scope:registration:id:emr_pmrs_case_new':true}},'PUT');assert.equal(saved.status,200,JSON.stringify(saved.body));
    assert.equal(saved.body.patient.data['system:npcaSpid'],'MOCK-SPID');
    assert.equal((await call(clerk,'/api/npca/badge?patientKey='+encodeURIComponent(patientKey),undefined,'GET')).status,200);
    const row=app.database.findPatient(patientKey),source=sourceForPatient(app.database,row);assert.equal(source.link.spid,'MOCK-SPID');
    const prescriptionRow={...row,service_mode:'opd',record_json:JSON.stringify({...JSON.parse(row.record_json),'system:opdMedications':JSON.stringify([{name:'Synthetic medicine',cmsCode:'AA0410',scheduleType:'qh',qHours:'6',doseAmount:'1',unit:'tablet',route:'po',d:'2',total:'8'}])})};
    assert.equal(sourceForPatient(app.database,prescriptionRow).prescriptions[0].medications[0].interval,'6h');
    const review=await call(clerk,'/api/npca/review?patientKey='+encodeURIComponent(patientKey),undefined,'GET');assert.equal(review.status,200,JSON.stringify(review.body));assert.ok(review.body.errors.length>0);
    const blocked=await call(clerk,'/api/npca/submit',{patientKey});assert.equal(blocked.status,422);assert.equal(mock.state.submissions.length,0);
    assert.equal((await call(director,'/api/npca/submit',{patientKey})).status,403);
    assert.equal((await call(admin,'/api/npca/test',{})).status,200);
    const publicConfig=await call(admin,'/api/npca/settings',undefined,'GET');assert.equal(publicConfig.status,200);assert.ok(!JSON.stringify(publicConfig).includes('MOCK-PASSWORD'));
    const denied=await fetch(origin+'/npca',{headers:doctor});assert.equal(denied.status,403);
    mock.state.beneficiaries=[];
    assert.equal((await call(registration,'/api/npca/beneficiaries',{cardNumber:'MOCK-CARD',patientKey})).status,200);
    assert.equal(app.database.sqlite.prepare('SELECT eligible FROM npca_patient_links WHERE patient_key=?').get(patientKey).eligible,0);
    for(const file of ['npca.js','npca-widget.js','npca-registration.js','npca.css'])assert.equal((await fetch(origin+'/public/'+file)).status,200,file);
  }finally{await new Promise(resolve=>app.server.close(resolve));app.database.close();await mock.close();}
});
