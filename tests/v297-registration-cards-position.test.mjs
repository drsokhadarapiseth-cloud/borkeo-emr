import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');


test('v29.7 Patient Information cards placement below Case Number in protected/EMR.html', () => {
    const emrPath = path.join(rootDir, 'protected', 'EMR.html');
    const emrHtml = fs.readFileSync(emrPath, 'utf8');

    // 1. Translation dictionary translates sec_patient to "Patient Information"
    assert.match(emrHtml, /sec_patient:\s*["']Patient Information["']/);

    // 2. Separate System Details section is no longer present in #web-admission
    const webAdmIdx = emrHtml.indexOf('id="web-admission"');
    assert.ok(webAdmIdx !== -1, '#web-admission should exist');
    const webAdmSnippet = emrHtml.slice(webAdmIdx, webAdmIdx + 15000);

    // Must have the unified modern-section for sec_patient
    assert.match(webAdmSnippet, /<h3 data-key="sec_patient"[^>]*>ព័ត៌មានអ្នកជំងឺ<\/h3>/);

    // 3. Avatar photo trigger is at the top left of the Patient Information section
    assert.match(webAdmSnippet, /id="reg_patient_photo_avatar"/);
    assert.match(webAdmSnippet, /id="web_patient_photo"/);

    // 4. Verify ordering: web_adm_no -> web_equity & web_nssf -> other_id -> web_last_name & web_first_name
    const admNoPos = webAdmSnippet.indexOf('id="web_adm_no"');
    const healthIdPos = webAdmSnippet.indexOf('id="web_health_id"');
    const equityPos = webAdmSnippet.indexOf('id="web_equity"');
    const nssfPos = webAdmSnippet.indexOf('id="web_nssf"');
    const otherIdPos = webAdmSnippet.indexOf('name="other_id"');
    const lastNamePos = webAdmSnippet.indexOf('id="web_last_name"');
    const firstNamePos = webAdmSnippet.indexOf('id="web_first_name"');

    assert.ok(admNoPos !== -1, 'web_adm_no exists');
    assert.ok(healthIdPos !== -1, 'web_health_id exists');
    assert.ok(equityPos !== -1, 'web_equity exists');
    assert.ok(nssfPos !== -1, 'web_nssf exists');
    assert.ok(otherIdPos !== -1, 'other_id exists');
    assert.ok(lastNamePos !== -1, 'web_last_name exists');
    assert.ok(firstNamePos !== -1, 'web_first_name exists');

    // Assert cards are positioned below Case Number & Health ID and before Names
    assert.ok(admNoPos < equityPos, 'web_adm_no is before web_equity');
    assert.ok(admNoPos < nssfPos, 'web_adm_no is before web_nssf');
    assert.ok(equityPos < otherIdPos, 'web_equity is before other_id');
    assert.ok(nssfPos < otherIdPos, 'web_nssf is before other_id');
    assert.ok(otherIdPos < lastNamePos, 'other_id is before web_last_name');
    assert.ok(otherIdPos < firstNamePos, 'other_id is before web_first_name');
});
