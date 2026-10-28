import test from 'node:test';import assert from 'node:assert/strict';
import {createEmrServer} from '../server/server.mjs';import {networkLocal,apiToken,savePeer,networkCall} from '../server/emr-network.mjs';
test('ADMIN connection requests require two approvals, preserve scopes, and cannot revive revoked grants',{timeout:120000},async()=>{
 const apps=Array.from({length:3},()=>createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false}));
 try{
  const originalCounts=apps.map(app=>app.database.sqlite.prepare('SELECT count(*) n FROM patient_records').get().n);const headers=new Map();for(const app of apps){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));app.config.appOrigin='http://127.0.0.1:'+app.server.address().port;app.database.sqlite.prepare('UPDATE emr_network_local SET managed=1,enabled=1').run();for(const username of ['admin','doctor_opd','nurse_opd']){const r=await fetch(app.config.appOrigin+'/api/auth/login',{method:'POST',headers:{Origin:app.config.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({username})}),Cookie=r.headers.get('set-cookie').split(';')[0],me=await(await fetch(app.config.appOrigin+'/api/auth/me',{headers:{Cookie}})).json();headers.set(app.config.appOrigin+username,{Cookie,Origin:app.config.appOrigin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken})}}
  const [a,b,c]=apps;const peer=(from,to)=>savePeer(from.database,from.config,{name:'Synthetic hospital',origin:to.config.appOrigin,apiKey:apiToken(networkLocal(to.database)),enabled:true,incoming:false,outgoing:false,search:false,messages:false});
  const ab=peer(a,b),ba=peer(b,a),ac=peer(a,c),ca=peer(c,a),bc=peer(b,c),cb=peer(c,b);
  const req=async(app,path,body,user='admin')=>{const response=await fetch(app.config.appOrigin+'/api/emr-network/'+path,{method:body===undefined?'GET':'POST',headers:headers.get(app.config.appOrigin+user),body:body===undefined?undefined:JSON.stringify(body)});return {status:response.status,data:await response.json()}};
  const get=(app,p)=>app.database.sqlite.prepare('SELECT * FROM emr_network_peers WHERE id=?').get(p.id);
  const call=(app,p,body)=>networkCall({database:app.database,config:app.config},p.id,body);
  assert.equal((await req(a,'check',{peerId:ab.id})).data.connected,false);
  for(const user of ['doctor_opd','nurse_opd'])assert.equal((await req(a,'request',{peerId:ab.id},user)).status,403);
  const noCsrf={...headers.get(a.config.appOrigin+'admin')};delete noCsrf['X-CSRF-Token'];assert.equal((await fetch(a.config.appOrigin+'/api/emr-network/request',{method:'POST',headers:noCsrf,body:JSON.stringify({peerId:ab.id})})).status,403);
  const sent=await req(a,'request',{peerId:ab.id});assert.equal(sent.status,200,JSON.stringify(sent.data));const id=sent.data.id;assert.equal((await req(a,'request',{peerId:ab.id})).data.id,id);
  assert.equal(b.database.sqlite.prepare("SELECT count(*) n FROM emr_connection_requests WHERE direction='IN'").get().n,1);
  assert.equal((await req(a,'check',{peerId:ab.id})).data.connected,false);await assert.rejects(call(a,ab,{operation:'records',patientKey:'never-shared'}),e=>e.status===403);
  assert.equal((await req(b,'table',undefined,'nurse_opd')).data.requests.length,0);
  assert.ok(!JSON.stringify((await req(b,'table')).data).includes(networkLocal(b.database).signing_seed));
  await assert.rejects(call(c,cb,{operation:'connection-request-status',id}),e=>e.status===503);
  assert.equal((await req(b,'decide-request',{id,state:'ACCEPTED'},'doctor_opd')).status,403);
  for(let i=0;i<2;i++)assert.equal((await req(b,'decide-request',{id,state:'ACCEPTED'})).status,200);
  assert.equal(get(a,ab).incoming,0,'request alone does not open sharing');assert.equal((await req(a,'check',{peerId:ab.id})).data.connected,true);
  for(const [app,p] of [[a,ab],[b,ba]]){assert.equal(get(app,p).incoming,1);assert.equal(get(app,p).outgoing,1);assert.equal(get(app,p).search,0);assert.equal(get(app,p).messages,0)}
  const rejected=(await req(c,'request',{peerId:cb.id})).data.id;assert.equal((await req(b,'decide-request',{id:rejected,state:'REJECTED'})).status,200);assert.equal((await req(c,'check',{peerId:cb.id})).data.connected,false);assert.equal(get(c,cb).incoming,0);assert.equal((await req(b,'decide-request',{id:rejected,state:'ACCEPTED'})).status,409);
  const stale=(await req(b,'request',{peerId:bc.id})).data.id;c.database.sqlite.prepare('UPDATE emr_network_peers SET version=version+1 WHERE id=?').run(cb.id);assert.equal((await req(c,'decide-request',{id:stale,state:'ACCEPTED'})).status,409);assert.equal((await req(b,'check',{peerId:bc.id})).data.requestState,'STALE');
  const revoked=(await req(a,'request',{peerId:ac.id})).data.id;assert.equal((await req(c,'decide-request',{id:revoked,state:'ACCEPTED'})).status,200);c.database.sqlite.prepare('UPDATE emr_network_peers SET incoming=0,outgoing=0,version=version+1 WHERE id=?').run(ca.id);assert.equal((await req(a,'check',{peerId:ac.id})).data.connected,false);assert.equal(get(a,ac).incoming,0,'revoked remote approval cannot grant local permissions');
  // A disable made while awaiting the identity response wins over that response.
  const original=globalThis.fetch;globalThis.fetch=async(...args)=>{const r=await original(...args);if(String(args[0]).endsWith('/rpc'))a.database.sqlite.prepare('UPDATE emr_network_local SET enabled=0').run();return r};try{await assert.rejects(call(a,ab,{operation:'ping'}),e=>e.status===403)}finally{globalThis.fetch=original}
  assert.equal((await req(a,'check',{peerId:ab.id})).data.connected,false);assert.deepEqual(apps.map(app=>app.database.sqlite.prepare('SELECT count(*) n FROM patient_records').get().n),originalCounts);
 }finally{for(const app of apps){app.server.closeAllConnections();await new Promise(r=>app.server.close(r));app.database.close()}}
});
