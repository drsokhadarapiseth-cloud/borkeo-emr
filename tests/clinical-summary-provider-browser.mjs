// Explicit Chromium integration test: only synthetic patients and an in-memory database.
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';
import { setUserAccess } from '../server/access.mjs';
import { setResuscitationStatus } from '../server/clinical-summary.mjs';
import { openBrowser } from './helpers/context-browser.mjs';

test('clinical summary editors, checklist, warning states and storage keys work without a banner', { timeout: 120000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test', npca: { enabled: false } });
  let browser;
  try {
    app.database.createUser({ id: 'summary-provider-doctor', username: 'summary_provider_doctor', displayName: 'Synthetic Doctor', role: 'DOCTOR', passwordHash: 'unused-synthetic', createdAt: Date.now() });
    setUserAccess(app.database, 'summary-provider-doctor', ['DOCTOR'], ['medicine']);
    for (const suffix of ['A', 'B']) app.database.upsertPatient({
      id: crypto.randomUUID(), patientKey: `case:SUMMARY-${suffix}`, userId: 'summary-provider-doctor', savedAt: Date.now(),
      summary: { caseNumber: `SUMMARY-${suffix}`, healthId: `SYNTHETIC-${suffix}`, firstName: 'Synthetic', lastName: suffix, fullName: `Synthetic ${suffix}`, sex: 'Female', age: '40', dateOfBirth: '1986-01-01', phone: '', equityCard: '', paymentType: 'EXEMPT', departmentCode: 'medicine', departmentNameKh: '', departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: '2026-10-01', dischargeDate: '' },
      data: { 'scope:medical:auto:83': suffix === 'B' ? 'NKDA' : '', 'scope:medical:auto:82': false },
    });
    setResuscitationStatus(app.database, app.database.findPatient('case:SUMMARY-A'),
      { user_id: 'summary-provider-doctor', display_name: 'Synthetic Doctor', activeRole: 'DOCTOR' }, 'dnr');
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    app.config.appOrigin = origin;
    browser = await openBrowser();
    await browser.send('Page.navigate', { url: origin + '/login' });
    await browser.waitFor("location.pathname==='/login' && document.getElementById('login-form')", 'login');
    assert.equal(await browser.evaluate(`(async()=>{const r=await fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'summary_provider_doctor'})});return r.status})()`), 200);
    const visit = async (suffix, mode = 'edit') => {
      await browser.send('Page.navigate', { url: `${origin}/emr?patient=case%3ASUMMARY-${suffix}&view=medical&mode=${mode}` });
      try {
        await browser.waitFor(`window.EmrClinicalSummary?.get()?.status==='ready' && window.EmrClinicalSummary.get().patientKey==='case:SUMMARY-${suffix}'`, 'loaded clinical summary', 45000);
      } catch (error) {
        console.log(await browser.evaluate("JSON.stringify({url:location.href,role:window.emrSession?.user?.activeRole,state:window.EmrClinicalSummary?.get(),patient:window.getLoadedEmrPatient?.()?.patientKey})"));
        console.log(browser.state.errors);
        throw error;
      }
    };
    await visit('A');
    await browser.waitFor("document.querySelector('[data-allergy-field=\"substance\"]') && !document.querySelector('[data-allergy-field=\"substance\"]').disabled", 'doctor allergy editor');
    assert.equal(await browser.evaluate("Boolean(document.querySelector('.emr-patient-banner'))"), false);
    assert.deepEqual(await browser.evaluate("[...document.querySelectorAll('.emr-chart-tab')].map(n=>n.dataset.chartTab)"), ['summary', 'vitals', 'orders', 'results', 'meds', 'notes']);
    await browser.waitFor("document.querySelector('#sub_ipd .paraclinic-inline')", 'live paraclinic section');
    const navigation = await browser.evaluate(`(()=>{
      const actions=[],originalPage=window.switchPage;
      window.switchPage=number=>{actions.push(['page',number]);return originalPage(number)};
      for(const [tab,id] of [['orders','paraclinic-inline'],['results','paraclinic-inline'],['meds','ipd_rx_container']]){
        const target=tab==='meds'?document.getElementById(id):document.querySelector('#sub_ipd .paraclinic-inline'),scroll=target.scrollIntoView;
        target.scrollIntoView=function(options){actions.push(['scroll',id]);return scroll.call(this,options)};
        document.querySelector('[data-chart-tab="'+tab+'"]').click();target.scrollIntoView=scroll;
      }
      for(const tab of ['vitals','notes'])document.querySelector('[data-chart-tab="'+tab+'"]').click();
      const selected=document.querySelector('.emr-chart-tab.is-active');
      const result={actions,active:selected.dataset.chartTab,aria:selected.getAttribute('aria-selected'),labels:[...document.querySelectorAll('.emr-chart-tab span')].map(n=>n.textContent.trim())};
      window.switchPage=originalPage;window.switchPage(3);window.switchOpdTab('ipd');return result;
    })()`);
    assert.deepEqual(navigation.actions, [['page', 3], ['scroll', 'paraclinic-inline'], ['page', 3], ['scroll', 'paraclinic-inline'], ['page', 3], ['scroll', 'ipd_rx_container'], ['page', 2], ['page', 3]]);
    assert.equal(await browser.evaluate("document.querySelector('#sub_ipd details.paraclinic-recent').open"), true);
    assert.equal(navigation.active, 'notes'); assert.equal(navigation.aria, 'true');
    assert.ok(navigation.labels.every(label => /[\u1780-\u17ff]/.test(label) && !/[A-Za-z]/.test(label)));
    assert.equal(await browser.evaluate("EmrClinicalSummary.allergyState().state"), 'not-recorded');
    assert.equal(await browser.evaluate("document.querySelector('[data-clinical-resuscitation]').textContent"), 'DNR');
    await browser.send('Emulation.setEmulatedMedia', { media: 'print' });
    assert.equal(await browser.evaluate("document.querySelector('[data-clinical-resuscitation]').getClientRects().length>0"), true);
    await browser.send('Emulation.setEmulatedMedia', { media: '' });
    await browser.evaluate(`window.originalKeys=JSON.stringify([...document.querySelectorAll('[data-emr-storage-key]')].map(n=>[n.id,n.dataset.emrStorageKey]));
      document.querySelector('[data-allergy-field="substance"]').value='Penicillin';
      document.querySelector('[data-allergy-field="reaction"]').value='Synthetic rash';
      document.querySelector('[data-allergy-field="severity"]').value='severe';
      document.querySelector('[data-allergy-add]').click();`);
    await browser.waitFor("EmrClinicalSummary.get().status==='ready' && EmrClinicalSummary.get().summary.allergies.length===1", 'saved allergy');
    assert.equal(await browser.evaluate("EmrClinicalSummary.allergyState().state"), 'allergy');
    assert.match(await browser.evaluate("document.querySelector('[data-clinical-recorded-risks]').textContent"), /DNR[\s\S]*Penicillin/);
    await browser.evaluate(`const slot=document.querySelector('[data-soap-slot="problem-list"]');slot.querySelector('[data-problem-field="problem"]').value='Synthetic problem';slot.querySelector('[data-problem-add]').click();`);
    await browser.waitFor("EmrClinicalSummary.get().status==='ready' && EmrClinicalSummary.get().summary.problems.length===1", 'saved problem');
    await browser.evaluate("document.querySelector('[data-problem-status]').click()");
    await browser.waitFor("EmrClinicalSummary.get().status==='ready' && EmrClinicalSummary.get().summary.problems[0].status==='resolved'", 'resolved problem');
    assert.equal(await browser.evaluate("JSON.stringify([...document.querySelectorAll('[data-emr-storage-key]')].map(n=>[n.id,n.dataset.emrStorageKey]))===originalKeys"), true);
    assert.equal(await browser.evaluate("[...document.querySelectorAll('[data-soap-slot] [data-emr-transient]')].every(n=>!n.hasAttribute('data-emr-storage-key'))"), true);
    // Exercise the real prescribing warning evaluator with a synthetic transient row.
    await browser.evaluate(`const table=document.createElement('table');table.innerHTML='<tbody><tr id="synthetic-rx"><td><input class="rx-name" data-emr-transient value="Penicillin V 500mg"></td></tr></tbody>';document.getElementById('page3').append(table);`);
    assert.equal(await browser.evaluate("EmrMedicationSafety.warningsFor(document.getElementById('synthetic-rx')).some(w=>w.kind==='allergy' && w.detail.includes('Penicillin'))"), true);
    // The workspace checklist uses the same provider, not a banner.
    await browser.evaluate("window.switchOpdTab?.('opd'); document.dispatchEvent(new CustomEvent('emr:clinical-summary'))");
    await browser.waitFor("document.getElementById('task_item_allergy')?.classList.contains('is-success')", 'allergy checklist');
    await browser.waitFor("document.getElementById('safety-warning-dialog')?.open", 'prescribing allergy warning dialog');
    assert.match(await browser.evaluate("document.getElementById('safety-warning-dialog').textContent"), /Penicillin/);
    await browser.evaluate("window.staleOverrideForm=document.querySelector('#safety-warning-dialog form');document.getElementById('safety-warning-dialog').close()");
    await browser.evaluate("document.getElementById('task_item_allergy').click()");
    assert.equal(await browser.evaluate("document.querySelector('[data-soap-slot=\"structured-allergy\"]').contains(document.activeElement)"), true);
    await browser.evaluate(`(async()=>{window.savedFetch=window.fetch;window.fetch=(url,opts)=>String(url).startsWith('/api/clinical-summary?')?Promise.resolve(new Response(JSON.stringify({error:'PRIVATE DIAGNOSTIC'}),{status:503})):savedFetch(url,opts);await EmrClinicalSummary.refresh();})()`);
    assert.equal(await browser.evaluate("EmrClinicalSummary.allergyState().state"), 'unknown');
    assert.equal(await browser.evaluate("EmrMedicationSafety.warningsFor(document.getElementById('synthetic-rx')).some(w=>w.kind==='allergy')"), false);
    assert.match(await browser.evaluate("document.querySelector('[data-allergy-verification]').textContent"), /[\u1780-\u17ff]/);
    assert.equal(await browser.evaluate("document.getElementById('task_item_allergy').classList.contains('is-success')"), false);
    assert.equal(await browser.evaluate("document.body.textContent.includes('PRIVATE DIAGNOSTIC')"), false);
    await browser.evaluate("(async()=>{window.fetch=savedFetch;await EmrClinicalSummary.refresh()})()");
    await browser.evaluate("loadPatientRecord('case:SUMMARY-B')");
    await browser.waitFor("EmrClinicalSummary.get().status==='ready' && EmrClinicalSummary.get().patientKey==='case:SUMMARY-B'", 'patient switch');
    assert.equal(await browser.evaluate("EmrClinicalSummary.get().summary.allergies.length"), 0);
    assert.equal(await browser.evaluate("EmrClinicalSummary.allergyState().state"), 'none');
    assert.doesNotMatch(await browser.evaluate("document.querySelector('[data-clinical-recorded-status]').textContent"), /DNR|Penicillin/);
    await browser.evaluate("staleOverrideForm.elements['safety-reason'].value='Synthetic stale reason';staleOverrideForm.dispatchEvent(new Event('submit',{cancelable:true}))");
    assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) AS count FROM prescribing_overrides').get().count, 0, 'a retained dialog cannot write an override for another patient');
    await visit('A', 'view');
    assert.equal(await browser.evaluate("document.querySelector('[data-allergy-add]')===null"), true);
    assert.equal(await browser.evaluate("EmrClinicalSummary.get().summary.allergies[0].substance"), 'Penicillin');
    assert.equal(app.database.findPatient('case:SUMMARY-A').record_json, JSON.stringify({ 'scope:medical:auto:83': '', 'scope:medical:auto:82': false }));
    assert.deepEqual(browser.state.errors, []);
  } finally {
    browser?.close();
    if (app.server.listening) await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
