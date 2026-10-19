import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('d:/EMR/Borkeo_EMR_v20.3/Borkeo_EMR_v20.3');

test('v28.4 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
  assert.ok(/^28\.[4-9]\./.test(pkg.version));

  const loginHtml = fs.readFileSync(path.join(projectRoot, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /class="login-build-version"[^>]*>v28\.[4-9]<\/span>/);

  const serverMjs = fs.readFileSync(path.join(projectRoot, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /^\/\/ Borkeo EMR v28\.[4-9] - Electronic Medical Record System/m);
});

test('v28.4 admission form contains វេលាចូល row and doctor signature placed below គ្រូពេទ្យព្យាបាល', () => {
  const emrHtml = fs.readFileSync(path.join(projectRoot, 'protected/EMR.html'), 'utf8');
  assert.match(emrHtml, /វេលាចូល ៖/);
  assert.match(emrHtml, /id="print_adm_time_day"/);
  assert.match(emrHtml, /id="print_adm_time_month"/);
  assert.match(emrHtml, /id="print_adm_time_year"/);
  assert.match(emrHtml, /id="print_adm_time_hour"/);

  // Check signature below គ្រូពេទ្យព្យាបាល:
  const docColMatch = emrHtml.match(/data-key="attending_doc"[^>]*>គ្រូពេទ្យព្យាបាល<\/span>[\s\S]*?id="adm-doctor-esign"/);
  assert.ok(docColMatch, 'adm-doctor-esign must be placed below attending_doc');

  // Check ថ្ងៃទី...ខែ...ឆ្នាំ... in signature columns:
  assert.match(emrHtml, /id="print_adm_dir_day"/);
  assert.match(emrHtml, /id="print_adm_doc_day"/);
});

test('v28.4 notification messages standardized to Khmer template across server.mjs', () => {
  const serverMjs = fs.readFileSync(path.join(projectRoot, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /អ្នកជំងឺឈ្មោះ \$\{patientName\} ត្រូវបានបញ្ជូនពីផ្នែកពិគ្រោះក្រៅមកផ្នែក \$\{targetWardKh\} សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ/);
  assert.match(serverMjs, /អ្នកជំងឺឈ្មោះ \$\{name\} ត្រូវបានបញ្ជូនពីផ្នែកទ្រីយ៉ាមកផ្នែក \$\{targetDept\.replace/);
  assert.match(serverMjs, /អ្នកជំងឺឈ្មោះ \$\{pName\} ត្រូវបានបញ្ជូនពីផ្នែក \$\{fromDeptKh\.replace/);
  assert.match(serverMjs, /មកមន្ទីរពិសោធន៍ សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ/);
  assert.match(serverMjs, /មកផ្នែករូបភាពវេជ្ជសាស្ត្រ សូមពិនិត្យមើល និងរៀបចំជូនអ្នកជំងឺ/);
});

test('v28.4 messages.js displays important message body directly without bold subject header', () => {
  const messagesJs = fs.readFileSync(path.join(projectRoot, 'public/messages.js'), 'utf8');
  assert.match(messagesJs, /class="emr-message-body-text"/);
  assert.doesNotMatch(messagesJs, /<strong>\$\{esc\(cleanWardText\(m\.subject/);
});

test('v28.4 requests.js renders clean structured Triage, OPD, and Admission forms', () => {
  const requestsJs = fs.readFileSync(path.join(projectRoot, 'public/requests.js'), 'utf8');
  assert.match(requestsJs, /function renderTriageDoc/);
  assert.match(requestsJs, /function renderOpdDoc/);
  assert.match(requestsJs, /function renderAdmissionDoc/);
  assert.match(requestsJs, /ទម្រង់វាយតម្លៃអ្នកជំងឺដំបូង \(ទ្រីយ៉ា\)/);
  assert.match(requestsJs, /សំណុំបែបបទស្តីពីការពិនិត្យជំងឺក្រៅ \(OPD Form\)/);
  assert.match(requestsJs, /លិខិតអនុញ្ញាតចូលសម្រាកពេទ្យ/);
  assert.match(requestsJs, /បើកកំណត់ត្រា EMR ពេញលេញ ➔/);
});
