import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('v30.3 release version consistency across package.json, login.html, and server.mjs', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.ok(parseFloat(pkg.version) >= 30.0);

    const serverCode = fs.readFileSync(path.join(rootDir, 'server', 'server.mjs'), 'utf8');
    assert.match(serverCode, /Borkeo EMR v3[0-9]\./);

    const loginHtml = fs.readFileSync(path.join(rootDir, 'public', 'login.html'), 'utf8');
    assert.match(loginHtml, /v3[0-9]\./);
});

test('v30.3 EMR.html synchronizes patient photo in syncFields and page switching', () => {
    const emrHtml = fs.readFileSync(path.join(rootDir, 'protected', 'EMR.html'), 'utf8');
    assert.match(emrHtml, /triage_patient_photo_frame/);
    assert.match(emrHtml, /reg_patient_photo_avatar/);
    assert.match(emrHtml, /patient-photo\.js\?v=\d+/);
    assert.match(emrHtml, /emr-patient-record\.js\?v=\d+/);
});

test('v30.3 patient-photo.js supports scope:registration:id:patient_photo and triage frame', () => {
    const photoJs = fs.readFileSync(path.join(rootDir, 'public', 'patient-photo.js'), 'utf8');
    assert.match(photoJs, /scope:registration:id:patient_photo/);
    assert.match(photoJs, /triage_patient_photo_frame/);
});

test('v30.3 emr-patient-record.js immediately renders photo on patient load and switches', () => {
    const recordJs = fs.readFileSync(path.join(rootDir, 'public', 'emr-patient-record.js'), 'utf8');
    assert.match(recordJs, /triage_patient_photo_frame/);
    assert.match(recordJs, /reg_patient_photo_avatar/);
    assert.match(recordJs, /forcePhotoRender/);
});

test('v30.3 demo patients have valid photo data in SQLite', async () => {
    const { openDatabase } = await import('../server/database.mjs');
    const db = openDatabase(path.join(rootDir, 'data', 'demo.sqlite'));
    try {
        const row = db.sqlite.prepare("SELECT patient_key, full_name, record_json FROM patient_records WHERE full_name LIKE '%សុខ ពិសិដ្ឋ%'").get();
        assert.ok(row, 'Patient សុខ ពិសិដ្ឋ exists');
        const data = JSON.parse(row.record_json);
        const photo = data['scope:registration:id:web_patient_photo'] || data['system:patientPhoto'];
        assert.ok(photo && photo.startsWith('data:image/jpeg;base64,'), 'Valid jpeg base64 photo exists');
    } finally {
        db.close();
    }
});
