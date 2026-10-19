import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {setUserAccess} from '../server/access.mjs';
import {createEmrServer} from '../server/server.mjs';
import {addCharge,patientBill,setFinanceProfile} from '../server/finance.mjs';

async function fixture(port){
 const origin=`http://127.0.0.1:${port}`,app=createEmrServer({demoMode:true,host:'127.0.0.1',port,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'}),db=app.database,actor=db.findUser('admin').id;
 function seed(name,mode='opd',data={}){const patientKey='case:V184-'+name,summary={caseNumber:'V184-'+name,healthId:'H184-'+name,firstName:name,lastName:'Test',fullName:name+' Test',sex:'M',age:'40',dateOfBirth:'',phone:'',equityCard:'',paymentType:'DIRECT',departmentCode:mode==='opd'?'opd':'medicine',departmentNameKh:mode==='opd'?'ពិគ្រោះក្រៅ':'ផ្នែកជំងឺទូទៅ',departmentNameEn:mode==='opd'?'OPD':'Medicine',serviceMode:mode,entryDate:'2026-10-05',dischargeDate:''};db.upsertPatient({id:crypto.randomUUID(),patientKey,summary,data:{'system:currentWardCode':summary.departmentCode,'system:triageStatus':'COMPLETED','system:workflowStage':'DOCTOR_READY',...data},userId:actor,savedAt:Date.now()});setFinanceProfile(db,patientKey,{paymentType:'DIRECT',paymentSubtype:'FULL'},actor);return patientKey;}
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200,username);const Cookie=r.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return{Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};}
 const get=(path,headers)=>fetch(origin+path,{headers,redirect:'manual'});
 const post=(path,headers,body,method='POST')=>fetch(origin+path,{method,headers,body:JSON.stringify(body)});
 const alerts=async h=>(await(await get('/api/finance/cashier-alerts',h)).json()).payments;
 const close=async()=>{await new Promise(r=>app.server.close(r));db.close();};
 return{app,db,actor,seed,login,get,post,alerts,close};
}

test('Paid OPD consultation can be followed by repeated paid tests before a consultation save; each new bill alerts and settles independently',async()=>{
 const f=await fixture(32986),{db,actor,seed,login,get,post,alerts}=f;
 try{
  const key=seed('Repeat'),doctor=await login('doctor_opd'),clerk=await login('clerk'),lab=await login('lab');
  const consultation=addCharge(db,key,{serviceCode:'OPD_CONSULT',unitAmount:5000,currency:'KHR',quantity:1},actor);
  assert.equal((await post('/api/finance/complete-payment',clerk,{patientKey:key,invoiceId:consultation.invoiceId,paymentType:'DIRECT',paymentSubtype:'FULL'})).status,201);
  const oldBill=patientBill(db,key,consultation.invoiceId),oldRows=db.sqlite.prepare('SELECT * FROM finance_payments WHERE invoice_id=?').all(consultation.invoiceId);
  assert.ok(!JSON.parse(db.findPatient(key).record_json)['system:opdConsultedAt'],'regression: doctor has not saved the form yet');
  for(const code of ['CBC','CRP','ALT']){
   const response=await post('/api/paraclinic/orders',doctor,{patientKey:key,modality:'LAB',chargeMode:'PAID',handoffMode:'DIRECT',request:{items:[{code}],clinicalInfo:'Further tests after payment'}}),data=await response.json();
   assert.equal(response.status,201,JSON.stringify(data));assert.equal(data.order.status,'PAYMENT_PENDING');assert.equal(data.cashierPaymentRequired,true);
   const bill=patientBill(db,key);assert.notEqual(bill.invoice.id,consultation.invoiceId);assert.equal((await alerts(clerk)).filter(p=>p.patientKey===key).length,1);assert.equal((await alerts(clerk)).find(p=>p.patientKey===key).invoiceId,bill.invoice.id);
   assert.ok(!(await(await get('/api/paraclinic/orders?modality=LAB',lab)).json()).orders.some(o=>o.id===data.order.id));
   const queue=(await(await get('/api/finance/patients?view=queue&q=V184-Repeat',clerk)).json()).patients;assert.equal(queue[0].cashierInvoiceId,bill.invoice.id);assert.equal(queue[0].paymentStatus.code,'NOT_PAID');
   assert.equal((await post('/api/finance/complete-payment',clerk,{patientKey:key,invoiceId:bill.invoice.id,paymentType:'DIRECT',paymentSubtype:'FULL'})).status,201);
   assert.equal((await alerts(clerk)).filter(p=>p.patientKey===key).length,0);
   assert.ok((await(await get('/api/paraclinic/orders?modality=LAB',lab)).json()).orders.some(o=>o.id===data.order.id),'only the paid order is released');
  }
  assert.deepEqual(patientBill(db,key,consultation.invoiceId),oldBill);assert.deepEqual(db.sqlite.prepare('SELECT * FROM finance_payments WHERE invoice_id=?').all(consultation.invoiceId),oldRows);
  const response=await post('/api/paraclinic/orders',doctor,{patientKey:key,modality:'LAB',chargeMode:'FREE',handoffMode:'DIRECT',request:{items:[{code:'AST'}],clinicalInfo:'Free request'}});assert.equal(response.status,201);assert.equal((await response.json()).cashierPaymentRequired,false);assert.equal((await alerts(clerk)).length,0);
 }finally{await f.close();}
});

