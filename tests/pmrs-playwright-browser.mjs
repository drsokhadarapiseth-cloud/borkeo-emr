// Explicit browser acceptance test. All PMRS requests are fulfilled with synthetic data.
import test from 'node:test';
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import {PmrsPage,PMRS_ORIGIN,validateProfile} from '../server/pmrs/playwright.mjs';
const profile={exportVerified:true,exportVerifiedAt:'2026-10-31',exportVerificationReference:'Synthetic export fixture',origin:PMRS_ORIGIN,submission:{path:'/synthetic-save',method:'POST'},automationAuthorized:true,selectorsVerified:true,verifiedAt:'2026-10-30',verificationReference:'Synthetic fixture only; not a live profile',authenticated:{selector:'#signed-in'},patientId:{selector:'#patient'},encounterId:{selector:'#encounter'},save:{selector:'#save'},receipt:{selector:'#receipt'},
  read:{'registration.fullName':{selector:'#name'},'clinical.diagnosisText':{selector:'#diagnosis',kind:'input'}},
  write:{'clinical.diagnosisText':{selector:'#diagnosis',kind:'input'},'clinical.diagnosisIcd10':{selector:'#icd',kind:'select'},'clinical.prescription.medications.*.name':{selector:'.medicine:nth-of-type({{0}}) select',kind:'select'}}};
const html=`<!doctype html><html lang="en"><body><p id="signed-in">Synthetic signed in</p><p id="patient">SYNTHETIC-001</p><p id="encounter">VISIT-001</p><p id="name">Synthetic Patient</p><label>Diagnosis<input id="diagnosis" value="Old diagnosis"></label><select id="icd"><option value="A90">A90</option><option value="R50">R50</option></select><section><div class="medicine"><select><option value=""></option><option value="Synthetic medicine">Synthetic medicine</option></select></div></section><p id="receipt">No save yet</p><button id="save" onclick="document.getElementById('receipt').textContent='Saved VISIT-001 '+Date.now()">Save</button></body></html>`;
test('real Playwright captures and fills only reviewed controls; wrong pages, changed targets, ambiguous selectors and choices stop transfers',async()=>{
  assert.throws(()=>validateProfile({...profile,selectorsVerified:false}),/PROFILE_UNVERIFIED/);
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const context=await browser.newContext({serviceWorkers:'block'});
    await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:html}));
    const page=await context.newPage();await page.goto(PMRS_ORIGIN+'/synthetic');
    const adapter=new PmrsPage(page,profile);
    const snapshot=await adapter.capture();assert.equal(snapshot.identity.patientId,'SYNTHETIC-001');assert.equal(snapshot.registration.fullName,'Synthetic Patient');
    const plan=await adapter.plan({diagnosisText:'New diagnosis',diagnosisIcd10:'R50'});
    assert.equal(await page.locator('#diagnosis').inputValue(),'Old diagnosis');
    await page.locator('#diagnosis').fill('Intervening edit');await assert.rejects(adapter.fill(plan),/TARGET_CHANGED/);
    await page.locator('#diagnosis').fill('Old diagnosis');await adapter.fill(plan);
    assert.equal(await page.locator('#diagnosis').inputValue(),'New diagnosis');assert.equal(await page.locator('#receipt').innerText(),'No save yet');
    await assert.rejects(adapter.plan({diagnosisIcd10:'INVALID'}),/CHOICE_UNMATCHED/);
    await assert.rejects(adapter.plan({unmappedField:'value'}),/FIELD_UNMAPPED/);
    await page.locator('#patient').evaluate(el=>el.textContent='Different patient');
    await assert.rejects(adapter.submit(snapshot.identity,plan),/IDENTITY_CHANGED/);
    await page.locator('#patient').evaluate(el=>el.textContent='SYNTHETIC-001');
    await adapter.submit(snapshot.identity,plan);assert.match(await page.locator('#receipt').innerText(),/Saved VISIT-001/);
    const meds=await adapter.plan({prescription:{medications:[{name:'Synthetic medicine'}]}});await adapter.fill(meds);assert.equal(await page.locator('.medicine select').inputValue(),'Synthetic medicine');
    await page.locator('body').evaluate(el=>{const n=document.createElement('p');n.id='patient';n.textContent='Duplicate';el.append(n);});
    await assert.rejects(adapter.capture(),/PAGE_CHANGED/);
    await context.close();
  }finally{await browser.close();}
});

