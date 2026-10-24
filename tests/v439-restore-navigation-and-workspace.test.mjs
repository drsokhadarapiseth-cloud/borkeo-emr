import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = path.resolve('.');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('v43.9: Navigation tabs (.step-wrapper) and header (.dashboard-header) are preserved in EMR.html', () => {
  const emrHtml = read('protected/EMR.html');

  // Verify that neither step-wrapper nor dashboard-header is suppressed
  assert.ok(
    !emrHtml.includes('html.registration-user .step-wrapper'),
    'EMR.html must not hide .step-wrapper for registration user'
  );
  assert.ok(
    !emrHtml.includes('html.registration-user .dashboard-header'),
    'EMR.html must not hide .dashboard-header for registration user'
  );
  assert.ok(
    !emrHtml.includes('html.on-registration-page #emr-consultation-workspace'),
    'EMR.html must not suppress consultation workspace on registration page'
  );
});

test('v43.9: isRegistrationUser in patient-banner and workspace does not flag non-registration users on page 1', () => {
  const bannerJs = read('public/patient-banner.js');
  const workspaceJs = read('public/emr-consultation-workspace.js');

  // Make sure on-registration-page is not inside isRegistrationUser
  assert.ok(
    !bannerJs.includes("classList.contains('on-registration-page')"),
    'patient-banner.js must not classify any user on page 1 as registration user'
  );
  assert.ok(
    !workspaceJs.includes("classList.contains('on-registration-page')"),
    'emr-consultation-workspace.js must not classify any user on page 1 as registration user'
  );
});

test('v43.9: emr-permissions unhides step-wrapper and clinical panels for clinical and admin roles', () => {
  const permissionsJs = read('public/emr-permissions.js');

  assert.ok(
    permissionsJs.includes("hide(document.querySelector('.step-wrapper'),false)"),
    'emr-permissions.js must unhide step-wrapper for DOCTOR and ADMIN'
  );
  assert.ok(
    permissionsJs.includes("hide(document.getElementById('emr-consultation-workspace'),false)"),
    'emr-permissions.js must unhide consultation workspace for DOCTOR and ADMIN'
  );
});
