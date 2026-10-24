import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();
const read = f => fs.readFileSync(path.join(rootDir, f), 'utf8');

function loadStudio() {
  const code = read('public/patient-card-print.js');
  const sandbox = { window: {}, document: {} };
  vm.runInNewContext(code, sandbox);
  return sandbox.window.patientCardPrintStudio;
}


test('EMR.html card_label_count is an editable number input (1-10) with updated cache tags', () => {
  const emrHtml = read('protected/EMR.html');

  // Input control for sticker count
  assert.match(emrHtml, /<input\s+type="number"\s+id="card_label_count"\s+class="card-tool-input"\s+value="10"\s+min="1"\s+max="10"\s+step="1"/);
  assert.match(emrHtml, /for="card_label_count">ចំនួនស្លាក:/);

  // Cache busting version ?v=3530
  assert.match(emrHtml, /\/public\/patient-card-print\.css\?v=3530/);
  assert.match(emrHtml, /\/public\/patient-card-print\.js\?v=\d+/);
});

test('patient-card-print.js normalizeConfig supports editable count (1 to 10)', () => {
  const studio = loadStudio();

  // Default count is 10 for A5
  const def = studio.normalizeConfig({ currentType: 'a5_sheet' });
  assert.equal(def.count, 10);

  // Custom count: 4
  const four = studio.normalizeConfig({ currentType: 'a5_sheet', count: 4 });
  assert.equal(four.count, 4);

  // Custom count: 2
  const two = studio.normalizeConfig({ currentType: 'a5_sheet', count: 2 });
  assert.equal(two.count, 2);

  // Clamping: max 10, min 1
  const over = studio.normalizeConfig({ currentType: 'a5_sheet', count: 25 });
  assert.equal(over.count, 10);

  const under = studio.normalizeConfig({ currentType: 'a5_sheet', count: -5 });
  assert.equal(under.count, 1);

  // Thermal roll is always 1
  const thermal = studio.normalizeConfig({ currentType: 'thermal_80x35', count: 8 });
  assert.equal(thermal.count, 1);
});

test('layout reports the user-configured count while preserving full grid geometry', () => {
  const studio = loadStudio();
  const cfg = studio.normalizeConfig({ currentType: 'a5_sheet', count: 6 });
  const p = studio.layout(cfg);

  assert.equal(p.count, 6);
  assert.equal(p.maxCount, 10);
  assert.equal(p.columns, 2);
  assert.equal(p.rows, 5);
  assert.equal(p.valid, true);
});
