/**
 * Test Suite: v43.4 Clean Registration View (Suppression of Clinical Top Sections)
 * Ensures that for registration users and registration views, clinical summary banners,
 * chart tabs, summary cards, and breadcrumbs are not displayed.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('v43.4: setupChartTabs suppresses chart tabs and summary panel for registration users', () => {
  const bannerJs = read('public/patient-banner.js');
  assert.match(bannerJs, /setupChartTabs\s*\([^)]*\)\s*\{[^}]*isRegistrationUser\(\)/,
    'setupChartTabs must check isRegistrationUser() and exit without creating chart tabs');
});

test('v43.4: patient-banner.js includes isRegistrationUser helper and prevents rendering on registration', () => {
  const bannerJs = read('public/patient-banner.js');
  assert.match(bannerJs, /function\s+isRegistrationUser\s*\(/, 'patient-banner.js must define isRegistrationUser');
  assert.match(bannerJs, /if\s*\(\s*isRegistrationUser\(\)\s*\)\s*\{\s*const\s+banner/, 'renderPatientBanner must return early and remove banner for registration users');
  assert.match(bannerJs, /if\s*\(\s*isRegistrationUser\(\)\s*\)\s*\{\s*const\s+tabsContainer/, 'setupChartTabs must return early and remove tabs/summary for registration users');
});

test('v43.4: patient-banner.css contains display: none !important suppression rules for registration', () => {
  const bannerCss = read('public/patient-banner.css');
  assert.ok(bannerCss.includes('html.registration-user #emr-persistent-patient-banner'), 'patient-banner.css must suppress banner for registration-user');
  assert.ok(bannerCss.includes('html.registration-user #emr-chart-tabs-wrapper'), 'patient-banner.css must suppress chart tabs for registration-user');
  assert.ok(bannerCss.includes('html.registration-user #emr-summary-dashboard-panel'), 'patient-banner.css must suppress summary cards for registration-user');
  assert.ok(bannerCss.includes('html.registration-user .emr-breadcrumbs-container'), 'patient-banner.css must suppress breadcrumbs for registration-user');
  assert.ok(bannerCss.includes('html.on-registration-page #emr-persistent-patient-banner'), 'patient-banner.css must suppress banner on registration page');
});

test('v43.4: EMR.html includes early routing script and style rules for registration user', () => {
  const emrHtml = read('protected/EMR.html');
  assert.match(emrHtml, /directView\s*===\s*'register'/, 'EMR.html must detect register directView');
  assert.match(emrHtml, /role\s*===\s*'REGISTRATION'/, 'EMR.html must detect REGISTRATION role in early script');
  assert.ok(emrHtml.includes('html.registration-user #emr-persistent-patient-banner'), 'EMR.html must have style suppressing banner for registration user');
  assert.ok(emrHtml.includes('html.on-registration-page #emr-persistent-patient-banner'), 'EMR.html must have style suppressing banner on registration page');
  assert.match(emrHtml, /document\.documentElement\.classList\.(add|remove)\('on-registration-page'\)/, 'switchPage must toggle on-registration-page class');
});

test('v43.4: app-shell.js and emr-consultation-workspace.js suppress breadcrumbs and workspace for registration', () => {
  const appShellJs = read('public/app-shell.js');
  const wsJs = read('public/emr-consultation-workspace.js');

  assert.match(appShellJs, /isRegisterUser/, 'app-shell.js must check isRegisterUser before rendering breadcrumbs');
  assert.match(wsJs, /function\s+isRegistrationUser\s*\(/, 'emr-consultation-workspace.js must define isRegistrationUser');
  assert.match(wsJs, /if\s*\(\s*isRegistrationUser\(\)\s*\)\s*return\s*false;/, 'isConsultationActive must return false for registration users');
});
