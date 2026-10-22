// v41.7 - Phase 10: record view log (open / print / export / document view)
// and scanned documents attached to the patient record.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';
import { documentKind, listRecordAccess, logRecordAccess } from '../server/record-access.mjs';
import { roleCanPage } from '../server/access.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const port = 34417;
const origin = `http://127.0.0.1:${port}`;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const PDF = Buffer.from('%PDF-1.4\n% synthetic test file\n%%EOF\n', 'latin1');

function patient(app, key) {
  const userId = app.database.sqlite.prepare("SELECT id FROM users WHERE username='doctor_medicine'").get().id;
  app.database.upsertPatient({
    id: crypto.randomUUID(), patientKey: key, userId, savedAt: Date.now(),
    summary: { caseNumber: key.slice(5), healthId: '', firstName: 'Synthetic', lastName: 'Patient', fullName: 'Synthetic Patient', sex: 'Male', age: '60', dateOfBirth: '', phone: '', equityCard: '', paymentType: 'EXEMPT', departmentCode: 'medicine', departmentNameKh: '', departmentNameEn: 'Medicine', serviceMode: 'ipd', entryDate: '2026-10-18', dischargeDate: '' },
    data: {},
  });
}

async function login(username) {
  const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
  const cookie = response.headers.get('set-cookie').split(';')[0];
  const me = await (await fetch(origin + '/api/auth/me', { headers: { Cookie: cookie } })).json();
  return { Cookie: cookie, Origin: origin, 'X-CSRF-Token': me.csrfToken };
}

