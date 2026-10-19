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

test('v30.3 protected/EMR.html has script cache busters and photo sync in syncFields & switchPage', () => {
    const emrHtml = fs.readFileSync(path.join(rootDir, 'protected', 'EMR.html'), 'utf8');
    assert.match(emrHtml, /patient-photo\.js\?v=\d+/);
    assert.match(emrHtml, /emr-patient-record\.js\?v=\d+/);

    // Verify syncFields includes triage_patient_photo_frame sync
    assert.match(emrHtml, /triage_patient_photo_frame/);
    assert.match(emrHtml, /window\.updatePatientPhotoDisplay/);
});

test('v30.3 public/emr-patient-record.js syncs photo to both registration avatar and triage frame', () => {
    const recordJs = fs.readFileSync(path.join(rootDir, 'public', 'emr-patient-record.js'), 'utf8');
    assert.match(recordJs, /syncPatientPhotoHeaderBanners/);
    assert.match(recordJs, /triage_patient_photo_frame/);
    assert.match(recordJs, /window\.updatePatientPhotoDisplay/);
});

test('v30.3 public/patient-photo.js updates both registration avatar and triage frame', () => {
    const photoJs = fs.readFileSync(path.join(rootDir, 'public', 'patient-photo.js'), 'utf8');
    assert.match(photoJs, /triage_patient_photo_frame/);
    assert.match(photoJs, /emr:patient-loaded/);
    assert.match(photoJs, /reg_patient_photo_avatar/);
});

test('v30.3 thirty patients in demo.sqlite have full age, sex, and valid Base64 JPEG photo data', async () => {
    const { openDatabase } = await import('../server/database.mjs');
    const db = openDatabase(path.join(rootDir, 'data', 'demo.sqlite'));
    try {
        const rows = db.sqlite.prepare("SELECT patient_key, full_name, sex, age, record_json FROM patient_records WHERE patient_key LIKE 'case:BK-20261016-%'").all();
        assert.strictEqual(rows.length, 30);

        for (const row of rows) {
            assert.ok(row.full_name && row.full_name.trim().length > 0, `Missing full_name for ${row.patient_key}`);
            assert.ok(row.sex === 'ប្រុស' || row.sex === 'ស្រី', `Invalid sex for ${row.patient_key}`);
            assert.ok(Number(row.age) > 0, `Invalid age for ${row.patient_key}`);

            const rec = JSON.parse(row.record_json);
            const photo = rec.photo || rec['scope:registration:id:web_patient_photo'] || rec['system:patientPhoto'];
            assert.ok(photo, `Missing photo in record_json for ${row.patient_key}`);
            assert.match(photo, /^data:image\/jpeg;base64,/);

            // Verify JPEG magic bytes
            const base64Data = photo.replace(/^data:image\/jpeg;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            assert.strictEqual(buffer[0], 0xff, 'JPEG marker start 0xff');
            assert.strictEqual(buffer[1], 0xd8, 'JPEG marker start 0xd8');
            assert.strictEqual(buffer[2], 0xff, 'JPEG marker start 0xff');
            assert.strictEqual(buffer[buffer.length - 2], 0xff, 'JPEG marker end 0xff');
            assert.strictEqual(buffer[buffer.length - 1], 0xd9, 'JPEG marker end 0xd9');
        }
    } finally {
        db.close();
    }
});
