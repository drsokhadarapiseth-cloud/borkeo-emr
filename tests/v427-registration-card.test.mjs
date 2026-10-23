import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const read = file => fs.readFileSync(new URL('../' + file, import.meta.url), 'utf8');

test('registration generates the saved Patient ID QR and waits for preview closure without printing', async () => {
  const dialog = new EventTarget();
  dialog.showModal = () => { dialog.open = true; };
  const qrCalls = [];
  const box = { replaceChildren() {}, querySelector: tag => tag === 'canvas' ? { toDataURL: () => 'data:image/png;base64,synthetic' } : null };
  const elements = { patient_card_dialog: dialog, card_qr_container: box, card_lbl_id: {}, web_health_id: { value: 'UNSAVED-ID' } };
  function QRCode(node, options) { qrCalls.push(options.text); }
  QRCode.CorrectLevel = { M: 0 };
  const window = { QRCode, localStorage: { getItem() { return null; }, setItem() {} } };
  const document = { getElementById: id => elements[id], querySelector: () => null, createElement: () => ({}), fonts: { load: async () => [true], ready: Promise.resolve() } };
  vm.runInNewContext(read('public/patient-card-print.js'), { window, document, setTimeout, clearTimeout, Promise });
  let closed = false;
  const preview = window.previewRegisteredPatientCard({ healthId: 'BK-SAVED-0001' }).then(() => { closed = true; });
  await Promise.resolve();
  assert.equal(dialog.open, true);
  assert.equal(elements.card_lbl_id.textContent, 'BK-SAVED-0001');
  assert.deepEqual(qrCalls, ['BK-SAVED-0001']);
  assert.equal(closed, false);
  dialog.open = false;
  dialog.dispatchEvent(new Event('close'));
  await preview;
  assert.equal(closed, true);
  await window.previewRegisteredPatientCard({});
  assert.equal(qrCalls.length, 1);
});

test('only a successful new registration opens the card, before the transfer redirect', async () => {
  const source = read('public/emr-patient-record.js');
  const save = source.slice(source.indexOf('  async function savePatientRecord('), source.indexOf('  // Printing reads the form only.'));
  for (const scenario of ['new', 'existing', 'returning', 'failed', 'triage']) {
    const calls = [];
    let closePreview;
    const patient = { patientKey: 'case:synthetic', healthId: 'BK-TEST', fullName: 'Synthetic' };
    const element = { classList: { contains: () => false } };
    const window = { emrSession: { user: { activeRole: 'REGISTRATION' } }, history: { replaceState() {} }, location: { href: 'http://localhost/emr', assign: () => calls.push('redirect') }, previewRegisteredPatientCard: () => { calls.push('preview'); return new Promise(resolve => { closePreview = resolve; }); } };
    const context = {
      window, URL, CustomEvent: class {}, loadedPatient: scenario === 'existing' ? patient : null,
      registrationVisitSourceKey: scenario === 'returning' ? 'old-visit' : '',
      activeEditorScope: () => scenario === 'triage' ? 'triage' : 'registration',
      document: { getElementById: () => element, querySelector: () => null, body: { classList: element.classList, dataset: {} }, dispatchEvent() {} },
      ensureFirstExamDateTime() {}, patientContext: () => ({ key: patient.patientKey, summary: {} }), validatePatient: () => '', setStatus() {}, t: x => x,
      getCsrfToken: async () => 'synthetic', readRecordData: () => ({}), selectedCaseType: () => '', nursingDayAndLabel: () => ({}), getEmrCarePath: () => ({}),
      fetch: async () => ({ ok: scenario !== 'failed', json: async () => ({ patient, error: 'Synthetic failure' }) }),
      loadEditorHistory: async () => {}, renderRecordSignatures() {}, refreshAdmissionApprovalPanel() {}, applyTriageWorkspaceRestrictions() {}, updateTriageSaveButtonState() {},
    };
    vm.createContext(context);
    vm.runInContext(save + '\nthis.save = savePatientRecord;', context);
    const saving = context.save({ transferToTriage: true });
    await new Promise(resolve => setImmediate(resolve));
    if (scenario === 'new') {
      assert.deepEqual(calls, ['preview']);
      closePreview();
    }
    assert.equal(await saving, scenario !== 'failed', scenario);
    assert.deepEqual(calls, scenario === 'new' ? ['preview', 'redirect'] : scenario === 'failed' ? [] : ['redirect'], scenario);
  }
});
