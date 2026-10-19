import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';
import {createEmrServer} from '../server/server.mjs';
import {projectRoot} from '../server/config.mjs';
const read=rel=>fs.readFileSync(path.join(projectRoot,rel),'utf8');

test('appointment view loads immediately, keeps appointment date after discharge, and switches its banner language',async()=>{
 const nodes=new Map();
 const node=id=>{if(!nodes.has(id))nodes.set(id,{value:'',textContent:'',innerHTML:'',hidden:false,dataset:{},events:{},removeAttribute(){},closest(){return null},addEventListener(name,fn){this.events[name]=fn}});return nodes.get(id)};
 const banner=node('banner'),patientPanel=node('patients'),windowEvents={};let lang='en',requests=0;
 const window={emrSession:{user:{activeRole:'REGISTRATION'},csrfToken:'test'},location:{search:'?view=appointments'},getBorkeoLanguage:()=>lang,addEventListener:(name,fn)=>windowEvents[name]=fn};
 const context={window,document:{title:'',getElementById:node,querySelector:s=>s==='.patient-page-banner h1'?banner:patientPanel},URLSearchParams,Date,console,fetch:async()=>{requests++;return {ok:true,json:async()=>({appointments:[{id:'a1',patientName:'Test Patient',appointmentDate:'2099-01-02',appointmentTime:'09:30',departmentCode:'OPD',status:'SCHEDULED'}]})}}};
 await vm.runInNewContext(read('public/appointment-list.js'),context);
 await new Promise(r=>setImmediate(r));
 assert.equal(requests,1,'Initial appointment fetch must run after control initialization');
 assert.equal(patientPanel.hidden,true);assert.equal(node('appointment-panel').hidden,false);
 assert.equal(banner.textContent,'Patient Appointment List');
 const row=node('appointment-table-body').innerHTML;
 assert.match(row,/Test Patient/);assert.match(row,/2099-01-02/);assert.match(row,/09:30/);
 assert.ok(row.indexOf('data-column="dischargeDate"')<row.indexOf('data-column="appointmentDate"'));
 assert.equal((row.match(/<td\b/g)||[]).length,13);
 lang='kh';windowEvents['borkeo-language-change']();assert.equal(banner.textContent,'បញ្ជីអ្នកជំងឺណាត់ជួប');
});

test('registration form has the new screen/print titles and retains save and continue after removing its redundant tab',()=>{
 const html=read('protected/EMR.html');
 assert.doesNotMatch(html,/<button[^>]*id="btn_sub_reg"/);
 assert.match(html,/id="sub_reg" class="sub-tab active"/);
 assert.match(html,/onclick="savePatientRecord\(\{ transferToTriage: true, allowMissingDepartment: true \}\)"/);
 assert.ok((html.match(/data-key="page1_title"[^>]*>ទម្រង់ចុះឈ្មោះអ្នកជំងឺ/g)||[]).length >= 1);
 assert.match(html,/page1_title: "Patient Registration Form"/);
 const panel=read('protected/patient-list.html').split('<section id="appointment-panel"')[1];
 assert.doesNotMatch(panel,/កាលបរិច្ឆេទចូល/);
 assert.match(panel,/data-column="dischargeDate">កាលបរិច្ឆេទចេញ<\/th>\s*<th[^>]*data-column="appointmentDate">ថ្ងៃណាត់ជួប/);
 assert.match(read('public/emr-language.js'),/\['បញ្ជីអ្នកជំងឺណាត់ជួប', 'Patient Appointment List'\]/);
});

test('Registration appointment page serves its linked script through the actual server',async()=>{
 const app=createEmrServer({demoMode:true,databasePath:':memory:',host:'127.0.0.1',port:0,appOrigin:'http://127.0.0.1:0',nodeEnv:'test'});
 try {
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve)});
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:app.config.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({username:'registration'})});assert.equal(login.status,200);
  const Cookie=login.headers.get('set-cookie').split(';')[0];
  const page=await fetch(origin+'/patient-list?view=appointments',{headers:{Cookie}});assert.equal(page.status,200);
  const html=await page.text(),src=html.match(/src="([^" ]*\/public\/appointment-list\.js[^" ]*)"/)?.[1];
  assert.ok(src);assert.match(src,/v=1920/);assert.match(src,/build=\d+\./);
  const script=await fetch(new URL(src,origin));assert.equal(script.status,200);assert.match(script.headers.get('content-type'),/^text\/javascript/);assert.equal(await script.text(),read('public/appointment-list.js'));
 } finally {await new Promise(r=>app.server.close(r));app.database.close()}
});
