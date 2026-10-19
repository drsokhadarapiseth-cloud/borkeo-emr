import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import {createEmrServer} from '../server/server.mjs';
import {projectRoot} from '../server/config.mjs';

test('Director service list loads its aligned styling from the actual served billing page',async()=>{
 const app=createEmrServer({demoMode:true,databasePath:':memory:',host:'127.0.0.1',port:0,appOrigin:'http://127.0.0.1:0',nodeEnv:'test'});
 try {
  await new Promise((resolve,reject)=>{app.server.once('error',reject);app.server.listen(0,'127.0.0.1',resolve)});
  const origin=`http://127.0.0.1:${app.server.address().port}`;
  const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:app.config.appOrigin,'Content-Type':'application/json'},body:JSON.stringify({username:'director'})});
  assert.equal(login.status,200);
  const Cookie=login.headers.get('set-cookie').split(';')[0];
  const page=await fetch(origin+'/billing',{headers:{Cookie}});
  assert.equal(page.status,200);
  const html=await page.text();
  const href=html.match(/href="([^" ]*\/public\/service-list\.css[^" ]*)"/)?.[1];
  assert.ok(href,'Billing page must link to the service-list stylesheet');
  assert.match(href,/v=1900/);assert.match(href,/build=2[0-9]\./);
  const style=await fetch(new URL(href,origin));
  assert.equal(style.status,200,'New stylesheet must be in the server public-file allowlist');
  assert.match(style.headers.get('content-type'),/^text\/css/);
  assert.equal(await style.text(),fs.readFileSync(path.join(projectRoot,'public/service-list.css'),'utf8'));
 } finally {await new Promise(r=>app.server.close(r));app.database.close()}
});
