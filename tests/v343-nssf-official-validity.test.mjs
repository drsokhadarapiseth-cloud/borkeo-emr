import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {evaluateNssfEligibility,parseDecryptedBeneficiary,createNssfLookup,NSSF_API_ENDPOINT} from '../server/nssf-lookup.mjs';
import {createEmrServer} from '../server/server.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const CARD='00000000000123',NOW='2026-10-14T00:00:00.000Z';
const key=Buffer.from('QE5zc2ZfZnJvbV8xMjM0QHRyYWNraW5nJDNAaWxvdmU=','base64'),iv=Buffer.from('QFNvcGhhdEBsZW5nXzE5Mg==','base64');
function encrypt(text){const c=crypto.createCipheriv('aes-256-cbc',key,iv);return Buffer.concat([c.update(text,'utf8'),c.final()]).toString('base64');}
function envelope(member,base64=false){const json=JSON.stringify(member);return {success:true,total_record:0,total_page:0,status_code:null,message:'SUCCESS',data:encrypt(base64?Buffer.from(json).toString('base64'):json)};}
const response=body=>new Response(JSON.stringify(body),{headers:{'content-type':'application/json'}});
test('officially active member types 1/2/3 remain valid indefinitely with no end date',()=>{
 for(const type of [1,2,3,'1','2','3']){const result=evaluateNssfEligibility({sta_eli_id:1,ben_type:type,new_ben_code:CARD,end_eligible_date:null},CARD,NOW);assert.equal(result.card.valid,true);assert.equal(result.card.status,'VALID');assert.equal(result.card.validityType,'INDEFINITE');assert.equal(result.card.endEligibleDate,null);}
});
test('provider status is authoritative: missing or past dates do not independently invalidate active status',()=>{
 for(const date of [null,'2026-01-01','2026-10-31T00:00:00','2026-02-30']){const result=evaluateNssfEligibility({sta_eli_id:'1',ben_type:4,ben_code:CARD,end_eligible_date:date},CARD,NOW);assert.equal(result.card.valid,true);assert.equal(result.card.status,'VALID');}
 const inactive=evaluateNssfEligibility({sta_eli_id:3,is_eligible:true,new_ben_code:CARD,end_eligible_date:'2099-01-01'},CARD,NOW);assert.equal(inactive.card.valid,false);assert.equal(inactive.card.status,'INACTIVE');
});
test('missing or unrecognized status never becomes a false invalid result; identifiers are checked',()=>{
 for(const status of [null,'',false,{},'ACTIVE']){const result=evaluateNssfEligibility({sta_eli_id:status,ben_code:CARD},CARD,NOW);assert.equal(result.card.valid,null);assert.equal(result.card.status,'UNKNOWN');}
 assert.throws(()=>evaluateNssfEligibility({},CARD,NOW),/official member status/);
 assert.throws(()=>evaluateNssfEligibility({sta_eli_id:1,new_ben_code:'00000000000999'},CARD,NOW),/different beneficiary/);
 const changed=evaluateNssfEligibility({sta_eli_id:1,new_ben_code:'00000000000999',ben_code:CARD},CARD,NOW);assert.equal(changed.card.valid,true);assert.equal(changed.card.number,'00000000000999');
});
test('malformed decrypted data throws; only explicit no-record data becomes not found',()=>{
 assert.equal(parseDecryptedBeneficiary(''),null);assert.equal(parseDecryptedBeneficiary('null'),null);
 for(const value of ['broken','[]','true','"text"','{broken}'])assert.throws(()=>parseDecryptedBeneficiary(value),/Unexpected NSSF/);
 const member={sta_eli_id:1,ben_type:3,new_ben_code:CARD};assert.deepEqual(parseDecryptedBeneficiary(JSON.stringify(member)),member);assert.deepEqual(parseDecryptedBeneficiary(Buffer.from(JSON.stringify(member)).toString('base64')),member);
});
test('encrypted successful envelope with total_record zero correctly returns valid status, not pagination-based invalid',async()=>{
 for(const base64 of [false,true]){let called;
  const lookup=createNssfLookup({now:()=>Date.parse(NOW),fetchImpl:async(url,options)=>{called=url;assert.equal(options.redirect,'error');return response(envelope({sta_eli_id:1,ben_type:2,new_ben_code:CARD,end_eligible_date:null,ben_full_name_kh:'Synthetic private name'},base64));}});
  const result=await lookup(CARD,'synthetic-user');assert.equal(called.origin+called.pathname,NSSF_API_ENDPOINT);assert.equal(called.searchParams.get('ben_code'),CARD);assert.equal(result.card.valid,true);assert.equal(result.card.validityType,'INDEFINITE');assert.equal(result.verifiedAt,NOW);assert.equal(result.card.nameKh,'Synthetic private name');
 }
});
test('failed, incomplete, malformed or oversized provider responses are unable-to-verify, never invalid',async()=>{
 for(const body of [{success:false,data:''},{success:true},{success:true,data:{}},{success:true,data:'broken'},envelope({}),{success:true,data:encrypt('not JSON')}]){
  const lookup=createNssfLookup({fetchImpl:async()=>response(body)});await assert.rejects(lookup(CARD,'user'),e=>e.status===503&&!e.message.includes('not JSON'));
 }
 const missing=createNssfLookup({fetchImpl:async()=>response({success:true,data:null})});assert.equal((await missing(CARD,'user')).card.status,'NOT_FOUND');
 const oversized=createNssfLookup({fetchImpl:async()=>response({success:true,data:'A'.repeat(524288)})});await assert.rejects(oversized(CARD,'user'),e=>e.status===503);
});
test('rate limit and concurrency protections remain in place',async()=>{
 const lookup=createNssfLookup({now:()=>Date.parse(NOW),fetchImpl:async()=>response(envelope({sta_eli_id:1,new_ben_code:CARD}))});for(let i=0;i<12;i++)await lookup(CARD,'same-user');await assert.rejects(lookup(CARD,'same-user'),e=>e.status===429);
 let resolve;const gate=new Promise(r=>resolve=r);const concurrent=createNssfLookup({fetchImpl:async()=>{await gate;return response({success:true,data:null});}});const tasks=[1,2,3].map(n=>concurrent(CARD,'u'+n));await assert.rejects(concurrent(CARD,'u4'),e=>e.status===429);resolve();await Promise.all(tasks);
});
test('real HTTP route returns indefinite validity and preserves patients/payments, with role and CSRF checks',async()=>{
 const app=createEmrServer({databasePath:':memory:',autoDatabase:false,demoMode:true,nodeEnv:'test',nssfFetch:async()=>response(envelope({sta_eli_id:1,ben_type:1,new_ben_code:CARD,end_eligible_date:null,ben_full_name_kh:'Synthetic private name'}))});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
 const login=async username=>{const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(response.status,200);const Cookie=response.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return{Origin:origin,Cookie,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};};
 try{const before=JSON.stringify(app.database.listPatients()),beforePayments=app.database.sqlite.prepare('SELECT COUNT(*) n FROM finance_payments').get().n;const reg=await login('registration');
  for(const [headers,status]of [[{},401],[await login('clerk'),403],[{...reg,'X-CSRF-Token':'bad'},403],[{...reg,Origin:'https://elsewhere.invalid'},403]]){const res=await fetch(origin+'/api/nssf/verify',{method:'POST',headers,body:JSON.stringify({cardNumber:CARD})});assert.equal(res.status,status);}
  const res=await fetch(origin+'/api/nssf/verify',{method:'POST',headers:reg,body:JSON.stringify({cardNumber:CARD})});assert.equal(res.status,200);assert.equal(res.headers.get('cache-control'),'no-store');const result=await res.json();assert.equal(result.card.valid,true);assert.equal(result.card.validityType,'INDEFINITE');assert.equal(result.card.nameKh,'Synthetic private name');assert.equal(JSON.stringify(app.database.listPatients()),before);assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) n FROM finance_payments').get().n,beforePayments);
  const audit=app.database.sqlite.prepare("SELECT details_json FROM audit_events WHERE action='NSSF_VERIFY' ORDER BY id DESC LIMIT 1").get();assert.doesNotMatch(audit.details_json,/00000000000123|Synthetic private name/);
 }finally{await new Promise(r=>app.server.close(r));app.database.close();}
});
function clientHarness(){
 const source=read('public/nssf-lookup.js');const handlers={},winHandlers={},nodes={};let timerFn,requestResolve,requests=[];
 const node=(id,v='')=>nodes[id]={value:v,disabled:false,readOnly:false,textContent:'',className:'',title:'',addEventListener:(name,fn)=>handlers[id+':'+name]=fn,removeAttribute(){},dispatchEvent(){},setAttribute(){}};
 node('web_nssf','');node('web_health_id','SYNTHETIC-A');node('web_adm_no','CASE-A');node('nssf_verify_button');node('nssf_verify_status');node('web_nssf_verification');
 const window={emrSession:{user:{activeRole:'REGISTRATION'},csrfToken:'synthetic'},addEventListener:(name,fn)=>winHandlers[name]=fn,getBorkeoLanguage:()=> 'kh'};
 const document={readyState:'complete',getElementById:id=>nodes[id],addEventListener:(name,fn)=>handlers[name]=fn,body:{appendChild(){}},createElement(){throw Error('Unexpected dialog in synthetic stale test');}};
 const fetch=async(url,options)=>{requests.push({url,options});return new Promise(r=>requestResolve=r);};
 const ctx={window,document,fetch,AbortController,Event,setTimeout:fn=>{timerFn=fn;return 1;},clearTimeout:()=>{timerFn=null;}};vm.runInNewContext(source,ctx);
 return{window,nodes,handlers,winHandlers,requests,fire:()=>timerFn?.(),resolve:data=>requestResolve({ok:true,json:async()=>data}),hasTimer:()=>!!timerFn};
}
test('typing a complete 14-digit ID triggers checking; restoring fields never makes an unsolicited query',()=>{
 const h=clientHarness();h.nodes.web_nssf.value=CARD.slice(0,10);h.handlers['web_nssf:input']({isTrusted:true});assert.equal(h.hasTimer(),false);h.nodes.web_nssf.value=CARD;h.handlers['web_nssf:input']({isTrusted:false});assert.equal(h.hasTimer(),false);h.handlers['web_nssf:input']({isTrusted:true});assert.equal(h.hasTimer(),true);h.fire();assert.equal(h.requests.length,1);assert.equal(JSON.parse(h.requests[0].options.body).cardNumber,CARD);
});
test('a response for a previous patient or changed role cannot open a dialog or restore verification metadata',async()=>{
 for(const change of [h=>h.nodes.web_health_id.value='SYNTHETIC-B',h=>h.window.emrSession.user.activeRole='CLERK',h=>h.nodes.web_nssf.value='00000000000999']){
  const h=clientHarness();h.nodes.web_nssf.value=CARD;h.handlers['nssf_verify_button:click']();assert.equal(h.requests.length,1);
  change(h);
  h.resolve({requestedCard:CARD,card:{valid:true,status:'VALID',validityType:'INDEFINITE'}});await new Promise(r=>setImmediate(r));assert.equal(h.nodes.web_nssf_verification.value,'');assert.doesNotMatch(h.nodes.nssf_verify_status.textContent,/មានសុពលភាពផ្លូវការ/);
 }
});
test('dialog displays unlimited validity in Khmer and English and keeps the existing shared HEF styling',()=>{
 const s=read('public/nssf-lookup.js'),start=s.indexOf('  function renderDialog('),end=s.indexOf('  async function verify(',start);
 for(const english of [false,true]){const nodes=new Map(),modal={open:false,showModal(){this.open=true;}};const c={ensureDialog:()=>modal,byId:id=>{if(!nodes.has(id))nodes.set(id,{});return nodes.get(id);},en:()=>english,txt:(kh,en)=>english?en:kh,formatDisplayDate:()=> '—',Date};vm.runInNewContext(s.slice(start,end)+'\nthis.render=renderDialog;',c);c.render({requestedCard:CARD,card:{valid:true,status:'VALID',validityType:'INDEFINITE'}});assert.equal(modal.open,true);assert.equal(nodes.get('nssf_banner').className,'hef-banner hef-banner-success');assert.equal(nodes.get('nssf_val_valid_until').textContent,english?'Valid indefinitely':'សុពលភាពមិនកំណត់');}
 assert.match(s,/hef-banner-warning/);assert.doesNotMatch(s,/paymentType\s*=|web_first_name.*\.value\s*=/);
});
