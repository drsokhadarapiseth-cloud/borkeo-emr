import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v20.8 internal room and bed transfer dialog replaces editBedNumber for occupied beds', () => {
  const deptJs = read('public/departments.js');
  assert.match(deptJs, /function openBedTransferDialog\(item\)/);
  assert.match(deptJs, /if \(item\.bed\.patientKey\) \{\s*openBedTransferDialog\(item\);\s*return;\s*\}/);
  assert.match(deptJs, /transferBedTitle:\s*'ផ្លាស់ប្តូរបន្ទប់ និងគ្រែអ្នកជំងឺ'/);
  assert.match(deptJs, /transferBedTitle:\s*'Transfer Patient Room & Bed'/);
  assert.match(deptJs, /targetRoom:\s*'បន្ទប់គោលដៅ'/);
  assert.match(deptJs, /targetBed:\s*'គ្រែគោលដៅ'/);
  assert.match(deptJs, /transferConfirm:\s*'ប្តូរគ្រែ'/);

  const deptCss = read('public/departments.css');
  assert.match(deptCss, /\.bed-transfer-dialog/);
  assert.match(deptCss, /\.bed-transfer-patient-card/);
  assert.match(deptCss, /\.bed-transfer-selection-card/);
  assert.match(deptCss, /\.dialog-select/);
});

test('v20.8 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^2[0-9]\.[0-9]\.\d+/);

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v2[0-9]\.[0-9]/);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /2[0-9]\.[0-9]/);
});
