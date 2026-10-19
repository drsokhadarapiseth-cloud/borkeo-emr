import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('v29.6 release version consistency across package.json, login.html, and server.mjs', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.strictEqual(pkg.version, '29.6.0');

    const serverCode = fs.readFileSync(path.join(rootDir, 'server', 'server.mjs'), 'utf8');
    assert.match(serverCode, /Borkeo EMR v29\.6/);

    const loginHtml = fs.readFileSync(path.join(rootDir, 'public', 'login.html'), 'utf8');
    assert.match(loginHtml, /v29\.6/);
});

test('v29.6 Patient Information section is unified and renamed in protected/EMR.html', () => {
    const emrPath = path.join(rootDir, 'protected', 'EMR.html');
    const emrHtml = fs.readFileSync(emrPath, 'utf8');

    // 1. Translation dictionary translates sec_patient to "Patient Information"
    assert.match(emrHtml, /sec_patient:\s*["']Patient Information["']/);

    // 2. Separate System Details section is no longer present in #web-admission
    const webAdmIdx = emrHtml.indexOf('id="web-admission"');
    assert.ok(webAdmIdx !== -1, '#web-admission should exist');
    const webAdmSnippet = emrHtml.slice(webAdmIdx, webAdmIdx + 15000);

    // Must NOT contain a separate modern-section for sec_system
    assert.doesNotMatch(webAdmSnippet, /<div class="modern-section">\s*<h3 data-key="sec_system">/);

    // Must have the unified modern-section for sec_patient
    assert.match(webAdmSnippet, /<h3 data-key="sec_patient"[^>]*>ព័ត៌មានអ្នកជំងឺ<\/h3>/);

    // 3. Avatar photo trigger is at the top left of the Patient Information section
    assert.match(webAdmSnippet, /id="reg_patient_photo_avatar"/);
    assert.match(webAdmSnippet, /id="web_patient_photo"/);

    // 4. Combined fields from System Details are present within the patient registration layout
    assert.match(webAdmSnippet, /id="web_adm_no"/);
    assert.match(webAdmSnippet, /id="web_date"/);
    assert.match(webAdmSnippet, /id="web_time"/);
    assert.match(webAdmSnippet, /id="web_entry_type"/);
    assert.match(webAdmSnippet, /name="emr_pmrs_case_type"/);
    assert.match(webAdmSnippet, /id="web_nssf"/);
    assert.match(webAdmSnippet, /id="web_equity"/);

    // 5. Patient personal identification fields are present alongside photo
    assert.match(webAdmSnippet, /id="web_health_id"/);
    assert.match(webAdmSnippet, /id="web_last_name"/);
    assert.match(webAdmSnippet, /id="web_first_name"/);
    assert.match(webAdmSnippet, /id="web_dob"/);
    assert.match(webAdmSnippet, /id="web_age"/);
    assert.match(webAdmSnippet, /name="sex_radio"/);
    assert.match(webAdmSnippet, /id="web_phone"/);
});
