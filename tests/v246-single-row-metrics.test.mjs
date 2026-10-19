import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


test('v24.6 home.css formats report summary grid in a single row of 7 columns with nowrap text', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public/home.css'), 'utf8');
  
  // Single row 7-column layout
  assert.ok(css.includes('repeat(7, minmax(0, 1fr))'), 'Uses 7-column grid template for single row');
  
  // Nowrap on metric label and subtitle
  assert.match(css, /\.report-metric-card\s*\.metric-label\s*\{[^}]*white-space:\s*nowrap/s, 'metric-label uses white-space: nowrap');
  assert.match(css, /\.report-metric-card\s*\.metric-sub\s*\{[^}]*white-space:\s*nowrap/s, 'metric-sub uses white-space: nowrap');
  assert.match(css, /\.report-metric-card\s*\.metric-extra\s*\{[^}]*white-space:\s*nowrap/s, 'metric-extra uses white-space: nowrap');
});
