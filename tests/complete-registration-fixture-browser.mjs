import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmrServer } from '../server/server.mjs';
import { buildCompleteRegistrationPatients } from '../scripts/create-complete-registration-fixture.mjs';
import { openBrowser } from './helpers/context-browser.mjs';

test('all 30 synthetic patients load complete required registration fields', { timeout: 600000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0, nodeEnv: 'test', npca: { enabled: false } });
  let browser;
  try {
    const patients = buildCompleteRegistrationPatients();
    const userId = app.database.findUser('registration').id;
    for (const patient of patients) app.database.upsertPatient({ ...patient, userId });
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    app.config.appOrigin = origin;
    browser = await openBrowser();
    // Form/data checks are local-only; external fonts/icons must not stall fixtures.
    await browser.send('Network.setBlockedURLs', { urls: ['https://*'] });
    await browser.send('Page.navigate', { url: origin + '/login' });
    await browser.waitFor("document.getElementById('login-form')", 'login');
    assert.equal(await browser.evaluate("(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'registration'})});return r.status})()"), 200);
    for (const patient of patients) {
      await browser.send('Page.navigate', { url: origin + '/emr?' + new URLSearchParams({ patient: patient.patientKey, view: 'register', edit: '1' }) });
      await browser.waitFor(`window.getLoadedEmrPatient?.()?.patientKey===${JSON.stringify(patient.patientKey)} && window.BorkeoRequiredFields`, 'registration runtime', 60000);
      await browser.waitFor("window.cambodiaAddressManager?.provinceDropdown && document.getElementById('web_province').options.length>1", 'address catalogue');
      // Fixture harness hydrates linked selects through the existing address helper.
      // The generic record loader does not itself call this helper.
      await browser.evaluate('cambodiaAddressManager.restoreAddress(getLoadedEmrPatient().data)');
      await browser.waitFor(`getLoadedEmrPatient()?.patientKey===${JSON.stringify(patient.patientKey)} && document.getElementById('web_village').value`, 'loaded address', 30000);
      const result = await browser.evaluate(`(()=>{const root=document.getElementById('sub_reg');const valid=BorkeoRequiredFields.validate(root);return {valid,missing:[...root.querySelectorAll('[aria-invalid=true]')].map(e=>e.id||e.dataset.emrStorageKey),age:document.getElementById('web_age').value,sex:!!root.querySelector('input[name=sex_radio]:checked'),id:document.getElementById('web_health_id').value};})()`);
      assert.equal(result.valid, true, `${patient.patientKey}: ${JSON.stringify(result)}`);
      assert.ok(result.age);
      assert.equal(result.sex, true);
      assert.equal(result.id, patient.summary.healthId);
      console.log(`Validated ${patient.summary.healthId}`);
    }
  } catch (error) {
    console.log(await browser?.evaluate("({key:window.getLoadedEmrPatient?.()?.patientKey,fields:['web_province','web_district','web_commune','web_village'].map(id=>({id,value:document.getElementById(id)?.value,options:document.getElementById(id)?.options?.length})),missing:document.querySelector('[data-emr-required-message]')?.textContent})"));
    console.log(browser?.state.errors); throw error;
  }
  finally { browser?.close(); await new Promise(resolve => app.server.close(resolve)); app.database.close(); }
});
