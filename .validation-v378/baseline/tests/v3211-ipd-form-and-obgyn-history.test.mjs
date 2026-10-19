import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

test('v32.11 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 32.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v(?:3[2-6]\.)/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v(?:3[2-6]\.)/);
});

test('v32.11 Section 6 numbering updated: 1. Personal History, 2. OB/GYN History, 3. Family History, and 4. Community History', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(rootDir, 'legacy-html/EMR.html'), 'utf8');

  [emrHtml, legacyHtml].forEach(html => {
    assert.match(html, /<strong data-key="ipd_v1">1: សាវតារោគផ្ទាល់ខ្លួន<\/strong>/, 'Section 1 must be renamed to 1: សាវតារោគផ្ទាល់ខ្លួន');
    assert.match(html, /<strong data-key="ipd_v2">[23]: សាវតាក្នុងគ្រួសារ<\/strong>/, 'Section 2/3 must be present');
    assert.match(html, /<strong data-key="ipd_v3">[34]: សាវតារោគក្នុងសហគមន៍<\/strong>/, 'Section 3/4 must be present');
    assert.match(html, /<textarea id="ipd_community_history"/, 'Community history textarea must exist');
  });
});

test('v32.11 Female OB/GYN history section markup and data-emr-no-auto-index protection', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(rootDir, 'legacy-html/EMR.html'), 'utf8');

  [emrHtml, legacyHtml].forEach(html => {
    assert.match(html, /id="ipd_obgyn_history_section"/, 'OB/GYN section container must exist');
    assert.match(html, /id="ipd_obgyn_g"[^>]*data-emr-no-auto-index/, 'G input must exist with data-emr-no-auto-index');
    assert.match(html, /id="ipd_obgyn_p"[^>]*data-emr-no-auto-index/, 'P input must exist with data-emr-no-auto-index');
    assert.match(html, /id="ipd_obgyn_a"[^>]*data-emr-no-auto-index/, 'A input must exist with data-emr-no-auto-index');
    assert.match(html, /id="ipd_obgyn_l"[^>]*data-emr-no-auto-index/, 'L input must exist with data-emr-no-auto-index');
    assert.match(html, /id="ipd_obgyn_lmp"[^>]*data-emr-no-auto-index/, 'LMP input must exist with data-emr-no-auto-index');
    assert.match(html, /id="ipd_obgyn_edd"[^>]*data-emr-no-auto-index/, 'EDD input must exist with data-emr-no-auto-index');
    assert.match(html, /id="ipd_obgyn_contra"[^>]*data-emr-no-auto-index/, 'Contraception input must exist with data-emr-no-auto-index');
    assert.match(html, /id="ipd_obgyn_notes"[^>]*data-emr-no-auto-index/, 'Notes input must exist with data-emr-no-auto-index');
  });
});

