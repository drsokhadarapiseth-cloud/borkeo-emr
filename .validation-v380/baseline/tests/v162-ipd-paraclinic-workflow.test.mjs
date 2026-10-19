import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';
import { addPayment, ensureFinanceSchema, patientBill, serviceCatalog, setServiceCatalogItem } from '../server/finance.mjs';

test('v16.2 adds ward tariffs, free IPD paraclinic orders, nursing handoff and fee-waiver approval',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'ipd-paraclinic-v162-'));
  const port=32581,origin=`http://127.0.0.1:${port}`;
  const app=createEmrServer({demoMode:false,host:'127.0.0.1',port,appOrigin:origin,databasePath:path.join(directory,'test.sqlite'),autoDatabase:false,nodeEnv:'test'});
  try{
    const password='IPD paraclinic test password 2026!';const passwordHash=await hashPassword(password);const users={};
    for(const [username,role,wards] of [['ipd162_doctor','DOCTOR',['medicine']],['ipd162_nurse','NURSE',['medicine']],['ipd162_lab','LAB',[]],['ipd162_imaging','IMAGING',[]],['ipd162_admin','ADMIN',[]],['ipd162_director','DIRECTOR',[]],['ipd162_clerk','CLERK',[]]]){
      const id=crypto.randomUUID();users[username]=id;app.database.createUser({id,username,displayName:username,passwordHash,role,createdAt:Date.now()});setUserAccess(app.database,id,[role],wards);
    }
    setServiceCatalogItem(app.database,{code:'LAB_EXTRA_162',categoryCode:'LAB',nameKh:'ថ្លៃតេស្តបន្ថែម',nameEn:'Extra laboratory test',defaultAmount:12000,currency:'KHR',active:true,departmentCode:'lab',unitLabel:'test'});
    setServiceCatalogItem(app.database,{code:'IMG_EXTRA_162',categoryCode:'IMAGING',nameKh:'ថ្លៃរូបភាពបន្ថែម',nameEn:'Extra imaging service',defaultAmount:25000,currency:'KHR',active:true,departmentCode:'imaging',unitLabel:'study'});
    const now=Date.now(),patientKey='case:IPD-V162';
    app.database.upsertPatient({id:crypto.randomUUID(),patientKey,userId:users.ipd162_doctor,savedAt:now,summary:{caseNumber:'IPD-V162',healthId:'HF-V162',firstName:'Dara',lastName:'Patient',fullName:'Patient Dara',sex:'ប្រុស',age:'35',dateOfBirth:'1991-01-01',phone:'',equityCard:'',paymentType:'DIRECT',departmentCode:'medicine',departmentNameKh:'ផ្នែកជំងឺទូទៅ',departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:new Date(now).toISOString().slice(0,10),dischargeDate:''},data:{'system:currentWardCode':'medicine'}});
    await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
    const login=async username=>{const response=await fetch(`${origin}/api/auth/login`,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,password})});assert.equal(response.status,200,username);const Cookie=response.headers.get('set-cookie').split(';')[0];const me=await(await fetch(`${origin}/api/auth/me`,{headers:{Cookie}})).json();return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};};
    const doctor=await login('ipd162_doctor'),nurse=await login('ipd162_nurse'),lab=await login('ipd162_lab'),imaging=await login('ipd162_imaging'),admin=await login('ipd162_admin'),clerk=await login('ipd162_clerk');

    const catalog=serviceCatalog(app.database,{includeInactive:true});
    assert.equal(catalog.find(item=>item.code==='IPD_MEDICINE_WARD_FEE').defaultAmount,80000);
    assert.equal(catalog.find(item=>item.code==='IPD_CHILD_UNDER_7_DAYS').defaultAmount,80000);
    assert.equal(catalog.find(item=>item.code==='REA_24_HOUR_EMERGENCY').defaultAmount,120000);
    assert.ok(catalog.some(item=>item.code==='GO_NORMAL_DELIVERY_OR_WOMENS_DISEASE'));
    assert.equal(catalog.find(item=>item.code==='IPD_ICU_WARD_FEE').active,false,'ICU pricing must be activated by Admin');
    setServiceCatalogItem(app.database,{code:'IPD_ICU_WARD_FEE',categoryCode:'BED',nameKh:'សម្រាកព្យាបាលនៅ ICU',nameEn:'ICU inpatient fee',defaultAmount:150000,currency:'KHR',active:true,departmentCode:'icu',unitLabel:'admission'});
    ensureFinanceSchema(app.database);
    assert.equal(serviceCatalog(app.database).find(item=>item.code==='IPD_ICU_WARD_FEE').defaultAmount,150000,'the one-time migration must not overwrite Admin price edits');

    const wardServices=(await(await fetch(`${origin}/api/finance/ward-services`,{headers:nurse})).json()).services;
    assert.ok(wardServices.some(item=>item.code==='AMBULANCE_TRANSFER_IN_6_15KM'));
    assert.ok(wardServices.some(item=>item.code==='AMBULANCE_TRANSFER_OUT_6_15KM'));

    const wardFee=await fetch(`${origin}/api/finance/ward-charges`,{method:'POST',headers:nurse,body:JSON.stringify({patientKey,serviceCode:'AMBULANCE_TRANSFER_IN_6_15KM',quantity:1})});
    assert.equal(wardFee.status,201,await wardFee.clone().text());const wardFeeData=await wardFee.json();assert.equal(wardFeeData.charge.amount,60000);
    const invoiceId=wardFeeData.charge.invoiceId;
    const queueBeforeSend=(await(await fetch(`${origin}/api/finance/patients?view=queue&q=IPD-V162`,{headers:clerk})).json()).patients;
    assert.equal(queueBeforeSend.length,0,'the cashier queue excludes an IPD patient until the ward sends the invoice');
    const patientRegister=(await(await fetch(`${origin}/api/finance/patients?view=register&q=HF-V162`,{headers:clerk})).json()).patients[0];
    assert.equal(patientRegister.caseNumber,'IPD-V162');assert.equal(patientRegister.exitDate,'');assert.equal(patientRegister.paymentDate,null);
    const queueSend=await fetch(`${origin}/api/finance/send-to-cashier`,{method:'POST',headers:nurse,body:JSON.stringify({patientKey})});
    assert.equal(queueSend.status,200,await queueSend.clone().text());
    const queueAfterSend=(await(await fetch(`${origin}/api/finance/patients?view=queue&q=IPD-V162`,{headers:clerk})).json()).patients;
    assert.equal(queueAfterSend.length,1,'a nurse handoff puts only the ward-sent invoice in Cashier queue');

    const labOrderResponse=await fetch(`${origin}/api/paraclinic/orders`,{method:'POST',headers:doctor,body:JSON.stringify({patientKey,modality:'LAB',priority:'ROUTINE',request:{items:[{code:'HGB'}]}})});
    assert.equal(labOrderResponse.status,201,await labOrderResponse.clone().text());const labOrder=(await labOrderResponse.json()).order;
    assert.equal(labOrder.status,'ORDERED');assert.equal(labOrder.request.chargeMode,'FREE');
    assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) AS n FROM finance_charges WHERE source_key LIKE ?').get(`PARACLINIC:${labOrder.id}:%`).n,0);
    for(const [status,extra] of [['WARD_RECEIVED',{}],['COLLECTED',{collectedAt:Date.now()}],['SENT_TO_LAB',{}]]){
      const response=await fetch(`${origin}/api/paraclinic/orders/${labOrder.id}`,{method:'PATCH',headers:nurse,body:JSON.stringify({status,...extra})});assert.equal(response.status,200,await response.clone().text());
    }
    const labServices=await(await fetch(`${origin}/api/paraclinic/fee-services?modality=LAB`,{headers:lab})).json();assert.ok(labServices.services.some(item=>item.code==='LAB_EXTRA_162'));
    const addLabFee=await fetch(`${origin}/api/paraclinic/orders/${labOrder.id}/fees`,{method:'POST',headers:lab,body:JSON.stringify({serviceCode:'LAB_EXTRA_162',quantity:1})});assert.equal(addLabFee.status,201,await addLabFee.clone().text());const labFee=(await addLabFee.json()).fee;assert.equal(labFee.invoiceId,invoiceId);
    const nurseMessages=(await(await fetch(`${origin}/api/messages?box=inbox&limit=100`,{headers:nurse})).json()).messages;assert.ok(nurseMessages.some(message=>message.subject.includes('Extra LAB fee added')),'the ward should be notified when a lab fee is added');
    addPayment(app.database,patientKey,{invoiceId,source:'CASH',amount:50000,currency:'KHR'},users.ipd162_doctor,Date.now());
    let fees=(await(await fetch(`${origin}/api/paraclinic/fees?patientKey=${encodeURIComponent(patientKey)}`,{headers:nurse})).json()).fees;assert.equal(fees[0].paymentState,'NOT_PAID');
    const informed=await fetch(`${origin}/api/paraclinic/fees/${labFee.id}/patient-informed`,{method:'POST',headers:nurse,body:'{}'});assert.equal(informed.status,200,await informed.clone().text());
    const requested=await fetch(`${origin}/api/paraclinic/fees/${labFee.id}/waiver-request`,{method:'POST',headers:nurse,body:JSON.stringify({reason:'Patient cannot afford the extra test fee.'})});assert.equal(requested.status,200,await requested.clone().text());
    const pending=(await(await fetch(`${origin}/api/paraclinic/fee-waivers`,{headers:admin})).json()).fees;assert.equal(pending.length,1);assert.equal(pending[0].id,labFee.id);
    const approved=await fetch(`${origin}/api/paraclinic/fees/${labFee.id}/waiver-review`,{method:'POST',headers:admin,body:JSON.stringify({approved:true})});assert.equal(approved.status,200,await approved.clone().text());
    fees=(await(await fetch(`${origin}/api/paraclinic/fees?patientKey=${encodeURIComponent(patientKey)}`,{headers:nurse})).json()).fees;assert.equal(fees[0].paymentState,'FREE');
    const bill=patientBill(app.database,patientKey,invoiceId);assert.ok(bill.charges.some(charge=>charge.serviceCode==='LAB_EXTRA_162'&&charge.voidedAt));assert.ok(bill.charges.some(charge=>charge.serviceCode==='AMBULANCE_TRANSFER_IN_6_15KM'&&!charge.voidedAt));assert.equal(bill.summary.KHR.balance,10000);assert.ok(bill.payments.some(item=>item.amount===50000&&!item.voidedAt),'waiving a fee must retain the earlier partial payment');
    const registerAfterPayment=(await(await fetch(`${origin}/api/finance/patients?view=register&q=IPD-V162`,{headers:clerk})).json()).patients[0];
    assert.ok(registerAfterPayment.paymentDate,'the searchable payment register shows the latest actual payment date');

    const imagingOrderResponse=await fetch(`${origin}/api/paraclinic/orders`,{method:'POST',headers:doctor,body:JSON.stringify({patientKey,modality:'XRAY',priority:'ROUTINE',request:{examination:'Chest'}})});
    assert.equal(imagingOrderResponse.status,201,await imagingOrderResponse.clone().text());const imagingOrder=(await imagingOrderResponse.json()).order;
    let imagingWorklist=(await(await fetch(`${origin}/api/paraclinic/orders`,{headers:imaging})).json()).orders;assert.ok(!imagingWorklist.some(item=>item.id===imagingOrder.id));
    for(const stage of ['RECEIVED_ORDER','PATIENT_SENT_TO_IMAGING']){const response=await fetch(`${origin}/api/paraclinic/orders/${imagingOrder.id}`,{method:'PATCH',headers:nurse,body:JSON.stringify({request:{wardWorkflow:{stage}}})});assert.equal(response.status,200,await response.clone().text());}
    imagingWorklist=(await(await fetch(`${origin}/api/paraclinic/orders`,{headers:imaging})).json()).orders;assert.ok(imagingWorklist.some(item=>item.id===imagingOrder.id));
    const addImageFee=await fetch(`${origin}/api/paraclinic/orders/${imagingOrder.id}/fees`,{method:'POST',headers:imaging,body:JSON.stringify({serviceCode:'IMG_EXTRA_162',quantity:1})});assert.equal(addImageFee.status,201,await addImageFee.clone().text());assert.equal((await addImageFee.json()).charge.invoiceId,invoiceId);
  }finally{await new Promise(resolve=>app.server.close(resolve));app.database.close();fs.rmSync(directory,{recursive:true,force:true});}
});
