import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {createEmrServer} from '../server/server.mjs';
import {setUserAccess} from '../server/access.mjs';
import {createOrder,getOrder,updateOrder,ensureParaclinicSchema} from '../server/paraclinic.mjs';

test('released lab and imaging reports require the first doctor confirmation, then retain each later doctor view with ward and CSRF checks',async()=>{
  const port=32378,origin=`http://127.0.0.1:${port}`;
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  const first=app.database.findUser('doctor_medicine').id,admin=app.database.findUser('admin').id;
  const second=crypto.randomUUID();app.database.createUser({id:second,username:'doctor_second177',displayName:'Doctor Two',passwordHash:'unused',role:'DOCTOR',createdAt:Date.now()});setUserAccess(app.database,second,['DOCTOR'],['medicine']);
  const patientKey='case:SEEN177';app.database.upsertPatient({id:crypto.randomUUID(),patientKey,userId:admin,savedAt:Date.now(),summary:{caseNumber:'SEEN177',healthId:'SEEN177',firstName:'Seen',lastName:'Test',fullName:'Seen Test',sex:'ប្រុស',age:'40',dateOfBirth:'1986-01-01',phone:'',equityCard:'',paymentType:'DIRECT',departmentCode:'medicine',departmentNameKh:'ផ្នែកជំងឺទូទៅ',departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:'2026-10-03',dischargeDate:''},data:{'system:currentWardCode':'medicine'}});
  await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
  try{
    async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return {Cookie,Origin:origin,'X-CSRF-Token':me.csrfToken};}
    const headers=await login('doctor_medicine'),later=await login('doctor_second177'),nurse=await login('nurse_medicine'),lab=await login('lab'),outside=await login('doctor_pediatric');
    for(const modality of ['LAB','XRAY']){
      const order=createOrder(app.database,{patientKey,modality,userId:first,role:'DOCTOR',ward:'medicine',request:modality==='LAB'?{items:[{code:'K'}]}:{examination:'Chest'}});
      const route=origin+`/api/paraclinic/orders/${order.id}`;
      const post=(action,h=headers)=>fetch(route+'/'+action,{method:'POST',headers:h});
      assert.equal((await post('review')).status,409,'unreleased reports cannot be acknowledged');
      updateOrder(app.database,order.id,{release:true,result:modality==='LAB'?{items:[{code:'K',value:2.8,unit:'mmol/L'}]}:{findings:'Example finding'}},{role:'ADMIN',userId:admin});
      assert.equal((await post('view')).status,409,'opening a result before confirmation must not stamp it');
      await fetch(route,{headers});await fetch(origin+'/api/paraclinic/orders?patientKey='+encodeURIComponent(patientKey),{headers});
      assert.equal(getOrder(app.database,order.id).seenBy.length,0,'GET and worklist polling have no side effect');
      for(const unauthorized of [nurse,lab,outside,{...headers,'X-CSRF-Token':'invalid'}])assert.equal((await post('review',unauthorized)).status,403);
      let response=await post('review');assert.equal(response.status,200);const original=(await response.json()).order;
      assert.equal(original.reviewedBy,first);assert.equal(original.seenBy.length,1);assert.equal(original.seenBy[0].firstAcknowledgment,true);
      assert.equal((await post('view',later)).status,200);
      const seen=getOrder(app.database,order.id);assert.equal(seen.reviewedBy,first);assert.equal(seen.reviewedAt,original.reviewedAt);assert.equal(seen.seenBy.length,2);assert.equal(seen.seenBy.find(v=>v.userId===second).doctorName,'Doctor Two');
      assert.equal((await post('view',later)).status,200);assert.deepEqual(getOrder(app.database,order.id).seenBy,seen.seenBy,'repeat opening preserves the recorded time and avoids duplicates');
      ensureParaclinicSchema(app.database);assert.deepEqual(getOrder(app.database,order.id).seenBy,seen.seenBy,'startup migration preserves all doctor stamps');
      updateOrder(app.database,order.id,{release:true,result:seen.result},{role:'ADMIN',userId:admin});
      assert.equal(getOrder(app.database,order.id).reviewedAt,null);assert.equal(getOrder(app.database,order.id).seenBy.length,0,'a revised release requires fresh acknowledgment');
      assert.equal((await post('view',later)).status,409);assert.equal((await post('review',later)).status,200);
      assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) n FROM paraclinic_result_views WHERE order_id=?').get(order.id).n,3,'the prior release history remains stored');
    }
  }finally{await new Promise(r=>app.server.close(r));app.database.close();}
});
