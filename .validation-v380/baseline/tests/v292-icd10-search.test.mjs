import test from 'node:test';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createDiagnosisSearch } from '../server/icd10.mjs';
import { createEmrServer } from '../server/server.mjs';
test('local catalogue searches codes and multilingual descriptions with bounded results', () => {
 const search=createDiagnosisSearch();
 try {
  assert.equal(search.search('').items.length,40);
  for(const query of ['A00','a00','cholera','អាសន្ន','choléra']) {
   const started=performance.now(); const result=search.search(query);
   assert.ok(result.items.some(r=>r.code==='A00'),query);assert.ok(result.items.length<=40);
   console.log(query,Math.round(performance.now()-started)+'ms');
  }
  assert.ok(search.search('A00.').items.every(r=>r.code.startsWith('A00.')));
  assert.equal(search.search('zzzz_no_such_diagnosis').items.length,0);
  assert.deepEqual(search.search('" *').items,[]);
  assert.ok(search.search('hypertensive urgency').items.some(r=>r.code==='I16.00'));
  assert.equal(search.search('I22.').items.find(r=>r.code==='I22.').selectable,false);
  assert.ok(search.search('a',9999).items.length<=50);
  assert.equal(search.search('cho').items.length,40);
  assert.ok(search.search('cho').items.every(r=>(r.en+' '+r.kh+' '+r.fr).toLowerCase().includes('cho')));
 } finally {search.close();}
});
test('search API requires a session and works in the disposable demo',async()=>{
 const app=createEmrServer({databasePath:':memory:',host:'127.0.0.1',port:33389,appOrigin:'http://127.0.0.1:33389'});
 await new Promise(resolve=>app.server.listen(33389,'127.0.0.1',resolve));
 const base='http://127.0.0.1:33389';
 try{
  assert.equal((await fetch(base+'/api/icd10/search?q=A00')).status,401);
  const login=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json',Origin:base},body:JSON.stringify({username:'admin'})});
  assert.equal(login.status,200);
  const cookie=login.headers.getSetCookie().map(s=>s.split(';')[0]).join('; ');
  const result=await fetch(base+'/api/icd10/search?q=A00',{headers:{Cookie:cookie}});
  assert.equal(result.status,200);assert.ok((await result.json()).items.some(r=>r.code==='A00'));
  assert.equal((await fetch(base+'/public/emr-icd10.js')).status,200);
  assert.equal((await fetch(base+'/public/emr-icd10.css')).status,200);
 }finally{await new Promise(resolve=>app.server.close(resolve));app.database.close();}
});
