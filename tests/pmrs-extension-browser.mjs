// Explicit browser acceptance. Every site and patient below is synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright';
import {capturePatient} from '../tools/pmrs-chrome-import/capture.mjs';
import {inspectEmr,deliverPatient} from '../tools/pmrs-chrome-import/transport.mjs';
import {createEmrServer} from '../server/server.mjs';
import {hashPassword} from '../server/password.mjs';
import {setUserAccess} from '../server/access.mjs';

const registration={healthId:'SYN-100-1',caseNumber:'CASE-O001',fullName:'សាកល្បង អ្នកជំងឺ',sex:'ស្រី',age:'35',phone:'012 000 000'};
const fixture=`<!doctype html><meta charset="utf-8"><div class="border rounded-xl"><div><span>លេខករណី</span><div><span class="font-mono font-bold">CASE-O001</span><button>Copy</button></div></div><div class="divide-y"><div><span>លេខបណ្ណសុខភាព</span><div><span class="font-bold">SYN-100-1</span><button>Copy</button></div></div><div><div><span class="font-bold">បណ្ណសមធម៌គ្រួសារក្រីក្រ</span></div><div><span class="font-bold">1234567890</span></div></div></div></div><div><h2>ព័ត៌មានអ្នកជំងឺ</h2><div><span><strong>ឈ្មោះ៖</strong> សាកល្បង អ្នកជំងឺ</span><span><strong>ភេទ៖</strong> ស្រី</span><span><strong>អាយុ៖</strong> 35 ឆ្នាំ</span></div><div><strong>លេខទូរសព្ទ៖</strong><span>012 000 000</span></div><div><strong>អាសយដ្ឋាន៖</strong><span>Province, District, Commune, Village</span></div><h2>ទម្រង់វាយតម្លៃជំងឺដំបូង</h2><span><strong>BMI៖</strong>25.48</span></div>`;
test('PMRS capture reads exact visible identity and value text without labels, inputs, vitals or DOB inference',async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage();await page.route('**/*',route=>route.fulfill({contentType:'text/html',body:fixture}));await page.goto('https://pmrs.digitalsp.gov.kh/synthetic');
    const result=await page.evaluate(capturePatient);assert.deepEqual(result,{...registration,province:'Province',district:'District',commune:'Commune',village:'Village',equityCard:'1234567890'});
    assert.equal(result.dob,undefined);assert.equal(result.bmi,undefined);assert.equal(result.caseNumber,'CASE-O001');
    await page.locator('body').evaluate(el=>el.insertAdjacentHTML('beforeend',el.innerHTML));await assert.rejects(page.evaluate(capturePatient),/PAGE_CHANGED/);
    await page.goto('https://wrong.example.org/');await assert.rejects(page.evaluate(capturePatient),/PMRS_PAGE_REQUIRED/);
  }finally{await browser.close();}
});
const moduleSource=fs.readFileSync(new URL('../public/pmrs-registration.mjs',import.meta.url),'utf8');
const receiverHtml=`<!doctype html><html lang="km"><head><meta charset="utf-8"><script type="module" src="/public/pmrs-registration.mjs"></script></head><body><div id="web-admission"><input id="web_last_name"><input id="web_first_name"><input id="web_age"><input id="web_dob"><input id="web_phone"><input id="web_other_card_number"><input id="web_other_card_type"><input id="web_other_card_issuer"><input id="web_pmrs2_case_number"><input type="radio" id="web_sex_female" value="ស្រី"></div><script>window.emrSession={user:{activeRole:'REGISTRATION'}};</script></body></html>`;
async function receiverPage(browser,{duplicate=false,login=false}={}){
  const page=await browser.newPage(),nonce=crypto.randomUUID();let writes=0;
  const state={duplicate,login,role:'REGISTRATION'};
  await page.route('**/*',async route=>{
    const url=new URL(route.request().url());if(!['GET','HEAD'].includes(route.request().method()))writes++;
    if(url.pathname==='/public/pmrs-registration.mjs')return route.fulfill({contentType:'text/javascript',body:moduleSource});
    if(url.pathname==='/api/auth/me')return route.fulfill({status:state.login?401:200,json:state.login?{}:{user:{activeRole:state.role},demoMode:false}});
    if(url.pathname==='/api/emr-network/local-search')return route.fulfill({json:{patients:state.duplicate?[{patientKey:'EXISTING-SYNTHETIC'}]:[]}});
    if(url.pathname.includes('provinces.json'))return route.fulfill({json:[]});
    return route.fulfill({contentType:'text/html',body:receiverHtml});
  });
  const origin='https://emr.example.org';await page.goto(origin+'/emr?view=register&pmrsExtension='+nonce);await page.waitForFunction(()=>typeof window.receivePmrsExtensionRegistration==='function');
  return {page,nonce,origin,state,get writes(){return writes;},deliver:()=>page.evaluate(({origin,nonce,registration,source})=>(0,eval)('('+source+')')(origin,nonce,registration),{origin,nonce,registration,source:deliverPatient.toString()})};
}
test('EMR first-party receiver fills one new draft, preserves identity, and never claims or performs a save',async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const h=await receiverPage(browser);assert.equal((await h.deliver()).code,'DRAFT_FILLED');
    assert.equal(await h.page.locator('#web_other_card_number').inputValue(),registration.healthId);assert.equal(await h.page.locator('#web_pmrs2_case_number').inputValue(),registration.caseNumber);
    assert.equal(await h.page.locator('#web_last_name').inputValue(),'សាកល្បង');assert.equal(await h.page.locator('#web_first_name').inputValue(),'អ្នកជំងឺ');assert.equal(await h.page.locator('#web_dob').inputValue(),'');
    assert.equal((await h.deliver()).code,'DRAFT_FILLED');assert.equal(await h.page.locator('[role=status]').count(),1);assert.equal(h.writes,0);
  }finally{await browser.close();}
});

