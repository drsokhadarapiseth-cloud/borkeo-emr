import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createEmrServer} from '../server/server.mjs';
import {openBrowser} from './helpers/context-browser.mjs';

test('127.0.0.1 and localhost retain independent simultaneous EMR sessions',{timeout:120000},async()=>{
  const apps=[0,1].map(()=>createEmrServer({demoMode:true,databasePath:':memory:',nodeEnv:'test',host:'0.0.0.0',port:0,npca:{enabled:false},npcaPractice:false}));let browser;
  try{
    for(const app of apps)await new Promise(resolve=>app.server.listen(0,'0.0.0.0',resolve));
    const origins=[`http://127.0.0.1:${apps[0].server.address().port}`,`http://localhost:${apps[1].server.address().port}`];
    const names=['doctor_surgery','doctor_opd'];browser=await openBrowser();
    await browser.send('Network.setBlockedURLs',{urls:['https://*']});
    const evidence=path.resolve('.validation-wifi-evidence');fs.mkdirSync(evidence,{recursive:true});
    for(let i=0;i<2;i++){
      apps[i].config.appOrigin=origins[i];
      const response=await fetch(origins[i]+'/api/auth/login',{method:'POST',headers:{Origin:origins[i],'Content-Type':'application/json'},body:JSON.stringify({username:names[i]})});assert.equal(response.status,200);
      const [name,value]=response.headers.get('set-cookie').split(';')[0].split('=');
      await browser.send('Network.setCookie',{name,value,url:origins[i]});
    }
    for(const i of [0,1,0]){
      await browser.send('Page.navigate',{url:origins[i]+'/login'});
      await browser.waitFor('document.readyState==="complete"','EMR page');
      const me=await browser.evaluate('fetch("/api/auth/me").then(r=>r.json())');
      assert.equal(me.user.username,names[i],'opening the other EMR must not replace this login');
      const screenshot=await browser.send('Page.captureScreenshot',{format:'png'});
      fs.writeFileSync(path.join(evidence,`instance-${i}.png`),Buffer.from(screenshot.data,'base64'));
    }
    const cookies=(await browser.send('Network.getAllCookies')).cookies.filter(c=>c.name==='emr_session');
    assert.ok(cookies.some(c=>c.domain==='localhost'));assert.ok(cookies.some(c=>c.domain==='127.0.0.1'));
    assert.notEqual(cookies.find(c=>c.domain==='localhost').value,cookies.find(c=>c.domain==='127.0.0.1').value);
  }finally{browser?.close();for(const app of apps){app.server.closeAllConnections();await new Promise(resolve=>app.server.close(resolve));app.database.close()}}
});
