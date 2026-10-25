import fs from 'node:fs';
import vm from 'node:vm';

// Complete nonvisual provider/editor script with synthetic network responses and slots.
export function summaryFixture() {
  let patient = { patientKey: 'case:Synthetic', data: {} };
  const requests = [], slots = {};
  for (const name of ['structured-allergy', 'problem-list']) slots[name] = {
    dataset: {}, innerHTML: '', hidden: true, classList: { add() {} },
    querySelector: () => null, querySelectorAll: () => [], append() {},
  };
  const document = new EventTarget();
  document.querySelectorAll = selector => selector.includes(',') ? Object.values(slots)
    : Object.entries(slots).filter(([name]) => selector.includes(name)).map(([, slot]) => slot);
  document.createElement = () => ({ addEventListener() {} });
  const window = new EventTarget();
  Object.assign(window, { getLoadedEmrPatient: () => patient,
    emrSession: { user: { activeRole: 'DOCTOR' }, csrfToken: 'synthetic-csrf' }, setTimeout() {} });
  vm.runInNewContext(fs.readFileSync(new URL('../../public/clinical-summary.js', import.meta.url), 'utf8'), {
    window, document, CustomEvent, fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })),
  });
  return { window, document, slots, requests, api: window.EmrClinicalSummary,
    switchTo(next) { patient = next; },
    reply(index, data, ok = true) { requests[index].resolve({ ok, json: async () => data }); },
  };
}
