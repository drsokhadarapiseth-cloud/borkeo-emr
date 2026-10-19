import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v21.1 patient list ID button has explicit inline style reset and cache-busted assets', () => {
  const patientListJs = read('public/patient-list.js');
  assert.match(patientListJs, /class="patient-id-link"\s*style="border:0!important;outline:0!important;background:transparent!important;padding:0!important;box-shadow:none!important;color:#087dff!important;font:inherit!important;font-weight:700!important;cursor:pointer;text-decoration:none!important;"/);

  const patientListHtml = read('protected/patient-list.html');
  assert.match(patientListHtml, /href="\/public\/patient-list\.css\?v=1770"/);
  assert.match(patientListHtml, /src="\/public\/patient-list\.js\?v=3090"/);
});

test('v21.1 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^2[0-9]\./);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /2[0-9]\./);
});
