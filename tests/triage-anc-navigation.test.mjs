import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const source = fs.readFileSync(new URL('../public/maternal-emr.js', import.meta.url), 'utf8');
test('ANC module synchronization preserves triage/registration and still opens authorized clinical ANC', () => {
  for (const [role, view, navigates] of [['TRIAGE','triage',false], ['TRIAGE','opd',false], ['REGISTRATION','register',false], ['ADMIN','triage',false], ['ADMIN','register',false], ['MIDWIFE','opd',true], ['DOCTOR','opd',true], ['','opd',false]]) {
    const listeners = {}, urls = [];
    const context = { document: { readyState:'loading', body:{dataset:{encounterView:view}}, addEventListener:(name, fn) => { listeners[name] = fn; } },
      window: { emrSession:{user:{activeRole:role}}, getLoadedEmrPatient:() => ({patientKey:'case:SYNTHETIC ANC'}), location:{assign:url => urls.push(url)} } };
    vm.runInNewContext(source, context);
    let stopped = false;
    listeners.change({target:{id:'opd-module-select',value:'anc'},stopImmediatePropagation:() => { stopped = true; }});
    assert.equal(urls.length, navigates ? 1 : 0, `${role}/${view}`);
    assert.equal(stopped, navigates, 'ignored changes must reach the normal local selector handler');
    if (navigates) assert.equal(urls[0], '/anc-record?patient=case%3ASYNTHETIC%20ANC');
  }
});
