import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('OPD print reads the current form without saving, signing or completing messages, for any viewing role',async()=>{
  const source=read('public/emr-patient-record.js');
  const start=source.indexOf('  let printingOpd = false;'),end=source.indexOf('\n  async function loadPatientRecord',start);
  const steps=[];let finish;
  const context=vm.createContext({window:{emrSession:{user:{activeRole:'NURSE'}}},
    loadCurrentSessionSignature:()=>{throw new Error('Printing must not sign');},savePatientRecord:()=>{throw new Error('Printing must not save');}});
  vm.runInContext(source.slice(start,end),context);
  const first=context.printSignedOpd(()=>{steps.push('preview');return new Promise(resolve=>{finish=resolve;});});
  await context.printSignedOpd(()=>steps.push('duplicate'));
  assert.deepEqual(steps,['preview']);finish();await first;
  await context.printSignedOpd(()=>steps.push('another preview'));
  assert.deepEqual(steps,['preview','another preview']);
});

test('OPD/IPD select report layouts and all clinical and finance pages load the common preview',async()=>{
  const html=read('protected/EMR.html'),calls=[];
  const context=vm.createContext({window:{printEmrReport:async options=>calls.push(options)},populateRxPrintData(){},prepareMedicationRowsForPrint(){},clearMedicationPrintRowState(){},populateOpdDoctorPrintSignature(){}});
  for(const name of ['printTriageOpdRx','printIpdRecord']){
    const start=html.indexOf('        function '+name+'('),end=html.indexOf('\n        }',start)+10;
    vm.runInContext(html.slice(start,end),context);await context[name]();
  }
  assert.deepEqual(Array.from(calls[0].selectors),['#sub_opd']);
  assert.deepEqual(Array.from(calls[1].selectors),['#sub_ipd','#print-rx-layout']);
  for(const kind of ['lab','imaging','billing','finance','ward-medicines']){
    assert.match(read(`protected/${kind}.html`),/\/public\/report-print.js/);
    assert.doesNotMatch(read(`public/${kind}.js`),/window\.print\(\)|popup\.print\(\)/);
  }
});

test('legacy unpaid Triage referrals appear in pending admissions, excluding incomplete, discharged and assigned patients',()=>{
  const source=read('public/departments.js');const start=source.indexOf('  function pendingPatients()'),end=source.indexOf('\n  function pendingPatientCard',start);
  const patients=[
    {patientKey:'new',serviceMode:'ipd',triageStatus:'COMPLETED',workflowStage:'WARD_WAITING',departmentCode:'medicine'},
    {patientKey:'old',serviceMode:'ipd',triageStatus:'COMPLETED',workflowStage:'CASHIER_PENDING_IPD',departmentCode:'medicine'},
    {patientKey:'incomplete',serviceMode:'ipd',triageStatus:'WAITING',workflowStage:'TRIAGE_WAITING',departmentCode:'medicine'},
    {patientKey:'discharged',serviceMode:'ipd',admissionStatus:'discharged',triageStatus:'COMPLETED',workflowStage:'WARD_WAITING',departmentCode:'medicine'},
    {patientKey:'assigned',serviceMode:'ipd',triageStatus:'COMPLETED',workflowStage:'WARD_WAITING',departmentCode:'medicine'},
    {patientKey:'other-ward',serviceMode:'ipd',triageStatus:'COMPLETED',workflowStage:'WARD_WAITING',departmentCode:'pediatric'},
  ];
  const context=vm.createContext({patients,selectedWard:'medicine',assignedPatientKeys:()=>new Set(['assigned']),activePatient:p=>p.serviceMode==='ipd'&&p.admissionStatus!=='discharged'});
  vm.runInContext(source.slice(start,end),context);
  assert.deepEqual(Array.from(context.pendingPatients(),p=>p.patientKey),['new','old']);
});
