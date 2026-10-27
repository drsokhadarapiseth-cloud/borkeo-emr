// Explicit browser/PDF regression; synthetic patient in an in-memory EMR only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createEmrServer} from '../server/server.mjs';
import {buildCompleteRegistrationPatients} from '../scripts/create-complete-registration-fixture.mjs';
import {openBrowser} from './helpers/context-browser.mjs';
test('OPD imaging names open existing order forms and admission printing renders without saving clinical data',{timeout:180000},async()=>{
  const app=createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false});let browser;
  try{
    await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
    const origin='http://127.0.0.1:'+app.server.address().port;app.config.appOrigin=origin;
    const users={};for(const username of ['registration','triage','clerk','doctor_opd']){
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      const Cookie=response.headers.get('set-cookie').split(';')[0];const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      users[username]={Cookie,Origin:origin,'Content-Type':'application/json','X-CSRF-Token':me.csrfToken};
    }
    const call=async(user,method,route,body)=>{const response=await fetch(origin+route,{method,headers:users[user],body:body===undefined?undefined:JSON.stringify(body)});const result=await response.json();assert.ok(response.ok,JSON.stringify(result));return result};
    const patient=buildCompleteRegistrationPatients()[0],key=patient.patientKey;
    await call('registration','PUT','/api/patient-record',patient);
    const current=(await call('registration','GET','/api/patient-record?patientKey='+encodeURIComponent(key))).patient;
    await call('triage','PUT','/api/patient-record',{patientKey:key,summary:{...patient.summary,departmentCode:'opd',serviceMode:'opd'},expectedVersion:current.version,triageSave:true,data:{'scope:triage:id:p2_temp':'37','scope:triage:id:p2_weight':'60','scope:triage:id:p2_height':'165','scope:triage:id:p2_bp_sys':'120','scope:triage:id:p2_bp_dia':'80','scope:triage:id:p2_pulse':'80','scope:triage:id:p2_resp':'18','scope:triage:id:p2_spo2':'98'}});
    const finance=await call('clerk','GET','/api/finance/patient?patientKey='+encodeURIComponent(key));
    await call('clerk','POST','/api/finance/payments',{patientKey:key,invoiceId:finance.bill.invoice.id,source:'CASH',currency:'KHR',amount:finance.bill.summary.KHR.balance});
    const before=app.database.findPatient(key).record_json;
    browser=await openBrowser();await browser.send('Network.setBlockedURLs',{urls:['https://*']});
    await browser.send('Page.addScriptToEvaluateOnNewDocument',{source:"window.print=()=>{window.syntheticPrintCount=(window.syntheticPrintCount||0)+1};document.addEventListener('emr:patient-loaded',()=>{window.syntheticLoaded=true})"});
    const [name,value]=users.doctor_opd.Cookie.split('=');await browser.send('Network.setCookie',{name,value,url:origin});
    await browser.send('Page.navigate',{url:origin+'/emr?'+new URLSearchParams({patient:key,view:'opd'})});
    await browser.waitFor('window.syntheticLoaded && window.EmrEncounterEditor?.canWrite()','doctor OPD',60000);
    // Exercise the real OPD picker, including every catalog modality.
    const openPicker=async()=>{
      await browser.evaluate("document.querySelector('#sub_opd [data-request-imaging]').click()");
      await browser.waitFor("document.querySelector('.imaging-order-groups')",'grouped imaging chooser');
    };
    await openPicker();
    const chooser=await browser.evaluate("({codes:[...document.querySelectorAll('.imaging-test-name')].map(n=>n.dataset.order),groups:document.querySelectorAll('.imaging-order-group').length,text:document.querySelector('.imaging-order-groups').textContent})");
    const modalities=(await call('doctor_opd','GET','/api/imaging-catalog')).modalities.filter(m=>m.active!==false);
    assert.deepEqual([...chooser.codes].sort(),modalities.map(m=>m.code).sort(),'every active service appears exactly once');
    assert.equal(chooser.groups,new Set(modalities.map(m=>m.groupId)).size);
    assert.doesNotMatch(chooser.text,/[A-Za-z+]/,'Khmer picker has no repeated English codes or add buttons');
    const imagingEvidence=path.resolve('validation-imaging');fs.mkdirSync(imagingEvidence,{recursive:true});
    for(const width of [1440,390]){
      await browser.send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false});
      assert.ok(await browser.evaluate("(()=>{const n=document.querySelector('.paraclinic-modal-card');return n.scrollWidth<=n.clientWidth+1})()"),'chooser fits viewport');
      const shot=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(imagingEvidence,`chooser-${width}.png`),Buffer.from(shot.data,'base64'));
    }
    await browser.send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
    for(const [index,code] of chooser.codes.entries()){
      if(index)await openPicker();
      await browser.evaluate('document.querySelector('+JSON.stringify('.imaging-test-name[data-order="'+code+'"]')+').click()');
      await browser.waitFor("document.querySelector('.paraclinic-form select[name=examination]')",code+' order form');
      const first=await browser.evaluate("document.querySelector('.paraclinic-form select[name=examination]').value");
      assert.ok(first,'existing examination options remain available for '+code);
      await browser.key('Escape');
    }
    await openPicker();await browser.evaluate("document.querySelector('.paraclinic-modal [data-order=LAB]').click()");
    await browser.waitFor("document.querySelector('.borkeo-lab-paper-form')",'retained laboratory form');
    await browser.key('Escape');
    await browser.evaluate("document.querySelector('#sub_opd button[onclick*=printAdmissionOnly]').click()");
    await browser.waitFor("document.querySelector('.emr-report-print-frame')?.dataset.ready==='true'",'admission print frame',60000);
    const layout=await browser.evaluate("(()=>{const doc=document.querySelector('.emr-report-print-frame').contentDocument;const form=doc.getElementById('print-admission');return {text:form?.textContent?.length,width:form?.getBoundingClientRect().width,height:form?.getBoundingClientRect().height,ancestors:(()=>{const items=[];let n=form;while(n){const s=doc.defaultView.getComputedStyle(n);items.push({id:n.id,class:n.className,display:s.display,visibility:s.visibility,contentVisibility:s.contentVisibility,height:n.getBoundingClientRect().height});n=n.parentElement}return items})()}})()");
    console.log('Admission print layout',JSON.stringify(layout));
    const evidence=path.resolve('validation-admission-print');fs.mkdirSync(evidence,{recursive:true});
    const markup=await browser.evaluate("document.querySelector('.emr-report-print-frame').contentDocument.documentElement.outerHTML");
    fs.writeFileSync(path.join(evidence,'admission.snapshot.txt'),markup);
    assert.equal(app.database.findPatient(key).record_json,before,'printing does not save or sign the patient record');
    await browser.evaluate('document.open();document.write('+JSON.stringify(markup)+');document.close();');
    await browser.evaluate('document.fonts.ready');await browser.send('Emulation.setEmulatedMedia',{media:'print'});
    const shot=await browser.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(path.join(evidence,'admission.png'),Buffer.from(shot.data,'base64'));
    const pdf=await browser.send('Page.printToPDF',{printBackground:true,preferCSSPageSize:true});fs.writeFileSync(path.join(evidence,'admission.pdf'),Buffer.from(pdf.data,'base64'));
    assert.ok(layout.width>300&&layout.height>400,'admission form must have a visible paper layout');
    assert.ok(layout.ancestors.every(node=>node.contentVisibility!=='hidden'),'inactive source pages must not suppress print painting');
    assert.ok(layout.text>1000,'admission text must be present');
    assert.ok(await browser.evaluate('document.body.textContent.includes('+JSON.stringify(patient.summary.fullName)+')'),'printed admission includes patient name');
    assert.ok(Buffer.from(pdf.data,'base64').length>10000,'PDF contains rendered form content');
  }finally{browser?.close();app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.database.close()}
});
