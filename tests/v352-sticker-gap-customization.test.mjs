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


test('EMR.html contains Gap X and Gap Y input controls with 2.5mm defaults and updated cache tags', () => {
  const emrHtml = read('protected/EMR.html');

  // Input controls for Gap X and Gap Y
  assert.match(emrHtml, /id="card_custom_gap_x"\s+class="card-tool-input"\s+value="2\.5"/);
  assert.match(emrHtml, /id="card_custom_gap_y"\s+class="card-tool-input"\s+value="2\.5"/);
  assert.match(emrHtml, /for="card_custom_gap_x">Gap X/);
  assert.match(emrHtml, /for="card_custom_gap_y">Gap Y/);

  // Cache busting version ?v=3520 or ?v=3530
  assert.match(emrHtml, /\/public\/patient-card-print\.css\?v=35[23]0/);
  assert.match(emrHtml, /\/public\/patient-card-print\.js\?v=35[23]0/);
});

test('patient-card-print.js normalizeConfig defaults to gapX 2.5 and gapY 2.5 with backward compatibility', () => {
  const studio = loadStudio();

  // Default config
  const def = studio.normalizeConfig();
  assert.equal(def.gapX, 2.5);
  assert.equal(def.gapY, 2.5);
  assert.equal(def.widthMm, 67);
  assert.equal(def.heightMm, 35);
  assert.equal(def.count, 10);

  // Custom gapX and gapY
  const custom = studio.normalizeConfig({ currentType: 'a5_sheet', gapX: 3, gapY: 4 });
  assert.equal(custom.gapX, 3);
  assert.equal(custom.gapY, 4);

  // Backward compatibility with legacy gapMm
  const legacy = studio.normalizeConfig({ currentType: 'a5_sheet', gapMm: 2 });
  assert.equal(legacy.gapX, 2);
  assert.equal(legacy.gapY, 2);
});

test('layout correctly calculates grid dimensions with separate column-gap and row-gap', () => {
  const studio = loadStudio();

  // A5 sheet with width 67, height 35, gapX 2.5, gapY 2.5
  const cfg = studio.normalizeConfig({ currentType: 'a5_sheet', widthMm: 67, heightMm: 35, gapX: 2.5, gapY: 2.5 });
  const p = studio.layout(cfg);

  assert.equal(p.columns, 2);
  assert.equal(p.rows, 5);
  assert.equal(p.gapX, 2.5);
  assert.equal(p.gapY, 2.5);

  // gridWidth = 2 * 67 + 1 * 2.5 = 136.5 mm
  assert.equal(p.gridWidth, 136.5);
  // gridHeight = 5 * 35 + 4 * 2.5 = 185 mm
  assert.equal(p.gridHeight, 185);

  // Centering on A5 printable sheet (138 x 199.8 mm)
  // x = (138 - 136.5) / 2 = 0.75 mm
  assert.equal(p.x, 0.75);
  // y = (199.8 - 185) / 2 = 7.4 mm
  assert.ok(Math.abs(p.y - 7.4) < 0.001);
  assert.equal(p.valid, true);
});

test('printCss outputs column-gap and row-gap rules for clean sticker separation', () => {
  const studio = loadStudio();
  const cfg = studio.normalizeConfig({ currentType: 'a5_sheet', widthMm: 67, heightMm: 35, gapX: 2.5, gapY: 3.5 });
  const css = studio.printCss(cfg);

  assert.match(css, /column-gap:2\.5mm\s*!important;/);
  assert.match(css, /row-gap:3\.5mm\s*!important;/);
  assert.match(css, /grid-template-columns:repeat\(2,67mm\)\s*!important;/);
  assert.match(css, /grid-template-rows:repeat\(5,35mm\)\s*!important;/);
  assert.match(css, /@page\s*\{\s*size:\s*A5\s*portrait;\s*margin:\s*5mm;\s*\}/);
});

test('oversized gap triggers valid: false to prevent 2nd page overflow', () => {
  const studio = loadStudio();
  // Excessively large vertical gap that exceeds sheet height
  const cfg = studio.normalizeConfig({ currentType: 'a5_sheet', widthMm: 67, heightMm: 35, gapX: 2.5, gapY: 15 });
  const p = studio.layout(cfg);

  // 5 * 35 + 4 * 15 = 175 + 60 = 235 mm > sheetHeight (199.8 mm)
  assert.equal(p.valid, false);
});
