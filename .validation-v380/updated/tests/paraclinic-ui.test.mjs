import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';

function expose(source, name) {
  assert.match(source, /\n\}\)\(\);\s*$/);
  return source.replace(/\n\}\)\(\);\s*$/, `\n  globalThis.__test = { ${name} };\n})();`);
}

test('successful paraclinic choices append to the right editable record without changing another patient', async () => {
  const source = await readFile(new URL('../public/paraclinic.js', import.meta.url), 'utf8');
  const listeners = new Map();
  const inputEvents = [];
  const fields = Object.fromEntries(['inv_list', 'ipd_investigations'].map(id => [id, {
    value: '', dispatchEvent(event) { inputEvents.push([id, event.type]); },
  }]));
  const context = vm.createContext({
    document: {
      addEventListener(name, handler) { listeners.set(name, handler); },
      getElementById(id) { return fields[id] || null; },
    },
    window: { addEventListener() {} },
    Event: class { constructor(type) { this.type = type; } },
    console,
  });
  vm.runInContext(expose(source, 'appendSelection'), context);
  listeners.get('emr:patient-loaded')({ detail: { patient: { patientKey: 'case:OPD-1' } } });

  fields.inv_list.value = 'Clinician note';
  context.__test.appendSelection('LAB', { items: [{ code: 'CBC' }, { code: 'CRP' }] }, 'opd', 'case:OPD-1');
  assert.equal(fields.inv_list.value, 'Clinician note\n- Laboratory: CBC, CRP');
  assert.equal(fields.ipd_investigations.value, '');

  fields.ipd_investigations.value = 'Other investigation';
  context.__test.appendSelection('XRAY', { examination: 'Chest', projection: 'PA' }, 'ipd', 'case:OPD-1');
  assert.equal(fields.ipd_investigations.value, 'Other investigation\n- X-ray: Chest · PA');
  assert.deepEqual(inputEvents, [
    ['inv_list', 'input'], ['inv_list', 'change'],
    ['ipd_investigations', 'input'], ['ipd_investigations', 'change'],
  ]);

  listeners.get('emr:patient-loaded')({ detail: { patient: { patientKey: 'case:IPD-2' } } });
  context.__test.appendSelection('CT', { examination: 'CT Brain' }, 'opd', 'case:OPD-1');
  assert.equal(fields.inv_list.value, 'Clinician note\n- Laboratory: CBC, CRP');
});

test('clicking an automatic triage OPD alert marks it read and opens the OPD record without a dialog', async () => {
  const source = await readFile(new URL('../public/messages.js', import.meta.url), 'utf8');
  const navigations = [], reads = [];
  const context = vm.createContext({
    window: { addEventListener() {}, location: { assign(url) { navigations.push(url); } } },
    document: { addEventListener() {}, getElementById() { return null; }, body: { append() { throw Error('Unexpected dialog'); } } },
    fetch: async (url) => { reads.push(url); return { ok: true, json: async () => ({ readAt: Date.now() }) }; },
    console,
  });
  vm.runInContext(expose(source, 'openMessage, isOpdReferral'), context);
  const referral = { id: 'msg-1', destinationType: 'WARD', destinationCode: 'opd',
    subject: 'OPD · លេខរៀង 2', patientKey: 'case:OPD-2' };
  assert.equal(context.__test.isOpdReferral(referral), true);
  assert.equal(context.__test.isOpdReferral({ ...referral, subject: 'General ward message' }), false);
  context.__test.openMessage(referral);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(reads, ['/api/messages/msg-1/read']);
  assert.deepEqual(navigations, ['/emr?patient=case%3AOPD-2&view=opd']);
});
