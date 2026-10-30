import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { TransferBridge, receivingOrigin, patientPayload } from '../pmrs2-helper/connection.mjs';
const source = file => fs.readFileSync('pmrs2-helper/' + file, 'utf8');
function scrape(text, fields) {
  const ctx = vm.createContext({});
  vm.runInContext(source('scrape.js'), ctx);
  const el = { textContent: text, children: [], tagName: 'B', closest: () => null, getAttribute: () => null, nextSibling: null, nextElementSibling: null, parentElement: null };
  return JSON.parse(JSON.stringify(ctx.scrapePmrs2({ querySelectorAll: () => [el] }, fields)));
}
test('PMRS2 inline aliases and long names retain complete values', () => {
  const fields = [{ key: 'fullName', labels: ['Patient name', 'Name'] }];
  assert.deepEqual(scrape('Name: Synthetic Patient', fields), {fullName:'Synthetic Patient'});
  const name = 'Synthetic long name '.repeat(8).trim();
  assert.deepEqual(scrape('Name: ' + name, fields), {fullName:name});
  assert.deepEqual(scrape('Name\u17d6 Synthetic Patient', fields), {fullName:'Synthetic Patient'});
  assert.deepEqual(scrape('Nameplate: unrelated', fields), {});
});

function fixture() {
  const session={}, local={borkeoBaseUrl:'http://localhost:3002'}, tabs=[];
  let sequence=20;
  const area = values => ({ get: async defaults=>structuredClone({...defaults,...values}),set:async data=>Object.assign(values,structuredClone(data)) });
  const browser={storage:{session:area(session),local:area(local)},tabs:{create:async data=>{tabs.push(data);return {id:sequence++};}}};
  return {bridge:new TransferBridge(browser),session,local,tabs,source:{frameId:0,tab:{id:10},url:'https://pmrs.digitalsp.gov.kh/visits/register'},target:{frameId:0,tab:{id:20},url:'http://localhost:3002/emr?view=register'}};
}
test('one-click transfer opens one canonical registration and ignores repeat clicks while pending',async()=>{
  const f=fixture();const first=await f.bridge.handle({type:'pmrs2-send',payload:{fullName:'Synthetic Patient',age:'49 years'}},f.source);
  const again=await f.bridge.handle({type:'pmrs2-send',payload:{fullName:'Synthetic Patient',age:'49 years'}},f.source);
  await assert.rejects(f.bridge.handle({type:'pmrs2-send',payload:{fullName:'Different Patient'}},f.source),/busy/);
  assert.equal(first.id,again.id);assert.equal(f.tabs.length,1);assert.match(f.tabs[0].url,/view=register&/);
  assert.equal((await f.bridge.handle({type:'pmrs2-pending'},f.target)).payload.age,'49');
});
test('transfer payload is bound to the receiving tab and origin and retained until acknowledgement',async()=>{
  const f=fixture();const sent=await f.bridge.handle({type:'pmrs2-send',payload:{fullName:'Synthetic Patient'}},f.source);
  assert.equal((await f.bridge.handle({type:'pmrs2-pending'},{...f.target,tab:{id:21}})).ok,false);
  assert.equal((await f.bridge.handle({type:'pmrs2-pending'},{...f.target,url:'http://127.0.0.1:3001/emr'})).ok,false);
  assert.equal((await f.bridge.handle({type:'pmrs2-pending'},{...f.target,url:'http://localhost:3002/login'})).ok,true);
  await f.bridge.handle({type:'pmrs2-stage',id:sent.id,stage:'filled',fields:4,duplicates:1},f.target);
  assert.equal(f.session.pmrs2Transfers[sent.id].payload,undefined);
  const status=await f.bridge.handle({type:'pmrs2-status',id:sent.id},f.source);assert.equal(status.fields,4);assert.equal(status.duplicates,1);
});
test('failed transfers remain retryable and old acknowledgements cannot affect a newer transfer',async()=>{
  const f=fixture();const sent=await f.bridge.handle({type:'pmrs2-send',payload:{fullName:'Synthetic Patient'}},f.source);
  await f.bridge.handle({type:'pmrs2-stage',id:sent.id,stage:'failed',reason:'module'},f.target);
  assert.ok((await f.bridge.handle({type:'pmrs2-pending'},f.target)).payload);
  const next=await f.bridge.handle({type:'pmrs2-send',payload:{fullName:'Another Patient'}},f.source);
  assert.notEqual(next.id,sent.id);
  assert.equal((await f.bridge.handle({type:'pmrs2-stage',id:sent.id,stage:'filled'},f.target)).ok,false);
  assert.equal(f.session.pmrs2Transfers[next.id].payload.fullName,'Another Patient');
});
test('transfer expiry removes pending patient data and repeated navigation cannot loop',async()=>{
  const f=fixture();const sent=await f.bridge.handle({type:'pmrs2-send',payload:{healthId:'SYNTH-ID'}},f.source);
  assert.equal((await f.bridge.handle({type:'pmrs2-navigate',id:sent.id},f.target)).ok,true);
  assert.equal((await f.bridge.handle({type:'pmrs2-navigate',id:sent.id},f.target)).ok,false);
  f.session.pmrs2Transfers[sent.id].at=Date.now()-600001;
  assert.equal((await f.bridge.handle({type:'pmrs2-pending'},f.target)).ok,false);
  assert.deepEqual(f.session.pmrs2Transfers,{});
});
test('transfer rejects external destinations, unauthorised senders and non-patient payloads',async()=>{
  assert.throws(()=>receivingOrigin('https://example.com'));
  assert.throws(()=>receivingOrigin('http://localhost:3002/login'));
  assert.throws(()=>patientPayload({sex:'male'}));
  const f=fixture();await assert.rejects(f.bridge.handle({type:'pmrs2-send',payload:{fullName:'Synthetic'}},{...f.source,url:'https://example.com'}));
  await assert.rejects(f.bridge.handle({type:'pmrs2-pending'},{...f.target,frameId:2}));
});

test('receiver times out visibly without injecting scripts or repeatedly navigating',async()=>{
  for(const ready of [false,true]){
    const attrs=new Map(ready?[['data-borkeo-pmrs2-ready','1']]:[]),timers=[],stages=[],created=[],notices=[];
    const root={getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
    const document={documentElement:root,body:{append:n=>notices.push(n)},createElement:tag=>{created.push(tag);return {setAttribute(){},style:{},dataset:{}};},getElementById:()=>({}),dispatchEvent(){}};
    const runtime={lastError:null,getManifest:()=>({version:'51.4.0'}),sendMessage:(message,cb)=>{if(message.type==='pmrs2-pending')cb({ok:true,id:'SYNTH-T',payload:{fullName:'Synthetic'}});else{stages.push(message);cb({ok:true});}}};
    const context=vm.createContext({document,chrome:{runtime},location:{pathname:'/emr',href:'http://localhost:3002/emr?view=register',replace(){throw Error('Unexpected navigation');}},URL,JSON,Event,setTimeout:fn=>timers.push(fn)});
    vm.runInContext(source('borkeo-content.js'),context);
    for(let i=0;i<155;i++){await new Promise(setImmediate);if(timers.length)await timers.shift()();}
    assert.equal(stages.at(-1).stage,'failed');assert.equal(stages.at(-1).reason,ready?'apply':'module');
    assert.equal(created.includes('script'),false);assert.equal(attrs.has('data-borkeo-pmrs2-import'),false);assert.equal(notices[0].dataset.stage,'failed');
  }
});
