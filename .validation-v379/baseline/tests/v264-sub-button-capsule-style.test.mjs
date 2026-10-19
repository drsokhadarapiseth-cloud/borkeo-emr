import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('v26.4 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.equal(pkg.version, '26.4.0');

  const loginHtml = fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
  assert.match(loginHtml, /v26\.4/);

  const server = fs.readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /v26\.4/);
});

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
