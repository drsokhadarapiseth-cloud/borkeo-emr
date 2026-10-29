import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {createEmrServer} from '../server/server.mjs';
import {networkLocal,apiToken,savePeer,networkCall} from '../server/emr-network.mjs';
import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {seedReferralHistory} from './helpers/referral-history.mjs';
import {networkSign,networkRequestText} from '../server/network-signatures.mjs';
import {mac} from '../server/referral-link.mjs';

test('three independent EMRs: reciprocal approval, isolation, rotation, messages and read-only histories',{timeout:120000},async()=>{
 const apps=Array.from({length:3},()=>createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false}));
 try{
  for(const app of apps){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));app.config.appOrigin='http://127.0.0.1:'+app.server.address().port;app.database.sqlite.prepare('UPDATE emr_network_local SET managed=1,enabled=1').run()}
  const [a,b,c]=apps,headers=new Map();
  async function login(app,username){const origin=app.config.appOrigin,r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);const Cookie=r.headers.get('set-cookie').split(';')[0],me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();const h={Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};headers.set(app.config.appOrigin+username,h);return me.user.id}
  const doctorIds=[];for(const app of apps){doctorIds.push(await login(app,'doctor_opd'));for(const user of ['admin','nurse_opd','clerk','doctor_surgery'])await login(app,user)}
  async function req(app,user,route,body){const r=await fetch(app.config.appOrigin+route,{method:body===undefined?'GET':'POST',headers:headers.get(app.config.appOrigin+user),body:body===undefined?undefined:JSON.stringify(body)});let data;try{data=await r.json()}catch{data=null}return {status:r.status,data}}
  function peer(from,to){return savePeer(from.database,from.config,{name:'Synthetic peer',origin:to.config.appOrigin,apiKey:apiToken(networkLocal(to.database)),enabled:true,incoming:true,outgoing:true,search:true,messages:true})}
  let ab=peer(a,b),ba=peer(b,a),ac=peer(a,c),ca=peer(c,a),cb=peer(c,b),bc=peer(b,c);
  assert.notEqual(networkLocal(a.database).secret,networkLocal(b.database).secret);
  const settings=await req(a,'admin','/api/emr-network/settings');assert.equal(settings.status,200);assert.ok(!JSON.stringify(settings.data).includes(networkLocal(a.database).secret));assert.ok(!JSON.stringify(settings.data).includes(ab.secret));
  for(const user of ['doctor_opd','nurse_opd','clerk']){assert.equal((await req(a,user,'/api/emr-network/settings')).status,403);assert.equal((await req(a,user,'/api/emr-network/key',{})).status,403)}
  const h=headers.get(a.config.appOrigin+'admin'),noCsrf={...h};delete noCsrf['X-CSRF-Token'];assert.equal((await fetch(a.config.appOrigin+'/api/emr-network/key',{method:'POST',headers:noCsrf,body:'{}'})).status,403);
  assert.equal((await req(a,'admin','/api/emr-network/key',{})).data.apiKey,apiToken(networkLocal(a.database)));
  assert.ok(!JSON.stringify(settings.data).includes(networkLocal(a.database).signing_seed));assert.ok(!apiToken(networkLocal(a.database)).includes(networkLocal(a.database).signing_seed));
  // Even a third connected facility knowing both public pairing keys cannot
  // impersonate A. Private signing seeds never leave their home database.
  const identityA=networkLocal(a.database),identityB=networkLocal(b.database),publicA=apiToken(identityA).split(':')[2],publicB=apiToken(identityB).split(':')[2];
  const pairMac=crypto.createHash('sha256').update('emr-network:'+identityA.id+':'+identityB.id+':'+publicA+':'+publicB).digest('hex');
  const envelope={timestamp:Date.now(),nonce:crypto.randomUUID(),body:{operation:'ping'}};envelope.signature=mac(pairMac,JSON.stringify(envelope));envelope.from=identityA.id;envelope.to=identityB.id;
  const rpc=e=>fetch(b.config.appOrigin+'/api/emr-network/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(e)});
  envelope.auth=networkSign(networkLocal(c.database).signing_seed,networkRequestText(envelope));assert.equal((await rpc(envelope)).status,403);
  envelope.auth=networkSign(identityA.signing_seed,networkRequestText(envelope));assert.equal((await rpc(envelope)).status,200);assert.equal((await rpc(envelope)).status,409);
  for(const origin of ['https://example.com','http://192.168.1.10:3002','http://localhost:3002/path','http://user:pass@localhost:3002',a.config.appOrigin])assert.throws(()=>savePeer(a.database,a.config,{name:'Bad',origin,apiKey:apiToken(networkLocal(c.database))}),e=>e.status===400);
  const patient=buildCompleteRegistrationPatients()[0],key=patient.patientKey;
  for(const app of apps){app.database.upsertPatient({id:crypto.randomUUID(),patientKey:key,summary:{...patient.summary,serviceMode:'opd',departmentCode:'opd'},data:{'scope:medical:id:ipd_history_present_illness':'Clinical sentinel'},userId:doctorIds[apps.indexOf(app)],savedAt:Date.now()});seedReferralHistory(app,patient,doctorIds[apps.indexOf(app)])}
  b.database.upsertPatient({id:crypto.randomUUID(),patientKey:'case:SOURCE-ONLY-498',summary:{...patient.summary,healthId:'SOURCE-ONLY-498',caseNumber:'SOURCE-ONLY-498'},data:{},userId:doctorIds[1],savedAt:Date.now()});
  const before=apps.map(app=>app.database.sqlite.prepare('SELECT patient_key,record_json FROM patient_records ORDER BY patient_key').all());
  const search='/api/emr-network/search?'+new URLSearchParams({peerId:ab.id,q:patient.summary.healthId});
  const found=await req(a,'doctor_opd',search);assert.equal(found.status,200,JSON.stringify(found.data));assert.ok(found.data.patients.some(p=>p.patientKey===key));assert.ok(!JSON.stringify(found.data).includes('Clinical sentinel'));
  assert.equal((await req(a,'clerk',search)).status,403);
  assert.equal(found.data.patients.find(p=>p.patientKey===key).localCaseType,'old','case type uses receiving hospital history');
  const firstLocalVisit=await req(a,'doctor_opd','/api/emr-network/search?'+new URLSearchParams({peerId:ab.id,q:'SOURCE-ONLY-498'}));assert.equal(firstLocalVisit.data.patients[0].localCaseType,'new','a source-hospital visit is not a receiving-hospital visit');
  assert.equal((await req(a,'nurse_opd',search)).status,200);
  assert.equal((await req(a,'doctor_opd','/api/emr-network/search?'+new URLSearchParams({peerId:ab.id,q:'%_%'}))).data.patients.length,0);
  const records=await req(a,'doctor_opd','/api/emr-network/records?'+new URLSearchParams({peerId:ab.id,patientKey:key}));assert.equal(records.status,200);assert.equal(records.data.readOnly,true);assert.ok(JSON.stringify(records.data).includes('Clinical sentinel'));assert.ok(!JSON.stringify(records.data).includes('Private unrelated sentinel'));
  const call=(app,p,body)=>networkCall({database:app.database,config:app.config},p.id,body);
  await assert.rejects(call(a,ab,{operation:'update',patientKey:key,data:{}}),e=>e.status===503);
  b.database.sqlite.prepare('UPDATE emr_network_peers SET incoming=0 WHERE id=?').run(ba.id);await assert.rejects(call(a,ab,{operation:'records',patientKey:key}),e=>e.status===403);b.database.sqlite.prepare('UPDATE emr_network_peers SET incoming=1,search=0 WHERE id=?').run(ba.id);await assert.rejects(call(a,ab,{operation:'records',patientKey:key}),e=>e.status===403);b.database.sqlite.prepare('UPDATE emr_network_peers SET search=1 WHERE id=?').run(ba.id);
  a.database.sqlite.prepare('UPDATE emr_network_peers SET outgoing=0 WHERE id=?').run(ab.id);await assert.rejects(call(a,ab,{operation:'search',q:'abc'}),e=>e.status===403);a.database.sqlite.prepare('UPDATE emr_network_peers SET outgoing=1 WHERE id=?').run(ab.id);
  b.database.sqlite.prepare('UPDATE emr_network_peers SET enabled=0 WHERE id=?').run(ba.id);await assert.rejects(call(a,ab,{operation:'records',patientKey:key}),e=>e.status===503);b.database.sqlite.prepare('UPDATE emr_network_peers SET enabled=1 WHERE id=?').run(ba.id);
  a.database.sqlite.prepare('UPDATE emr_network_peers SET search=0 WHERE id=?').run(ab.id);await assert.rejects(call(a,ab,{operation:'records',patientKey:key}),e=>e.status===403);a.database.sqlite.prepare('UPDATE emr_network_peers SET search=1 WHERE id=?').run(ab.id);
  // A wrong destination receives only a nonce ping, never the patient query.
  const fetchOriginal=globalThis.fetch,attempts=[];globalThis.fetch=async(url,options)=>{attempts.push(JSON.parse(options.body).body);return new Response('{}',{status:403})};
  try{await assert.rejects(call(a,ab,{operation:'records',patientKey:'PRIVATE-SENTINEL'}),e=>e.status===503);assert.deepEqual(attempts,[{operation:'ping'}])}finally{globalThis.fetch=fetchOriginal}
  const doctors=await req(a,'doctor_opd','/api/emr-network/doctors?peerId='+ab.id);assert.equal(doctors.status,200);assert.ok(doctors.data.doctors.some(d=>d.id===doctorIds[1]));assert.equal((await req(a,'nurse_opd','/api/emr-network/doctors?peerId='+ab.id)).status,200);
  const message={id:crypto.randomUUID(),peerId:ab.id,recipientId:doctorIds[1],subject:'Synthetic consultation',body:'Escaped text <script>alert(1)</script>'};
  for(let i=0;i<2;i++)assert.equal((await req(a,'doctor_opd','/api/emr-network/messages',message)).status,200);
  assert.equal(b.database.sqlite.prepare('SELECT count(*) n FROM emr_network_messages').get().n,1);
  assert.equal((await req(a,'doctor_surgery','/api/emr-network/messages',message)).status,409);
  assert.equal((await req(a,'nurse_opd','/api/emr-network/messages',message)).status,409);
  assert.equal((await req(b,'doctor_opd','/api/emr-network/messages')).data.messages.length,1);assert.equal((await req(b,'doctor_surgery','/api/emr-network/messages')).data.messages.length,0);
  b.database.sqlite.prepare('UPDATE emr_network_peers SET messages=0 WHERE id=?').run(ba.id);assert.equal((await req(a,'doctor_opd','/api/emr-network/messages',{...message,id:crypto.randomUUID()})).status,403);b.database.sqlite.prepare('UPDATE emr_network_peers SET messages=1 WHERE id=?').run(ba.id);
  // Fixture signed letters avoid unrelated clinical admission/payment workflows.
  for(const [from,to,p] of [[a,b,ab],[b,a,ba],[a,c,ac]]){
   const id=crypto.randomUUID(),payload={id,patient:{patientKey:key,fullName:patient.summary.fullName},form:{revision:1,signature:{userId:doctorIds[0]}},visits:[],sentAt:Date.now()};
   const delivered=await call(from,p,{operation:'deliver',id,payload});assert.equal(delivered.status,'PENDING');assert.equal((await call(from,p,{operation:'deliver',id,payload})).id,id);
   assert.equal(to.database.sqlite.prepare('SELECT peer_id FROM referral_inbox WHERE id=?').get(id).peer_id,to.database.sqlite.prepare('SELECT id FROM emr_network_peers WHERE instance_id=?').get(networkLocal(from.database).id).id);
   if(from===a&&to===b){await assert.rejects(call(c,cb,{operation:'status',id}),e=>e.status===503);assert.equal((await req(b,'nurse_opd','/api/referral-accept',{id})).status,200);assert.equal((await call(a,ab,{operation:'status',id})).status,'ACCEPTED')}
  }
  const local=networkLocal(b.database);assert.equal((await req(b,'admin','/api/emr-network/key',{rotate:true,version:local.version-1})).status,409);const rotated=await req(b,'admin','/api/emr-network/key',{rotate:true,version:local.version});assert.deepEqual(rotated.data,{ok:true});await assert.rejects(call(a,ab,{operation:'search',q:'abc'}),e=>e.status===503);
  ab=savePeer(a.database,a.config,{...ab,enabled:true,incoming:true,outgoing:true,search:true,messages:true,apiKey:apiToken(networkLocal(b.database))});assert.ok((await call(a,ab,{operation:'search',q:patient.summary.healthId})).patients.length);
  a.database.sqlite.prepare('UPDATE emr_network_local SET enabled=0').run();await assert.rejects(call(a,ab,{operation:'search',q:'abc'}),e=>e.status===403);assert.equal((await req(a,'doctor_opd','/api/referral-inbox')).status,200);assert.equal((await fetch(a.config.appOrigin+'/api/referral-link',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
  for(let i=0;i<apps.length;i++)assert.deepEqual(apps[i].database.sqlite.prepare('SELECT patient_key,record_json FROM patient_records ORDER BY patient_key').all(),before[i]);
 }finally{for(const app of apps){app.server.closeAllConnections();await new Promise(r=>app.server.close(r));app.database.close()}}
});
