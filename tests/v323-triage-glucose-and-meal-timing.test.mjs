import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();


test('v32.3 protected/EMR.html splits respiratory cell to include optional glucose and meal choices', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  // Respiratory rate keeps required star
  assert.match(emrHtml, /<span data-key="v_resp">ចង្វាក់ដង្ហើម<\/span>\s*<span\s+class="required-star" aria-hidden="true">\*<\/span>/);
  assert.ok(emrHtml.includes('id="p2_resp"'), 'Must have p2_resp input');

  // Blood glucose does NOT have required-star
  assert.match(emrHtml, /<span data-key="v_glucose">កម្រិតជាតិស្ករ<\/span>\s*<input[^>]+id="p2_glucose"/);
  assert.doesNotMatch(emrHtml, /<span data-key="v_glucose">កម្រិតជាតិស្ករ<\/span>\s*<span class="required-star"/, 'Glucose must NOT have asterisk');

  // Blood glucose has data-emr-no-auto-index and mg/dL
  assert.match(emrHtml, /id="p2_glucose"[^>]+data-emr-no-auto-index/);
  assert.ok(emrHtml.includes('mg/dL'), 'Must display mg/dL unit');

  // Two choice selection: មុនបាយ and ក្រោយបាយ
  assert.ok(emrHtml.includes('id="p2_glucose_before_meal"'), 'Must have p2_glucose_before_meal radio');
  assert.ok(emrHtml.includes('id="p2_glucose_after_meal"'), 'Must have p2_glucose_after_meal radio');
  assert.match(emrHtml, /មុនបាយ/);
  assert.match(emrHtml, /ក្រោយបាយ/);

  // Radio toggle logic
  assert.ok(emrHtml.includes("p2_glucose_timing") && emrHtml.includes("_wasChecked"), 'Must have radio deselect logic');
});

test('v32.3 server.mjs captures bloodGlucose and glucoseTiming in triage response', () => {
  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');

  assert.ok(serverMjs.includes("bloodGlucose: read('scope:triage:id:p2_glucose'"), 'Server must read bloodGlucose');
  assert.ok(serverMjs.includes("glucoseTiming: read('scope:triage:id:p2_glucose_before_meal'"), 'Server must compute glucoseTiming');
  assert.ok(serverMjs.includes("glucose: cleanSummaryText(read('scope:triage:id:p2_glucose')"), 'Admission vitals must include glucose');
});

test('v32.3 emr-language-data.js includes glucose and meal timing pairs', () => {
  const langJs = fs.readFileSync(path.join(root, 'public', 'emr-language-data.js'), 'utf8');

  assert.ok(langJs.includes('["កម្រិតជាតិស្ករ","Blood Glucose"]'), 'Must translate blood glucose');
  assert.ok(langJs.includes('["មុនបាយ","Before meal"]'), 'Must translate before meal');
  assert.ok(langJs.includes('["ក្រោយបាយ","After meal"]'), 'Must translate after meal');
});
