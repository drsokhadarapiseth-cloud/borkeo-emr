import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';
import { addCharge, addPayment, patientBill, paymentStatusForPatient, serviceCatalog } from '../server/finance.mjs';

test('OPD payment resets for a new IPD invoice and nurses can use the full fee catalog without losing payment history',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ward-service-fees-'));
  const origin='http://127.0.0.1:32359';
  const app=createEmrServer({demoMode:false,host:'127.0.0.1',port:32359,appOrigin:origin,databasePath:path.join(directory,'test.sqlite'),autoDatabase:false,nodeEnv:'test'});
  try{
    const password='Ward service fee test password 2026!';const passwordHash=await hashPassword(password);
    const ids={};
    for(const [username,role,wards] of [['wardfee_nurse_medicine','NURSE',['medicine']],['wardfee_nurse_pediatric','NURSE',['pediatric']],['wardfee_doctor_opd','DOCTOR',['opd']],['wardfee_cashier','CLERK',[]]]){
      const id=crypto.randomUUID();ids[username]=id;app.database.createUser({id,username,displayName:username,passwordHash,role,createdAt:Date.now()});setUserAccess(app.database,id,[role],wards);
    }
    const now=Date.now(),key='case:WARD-FEE-1510';
    app.database.upsertPatient({id:crypto.randomUUID(),patientKey:key,userId:ids.wardfee_cashier,savedAt:now,summary:{caseNumber:'WARD-FEE-1510',healthId:'HF-159',firstName:'Ward',lastName:'Patient',fullName:'Ward Patient',sex:'ប្រុស',age:'35',dateOfBirth:'1991-01-01',phone:'',equityCard:'',paymentType:'DIRECT',departmentCode:'opd',departmentNameKh:'ផ្នែកពិគ្រោះក្រៅ',departmentNameEn:'OPD',serviceMode:'opd',entryDate:new Date(now).toISOString().slice(0,10),dischargeDate:''},data:{'system:currentWardCode':'opd','system:workflowStage':'DOCTOR_READY','system:opdConsultationPaidAt':now}});
    const oldCharge=addCharge(app.database,key,{description:'Paid OPD service',quantity:1,unitAmount:7000,currency:'KHR'},ids.wardfee_cashier,now-3000);
    addPayment(app.database,key,{invoiceId:oldCharge.invoiceId,source:'CASH',amount:7000,currency:'KHR',receivedAt:now-2000},ids.wardfee_cashier,now-2000);
    app.database.sqlite.prepare('UPDATE finance_invoices SET closed_at=? WHERE id=?').run(now-1000,oldCharge.invoiceId);

    await new Promise(resolve=>app.server.listen(32359,'127.0.0.1',resolve));
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,password})});
      assert.equal(response.status,200,username);const Cookie=response.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    };
    const nurse=await login('wardfee_nurse_medicine'),otherWard=await login('wardfee_nurse_pediatric'),opdDoctor=await login('wardfee_doctor_opd');
    assert.equal(paymentStatusForPatient(app.database,key).code,'PAID');
    const transfer=await fetch(origin+'/api/opd/transfer-to-ipd',{method:'POST',headers:opdDoctor,body:JSON.stringify({patientKey:key,wardCode:'medicine'})});assert.equal(transfer.status,200,await transfer.clone().text());
    const transferResult=await transfer.json();assert.notEqual(transferResult.invoice.id,oldCharge.invoiceId);assert.equal(paymentStatusForPatient(app.database,key).code,'NOT_PAID');
    const catalog=await fetch(origin+'/api/finance/ward-services',{headers:nurse});assert.equal(catalog.status,200,await catalog.clone().text());
    const services=(await catalog.json()).services;assert.equal(services.length,serviceCatalog(app.database).length);assert.ok(services.some(item=>item.code==='AMBULANCE_0_5KM'));assert.ok(services.some(item=>item.code==='OPD_CONSULT'));
    const list=await fetch(`${origin}/api/finance/ward-charges?patientKey=${encodeURIComponent(key)}`,{headers:nurse});assert.equal(list.status,200,await list.clone().text());
    const initial=await list.json();assert.equal(initial.invoice.id,transferResult.invoice.id);assert.deepEqual(initial.charges,[]);
    const code=services.find(item=>item.code==='PHYSICAL_EXAMINATION')?.code||services[0].code;
    const added=await fetch(origin+'/api/finance/ward-charges',{method:'POST',headers:nurse,body:JSON.stringify({patientKey:key,serviceCode:code,quantity:1})});assert.equal(added.status,201,await added.clone().text());
    const payload=await added.json();assert.equal(payload.charge.serviceCode,code);assert.notEqual(payload.charge.invoiceId,oldCharge.invoiceId);
    const remove=await fetch(origin+'/api/finance/ward-charge-void',{method:'POST',headers:nurse,body:JSON.stringify({patientKey:key,chargeId:payload.charge.id,reason:'Entered in error'})});assert.equal(remove.status,200,await remove.clone().text());
    const stored=patientBill(app.database,key,payload.charge.invoiceId);assert.ok(stored.charges.some(item=>item.id===payload.charge.id&&item.voidedAt));
    assert.ok(stored.payments.every(item=>item.invoiceId!==oldCharge.invoiceId));
    assert.ok(patientBill(app.database,key,oldCharge.invoiceId).charges.some(item=>item.id===oldCharge.id&&!item.voidedAt));
    assert.ok(patientBill(app.database,key,oldCharge.invoiceId).payments.some(item=>!item.voidedAt));
    const wardFeesClient=fs.readFileSync(new URL('../public/ward-services.js',import.meta.url),'utf8');assert.match(wardFeesClient,/option value="">ជ្រើសរើសសេវា/);assert.match(wardFeesClient,/select\.addEventListener\('change',renderPreview\)/);
    const denied=await fetch(`${origin}/api/finance/ward-charges?patientKey=${encodeURIComponent(key)}`,{headers:otherWard});assert.equal(denied.status,403);
  }finally{
    await new Promise(resolve=>app.server.close(resolve));app.database.close();fs.rmSync(directory,{recursive:true,force:true});
  }
});
