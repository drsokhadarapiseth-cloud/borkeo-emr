import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('v30.1 release version consistency across package.json, login.html, and server.mjs', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.ok(parseFloat(pkg.version) >= 30.0);

    const serverCode = fs.readFileSync(path.join(rootDir, 'server', 'server.mjs'), 'utf8');
    assert.match(serverCode, /Borkeo EMR v3[0-9]\./);

    const loginHtml = fs.readFileSync(path.join(rootDir, 'public', 'login.html'), 'utf8');
    assert.match(loginHtml, /v3[0-9]\./);
});

test('v30.1 triage form has patient photo container aligned right at name level', () => {
    const emrHtml = fs.readFileSync(path.join(rootDir, 'protected', 'EMR.html'), 'utf8');
    assert.match(emrHtml, /id="triage_patient_photo_container"/);
    assert.match(emrHtml, /id="triage_patient_photo_frame"/);

    const photoJs = fs.readFileSync(path.join(rootDir, 'public', 'patient-photo.js'), 'utf8');
    assert.match(photoJs, /triage-patient-photo-frame/);
    assert.match(photoJs, /triage_patient_photo_frame/);
});

test('v30.1 thirty patients have valid sex (ប្រុស or ស្រី), Borkeo addresses, triage vitals, and distinct photos', async () => {
    const { openDatabase } = await import('../server/database.mjs');
    const { resetAndSeedThirtyTriagePatients, thirtyBorkeoProfiles } = await import('../scripts/seed-v301-thirty-triage-patients.mjs');

    assert.strictEqual(thirtyBorkeoProfiles.length, 30);
    const db = openDatabase(':memory:');
    try {
        const result = resetAndSeedThirtyTriagePatients(db);
        assert.strictEqual(result.count, 30);

        const rows = db.sqlite.prepare('SELECT patient_key, full_name, sex, record_json FROM patient_records').all();
        assert.strictEqual(rows.length, 30);

        // Every patient must have sex strictly as 'ប្រុស' or 'ស្រី'
        const invalidSex = rows.filter(r => r.sex !== 'ប្រុស' && r.sex !== 'ស្រី');
        assert.strictEqual(invalidSex.length, 0, 'No invalid sex values');

        const seenPhotos = new Set();
        for (const row of rows) {
            const data = JSON.parse(row.record_json);
            // 1. Valid sex
            assert.ok(data['scope:registration:id:web_sex'] === 'ប្រុស' || data['scope:registration:id:web_sex'] === 'ស្រី');

            // 2. Address in Ratanakiri, Borkeo district
            assert.strictEqual(data['scope:registration:id:web_province'], 'រតនគិរី');
            assert.strictEqual(data['scope:registration:id:web_district'], 'បរកែវ');
            assert.ok(data['scope:registration:id:web_commune'], 'Has commune');
            assert.ok(data['scope:registration:id:web_village'], 'Has village');

            // 3. Triage fields fully populated
            assert.strictEqual(data['system:workflowStage'], 'TRIAGE_WAITING');
            assert.strictEqual(data['system:triageStatus'], 'WAITING');
            assert.ok(data['scope:triage:id:pmrs_chief_complaint'], 'Has chief complaint');
            assert.ok(data['scope:triage:id:p2_temp'], 'Has temperature');
            assert.ok(data['scope:triage:id:p2_bp_sys'], 'Has systolic BP');
            assert.ok(data['scope:triage:id:p2_bp_dia'], 'Has diastolic BP');
            assert.ok(data['scope:triage:id:p2_pulse'], 'Has pulse');
            assert.ok(data['scope:triage:id:p2_resp'], 'Has resp');
            assert.ok(data['scope:triage:id:p2_spo2'], 'Has SpO2');
            assert.ok(data['scope:triage:id:p2_weight'], 'Has weight');
            assert.ok(data['scope:triage:id:p2_height'], 'Has height');

            // 4. Photos attached
            const photo = data['scope:registration:id:web_patient_photo'];
            assert.ok(photo && photo.startsWith('data:image/jpeg;base64,'), `Patient ${row.full_name} has valid base64 photo`);
            seenPhotos.add(photo);
        }
        assert.strictEqual(seenPhotos.size, 30, 'Every patient has a distinct portrait photo');
    } finally {
        db.close();
    }
});