test('installed MV3 extension keeps capture across login navigation and resumes once in an EMR tab', {skip:process.env.BORKEO_TEST_INSTALLED_EXTENSION!=='1' ? 'Opt-in full Chrome test: set BORKEO_TEST_INSTALLED_EXTENSION=1 on a machine that permits Chrome profile sockets.' : false},async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'borkeo-extension-synthetic-'));
  const extension=path.join(directory,'extension');fs.cpSync(new URL('../tools/pmrs-chrome-import/',import.meta.url),extension,{recursive:true});
  // Grant ONLY synthetic test sites at startup. The shipped manifest keeps
  // EMR access optional and PMRS capture under the user's activeTab gesture.
  const manifestPath=path.join(extension,'manifest.json'),manifest=JSON.parse(fs.readFileSync(manifestPath));
  manifest.host_permissions=['https://emr.example.org/*','https://pmrs.digitalsp.gov.kh/*'];fs.writeFileSync(manifestPath,JSON.stringify(manifest));
  const context=await chromium.launchPersistentContext(path.join(directory,'profile'),{channel:'chromium',headless:true,args:['--no-sandbox','--disable-extensions-except='+extension,'--load-extension='+extension]});
  let loggedIn=false,writes=0;
  try{
    await context.route('https://**/*',route=>{
      const url=new URL(route.request().url());
      if(!['GET','HEAD'].includes(route.request().method()))writes++;
      if(url.origin==='https://pmrs.digitalsp.gov.kh')return route.fulfill({contentType:'text/html',body:fixture});
      if(url.origin!=='https://emr.example.org')return route.abort();
      if(url.pathname==='/api/auth/me')return route.fulfill({status:loggedIn?200:401,json:loggedIn?{user:{activeRole:'REGISTRATION'},demoMode:false}:{}});
      if(url.pathname==='/api/emr-network/local-search')return route.fulfill({json:{patients:[]}});
      if(url.pathname.includes('provinces.json'))return route.fulfill({json:[]});
      if(url.pathname==='/public/pmrs-registration.mjs')return route.fulfill({contentType:'text/javascript',body:moduleSource});
      if(!loggedIn)return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Synthetic login</h1>'});
      return route.fulfill({contentType:'text/html',body:receiverHtml});
    });
    let worker=context.serviceWorkers()[0];if(!worker)worker=await context.waitForEvent('serviceworker');
    const extensionId=new URL(worker.url()).hostname;
    await worker.evaluate(()=>chrome.storage.local.set({origin:'https://emr.example.org'}));
    const pmrs=await context.newPage();await pmrs.goto('https://pmrs.digitalsp.gov.kh/synthetic');
    const popup=await context.newPage();await popup.goto('chrome-extension://'+extensionId+'/popup.html');
    await popup.evaluate(async()=>{const tabs=await chrome.tabs.query({url:'https://pmrs.digitalsp.gov.kh/*'});await chrome.tabs.update(tabs[0].id,{active:true});});
    await popup.evaluate(()=>chrome.runtime.sendMessage({type:'CAPTURE'}));
    await popup.waitForFunction(async()=>((await chrome.storage.session.get('status')).status)==='LOGIN_REQUIRED');
    const before=await popup.evaluate(async()=>{const {pending}=await chrome.storage.session.get('pending');return {tabId:pending.tabId,nonce:pending.nonce};});
    const emr=context.pages().find(page=>page.url().startsWith('https://emr.example.org'));
    assert.ok(emr);assert.equal(await emr.locator('h1').textContent(),'Synthetic login');
    loggedIn=true;await emr.goto('https://emr.example.org/dashboard');
    await popup.waitForFunction(async()=>((await chrome.storage.session.get('status')).status)==='DRAFT_FILLED');
    assert.equal(await emr.locator('#web_other_card_number').inputValue(),registration.healthId);
    assert.equal(await emr.locator('#web_pmrs2_case_number').inputValue(),registration.caseNumber);
    assert.equal(new URL(emr.url()).searchParams.get('pmrsExtension'),before.nonce);
    const storage=await popup.evaluate(async()=>({local:await chrome.storage.local.get(null),session:await chrome.storage.session.get(null)}));
    assert.deepEqual(storage.local,{origin:'https://emr.example.org'});assert.equal(storage.session.pending,undefined);assert.equal(writes,0);
  }finally{await context.close();fs.rmSync(directory,{recursive:true,force:true});}
});
test('receiver blocks duplicates, staff edits, unauthorized roles and stale sessions without overwriting fields',async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const duplicate=await receiverPage(browser,{duplicate:true});assert.equal((await duplicate.deliver()).code,'DUPLICATE_PATIENT');assert.equal(await duplicate.page.locator('#web_last_name').inputValue(),'');
    const edited=await receiverPage(browser);await edited.page.locator('#web_first_name').fill('Existing draft');assert.equal((await edited.deliver()).code,'FORM_OCCUPIED');assert.equal(await edited.page.locator('#web_first_name').inputValue(),'Existing draft');
    const denied=await receiverPage(browser);denied.state.role='NURSE';assert.equal((await denied.deliver()).code,'REGISTRATION_ROLE_REQUIRED');assert.equal(await denied.page.locator('#web_last_name').inputValue(),'');
    const loggedOut=await receiverPage(browser,{login:true});assert.equal((await loggedOut.deliver()).code,'LOGIN_REQUIRED');assert.equal((await loggedOut.page.evaluate(inspectEmr,loggedOut.origin)).code,'LOGIN_REQUIRED');assert.equal(loggedOut.writes,0);
  }finally{await browser.close();}
});

