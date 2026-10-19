import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v20.6 requests page uses pure Khmer defaults, supports dynamic bilingual translation, and standardizes toolbar buttons', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^2[0-9]\.[0-9]\.\d+/);

  const requestsHtml = read('protected/requests.html');
  assert.doesNotMatch(requestsHtml, /data-language-exclude/);
  assert.doesNotMatch(requestsHtml, /\/\s*Requests\s*&/i);
  assert.doesNotMatch(requestsHtml, /\/\s*Status/i);
  assert.doesNotMatch(requestsHtml, /\/\s*Refresh/i);
  assert.doesNotMatch(requestsHtml, /\/\s*Search/i);
  assert.doesNotMatch(requestsHtml, /\/\s*Pending/i);
  assert.doesNotMatch(requestsHtml, /\/\s*Approved/i);
  assert.doesNotMatch(requestsHtml, /\/\s*Cancel/i);
  assert.doesNotMatch(requestsHtml, /\/\s*New fee request/i);
  assert.doesNotMatch(requestsHtml, /\/\s*Correction feedback/i);
  assert.doesNotMatch(requestsHtml, /\/\s*Fee concession request/i);
  assert.match(requestsHtml, /<button id="request-refresh" type="button">ទាញឡើងវិញ<\/button>/);
  assert.match(requestsHtml, /<button id="request-new" type="button">ស្នើសុំលើកលែងសេវា<\/button>/);

  const requestsJs = read('public/requests.js');
  assert.doesNotMatch(requestsJs, /លិខិតអនុញ្ញាតសម្រាកពេទ្យ \/ Patient Admission Form/);
  assert.doesNotMatch(requestsJs, /រង់ចាំ \/ Pending/);
  assert.doesNotMatch(requestsJs, /មើល \/ View/);
  assert.doesNotMatch(requestsJs, /មិនមានសំណើ \/ No requests/);
  assert.doesNotMatch(requestsJs, /អនុម័ត និងចុះហត្ថលេខា \/ Approve & Sign/);
  assert.match(requestsJs, /titles=\{ADMISSION:'លិខិតអនុញ្ញាតសម្រាកពេទ្យ',DISCHARGE:'លិខិតចេញពីមន្ទីរពេទ្យ',MEDICINE:'បណ្ណស្នើសុំឱសថ',FEE:'ស្នើសុំលើកលែងសេវា'\}/);
  assert.match(requestsJs, /statuses=\{PENDING:'រង់ចាំ',APPROVED:'អនុម័ត',REJECTED:'បដិសេធ',APPLIED:'បានអនុវត្ត',PREPARING:'កំពុងរៀបចំ'\}/);

  const requestsCss = read('public/requests.css');
  assert.match(requestsCss, /\.request-toolbar.*display:flex/);
  assert.match(requestsCss, /\.request-toolbar.*align-items:flex-end/);

  const langData = read('public/emr-language-data.js');
  assert.match(langData, /\["ការស្នើសុំ","Requests & Approvals"\]/);
  assert.match(langData, /\["លិខិតអនុញ្ញាតសម្រាកពេទ្យ","Patient Admission Form"\]/);
  assert.match(langData, /\["ស្នើសុំលើកលែងសេវា","Fee Concession Request"\]/);
  assert.match(langData, /\["ទាញឡើងវិញ","Refresh"\]/);

  const langJs = read('public/emr-language.js');
  assert.match(langJs, /\["ការស្នើសុំ", "Requests & Approvals"\]/);
  assert.match(langJs, /\["លិខិតអនុញ្ញាតសម្រាកពេទ្យ", "Patient Admission Form"\]/);
  assert.match(langJs, /\["ស្នើសុំលើកលែងសេវា", "Fee Concession Request"\]/);
});
