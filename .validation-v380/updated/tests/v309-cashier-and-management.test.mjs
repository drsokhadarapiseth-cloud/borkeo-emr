import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {createEmrServer} from '../server/server.mjs';
import {patientRecordChangeNotes} from '../server/editor-history.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('Cashier and Accountant legacy EMR links redirect to invoice history; clinical access stays restricted', async()=>{
 const origin='http://127.0.0.1:32709';
 const app=createEmrServer({demoMode:true,host:'127.0.0.1',port:32709,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
 await new Promise(r=>app.server.listen(32709,'127.0.0.1',r));
 try {
  async function login(username) {
   const r=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});assert.equal(r.status,200);
   const Cookie=r.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();return {Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
  }
  const key='case:AUDIT309',registration=await login('registration');
  const summary={caseNumber:'AUDIT309',healthId:'AUDIT309',fullName:'Synthetic Audit Patient',sex:'ប្រុស',age:'40',phone:'010111111',entryDate:new Date().toISOString().slice(0,10),serviceMode:'',departmentCode:''};
  const save=async(phone)=>{const r=await fetch(origin+'/api/patient-record',{method:'PUT',headers:registration,body:JSON.stringify({patientKey:key,summary:{...summary,phone},data:{'scope:registration:id:web_phone':phone,'scope:registration:id:emr_pmrs_case_new':true}})});assert.equal(r.status,200,await r.clone().text())};
  await save('010111111');await save('010222222');
  for (const role of ['clerk','accountant']) {
   const headers=await login(role);
   for (const param of ['patient','patientKey']) {
    const r=await fetch(origin+'/emr?'+param+'='+encodeURIComponent(key),{headers,redirect:'manual'});
    assert.equal(r.status,302);assert.equal(r.headers.get('location'),'/billing?patientKey='+encodeURIComponent(key)+'&history=1');
   }
   assert.equal((await fetch(origin+'/billing?patientKey='+encodeURIComponent(key)+'&history=1',{headers})).status,200);
   assert.equal((await fetch(origin+'/api/finance/invoice-history?patientKey='+encodeURIComponent(key),{headers})).status,200);
   assert.equal((await fetch(origin+'/api/patient-editor-history?patientKey='+encodeURIComponent(key),{headers})).status,403);
   assert.equal((await fetch(origin+'/api/patient-record?patientKey='+encodeURIComponent(key),{headers})).status,403);
  }
  for (const role of ['admin','director','vice_director']) {
   const headers=await login(role);const r=await fetch(origin+'/api/patient-editor-history?patientKey='+encodeURIComponent(key),{headers});assert.equal(r.status,200);
   const entries=(await r.json()).entries;
   const changed=entries.find(e=>e.notes.some(n=>n.field==='summary:phone'&&n.before==='010111111'&&n.after==='010222222'));
   assert.ok(changed,'management sees the server-computed before and after values');assert.equal(changed.role,'REGISTRATION');assert.ok(changed.editorName);assert.ok(Number.isInteger(changed.savedAt));
  }
 } finally {await new Promise(r=>app.server.close(r));app.database.close()}
});

test('audit diff records booleans, deletions and summary fields without leaking raw photos or signatures',()=>{
 const before={phone:'old',record_json:JSON.stringify({'scope:registration:id:web_patient_photo':'data:image/jpeg;base64,OLD','scope:triage:id:checked':false,'scope:medical:id:removed':'old note','system:signature:medical':'OLD_SIGNATURE'})};
 const after={phone:'new',record_json:JSON.stringify({'scope:registration:id:web_patient_photo':'data:image/jpeg;base64,NEW','scope:triage:id:checked':true,'system:signature:medical':'NEW_SIGNATURE'})};
 const notes=patientRecordChangeNotes(before,after);
 assert.ok(notes.some(n=>n.field==='summary:phone'&&n.before==='old'&&n.after==='new'));
 assert.ok(notes.some(n=>n.field==='scope:triage:id:checked'&&n.before==='false'&&n.after==='true'));
 assert.ok(notes.some(n=>n.field==='scope:medical:id:removed'&&n.after===''));
 assert.doesNotMatch(JSON.stringify(notes),/data:image|SIGNATURE/);
});

test('management chooser uses exactly three text-only buttons and opens the encoded patient record safely',()=>{
 const source=read('public/patient-list.js'),start=source.indexOf('  function openMgmtChoice('),end=source.indexOf('  function ensureMgmtHistoryModal',start);
 const nodes={};const dialog={querySelector:id=>nodes[id]??=( {}),close(){this.closed=true},showModal(){this.open=true}};let opened;
 const ctx={language:'kh',ensureMgmtChoiceModal:()=>dialog,window:{open:(...args)=>{opened=args}},openMgmtHistory(){},encodeURIComponent};
 vm.runInNewContext(source.slice(start,end)+'\nopenMgmtChoice("case:VIEW309", "Test", "/unsafe");',ctx);
 assert.equal(nodes['#mgmt-choice-medical-btn'].textContent,'មើលកំណត់ត្រាវេជ្ជសាស្ត្រ');
 assert.equal(nodes['#mgmt-choice-history-btn'].textContent,'មើលកំណត់ហេតុផ្លាស់ប្តូរទិន្នន័យ');
 assert.equal(nodes['#mgmt-choice-cancel-btn'].textContent,'បោះបង់');
 nodes['#mgmt-choice-medical-btn'].onclick();assert.deepEqual(opened,['/emr?patient=case%3AVIEW309','_blank','noopener,noreferrer']);
 for (const id of ['#mgmt-choice-medical-btn','#mgmt-choice-history-btn','#mgmt-choice-cancel-btn']) assert.doesNotMatch(nodes[id].textContent,/\p{Extended_Pictographic}|<i\b|<svg/gu);
});

