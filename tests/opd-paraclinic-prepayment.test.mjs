import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { opdLocalDate } from '../server/opd-queue.mjs';

test('Triage-marked OPD paraclinic orders combine consultation and test fees, then unlock the doctor after results', async () => {
  const origin = 'http://127.0.0.1:32255';
  const app = createEmrServer({ demoMode:true, host:'127.0.0.1', port:32255, appOrigin:origin, databasePath:':memory:', autoDatabase:false, nodeEnv:'test' });
  await new Promise(resolve => app.server.listen(32255, '127.0.0.1', resolve));
  try {
    const login = async username => {
      const response = await fetch(origin + '/api/auth/login', { method:'POST', headers:{ Origin:origin, 'Content-Type':'application/json' }, body:JSON.stringify({ username }) });
      assert.equal(response.status, 200, username);
      const cookie = response.headers.get('set-cookie').split(';')[0];
      const me = await (await fetch(origin + '/api/auth/me', { headers:{ Cookie:cookie } })).json();
      return { Cookie:cookie, Origin:origin, 'Content-Type':'application/json', 'X-CSRF-Token':me.csrfToken };
    };
    const registration = await login('registration');
    const triage = await login('triage');
    const doctor = await login('doctor_opd');
    const clerk = await login('clerk');
    const lab = await login('lab');
    const nurse = await login('nurse_opd');
    const today = opdLocalDate();
    const key = 'case:OPD-PARA-PREPAY-1';
    const registrationSummary = {
      caseNumber:'OPD-PARA-PREPAY-1', healthId:'PARA-1', firstName:'Para', lastName:'Patient', fullName:'Para Patient',
      sex:'ប្រុស', age:'35', dateOfBirth:'', phone:'', equityCard:'', paymentType:'CASH', departmentCode:'',
      departmentNameKh:'', departmentNameEn:'', serviceMode:'', entryDate:today, dischargeDate:'',
    };
    const register = await fetch(origin + '/api/patient-record', {
      method:'PUT', headers:registration,
      body:JSON.stringify({ patientKey:key, summary:registrationSummary, data:{'scope:registration:id:emr_pmrs_case_new':true} }),
    });
    assert.equal(register.status,200,await register.text());

    let version = (await fetch(origin + `/api/patient-record?patientKey=${encodeURIComponent(key)}`, { headers:registration }).then(r=>r.json())).patient.version;
    const opdSummary = { ...registrationSummary, departmentCode:'opd', departmentNameKh:'ពិគ្រោះក្រៅ', departmentNameEn:'OPD', serviceMode:'opd' };
    const triageResponse = await fetch(origin + '/api/patient-record', {
      method:'PUT', headers:triage,
      body:JSON.stringify({ patientKey:key, summary:opdSummary, data:{ 'scope:triage:id:triage_paraclinic':true, 'scope:triage:id:p2_temp':'37.1', 'scope:triage:id:p2_pulse':'80', 'scope:triage:id:p2_resp':'18', 'scope:triage:id:p2_spo2':'98', 'scope:triage:id:p2_weight':'65', 'scope:triage:id:p2_height':'170' }, expectedVersion:version }),
    });
    const triaged = await triageResponse.json();
    assert.equal(triageResponse.status,200,JSON.stringify(triaged));
    version = triaged.patient.version;
    assert.equal(triaged.patient.workflowStage,'OPD_PARACLINIC_ORDERING');
    assert.deepEqual(triaged.patient.triageVitals, {
      temperature:'37.1', systolic:'', diastolic:'', pulse:'80', respiratoryRate:'18',
      oxygenSaturation:'98', weight:'65', height:'170', bloodGlucose:'', glucoseTiming:'',
    });

    const cashierQueueBeforeOrder = await (await fetch(origin + `/api/finance/patients?view=queue&q=${encodeURIComponent('OPD-PARA-PREPAY-1')}`, { headers:clerk })).json();
    assert.equal(cashierQueueBeforeOrder.patients.length,0,'Cashier is not notified until doctor selects the required tests');
    const opdQueue = await (await fetch(origin + `/api/opd/queue?date=${today}&counter=1`, { headers:doctor })).json();
    assert.ok(opdQueue.patients.some(item=>item.patientKey===key),'the test-only patient is visible to OPD doctors');
    const call = await fetch(origin + '/api/queue/call', { method:'POST', headers:doctor, body:JSON.stringify({service:'OPD',counter:'1',patientKey:key}) });
    assert.equal(call.status,200,await call.text());

    const preConsultSave = await fetch(origin + '/api/patient-record', {
      method:'PUT', headers:doctor,
      body:JSON.stringify({ patientKey:key, summary:opdSummary, data:{'scope:medical:id:opd_note':'Should remain locked'}, expectedVersion:version, editorScope:'medical' }),
    });
    assert.equal(preConsultSave.status,409,'OPD consultation/treatment stays locked until paid tests return');

    const orderResponse = await fetch(origin + '/api/paraclinic/orders', {
      method:'POST', headers:doctor,
      body:JSON.stringify({ patientKey:key, modality:'LAB', priority:'ROUTINE', request:{ clinicalInfo:'Fever', items:[{code:'CBC',urgent:false},{code:'CREAT',urgent:false}] } }),
    });
    const created = await orderResponse.json();
    assert.equal(orderResponse.status,201,JSON.stringify(created));
    assert.equal(created.order.status,'PAYMENT_PENDING');
    assert.equal(created.cashierPaymentRequired,true);
    assert.equal(created.order.request.opdHandoff.method,'DIRECT','direct Lab routing is the default');
    assert.match(created.investigationText,/Complete Blood Count \/ FBC \(CBC\)/);
    assert.match(created.investigationText,/Creatinine \(CREAT\)/);

    const nurseFreeResponse=await fetch(origin+'/api/paraclinic/orders',{method:'POST',headers:doctor,body:JSON.stringify({patientKey:key,modality:'LAB',priority:'ROUTINE',chargeMode:'FREE',handoffMode:'NURSE',request:{clinicalInfo:'Nurse-collected free test',items:[{code:'HBA1C',urgent:false}]}})});
    const nurseFree=await nurseFreeResponse.json();
    assert.equal(nurseFreeResponse.status,201,JSON.stringify(nurseFree));
    assert.equal(nurseFree.order.status,'PAYMENT_PENDING','the unpaid consultation holds a free nurse-route test until its invoice is settled');
    assert.equal(nurseFree.order.request.chargeMode,'FREE');

    const afterOrder = await (await fetch(origin + `/api/patient-record?patientKey=${encodeURIComponent(key)}`, { headers:doctor })).json();
    version=afterOrder.patient.version;
    assert.equal(afterOrder.patient.workflowStage,'CASHIER_PENDING_PARACLINIC');
    assert.match(afterOrder.patient.data['scope:medical:id:inv_list'],/Complete Blood Count \/ FBC \(CBC\), Creatinine \(CREAT\)/);
    assert.match(afterOrder.patient.data['scope:medical:id:inv_list'],/HbA1c \(HBA1C\)/);
    const cashierQueue = await (await fetch(origin + `/api/finance/patients?view=queue&q=${encodeURIComponent('OPD-PARA-PREPAY-1')}`, { headers:clerk })).json();
    assert.equal(cashierQueue.patients.length,1,'Cashier gets the invoice after the doctor submits the test order');
    assert.equal(cashierQueue.patients[0].paraclinicPaymentPending,true);
    let bill = (await (await fetch(origin + `/api/finance/patient?patientKey=${encodeURIComponent(key)}`, { headers:clerk })).json()).bill;
    assert.ok(bill.charges.some(item=>item.serviceCode==='OPD_CONSULT'),'invoice keeps the consultation charge');
    assert.equal(bill.charges.filter(item=>item.sourceKey?.startsWith(`PARACLINIC:${created.order.id}:`)).length,2,'two selected tests create two test charges');
    assert.equal(bill.charges.filter(item=>item.sourceKey?.startsWith(`PARACLINIC:${nurseFree.order.id}:`)).length,0,'free tests add no paraclinic charge');
    assert.equal(bill.charges.length,3,'consultation and both test fees are combined in one invoice');
    let labOrders=(await(await fetch(origin+'/api/paraclinic/orders?modality=LAB',{headers:lab})).json()).orders;
    assert.ok(!labOrders.some(item=>item.id===created.order.id),'Lab waits for Cashier payment');

    const payment = await fetch(origin + '/api/finance/payments', {
      method:'POST', headers:clerk,
      body:JSON.stringify({ patientKey:key, invoiceId:bill.invoice.id, source:'CASH', amount:bill.summary.KHR.balance, currency:'KHR' }),
    });
    assert.equal(payment.status,201,await payment.text());
    const afterPayment=(await(await fetch(origin+`/api/patient-record?patientKey=${encodeURIComponent(key)}`,{headers:doctor})).json()).patient;
    assert.equal(afterPayment.workflowStage,'PARACLINIC_RESULTS_PENDING','paid test-only visit waits for the result before consultation');
    assert.equal((await(await fetch(origin+`/api/paraclinic/orders?patientKey=${encodeURIComponent(key)}`,{headers:doctor})).json()).orders.find(item=>item.id===created.order.id)?.status,'ORDERED');
    labOrders=(await(await fetch(origin+'/api/paraclinic/orders?modality=LAB',{headers:lab})).json()).orders;
    assert.ok(labOrders.some(item=>item.id===created.order.id),'Lab receives the order after payment');
    assert.ok(!labOrders.some(item=>item.id===nurseFree.order.id),'nurse-routed specimen stays out of the Lab worklist until collected and sent');
    let nurseOrders=(await(await fetch(origin+'/api/opd/nurse-paraclinic-orders',{headers:nurse})).json()).orders;
    assert.ok(nurseOrders.some(item=>item.order.id===nurseFree.order.id),'a free test that was held for the OPD invoice is released to the nurse after payment');
    const nurseAction=async action=>fetch(origin+`/api/opd/nurse-paraclinic-orders/${nurseFree.order.id}/action`,{method:'POST',headers:nurse,body:JSON.stringify({action})});
    assert.equal((await nurseAction('COLLECT')).status,200);
    const sentToLab=await nurseAction('SEND');
    const sentToLabBody=await sentToLab.json();
    assert.equal(sentToLab.status,200,JSON.stringify(sentToLabBody));
    assert.equal(sentToLabBody.order.status,'SENT_TO_LAB');

    const resultResponse=await fetch(origin+`/api/paraclinic/orders/${created.order.id}`,{method:'PATCH',headers:lab,body:JSON.stringify({status:'PROCESSING',release:true,result:{items:[{code:'HGB',value:13.2,unit:'g/dL'}]}})});
    const released=await resultResponse.json();
    assert.equal(resultResponse.status,200,JSON.stringify(released));
    assert.equal(released.investigationText,'','results remain in their report, not in the request field');
    const ready=(await(await fetch(origin+`/api/patient-record?patientKey=${encodeURIComponent(key)}`,{headers:doctor})).json()).patient;
    assert.equal(ready.workflowStage,'PARACLINIC_RESULTS_PENDING','consultation stays locked while another ordered test is in progress');
    const nurseReceived=await fetch(origin+`/api/paraclinic/orders/${nurseFree.order.id}`,{method:'PATCH',headers:lab,body:JSON.stringify({status:'RECEIVED'})});
    assert.equal(nurseReceived.status,200,await nurseReceived.text());
    const nurseResult=await fetch(origin+`/api/paraclinic/orders/${nurseFree.order.id}`,{method:'PATCH',headers:lab,body:JSON.stringify({status:'PROCESSING',release:true,result:{items:[{code:'HBA1C',value:'5.5',unit:'%'}]}})});
    assert.equal(nurseResult.status,200,await nurseResult.text());
    const finalReady=(await(await fetch(origin+`/api/patient-record?patientKey=${encodeURIComponent(key)}`,{headers:doctor})).json()).patient;
    assert.equal(finalReady.workflowStage,'DOCTOR_READY','doctor can begin the OPD form after every ordered test returns');
    assert.match(finalReady.data['scope:medical:id:inv_list'],/Complete Blood Count \/ FBC \(CBC\)/);
    assert.match(finalReady.data['scope:medical:id:inv_list'],/Creatinine \(CREAT\)/);
    assert.doesNotMatch(finalReady.data['scope:medical:id:inv_list'],/Laboratory result/,'request field contains orders only; released results remain separate');
    assert.match(finalReady.data['scope:medical:id:inv_list'],/HBA1C/,'nurse-collected test is imported to the same investigation section');

    const followUpResponse=await fetch(origin+'/api/paraclinic/orders',{method:'POST',headers:doctor,body:JSON.stringify({patientKey:key,modality:'LAB',priority:'ROUTINE',chargeMode:'PAID',handoffMode:'DIRECT',request:{clinicalInfo:'Further test after initial results',items:[{code:'ALT',urgent:false}]}})});
    const followUp=await followUpResponse.json();
    assert.equal(followUpResponse.status,201,JSON.stringify(followUp));
    assert.equal(followUp.order.status,'PAYMENT_PENDING','a later pre-consult paid order must wait for Cashier even after the first tests completed');
    assert.equal(followUp.cashierPaymentRequired,true);
    labOrders=(await(await fetch(origin+'/api/paraclinic/orders?modality=LAB',{headers:lab})).json()).orders;
    assert.ok(!labOrders.some(item=>item.id===followUp.order.id),'the later request is hidden from Lab until Cashier confirms payment');
    const followUpQueue=await(await fetch(origin+`/api/finance/patients?view=queue&q=${encodeURIComponent('OPD-PARA-PREPAY-1')}`,{headers:clerk})).json();
    assert.equal(followUpQueue.patients.length,1,'Cashier sees the additional invoice after the doctor sends another test');
    assert.equal(followUpQueue.patients[0].paraclinicPaymentPending,true);
    bill=(await(await fetch(origin+`/api/finance/patient?patientKey=${encodeURIComponent(key)}`,{headers:clerk})).json()).bill;
    assert.equal(bill.charges.filter(item=>item.sourceKey?.startsWith(`PARACLINIC:${followUp.order.id}:`)).length,1,'the later test has its own charge on the new invoice');
    assert.equal(bill.charges.filter(item=>item.sourceKey?.startsWith(`PARACLINIC:${created.order.id}:`)||item.sourceKey?.startsWith(`PARACLINIC:${nurseFree.order.id}:`)).length,0,'the completed earlier invoice is not added to the new invoice');
    const followUpPayment=await fetch(origin+'/api/finance/payments',{method:'POST',headers:clerk,body:JSON.stringify({patientKey:key,invoiceId:bill.invoice.id,source:'CASH',amount:bill.summary.KHR.balance,currency:'KHR'})});
    assert.equal(followUpPayment.status,201,await followUpPayment.text());
    const afterFollowUpPayment=(await(await fetch(origin+`/api/paraclinic/orders?patientKey=${encodeURIComponent(key)}`,{headers:doctor})).json()).orders.find(item=>item.id===followUp.order.id);
    assert.equal(afterFollowUpPayment.status,'ORDERED','Cashier payment releases the later request to Lab');
    labOrders=(await(await fetch(origin+'/api/paraclinic/orders?modality=LAB',{headers:lab})).json()).orders;
    assert.ok(labOrders.some(item=>item.id===followUp.order.id),'Lab receives the later order only after it is paid');
    const followUpResult=await fetch(origin+`/api/paraclinic/orders/${followUp.order.id}`,{method:'PATCH',headers:lab,body:JSON.stringify({status:'PROCESSING',release:true,result:{items:[{code:'ALT',value:19,unit:'U/L'}]}})});
    assert.equal(followUpResult.status,200,await followUpResult.text());
    const readyAfterFollowUp=(await(await fetch(origin+`/api/patient-record?patientKey=${encodeURIComponent(key)}`,{headers:doctor})).json()).patient;
    assert.equal(readyAfterFollowUp.workflowStage,'DOCTOR_READY','doctor can continue after the additional paid result returns');
    const clinicalSave=await fetch(origin+'/api/patient-record',{method:'PUT',headers:doctor,body:JSON.stringify({patientKey:key,summary:opdSummary,data:{'scope:medical:id:opd_note':'Consult after laboratory result'},expectedVersion:readyAfterFollowUp.version,editorScope:'medical'})});
    assert.equal(clinicalSave.status,200,await clinicalSave.text());
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
