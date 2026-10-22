// v41.3 - Consents, surgery, anaesthesia and transfusion forms: one form per type
// and date, history kept, staff e-signature slots, patient signature images.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { hashPassword } from '../server/password.mjs';
import { setUserAccess } from '../server/access.mjs';
import { clinicalOptions } from '../server/clinical-summary.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const port = 34413;
const origin = `http://127.0.0.1:${port}`;
const password = 'Perioperative forms test password 413';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

async function addUser(app, username, role, wards) {
  const id = crypto.randomUUID();
  app.database.createUser({ id, username, displayName: username, role, passwordHash: await hashPassword(password), createdAt: Date.now() });
  setUserAccess(app.database, id, [role], wards);
  return id;
}

async function login(username) {
  const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookie } })).json();
  return { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json', 'X-CSRF-Token': me.csrfToken };
}

test('v41.3 periop forms: one per type and date, revisions kept, signatures, roles', async () => {
  const app = createEmrServer({ demoMode: false, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
    const doctorId = await addUser(app, 'doctor413', 'DOCTOR', ['surgery']);
    await addUser(app, 'nurse413', 'NURSE', ['surgery']);
    await addUser(app, 'doctor413m', 'DOCTOR', ['medicine']);
    await addUser(app, 'pharmacy413', 'PHARMACY', []);
    app.database.upsertPatient({
      id: crypto.randomUUID(), patientKey: 'case:V413', userId: doctorId, savedAt: Date.now(),
      summary: { caseNumber: 'V413', healthId: '', firstName: 'Synthetic', lastName: 'Patient', fullName: 'Synthetic Patient', sex: 'Male', age: '50', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'EXEMPT', departmentCode: 'surgery', departmentNameKh: '', departmentNameEn: 'Surgery', serviceMode: 'ipd', entryDate: '2026-10-01', dischargeDate: '' },
      data: {},
    });
    const doctor = await login('doctor413');
    const nurse = await login('nurse413');
    const otherWard = await login('doctor413m');
    const pharmacy = await login('pharmacy413');
    const post = (headers, p, body) => fetch(origin + p, { method: 'POST', headers, body: JSON.stringify(body) });
    const consent = { patientKey: 'case:V413', formType: 'procedureConsent', formDate: '2026-10-21', data: { procedureName: 'Appendectomy', indication: 'Acute appendicitis' } };

    assert.equal((await post(pharmacy, '/api/periop-forms', consent)).status, 403);
    assert.equal((await post(otherWard, '/api/periop-forms', consent)).status, 404);
    assert.equal((await post(doctor, '/api/periop-forms', { ...consent, formType: 'other' })).status, 400);
    assert.equal((await post(doctor, '/api/periop-forms', { ...consent, formDate: '21/10/2026' })).status, 400);
    assert.equal((await post(doctor, '/api/periop-forms', { ...consent, patientSign: { method: 'drawn', image: 'data:text/html;base64,AA==' } })).status, 400);

    let result = await (await post(doctor, '/api/periop-forms', { ...consent, patientSign: { method: 'drawn', image: PNG, signerType: 'patient', signerName: 'Synthetic Patient' } })).json();
    assert.equal(result.forms.length, 1);
    const form = result.forms[0];
    assert.deepEqual([form.formType, form.formDate, form.revision, form.patientSign.method], ['procedureConsent', '2026-10-21', 1, 'drawn']);

    // Same type and date = the same form (updated, history kept); a stale revision is refused.
    result = await (await post(nurse, '/api/periop-forms', { ...consent, data: { procedureName: 'Appendectomy (open)' }, revision: 1 })).json();
    assert.equal(result.forms.length, 1);
    assert.equal(result.forms[0].revision, 2);
    assert.equal(result.forms[0].patientSign.method, 'drawn', 'a given patient signature is never removed by a later save');
    assert.equal((await post(doctor, '/api/periop-forms', { ...consent, revision: 1 })).status, 409);
    assert.equal(app.database.sqlite.prepare('SELECT COUNT(*) n FROM perioperative_form_revisions').get().n, 1);
    // Another date = a new form.
    result = await (await post(doctor, '/api/periop-forms', { ...consent, formDate: '2026-10-25' })).json();
    assert.equal(result.forms.filter((f) => f.formType === 'procedureConsent').length, 2);

    // Staff e-signature in an allowed slot only; signing records the signed version.
    assert.equal((await post(doctor, `/api/periop-forms/${form.id}/sign`, { patientKey: 'case:V413', slot: 'surgeon' })).status, 400);
    result = await (await post(doctor, `/api/periop-forms/${form.id}/sign`, { patientKey: 'case:V413', slot: 'doctor' })).json();
    const signed = result.forms.find((f) => f.id === form.id);
    assert.equal(signed.signatures.doctor.signerName.length > 0, true);
    assert.equal(signed.signatures.doctor.revision, signed.revision);

    // The checklist and other forms have no patient signature.
    result = await (await post(nurse, '/api/periop-forms', { patientKey: 'case:V413', formType: 'preopChecklist', formDate: '2026-10-21', data: { 'who.identity': true }, patientSign: { method: 'drawn', image: PNG } })).json();
    const checklist = result.forms.find((f) => f.formType === 'preopChecklist');
    assert.deepEqual([checklist.data['who.identity'], checklist.patientSign], [true, {}]);
    assert.equal(result.whoChecklist.length, 3);

    const actions = new Set(app.database.sqlite.prepare('SELECT action FROM audit_events').all().map((r) => r.action));
    assert.ok(actions.has('PERIOP_FORM_SAVED') && actions.has('PERIOP_FORM_SIGNED'));
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
  }
});

test('WHO checklist is configurable; owner-approved Khmer is applied; controls are never saved with the record', () => {
  const groups = clinicalOptions().whoChecklist;
  assert.deepEqual(groups.map((g) => [g.section, g.items.length]), [['who.signIn', 7], ['who.timeOut', 6], ['who.signOut', 5]]);
  const kh = read('public/new-text-data.js');
  for (const key of ['consent.procedure.text', 'consent.anaesthesia.text', 'consent.transfusion.text', 'consent.refusal.text', 'who.identity', 'form.print']) assert.match(kh, new RegExp(`"${key.replace(/\./g, '\\.')}":`), key);
  const source = read('public/periop-forms.js');
  // Controls either carry data-emr-transient or use the shared field attributes that do.
  assert.match(source, /const attrs = `id="\$\{id\}" data-periop-field="\$\{field\.name\}" data-emr-transient/);
  for (const control of source.match(/<(input|select|textarea)\b[^>]*>/g) || []) assert.match(control, /data-emr-transient|\$\{attrs\}/, control);
  assert.match(source, /data-periop-print/);
  assert.match(source, /window\.BorkeoFingerprintScanner/);
  assert.match(read('server/server.mjs'), /periop-forms\.js\?v=\d+/);
});
