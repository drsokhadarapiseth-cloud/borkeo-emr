import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {projectRoot} from '../server/config.mjs';
import {createEmrServer} from '../server/server.mjs';
const read=p=>fs.readFileSync(path.join(projectRoot,p),'utf8');
function counterFixture(saved){
 const storage=new Map(saved===undefined?[]:[['borkeo-counter-number',saved]]),events={};
 const window={sessionStorage:{getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)},getBorkeoLanguage:()=> 'kh',addEventListener:(k,fn)=>(events[k]??=[]).push(fn),dispatchEvent:e=>(events[e.type]||[]).forEach(fn=>fn(e))};
 const document={createElement:()=>{const select={value:'',attrs:{},events:{},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,fn){this.events[k]=fn}};const span={textContent:''};return {className:'',innerHTML:'',select,span,querySelector:s=>s==='select'?select:span}}};
 const source=read('public/emr-session.js').replace(/\r/g,''),a=source.indexOf('  function counterRole('),b=source.indexOf('  try {\n    const session',a);
 // Actual component functions, run without the unrelated network/bootstrap layer.
 const context={window,document};const api=vm.createContext({...context,CustomEvent:class{constructor(type,options){this.type=type;this.detail=options.detail}}});
 vm.runInContext(source.slice(a,b).replace(/\r/g,'')+'\nthis.counterRole=counterRole;this.createCounterControl=createCounterControl;',api);
 return {api,window,storage,events};
}
test('counter is available only to Registration, Triage and OPD doctors, with a fresh default of 1',()=>{
 const {api,window,storage}=counterFixture();
 for(const user of [{activeRole:'REGISTRATION'},{activeRole:'TRIAGE'},{activeRole:'DOCTOR',activeWard:{code:'opd'}}]){
  const control=api.createCounterControl(user);assert.equal(control.select.value,'1');assert.equal(window.emrCounterNumber,'1');assert.equal(storage.get('borkeo-counter-number'),'1');
 }
 for(const activeRole of ['ADMIN','VICE_DIRECTOR','DIRECTOR','CLERK','NURSE','LAB','IMAGING'])assert.equal(api.createCounterControl({activeRole}),null);
 assert.equal(api.createCounterControl({activeRole:'DOCTOR',activeWard:{code:'medicine'}}),null);
 assert.equal(counterFixture('bad').api.createCounterControl({activeRole:'TRIAGE'}).select.value,'1');
});
test('counter changes persist between tabs and remain synchronized with the existing queue controls',()=>{
 const {api,window,storage}=counterFixture('3'),control=api.createCounterControl({activeRole:'TRIAGE'});assert.equal(control.select.value,'3');
 control.select.value='4';control.select.events.change();assert.equal(storage.get('borkeo-counter-number'),'4');assert.equal(window.emrCounterNumber,'4');
 window.dispatchEvent({type:'emr-counter-changed',detail:'2'});assert.equal(control.select.value,'2');assert.equal(window.emrCounterNumber,'2');
 assert.equal(counterFixture(storage.get('borkeo-counter-number')).api.createCounterControl({activeRole:'TRIAGE'}).select.value,'2');
 const source=read('public/emr-session.js');assert.match(source,/if\(counterControl\)nav\.append\(counterControl\)/);assert.doesNotMatch(source,/actions\.append\(counterControl\)/);
});
test('all banners drop local classes and inline sizing, then use one fixed title and font stylesheet',()=>{
 const source=read('public/emr-session.js'),css=read('public/emr-session.css');
 assert.match(source,/banner\.className='session-host emr-unified-banner no-print'/);assert.match(source,/banner\.removeAttribute\('style'\)/);assert.match(source,/banner\.id='emr-site-banner'/);
 assert.match(source,/មន្ទីរពេទ្យបង្អែក បរកែវ/);
 assert.match(css,/#emr-site-banner \.emr-unified-brand h1\{[^}]*font:400 28px\/1\.4 BorkeoBannerTitle/);
 assert.match(css,/#emr-main-nav \.portal-counter-control/);assert.match(read('public/organization-branding.js'),/closest\('\.emr-unified-brand'\)/);
});
test('different staff pages serve the identical banner script and stylesheet for this release',async()=>{
 const app=createEmrServer({demoMode:true,databasePath:':memory:',host:'127.0.0.1',port:0,appOrigin:'http://127.0.0.1:0',nodeEnv:'test'});
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${app.server.address().port}`;
  const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:app.config.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({username:'admin'})}),Cookie=response.headers.get('set-cookie').split(';')[0];
   for(const url of ['/home','/emr','/patient-list','/billing','/lab','/imaging','/departments']){
   const r=await fetch(origin+url,{headers:{Cookie}});assert.equal(r.status,200,url);const html=await r.text();assert.match(html,/\/public\/emr-session\.js\?v=[^" ]+&build=[23][0-9]\./);assert.match(html,/\/public\/emr-session\.css\?v=[^" ]+&build=[23][0-9]\./);
   }
 }finally{await new Promise(r=>app.server.close(r));app.database.close()}
});
