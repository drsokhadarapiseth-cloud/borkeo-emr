import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('v29.9 release version consistency across package.json, login.html, and server.mjs', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.match(pkg.version, /^(29\.9|30\.\d+)\./);

    const serverCode = fs.readFileSync(path.join(rootDir, 'server', 'server.mjs'), 'utf8');
    assert.match(serverCode, /Borkeo EMR v(29\.9|30\.\d+)/);

    const loginHtml = fs.readFileSync(path.join(rootDir, 'public', 'login.html'), 'utf8');
    assert.match(loginHtml, /v(29\.9|30\.\d+)/);
});

test('v29.9 triage form table header is renamed to កាលបរិច្ឆេទចុះឈ្មោះ and entry date below name is removed', () => {
    const triageHtml = fs.readFileSync(path.join(rootDir, 'protected', 'triage.html'), 'utf8');
    assert.match(triageHtml, /<th>កាលបរិច្ឆេទចុះឈ្មោះ<\/th>/);
    assert.doesNotMatch(triageHtml, /<th>ពេលចុះឈ្មោះ<\/th>/);

    const triageJs = fs.readFileSync(path.join(rootDir, 'public', 'triage.js'), 'utf8');
    assert.ok(triageJs.includes('<td class="patient-cell"><strong>${esc(p.fullName||\'—\')}</strong></td>'));
    assert.ok(!triageJs.includes('<small>${esc(p.entryDate||\'\')}</small>'));
});

test('v29.9 thirty triage-ready patients module clears previous data and seeds 30 clean patients', async () => {
    const { openDatabase } = await import('../server/database.mjs');
    const { resetAndSeedThirtyTriagePatients, thirtyProfiles } = await import('../scripts/seed-v299-thirty-triage-patients.mjs');
    
    assert.strictEqual(thirtyProfiles.length, 30);
    const db = openDatabase(':memory:');
    try {
        const result = resetAndSeedThirtyTriagePatients(db);
        assert.strictEqual(result.count, 30);
        
        const count = db.sqlite.prepare('SELECT count(*) as c FROM patient_records').get().c;
        assert.strictEqual(count, 30);

        // Verify patients have no assigned ward yet
        const unassignedWards = db.sqlite.prepare("SELECT count(*) as c FROM patient_records WHERE department_code = '' AND service_mode = ''").get().c;
        assert.strictEqual(unassignedWards, 30);

        // Verify patients have vital signs recorded
        const sampleRow = db.sqlite.prepare('SELECT record_json FROM patient_records LIMIT 1').get();
        const sampleData = JSON.parse(sampleRow.record_json);
        assert.ok(sampleData['scope:triage:id:p2_temp'], 'Has temperature');
        assert.ok(sampleData['scope:triage:id:p2_bp_sys'], 'Has blood pressure');
        assert.ok(sampleData['scope:triage:id:p2_pulse'], 'Has pulse');
        assert.ok(sampleData['scope:triage:id:p2_spo2'], 'Has SpO2');
    } finally {
        db.close();
    }
});