test('Every staff role can create another independent same-day invoice; multiple handoffs survive latest-invoice payment and duplicate submissions',async()=>{
 const f=await fixture(32987),{db,actor,seed,login,get,post,alerts}=f;
 try{
  const key=seed('AllStaff','ipd'),clerk=await login('clerk'),accountant=await login('accountant'),registration=await login('registration');
  const first=addCharge(db,key,{description:'Old paid service',unitAmount:6000,quantity:1,currency:'KHR'},actor);
  assert.equal((await post('/api/finance/complete-payment',clerk,{patientKey:key,invoiceId:first.invoiceId,paymentType:'DIRECT',paymentSubtype:'FULL'})).status,201);
  const oldBill=patientBill(db,key,first.invoiceId),oldPayments=db.sqlite.prepare('SELECT * FROM finance_payments WHERE invoice_id=?').all(first.invoiceId);
  db.createUser({id:crypto.randomUUID(),username:'chief_medicine',displayName:'Ward Chief',role:'CHIEF_WARD',passwordHash:'unused',createdAt:Date.now()});setUserAccess(db,db.findUser('chief_medicine').id,['CHIEF_WARD'],['medicine']);
  const users=['admin','director','registration','triage','doctor_opd','nurse_medicine','nurse_obstetric','lab','imaging','pharmacy','accountant','clerk','chief_medicine'];
  const invoices=[];
  for(const username of users){
   const h=await login(username);assert.equal((await get('/api/finance/services',h)).status,200);
   const body={patientKey:key,requestId:crypto.randomUUID(),items:[{serviceCode:'CBC',quantity:1},{serviceCode:'CRP',quantity:2}],note:username};
   const response=await post('/api/finance/invoices',h,body),data=await response.json();assert.equal(response.status,201,username+': '+JSON.stringify(data));invoices.push(data.invoiceId);assert.equal(data.bill.charges.filter(c=>!c.voidedAt).length,2);
   const again=await post('/api/finance/invoices',h,body);assert.equal(again.status,200);assert.equal((await again.json()).invoiceId,data.invoiceId);
   assert.equal((await post('/api/finance/send-to-cashier',h,{patientKey:key,invoiceId:data.invoiceId})).status,200);
  }
  assert.equal(new Set(invoices).size,users.length);assert.equal((await alerts(clerk)).length,users.length);
  const latest=invoices.at(-1);assert.equal((await post('/api/finance/complete-payment',clerk,{patientKey:key,invoiceId:latest,paymentType:'DIRECT',paymentSubtype:'FULL'})).status,201);
  assert.equal((await alerts(accountant)).length,users.length-1);assert.ok(!(await alerts(clerk)).some(a=>a.invoiceId===latest));
  const queue=(await(await get('/api/finance/patients?view=queue&q=V184-AllStaff',clerk)).json()).patients;assert.equal(queue.length,1);assert.ok(invoices.slice(0,-1).includes(queue[0].cashierInvoiceId),'queue opens another unpaid invoice instead of the latest paid invoice');
  const id=invoices[0];assert.equal((await get('/api/finance/patient?patientKey='+encodeURIComponent(key)+'&invoiceId='+id,clerk)).status,200);assert.equal((await alerts(clerk)).length,users.length-1);
  assert.equal((await post('/api/finance/payments',clerk,{patientKey:key,invoiceId:id,source:'CASH',amount:1,currency:'KHR'})).status,201);assert.equal((await alerts(clerk)).length,users.length-1);
  for(const invoiceId of invoices.slice(0,-1))assert.equal((await post('/api/finance/complete-payment',accountant,{patientKey:key,invoiceId,paymentType:'DIRECT',paymentSubtype:'FULL'})).status,201);
  assert.equal((await alerts(clerk)).length,0);assert.equal((await(await get('/api/finance/patients?view=queue&q=V184-AllStaff',clerk)).json()).patients.length,0);
  assert.equal((await(await get('/api/finance/patients?view=register&q=V184-AllStaff',clerk)).json()).patients.length,1,'patient remains in payment-status list');
  assert.deepEqual(patientBill(db,key,first.invoiceId),oldBill);assert.deepEqual(db.sqlite.prepare('SELECT * FROM finance_payments WHERE invoice_id=?').all(first.invoiceId),oldPayments);
  assert.equal((await post('/api/finance/complete-payment',clerk,{patientKey:key,invoiceId:first.invoiceId,paymentType:'DIRECT',paymentSubtype:'FULL'})).status,400);
  assert.equal((await post('/api/finance/invoices',{...registration,'X-CSRF-Token':'bad'},{patientKey:key,requestId:crypto.randomUUID(),items:[{serviceCode:'CBC',quantity:1}]})).status,403);
  const count=db.sqlite.prepare('SELECT COUNT(*) n FROM finance_invoices WHERE patient_key=?').get(key).n;
  const invalid=await post('/api/finance/invoices',registration,{patientKey:key,requestId:crypto.randomUUID(),items:[{serviceCode:'CBC',quantity:1},{serviceCode:'INVALID',quantity:1}]});assert.equal(invalid.status,400);assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM finance_invoices WHERE patient_key=?').get(key).n,count);
  const insured=seed('Insured','ipd');setFinanceProfile(db,insured,{paymentType:'NSSF_WORKER'},actor);
  const insuredResponse=await post('/api/finance/invoices',registration,{patientKey:insured,requestId:crypto.randomUUID(),items:[{serviceCode:'CBC',quantity:1},{serviceCode:'CRP',quantity:1}]}),insuredData=await insuredResponse.json();assert.equal(insuredResponse.status,201);assert.equal(insuredData.bill.charges.length,2);assert.equal(db.sqlite.prepare('SELECT COUNT(*) n FROM finance_invoices WHERE patient_key=?').get(insured).n,1,'covered services still belong to one independent invoice');
  const extra=await post('/api/finance/charges',clerk,{patientKey:key,description:'New service after paid invoice',unitAmount:2000,quantity:1,currency:'KHR'});assert.equal(extra.status,201);assert.notEqual((await extra.json()).bill.invoice.id,first.invoiceId);
 }finally{await f.close();}
});