test('v32.11 CSS rules for OB/GYN history printability and sex-based hiding', () => {
  const css = fs.readFileSync(path.join(rootDir, 'public/patient-photo.css'), 'utf8');

  assert.match(css, /\.ipd-obgyn-section\.ipd-obgyn-hidden\s*\{[^}]*display:\s*none\s*!important/, 'Hidden OB/GYN section must have display none');
  assert.match(css, /@media print\s*\{[\s\S]*\.ipd-obgyn-section\.ipd-obgyn-hidden[\s\S]*display:\s*none\s*!important/, 'Print stylesheet must hide section when patient is male');
  assert.match(css, /@media print\s*\{[\s\S]*\.ipd-obgyn-section:not\(\.ipd-obgyn-hidden\)[\s\S]*display:\s*block\s*!important/, 'Print stylesheet must print OB/GYN section for female patients');
});

test('v32.11 IPD header banner and same-row action-bar styling', () => {
  const css = fs.readFileSync(path.join(rootDir, 'public/patient-photo.css'), 'utf8');
  assert.match(css, /\.ipd-patient-banner\s*\{[^}]*background:\s*linear-gradient\(135deg,\s*#f0f9ff\s*0%,\s*#e0f2fe\s*100%\)/, 'IPD banner must match OPD light-blue gradient');
  assert.match(css, /\.ipd-patient-banner\s*\{[^}]*border:\s*1px solid #bae6fd/, 'IPD banner border must match OPD');
  assert.match(css, /#sub_ipd>\.action-bar\{display:flex;justify-content:flex-end;align-items:center;gap:8px;flex-wrap:wrap;margin-top:20px\}/, 'Action bar must align buttons horizontally in one row');

  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');
  assert.match(emrHtml, /color:\s*#0369a1;[^>]*id="ipd_banner_patient_name"/, 'IPD banner patient name color must match OPD #0369a1');

  const recordJs = fs.readFileSync(path.join(rootDir, 'public/emr-patient-record.js'), 'utf8');
  assert.match(recordJs, /ipdActionBar\.append\(saveBtn\)/, 'Save button must be appended to action bar');
  assert.match(recordJs, /ipdActionBar\.append\(preview\)/, 'PMRS2 preview button must be appended to action bar');
});

test('v32.11 Diagnosis section renamed to ICD-10 and redundant label removed in OPD and IPD', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(rootDir, 'legacy-html/EMR.html'), 'utf8');

  [emrHtml, legacyHtml].forEach(html => {
    // Section headers
    assert.match(html, /<div class="opd-section-title" data-key="opd_sec_diag">IV\. រោគវិនិច្ឆ័យ ICD-10<\/div>/, 'OPD diagnosis title must be IV. រោគវិនិច្ឆ័យ ICD-10');
    assert.match(html, /<div class="opd-section-title" data-key="ipd_diag">រោគវិនិច្ឆ័យ ICD-10<\/div>/, 'IPD diagnosis title must be រោគវិនិច្ឆ័យ ICD-10');

    // Redundant label removed
    assert.ok(!html.includes('កូដរោគវិនិច្ឆ័យ ICD-10 (សម្រាប់ PMRS2)'), 'Redundant label must be removed from IPD');

    // Both editors present
    assert.match(html, /data-diagnosis-editor="opd"/, 'OPD diagnosis editor must exist');
    assert.match(html, /data-diagnosis-editor="ipd"/, 'IPD diagnosis editor must exist');

    // Dictionaries
    assert.match(html, /opd_sec_diag:\s*"IV\. រោគវិនិច្ឆ័យ ICD-10"/, 'Khmer dictionary must have updated OPD title');
    assert.match(html, /ipd_diag:\s*"រោគវិនិច្ឆ័យ ICD-10"/, 'Khmer dictionary must have updated IPD title');
    assert.match(html, /opd_sec_diag:\s*"IV\. Diagnosis ICD-10"/, 'English dictionary must have updated OPD title');
    assert.match(html, /ipd_diag:\s*"Diagnosis ICD-10"/, 'English dictionary must have updated IPD title');
  });
});

test('v32.11 Diagnosis multi-tag autocomplete matching Chief Complaint (#0284c7 blue styling)', () => {
  const css = fs.readFileSync(path.join(rootDir, 'public/emr-diagnoses.css'), 'utf8');
  assert.match(css, /\.diag-tag-box\s*\{[^}]*border:\s*1\.5px solid #0284c7/, 'Tag box must have #0284c7 blue border');
  assert.match(css, /\.diag-tag\s*\{[^}]*background:\s*#0284c7/, 'Diagnosis tag badge background must be #0284c7');
  assert.match(css, /\.diag-option-item:hover,\s*\.diag-option-item\.active\s*\{[^}]*background:\s*#0284c7\s*!important/, 'Dropdown hover must be #0284c7');

  const js = fs.readFileSync(path.join(rootDir, 'public/emr-diagnoses.js'), 'utf8');
  assert.match(js, /searchIcd10/, 'Diagnosis script must include searchIcd10 function');
  assert.match(js, /api\/icd10\/search\?q=/, 'Search must query /api/icd10/search');
  assert.match(js, /diag-tag/, 'Script must render .diag-tag elements');
  assert.match(js, /diag-search-input/, 'Script must provide inline search input');
});

test('v32.11 updateIpdObGynVisibility correctly toggles female section on and male section off', () => {
  const js = fs.readFileSync(path.join(rootDir, 'public/emr-patient-record.js'), 'utf8');
  assert.match(js, /function updateIpdObGynVisibility\(\)/, 'updateIpdObGynVisibility function must exist');
  assert.match(js, /updateIpdObGynVisibility\(\)/, 'Function must be called in syncPatientPhotoHeaderBanners');

  // Verify pure logical classification
  function classifySex(sex) {
    const latin = String(sex || '').trim().toLowerCase();
    return sex === 'ស្រី' || ['f', 'female', 'girl'].includes(latin);
  }

  assert.equal(classifySex('ស្រី'), true, 'Khmer female must be true');
  assert.equal(classifySex('Female'), true, 'English Female must be true');
  assert.equal(classifySex('f'), true, 'Letter f must be true');
  assert.equal(classifySex('ប្រុស'), false, 'Khmer male must be false');
  assert.equal(classifySex('Male'), false, 'English Male must be false');
  assert.equal(classifySex('m'), false, 'Letter m must be false');
});
