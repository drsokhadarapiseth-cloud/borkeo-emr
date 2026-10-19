import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';

test('v13.6 manages appointments, department fees, and approved exchange rates',async()=>{
  const origin='http://127.0.0.1:32256';
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32256,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  await new Promise(resolve=>app.server.listen(32256,'127.0.0.1',resolve));
  try{
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      assert.equal(response.status,200,username);
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'X-CSRF-Token':me.csrfToken,'Content-Type':'application/json'};
    };
    const registration=await login('registration'),clerk=await login('clerk'),director=await login('director');
    const created=await fetch(origin+'/api/appointments',{method:'POST',headers:registration,body:JSON.stringify({patientName:'Appointment Patient',phone:'012345678',appointmentDate:'2026-09-24',appointmentTime:'09:30',departmentCode:'opd',reason:'Follow-up'})});
    assert.equal(created.status,201);
    const appointment=(await created.json()).appointment;
    const called=await fetch(`${origin}/api/appointments/${appointment.id}/status`,{method:'POST',headers:registration,body:JSON.stringify({status:'CALLED'})});
    assert.equal(called.status,200);
    assert.equal((await called.json()).appointment.status,'CALLED');

    let catalog=await(await fetch(origin+'/api/finance/services',{headers:clerk})).json();
    assert.deepEqual(catalog.services.filter(item=>['CT_SCAN','MRI'].includes(item.code)),[],'cashiers only see services in the replacement fee schedule');
    assert.equal(catalog.categories.find(item=>item.code==='EYE_CARE')?.labelEn,'Eyes Care Facility');
    assert.equal(catalog.services.find(item=>item.code==='EYE_VISION_TEST')?.defaultAmount,5000);
    const edited=await fetch(origin+'/api/finance/services',{method:'POST',headers:director,body:JSON.stringify({code:'OBGYN_DELIVERY',categoryCode:'PROCEDURE',departmentCode:'gyneco-obstetric',nameEn:'Delivery service',nameKh:'សេវាសម្រាលកូន',defaultAmount:120000,currency:'KHR',unitLabel:'case',active:true})});
    assert.equal(edited.status,200);
    assert.equal((await edited.json()).service.departmentCode,'gyneco-obstetric');

    const proposal=await fetch(origin+'/api/finance/exchange-rates',{method:'POST',headers:clerk,body:JSON.stringify({khrPerUsd:4100})});
    assert.equal(proposal.status,201);
    const rate=(await proposal.json()).rate;
    const approval=await fetch(`${origin}/api/finance/exchange-rates/${rate.id}/review`,{method:'POST',headers:director,body:JSON.stringify({approved:true,note:'Approved for cashier use'})});
    assert.equal(approval.status,200);
    assert.equal((await approval.json()).active.khrPerUsd,4100);
  }finally{await new Promise(resolve=>app.server.close(resolve));app.database.close();}
});
