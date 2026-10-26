// v47.6 - Clean ANC screen layout: fixed grid of cells, BP and pulse apart,
// tick boxes lined up, fixed table columns; screen only (print keeps its flow).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const page = read('public/anc-record.js');
const css = read('public/anc-record.css');
const v476 = css.slice(css.indexOf('/* v47.6'));

test('today\'s visit: every field is a cell; blood pressure and pulse are two fields with units', () => {
  assert.match(page, /const cell = \(labelHtml, control, \{ unit = '', span = 1, check = false, after = '' \} = \{\}\) =>/);
  assert.match(page, /cell\(esc\(t\('anc\.bp', 'Blood pressure'\)\), vfield\('bp', \{ size: 'small' \}\), \{ unit: 'mmHg' \}\)/);
  assert.match(page, /cell\(esc\(t\('anc\.pulse', 'Pulse'\)\), vfield\('pulse', \{ size: 'tiny' \}\), \{ unit: perMinute\(\) \}\)/);
  assert.equal(/\$\{vfield\('bp', \{ size: 'small' \}\)\} - \$\{vfield\('pulse'/.test(page), false, 'pulse no longer follows BP on one line');
  assert.match(page, /cellLabel\.append\(marker\)/, 'required star stays in the label');
  assert.match(read('public/new-text-data.js'), /"anc\.bp": "\u179f\u1798\u17d2\u1796\u17b6\u1792\u1788\u17b6\u1798"/);
  assert.match(read('public/new-text-data.js'), /"anc\.pulse": "\u1787\u17b8\u1796\u1785\u179a"/);
});

test('page 2: identity cells, lined-up tick boxes, yes / no and numbered rows', () => {
  assert.match(page, /cell\(esc\(id\.eddUltrasound\), field\('ultrasoundEdd'/);
  assert.equal((page.match(/class="anc-check-grid"/g) || []).length, 3, 'general, family and social history');
  assert.match(page, /anc-yesno-row"><span class="anc-yesno-q">/);
  assert.match(page, /anc-entry anc-entry-surgery/);
  assert.match(page, /anc-entry anc-entry-allergy/);
  assert.match(page, /anc-fixed-table anc-prev-table/);
  assert.match(page, /anc-fixed-table anc-us-table/);
});

test('styles: 4 / 2 / 1 columns, aligned cells and tick boxes, screen only', () => {
  assert.ok(v476.startsWith('/* v47.6'));
  assert.match(v476, /^@media screen \{/m);
  assert.equal(/@media print/.test(v476), false, 'the print layout is not changed');
  assert.match(v476, /\.anc-page \.anc-grid, \.anc-page \.anc-visit-grid\.anc-grid, \.anc-page \.anc-identity \{ display:grid; grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(v476, /\.anc-page \.anc-cell \{ display:flex; flex-direction:column; align-items:stretch;/);
  assert.match(v476, /max-width:1100px\) \{\n \.anc-page \.anc-grid[^}]*repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(v476, /max-width:760px\) \{\n \.anc-page \.anc-grid[^}]*grid-template-columns:minmax\(0,1fr\)/);
  assert.match(v476, /\.anc-page \.anc-choice \{ display:flex; align-items:flex-start;/);
  assert.match(v476, /\.anc-page \.anc-fixed-table \{ table-layout:fixed; \}/);
});
