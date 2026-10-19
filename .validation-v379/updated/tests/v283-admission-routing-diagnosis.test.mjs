import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('d:/EMR/Borkeo_EMR_v20.3/Borkeo_EMR_v20.3');

test('v28.3 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.ok(/^28\.[3-9]\./.test(pkg.version));

  const loginHtml = fs.readFileSync(path.join(projectRoot, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /class="login-build-version"[^>]*>v28\.[3-9]<\/span>/);

  const serverMjs = fs.readFileSync(path.join(projectRoot, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /^\/\/ Borkeo EMR v28\.[3-9] - Electronic Medical Record System/m);
});

test('v28.3 admission form contains date display slots in both director and doctor columns', () => {
  const emrHtml = fs.readFileSync(path.join(projectRoot, 'protected/EMR.html'), 'utf8');
  assert.match(emrHtml, /id="print_adm_date_director"/);
  assert.match(emrHtml, /id="print_adm_date_doctor"/);
  assert.match(emrHtml, /function syncAdmissionDates\(\)/);
});

test('v28.3 OPD form provides transfer to ward dropdown control', () => {
  const emrHtml = fs.readFileSync(path.join(projectRoot, 'protected/EMR.html'), 'utf8');
  assert.match(emrHtml, /id="web_opd_transfer_ward"/);
  assert.match(emrHtml, /onchange="syncAdmissionReferralWard\(\)"/);
  assert.match(emrHtml, /value="ជំងឺទូទៅ"/);
  assert.match(emrHtml, /value="វះកាត់"/);
  assert.match(emrHtml, /value="ផ្នែកជំងឺកុមារ"/);
  assert.match(emrHtml, /value="ផ្នែកសម្ភព"/);
});

test('v28.3 syncAdmissionReferralWard excludes dept_opd and prioritizes OPD transfer ward', () => {
  const emrHtml = fs.readFileSync(path.join(projectRoot, 'protected/EMR.html'), 'utf8');
  assert.match(emrHtml, /function syncAdmissionReferralWard\(\)/);
  assert.match(emrHtml, /if\s*\(\s*key\s*===\s*['"]dept_opd['"]\s*\)\s*\{\s*\/\/[^\n]*\s*return;\s*\}/);
  assert.match(emrHtml, /document\.getElementById\(['"]web_opd_transfer_ward['"]\)/);
});

test('v28.3 syncAdmissionDiagnosis comprehensively inspects primary OPD diagnosis and syncs dates and ward', () => {
  const emrHtml = fs.readFileSync(path.join(projectRoot, 'protected/EMR.html'), 'utf8');
  assert.match(emrHtml, /function syncAdmissionDiagnosis\(\)/);
  assert.match(emrHtml, /syncAdmissionDates\(\);/);
  assert.match(emrHtml, /syncAdmissionReferralWard\(\);/);
  assert.match(emrHtml, /getPrimaryDiagnosis\(kind\)/);
});

test('v28.3 emr-diagnoses.js triggers window.syncAdmissionDiagnosis', () => {
  const emrDiagJs = fs.readFileSync(path.join(projectRoot, 'public/emr-diagnoses.js'), 'utf8');
  assert.match(emrDiagJs, /window\.syncAdmissionDiagnosis\?\.?\(\)/);
});
