import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
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
function handoff({ack=false, origin='http://localhost:3002', newer=false, ok=true}={}) {
  const attrs = new Map(); const timers=[]; const removed=[]; const notices=[];
  const cfg={pmrs2Payload:{fullName:'Synthetic Patient'},pmrs2PayloadAt:Date.now(),pmrs2TransferId:'transfer-1',pmrs2TargetOrigin:'http://localhost:3002'};
  const root={getAttribute:k=>attrs.get(k),setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
  const doc={documentElement:root,getElementById:()=>({}),createElement:()=>({setAttribute(){},remove(){},style:{}}),body:{appendChild:el=>notices.push(el.textContent)},head:{appendChild(){if(ack)attrs.set('data-borkeo-pmrs2-result',JSON.stringify({id:'transfer-1',ok}));}}};
  const ctx=vm.createContext({document:doc,location:{search:'?pmrs2Import=1',origin},Date,JSON,setTimeout:fn=>timers.push(fn),chrome:{runtime:{getURL:p=>p},storage:{local:{get:(defaults,cb)=>cb(defaults.pmrs2PayloadAt===0?cfg:{pmrs2TransferId:newer?'transfer-2':'transfer-1'}),remove:keys=>removed.push(keys)}}}});
  vm.runInContext(source('borkeo-content.js'),ctx);
  while(timers.length)timers.shift()();
  return {removed,notices,attrs};
}
test('PMRS2 clears pending details only on a successful matching acknowledgement',()=>{
  assert.equal(handoff({ack:true}).removed.length,1);
  assert.equal(handoff({ack:true,newer:true}).removed.length,0);
  assert.equal(handoff({ack:true,ok:false}).removed.length,0);
  const failed=handoff();assert.equal(failed.removed.length,0);assert.equal(failed.notices.length,1);assert.equal(failed.attrs.has('data-borkeo-pmrs2-import'),false);
  assert.equal(handoff({origin:'http://127.0.0.1:3001'}).removed.length,0);
});