import {createEmrServer} from '../server/server.mjs';
import {hashPassword} from '../server/password.mjs';
import {setUserAccess} from '../server/access.mjs';
import crypto from 'node:crypto';
test('Khmer transfer page renders on desktop/mobile and keeps unverified live operations disabled',async()=>{
  const app=createEmrServer({demoMode:false,databasePath:':memory:',host:'127.0.0.1',nodeEnv:'test',pmrsOptions:{profile:null}});
  const id=crypto.randomUUID();app.database.createUser({id,username:'syntheticreg',displayName:'Synthetic Registration',role:'REGISTRATION',passwordHash:await hashPassword('Synthetic password 2026!'),mustChangePassword:false,createdAt:Date.now()});setUserAccess(app.database,id,['REGISTRATION'],[]);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+app.server.address().port;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext();const login=await context.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{username:'syntheticreg',password:'Synthetic password 2026!'}});assert.equal(login.status(),200);
    const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/pmrs');await page.waitForFunction(()=>document.getElementById('pmrs-status').textContent.includes('មិនទាន់អាចផ្ទេរបានទេ។ ត្រូវផ្ទៀងផ្ទាត់ការអនុញ្ញាត និងទម្រង់ PMRS ជាមុនសិន។'));
    await page.locator('#emr-topbar').waitFor({state:'visible'});
    assert.equal(await page.locator('#pmrs-open').isDisabled(),true);assert.equal(await page.locator('#pmrs-submit').isDisabled(),true);
    assert.equal(await page.locator('#pmrs-patient').isVisible(),false);
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      await page.screenshot({path:'/tmp/borkeo-pmrs-ui-'+width+'.png',fullPage:true});
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page fits viewport '+width);
      await page.screenshot({path:'/tmp/borkeo-pmrs-ui-'+width+'.png',fullPage:true});
    }
    assert.deepEqual(errors,[]);await context.close();
  }finally{await browser.close();await new Promise(resolve=>app.server.close(resolve));app.database.close();}
});

import {syntheticImportProfile} from './helpers/pmrs-profiles.mjs';
test('verified import-only profile reads a synthetic page without Save settings and cannot plan/fill/submit export',async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext();await context.route('**/*',route=>route.fulfill({contentType:'text/html',body:html}));
    const page=await context.newPage();await page.goto(PMRS_ORIGIN+'/synthetic');
    const adapter=new PmrsPage(page,syntheticImportProfile());
    const captured=await adapter.capture();assert.equal(captured.identity.patientId,'SYNTHETIC-001');
    assert.equal(captured.registration.fullName,'Synthetic Patient');
    await assert.rejects(adapter.plan({diagnosisText:'Changed'}),/EXPORT_UNVERIFIED/);
    await assert.rejects(adapter.fill([]),/EXPORT_UNVERIFIED/);
    await assert.rejects(adapter.submit(captured.identity,[]),/EXPORT_UNVERIFIED/);
    assert.equal(await page.locator('#receipt').innerText(),'No save yet');
    await context.close();
  }finally{await browser.close();}
});

test('import-only readiness enables capture in Khmer UI while export controls stay disabled',async()=>{
  const p=syntheticImportProfile(),identity={patientId:'SYNTHETIC-001',encounterId:'VISIT-001'};
  const app=createEmrServer({demoMode:false,databasePath:':memory:',host:'127.0.0.1',nodeEnv:'test',pmrsOptions:{profile:p,open:async()=>({adapter:{capture:async()=>({identity,registration:{fullName:'Synthetic Patient'},clinical:{}})},close:async()=>{}})}});
  const id=crypto.randomUUID();app.database.createUser({id,username:'syntheticdoc',displayName:'Synthetic Doctor',role:'DOCTOR',passwordHash:await hashPassword('Synthetic password 2026!'),mustChangePassword:false,createdAt:Date.now()});setUserAccess(app.database,id,['DOCTOR'],['opd']);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+app.server.address().port;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext();const login=await context.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{username:'syntheticdoc',password:'Synthetic password 2026!'}});assert.equal(login.status(),200);
    const page=await context.newPage();await page.goto(origin+'/pmrs');
    await page.waitForFunction(()=>!document.getElementById('pmrs-open').disabled);
    await page.locator('#pmrs-open').click();await page.waitForFunction(()=>!document.getElementById('pmrs-capture').disabled);
    await page.locator('#pmrs-capture').click();await page.waitForFunction(()=>!document.getElementById('pmrs-preview').hidden);
    await page.locator('#pmrs-reviewed').check();
    assert.equal(await page.locator('#pmrs-new').isEnabled(),true);
    for(const name of ['export-preview','fill','submit'])assert.equal(await page.locator('#pmrs-'+name).isDisabled(),true,name);
    assert.ok((await page.locator('#pmrs-capabilities').innerText()).length>0);
    await context.close();
  }finally{await browser.close();await new Promise(resolve=>app.server.close(resolve));app.database.close();}
});
