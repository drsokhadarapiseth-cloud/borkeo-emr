import {applySecurityHeaders} from '../server/security.mjs';
import test from 'node:test';import assert from 'node:assert/strict';import crypto from 'node:crypto';
import {patientIdFromQr} from '../public/qr-patient-scanner.mjs';import {createEmrServer} from '../server/server.mjs';import {networkLocal,apiToken,savePeer} from '../server/emr-network.mjs';import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
test('patient-card QR accepts bounded plain identifiers and rejects navigation/executable payloads',()=>{
 assert.equal(patientIdFromQr('160201-20261027-003'),'160201-20261027-003');assert.equal(patientIdFromQr('\uFEFF  PATIENT-504  '),'PATIENT-504');
 for(const value of [null,{},'', '12','https://hospital.example/patient/123','javascript:alert(1)','<script>bad</script>','{"id":"123"}','PATIENT\n504','A'.repeat(121)])assert.equal(patientIdFromQr(value),null,String(value));
});
test('submitted searches use exact identifiers, prefix names and protected POST on both EMRs',{timeout:120000},async()=>{
 const apps=[0,1].map(()=>createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false}));
 try{for(const app of apps){await new Promise(r=>app.server.listen(0,'127.0.0.1',r));app.config.appOrigin='http://127.0.0.1:'+app.server.address().port;app.database.sqlite.prepare('UPDATE emr_network_local SET managed=1,enabled=1').run()}
 const [a,b]=apps,peers=[];for(const [from,to] of [[a,b],[b,a]])peers.push(savePeer(from.database,from.config,{name:'Synthetic peer',origin:to.config.appOrigin,apiKey:apiToken(networkLocal(to.database)),enabled:true,incoming:true,outgoing:true,search:true,messages:true}));
 const fixture=buildCompleteRegistrationPatients()[0];for(const app of apps)for(const suffix of ['','0'])app.database.upsertPatient({id:crypto.randomUUID(),patientKey:'case:EXACT-504'+suffix,summary:{...fixture.summary,healthId:'PATIENT-504'+suffix,caseNumber:'CASE-504'+suffix,fullName:'Prefix Search'+suffix,phone:'0881112233'+suffix},data:{'scope:registration:id:web_other_card_number':'NATIONAL-504'+suffix},userId:app.database.sqlite.prepare("SELECT id FROM users WHERE username='registration'").get().id,savedAt:Date.now()});
 const login=await fetch(a.config.appOrigin+'/api/auth/login',{method:'POST',headers:{Origin:a.config.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({username:'registration'})}),Cookie=login.headers.get('set-cookie').split(';')[0],me=await(await fetch(a.config.appOrigin+'/api/auth/me',{headers:{Cookie}})).json(),headers={Cookie,Origin:a.config.appOrigin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
 const post=(url,body,h=headers)=>fetch(a.config.appOrigin+url,{method:'POST',headers:h,body:JSON.stringify(body)});
 for(const [mode,q] of [['id','PATIENT 504'],['phone','088 111 2233'],['other','NATIONAL 504']])for(const endpoint of ['local-search','search']){const r=await post('/api/emr-network/'+endpoint,{mode,q,peerId:peers[0].id});assert.equal(r.status,200);const data=await r.json();assert.equal(data.patients.length,1);assert.equal(data.patients[0].healthId,'PATIENT-504')}
 const prefix=await(await post('/api/emr-network/search',{peerId:peers[0].id,mode:'name',q:'Prefix Search'})).json();assert.equal(prefix.patients.length,2);
 assert.equal((await post('/api/emr-network/local-search',{mode:'id',q:'PATIENT-504'},{Cookie,Origin:a.config.appOrigin,'Content-Type':'application/json'})).status,403);
 assert.equal((await post('/api/emr-network/search',{peerId:peers[0].id,mode:'all',q:'PATIENT-504'})).status,400);
 assert.equal((await fetch(a.config.appOrigin+'/api/emr-network/local-search',{method:'POST',headers:{Origin:a.config.appOrigin,'Content-Type':'application/json'},body:'{}'})).status,401);
 const page=await fetch(a.config.appOrigin+'/patient-list',{headers:{Cookie}});assert.match(page.headers.get('permissions-policy'),/camera=\(self\)/);assert.match(page.headers.get('permissions-policy'),/microphone=\(\)/);assert.match(page.headers.get('content-security-policy'),/media-src 'self' blob:/);const policyHeaders=new Map();applySecurityHeaders({setHeader:(key,value)=>policyHeaders.set(key,value)},{camera:true});assert.match(policyHeaders.get('Content-Security-Policy'),/script-src 'self';/);
 const publicPage=await fetch(a.config.appOrigin+'/login');assert.match(publicPage.headers.get('permissions-policy'),/camera=\(\)/);
 const api=await fetch(a.config.appOrigin+'/api/auth/me',{headers:{Cookie}});assert.match(api.headers.get('permissions-policy'),/camera=\(\)/);
 }finally{for(const app of apps){app.server.closeAllConnections();await new Promise(r=>app.server.close(r));app.database.close()}}
});
