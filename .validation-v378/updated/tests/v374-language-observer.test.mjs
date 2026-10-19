import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const read = p => fs.readFileSync(new URL('../'+p, import.meta.url), 'utf8');
const source = read('public/emr-language.js');
function fixture(translate, clock = () => 0) {
  const timers = new Map(); let next=0, observer;
  class Observer {
    constructor(cb) { this.cb=cb; this.records=[]; observer=this; }
    observe() { this.active=true; }
    disconnect() { this.active=false; this.records=[]; }
    takeRecords() { return this.records.splice(0); }
  }
  const context=vm.createContext({Set,MutationObserver:Observer,performance:{now:clock},setTimeout:fn=>{timers.set(++next,fn);return next},clearTimeout:id=>timers.delete(id)});
  const a=source.indexOf('  function observeTranslations('), b=source.indexOf('  function translateChangedNode(',a);
  vm.runInContext(source.slice(a,b),context);
  const root={contains:n=>n.isConnected}; context.observeTranslations(root,translate,{});
  return {observer, root, node(parent=root){return {isConnected:true,parentNode:parent}}, pending:()=>timers.size, tick(){const [id,fn]=timers.entries().next().value;timers.delete(id);fn();}, drain(){let count=0;while(timers.size){assert.ok(++count<100,'queue should settle');this.tick();}}};
}

test('v37.4 coalesces repeated mutation records and suppresses its own observer writes',()=>{
 const seen=[];const f=fixture(n=>{assert.equal(f.observer.active,false);seen.push(n)});const node=f.node();
 f.observer.cb(Array.from({length:1000},()=>({type:'characterData',target:node})));
 assert.equal(seen.length,0);assert.equal(f.pending(),1);f.drain();assert.deepEqual(seen,[node]);assert.equal(f.observer.active,true);
});

test('v37.4 translates an added subtree once regardless of parent/child record order',()=>{
 for(const parentFirst of [true,false]){const seen=[];const f=fixture(n=>seen.push(n));const parent=f.node(),child=f.node(parent);
 f.observer.cb([{type:'childList',addedNodes:parentFirst?[parent,child]:[child,parent]}]);f.drain();assert.deepEqual(seen,[parent]);}
});

test('v37.4 yields between batches, reads latest state and skips removed nodes',()=>{
 let time=0;const seen=[];const f=fixture(n=>seen.push(n.value),()=>time+=5);
 const nodes=Array.from({length:6},(_,i)=>Object.assign(f.node(),{value:i}));
 f.observer.cb([{type:'childList',addedNodes:nodes}]);nodes[0].value='edited';nodes[1].isConnected=false;
 f.tick();assert.ok(seen.length<5);assert.equal(seen[0],'edited');assert.equal(f.pending(),1);f.drain();assert.deepEqual(seen,['edited',2,3,4,5]);
});

test('v37.4 retains queued records and resumes observing after a translation exception',()=>{
 let fail=true;const seen=[];const f=fixture(n=>{if(fail){fail=false;throw Error('test failure')}seen.push(n)});const one=f.node(),two=f.node();
 f.observer.cb([{type:'characterData',target:one}]);f.observer.records.push({type:'characterData',target:two});
 assert.throws(()=>f.tick(),/test failure/);assert.equal(f.observer.active,true);f.drain();assert.deepEqual(seen,[two]);
});

test('v37.4 added paraclinic text translates the text node, not the entire panel',()=>{
 let textCalls=0,trees=0;const parent={closest:()=>true};const node={nodeType:3,parentElement:parent};
 const a=source.indexOf('  function translateChangedNode('),b=source.indexOf('  const frameObservers',a);
 const c=vm.createContext({Node:{TEXT_NODE:3,ELEMENT_NODE:1},emrPage:true,englishOnly:false,excluded:()=>false,translateTextNode:n=>{assert.equal(n,node);textCalls++},translateControlNode(){},translateTree:()=>trees++,translateControls(){}});
 vm.runInContext(source.slice(a,b),c);c.translateChangedNode(node);assert.equal(textCalls,1);assert.equal(trees,0);
});

test('v37.4 nationality switching preserves option identity/value and coalesces duplicate calls',()=>{
 const code=read('public/nationalities.js');const a=code.indexOf('    syncLanguage(lang) {'),b=code.indexOf('\n    open() {',a);
 const options=[{value:'kh',textContent:'ខ្មែរ'},{value:'custom',textContent:'Custom'}],groups=[{label:'កម្ពុជា'}];let renders=0;
 const c=vm.createContext({GROUPS:[{labelEn:'Cambodia',labelKh:'កម្ពុជា',items:[{value:'kh',kh:'ខ្មែរ',en:'Khmer'}]}],isEnglish:l=>l==='en'});
 const obj=vm.runInContext('({'+code.slice(a,b)+'})',c);Object.assign(obj,{selectElem:{options,value:'custom',querySelectorAll:()=>groups},searchInput:{value:'search'},isOpen:true,syncButtonFromSelect(){},renderFilteredList(){renders++}});
 obj.syncLanguage('en');obj.syncLanguage('en');assert.equal(renders,1);assert.equal(options[0].textContent,'Khmer');assert.equal(obj.selectElem.value,'custom');assert.equal(obj.selectElem.options,options);
 obj.syncLanguage('kh');assert.equal(options[0].textContent,'ខ្មែរ');assert.equal(options[1].textContent,'Custom');assert.equal(obj.searchInput.value,'search');
});
