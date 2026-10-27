import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source=fs.readFileSync(new URL('../public/emr-encounter-editor.js',import.meta.url),'utf8');
const fn=source.slice(source.indexOf('  function isDirectEditAllowed()'),source.indexOf('  let access ='));
test('OPD opens for direct writing only after access and payment checks, including the normal View link',()=>{
  for(const scenario of [
    {name:'default paid',stage:'DOCTOR_READY',allowed:true},
    {name:'view link paid',stage:'IN_CONSULTATION',mode:'view',allowed:true},
    {name:'access pending',stage:'DOCTOR_READY',access:null,allowed:false},
    {name:'closed or wrong ward',stage:'DOCTOR_READY',access:{canEdit:false},allowed:false},
    {name:'cashier pending',stage:'CASHIER_PENDING_OPD',allowed:false},
    {name:'paraclinic ordering',stage:'OPD_PARACLINIC_ORDERING',allowed:false},
    {name:'historical report',stage:'DOCTOR_READY',report:'opd',allowed:false},
    {name:'medical view stays read only',stage:'DOCTOR_READY',view:'medical',mode:'view',allowed:false},
  ]){
    const context={query:new URLSearchParams(scenario.mode?{mode:scenario.mode}:{}),report:scenario.report||'',explicitView:scenario.mode==='view',existing:true,view:()=>scenario.view||'opd',role:()=> 'DOCTOR',manager:()=>false,access:Object.hasOwn(scenario,'access')?scenario.access:{canEdit:true},window:{getLoadedEmrPatient:()=>({workflowStage:scenario.stage})}};
    vm.runInNewContext(fn+'\nthis.result=isDirectEditAllowed();',context);
    assert.equal(context.result,scenario.allowed,scenario.name);
  }
});
