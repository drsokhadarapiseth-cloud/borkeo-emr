import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {createEmrServer} from '../server/server.mjs';
import {addCharge,addPayment,patientBill,setFinanceProfile,startPatientInvoice} from '../server/finance.mjs';

async function fixture(port){
 const origin=`http://127.0.0.1:${port}`,app=createEmrServer({demoMode:true,host:'127.0.0.1',port,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'}),db=app.database,actor=db.findUser('admin').id;
 function seed(name){const patientKey='case:V183-'+name,summary={caseNumber:'V183-'+name,healthId:'H183-'+name,firstName:name,lastName:'Test',fullName:name+' Test',sex:'M',age:'40',dateOfBirth:'',phone:'',equityCard:'',paymentType:'DIRECT',departmentCode:'medicine',departmentNameKh:'ផ្នែកជំងឺទូទៅ',departmentNameEn:'Medicine',serviceMode:'ipd',entryDate:'2026-10-04',dischargeDate:''};db.upsertPatient({id:crypto.randomUUID(),patientKey,summary,data:{'system:currentWardCode':'medicine'},userId:actor,savedAt:Date.now()});setFinanceProfile(db,patientKey,{paymentType:'DIRECT',paymentSubtype:'FULL'},actor);return patientKey;}
 await new Promise(r=>app.server.listen(port,'127.0.0.1',r));
 async function login(username){const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return{Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};}
 const get=(path,headers)=>fetch(origin+path,{headers,redirect:'manual'});
 const post=(path,headers,body,method='POST')=>fetch(origin+path,{method,headers,body:JSON.stringify(body)});
 const close=async()=>{await new Promise(r=>app.server.close(r));db.close();};
 return{app,db,actor,seed,login,get,post,close};
}

test('Cashier landing and shared ward payment alerts survive opening and partial payment, then disappear on settlement',async()=>{
 const f=await fixture(32983),{db,actor,seed,login,get,post}=f;
 try{
  const clerk=await login('clerk'),acct=await login('accountant'),nurse=await login('nurse_medicine'),admin=await login('admin');
  for(const h of[clerk,acct]){const root=await get('/',h),home=await get('/home',h);assert.equal(root.headers.get('location'),'/billing');assert.equal(home.status,302);assert.equal(home.headers.get('location'),'/billing');}
  const opened=seed('Opened'),unread=seed('Unread');
  const a=addCharge(db,opened,{description:'Opened ward fee',quantity:1,unitAmount:10000,currency:'KHR'},actor),b=addCharge(db,unread,{description:'Unread ward fee',quantity:1,unitAmount:5000,currency:'KHR'},actor);
  for(const patientKey of[opened,unread])assert.equal((await post('/api/finance/send-to-cashier',nurse,{patientKey})).status,200);
  const notices=async h=>(await(await get('/api/finance/cashier-alerts',h)).json()).payments;
  assert.equal((await notices(clerk)).length,2);assert.equal((await notices(acct)).length,2);
  assert.equal((await get('/api/finance/patient?patientKey='+encodeURIComponent(opened)+'&invoiceId='+a.invoiceId,clerk)).status,200);
  assert.equal((await notices(clerk)).length,2,'opening an invoice never completes its payment alert');
  assert.equal((await post('/api/finance/payments',clerk,{patientKey:opened,invoiceId:a.invoiceId,source:'CASH',amount:3000,currency:'KHR'})).status,201);
  assert.equal((await notices(clerk)).length,2,'partial payment leaves alert active');
  assert.equal((await post('/api/finance/complete-payment',clerk,{patientKey:opened,invoiceId:a.invoiceId,paymentType:'DIRECT',paymentSubtype:'FULL'})).status,201);
  assert.deepEqual((await notices(acct)).map(n=>n.invoiceId),[b.invoiceId]);
  assert.equal((await post('/api/finance/complete-payment',clerk,{patientKey:unread,invoiceId:b.invoiceId,paymentType:'DIRECT',paymentSubtype:'FULL'})).status,201);
  assert.equal((await notices(clerk)).length,0,'unopened alert also disappears once another Cashier pays it');
  assert.equal((await notices(acct)).length,0);
  assert.equal((await get('/api/finance/cashier-alerts',nurse)).status,403);assert.equal((await get('/api/finance/cashier-alerts')).status,401);
  assert.equal((await(await get('/api/finance/cashier-alerts',admin)).json()).payments.length,0);
 }finally{await f.close();}
});

test('Paid invoice corrections require manager approval, belong to their requester, are audited and consumed once without altering payments',async()=>{
 const f=await fixture(32984),{db,actor,seed,login,get,post}=f;
 try{
  const key=seed('Approval'),clerk=await login('clerk'),acct=await login('accountant'),admin=await login('admin'),director=await login('director'),nurse=await login('nurse_medicine');
  const charge=addCharge(db,key,{description:'Original paid fee',quantity:2,unitAmount:5000,currency:'KHR'},actor),payment=addPayment(db,key,{invoiceId:charge.invoiceId,source:'CASH',amount:10000,currency:'KHR'},actor);
  const patientBefore=db.findPatient(key).record_json,paymentBefore=db.sqlite.prepare('SELECT * FROM finance_payments WHERE id=?').get(payment.id);
  const edits={charges:[{id:charge.id,description:'Corrected paid fee',quantity:2,unitAmount:4500,note:'Approved correction'}]};
  assert.equal((await post('/api/finance/patient',clerk,{patientKey:key,invoiceId:charge.invoiceId,paymentType:'DIRECT',discountAmount:1000},'PATCH')).status,400);
  assert.equal((await post('/api/finance/payments',clerk,{patientKey:key,invoiceId:charge.invoiceId,source:'CASH',amount:1000,currency:'KHR'})).status,400);
  assert.equal((await post('/api/finance/complete-payment',clerk,{patientKey:key,invoiceId:charge.invoiceId,paymentSubtype:'FULL_WAIVER'})).status,400);
  const create=await post('/api/finance/invoice-edit-requests',clerk,{patientKey:key,invoiceId:charge.invoiceId,reason:'Incorrect unit fee'});assert.equal(create.status,201);const {id}=await create.json();
  assert.equal((await post('/api/finance/invoice-edit-requests',clerk,{patientKey:key,invoiceId:charge.invoiceId,reason:'Duplicate'})).status,201);assert.equal((await(await get('/api/finance/invoice-edit-requests',clerk)).json()).requests.length,1);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+id+'/apply',clerk,edits)).status,409);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+id+'/review',clerk,{approved:true})).status,403);
  assert.equal((await get('/api/finance/invoice-history?patientKey='+encodeURIComponent(key),nurse)).status,403);
  assert.equal((await(await get('/api/finance/cashier-alerts',director)).json()).requests[0].id,id);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+id+'/review',director,{approved:false,note:'Check the tariff first'})).status,200);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+id+'/apply',clerk,edits)).status,409);
  const again=await post('/api/finance/invoice-edit-requests',clerk,{patientKey:key,invoiceId:charge.invoiceId,reason:'Tariff confirmed'}),second=(await again.json()).id;assert.notEqual(second,id);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+second+'/review',{...admin,'X-CSRF-Token':'bad'},{approved:true})).status,403);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+second+'/review',admin,{approved:true,note:'Approved once'})).status,200);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+second+'/review',director,{approved:false})).status,409,'a second reviewer cannot overturn the first decision');
  assert.equal((await post('/api/finance/invoice-edit-requests/'+second+'/apply',acct,edits)).status,403);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+second+'/apply',clerk,{charges:[]})).status,400);
  const applied=await post('/api/finance/invoice-edit-requests/'+second+'/apply',clerk,edits);assert.equal(applied.status,200,await applied.clone().text());
  const after=patientBill(db,key,charge.invoiceId);assert.equal(after.summary.KHR.gross,9000);assert.equal(after.summary.KHR.paid,10000);assert.equal(after.charges.find(c=>c.id===charge.id).description,'Corrected paid fee');
  assert.deepEqual(db.sqlite.prepare('SELECT * FROM finance_payments WHERE id=?').get(payment.id),paymentBefore);assert.equal(db.findPatient(key).record_json,patientBefore);
  const requests=(await(await get('/api/finance/invoice-history?patientKey='+encodeURIComponent(key),clerk)).json()).requests,done=requests.find(r=>r.id===second);assert.equal(done.status,'APPLIED');assert.equal(done.before.summary.KHR.gross,10000);assert.equal(done.after.summary.KHR.gross,9000);assert.equal(done.reviewedBy,db.findUser('admin').id);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+second+'/apply',clerk,edits)).status,409);
  assert.equal(db.sqlite.prepare("SELECT COUNT(*) count FROM audit_events WHERE action='INVOICE_EDIT_APPLIED'").get().count,1);
  assert.equal((await(await get('/api/finance/cashier-alerts',admin)).json()).requests.length,0,'reviewed requests leave the manager alert queue');
 }finally{await f.close();}
});

