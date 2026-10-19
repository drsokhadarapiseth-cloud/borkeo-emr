import {requestConcession,reviewConcession} from '../server/payment-policy.mjs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {createEmrServer} from '../server/server.mjs';
import {addCharge,addPayment,patientBill,setFinanceProfile,startPatientInvoice} from '../server/finance.mjs';

test('cashier removes only an unpaid service, preserves its audit history and other invoices, and can add a replacement',async()=>{
 const port=32982,origin=`http://127.0.0.1:${port}`;
 const app=createEmrServer({demoMode:true,host:'127.0.0.1',port,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'}),db=app.database;
 const actor=db.findUser('admin').id,patientKey='case:V182-DELETE';
 const summary={caseNumber:'V182-DELETE',healthId:'',firstName:'Delete',lastName:'Test',fullName:'Delete Test',sex:'M',age:'30',dateOfBirth:'',phone:'',equityCard:'',paymentType:'DIRECT',departmentCode:'opd',departmentNameKh:'OPD',departmentNameEn:'OPD',serviceMode:'opd',entryDate:'2026-10-04',dischargeDate:''};
 db.upsertPatient({id:crypto.randomUUID(),patientKey,summary,data:{},userId:actor,savedAt:Date.now()});
 setFinanceProfile(db,patientKey,{paymentType:'DIRECT',paymentSubtype:'FULL'},actor);
 const paid=addCharge(db,patientKey,{description:'Paid original',quantity:1,unitAmount:10000,currency:'KHR'},actor);
 const payment=addPayment(db,patientKey,{source:'CASH',amount:10000,currency:'KHR',invoiceId:paid.invoiceId},actor);
 const unpaid=addCharge(db,patientKey,{description:'Mistaken fee',quantity:1,unitAmount:5000,currency:'KHR'},actor);
 assert.notEqual(unpaid.invoiceId,paid.invoiceId);
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};}
 const post=(headers,body)=>fetch(origin+'/api/finance/void',{method:'POST',headers,body:JSON.stringify(body)});
 try{
  const clerk=await login('clerk');
  assert.equal((await post(clerk,{kind:'charge',id:unpaid.id,reason:'Wrong service'})).status,200);
  const bill=patientBill(db,patientKey,unpaid.invoiceId),deleted=bill.charges.find(c=>c.id===unpaid.id);
  assert(deleted.voidedAt);assert.equal(deleted.voidReason,'Wrong service');assert.equal(bill.summary.KHR.gross,0);
  assert.equal(patientBill(db,patientKey,paid.invoiceId).summary.KHR.paid,10000);
  assert.equal((await post(clerk,{kind:'charge',id:unpaid.id,reason:'Again'})).status,404);
  const replacement=await fetch(origin+'/api/finance/charges',{method:'POST',headers:clerk,body:JSON.stringify({patientKey,description:'Correct service',quantity:1,unitAmount:7000,currency:'KHR'})});assert.equal(replacement.status,201);const replacementCharge=(await replacement.json()).charge;assert.equal(replacementCharge.invoiceId,unpaid.invoiceId);
  assert.equal((await post(clerk,{kind:'charge',id:paid.id,reason:'Paid deletion'})).status,400);
  assert.equal((await post(clerk,{kind:'payment',id:payment.id,reason:'Payment deletion'})).status,403);
  const partial=addPayment(db,patientKey,{source:'CASH',amount:1000,currency:'KHR',invoiceId:unpaid.invoiceId},actor);
  assert.equal((await post(clerk,{kind:'charge',id:replacementCharge.id,reason:'Partial deletion'})).status,400);
  const admin=await login('admin');assert.equal((await post(admin,{kind:'charge',id:replacementCharge.id,reason:'Partial deletion'})).status,400);
  // Existing accountant correction of payments still works.
  assert.equal((await post(admin,{kind:'payment',id:partial.id,reason:'Correct payment'})).status,200);
  assert.equal((await post(clerk,{kind:'charge',id:replacementCharge.id,reason:'Wrong unpaid service'})).status,200);
  const waivedInvoice=startPatientInvoice(db,patientKey,actor);
  const waived=addCharge(db,patientKey,{description:'Waived service',quantity:1,unitAmount:3000,currency:'KHR'},actor);
  const approval=requestConcession(db,{patientKey,invoiceId:waivedInvoice.id,reason:'Cannot afford care'},{role:'ADMIN',userId:actor});reviewConcession(db,approval.id,{approved:true},{role:'ADMIN',userId:actor});setFinanceProfile(db,patientKey,{paymentType:'EXEMPT',approvalId:approval.id},actor,Date.now(),waivedInvoice.id);
  assert.equal((await post(clerk,{kind:'charge',id:waived.id,reason:'Waived deletion'})).status,400);
  const triage=await login('triage');assert.equal((await post(triage,{kind:'charge',id:paid.id,reason:'No access'})).status,403);
  assert.equal((await fetch(origin+'/api/finance/void',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'charge',id:paid.id,reason:'Anonymous'})})).status,401);
  assert.equal(db.findPatient(patientKey).full_name,'Delete Test');
 }finally{await new Promise(r=>app.server.close(r));db.close();}
});
