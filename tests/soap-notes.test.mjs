import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('Phase 5: SOAP note static assets exist and are registered in server.mjs', async () => {
  const css = read('public/soap-note.css');
  const js = read('public/soap-note.js');
  const serverCode = read('server/server.mjs');
  const pkg = JSON.parse(read('package.json'));

  // Version consistency
  assert.match(pkg.version, /^(?:39\.[4-9]|(?:[4-9][0-9]|[1-9][0-9]{2,})\.[0-9])\.0$/, 'package.json version must be 39.4.0 or above');
  assert.match(serverCode, /Borkeo EMR v(?:39\.[4-9]|(?:[4-9][0-9]|[1-9][0-9]{2,})\.[0-9])/, 'server.mjs must declare v39.4 or above');
  assert.match(serverCode, /'\/public\/soap-note\.css'/, 'server.mjs must register soap-note.css');
  assert.match(serverCode, /'\/public\/soap-note\.js'/, 'server.mjs must register soap-note.js');
  assert.match(serverCode, /soap-note\.css\?v=\d+/, 'server.mjs must inject soap-note.css');
  assert.match(serverCode, /soap-note\.js\?v=\d+/, 'server.mjs must inject soap-note.js');

  // CSS contains 4 colour families and IEC 62366-1 / WCAG 2.2 AA styling
  assert.match(css, /--soap-s-stripe:\s*#0284c7/, 'CSS must define Blue stripe for Subjective');
  assert.match(css, /--soap-o-stripe:\s*#16a34a/, 'CSS must define Green stripe for Objective');
  assert.match(css, /--soap-a-stripe:\s*#ea580c/, 'CSS must define Amber stripe for Assessment');
  assert.match(css, /--soap-p-stripe:\s*#9333ea/, 'CSS must define Purple stripe for Plan');
  assert.match(css, /\.emr-soap-container/, 'CSS must define 2x2 container');
  assert.match(css, /\.emr-soap-status-dot/, 'CSS must style status dots');
  assert.match(css, /\.emr-soap-chip/, 'CSS must style quick phrase chips');
  assert.match(css, /\.emr-legacy-note-badge/, 'CSS must style legacy note badge');
  assert.match(css, /@media print/, 'CSS must include clean A4 print styles');

  // JS exports EmrSoapNote controller and implements required methods
  assert.match(js, /global\.EmrSoapNote\s*=/, 'JS must expose EmrSoapNote global');
  assert.match(js, /pullLatestResults/, 'JS must implement pullLatestResults');
  assert.match(js, /copyFromPreviousNote/, 'JS must implement copyFromPreviousNote');
  assert.match(js, /renderCardGrid/, 'JS must implement renderCardGrid');
  assert.match(js, /validate/, 'JS must implement validation');
});

test('Phase 5: protected/EMR.html integrates 4-box SOAP layout and preserves backward compatibility', () => {
  const emrHtml = read('protected/EMR.html');

  // 4 SOAP textareas
  assert.match(emrHtml, /id="mon_soap_container"/, 'EMR.html must include mon_soap_container');
  assert.match(emrHtml, /id="mon_soap_s"/, 'EMR.html must include mon_soap_s textarea');
  assert.match(emrHtml, /id="mon_soap_o"/, 'EMR.html must include mon_soap_o textarea');
  assert.match(emrHtml, /id="mon_soap_a"/, 'EMR.html must include mon_soap_a textarea');
  assert.match(emrHtml, /id="mon_soap_p"/, 'EMR.html must include mon_soap_p textarea');

  // Hidden legacy inputs for test & consumer backward compatibility
  assert.match(emrHtml, /id="mon_input_evol"/, 'EMR.html must preserve id="mon_input_evol"');
  assert.match(emrHtml, /id="mon_input_conclusion"/, 'EMR.html must preserve id="mon_input_conclusion"');

  // ICD-10 and diagnosis list preserved in Assessment box
  assert.match(emrHtml, /id="mon_input_icd10"/, 'EMR.html must preserve mon_input_icd10 in Assessment');
  assert.match(emrHtml, /data-diagnosis-editor="followup"/, 'EMR.html must preserve follow-up diagnosis editor');

  // Action buttons
  assert.match(emrHtml, /id="mon_soap_btn_pull"/, 'EMR.html must include pull latest results button');
  assert.match(emrHtml, /id="mon_soap_btn_copy"/, 'EMR.html must include copy previous note button');

  // Daily monitoring save logic attaches additive soap structure
  assert.match(emrHtml, /soap:\s*soap/, 'saveDailyMonitoring must attach additive soap data to _monitoringCopyData');
  assert.match(emrHtml, /soapGridHtml/, 'saveDailyMonitoring must use soapGridHtml in card rendering');
});

test('Phase 5: Khmer-only default presentation in SOAP UI and documentation', () => {
  const js = read('public/soap-note.js');
  const emrHtml = read('protected/EMR.html');

  // v39.8: section titles are always English (hospital order); the Khmer
  // default now applies to the hints, which still follow the interface language.
  assert.match(js, /var SOAP_TITLES = \{ s: 'Subjective', o: 'Objective', a: 'Assessment', p: 'Plan' \};/, 'Titles must be fixed English clinical terms');
  assert.match(js, /អ្វីដែលអ្នកជំងឺរាយការណ៍ \(រោគសញ្ញា ប្រវត្តិជំងឺ\)/, 'S hint stays Khmer by default');
  assert.match(js, /សញ្ញាជីវិត ការពិនិត្យរាងកាយ និងលទ្ធផលវិភាគ/, 'O hint stays Khmer by default');
  assert.match(js, /រោគវិនិច្ឆ័យចម្បង លេខកូដ ICD-10 និងការវាយតម្លៃ/, 'A hint stays Khmer by default');
  assert.match(js, /ឱសថព្យាបាល ការបញ្ជាបន្ថែម និងការណែនាំ/, 'P hint stays Khmer by default');
  assert.match(js, /ចំណាំចាស់/, 'Legacy badge text must be ចំណាំចាស់');

  // No bilingual slash text in SOAP headings
  assert.doesNotMatch(emrHtml, /Subjective\s*\/\s*ពាក្យបណ្តឹង/, 'No bilingual slash for S');
  assert.doesNotMatch(emrHtml, /Objective\s*\/\s*ការពិនិត្យ/, 'No bilingual slash for O');
  assert.doesNotMatch(emrHtml, /Assessment\s*\/\s*ការវាយតម្លៃ/, 'No bilingual slash for A');
  assert.doesNotMatch(emrHtml, /Plan\s*\/\s*ផែនការ/, 'No bilingual slash for P');
});

test('Phase 5: Additive SOAP data model ensures 100% PMRS2 and legacy record compatibility', () => {
  const soapData = {
    dtVal: '2026-10-19T09:00',
    temp: '37.0',
    bp_sys: '120',
    bp_dia: '80',
    pulse: '75',
    resp: '18',
    spo2: '99',
    soap: {
      s: 'អ្នកជំងឺអស់កម្លាំង គ្មានក្តៅខ្លួន',
      o: 'សញ្ញាជីវិតធម្មតា ពោះទន់',
      a: 'ជំងឺរលាកក្រពះស្រួចស្រាវ',
      p: 'បន្តការព្យាបាលតាមវេជ្ជបញ្ជា'
    },
    evol: 'S: អ្នកជំងឺអស់កម្លាំង គ្មានក្តៅខ្លួន\nO: សញ្ញាជីវិតធម្មតា ពោះទន់',
    conclusion: 'A: ជំងឺរលាកក្រពះស្រួចស្រាវ\nP: បន្តការព្យាបាលតាមវេជ្ជបញ្ជា',
    icd10: 'K29.1',
    medications: []
  };

  // 1. SOAP fields exist additively
  assert.equal(soapData.soap.s, 'អ្នកជំងឺអស់កម្លាំង គ្មានក្តៅខ្លួន');
  assert.equal(soapData.soap.a, 'ជំងឺរលាកក្រពះស្រួចស្រាវ');

  // 2. Legacy evol and conclusion are populated for PMRS2 and server routines
  assert.ok(soapData.evol.includes('អ្នកជំងឺអស់កម្លាំង'));
  assert.ok(soapData.conclusion.includes('ជំងឺរលាកក្រពះស្រួចស្រាវ'));

  // 3. Serializing and deserializing JSON preserves both seamlessly
  const jsonStr = JSON.stringify([soapData]);
  const parsed = JSON.parse(jsonStr);
  assert.equal(parsed[0].soap.p, 'បន្តការព្យាបាលតាមវេជ្ជបញ្ជា');
  assert.equal(parsed[0].evol, soapData.evol);
  assert.equal(parsed[0].conclusion, soapData.conclusion);
});
