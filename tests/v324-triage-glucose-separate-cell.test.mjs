import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();


test('v32.4 protected/EMR.html separates respiratory rate and blood glucose into distinct table cells', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  // Verify respiratory rate is in its own cell without glucose inside it
  const respCellMatch = emrHtml.match(/<td[^>]*>\s*<span data-key="v_resp">ចង្វាក់ដង្ហើម<\/span>[\s\S]*?<\/td>/);
  assert.ok(respCellMatch, 'Respiratory rate must be inside a td');
  assert.ok(!respCellMatch[0].includes('v_glucose'), 'Respiratory rate cell must NOT contain blood glucose');
  assert.ok(respCellMatch[0].includes('id="p2_resp"'), 'Respiratory rate cell must have id p2_resp');

  // Verify blood glucose is in its own separate cell
  const glucoseCellMatch = emrHtml.match(/<td[^>]*>\s*<span data-key="v_glucose">កម្រិតជាតិស្ករ<\/span>[\s\S]*?<\/td>/);
  assert.ok(glucoseCellMatch, 'Blood glucose must be in its own separate td');
  assert.ok(!glucoseCellMatch[0].includes('v_resp'), 'Blood glucose cell must NOT contain respiratory rate');
  assert.ok(glucoseCellMatch[0].includes('id="p2_glucose"'), 'Blood glucose cell must contain id p2_glucose');
  assert.ok(!glucoseCellMatch[0].includes('required-star'), 'Blood glucose cell must NOT have required star');

  // Verify second row aligns with colspan="2"
  assert.match(emrHtml, /<td colspan="2"[^>]*>\s*<input type="checkbox" id="route_green_cb"/, 'Green route must have colspan="2"');
});

test('v32.4 server.mjs captures bloodGlucose and glucoseTiming in triage response', () => {
  const serverMjs = fs.readFileSync(path.join(root, 'server', 'server.mjs'), 'utf8');

  assert.ok(serverMjs.includes("bloodGlucose: read('scope:triage:id:p2_glucose'"), 'Server must read bloodGlucose');
  assert.ok(serverMjs.includes("glucoseTiming: read('scope:triage:id:p2_glucose_before_meal'"), 'Server must compute glucoseTiming');
});
