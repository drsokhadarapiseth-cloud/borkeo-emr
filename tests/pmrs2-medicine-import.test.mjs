import assert from 'node:assert/strict';
import test from 'node:test';
import { preparePmrsMedicineImport, applyPmrsMedicineImport } from '../server/pmrs/medicine-import.mjs';

const patient = { healthId:'003-111-222-3',serviceMode:'ipd' };
const source = () => ({
  sourcePid:'003-111-222-3',sourceVisit:'example-visit',target:'daily',recordAt:'2026-09-17T09:30',
  medications:[{sourceRowIndex:0,name:'Example Medicine 500 mg',route:'po',unit:'គ្រាប់',
    m:'1',a:'0',e:'1',n:'0',d:'1'}],
});

test('PMRS2 BID maps to existing EMR daily treatment without changing clinical notes', () => {
  const existing = { 'system:dailyMonitoringRecords':JSON.stringify([{
    dtVal:'2026-09-17T09:30',temp:'37',evol:'Existing note',conclusion:'Existing conclusion',medications:[],
  }]) };
  const prepared = preparePmrsMedicineImport(source());
  const result = applyPmrsMedicineImport(existing,prepared,patient);
  assert.equal(result.added,1);
  const rows = JSON.parse(result.data['system:dailyMonitoringRecords']);
  assert.equal(rows[0].evol,'Existing note');
  assert.equal(rows[0].temp,'37');
  assert.deepEqual([rows[0].medications[0].m,rows[0].medications[0].a,
    rows[0].medications[0].e,rows[0].medications[0].n],['1','0','1','0']);
  assert.equal(rows[0].medications[0].scheduleType,'bid');
  assert.equal(rows[0].medications[0].total,'2');
  assert.equal(existing['system:dailyMonitoringRecords'],JSON.stringify([{dtVal:'2026-09-17T09:30',temp:'37',evol:'Existing note',conclusion:'Existing conclusion',medications:[]}]));
  const again = applyPmrsMedicineImport(result.data,prepared,patient);
  assert.equal(again.added,0);
  assert.equal(again.skipped,1);
});

test('Wrong patient, changed PMRS row, and nonstandard dose schedules stop import', () => {
  const original = preparePmrsMedicineImport(source());
  assert.throws(() => applyPmrsMedicineImport({},original,{...patient,healthId:'another'}),/does not match/);
  const saved = applyPmrsMedicineImport({},original,patient);
  const changed=source();changed.medications[0].m='2';changed.medications[0].e='2';
  assert.throws(() => applyPmrsMedicineImport(saved.data,preparePmrsMedicineImport(changed),patient),/has changed/);
  changed.medications[0].e='1';
  assert.throws(() => preparePmrsMedicineImport(changed),/Different amounts/);
  changed.medications[0].m='0';changed.medications[0].a='1';changed.medications[0].e='0';changed.medications[0].n='1';
  assert.throws(() => preparePmrsMedicineImport(changed),/time pattern needs manual review/);
});

test('TID, QID, OPD, and new daily record use the EMR medication fields', () => {
  for (const [slots,frequency,total] of [
    [['1','1','1','0'],'tid','3'], [['0.5','0.5','0.5','0.5'],'qid','2'],
  ]) {
    const input=source();[input.medications[0].m,input.medications[0].a,input.medications[0].e,input.medications[0].n]=slots;
    const result=applyPmrsMedicineImport({},preparePmrsMedicineImport(input),patient);
    const med=JSON.parse(result.data['system:dailyMonitoringRecords'])[0].medications[0];
    assert.equal(med.scheduleType,frequency);assert.equal(med.total,total);
  }
  const opd=source();opd.target='opd';
  const result=applyPmrsMedicineImport({},preparePmrsMedicineImport(opd),{...patient,serviceMode:'opd'});
  assert.equal(JSON.parse(result.data['system:opdMedications']).length,1);
  assert.throws(() => applyPmrsMedicineImport({},preparePmrsMedicineImport(opd),patient),/service type/);
});
