import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { setUserAccess } from '../server/access.mjs';
import { disabledDemoPasswordHash } from '../server/demo-accounts.mjs';
import { addCharge, addPayment } from '../server/finance.mjs';
import { opdLocalDate, referToOpd } from '../server/opd-queue.mjs';

test('OPD can transfer to every IPD ward and settled OPD payment alerts the shared doctor inbox', async () => {
  const origin='http://127.0.0.1:32355';
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32355,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  await new Promise(resolve=>app.server.listen(32355,'127.0.0.1',resolve));
  try {
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      assert.equal(response.status,200,await response.clone().text());
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const session=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json'};
    };
    const doctor=await login('doctor_opd'),clerk=await login('clerk');
    const otherId=crypto.randomUUID();
    app.database.createUser({id:otherId,username:'doctor_opd_second',displayName:'Second OPD doctor',role:'DOCTOR',passwordHash:disabledDemoPasswordHash(),createdAt:Date.now()});
    setUserAccess(app.database,otherId,['DOCTOR'],['opd']);
    const secondDoctor=await login('doctor_opd_second');
    const now=Date.now(),date=opdLocalDate(now),registration=app.database.findUser('registration');
    const addPatient=(key,name)=>{
      const [lastName,firstName]=name.split(' ');
      app.database.upsertPatient({id:crypto.randomUUID(),patientKey:key,userId:registration.id,savedAt:now,
        summary:{caseNumber:key.slice(5),healthId:`ID-${key.slice(5)}`,firstName,lastName,fullName:name,sex:'ស្រី',age:'28',dateOfBirth:'1998-01-01',phone:'012345678',equityCard:'',paymentType:'DIRECT',departmentCode:'opd',departmentNameKh:'ផ្នែកពិគ្រោះក្រៅ',departmentNameEn:'OPD',serviceMode:'opd',entryDate:date,dischargeDate:''},
        data:{'system:workflowStage':'DOCTOR_READY','system:triageStatus':'COMPLETED'}});
      referToOpd(app.database,key,now);
    };
    const transferKey='case:OPD-IPD-XFER';addPatient(transferKey,'SOK DARA');
    const cashierId=app.database.findUser('clerk').id;
    const consultation=addCharge(app.database,transferKey,{serviceCode:'OPD_CONSULT',description:'OPD consultation',quantity:1,unitAmount:12000,currency:'KHR'},cashierId,now);
    addPayment(app.database,transferKey,{invoiceId:consultation.invoiceId,source:'CASH',amount:12000,currency:'KHR'},cashierId,now+1);
    const patientRecord=app.database.findPatient(transferKey),patientData=JSON.parse(patientRecord.record_json);
    patientData['system:opdConsultationPaidAt']=now+1;
    app.database.sqlite.prepare('UPDATE patient_records SET record_json=? WHERE patient_key=?').run(JSON.stringify(patientData),transferKey);
    const candidates=await fetch(origin+'/api/opd/ipd-transfer-candidates',{headers:doctor});
    assert.equal(candidates.status,200,await candidates.clone().text());
    assert.ok((await candidates.json()).patients.some(patient=>patient.patientKey===transferKey));
    const doctorTransferPage=await fetch(origin+'/ipd-transfer',{headers:{Cookie:doctor.Cookie}});
    assert.equal(doctorTransferPage.status,200);
    const clerkTransferPage=await fetch(origin+'/ipd-transfer',{headers:{Cookie:clerk.Cookie}});
    assert.equal(clerkTransferPage.status,403);
    const wardList=await fetch(origin+'/api/opd/ipd-wards',{headers:doctor});
    assert.equal(wardList.status,200,await wardList.clone().text());
    const wards=(await wardList.json()).wards;
    assert.equal(wards.length,10); // v42.1: + Infectious diseases ward
    assert.ok(wards.some(ward=>ward.code==='infectious'));
    assert.ok(wards.some(ward=>ward.code==='obstetric'));
    assert.ok(wards.every(ward=>ward.code!=='opd'));
    const transfer=await fetch(origin+'/api/opd/transfer-to-ipd',{method:'POST',headers:doctor,body:JSON.stringify({patientKey:transferKey,wardCode:'obstetric'})});
    assert.equal(transfer.status,200,await transfer.clone().text());
    const transferred=await transfer.json();
    assert.equal(transferred.patient.serviceMode,'ipd');
    assert.equal(transferred.patient.departmentCode,'obstetric');
    assert.equal(transferred.patient.data['system:admissionStatus'],'waiting-transfer');
    const repeat=await fetch(origin+'/api/opd/transfer-to-ipd',{method:'POST',headers:doctor,body:JSON.stringify({patientKey:transferKey,wardCode:'medicine'})});
    assert.equal(repeat.status,409);
    const opdQueue=await(await fetch(`${origin}/api/opd/queue?date=${date}`,{headers:doctor})).json();
    assert.ok(!opdQueue.patients.some(item=>item.patientKey===transferKey));
    const wardDoctor=await login('doctor_obstetric');
    const wardInbox=await(await fetch(origin+'/api/messages?box=inbox',{headers:wardDoctor})).json();
    assert.ok(wardInbox.messages.some(message=>message.patientKey===transferKey&&(/(transferred from OPD to Obstetric|បញ្ជូនពីផ្នែកពិគ្រោះក្រៅ)/i.test(message.body))));

    const paymentKey='case:OPD-PAID-ALERT';addPatient(paymentKey,'CHAN SOPHEA');
    const charge=await fetch(origin+'/api/finance/charges',{method:'POST',headers:clerk,body:JSON.stringify({patientKey:paymentKey,description:'OPD consultation',quantity:1,unitAmount:12000,currency:'KHR'})});
    assert.equal(charge.status,201,await charge.clone().text());
    const invoice=(await charge.json()).bill.invoice.id;
    const paid=await fetch(origin+'/api/finance/complete-payment',{method:'POST',headers:clerk,body:JSON.stringify({patientKey:paymentKey,invoiceId:invoice,paymentSubtype:'FULL'})});
    assert.equal(paid.status,201,await paid.clone().text());
    for(const opdDoctor of [doctor,secondDoctor]){
      const inbox=await(await fetch(origin+'/api/messages?box=inbox',{headers:opdDoctor})).json();
      const alert=inbox.messages.find(message=>message.patientKey===paymentKey&&message.subject==='Cashier payment completed');
      assert.ok(alert,'each OPD doctor sees the settled payment in the shared OPD inbox');
      assert.match(alert.body,/12,000 ៛/);
    }

    const finalBalanceKey='case:OPD-FINAL-PARTIAL';addPatient(finalBalanceKey,'LY SOKHA');
    const secondCharge=await fetch(origin+'/api/finance/charges',{method:'POST',headers:clerk,body:JSON.stringify({patientKey:finalBalanceKey,description:'OPD laboratory test',quantity:1,unitAmount:8000,currency:'KHR'})});
    assert.equal(secondCharge.status,201,await secondCharge.clone().text());
    const secondInvoice=(await secondCharge.json()).bill.invoice.id;
    const finalPayment=await fetch(origin+'/api/finance/payments',{method:'POST',headers:clerk,body:JSON.stringify({patientKey:finalBalanceKey,invoiceId:secondInvoice,source:'CASH',amount:8000,currency:'KHR'})});
    assert.equal(finalPayment.status,201,await finalPayment.clone().text());
    for(const opdDoctor of [doctor,secondDoctor]){
      const inbox=await(await fetch(origin+'/api/messages?box=inbox',{headers:opdDoctor})).json();
      assert.ok(inbox.messages.some(message=>message.patientKey===finalBalanceKey&&message.subject==='Cashier payment completed'));
    }
  } finally {
    await new Promise(resolve=>app.server.close(resolve));
    app.database.close();
  }
});