test('matching EMR server serves the receiver and fills the actual registration form under a real synthetic session',async()=>{
  const app=createEmrServer({demoMode:false,databasePath:':memory:',host:'127.0.0.1',nodeEnv:'test',pmrsOptions:{profile:null}});
  const id=crypto.randomUUID();
  app.database.createUser({id,username:'syntheticextension',displayName:'Synthetic Registration',role:'REGISTRATION',passwordHash:await hashPassword('Synthetic password 2026!'),mustChangePassword:false,createdAt:Date.now()});setUserAccess(app.database,id,['REGISTRATION'],[]);
  await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+app.server.address().port;
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const context=await browser.newContext();const login=await context.request.post(origin+'/api/auth/login',{headers:{Origin:origin},data:{username:'syntheticextension',password:'Synthetic password 2026!'}});assert.equal(login.status(),200);
    const page=await context.newPage(),nonce=crypto.randomUUID(),errors=[];page.on('pageerror',error=>errors.push(error.message));
    const count=app.database.listPatients().length;
    await page.goto(origin+'/emr?view=register&pmrsExtension='+nonce);
    await page.waitForFunction(()=>window.emrSession?.user && typeof window.receivePmrsExtensionRegistration==='function');
    const result=await page.evaluate(({nonce,registration})=>window.receivePmrsExtensionRegistration(nonce,registration),{nonce,registration});
    assert.equal(result.code,'DRAFT_FILLED');assert.equal(await page.locator('#web_other_card_number').inputValue(),registration.healthId);assert.equal(await page.locator('#web_pmrs2_case_number').inputValue(),registration.caseNumber);
    assert.equal(await page.locator('#web_first_name').inputValue(),'អ្នកជំងឺ');assert.equal(app.database.listPatients().length,count);
    assert.deepEqual(errors,[]);await context.close();
  }finally{await browser.close();await new Promise(resolve=>app.server.close(resolve));app.database.close();}
});
