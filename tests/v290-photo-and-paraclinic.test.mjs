import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createEmrServer} from '../server/server.mjs';
import {validPatientPhoto, MAX_PATIENT_PHOTO_CHARS} from '../server/patient-photo.mjs';

const jpeg = 'data:image/jpeg;base64,' + Buffer.concat([Buffer.from([255,216,255,224]),Buffer.alloc(30_000, 42)]).toString('base64');
test('bounded photo validator accepts large camera JPEG and legacy PNG/WebP, rejects unsafe or oversized values', () => {
  assert.ok(jpeg.length > 20_000);
  assert.equal(validPatientPhoto(jpeg), true);
  assert.equal(validPatientPhoto(''), true);
  assert.equal(validPatientPhoto('data:image/png;base64,' + Buffer.from([137,80,78,71,13,10,26,10]).toString('base64')), true);
  assert.equal(validPatientPhoto('data:image/webp;base64,' + Buffer.from('RIFF0000WEBP').toString('base64')), true);
  for (const bad of ['https://example.com/photo.jpg','data:image/svg+xml;base64,PHN2Zz4=','data:image/jpeg;base64,aGVsbG8=','data:image/jpeg;base64,!!!!', jpeg+'\0',true,null,'data:image/jpeg;base64,'+'A'.repeat(MAX_PATIENT_PHOTO_CHARS)]) assert.equal(validPatientPhoto(bad), false);
});

