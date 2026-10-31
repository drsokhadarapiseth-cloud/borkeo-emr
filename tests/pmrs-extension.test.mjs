import test from 'node:test';
import assert from 'node:assert/strict';
import {installBackground} from '../tools/pmrs-chrome-import/background.mjs';
import {TTL,emrOrigin,permissionPattern,inspectEmr,deliverPatient} from '../tools/pmrs-chrome-import/transport.mjs';
import {capturePatient} from '../tools/pmrs-chrome-import/capture.mjs';

const registration={healthId:'SYN-100-1',caseNumber:'CASE-O001',fullName:'Synthetic Patient',sex:'ស្រី',age:'35'};
const event=()=>({listeners:[],addListener(fn){this.listeners.push(fn);}});
function area(initial={}) {const data=structuredClone(initial);return {data,async get(key){return {[key]:structuredClone(data[key])};},async set(value){Object.assign(data,structuredClone(value));},async remove(key){delete data[key];},async setAccessLevel(){}};}
function harness(){
  const local=area({origin:'https://emr.example.org'}),session=area();
  const tabs=new Map([[1,{id:1,url:'https://pmrs.digitalsp.gov.kh/patient',status:'complete'}]]);
  let auth='LOGIN_REQUIRED',deliveries=0,drop=false,checks=0;
  const api={action:{onClicked:event(),async setBadgeText(){}},runtime:{id:'synthetic-extension',getURL:file=>'chrome-extension://synthetic-extension/'+file,onMessage:event(),async openOptionsPage(){}},storage:{local,session},permissions:{async contains(){return true;}},alarms:{create(){},onAlarm:event()},tabs:{onUpdated:event(),onRemoved:event(),async get(id){return tabs.get(id);},async query(){return [tabs.get(1)];},async create({url}){const tab={id:2,url,status:'complete'};tabs.set(2,tab);return tab;},async update(id,changes){Object.assign(tabs.get(id),changes);return tabs.get(id);}},scripting:{async executeScript({func,args}){
    if(func===capturePatient)return [{result:structuredClone(registration)}];
    if(func===inspectEmr){checks++;return [{result:{code:auth}}];}
    assert.equal(func,deliverPatient);deliveries++;assert.equal(args[2].healthId,registration.healthId);
    if(drop)throw Error('Simulated lost execution result');return [{result:{code:'DRAFT_FILLED'}}];
  }}};
  const worker=installBackground(api),sender={id:api.runtime.id,url:api.runtime.getURL('popup.html')};
  return {api,worker,tabs,local,session,send:message=>worker.handle(message,sender),auth:code=>{auth=code;},drop:()=>{drop=true;},get deliveries(){return deliveries;},get checks(){return checks;}};
}
test('extension target accepts HTTPS or local loopback, rejects embedded credentials and paths',()=>{
  assert.equal(emrOrigin('http://127.0.0.1:3001'),'http://127.0.0.1:3001');
  assert.equal(permissionPattern('http://127.0.0.1:3001'),'http://127.0.0.1/*');
  assert.equal(emrOrigin('https://emr.example.org/'),'https://emr.example.org');
  for(const value of ['http://emr.example.org','https://user:pass@emr.example.org','https://emr.example.org/login','https://emr.example.org/?patient=123','https://pmrs.digitalsp.gov.kh'])assert.throws(()=>emrOrigin(value));
});
test('pending capture survives login and context redirects; delivery occurs once in the configured EMR tab',async()=>{
  const h=harness();assert.equal((await h.send({type:'CAPTURE'})).code,'OPENING');await h.worker.resume(2);
  assert.equal(h.session.data.status,'LOGIN_REQUIRED');assert.equal(h.deliveries,0);
  assert.equal((await h.send({type:'CAPTURE'})).code,'PENDING_EXISTS');
  const nonce=h.session.data.pending.nonce;
  h.tabs.get(2).url='https://emr.example.org/login';await h.worker.resume(2);assert.equal(h.deliveries,0);
  h.auth('CONTEXT_REQUIRED');h.tabs.get(2).url='https://emr.example.org/context';await h.worker.resume(2);
  assert.equal(h.session.data.pending.nonce,nonce);assert.equal(h.session.data.status,'CONTEXT_REQUIRED');
  h.auth('READY');h.tabs.get(2).url='https://emr.example.org/dashboard';await h.worker.resume(2);
  assert.equal(h.tabs.get(2).url,'https://emr.example.org/emr?view=register&pmrsExtension='+nonce);
  await h.worker.resume(2);assert.equal(h.deliveries,1);assert.equal(h.session.data.pending,undefined);assert.equal(h.session.data.status,'DRAFT_FILLED');
  await h.worker.resume(2);assert.equal(h.deliveries,1);
  assert.deepEqual(h.local.data,{origin:'https://emr.example.org'});
  assert.ok(!h.tabs.get(2).url.includes(registration.healthId));
});
test('pending jobs expire, cancel, and never send data to another origin or port',async()=>{
  const h=harness();await h.send({type:'CAPTURE'});await h.worker.resume(2);
  h.auth('READY');h.tabs.get(2).url='https://untrusted.example.org/';await h.worker.resume(2);assert.equal(h.deliveries,0);
  h.tabs.get(2).url='https://emr.example.org:444/';await h.worker.resume(2);assert.equal(h.deliveries,0);
  h.session.data.pending.expiresAt=Date.now()-1;await h.worker.resume(2);assert.equal(h.session.data.pending,undefined);assert.equal(h.session.data.status,'EXPIRED');
  await h.send({type:'CAPTURE'});await h.worker.resume(2);await h.send({type:'CANCEL'});assert.equal(h.session.data.pending,undefined);
  assert.equal(TTL,600000);
});
test('lost delivery receipts and interrupted workers are never automatically replayed',async()=>{
  const h=harness();await h.send({type:'CAPTURE'});await h.worker.resume(2);h.auth('READY');h.drop();await h.worker.resume(2);
  assert.equal(h.deliveries,1);assert.equal(h.session.data.status,'DELIVERY_UNCONFIRMED');assert.equal(h.session.data.pending,undefined);
  await h.worker.resume(2);assert.equal(h.deliveries,1);
  h.session.data.pending={origin:'https://emr.example.org',tabId:2,nonce:crypto.randomUUID(),phase:'delivering',registration,expiresAt:Date.now()+TTL};
  const restarted=installBackground(h.api);await restarted.resume(2);assert.equal(h.deliveries,1);assert.equal(h.session.data.pending,undefined);
});
test('untrusted extension messages cannot capture, resume or cancel data',async()=>{
  const h=harness();for(const type of ['CAPTURE','RESUME','CANCEL','STATUS'])assert.equal((await h.worker.handle({type},{id:'other',url:'https://pmrs.digitalsp.gov.kh'})).code,'ACCESS_DENIED');
  assert.equal(h.session.data.pending,undefined);
});
test('a configured toolbar click starts capture directly; an unconfigured click opens settings',async()=>{
  const h=harness();h.api.action.onClicked.listeners[0]();await new Promise(resolve=>setImmediate(resolve));
  assert.ok(h.session.data.pending);assert.equal(h.session.data.status,'LOGIN_REQUIRED');
  const fresh=harness();delete fresh.local.data.origin;let opened=0;fresh.api.runtime.openOptionsPage=async()=>{opened++;};
  fresh.api.action.onClicked.listeners[0]();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(opened,1);assert.equal(fresh.session.data.pending,undefined);
});
