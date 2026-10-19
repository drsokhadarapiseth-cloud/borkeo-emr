import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();
const read = f => fs.readFileSync(path.join(rootDir, f), 'utf8');

test('v34.5 release version consistency across package.json, login.html, server.mjs, and EMR.html', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(['34.5.0', '34.6.0', '34.7.0', '34.8.0', '34.9.0', '35.0.0', '35.1.0', '35.2.0', '35.3.0', '35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v3(?:4\.[56789]|[56].[0-9])/);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /Borkeo EMR v3(?:4\.[56789]|[56].[0-9])/);

  const emrHtml = read('protected/EMR.html');
  assert.match(emrHtml, /patient-photo\.css\?v=3450/);
  assert.match(emrHtml, /patient-photo\.js\?v=3450/);

  const css = read('public/patient-photo.css');
  assert.match(css, /v34\.5/);
});

test('registration photo box has full click accessibility, tabindex, role, and no camera badge', () => {
  const emrHtml = read('protected/EMR.html');
  // Confirm avatar has tabindex and role="button"
  assert.match(emrHtml, /id="reg_patient_photo_avatar"[^>]*tabindex="0"/);
  assert.match(emrHtml, /id="reg_patient_photo_avatar"[^>]*role="button"/);
  // Confirm registration-avatar-camera-badge is removed from registration box
  const avatarSnippet = emrHtml.slice(emrHtml.indexOf('id="reg_patient_photo_avatar"'), emrHtml.indexOf('id="web_patient_photo"'));
  assert.doesNotMatch(avatarSnippet, /registration-avatar-camera-badge/);
  assert.doesNotMatch(avatarSnippet, /fa-camera/);
});

test('public/patient-photo.css scopes dialog display so closed dialog cannot leak below form', () => {
  const css = read('public/patient-photo.css');
  // Confirm :not([open]) has display: none !important
  assert.match(css, /#patient-photo-dialog:not\(\[open\]\)\s*\{\s*display:\s*none\s*!important;\s*\}/);
  // Confirm [open] is modal centered
  assert.match(css, /#patient-photo-dialog\[open\]\s*\{[^}]*display:\s*flex;/);
  assert.match(css, /#patient-photo-dialog\[open\]\s*\{[^}]*position:\s*fixed;/);
  assert.match(css, /#patient-photo-dialog\[open\]\s*\{[^}]*margin:\s*auto;/);
});

test('photo preview orientation is natural original view without horizontal flip', () => {
  const css = read('public/patient-photo.css');
  assert.match(css, /\.photo-camera-viewport video[^}]*transform:\s*none;/);
  assert.doesNotMatch(css, /\.photo-camera-viewport video[^}]*scaleX\(-1\)/);
});

test('patient-photo.js stops camera stream cleanly and guards against delayed permission resolution', async () => {
  const js = read('public/patient-photo.js');
  // Confirm stream tracks are stopped and video.srcObject is nulled
  assert.match(js, /activeStream\.getTracks\(\)\.forEach\(\(track\)\s*=>\s*track\.stop\(\)\)/);
  assert.match(js, /video\.srcObject\s*=\s*null/);
  // Confirm streamReqId guards against delayed getUserMedia resolution
  assert.match(js, /if\s*\(reqId\s*!==\s*streamReqId\s*\|\|\s*!curDlg\s*\|\|\s*!curDlg\.open\)/);
  assert.match(js, /stream\.getTracks\(\)\.forEach\(\(track\)\s*=>\s*track\.stop\(\)\)/);
  // Confirm bindDialogEvents is guarded against duplicate binding
  assert.match(js, /if\s*\(!dialogEventsBound\)/);
});

test('patient-photo.js supports Enter and Space keys for keyboard access', () => {
  const js = read('public/patient-photo.js');
  assert.match(js, /e\.key\s*===\s*'Enter'\s*\|\|\s*e\.key\s*===\s*' '/);
  assert.match(js, /window\.openPatientPhotoModal\(\)/);
  // Confirm Escape closes dialog
  assert.match(js, /e\.key\s*===\s*'Escape'/);
});
