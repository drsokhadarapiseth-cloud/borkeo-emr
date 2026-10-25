import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/clinical-summary.js', import.meta.url), 'utf8');
const summary = (state = 'not-recorded', allergies = []) => ({
  allergies, problems: [], options: { allergyTypes: ['drug'], allergySeverities: ['severe'] },
  allergyAlert: { state, items: allergies, freeText: '', ticked: false },
});
function fixture() {
  let patient = { patientKey: 'case:A', data: {} };
  const requests = [], events = [], timers = [];
  const document = new EventTarget();
  document.querySelectorAll = () => [];
  const window = new EventTarget();
  Object.assign(window, {
    getLoadedEmrPatient: () => patient,
    emrSession: { user: { activeRole: 'DOCTOR' }, csrfToken: 'synthetic-csrf' },
    setTimeout: callback => timers.push(callback),
  });
  document.addEventListener('emr:clinical-summary', e => events.push(e.detail));
  const context = vm.createContext({ window, document, CustomEvent, fetch: (url, options) => new Promise((resolve, reject) => requests.push({ url, options, resolve, reject })) });
  vm.runInContext(source, context);
  return {
    api: window.EmrClinicalSummary, window, document, requests, events,
    switchTo(value) { patient = value; },
    reply(index, data, ok = true) { requests[index].resolve({ ok, json: async () => data }); },
  };
}

test('summary provider rejects late patient and same-patient refresh responses', async () => {
  const f = fixture();
  const a = f.api.refresh();
  assert.equal(f.api.allergyState().state, 'unknown');
  f.switchTo({ patientKey: 'case:B', data: {} });
  assert.equal(f.api.get().summary, null, 'get cannot expose A even before a load event');
  const b = f.api.refresh();
  f.reply(1, summary('none')); await b;
  f.reply(0, summary('allergy', [{ substance: 'Penicillin' }])); await a;
  assert.equal(f.api.get().patientKey, 'case:B');
  assert.equal(f.api.allergyState().state, 'none');
  const older = f.api.refresh(), newer = f.api.refresh();
  f.reply(3, summary('allergy', [{ substance: 'Sulfa' }])); await newer;
  f.reply(2, summary('none')); await older;
  assert.equal(f.api.allergyState().state, 'allergy');
  assert.equal(f.api.get().summary.allergies[0].substance, 'Sulfa');
});

test('unsaved, failed-request and empty-list guidance is distinct; specific translations precede fallback', async () => {
  const f = fixture();
  const slot = () => ({ dataset: {}, classList: { add() {} }, innerHTML: '',
    querySelector: () => null, querySelectorAll: () => [], append() {} });
  const allergy = slot(), problems = slot();
  f.document.createElement = () => ({ addEventListener() {} });
  f.document.querySelectorAll = selector => selector.includes(',') ? [allergy, problems]
    : selector.includes('structured-allergy') ? [allergy] : selector.includes('problem-list') ? [problems] : [];
  const unsaved = 'សូមរក្សាទុកកំណត់ត្រាអ្នកជំងឺជាមុនសិន។';
  const error = 'មិនអាចផ្ទៀងផ្ទាត់ព័ត៌មានបាន។ សូមព្យាយាមម្ដងទៀត។';
  f.switchTo(null); await f.api.refresh();
  for (const target of [allergy, problems]) {
    assert.ok(target.innerHTML.includes(unsaved));
    assert.ok(!target.innerHTML.includes(error));
  }
  f.switchTo({ patientKey: 'case:WORDING', data: {} });
  const failed = f.api.refresh(); f.reply(0, {}, false); await failed;
  for (const target of [allergy, problems]) {
    assert.ok(target.innerHTML.includes(error));
    assert.ok(!target.innerHTML.includes(unsaved));
  }
  assert.equal(f.api.allergyState().state, 'unknown');
  const loaded = f.api.refresh(); f.reply(1, summary()); await loaded;
  assert.ok(allergy.innerHTML.includes('មិនទាន់មានកំណត់ត្រាក្នុងបញ្ជីអាលែកហ្ស៊ីនេះទេ។'));
  assert.ok(problems.innerHTML.includes('មិនមានបញ្ហាសុខភាពដែលបានកត់ត្រាថាកំពុងបន្តមានទេ។'));
  assert.equal(f.api.allergyState().state, 'not-recorded');
  assert.equal(f.api.plainOptionLabel('severity', 'mild'), 'ស្រាល');
  assert.equal(f.api.plainOptionLabel('severity', 'unknown'), 'មិនទាន់ដឹង');
  assert.equal(f.api.plainOptionLabel('allergyType', 'drug'), 'ថ្នាំ');
  assert.equal(f.api.plainLabel('missing.translation', 'English fallback'), 'មិនអាចបង្ហាញព័ត៌មានបាន');
  f.window.currentLang = 'english';
  f.switchTo(null); await f.api.refresh();
  assert.ok(allergy.innerHTML.includes('Please save the patient record first.'));
  f.switchTo({ patientKey: 'case:WORDING', data: {} });
  const englishFailure = f.api.refresh(); f.reply(2, {}, false); await englishFailure;
  assert.ok(allergy.innerHTML.includes('Information cannot be verified. Please try again.'));
});

