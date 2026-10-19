import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { createOrder, cancelOrder } from '../server/paraclinic.mjs';

test('v12.7 queue display is service-specific with four waiting rows and skip support', () => {
  const root=path.resolve(import.meta.dirname,'..');
  const display=fs.readFileSync(path.join(root,'protected/queue-display.html'),'utf8');
  const js=fs.readFileSync(path.join(root,'public/queue-display.js'),'utf8');
  const triage=fs.readFileSync(path.join(root,'public/triage.js'),'utf8');
  const opd=fs.readFileSync(path.join(root,'public/opd-queue.js'),'utf8');
  assert.match(display,/ល\.រ/);
  assert.match(display,/ឈ្មោះ/);
  assert.match(display,/id="display-place-header">ផ្នែកទ្រីយ៉ា/);
  assert.match(js,/title:'ពិនិត្យលេខរៀង'/);
  assert.match(js,/serviceParam/);
  assert.match(js,/slice\(0,4\)/);
  assert.match(js,/Array\.from\(\{length:4\}/);
  assert.match(js,/queue-empty-row/);
  assert.doesNotMatch(js,/កំពុងរង់ចាំអ្នកជំងឺ/);
  assert.match(triage,/queue-skip/);
  assert.match(opd,/queue-skip/);
  assert.match(triage,/\/api\/queue\/skip/);
  assert.match(opd,/\/api\/queue\/skip/);
});

test('v12.7 paraclinic UI has duplicate locks and delete controls', () => {
  const root=path.resolve(import.meta.dirname,'..');
  const js=fs.readFileSync(path.join(root,'public/paraclinic.js'),'utf8');
  const css=fs.readFileSync(path.join(root,'public/paraclinic.css'),'utf8');
  assert.match(js,/hasExistingLabTest/);
  assert.match(js,/hasExistingImaging/);
  assert.ok(js.includes('data-remove-other') || js.includes('data-remove-test'));
  assert.match(js,/data-delete-order/);
  assert.match(css,/\.delete-paraclinic/);
});

test('v12.7 server rejects duplicate active laboratory tests and allows cancellation before processing', () => {
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32321,appOrigin:'http://127.0.0.1:32321',databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  const uid=app.database.findUser('doctor_opd').id;
  const patientKey='case:V127-LAB';
  app.database.sqlite.prepare(`INSERT INTO patient_records (id,patient_key,case_number,health_id,first_name,last_name,full_name,sex,age,entry_date,service_mode,department_code,department_name_kh,record_json,created_by,updated_by,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run('v127-lab','case:V127-LAB','V127-LAB','V127-H','Test','Patient','Test Patient','ប្រុស','30','2026-09-21','opd','opd','OPD',JSON.stringify({'system:triageStatus':'COMPLETED','system:workflowStage':'DOCTOR_READY'}),uid,uid,Date.now(),Date.now());
  try {
    const mod=app.database;
    const order=createOrder(mod,{patientKey,modality:'LAB',priority:'ROUTINE',request:{items:[{code:'HGB'}]},userId:uid,role:'DOCTOR',ward:'opd'});
    assert.equal(order.status,'ORDERED');
    assert.throws(()=>createOrder(mod,{patientKey,modality:'LAB',priority:'ROUTINE',request:{items:[{code:'HGB'}]},userId:uid,role:'DOCTOR',ward:'opd'}),/already been ordered/);
    const cancelled=cancelOrder(mod,order.id,{role:'DOCTOR',userId:uid});
    assert.equal(cancelled.status,'CANCELLED');
    const again=createOrder(mod,{patientKey,modality:'LAB',priority:'ROUTINE',request:{items:[{code:'HGB'}]},userId:uid,role:'DOCTOR',ward:'opd'});
    assert.equal(again.status,'ORDERED');
  } finally { app.database.close(); }
});
