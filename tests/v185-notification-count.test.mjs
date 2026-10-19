import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {createEmrServer} from '../server/server.mjs';
import {createStaffMessage,markStaffMessageRead,completeStaffMessage} from '../server/messages.mjs';
import {setUserAccess} from '../server/access.mjs';

test('Notification totals count all pending messages and remain scoped to the recipient ward/role, with shared completion and stable history counts',async()=>{
 const port=32988,origin=`http://127.0.0.1:${port}`,app=createEmrServer({demoMode:true,host:'127.0.0.1',port,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'}),db=app.database,actor=db.findUser('admin').id;
 const nurse2Id=crypto.randomUUID();db.createUser({id:nurse2Id,username:'bell_nurse2',displayName:'Second Nurse',role:'NURSE',passwordHash:'unused',createdAt:Date.now()});setUserAccess(db,nurse2Id,['NURSE'],['medicine']);
 const send=(values={})=>createStaffMessage(db,{senderUserId:actor,senderRole:'ADMIN',destinationType:'WARD',destinationCode:'medicine',destinationRole:'NURSE',subject:'Review patient task',body:'Pending work',...values});
 const medicine=Array.from({length:115},()=>send());send({destinationCode:'pediatric'});send({destinationRole:'DOCTOR'});send({destinationRole:''});send({destinationType:'ADMIN',destinationCode:''});send({destinationType:'DIRECTOR',destinationCode:''});send({destinationType:'LAB',destinationCode:''});
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);return {Cookie:r.headers.get('set-cookie').split(';')[0]};}
 const get=(path,headers)=>fetch(origin+path,{headers});
 const inbox=async(h,suffix='')=>(await(await get('/api/messages?limit=100'+suffix,h)).json());
 try{
  const nurse=await login('nurse_medicine'),nurse2=await login('bell_nurse2'),doctor=await login('doctor_medicine'),pediatric=await login('nurse_pediatric'),admin=await login('admin'),director=await login('director'),lab=await login('lab'),cashier=await login('clerk');
  let result=await inbox(nurse);assert.equal(result.messages.length,100);assert.equal(result.pendingCount,116,'total is not capped by the visible message list');
  assert.equal((await inbox(nurse2)).pendingCount,116);assert.equal((await inbox(doctor)).pendingCount,2);assert.equal((await inbox(pediatric)).pendingCount,1);assert.equal((await inbox(admin)).pendingCount,2);assert.equal((await inbox(director)).pendingCount,2);assert.equal((await inbox(lab)).pendingCount,1);
  markStaffMessageRead(db,medicine[0].id,db.findUser('nurse_medicine').id);assert.equal((await inbox(nurse)).pendingCount,116,'reading keeps unfinished work in the bell');
  completeStaffMessage(db,medicine[0].id,{userId:db.findUser('nurse_medicine').id,role:'NURSE',wardCode:'medicine'});assert.equal((await inbox(nurse)).pendingCount,115);assert.equal((await inbox(nurse2)).pendingCount,115,'another nurse sees the same completed work disappear');
  result=await inbox(nurse,'&state=completed');assert.equal(result.messages.length,1);assert.equal(result.pendingCount,115,'history view does not change the bell to zero');
  assert.equal((await inbox(doctor)).pendingCount,2);assert.equal((await inbox(pediatric)).pendingCount,1);assert.equal((await get('/api/messages',cashier)).status,200,'Cashier may receive feedback addressed specifically to its role');assert.equal((await get('/api/messages')).status,401);
 }finally{await new Promise(r=>app.server.close(r));db.close();}
});
