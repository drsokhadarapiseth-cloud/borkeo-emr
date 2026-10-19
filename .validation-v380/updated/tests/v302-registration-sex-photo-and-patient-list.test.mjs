import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('v30.2 release version consistency across package.json, login.html, and server.mjs', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.ok(parseFloat(pkg.version) >= 30.0);

    const serverCode = fs.readFileSync(path.join(rootDir, 'server', 'server.mjs'), 'utf8');
    assert.match(serverCode, /Borkeo EMR v3[0-9]\./);

    const loginHtml = fs.readFileSync(path.join(rootDir, 'public', 'login.html'), 'utf8');
    assert.match(loginHtml, /v3[0-9]\./);
});

test('v30.2 patient list table has no avatar image thumbnails', () => {
    const listJs = fs.readFileSync(path.join(rootDir, 'public', 'patient-list.js'), 'utf8');
    assert.doesNotMatch(listJs, /patient-list-avatar/);
    assert.doesNotMatch(listJs, /\$\{avatarHtml\}/);
    assert.match(listJs, /<td data-column="patientName"><span class="patient-primary">/);
});

test('v30.2 EMR.html has explicit sex radio IDs and loads patient-photo.js before emr-patient-record.js', () => {
    const emrHtml = fs.readFileSync(path.join(rootDir, 'protected', 'EMR.html'), 'utf8');
    assert.match(emrHtml, /id="web_sex_male"/);
    assert.match(emrHtml, /id="web_sex_female"/);

    const photoIdx = emrHtml.indexOf('/public/patient-photo.js');
    const recordIdx = emrHtml.indexOf('/public/emr-patient-record.js');
    assert.ok(photoIdx > 0, 'patient-photo.js is loaded');
    assert.ok(recordIdx > 0, 'emr-patient-record.js is loaded');
    assert.ok(photoIdx < recordIdx, 'patient-photo.js is loaded before emr-patient-record.js');
});

test('v30.2 patient-photo.js listens for emr:patient-loaded and updates avatar display', () => {
    const photoJs = fs.readFileSync(path.join(rootDir, 'public', 'patient-photo.js'), 'utf8');
    assert.match(photoJs, /emr:patient-loaded/);
    assert.match(photoJs, /window\.updatePatientPhotoDisplay/);
});

test('v30.2 emr-patient-record.js reliably restores sex and photo on patient load', () => {
    const recordJs = fs.readFileSync(path.join(rootDir, 'public', 'emr-patient-record.js'), 'utf8');
    assert.match(recordJs, /web_sex_male/);
    assert.match(recordJs, /web_sex_female/);
    assert.match(recordJs, /restorePatientSex/);
    assert.match(recordJs, /window\.updatePatientPhotoDisplay/);
});

test('v30.2 thirty patients in demo.sqlite have full age, sex, and photo data', async () => {
    const { openDatabase } = await import('../server/database.mjs');
    const db = openDatabase(path.join(rootDir, 'data', 'demo.sqlite'));
    try {
        const rows = db.sqlite.prepare("SELECT patient_key, full_name, sex, age, record_json FROM patient_records WHERE patient_key LIKE 'case:BK-20261016-%'").all();
        assert.strictEqual(rows.length, 30);
        for (const row of rows) {
            assert.ok(row.sex === 'ប្រុស' || row.sex === 'ស្រី', `${row.full_name} has valid sex`);
            assert.ok(row.age, `${row.full_name} has age`);
            const data = JSON.parse(row.record_json);
            assert.ok(data['scope:registration:id:web_sex'] === 'ប្រុស' || data['scope:registration:id:web_sex'] === 'ស្រី');
            assert.ok(data['scope:registration:id:web_patient_photo'], `${row.full_name} has photo`);
            assert.ok(data['scope:registration:id:web_age'], `${row.full_name} has web_age`);
        }
    } finally {
        db.close();
    }
});