test('Invoice history sorts by latest payment; stale approval is blocked and valid correction can create an outstanding balance',async()=>{
 const f=await fixture(32985),{db,actor,seed,login,get,post}=f;
 try{
  const key=seed('Sort'),clerk=await login('clerk'),director=await login('director'),now=Date.now(),older=now-86400000;
  const first=startPatientInvoice(db,key,actor,older),a=addCharge(db,key,{description:'First invoice',quantity:1,unitAmount:5000,currency:'KHR'},actor,older);addPayment(db,key,{invoiceId:first.id,source:'CASH',amount:5000,currency:'KHR',receivedAt:now-1000},actor,now);
  const second=startPatientInvoice(db,key,actor,now),b=addCharge(db,key,{description:'Second invoice',quantity:1,unitAmount:6000,currency:'KHR'},actor,now);addPayment(db,key,{invoiceId:second.id,source:'CASH',amount:6000,currency:'KHR',receivedAt:older},actor,now);
  const history=await(await get('/api/finance/invoice-history?patientKey='+encodeURIComponent(key),clerk)).json();assert.deepEqual(history.invoices.map(i=>i.invoice.id),[first.id,second.id]);
  const request=await post('/api/finance/invoice-edit-requests',clerk,{patientKey:key,invoiceId:second.id,reason:'Fix second tariff'}),id=(await request.json()).id;
  assert.equal((await post('/api/finance/invoice-edit-requests/'+id+'/review',director,{approved:true})).status,200);
  db.sqlite.prepare('UPDATE finance_charges SET note=? WHERE id=?').run('Concurrent correction',b.id);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+id+'/apply',clerk,{charges:[{id:b.id,description:b.description,quantity:1,unitAmount:7000}]})).status,409);
  const fresh=await post('/api/finance/invoice-edit-requests',clerk,{patientKey:key,invoiceId:second.id,reason:'New request after change'}),newId=(await fresh.json()).id;assert.notEqual(newId,id);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+newId+'/review',director,{approved:true})).status,200);
  assert.equal((await post('/api/finance/invoice-edit-requests/'+newId+'/apply',clerk,{charges:[{id:b.id,description:'Corrected outstanding fee',quantity:1,unitAmount:7000}]})).status,200);
  assert.equal(patientBill(db,key,second.id).summary.KHR.balance,1000);
  const selected=await(await get('/api/finance/patient?patientKey='+encodeURIComponent(key)+'&invoiceId='+second.id,clerk)).json();assert.equal(selected.paymentStatus.code,'PARTIAL');assert.equal(patientBill(db,key,first.id).summary.KHR.gross,5000);
  const alerts=(await(await get('/api/finance/cashier-alerts',clerk)).json()).payments;assert.equal(alerts.length,1);assert.equal(alerts[0].invoiceId,second.id);
 }finally{await f.close();}
});
