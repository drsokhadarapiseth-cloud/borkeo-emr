import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const html=fs.readFileSync(new URL('../protected/EMR.html',import.meta.url),'utf8');
const context=vm.createContext({currentLang:'english'});
// Exercise the functions from the actual served form.
for(const name of ['normalizeNursingCellText','getMedicationTimingDetailRow','getMedicationRowPrefix','getMedicationScheduleType','getMedicationDoseAmount','getMedicationDailyFrequency','calculateMedicationQuickTotal','getMedicationTimingData','serializeMedicationProtocolIntervals','parseMedicationIntervalItems','isDedicatedProtocolMedication']) {
  const start=html.indexOf('        function '+name+'(');
  assert(start>=0,name);
  const end=html.indexOf('\n        }',start)+10;
  vm.runInContext(html.slice(start,end),context);
}
function protocolRow(prefix,dose,intervals) {
  const values={['.'+prefix+'-dose']:{value:dose},['.'+prefix+'-d']:{value:'1'},['.'+prefix+'-total']:{value:'0'},'.med-effective-at':{value:'2026-10-04T08:00'}};
  const row={classList:{contains:n=>n==='protocol-main-row'},closest:selector=>selector==='#mon_rx_protocol_tbody'&&prefix==='mprx'?{}:null,getAttribute:()=> 'protocol',querySelector:s=>values[s]||null,querySelectorAll:()=>intervals.map(([value,unit])=>({querySelector:s=>s==='.med-protocol-interval-value'?{value}:{value:unit}}))};
  return {row,values};
}
test('admission and daily protocols retain doses and calculate quantities from entered administration intervals',()=>{
  for(const prefix of ['prx','mprx']) {
    const {row,values}=protocolRow(prefix,'2',[['30','minutes'],['1','hours'],['','minutes'],['0','hours']]);
    const timing=context.getMedicationTimingData(row,'');
    assert.equal(context.getMedicationRowPrefix(row),prefix);
    assert.equal(timing.doseAmount,'2');assert.equal(timing.protocolDose,'2');
    assert.equal(timing.protocolIntervals,'30m,1h');assert.equal(timing.protocolMaxDoses,'3');
    context.calculateMedicationQuickTotal(row);assert.equal(values['.'+prefix+'-total'].value,'6');
    values['.'+prefix+'-dose'].value='0.5';context.calculateMedicationQuickTotal(row);assert.equal(values['.'+prefix+'-total'].value,'1.5');
  }
});
test('a single administration is counted and older variable-dose protocol panels keep their representation',()=>{
  const {row,values}=protocolRow('prx','2',[]);context.calculateMedicationQuickTotal(row);assert.equal(values['.prx-total'].value,'2');
  assert.equal(context.isDedicatedProtocolMedication({rowType:'protocolRow',protocolDose:'2'}),true);
  assert.equal(context.isDedicatedProtocolMedication({timingMode:'protocol',doseAmount:'2',protocolIntervals:'30m'}),true);
  assert.equal(context.isDedicatedProtocolMedication({timingMode:'protocol',protocolDose:'2,1',protocolMaxDoses:'4'}),false);
  assert.equal(context.isDedicatedProtocolMedication({rowType:'regularRow',timingMode:'protocol'}),false);
});
