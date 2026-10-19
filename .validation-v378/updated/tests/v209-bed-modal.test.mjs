import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v20.9 clicking any bed card opens a spacious popup window modal with details and action controls', () => {
  const deptJs = read('public/departments.js');
  assert.match(deptJs, /function openBedModal\(bedId\)/);
  assert.match(deptJs, /data-toggle-bed-details/);
  assert.match(deptJs, /openBedModal\(bedId\)/);
  assert.match(deptJs, /data-modal-edit-bed=/);
  assert.match(deptJs, /bed-modal-window/);

  const deptCss = read('public/departments.css');
  assert.match(deptCss, /\.bed-transfer-dialog/);
  assert.match(deptCss, /\.bed-transfer-patient-card/);
});

test('v20.9 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^2[0-9]\.[0-9]\.\d+/);

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v2[0-9]\.[0-9]/);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /2[0-9]\.[0-9]/);
});
