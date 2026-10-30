import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createEmrServer} from '../server/server.mjs';
import {openBrowser} from './helpers/context-browser.mjs';
import {parsePmrs2Text} from '../public/pmrs2-paste.mjs';
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function connectPage(url){
 const ws=new WebSocket(url);await new Promise(r=>ws.addEventListener('open',r,{once:true}));let seq=0;const pending=new Map();
 ws.addEventListener('message',event=>{const msg=JSON.parse(event.data);if(pending.has(msg.id)){pending.get(msg.id)(msg);pending.delete(msg.id);}});
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,msg=>msg.error?reject(Error(msg.error.message)):resolve(msg.result));ws.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const out=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(out.exceptionDetails)throw Error(out.exceptionDetails.exception?.description||out.exceptionDetails.text);return out.result?.value;};
 const wait=async expr=>{for(let i=0;i<200;i++){try{if(await evaluate(expr))return;}catch{}await sleep(150);}throw Error('Waiting for '+expr);};
 await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
 return {send,evaluate,wait,close:()=>ws.close()};
}
async function findPage(browser,predicate){for(let i=0;i<200;i++){const list=await(await fetch(`http://127.0.0.1:${browser.debugPort}/json/list`)).json();const page=list.find(predicate);if(page)return connectPage(page.webSocketDebuggerUrl);await sleep(150);}throw Error('Expected browser page not found');}

test('real unpacked extension reads PMRS2 summary, survives EMR login and fills registration without script injection or saving',{timeout:240000},async()=>{
 const app=createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'127.0.0.1',port:0,npca:{enabled:false},npcaPractice:false});let browser,options,receiver;
 try{
  await new Promise(r=>app.server.listen(0,'127.0.0.1',r));app.config.appOrigin='http://127.0.0.1:'+app.server.address().port;const origin=app.config.appOrigin;
  browser=await openBrowser({extensionPath:path.resolve('pmrs2-helper')});
  // Intercept HTTPS before any network request: PMRS2 is a synthetic page only.
  const ctx=vm.createContext({});vm.runInContext(fs.readFileSync('pmrs2-helper/pmrs2-fields.js','utf8'),ctx);
  const fields=ctx.PMRS2_FIELDS;
  const values={fullName:'Synthetic Bridge',sex:parsePmrs2Text('Sex: Male').payload.sex,age:'49 years',phone:'012555777',healthId:'EXT-SYNTH-ID',caseNumber:'EXT-SYNTH-CASE',street:'Synthetic address'};
  const html='<!doctype html><html><head><meta charset="utf-8"></head><body><div data-v-6e79fd19 class="w-full flex gap-4">'+Object.entries(values).map(([key,value])=>'<span data-v-6e79fd19><strong data-v-6e79fd19>'+fields.find(f=>f.key===key).labels.at(-1)+'&#x17d6;</strong> '+value+'</span>').join('')+'</div></body></html>';
  browser.on('Fetch.requestPaused',({requestId,request})=>{
   const action=request.url.startsWith('https://pmrs.digitalsp.gov.kh/')?browser.send('Fetch.fulfillRequest',{requestId,responseCode:200,responseHeaders:[{name:'Content-Type',value:'text/html; charset=utf-8'},{name:'Content-Security-Policy',value:"default-src 'none'; script-src 'none'; style-src 'unsafe-inline'"}],body:Buffer.from(html).toString('base64')}):browser.send('Fetch.failRequest',{requestId,errorReason:'BlockedByClient'});
   action.catch(error=>browser.state.errors.push(error.message));
  });
  await browser.send('Fetch.enable',{patterns:[{urlPattern:'https://*'}]});
  let worker;
  for(let i=0;i<100&&!worker;i++){worker=(await browser.send('Target.getTargets')).targetInfos.find(t=>t.url.endsWith('/background.mjs'));if(!worker)await sleep(100);}
  assert.ok(worker,'Actual extension service worker loaded');
  // URL.origin is null for chrome-extension, build its scheme/host explicitly.
  const extensionUrl='chrome-extension://'+new URL(worker.url).hostname;
  await browser.send('Target.createTarget',{url:extensionUrl+'/options.html'});
  options=await findPage(browser,item=>item.url===extensionUrl+'/options.html');
  await options.wait('document.getElementById("version").textContent==="51.4.0"');
  await options.evaluate(`document.getElementById('borkeoBaseUrl').value=${JSON.stringify(origin)};document.getElementById('save').click();true`);
  await options.wait('!document.getElementById("saved").hidden');
  await browser.send('Page.navigate',{url:'https://pmrs.digitalsp.gov.kh/visits/register?synthetic=1'});
  await browser.waitFor('!!document.getElementById("borkeo-pmrs2-send")','actual content script button');
  await browser.evaluate('document.getElementById("borkeo-pmrs2-send").click();true');
  receiver=await findPage(browser,item=>item.type==='page'&&item.url.startsWith(origin));
  await receiver.wait('location.pathname==="/login" && !!document.getElementById("borkeo-pmrs2-receive-status")');
  const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username:'registration'})});
  const recordsBefore=app.database.sqlite.prepare('SELECT COUNT(*) AS n FROM patient_records').get().n;
  const cookie=response.headers.get('set-cookie').split(';')[0];const equals=cookie.indexOf('=');
  await receiver.send('Network.setCookie',{name:cookie.slice(0,equals),value:cookie.slice(equals+1),url:origin});
  await receiver.send('Page.navigate',{url:origin+'/patient-list'});
  await receiver.wait('document.getElementById("borkeo-pmrs2-receive-status")?.dataset.stage==="filled"');
  const result=await receiver.evaluate(`({name:document.getElementById('web_last_name').value,first:document.getElementById('web_first_name').value,age:document.getElementById('web_age').value,other:document.getElementById('web_other_card_number').value,health:document.getElementById('web_health_id').value,caseNumber:document.getElementById('web_pmrs2_case_number').value,view:new URL(location.href).searchParams.get('view'),visible:document.getElementById('sub_reg').getBoundingClientRect().height>0,externalScripts:[...document.scripts].filter(s=>s.src.startsWith('chrome-extension:')).length})`);
  assert.equal(result.name,'Synthetic');assert.equal(result.first,'Bridge');assert.match(result.age,/49/);assert.equal(result.other,'EXT-SYNTH-ID');assert.equal(result.caseNumber,'EXT-SYNTH-CASE');assert.notEqual(result.health,'EXT-SYNTH-ID');assert.equal(result.view,'register');assert.equal(result.visible,true);assert.equal(result.externalScripts,0);
  assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) AS n FROM patient_records').get().n,recordsBefore);
  await browser.waitFor('document.getElementById("borkeo-pmrs2-status").dataset.stage==="filled"','source receives success');
  const destinations=(await browser.send('Target.getTargets')).targetInfos.filter(item=>item.type==='page'&&item.url.startsWith(origin));assert.equal(destinations.length,1,'one receiving tab, no repeated open/reload');
  if(process.env.EMR_TEST_ARTIFACT_DIR){fs.mkdirSync(process.env.EMR_TEST_ARTIFACT_DIR,{recursive:true});const shot=await receiver.send('Page.captureScreenshot',{format:'png'});fs.writeFileSync(process.env.EMR_TEST_ARTIFACT_DIR+'/extension-registration.png',Buffer.from(shot.data,'base64'));}
  assert.deepEqual(browser.state.errors,[]);
 }finally{options?.close();receiver?.close();await browser?.close();app.server.closeAllConnections();await new Promise(r=>app.server.close(r));app.database.close();}
});
