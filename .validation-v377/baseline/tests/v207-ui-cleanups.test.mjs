import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v20.7 patient list ID displays as plain text without rectangle border while keeping click functionality', () => {
  const sessionCss = read('public/emr-session.css');
  assert.match(sessionCss, /\.patient-id-link\{display:inline-block;max-width:100%;padding:0;border:0;background:transparent;color:#087dff;/);
  assert.doesNotMatch(sessionCss, /\.patient-id-link\{display:inline-flex;align-items:center;max-width:100%;padding:4px 7px;border:1px solid #b9d9e5/);

  const patientListJs = read('public/patient-list.js');
  assert.match(patientListJs, /data-new-record=/);
});

test('v20.7 triage page removes duplicate lower counter dropdown and tv display link, relying on top navigation', () => {
  const triageHtml = read('protected/triage.html');
  assert.doesNotMatch(triageHtml, /<select id="triage-counter">/);
  assert.doesNotMatch(triageHtml, /<a class="tv-display-tab"/);

  const triageJs = read('public/triage.js');
  assert.match(triageJs, /function getCounter\(\)/);
  assert.doesNotMatch(triageJs, /\$\('triage-counter'\)\.value/);
});

test('v20.7 room and bed management uses រក្សាទុក, displays full patient name with dynamic sizing, and cleans mixed language slashes', () => {
  const deptHtml = read('protected/departments.html');
  assert.match(deptHtml, /<button type="button" class="button success" id="save-map-button" data-i18n="saveMap">រក្សាទុក<\/button>/);
  assert.doesNotMatch(deptHtml, /រក្សាទុកផែនទី/);

  const deptJs = read('public/departments.js');
  assert.match(deptJs, /saveMap:\s*'រក្សាទុក'/);
  assert.match(deptJs, /saveMap:\s*'Save'/);
  assert.doesNotMatch(deptJs, /កែបន្ទប់ \/ Edit room/);
  assert.doesNotMatch(deptJs, /កែលេខគ្រែ \/ Edit number/);
  assert.doesNotMatch(deptJs, /បន្ថែមបន្ទប់ \/ Add room/);
  assert.doesNotMatch(deptJs, /ចំនួនគ្រែ \/ Number of beds/);
  assert.doesNotMatch(deptJs, /យល់ព្រម \/ Save room/);
  assert.doesNotMatch(deptJs, /បោះបង់ \/ Cancel/);
  assert.match(deptJs, /const fontSizeStyle = pName\.length > 18/);

  const deptCss = read('public/departments.css');
  assert.match(deptCss, /\.bed-summary \.bed-patient\{display:block!important;margin:4px 0 0;min-width:0;white-space:nowrap;overflow:visible;/);
});

test('v20.7 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^2[0-9]\.[0-9]\.\d+/);

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v2[0-9]\.[0-9]/);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /2[0-9]\.[0-9]/);
});