test('v41.7 record view log and scanned documents through the API', async () => {
  const app = createEmrServer({ demoMode: true, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
  try {
    await new Promise((resolve, reject) => { app.server.once('error', reject); app.server.listen(port, '127.0.0.1', resolve); });
    patient(app, 'case:V417');
    const doctor = await login('doctor_medicine');
    const admin = await login('admin');
    const imaging = await login('imaging');
    const log = () => app.database.sqlite.prepare("SELECT action, detail, username, ip_address FROM record_access_log WHERE patient_key='case:V417' ORDER BY occurred_at").all();

    // Opening the record is logged once (repeat opens within 2 minutes are one entry).
    assert.equal((await fetch(`${origin}/api/patient-record?patientKey=case:V417`, { headers: doctor })).status, 200);
    assert.equal((await fetch(`${origin}/api/patient-record?patientKey=case:V417`, { headers: doctor })).status, 200);
    assert.deepEqual(log().map((e) => [e.action, e.detail, e.username]), [['open', 'record', 'doctor_medicine']]);
    assert.ok(log()[0].ip_address, 'IP is kept');

    // Printing is reported by the page.
    const print = await fetch(`${origin}/api/record-access-log`, { method: 'POST', headers: { ...doctor, 'Content-Type': 'application/json' }, body: JSON.stringify({ patientKey: 'case:V417', action: 'print', detail: 'Discharge summary' }) });
    assert.equal(print.status, 201);
    assert.equal((await fetch(`${origin}/api/record-access-log`, { method: 'POST', headers: { ...doctor, 'Content-Type': 'application/json' }, body: JSON.stringify({ patientKey: 'case:V417', action: 'delete' }) })).status, 400);
    assert.equal((await fetch(`${origin}/api/record-access-log`, { method: 'POST', headers: { ...doctor, 'Content-Type': 'application/json' }, body: JSON.stringify({ patientKey: 'case:NOPE', action: 'print' }) })).status, 404);

    // Viewer: management only, filterable.
    assert.equal((await fetch(`${origin}/api/record-access-log`, { headers: doctor })).status, 403);
    const all = await (await fetch(`${origin}/api/record-access-log?patient=V417`, { headers: admin })).json();
    assert.deepEqual(all.entries.map((e) => e.action), ['print', 'open']);
    const prints = await (await fetch(`${origin}/api/record-access-log?patient=V417&action=print&user=doctor`, { headers: admin })).json();
    assert.deepEqual(prints.entries.map((e) => [e.action, e.detail, e.role]), [['print', 'Discharge summary', 'DOCTOR']]);
    assert.equal((await (await fetch(`${origin}/api/record-access-log?patient=V417&to=2020-01-01`, { headers: admin })).json()).entries.length, 0);

    // Scanned documents: type checked by content, size limited, access controlled.
    const upload = (headers, bytes, type, title = 'Referral letter') => fetch(`${origin}/api/patient-documents?patientKey=case:V417&title=${encodeURIComponent(title)}&category=referral`, {
      method: 'POST', headers: { ...headers, 'Content-Type': type, 'X-File-Name': encodeURIComponent('référence lettre.png') }, body: bytes });
    assert.equal((await upload(doctor, Buffer.from('MZ not a document'), 'image/png')).status, 415, 'content is checked');
    assert.equal((await upload(doctor, PDF, 'image/png')).status, 415, 'declared type must match the content');
    assert.equal((await upload(doctor, Buffer.concat([PNG, Buffer.alloc(10 * 1024 * 1024)]), 'image/png')).status, 413);
    assert.equal((await upload(doctor, PNG, 'image/png', '')).status, 400, 'title required');
    assert.equal((await upload(imaging, PNG, 'image/png')).status, 403);
    const created = await upload(doctor, PNG, 'image/png');
    assert.equal(created.status, 201, await created.clone().text());
    const document = (await created.json()).document;
    assert.equal(document.contentType, 'image/png');
    assert.equal(document.filename, 'référence lettre.png');
    assert.equal((await upload(doctor, PDF, 'application/pdf', 'Old lab result')).status, 201);

    assert.equal((await fetch(`${origin}/api/patient-documents?patientKey=case:V417`, { headers: imaging })).status, 403);
    const listed = await (await fetch(`${origin}/api/patient-documents?patientKey=case:V417`, { headers: doctor })).json();
    assert.equal(listed.documents.length, 2);
    assert.equal(listed.canUpload, true);

    const file = await fetch(`${origin}/api/patient-documents/${document.id}/file`, { headers: doctor });
    assert.equal(file.status, 200);
    assert.equal(file.headers.get('content-type').split(';')[0], 'image/png');
    assert.ok(Buffer.from(await file.arrayBuffer()).equals(PNG));
    assert.equal((await fetch(`${origin}/api/patient-documents/${document.id}/file`, { headers: imaging })).status, 403);
    assert.ok(log().some((e) => e.action === 'document' && e.detail.includes('Referral letter')), 'document view is logged');

    // Remove keeps the file and the row, needs a reason.
    const remove = (body) => fetch(`${origin}/api/patient-documents/${document.id}/remove`, { method: 'POST', headers: { ...doctor, 'Content-Type': 'application/json' }, body: JSON.stringify({ patientKey: 'case:V417', ...body }) });
    assert.equal((await remove({ reason: '' })).status, 400);
    const removed = await remove({ reason: 'Wrong patient' });
    assert.equal(removed.status, 200);
    const row = (await removed.json()).documents.find((d) => d.id === document.id);
    assert.equal(row.removeReason, 'Wrong patient');
    assert.ok(row.removedAt);
    assert.ok(fs.existsSync(app.database.sqlite.prepare('SELECT storage_path FROM patient_documents WHERE id=?').get(document.id).storage_path), 'the file is kept');
    assert.equal((await remove({ reason: 'again' })).status, 404);

    const audits = app.database.sqlite.prepare("SELECT action FROM audit_events WHERE action LIKE 'PATIENT_DOCUMENT_%' ORDER BY rowid").all().map((a) => a.action);
    assert.deepEqual(audits, ['PATIENT_DOCUMENT_UPLOADED', 'PATIENT_DOCUMENT_UPLOADED', 'PATIENT_DOCUMENT_VIEWED', 'PATIENT_DOCUMENT_REMOVED']);
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
  }
});

test('file type check and open-log repeat rule', () => {
  assert.equal(documentKind(PNG, 'image/png').extension, '.png');
  assert.equal(documentKind(PDF, '').type, 'application/pdf');
  assert.equal(documentKind(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0]), 'image/jpeg').extension, '.jpg');
  assert.equal(documentKind(Buffer.from('GIF89a'), 'image/gif'), null);
  assert.equal(documentKind(PNG, 'application/pdf'), null);

  const rows = [];
  const database = { sqlite: { prepare: (sql) => ({
    get: (key, user, detail, since) => rows.find((r) => r.key === key && r.user === user && r.detail === detail && r.at > since),
    run: (...args) => rows.push({ key: args[1], user: args[3], action: args[8], detail: args[9], at: args[12] }),
  }) } };
  const entry = (action, now) => logRecordAccess(database, { session: { user_id: 'u1' }, patient: { patient_key: 'case:X' }, action, detail: 'record', now });
  assert.equal(entry('open', 1_000_000), true);
  assert.equal(entry('open', 1_060_000), false, 'within 2 minutes');
  assert.equal(entry('open', 1_000_000 + 121_000), true, 'after 2 minutes');
  assert.equal(entry('print', 1_000_001), true, 'prints are always kept');
  assert.equal(entry('delete', 1_000_002), false);
  assert.equal(rows.length, 3);
  assert.equal(typeof listRecordAccess, 'function');
});

test('viewer page, navigation and page wiring', () => {
  for (const role of ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR']) assert.equal(roleCanPage(role, '/admin/record-log'), true, role);
  for (const role of ['DOCTOR', 'NURSE', 'REGISTRATION', 'CASHIER']) assert.equal(roleCanPage(role, '/admin/record-log'), false, role);
  const page = read('protected/record-log.html');
  assert.match(page, /<h1>កំណត់ត្រាអ្នកបើកមើលឯកសារ<\/h1>/);
  assert.doesNotMatch(page, /<script>(?!<\/script>)/, 'no inline script');
  assert.match(read('public/nav-config.js'), /id: 'admin-record-log'[^\n]*href: '\/admin\/record-log'/);
  const server = read('server/server.mjs');
  assert.match(server, /patient-documents\.js\?v=4170/);
  assert.match(read('public/report-print.js'), /window\.logRecordAccess\?\.\('print', title\)/);
  const banner = read('public/patient-banner.js');
  assert.match(banner, /window\.logRecordAccess = /);
  assert.match(banner, /addEventListener\('beforeprint'/);
  const documents = read('public/patient-documents.js');
  assert.match(documents, /'ភ្ជាប់ឯកសារស្កេន'/);
  assert.ok((documents.match(/<input|<select/g) || []).every(Boolean));
  assert.equal((documents.match(/<(input|select)\b(?![^>]*data-emr-transient)/g) || []).length, 0, 'document controls are never saved with the record');
});
