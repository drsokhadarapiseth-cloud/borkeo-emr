import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';
import { recordMovement } from '../server/daily-report.mjs';

test('Admin and Director share direct message completion and patient transfer records',async()=>{
  const origin='http://127.0.0.1:32246';
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32246,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  await new Promise(resolve=>app.server.listen(32246,'127.0.0.1',resolve));
  try{
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      assert.equal(response.status,200);
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const session=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'X-CSRF-Token':session.csrfToken,'Content-Type':'application/json'};
    };
    const doctor=await login('doctor_opd'),admin=await login('admin'),director=await login('director'),triage=await login('triage'),registration=await login('registration'),pharmacy=await login('pharmacy');
    const send=async destinationType=>{
      const response=await fetch(origin+'/api/messages',{method:'POST',headers:doctor,
        body:JSON.stringify({destinationType,subject:`Direct message to ${destinationType}`,body:'Please review this note.'})});
      assert.equal(response.status,201,await response.text());
    };
    await send('ADMIN');await send('DIRECTOR');
    const direct=async headers=>(await(await fetch(origin+'/api/messages?box=direct',{headers})).json()).messages;
    const adminMessages=await direct(admin),directorMessages=await direct(director);
    assert.deepEqual(adminMessages.map(row=>row.destinationType).sort(),['ADMIN','DIRECTOR']);
    assert.deepEqual(directorMessages.map(row=>row.id),adminMessages.map(row=>row.id));
    const message=adminMessages.find(row=>row.destinationType==='ADMIN');
    assert.equal((await fetch(origin+`/api/messages/${message.id}/read`,{method:'POST',headers:director})).status,200);
    assert.equal((await direct(admin)).length,2,'reading is not shared completion');
    assert.equal((await fetch(origin+`/api/messages/${message.id}/complete`,{method:'POST',headers:doctor})).status,404,'sender cannot complete the management task');
    assert.equal((await fetch(origin+`/api/messages/${message.id}/complete`,{method:'POST',headers:director})).status,200);
    assert.equal((await direct(admin)).length,1);
    assert.equal((await direct(director)).length,1);
    const history=(await(await fetch(origin+'/api/messages?box=direct&state=completed',{headers:admin})).json()).messages;
    assert.equal(history[0].id,message.id);assert.ok(history[0].completedAt);assert.ok(history[0].completedBy);
    await send('ADMIN');
    assert.equal((await direct(director)).length,2,'later messages stay pending');

    const now=new Date().toISOString().slice(0,10);
    const opdKey='case:ADMIN-OPD-1',ipdKey='case:ADMIN-IPD-1';
    for(const [patientKey,serviceMode,departmentCode] of [[opdKey,'opd','opd'],[ipdKey,'ipd','medicine']]){
      const registeredSummary={caseNumber:patientKey.slice(5),fullName:patientKey,sex:'ស្រី',age:'22',entryDate:now,
        departmentCode:'',departmentNameKh:'',serviceMode:''};
      const registered=await fetch(origin+'/api/patient-record',{method:'PUT',headers:registration,
        body:JSON.stringify({patientKey,summary:registeredSummary,data:{'scope:registration:id:emr_pmrs_case_new':true}})});
      assert.equal(registered.status,200,await registered.text());
      const triaged=await fetch(origin+'/api/patient-record',{method:'PUT',headers:triage,
        body:JSON.stringify({patientKey,summary:{...registeredSummary,departmentCode,departmentNameKh:departmentCode,serviceMode},data:{'scope:triage:id:p2_temp':'37.0'}})});
      assert.equal(triaged.status,200,await triaged.text());
    }
    recordMovement(app.database,{patientKey:ipdKey,eventType:'INTERNAL_TRANSFER',fromWardCode:'medicine',toWardCode:'surgery',
      fromDepartmentCode:'medicine',toDepartmentCode:'surgery',eventAt:Date.now(),createdBy:app.database.findUser('admin').id});
    const transfers=await(await fetch(origin+'/api/admin/patient-transfers',{headers:director})).json();
    assert.ok(transfers.transfers.some(item=>item.patientKey===opdKey&&item.eventType==='TRIAGE_REFERRAL'&&item.toWard==='opd'));
    assert.ok(transfers.transfers.some(item=>item.patientKey===ipdKey&&item.eventType==='TRIAGE_REFERRAL'));
    assert.ok(transfers.transfers.some(item=>item.patientKey===ipdKey&&item.eventType==='INTERNAL_TRANSFER'&&item.toWard==='surgery'));
    assert.equal((await fetch(origin+'/api/admin/patient-transfers',{headers:pharmacy})).status,403);
  }finally{await new Promise(resolve=>app.server.close(resolve));app.database.close();}
});
