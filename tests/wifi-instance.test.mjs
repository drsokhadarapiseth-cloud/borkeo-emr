import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import {configureWifiInstance,checkWifiPort} from '../scripts/wifi-instance.mjs';

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
  const env={DATABASE_PATH:'original.sqlite',DATA_DIR:'original-data'};
  assert.equal(configureWifiInstance(root,env).origin,'http://127.0.0.1:3001');
  assert.equal(env.DATABASE_PATH,'original.sqlite');assert.equal(env.DATA_DIR,'original-data');
  fs.writeFileSync(path.join(root,'wifi-instance.local.json'),JSON.stringify({kind:'simulation',port:3001,origin:'http://localhost:3001',dataDirectory:'../hospital'}));
  assert.throws(()=>configureWifiInstance(root,{}),/Invalid simulation/);
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