test('invoice header has no duplicate printing and its mobile action row prevents wrapping',()=>{
 const html=read('protected/billing.html'),css=read('public/billing.css');
 assert.doesNotMatch(html,/id="print-bill(?:-en)?"/);
 for(const id of ['print-invoice','print-invoice-en']) assert.equal((html.match(new RegExp('id="'+id+'"','g'))||[]).length,1);
 assert.match(css,/\.patient-head-actions\{white-space:nowrap!important;flex-wrap:nowrap!important;flex-shrink:0/);
 assert.match(css,/overflow-x:auto;overflow-y:hidden/);assert.match(css,/width:auto!important;word-break:normal!important/);
});

// Execute the actual ICD UI script against a minimal DOM to exercise keyboard/mouse selection.
test('ICD items show one description, mouse and keyboard share selection, Enter fills only empty notes',async()=>{
 class Node {
  constructor(tag){this.tagName=tag;this.children=[];this.attrs={};this.handlers={};this.dataset={};this.style={};this.value='';this.hidden=false;this.disabled=false;this.readOnly=false;this.nodeType=1;this.textContent=''}
  append(child){this.children.push(child);child.parentNode=this}
  replaceChildren(){this.children=[]}
  setAttribute(k,v){this.attrs[k]=v}removeAttribute(k){delete this.attrs[k]}
  addEventListener(k,fn){this.handlers[k]=fn}
  querySelectorAll(sel){return sel.startsWith('button')?this.children.filter(n=>n.tagName==='button'&&!n.disabled):[]}
  closest(){return null}contains(node){return this===node||this.children.includes(node)}
  getBoundingClientRect(){return {left:10,width:450,top:10,bottom:45}}scrollIntoView(){}
  setCustomValidity(){}dispatchEvent(){}focus(){doc.activeElement=this}click(){this.onclick?.()}
 }
 const input=new Node('input');input.id='diag_input';const note=new Node('textarea');const body=new Node('body');
 const doc={body,activeElement:input,createElement:tag=>new Node(tag),getElementById:id=>id==='emr_pmrs_opd_diagnosis'?note:null,querySelectorAll:()=>[input],addEventListener(){}};
 const ctx={document:doc,window:{innerWidth:1200,innerHeight:900,currentLang:'english',addEventListener(){}},MutationObserver:class{observe(){}},AbortController,Event:class{},setTimeout,clearTimeout,fetch:async()=>({ok:true,json:async()=>({items:[{id:1,code:'J02.9',en:'Acute pharyngitis',kh:'Khmer description',selectable:true},{id:2,code:'J03.9',en:'Acute tonsillitis',kh:'Second description',selectable:true}]})})};
 vm.runInNewContext(read('public/emr-icd10.js'),ctx);input.handlers.focus();await new Promise(r=>setTimeout(r,0));
 const popup=body.children[0];assert.equal(popup.children[0].textContent,'J02.9 - Acute pharyngitis');
 const key=k=>input.handlers.keydown({key:k,preventDefault(){}});
 key('ArrowDown');assert.equal(popup.children[0].attrs['aria-selected'],'true');
 popup.children[1].onmouseenter();assert.equal(popup.children[1].attrs['aria-selected'],'true');assert.equal(popup.children[0].attrs['aria-selected'],'false');
 key('Enter');assert.equal(input.value,'J03.9');assert.equal(note.value,'Acute tonsillitis');
 note.value='Existing clinician note';input.handlers.focus();await new Promise(r=>setTimeout(r,0));key('ArrowDown');key('Enter');assert.equal(note.value,'Existing clinician note');
 const css=read('public/emr-icd10.css');assert.match(css,/white-space:nowrap!important/);assert.match(css,/border:0!important;border-bottom:0!important/);assert.match(css,/#2ea44f!important;color:#fff!important/);
});

test('OPD identity header is promoted outside the general form and save controls use the bottom position',()=>{
 const source=read('public/emr-patient-record.js');
 const start=source.indexOf('  function organizeOpdHeader('),end=source.indexOf('  function initialize()',start);
 const header={},toolbar={},host={contains:node=>node===header,querySelector:()=>toolbar,insertBefore(node,anchor){this.moved=[node,anchor]}};
 vm.runInNewContext(source.slice(start,end)+'\norganizeOpdHeader();',{document:{getElementById:id=>id==='sub_opd'?host:header}});
 assert.deepEqual(host.moved,[header,toolbar]);
 const pos=source.indexOf("['sub_opd', 'sub_ipd', 'sub_nursing'].forEach(id => addSaveBar");
 const statement=source.slice(pos,source.indexOf(';',pos)+1);const calls=[];
 vm.runInNewContext(statement,{document:{getElementById:id=>id},addSaveBar:(node,position)=>calls.push([node,position])});
 assert.deepEqual(calls,[['sub_opd','beforeend'],['sub_ipd','afterbegin'],['sub_nursing','afterbegin']]);
 assert.match(source,/submitOpdPrescription:true,markMedicalComplete:true/);
 assert.match(source,/saveBar\.append\(preview\)/);
 const css=read('public/patient-photo.css');assert.match(css,/width:4cm!important;height:6cm!important/);assert.match(css,/emr-opd-workspace #inpatient-patient-context \.inpatient-context-item\{display:none!important/);
 assert.doesNotMatch(css,/#patient-payment-status-banner\{display:none/);
});
