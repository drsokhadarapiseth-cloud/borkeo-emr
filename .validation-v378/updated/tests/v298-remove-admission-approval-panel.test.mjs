import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

test('v29.8 release version consistency across package.json, login.html, and server.mjs', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.match(pkg.version, /^(29\.[89]|30\.\d+)\./);

    const serverCode = fs.readFileSync(path.join(rootDir, 'server', 'server.mjs'), 'utf8');
    assert.match(serverCode, /Borkeo EMR v(29\.[89]|30\.\d+)/);

    const loginHtml = fs.readFileSync(path.join(rootDir, 'public', 'login.html'), 'utf8');
    assert.match(loginHtml, /v(29\.[89]|30\.\d+)/);
});

test('v29.8 admission approval panel is removed from registration screen and print admission form remains intact', () => {
    const emrPath = path.join(rootDir, 'protected', 'EMR.html');
    const emrHtml = fs.readFileSync(emrPath, 'utf8');

    // 1. In protected/EMR.html, ensure #print-admission exists and contains the official header and form
    const printAdmIdx = emrHtml.indexOf('id="print-admission"');
    assert.ok(printAdmIdx !== -1, '#print-admission should exist');
    const printAdmSnippet = emrHtml.slice(printAdmIdx, printAdmIdx + 5000);
    assert.match(printAdmSnippet, /ព្រះរាជាណាចក្រកម្ពុជា/);
    assert.match(printAdmSnippet, /លិខិតអនុញ្ញាតចូលសម្រាកពេទ្យ/);

    // 2. In public/emr-patient-record.js, ensureAdmissionApprovalPanel removes any existing panel and does not inject it
    const jsPath = path.join(rootDir, 'public', 'emr-patient-record.js');
    const jsContent = fs.readFileSync(jsPath, 'utf8');

    assert.ok(!jsContent.includes("panel.innerHTML = '<h3>IPD Admission Approval</h3>"), 'IPD Admission Approval panel injection should be removed');
    assert.ok(jsContent.includes('function ensureAdmissionApprovalPanel()'), 'function ensureAdmissionApprovalPanel exists');
});
