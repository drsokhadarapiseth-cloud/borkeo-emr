import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';

test('organization branding can be changed by Admin/Director and serves its saved logo', async () => {
  const port=32356,origin=`http://127.0.0.1:${port}`;
  const app=createEmrServer({demoMode:true,host:'127.0.0.1',port,appOrigin:origin,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  await new Promise(resolve=>app.server.listen(port,'127.0.0.1',resolve));
  try {
    const login=async username=>{
      const response=await fetch(origin+'/api/auth/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username})});
      assert.equal(response.status,200,await response.clone().text());
      const Cookie=response.headers.get('set-cookie').split(';')[0];
      const me=await(await fetch(origin+'/api/auth/me',{headers:{Cookie}})).json();
      return {Cookie,Origin:origin,'X-CSRF-Token':me.csrfToken,'Content-Type':'application/json'};
    };
    const admin=await login('admin'),director=await login('director');
    const page=await fetch(origin+'/admin/organization',{headers:{Cookie:admin.Cookie}});
    assert.equal(page.status,200);
    const allowedDirectorPage=await fetch(origin+'/admin/organization',{headers:{Cookie:director.Cookie}});
    assert.equal(allowedDirectorPage.status,200);
    const original=await(await fetch(origin+'/api/organization/branding')).json();
    assert.equal(original.nameEn,'Borkeo Referral Hospital');
    const png='iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScL/nwAAAABJRU5ErkJggg==';
    const saved=await fetch(origin+'/api/admin/organization-branding',{method:'POST',headers:admin,body:JSON.stringify({nameKh:'មណ្ឌលសុខភាព សាកល្បង',nameEn:'Test Health Center',logoDataUrl:`data:image/png;base64,${png}`})});
    assert.equal(saved.status,200,await saved.clone().text());
    const branding=(await saved.json()).branding;
    assert.equal(branding.nameEn,'Test Health Center');
    assert.equal(branding.hasCustomLogo,true);
    const logo=await fetch(origin+'/api/organization/logo');
    assert.equal(logo.status,200);
    assert.equal(logo.headers.get('content-type'),'image/png');
    const savedByDirector=await fetch(origin+'/api/admin/organization-branding',{method:'POST',headers:director,body:JSON.stringify({nameKh:'មណ្ឌលសុខភាព ថ្នាក់ដឹកនាំ',nameEn:'Leadership Center',logoDataUrl:`data:image/png;base64,${png}`})});
    assert.equal(savedByDirector.status,200);
    const unchanged=await(await fetch(origin+'/api/organization/branding')).json();
    assert.equal(unchanged.nameEn,'Leadership Center');
  } finally { await new Promise(resolve=>app.server.close(resolve));app.database.close(); }
});
