import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v26.4 shared-controls.css implements Image 2 capsule pill style for sub buttons and request tabs', () => {
  const css = fs.readFileSync(new URL('../public/shared-controls.css', import.meta.url), 'utf8');
  
  // Checks for pill border radius on sub buttons and request tabs
  assert.match(css, /\.request-tabs>button/);
  assert.match(css, /border-radius:\s*999px\s*!important/);
  
  // Active state should have white background, blue outline (#38bdf8), and blue text
  assert.match(css, /border:\s*1\.5px solid #38bdf8\s*!important/);
  assert.match(css, /color:\s*#0284c7\s*!important/);
});

test('v26.4 home.css implements Image 2 capsule pill style for department tabs', () => {
  const css = fs.readFileSync(new URL('../public/home.css', import.meta.url), 'utf8');
  
  // Department tabs must have rounded pill capsule styling
  assert.match(css, /\.dept-tab\s*\{[^}]*border-radius:\s*999px\s*!important/s);
  assert.match(css, /\.dept-tab\.active\s*\{[^}]*border:\s*1\.5px solid #38bdf8\s*!important/s);
});
