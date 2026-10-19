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
  assert.match(patientListHtml, /href="\/public\/patient-list\.css\?v=\d+"/);
  assert.match(patientListHtml, /src="\/public\/patient-list\.js\?v=\d+"/);
});

