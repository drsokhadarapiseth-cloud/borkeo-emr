import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {createEmrServer} from '../server/server.mjs';import {reviewTemplate} from '../server/review-template.mjs';
import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {NORMAL_EXAM} from '../public/pmrs2-exam-normal.js';import {openBrowser} from './helpers/context-browser.mjs';

test('colored IPD SOAP summarizes normal systems, wraps full findings and saves manual sections',{timeout:240000},async()=>{
 const app=createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false});let browser;
 try{
  const fixture=buildCompleteRegistrationPatients()[0],key='case:SOAP-507';
  const data={...Object.fromEntries(Object.entries(fixture.data).filter(([k])=>k.startsWith('scope:registration:'))),
   'scope:registration:id:web_adm_no':'SOAP-507','scope:medical:id:ipd_history_present_illness':'Documented symptom history',
   'scope:medical:id:ipd_plan_notes':'Documented treatment plan','scope:triage:id:p2_temp':'36.8',
   'scope:medical:id:emr_ipd_diagnoses':JSON.stringify([{icd10:'J02',text:'Documented diagnosis',main:true}])};
  for(const [id,[,normal]] of Object.entries(NORMAL_EXAM.heent.fields))data['scope:medical:id:'+id]=normal;
  const legacyHead=data['scope:medical:id:ipd_exam_head'];delete data['scope:medical:id:ipd_exam_head'];data['scope:medical:auto:113']=legacyHead;
  const long='Documented right eye swelling with additional examination findings. '.repeat(9)+'<script>window.soapXss=1</script>';
  data['scope:medical:id:ipd_exam_eye_right']=long;
  const summary={...fixture.summary,caseNumber:'SOAP-507',sex:'Female',age:'30',dateOfBirth:'1996-01-01',serviceMode:'ipd',departmentCode:'medicine'};
  app.database.upsertPatient({id:crypto.randomUUID(),patientKey:key,userId:app.database.sqlite.prepare("SELECT id FROM users WHERE username='doctor_medicine'").get().id,savedAt:Date.now(),summary,data});
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));app.config.appOrigin='http://127.0.0.1:'+app.server.address().port;
  browser=await openBrowser();await browser.send('Network.setBlockedURLs',{urls:['https://*']});await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:'window.print=()=>{};document.addEventListener("emr:patient-loaded",()=>window.syntheticLoaded=true)'});
  const response=await fetch(app.config.appOrigin+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:app.config.appOrigin},body:JSON.stringify({username:'doctor_medicine'})});const [name,value]=response.headers.get('set-cookie').split(';')[0].split('=');await browser.send('Network.setCookie',{name,value,url:app.config.appOrigin});
  const visit=async mode=>{await browser.send('Page.navigate',{url:app.config.appOrigin+'/emr?'+new URLSearchParams({patient:key,view:'medical',mode})});await browser.waitFor('window.syntheticLoaded&&!!window.BorkeoIpdRecord','loaded IPD SOAP',60000)};
  await visit('edit');await browser.waitFor('document.getElementById("ipd_soap_o").value.includes("right eye swelling")','automatic concise SOAP');await browser.waitFor('!!document.querySelector("#sub_ipd [data-clinical-recorded-status]")','clinical status loaded');
  assert.deepEqual(await browser.evaluate('[...document.querySelectorAll("[data-ipd-exam-section]")].map(n=>n.dataset.ipdExamSection)'),['general','heent','respiratory','cardiovascular','abdomen','genitourinary','extremities','musculoskeletal','neurological','other']);
  assert.equal(await browser.evaluate('document.getElementById("ipd_exam_gcs_total").closest("[data-ipd-exam-section]").dataset.ipdExamSection'),'neurological');
  assert.equal(await browser.evaluate('document.getElementById("ipd_exam_pain").closest("[data-ipd-exam-section]").dataset.ipdExamSection'),'general');
  assert.equal(await browser.evaluate('[...document.querySelectorAll("#ipd_head_to_toe :is(.ipd-exam-title,.ipd-exam-label,.ipd-exam-side)")].filter(n=>/^[·•\\-\\s]|[:\\uff1a\u17c8]\\s*$/.test(n.textContent)).length'),0,'clean examination captions');
  assert.equal(await browser.evaluate('document.getElementById("ipd_exam_eye_left").closest(".ipd-exam-row")===document.getElementById("ipd_exam_eye_right").closest(".ipd-exam-row")'),true,'left and right eye share one row');
  assert.equal(await browser.evaluate('[...document.querySelectorAll("#ipd_head_to_toe .ipd-exam-row input[type=text],#ipd_head_to_toe .ipd-exam-row textarea")].every(n=>getComputedStyle(n).borderTopStyle==="solid")'),true,'boxed examination fields');
  assert.equal(await browser.evaluate('document.getElementById("ipd_exam_gcs_eye").previousElementSibling.dataset.key'),'ipd_eye');
  assert.equal(await browser.evaluate('document.getElementById("ipd_exam_eye_right").tagName'),'TEXTAREA');
  assert.equal(await browser.evaluate('document.getElementById("ipd_exam_head").dataset.emrStorageKey'),'scope:medical:id:ipd_exam_head');
  assert.equal(await browser.evaluate('document.getElementById("ipd_exam_head").dataset.emrPreviousStorageKey'),'scope:medical:auto:113');
  assert.equal(await browser.evaluate('document.getElementById("ipd_exam_head").value'),legacyHead);
  assert.equal(await browser.evaluate('getComputedStyle(document.querySelector("#sub_ipd [data-clinical-recorded-status]")).display'),'none');
  const objective=await browser.evaluate('document.getElementById("ipd_soap_o").value');assert.ok(objective.includes(long));assert.ok(!objective.includes(legacyHead));
  assert.deepEqual(await browser.evaluate('[...document.querySelectorAll(".ipd-soap-card")].map(n=>getComputedStyle(n).borderLeftColor)'),['rgb(59, 130, 246)','rgb(16, 185, 129)','rgb(245, 158, 11)','rgb(239, 68, 68)']);
  // A clinician explicitly completes the remaining normal systems, then records one abnormal finding.
  await browser.evaluate('fillClinicalExamNormal("respiratory");fillClinicalExamNormal("cardiovascular");document.getElementById("ipd_exam_resp_auscultation").value="Documented wheeze";document.getElementById("ipd_exam_resp_auscultation").dispatchEvent(new Event("input",{bubbles:true}))');
  await browser.waitFor('document.getElementById("ipd_soap_o").value.includes("Documented wheeze")','mixed-system summary');
  const mixed=await browser.evaluate('document.getElementById("ipd_soap_o").value');assert.ok(!mixed.includes(NORMAL_EXAM.respiratory.fields.ipd_exam_resp_inspection[1]));assert.ok(!mixed.includes(NORMAL_EXAM.cardiovascular.fields.ipd_exam_cvs_auscultation[1]));
  fs.mkdirSync('.validation-ipd507',{recursive:true});
  for(const width of [1440,390]){
   await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
   await browser.evaluate('document.getElementById("ipd_exam_eye_right").scrollIntoView({block:"center"});window.dispatchEvent(new Event("resize"))');
   try{await browser.waitFor('(()=>{const n=document.getElementById("ipd_exam_eye_right");return n.clientHeight>=n.scrollHeight-2&&n.clientWidth>=n.scrollWidth-1})()','fully expanded examination text')}catch(error){console.log(await browser.evaluate('(()=>{const n=document.getElementById("ipd_exam_eye_right"),s=getComputedStyle(n);return {width:innerWidth,clientHeight:n.clientHeight,scrollHeight:n.scrollHeight,clientWidth:n.clientWidth,scrollWidth:n.scrollWidth,height:s.height,maxHeight:s.maxHeight,whiteSpace:s.whiteSpace,inline:n.style.cssText}})()'));throw error}
   const shot=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.validation-ipd507/examination-'+width+'.png',Buffer.from(shot.data,'base64'));
   await browser.evaluate('document.getElementById("ipd_head_to_toe").scrollIntoView({block:"start"})');const exam=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.validation-ipd507/head-to-toe-'+width+'.png',Buffer.from(exam.data,'base64'));
   await browser.evaluate('document.getElementById("ipd_soap_summary_panel").scrollIntoView({block:"start"})');const soap=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync('.validation-ipd507/soap-'+width+'.png',Buffer.from(soap.data,'base64'));
  }
  // Typing a new line must not reset the caret or trim the active text box.
  await browser.evaluate('(()=>{const n=document.getElementById("ipd_soap_o");n.value="Clinician reviewed objective\\nSecond line\\n";n.dispatchEvent(new Event("input",{bubbles:true}))})()');
  assert.equal(await browser.evaluate('document.getElementById("ipd_soap_o").value'),'Clinician reviewed objective\nSecond line\n');
  await browser.evaluate('document.getElementById("ipd_history_present_illness").value="Later documented history";document.getElementById("ipd_history_present_illness").dispatchEvent(new Event("input",{bubbles:true}))');await new Promise(r=>setTimeout(r,400));assert.equal(await browser.evaluate('document.getElementById("ipd_soap_o").value'),'Clinician reviewed objective\nSecond line\n');
  await browser.evaluate('window.confirm=()=>false;document.querySelector("[data-refresh-ipd-soap]").click()');assert.equal(await browser.evaluate('document.getElementById("ipd_soap_manual").value'),'true');
  await browser.evaluate('window.confirm=()=>true;document.querySelector("[data-refresh-ipd-soap]").click()');assert.ok(await browser.evaluate('document.getElementById("ipd_soap_s").value.includes("Later documented history")'));
  await browser.evaluate('document.getElementById("ipd_soap_o").value="Saved reviewed objective\\nSecond line";document.getElementById("ipd_soap_o").dispatchEvent(new Event("input",{bubbles:true}))');
  assert.equal(await browser.evaluate('savePatientRecord({editOnly:true})'),true,await browser.evaluate('document.getElementById("emr-record-status").textContent'));
  const saved=JSON.parse(app.database.findPatient(key).record_json);assert.equal(saved['scope:medical:id:ipd_exam_eye_right'],long);assert.equal(saved['scope:medical:auto:113'],legacyHead);assert.equal(saved['scope:medical:id:ipd_soap_manual'],'true');assert.ok(saved['scope:medical:id:ipd_soap_summary'].includes('Saved reviewed objective'));
  await visit('view');assert.equal(await browser.evaluate('document.getElementById("ipd_soap_o").value'),'Saved reviewed objective\nSecond line');assert.equal(await browser.evaluate('document.getElementById("ipd_soap_o").disabled'),true);assert.equal(await browser.evaluate('document.getElementById("ipd_exam_eye_right").disabled'),true);
  assert.equal(await browser.evaluate('[...document.querySelectorAll("#ipd_head_to_toe .ipd-exam-normal")].every(n=>n.disabled)'),true);
  await browser.evaluate('getLoadedEmrPatient().data["scope:medical:id:ipd_soap_manual"]="false";BorkeoIpdRecord.generate()');assert.equal(await browser.evaluate('document.getElementById("ipd_soap_o").value'),'Saved reviewed objective\nSecond line','a saved historical note is not regenerated in view mode');await browser.evaluate('getLoadedEmrPatient().data["scope:medical:id:ipd_soap_manual"]="true"');
  await browser.evaluate('window.syntheticTemplate='+JSON.stringify(reviewTemplate(app.config)));
  const remote=await browser.evaluate(`(async()=>{const {recordDocument}=await import('/public/referral-record-viewer.mjs?v=5080');const markup=recordDocument(syntheticTemplate,{patient:getLoadedEmrPatient()},'medical');const frame=document.createElement('iframe');frame.id='synthetic-review';frame.setAttribute('sandbox','allow-same-origin');frame.srcdoc=markup;document.body.append(frame);await new Promise(r=>frame.onload=r);const d=frame.contentDocument;return {note:d.getElementById('ipd_soap_o').textContent,eye:d.getElementById('ipd_exam_eye_right').textContent,cards:d.querySelectorAll('.ipd-soap-card').length,writable:d.querySelectorAll('script,textarea,input:not(:disabled),[contenteditable]').length,status:getComputedStyle(d.querySelector('[data-clinical-recorded-status]')||d.createElement('span')).display}})()`);
  assert.equal(remote.note,'Saved reviewed objective\nSecond line');assert.equal(remote.eye,long);assert.equal(remote.cards,4);assert.equal(remote.writable,0);assert.equal(await browser.evaluate('window.soapXss'),undefined);await browser.evaluate('document.getElementById("synthetic-review").remove()');
  const before=app.database.findPatient(key).record_json;await browser.evaluate('printIpdRecord();true');await browser.waitFor('document.querySelector(".emr-report-print-frame")?.dataset.ready==="true"','actual IPD print snapshot',60000);
  const printed=await browser.evaluate('(()=>{const d=document.querySelector(".emr-report-print-frame").contentDocument;return {html:d.documentElement.outerHTML,cards:d.querySelectorAll(".ipd-soap-card").length,canonical:getComputedStyle(d.querySelector(".ipd-soap-canonical")).display,status:getComputedStyle(d.querySelector("[data-clinical-recorded-status]")).display}})()');assert.equal(printed.cards,4);assert.equal(printed.canonical,'none');assert.equal(printed.status,'none');assert.ok(printed.html.includes('Saved reviewed objective'));assert.equal(app.database.findPatient(key).record_json,before);assert.deepEqual(browser.state.errors,[]);
  await browser.evaluate('document.open();document.write('+JSON.stringify(printed.html)+');document.close()');await browser.evaluate('document.fonts.ready');await browser.send('Emulation.setEmulatedMedia',{media:'print'});const pdf=await browser.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});assert.ok(Buffer.from(pdf.data,'base64').length>10000);fs.writeFileSync('.validation-ipd507/ipd-record.pdf',Buffer.from(pdf.data,'base64'));
 }finally{await browser?.close();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));app.database.close()}
});
