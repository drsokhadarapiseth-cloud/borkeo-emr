import assert from 'node:assert/strict';
import test from 'node:test';
import { buildMedicineMatrix, medicineRequestQuantity } from '../server/ward-medicine-matrix.mjs';
import { renderMedicineSheets } from '../public/ward-medicine-table.js';

test('ward matrix shares medicine columns across patients and sums the saved supply totals',()=>{
  const matrix=buildMedicineMatrix([
    {patientKey:'a',fullName:'Patient A',bedLabel:'1',diagnosis:'I10',medications:[{name:'Amlodipine 10mg',unit:'គ្រាប់',total:'1'}]},
    {patientKey:'b',fullName:'Patient B',bedLabel:'2',diagnosis:'I10',medications:[{name:'amlodipine 10 mg',unit:'tablet',total:'1'},{name:'Paracetamol 500mg',unit:'គ្រាប់',total:'1'}]},
    {patientKey:'c',medications:[]},
  ]);
  assert.equal(matrix.columns.length,2);
  assert.equal(matrix.patientCount,2);
  assert.deepEqual(matrix.rows.map(row=>row.cells.map(cell=>cell?.quantity??null)),[[1,null],[1,1]]);
  assert.deepEqual(matrix.totals.map(cell=>cell.quantity),[2,1]);
  const html=renderMedicineSheets({date:'2026-09-17',wardNameKh:'Medicine',matrix});
  assert.equal((html.match(/class="vertical drug-heading"/g)||[]).length,25);
  assert.equal((html.match(/class="patient-name"/g)||[]).length,16);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('Amlodipine 10mg'));
});

test('quantity uses the complete order total, handles fractions and exposes missing totals',()=>{
  assert.equal(medicineRequestQuantity({total:'20',m:'1',a:'0',e:'1',n:'0',days:'5'}),20);
  assert.equal(medicineRequestQuantity({m:'0.5',a:'0',e:'0.5',n:'0',days:'3'}),3);
  assert.equal(medicineRequestQuantity({doseAmount:'2',scheduleType:'bid',days:'5'}),20);
  assert.equal(medicineRequestQuantity({doseAmount:'1',scheduleType:'qh',days:'5'}),null);
  assert.equal(medicineRequestQuantity({m:'1',days:'1'}),null);
  assert.equal(medicineRequestQuantity({total:'invalid'}),null);
  assert.equal(medicineRequestQuantity({total:'0'}),0);
  const matrix=buildMedicineMatrix([{medications:[{name:'Same 10mg',unit:'tablet',total:'1.5'},{name:'Same 10mg',unit:'tablet',total:'2'},{name:'Same 10mg',unit:'ampoule',total:'1'},{name:'Same 20mg',unit:'tablet',total:'4'},{name:'Unknown',unit:'tablet'}]}]);
  assert.equal(matrix.columns.length,4);
  assert.equal(matrix.totals[0].quantity,3.5);
  assert.equal(matrix.totals[3].incomplete,true);
  assert.equal(matrix.unresolvedCount,1);
});

test('overflow patients and medicines continue in complete grids without losing rows or columns',()=>{
  const patients=Array.from({length:17},(_,i)=>({fullName:`Patient ${i+1}`,medications:Array.from({length:26},(_,j)=>({name:`Drug ${j+1}`,unit:'tablet',total:'1'}))}));
  patients[0].fullName='<script>bad</script>';
  const matrix=buildMedicineMatrix(patients);
  const html=renderMedicineSheets({date:'2026-09-17',wardNameKh:'Medicine',matrix});
  assert.equal((html.match(/class="report-sheet"/g)||[]).length,4);
  assert.ok(html.includes('Drug 26'));
  assert.ok(html.includes('Patient 17'));
  assert.ok(!html.includes('<script>bad</script>'));
  assert.ok(matrix.totals.every(cell=>cell.quantity===17));
});
