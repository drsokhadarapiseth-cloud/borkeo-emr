import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=n=>fs.readFileSync(new URL('../'+n,import.meta.url),'utf8').replace(/\r\n/g,'\n');

test('repeated language choices do not resynchronize clinical data or rewrite identical labels',()=>{
 const html=read('protected/EMR.html');const start=html.indexOf('        var languageUiInitialized = false;');const end=html.indexOf('        window.applyEmrLanguage',start);
 const calls={departments:0,fields:0,medications:0,writes:0};
 const label={getAttribute:()=> 'heading',get innerHTML(){return this.value||''},set innerHTML(v){this.value=v;calls.writes++}};
 const c=vm.createContext({currentLang:'khmer',document:{querySelectorAll:s=>s==='[data-key]'?[label]:[],getElementById:()=>null},dictionary:{khmer:{heading:'ខ្មែរ'},english:{heading:'English'}},refreshMedicationTimingLanguage(){},applyStaticFormLanguage(){},syncDepartments:()=>calls.departments++,syncFields:()=>calls.fields++,calculateAgeFromDOB(){},formatManualAgeInput(){},evaluateTriageVitalStates(){},updateCounselNote(){},refreshNursingMedicationScheduleLanguage(){},syncNursingMedicationOrders:()=>calls.medications++,scheduleNursingChartRender(){},window:{}});
 vm.runInContext(html.slice(start,end),c);
 for(const lang of ['khmer','english','english','khmer','khmer'])c.applyLanguage(lang);
 assert.deepEqual(calls,{departments:1,fields:1,medications:1,writes:3});assert.equal(label.value,'ខ្មែរ');
});

test('header-only language refresh preserves unsaved clinical forms and does not fetch payment data',()=>{
 const source=read('public/emr-inpatient-workflow.js');const start=source.indexOf('  function setPatientContext(');const end=source.indexOf('  function ensureOpdDispositionPanel',start);
 const edited={nursing:'unsaved nursing note',discharge:'unsaved discharge note',diagnosis:'new diagnosis'};const header={textContent:''};let fills=0;
 const c=vm.createContext({currentPatient:null,document:{querySelector:()=>header},text:k=>k,formatEntry:()=> '2026-10-17',localized:(a,b)=>a||b,queryOrPatient:()=> '',fillPatientIdentityForms:()=>{fills++;edited.diagnosis='saved'},fillDischargeForm:()=>{fills++;edited.discharge='saved'},applyNursingCare:()=>{fills++;edited.nursing='saved'},updateDailyGate(){},ensureOpdDispositionPanel(){},loadPaymentStatus:()=>{throw Error('Unexpected network request')}});
 vm.runInContext(source.slice(start,end),c);
 c.setPatientContext({fullName:'Synthetic patient',patientKey:'test',sex:'F',age:'10'},{labelsOnly:true});
 assert.equal(fills,0);assert.deepEqual(edited,{nursing:'unsaved nursing note',discharge:'unsaved discharge note',diagnosis:'new diagnosis'});
 assert.ok(header.textContent);
});

test('same-language selection emits no duplicate events; KH/EN round trip keeps per-page storage',()=>{
 const source=read('public/emr-language.js');const a=source.indexOf('  function setLanguage(next)');const b=source.indexOf('  window.setBorkeoLanguage',a);const events=[],stored=[];
 const c=vm.createContext({englishOnly:false,language:'kh',STORAGE_KEY:'workspace-key',sessionStorage:{setItem:(...x)=>stored.push(x)},document:{documentElement:{}},updateButtons(){},window:{dispatchEvent:e=>events.push(e)},CustomEvent:class{constructor(type,data){this.type=type;this.detail=data.detail}}});
 vm.runInContext(source.slice(a,b),c);
 for(const lang of ['kh','en','en','kh'])c.setLanguage(lang);
 assert.deepEqual(events.map(e=>e.detail.language),['en','kh']);assert.equal(stored.length,2);assert.ok(stored.every(x=>x[0]==='workspace-key'));
});

test('one legacy-button click and canonical event schedule only one label refresh and never reactivate forms',()=>{
 const source=read('public/emr-inpatient-workflow.js');const a=source.indexOf('    let languageRefreshPending = false;');const b=source.indexOf('\n  }',a);let count=0,activations=0;const timers=[],handlers={};
 const c=vm.createContext({refreshLanguage:()=>count++,activateRequestedPanel:()=>activations++,document:{getElementById:()=>({addEventListener:(type,fn)=>handlers.click=fn})},window:{setBorkeoLanguage(){},setTimeout:fn=>timers.push(fn),addEventListener:(type,fn)=>handlers[type]=fn}});
 vm.runInContext(source.slice(a,b),c);handlers.click();handlers['borkeo-language-change']();handlers['borkeo-language-change']();assert.equal(timers.length,1);timers.shift()();assert.equal(count,1);assert.equal(activations,0);
});

test('language observer resumes even if a bulk translation fails',()=>{
 const source=read('public/emr-language.js');const a=source.indexOf("  window.addEventListener('borkeo-language-change', event => {");const b=source.indexOf('  const medicalDialogActive',a);let callback,paused=0,resumed=0;
 const c=vm.createContext({window:{addEventListener:(type,fn)=>callback=fn,applyEmrLanguage:()=>{throw Error('translation failure')}},languageObserver:{disconnect:()=>paused++,observe:()=>resumed++},languageObservation:{},document:{body:{}},emrPage:true,translateParaclinicPanels(){},translateTree(){},translateInterfaceControls(){},updateButtons(){}});
 vm.runInContext(source.slice(a,b),c);assert.throws(()=>callback({detail:{language:'en'}}),/translation failure/);assert.equal(paused,1);assert.equal(resumed,1);
});

test('record label refresh never reopens a specialty form or changes care routing',()=>{
 const source=read('public/emr-patient-record.js');const a=source.indexOf('  function refreshLanguage() {');const b=source.indexOf('  function organizeOpdHeader()',a);
 const notice={dataset:{mode:'opd'},textContent:''};let routing=0;
 const c=vm.createContext({document:{querySelectorAll:()=>[],getElementById:()=>notice},t:key=>key,configureTreatmentWorkflow:()=>routing++});
 vm.runInContext(source.slice(a,b),c);c.refreshLanguage();assert.equal(routing,0);assert.equal(notice.textContent,'opdOnly');
});
