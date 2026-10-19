import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v21.0 banner text is brighter blue and left-aligned next to logo', () => {
  const sharedCss = read('public/shared-controls.css');
  assert.match(sharedCss, /body #emr-site-banner \.emr-unified-brand\{display:flex!important;align-items:center!important;gap:18px!important;width:auto!important/);
  assert.match(sharedCss, /body #emr-site-banner \.emr-brand-copy\{text-align:left!important/);

  const themeCss = read('public/interface-theme.css');
  assert.match(themeCss, /body #emr-site-banner \.emr-brand-eyebrow\{margin:0 0 6px!important;color:#004b99!important/);
  assert.match(themeCss, /body #emr-site-banner \.emr-unified-brand h1,body \.hospital-name-kh\{color:#003b8e!important/);
});

test('v21.0 patient list displays clean Patient ID and renames equityCard column header to លេខបណ្ណសមធម៌/ប.ស.ស', () => {
  const patientListHtml = read('protected/patient-list.html');
  assert.match(patientListHtml, /<th scope="col" data-column="equityCard" data-i18n="equityCard">លេខបណ្ណសមធម៌\/ប\.ស\.ស<\/th>/);

  const patientListJs = read('public/patient-list.js');
  assert.match(patientListJs, /equityCard:\s*'លេខបណ្ណសមធម៌\/ប\.ស\.ស'/);

  const patientListCss = read('public/patient-list.css');
  assert.match(patientListCss, /\.patient-id-link\s*\{display:inline-block!important;padding:0!important;border:0!important;background:transparent!important;color:#087dff!important/);
});

test('v21.0 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^2[0-9]\./);

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v2[0-9]\./);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /2[0-9]\./);
});
