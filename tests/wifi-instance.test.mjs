import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import {configureWifiInstance,checkWifiPort,isRunningEmr,needsWifiServer,openWifiBrowser} from '../scripts/wifi-instance.mjs';

test('separate simulation overrides inherited hospital storage and port',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wifi-isolation-'));
  fs.writeFileSync(path.join(root,'wifi-instance.local.json'),JSON.stringify({kind:'simulation',port:3002,origin:'http://localhost:3002',dataDirectory:'instance-data'}));
  const env={PORT:'3001',DATA_DIR:'hospital',DATABASE_PATH:'hospital.sqlite',APP_ORIGIN:'http://127.0.0.1:3001',NPCA_ENABLED:'true'};
  const result=configureWifiInstance(root,env);
  assert.equal(result.origin,'http://localhost:3002');assert.equal(result.port,3002);
  assert.equal(env.DATABASE_PATH,path.join(fs.realpathSync(root),'instance-data','emr.sqlite'));
  assert.equal(env.DATA_DIR,path.join(fs.realpathSync(root),'instance-data'));
  assert.equal(env.NPCA_ENABLED,'false');assert.equal(fs.existsSync(env.DATABASE_PATH),false);
  const target=fs.mkdtempSync(path.join(os.tmpdir(),'wifi-other-'));
  fs.symlinkSync(target,path.join(root,'instance-data'),process.platform==='win32'?'junction':'dir');
  assert.throws(()=>configureWifiInstance(root,{}),/must not be a link/);
});

test('normal launcher preserves original storage and rejects invalid instance settings',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'wifi-default-'));
  const env={DATABASE_PATH:'original.sqlite',DATA_DIR:'original-data',PORT:'3002',APP_ORIGIN:'http://localhost:3002'};
  assert.equal(configureWifiInstance(root,env).origin,'http://127.0.0.1:3001');
  assert.equal(env.DATABASE_PATH,'original.sqlite');assert.equal(env.DATA_DIR,'original-data');
  assert.equal(env.PORT,'3001','original must not inherit the second port');
  fs.writeFileSync(path.join(root,'wifi-instance.local.json'),JSON.stringify({kind:'simulation',port:3001,origin:'http://localhost:3001',dataDirectory:'../hospital'}));
  assert.throws(()=>configureWifiInstance(root,{}),/Invalid simulation/);
});

test('reuse opens only a healthy identified EMR and does not start or terminate a server',async()=>{
  let valid=true;const server=http.createServer((req,res)=>{if(req.url==='/api/health'){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({ok:true}))}else res.end(valid?'<span data-app-version>v49.2</span>':'unrelated program')});
  await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
  try{
    const instance={port:server.address().port,origin:'http://127.0.0.1:'+server.address().port};let opened=[];
    assert.equal(await isRunningEmr(instance.origin),true);
    assert.equal(await needsWifiServer(instance,{open:async url=>opened.push(url)}),false);
    assert.deepEqual(opened,[instance.origin]);assert.equal(server.listening,true);
    valid=false;opened=[];
    await assert.rejects(needsWifiServer(instance,{open:async url=>opened.push(url)}),error=>error.code==='EADDRINUSE');
    assert.deepEqual(opened,[]);assert.equal(server.listening,true);
  }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}
});

test('free ports request a fresh server; unrelated probe failures are not treated as reuse',async()=>{
  const instance={port:3001,origin:'http://127.0.0.1:3001'};let opened=false;
  assert.equal(await needsWifiServer(instance,{probe:async()=>{},open:async()=>{opened=true}}),true);
  assert.equal(opened,false);
  await assert.rejects(needsWifiServer(instance,{probe:async()=>{throw Object.assign(Error('denied'),{code:'EACCES'})},ready:async()=>{throw Error('must not inspect another program')}}),error=>error.code==='EACCES');
});

test('browser launch uses each exact local link and refuses unapproved destinations',async()=>{
  const opened=[];
  const launch=(command,args)=>{opened.push(args);const child=new EventEmitter();child.unref=()=>{};queueMicrotask(()=>child.emit('spawn'));return child};
  await openWifiBrowser('http://127.0.0.1:3001',launch);await openWifiBrowser('http://localhost:3002',launch);
  assert.deepEqual(opened,[['http://127.0.0.1:3001'],['http://localhost:3002']]);
  await assert.rejects(openWifiBrowser('http://example.com',launch),/Unexpected/);
});

test('occupied-port preflight preserves the existing listener',async()=>{
  const server=net.createServer(socket=>socket.end('still-running'));
  await new Promise(resolve=>server.listen(0,'0.0.0.0',resolve));
  try{
    const port=server.address().port;
    await assert.rejects(checkWifiPort(port),error=>error.code==='EADDRINUSE');
    const result=await new Promise((resolve,reject)=>{const socket=net.connect(port,'127.0.0.1');let text='';socket.on('data',data=>text+=data);socket.on('end',()=>resolve(text));socket.on('error',reject)});
    assert.equal(result,'still-running');assert.equal(server.listening,true);
  }finally{await new Promise(resolve=>server.close(resolve))}
});