test('photo upload saves, triage referral and subsequent ward transfer preserve the photo', async () => {
  const origin = 'http://127.0.0.1:32690';
  const app = createEmrServer({demoMode:true,host:'127.0.0.1',port:32690,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  await new Promise(resolve => app.server.listen(32690,'127.0.0.1',resolve));
  try {
    async function login(username) {
      const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      assert.equal(r.status,200,await r.clone().text());
      const Cookie=r.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    }
    const registration=await login('registration'),triage=await login('triage'),admin=await login('admin');
    const patientKey='case:PHOTO290';
    const summary={caseNumber:'PHOTO290',healthId:'PHOTO290',fullName:'Synthetic Photo Patient',sex:'ប្រុស',age:'35',entryDate:new Date().toISOString().slice(0,10),departmentCode:'',serviceMode:''};
    const photoData={'scope:registration:id:web_patient_photo':jpeg,'scope:registration:id:patient_photo':jpeg,'system:patientPhoto':jpeg};
    const request=(url,method,headers,body)=>fetch(origin+url,{method,headers,body:JSON.stringify(body)});
    const saved=await request('/api/patient-record','PUT',registration,{patientKey,summary,data:{...photoData,'scope:registration:id:emr_pmrs_case_new':true}});
    assert.equal(saved.status,200,await saved.clone().text());assert.equal((await saved.json()).patient.photo,jpeg);
    const referred=await request('/api/patient-record','PUT',triage,{patientKey,summary:{...summary,departmentCode:'medicine',serviceMode:'ipd'},data:{...photoData,'scope:triage:id:p2_temp':'37','scope:triage:id:p2_bp_sys':'120','scope:triage:id:p2_bp_dia':'80','scope:triage:id:p2_pulse':'80','scope:triage:id:p2_resp':'18','scope:triage:id:p2_spo2':'98','scope:triage:id:p2_weight':'60','scope:triage:id:p2_height':'165'}});
    assert.equal(referred.status,200,await referred.clone().text());
    const transferred=await request('/api/patient-admission','PATCH',admin,{patientKey,action:'transfer',departmentCode:'surgery',departmentNameKh:'វះកាត់',departmentNameEn:'Surgery'});
    assert.equal(transferred.status,200,await transferred.clone().text());
    const stored=JSON.parse(app.database.findPatient(patientKey).record_json);
    assert.equal(stored['scope:registration:id:web_patient_photo'],jpeg);
    const imaging = await login('imaging');
    const scheduledAt=Date.now()+3_600_000;
    const ordered=await request('/api/paraclinic/orders','POST',admin,{patientKey,modality:'XRAY',priority:'URGENT',request:{examination:'Chest',clinicalIndication:'Synthetic scheduling test',preferredAppointmentLocal:'2026-10-12T09:00'}});
    assert.equal(ordered.status,201,await ordered.clone().text());const imagingOrder=(await ordered.json()).order;
    const booked=await request(`/api/paraclinic/orders/${imagingOrder.id}`,'PATCH',imaging,{status:'SCHEDULED',scheduledAt});
    assert.equal(booked.status,200,await booked.clone().text());assert.equal((await booked.json()).order.scheduledAt,scheduledAt);
    const beforeRelease=app.database.findPatient(patientKey).record_json;
    const labOrderResponse=await request('/api/paraclinic/orders','POST',admin,{patientKey,modality:'LAB',priority:'ROUTINE',request:{items:[{code:'HGB'}]}});
    assert.equal(labOrderResponse.status,201,await labOrderResponse.clone().text());const labOrder=(await labOrderResponse.json()).order;
    const released=await request(`/api/paraclinic/orders/${labOrder.id}`,'PATCH',admin,{status:'PROCESSING',release:true,result:{items:[{code:'HGB',value:13.2,unit:'g/dL'}]}});
    assert.equal(released.status,200,await released.clone().text());const releasedData=await released.json();
    assert.equal(releasedData.investigationText,'');assert.equal(releasedData.order.result.items.find(item=>item.code==='HGB').value,13.2);
    assert.equal(JSON.parse(app.database.findPatient(patientKey).record_json)['scope:medical:id:ipd_investigations'],JSON.parse(beforeRelease)['scope:medical:id:ipd_investigations']);
    const bad=await request('/api/patient-record','PUT',registration,{patientKey:'case:PHOTO290-BAD',summary:{...summary,caseNumber:'PHOTO290-BAD'},data:{'scope:registration:id:web_patient_photo':'data:image/svg+xml;base64,PHN2Zz4='}});
    assert.equal(bad.status,400);
    const longText=await request('/api/patient-record','PUT',registration,{patientKey:'case:PHOTO290-TEXT',summary:{...summary,caseNumber:'PHOTO290-TEXT'},data:{'scope:registration:id:web_phone':'x'.repeat(20_001)}});
    assert.equal(longText.status,400,'ordinary text limit remains unchanged');
  } finally { await new Promise(resolve=>app.server.close(resolve));app.database.close(); }
});

const source=fs.readFileSync(new URL('../public/paraclinic.js',import.meta.url),'utf8');
function functions() {
  const ctx={Date,Set,Map,catalog:[{code:'HGB',name:'Hemoglobin',category:'Hematology'}]};
  let start=source.indexOf('  function pendingOrder('),end=source.indexOf('  function setPatient(',start);
  // Extract helper functions by the next function boundary; esc is an arrow.
  let code=source.slice(source.indexOf('  const esc ='),source.indexOf('  const SHORT_LABEL_CODES'));
  code+=source.slice(source.indexOf('  const SHORT_LABEL_CODES'),source.indexOf('  function isWardNursingRole'));
  for (const name of ['modalityLabel','categoryLabel','groupLabItems','labRequestName']) {
    const i=source.indexOf('  function '+name+'('),j=source.indexOf('\n  ',source.indexOf('\n  }',i)+5);
    code+=source.slice(i,j);
  }
  vm.runInNewContext(code+source.slice(start,end)+'\nthis.pendingOrder=pendingOrder;this.appointmentLabel=appointmentLabel;this.pendingBanner=pendingBanner;',ctx);
  return ctx;
}
test('pending banner distinguishes pending, cancelled and completed tests and includes confirmed Imaging appointment', () => {
  const ctx=functions();
  const order={modality:'XRAY',status:'SCHEDULED',scheduledAt:Date.UTC(2026,9,12,2),request:{examination:'Chest'},result:{findings:'MUST NOT ENTER REQUEST'}};
  assert.equal(ctx.pendingOrder(order),true);
  assert.match(ctx.appointmentLabel(order),/Appointment/);
  assert.match(ctx.pendingBanner([order]),/Chest/);
  assert.doesNotMatch(ctx.pendingBanner([order]),/MUST NOT ENTER REQUEST/);
  assert.equal(ctx.pendingOrder({...order,status:'CANCELLED'}),false);
  assert.equal(ctx.pendingOrder({...order,releasedAt:Date.now()}),false);
  assert.match(ctx.appointmentLabel({...order,scheduledAt:null,request:{preferredAppointmentLocal:'2026-10-12T09:00'}}),/not confirmed/);
});

test('Paraclinic setup adds inline controls without wrapping or moving the medical form', () => {
  const setup=source.slice(source.indexOf('  function setup()'),source.indexOf('  async function openRequestChooser'));
  assert.doesNotMatch(setup,/paraclinic-split|paraclinic-panel|while \(host.firstChild\)/);
  assert.match(setup,/insertAdjacentElement\('afterend', panel\)/);
  assert.match(source,/data-branch="lab"/);assert.match(source,/data-branch="imaging"/);
  assert.doesNotMatch(source,/value="\$\{esc\(latestLabValue/);
});


test('request chooser renders Laboratory and all grouped Imaging procedures', async () => {
  const ctx=functions();let markup='';
  ctx.patient={patientKey:'case:CHOOSER290'};ctx.refresh=async()=>{};ctx.alert=message=>{throw Error(message)};
  ctx.modal=(title,body)=>{markup=body;return {body:{querySelectorAll:()=>[]},close(){}}};
  const start=source.indexOf('  async function openRequestChooser('),end=source.indexOf('  function pendingOrder(',start);
  vm.runInNewContext(source.slice(start,end)+'\nthis.choose=openRequestChooser;',ctx);
  await ctx.choose('ipd');
  for (const code of ['LAB','XRAY','ULTRASOUND','CT','MRI','ECG','EEG','ECHOCARDIOLOGY','FIBROSCOPY','COLOSCOPY','OTOSCOPY','RHINOSCOPY','LARYNGOSCOPY','BRONCHOSCOPY']) assert.ok(markup.includes(`data-order="${code}"`),code);
  assert.match(markup,/data-branch="lab"/);assert.match(markup,/data-branch="imaging"/);
});
