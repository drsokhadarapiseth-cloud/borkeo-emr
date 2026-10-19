import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

test('v36.6 - Version metadata consistency across package.json, login.html, server.mjs and templates', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(['36.6.0', '36.7.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v36\.[67]/);

  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v36\.[67]/);

  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('/public/emr-permissions.js?v=3660') || emrHtml.includes('/public/emr-permissions.js?v=3670'));
  assert.ok(emrHtml.includes('/public/emr-patient-record.js?v=3660') || emrHtml.includes('/public/emr-patient-record.js?v=3670'));

  const patientListHtml = fs.readFileSync(path.join(ROOT, 'protected', 'patient-list.html'), 'utf8');
  assert.ok(patientListHtml.includes('/public/patient-list.js?v=3660') || patientListHtml.includes('/public/patient-list.js?v=3670'));

  const triageHtml = fs.readFileSync(path.join(ROOT, 'protected', 'triage.html'), 'utf8');
  assert.ok(triageHtml.includes('/public/patient-list.js?v=3660') || triageHtml.includes('/public/patient-list.js?v=3670'));
});

test('v36.6 - Triage dropdown includes Eye Care Service and Infectious Ward with accurate HEF codes', () => {
  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), 'utf8');

  for (const html of [emrHtml, legacyHtml]) {
    assert.match(html, /<option value="eyecare" data-key="opt_eyecare" data-hef-code="RH-OPDSpec">មណ្ឌលថែទាំភ្នែក<\/option>/);
    assert.match(html, /<option value="infectious" data-key="opt_infectious" data-hef-code="RH-IPDGen">ផ្នែកជំងឺឆ្លង<\/option>/);
    assert.ok(html.includes('opt_eyecare: "មណ្ឌលថែទាំភ្នែក"'));
    assert.ok(html.includes('opt_infectious: "ផ្នែកជំងឺឆ្លង"'));
  }

  const js = fs.readFileSync(path.join(ROOT, 'public', 'emr-patient-record.js'), 'utf8');
  assert.ok(js.includes("eyecare: { code: 'eyecare', kh: 'មណ្ឌលថែទាំភ្នែក', en: 'Eye Care Service', mode: 'opd', module: 'general', hefCode: 'RH-OPDSpec' }"));
  assert.ok(js.includes("infectious: { code: 'infectious', kh: 'ផ្នែកជំងឺឆ្លង', en: 'Infectious Diseases Ward', mode: 'ipd', hefCode: 'RH-IPDGen' }"));
  assert.ok(js.includes("'eyecare'].includes(otherDept)"));
  assert.ok(js.includes("otherDept === 'infectious'"));
});

test('v36.6 - Patient photo workflow: camera badge hidden, frames are pointer-clickable, triage frame triggers modal', () => {
  const photoCss = fs.readFileSync(path.join(ROOT, 'public', 'patient-photo.css'), 'utf8');
  assert.ok(photoCss.includes('.photo-retake-camera-badge { display: none !important; }'));
  assert.ok(photoCss.includes('.triage-patient-photo-frame'));
  assert.ok(photoCss.includes('cursor: pointer !important;'));

  const photoJs = fs.readFileSync(path.join(ROOT, 'public', 'patient-photo.js'), 'utf8');
  assert.ok(photoJs.includes('.triage-patient-photo-frame, #triage_patient_photo_frame'));
  assert.ok(photoJs.includes("frame.setAttribute('data-action', 'capture-patient-photo');"));
  assert.ok(photoJs.includes("new URLSearchParams(location.search).get('patient')"));
});
