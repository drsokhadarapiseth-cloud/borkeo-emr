import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

test('print/export audit provider captures the loaded patient and CSRF, deduplicates and retries failures', async () => {
  let current = { patientKey: 'case:A' }, ok = true;
  const events = new Map(), requests = [];
  const window = { location: { search: '?patient=case:STALE' }, getLoadedEmrPatient: () => current,
    emrSession: { csrfToken: 'synthetic-csrf' }, addEventListener: (event, callback) => events.set(event, callback) };
  const document = { title: 'Synthetic record', addEventListener() {} };
  vm.runInNewContext(fs.readFileSync('public/record-access.js', 'utf8'), {
    window, document, URLSearchParams, fetch: async (url, options) => { requests.push({ url, options }); return { ok }; },
  });
  assert.equal(await window.logRecordAccess('print', document.title), true);
  events.get('beforeprint')();
  assert.equal(requests.length, 1, 'the report and beforeprint event produce one entry');
  assert.deepEqual(JSON.parse(requests[0].options.body), { patientKey: 'case:A', action: 'print', detail: document.title });
  assert.equal(requests[0].options.headers['X-CSRF-Token'], 'synthetic-csrf');
  assert.equal(requests[0].options.keepalive, true);
  current = { patientKey: 'case:B' };
  assert.equal(await window.logRecordAccess('export', 'Synthetic export'), true);
  assert.equal(JSON.parse(requests[1].options.body).patientKey, 'case:B');
  current = null;
  assert.equal(await window.logRecordAccess('print', 'No loaded patient'), false);
  assert.equal(requests.length, 2, 'never fall back to a stale URL when the record getter has no patient');
  current = { patientKey: 'case:B' };
  assert.equal(await window.logRecordAccess('open'), false, 'record opens remain server-owned');
  ok = false;
  assert.equal(await window.logRecordAccess('print', 'Retry'), false);
  ok = true;
  assert.equal(await window.logRecordAccess('print', 'Retry'), true);
});