test('errors and malformed or contradictory summaries remain unknown; retry recovers', async () => {
  const f = fixture();
  for (const [data, ok] of [[summary('none'), false], [{}, true], [summary('none', [{ substance: 'Penicillin' }]), true]]) {
    const request = f.api.refresh();
    f.reply(f.requests.length - 1, data, ok); await request;
    assert.equal(f.api.get().status, 'error');
    assert.equal(f.api.get().summary, null);
    assert.equal(f.api.allergyState().state, 'unknown');
    assert.equal(f.api.canWrite(), false);
  }
  const retry = f.api.refresh(); f.reply(3, summary()); await retry;
  assert.equal(f.api.allergyState().state, 'not-recorded');
  const offline = f.api.refresh();
  f.requests[4].reject(new TypeError('Synthetic offline failure')); await offline;
  assert.equal(f.api.allergyState().state, 'unknown');
  f.switchTo(null);
  assert.equal(f.api.get().summary, null);
  assert.equal(f.api.allergyState().state, 'unknown');
});

test('mutations keep doctor permissions, bind patient/revision and CSRF, reject stale completion', async () => {
  const f = fixture();
  const load = f.api.refresh(); f.reply(0, summary()); await load;
  const expected = f.api.get();
  f.window.emrSession.user.activeRole = 'NURSE';
  assert.equal(f.api.canWrite(), false);
  assert.equal((await f.api.post('allergies', {}, expected)).ok, false);
  assert.equal(f.requests.length, 1);
  f.window.emrSession.user.activeRole = 'DOCTOR';
  assert.equal((await f.api.post('resuscitation', { status: 'dnr' }, expected)).ok, false);
  const write = f.api.post('allergies', { patientKey: 'case:WRONG', substance: 'Penicillin' }, expected);
  assert.equal(JSON.parse(f.requests[1].options.body).patientKey, 'case:A');
  assert.equal(f.requests[1].options.headers['X-CSRF-Token'], 'synthetic-csrf');
  assert.equal(f.api.canWrite(), false, 'no concurrent mutation during save');
  f.switchTo({ patientKey: 'case:B', data: {} });
  const b = f.api.refresh(); f.reply(2, summary()); await b;
  f.reply(1, summary('allergy', [{ substance: 'Penicillin' }]));
  assert.equal((await write).stale, true);
  assert.equal(f.api.get().patientKey, 'case:B');
  assert.equal(f.api.get().summary.allergies.length, 0);
  assert.equal((await f.api.post('allergies', {}, expected)).ok, false);
});

test('successful mutation publishes refreshed data and safe localized errors never expose diagnostics', async () => {
  const f = fixture();
  const load = f.api.refresh(); f.reply(0, summary()); await load;
  const before = f.api.get();
  const write = f.api.post('problems', { problem: 'Synthetic problem' }, before);
  const updated = { ...summary(), problems: [{ id: 'synthetic', problem: 'Synthetic problem', status: 'active' }] };
  f.reply(1, updated); assert.equal((await write).ok, true);
  assert.equal(f.api.get().summary.problems[0].problem, 'Synthetic problem');
  assert.ok(f.api.get().revision > before.revision);
  const failed = f.api.post('allergies', {}, f.api.get());
  f.reply(2, { error: 'SECRET raw backend diagnostic' }, false);
  const result = await failed;
  assert.match(result.error, /[\u1780-\u17ff]/);
  assert.doesNotMatch(result.error, /SECRET|backend/);
  assert.equal(f.api.allergyState().state, 'unknown');
  assert.equal(f.window.EmrClinicalSummary.label('', '<unsafe>', '<សាកល្បង>'), '&lt;សាកល្បង&gt;');
});

test('prescribing shows uncertainty for unknown or unrecorded allergies, never for empty rows', () => {
  const medicationSource = fs.readFileSync(new URL('../public/medication-safety.js', import.meta.url), 'utf8');
  const start = medicationSource.indexOf('  function showAllergyVerification(row)');
  const end = medicationSource.indexOf('  function warningsFor(row)', start);
  let state = 'unknown', note = null;
  const input = { value: 'Synthetic medicine', insertAdjacentElement(_position, value) { note = value; } };
  const row = { querySelector: selector => selector === 'NAME' ? input : note };
  const context = vm.createContext({
    NAME: 'NAME', window: { EmrClinicalSummary: { allergyState: () => ({ state }) } },
    plain: (_key, _en, kh) => kh,
    document: { createElement: () => ({ setAttribute() {}, remove() { note = null; } }) },
  });
  vm.runInContext(medicationSource.slice(start, end), context);
  for (state of ['unknown', 'not-recorded']) {
    context.showAllergyVerification(row);
    assert.match(note.textContent, /[\u1780-\u17ff]/);
  }
  for (state of ['none', 'allergy']) {
    context.showAllergyVerification(row);
    assert.equal(note, null);
  }
  state = 'unknown'; input.value = '';
  context.showAllergyVerification(row);
  assert.equal(note, null);
});
