import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';

test('IPD admission needs one management signature and never block admission or OPD', async () => {
  const origin='http://127.0.0.1:32247';
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32247,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  await new Promise(resolve=>app.server.listen(32247,'127.0.0.1',resolve));
  try {
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      assert.equal(response.status,200);
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    };
    const registration=await login('registration');
    const triage=await login('triage');
    const admin=await login('admin');
    const director=await login('director');
    const triageCannotCreate=await fetch(origin+'/api/patient-record',{method:'PUT',headers:triage,body:JSON.stringify({
      patientKey:'case:TRIAGE-NO-REGISTER',summary:{caseNumber:'TRIAGE-NO-REGISTER',fullName:'Blocked Triage Create',sex:'ស្រី',age:'30',entryDate:'2026-09-19'},data:{'scope:triage:id:p2_temp':'37'}})});
    assert.equal(triageCannotCreate.status,400);

    const key='case:ADMISSION-APPROVAL-1';
    const registered=await fetch(origin+'/api/patient-record',{method:'PUT',headers:registration,body:JSON.stringify({patientKey:key,
      summary:{caseNumber:'ADMISSION-APPROVAL-1',healthId:'AA-1',firstName:'Approval',lastName:'Patient',fullName:'Approval Patient',sex:'ប្រុស',age:'40',entryDate:'2026-09-19',departmentCode:'',departmentNameKh:'',serviceMode:''},
      data:{'scope:registration:id:emr_pmrs_case_new':true}})});
    assert.equal(registered.status,200,await registered.text());
    const triaged=await fetch(origin+'/api/patient-record',{method:'PUT',headers:triage,body:JSON.stringify({patientKey:key,
      summary:{caseNumber:'ADMISSION-APPROVAL-1',healthId:'AA-1',firstName:'Approval',lastName:'Patient',fullName:'Approval Patient',sex:'ប្រុស',age:'40',entryDate:'2026-09-19',departmentCode:'medicine',departmentNameKh:'Medicine',serviceMode:'ipd'},
      data:{'scope:triage:id:p2_temp':'37.2'}})});
    assert.equal(triaged.status,200,await triaged.text());

    const patientApproval=await (await fetch(origin+`/api/admission-approvals?patientKey=${encodeURIComponent(key)}`,{headers:registration})).json();
    assert.equal(patientApproval.approval.admin.approved,false);
    assert.equal(patientApproval.approval.director.approved,false);

    let pending=await (await fetch(origin+'/api/admission-approvals/pending',{headers:admin})).json();
    assert.ok(pending.items.some(item=>item.patientKey===key));
    pending=await (await fetch(origin+'/api/admission-approvals/pending',{headers:director})).json();
    assert.ok(pending.items.some(item=>item.patientKey===key));

    const approveAdmin=await fetch(origin+'/api/admission-approvals',{method:'POST',headers:admin,body:JSON.stringify({patientKey:key})});
    assert.equal(approveAdmin.status,200,await approveAdmin.text());
    pending=await (await fetch(origin+'/api/admission-approvals/pending',{headers:admin})).json();
    assert.ok(!pending.items.some(item=>item.patientKey===key));
    pending=await (await fetch(origin+'/api/admission-approvals/pending',{headers:director})).json();
    assert.ok(!pending.items.some(item=>item.patientKey===key));

    const approveDirector=await fetch(origin+'/api/admission-approvals',{method:'POST',headers:director,body:JSON.stringify({patientKey:key})});
    assert.equal(approveDirector.status,200,await approveDirector.text());
    for(const headers of [admin,director]){
      pending=await (await fetch(origin+'/api/admission-approvals/pending',{headers})).json();
      assert.ok(!pending.items.some(item=>item.patientKey===key));
    }

    const opdKey='case:ADMISSION-OPD-1';
    const opdRegistered=await fetch(origin+'/api/patient-record',{method:'PUT',headers:registration,body:JSON.stringify({patientKey:opdKey,
      summary:{caseNumber:'ADMISSION-OPD-1',healthId:'AO-1',firstName:'OPD',lastName:'Patient',fullName:'OPD Patient',sex:'ស្រី',age:'24',entryDate:'2026-09-19',departmentCode:'',departmentNameKh:'',serviceMode:''},
      data:{'scope:registration:id:emr_pmrs_case_old':true}})});
    assert.equal(opdRegistered.status,200,await opdRegistered.text());
    const opdTriaged=await fetch(origin+'/api/patient-record',{method:'PUT',headers:triage,body:JSON.stringify({patientKey:opdKey,
      summary:{caseNumber:'ADMISSION-OPD-1',healthId:'AO-1',firstName:'OPD',lastName:'Patient',fullName:'OPD Patient',sex:'ស្រី',age:'24',entryDate:'2026-09-19',departmentCode:'opd',departmentNameKh:'OPD',serviceMode:'opd'},
      data:{'scope:triage:id:p2_temp':'36.8'}})});
    assert.equal(opdTriaged.status,200,await opdTriaged.text());
    pending=await (await fetch(origin+'/api/admission-approvals/pending',{headers:admin})).json();
    assert.ok(!pending.items.some(item=>item.patientKey===opdKey));
  } finally {
    await new Promise(resolve=>app.server.close(resolve));
    app.database.close();
  }
});
