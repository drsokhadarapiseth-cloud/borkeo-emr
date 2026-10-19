import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { opdLocalDate } from '../server/opd-queue.mjs';

test('triage numbers OPD referrals once, doctors see the alert, and Pharmacy confirms only the latest prescription',async()=>{
  const origin='http://127.0.0.1:32245';
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32245,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  await new Promise(resolve=>app.server.listen(32245,'127.0.0.1',resolve));
  try{
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      assert.equal(response.status,200,username);
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'X-CSRF-Token':me.csrfToken,'Content-Type':'application/json'};
    };
    const triage=await login('triage'),registration=await login('registration'),doctor=await login('doctor_opd'),pharmacy=await login('pharmacy'),admin=await login('admin'),other=await login('doctor_medicine'),clerk=await login('clerk');
    const today=opdLocalDate();
    const summary={caseNumber:'OPD-Q-1',healthId:'TEST-Q',firstName:'First',lastName:'Patient',fullName:'First Patient',sex:'ប្រុស',age:'30',departmentCode:'opd',departmentNameKh:'ផ្នែកពិគ្រោះក្រៅ',departmentNameEn:'OPD',serviceMode:'opd',entryDate:today};
    const patientKey='case:OPD-Q-1';
    let version;
    const save=async(headers,data={},options={})=>{
      const response=await fetch(origin+'/api/patient-record',{method:'PUT',headers,
        body:JSON.stringify({patientKey,summary,data,expectedVersion:version,...options})});
      const body=await response.json();assert.equal(response.status,200,JSON.stringify(body));version=body.patient.version;return body;
    };
    const registered=await save(registration,{'scope:registration:id:emr_pmrs_case_new':true});
    assert.equal(registered.patient.triageStatus,'WAITING');
    const referred=await save(triage,{});
    assert.ok(Number.isInteger(referred.opdQueue.number) && referred.opdQueue.number > 0);
    assert.equal(referred.opdQueue.status,'WAITING');
    const retryTriage = await fetch(origin+'/api/patient-record',{method:'PUT',headers:triage,body:JSON.stringify({patientKey,summary,data:{}})});
    assert.equal(retryTriage.status,409,'completed triage cannot be edited again');
    const queueEndpoint=origin+'/api/opd/queue?date='+today;
    const queue=await(await fetch(queueEndpoint,{headers:doctor})).json();
    assert.deepEqual(queue.patients.map(row=>row.number),[referred.opdQueue.number],'Waiting list shows the original referral number; consultation remains cashier gated');
    const publicOpdBoard=await(await fetch(origin+'/api/queue/display?service=OPD')).json();
    assert.deepEqual(publicOpdBoard.waiting,[],'the OPD TV board hides patients before consultation payment');
    const callBeforePayment=await fetch(origin+'/api/queue/call',{method:'POST',headers:doctor,body:JSON.stringify({service:'OPD',counter:'1',patientKey,queueNumber:referred.opdQueue.number})});
    assert.equal(callBeforePayment.status,409,'the server rejects a direct call before consultation payment');
    assert.equal((await fetch(queueEndpoint,{headers:other})).status,403);
    const doctorInbox=await(await fetch(origin+'/api/messages',{headers:doctor})).json();
    assert.equal(doctorInbox.messages.length,0,'Triage must not unlock or directly message the full OPD consultation.');
    const secondKey='case:OPD-Q-2';
    const secondSummary={...summary,caseNumber:'OPD-Q-2',fullName:'Second Patient',firstName:'Second'};
    const registeredSecond=await fetch(origin+'/api/patient-record',{method:'PUT',headers:registration,
      body:JSON.stringify({patientKey:secondKey,summary:secondSummary,data:{'scope:registration:id:emr_pmrs_case_old':true}})});
    assert.equal(registeredSecond.status,200,await registeredSecond.text());
    const nextReferral=await fetch(origin+'/api/patient-record',{method:'PUT',headers:triage,
      body:JSON.stringify({patientKey:secondKey,summary:secondSummary,data:{}})});
    assert.equal(nextReferral.status,200);
    const nextReferralBody=await nextReferral.json();
    assert.equal(nextReferralBody.opdQueue.number,referred.opdQueue.number+1);
    assert.deepEqual((await fetch(queueEndpoint,{headers:doctor}).then(r=>r.json())).patients.map(item=>item.number),[referred.opdQueue.number,nextReferralBody.opdQueue.number],'Both referrals appear in waiting order while consultations stay locked');

    const triagePaymentQueue=await(await fetch(origin+`/api/finance/patients?view=queue&q=${encodeURIComponent('OPD-Q-1')}`,{headers:clerk})).json();
    assert.equal(triagePaymentQueue.patients.length,1,'triage sends the consultation-fee invoice to Cashier');
    const firstConsultBlocked=await fetch(origin+'/api/patient-record',{method:'PUT',headers:doctor,body:JSON.stringify({patientKey,summary,data:{'scope:medical:id:opd_note':'Should wait for payment'},expectedVersion:version})});
    assert.equal(firstConsultBlocked.status,409,'the doctor cannot save the consultation before Cashier payment');
    const cashierBill=await(await fetch(origin+'/api/finance/patient?patientKey='+encodeURIComponent(patientKey),{headers:clerk})).json();
    const payment=await fetch(origin+'/api/finance/payments',{method:'POST',headers:clerk,body:JSON.stringify({patientKey,invoiceId:cashierBill.bill.invoice.id,source:'CASH',amount:cashierBill.bill.summary.KHR.balance,currency:'KHR'})});
    assert.equal(payment.status,201,await payment.text());
    const afterPaymentQueue=await(await fetch(queueEndpoint,{headers:doctor})).json();
    assert.deepEqual(afterPaymentQueue.patients.map(row=>row.number),[referred.opdQueue.number,nextReferralBody.opdQueue.number],'Payment keeps the waiting numbers unchanged');
    const paymentAlert=await(await fetch(origin+'/api/messages',{headers:doctor})).json();
    assert.ok(paymentAlert.messages.some(message=>message.patientKey===patientKey&&message.subject==='Cashier payment completed'));
    version=(await(await fetch(origin+`/api/patient-record?patientKey=${encodeURIComponent(patientKey)}`,{headers:doctor})).json()).patient.version;
    const firstConsult=await fetch(origin+'/api/patient-record',{method:'PUT',headers:doctor,body:JSON.stringify({patientKey,summary,data:{'scope:medical:id:opd_note':'OPD consultation started'},expectedVersion:version})});
    const firstConsultBody=await firstConsult.json();assert.equal(firstConsult.status,200,JSON.stringify(firstConsultBody));version=firstConsultBody.patient.version;
    const medicine={name:'Example 10mg',route:'po',unit:'គ្រាប់',scheduleType:'bid',doseAmount:'1',m:'1',a:'0',e:'1',n:'0',d:'5',total:'10'};
    // An admin can treat in the OPD view. The next doctor should see both
    // authenticated editors while the saved print signature is the last one.
    await save(admin,{'scope:medical:id:opd_note':'Admin examined patient'},{editorScope:'medical'});
    assert.equal((await save(doctor,{'system:opdMedications':JSON.stringify([medicine])})).opdQueue.status,'IN_CONSULTATION');
    const submitted=await save(doctor,{'system:opdMedications':JSON.stringify([medicine])},{submitOpdPrescription:true});
    assert.equal(submitted.opdQueue.status,'SENT_TO_PHARMACY');
    assert.equal((await fetch(queueEndpoint,{headers:doctor}).then(r=>r.json())).patients.some(p=>p.patientKey===patientKey),false,'Completed prescription leaves the waiting-only OPD list');
    const history=await(await fetch(origin+'/api/patient-editor-history?patientKey='+encodeURIComponent(patientKey),{headers:doctor})).json();
    assert.deepEqual(history.entries.filter(entry=>entry.scope==='medical').map(entry=>entry.editorName).slice(0,2),
      [app.database.findUser('doctor_opd').display_name,app.database.findUser('admin').display_name]);
    assert.equal(JSON.parse(submitted.patient.data['system:signature:medical']).signerName,app.database.findUser('doctor_opd').display_name);

    const listUrl=origin+'/api/pharmacy/opd-prescriptions';
    assert.equal((await fetch(listUrl,{headers:doctor})).status,403);
    let list=await(await fetch(listUrl,{headers:pharmacy})).json();
    assert.equal(list.patients.filter(item=>item.patient?.healthId==='TEST-Q').length,1);assert.equal(list.patients.find(item=>item.patient?.healthId==='TEST-Q').dispensedAt,null);
    const firstId=list.patients[0].id;
    const detail=await(await fetch(`${listUrl}/${firstId}`,{headers:pharmacy})).json();
    assert.equal(detail.prescription.medications[0].total,'10');
    assert.equal(detail.prescription.prescriber.signatureDataUrl,'','name attribution works without a drawn signature');
    assert.equal((await fetch(`${listUrl}/${firstId}/received`,{method:'POST',headers:doctor})).status,403);
    medicine.total='20';
    const changed=await save(doctor,{'system:opdMedications':JSON.stringify([medicine])},{submitOpdPrescription:true});
    assert.equal(changed.opdQueue.status,'SENT_TO_PHARMACY');
    list=await(await fetch(listUrl,{headers:pharmacy})).json();
    assert.notEqual(list.patients[0].id,firstId);
    assert.equal(list.patients[0].dispensedAt,null);
    assert.equal((await fetch(`${listUrl}/${firstId}/received`,{method:'POST',headers:pharmacy})).status,409);
    assert.equal((await fetch(`${listUrl}/${list.patients[0].id}/received`,{method:'POST',headers:pharmacy})).status,200);
    list=await(await fetch(listUrl,{headers:pharmacy})).json();
    assert.ok(list.patients[0].dispensedAt);
    assert.equal((await fetch(queueEndpoint,{headers:doctor}).then(r=>r.json())).patients.some(p=>p.patientKey===patientKey),false,'discharged OPD patients leave the active doctor queue');
    const closed=(await (await fetch(origin+'/api/patients',{headers:admin})).json()).patients.find(p=>p.patientKey===patientKey);
    assert.equal(closed.dischargeDate,opdLocalDate(list.patients[0].dispensedAt));
    assert.equal(closed.dischargeAt,list.patients[0].dispensedAt);
    assert.equal(closed.workflowStage,'OPD_DISCHARGED');
    version=closed.version; // Test closure against the current version, not a stale pre-dispensing save.
    const dates=await fetch(origin+'/api/patient-dates',{method:'PATCH',headers:admin,body:JSON.stringify({patientKey,entryDate:today,dischargeDate:'1900-01-01'})});
    assert.equal(dates.status,200);
    const kept=(await dates.json()).patient;
    assert.equal(kept.dischargeDate,closed.dischargeDate,'entry-date editing cannot overwrite the pharmacy discharge date');
    assert.equal(kept.dischargeAt,closed.dischargeAt);
    version=kept.version;
    medicine.total='30';
    const afterReceipt=await fetch(origin+'/api/patient-record',{method:'PUT',headers:doctor,
      body:JSON.stringify({patientKey,summary,data:{'system:opdMedications':JSON.stringify([medicine])},expectedVersion:version,submitOpdPrescription:true})});
    assert.equal(afterReceipt.status,409,'dispensed orders cannot be changed or resubmitted');
    const draftChange=await fetch(origin+'/api/patient-record',{method:'PUT',headers:doctor,
      body:JSON.stringify({patientKey,summary,data:{'system:opdMedications':JSON.stringify([medicine])},expectedVersion:version})});
    assert.equal(draftChange.status,409,'a normal save also cannot alter medicine after dispensing');
    medicine.total='20';
    const postCloseEdit=await fetch(origin+'/api/patient-record',{method:'PUT',headers:doctor,body:JSON.stringify({patientKey,summary,data:{'system:opdMedications':JSON.stringify([medicine]),'scope:medical:id:opd_note':'Follow-up note'},expectedVersion:version})});
    assert.equal(postCloseEdit.status,409,'the OPD clinical case closes after Pharmacy confirms medicine delivery');
    assert.equal((await fetch(listUrl,{headers:pharmacy}).then(r=>r.json())).patients[0].dispensedAt,list.patients[0].dispensedAt);

    app.database.audit({id:crypto.randomUUID(),userId:app.database.findUser('admin').id,subjectUsername:'admin',
      action:'PATIENT_RECORD_SAVED',ipAddress:'local',userAgent:'legacy',details:{patientKey,activeRole:'ADMIN'},occurredAt:Date.now()-86400000});
    const afterLegacy=await(await fetch(origin+'/api/patient-editor-history?patientKey='+encodeURIComponent(patientKey),{headers:doctor})).json();
    assert.ok(afterLegacy.entries.some(entry=>entry.scope==='legacy' && entry.editorName===app.database.findUser('admin').display_name));
  }finally{await new Promise(resolve=>app.server.close(resolve));app.database.close();}
});
