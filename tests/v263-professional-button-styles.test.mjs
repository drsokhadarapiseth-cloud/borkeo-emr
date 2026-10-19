import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v26.3 shared-controls.css removes dark/black controls in Preset 10 and banner actions', () => {
  const css = fs.readFileSync(new URL('../public/shared-controls.css', import.meta.url), 'utf8');
  
  // Preset 10 should not have dark slate/black colors #344255 or #566579
  assert.doesNotMatch(css, /#344255/, 'Preset 10 should not contain dark #344255');
  assert.doesNotMatch(css, /#566579/, 'Preset 10 should not contain dark #566579');
  
  // Preset 10 must use clean medical ocean colors
  assert.match(css, /\[data-emr-preset="10"\]\{--control-bg:linear-gradient\(180deg,#0a8db5,#087fa8\)/);

  // Portal banner actions and logout must have professional styling without dark backgrounds
  assert.match(css, /\.portal-account-actions\s+:is\(button,a\)/);
  assert.match(css, /\.portal-logout/);
  assert.match(css, /\.emr-language-switch/);
});

test('v26.3 home.css provides crisp professional buttons for department tabs and date tools', () => {
  const css = fs.readFileSync(new URL('../public/home.css', import.meta.url), 'utf8');
  
  // Department tabs must have clean crisp styling
  assert.match(css, /\.dept-tab\s*\{/);
  assert.match(css, /\.dept-tab\.active\s*\{/);
  assert.match(css, /background:\s*linear-gradient\(180deg,\s*#0ba2ce,\s*#087fa8\)\s*!important/);

  // Date filter button (ថ្ងៃនេះ) must have matching ocean gradient
  assert.match(css, /\.report-date-tools\s+button\s*\{/);
});
