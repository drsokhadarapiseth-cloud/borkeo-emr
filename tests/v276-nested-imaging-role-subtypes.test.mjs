import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v27.6 protected/admin-users.html does not contain standalone imaging subtype section', () => {
  const html = fs.readFileSync(new URL('../protected/admin-users.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /id="imaging-subtype-section"/, 'Standalone imaging subtype fieldset should be removed');
  assert.match(html, /id="role-options"/);
  assert.match(html, /id="ward-options"/);
});

test('v27.6 public/admin-users.js nests imaging subtypes directly under IMAGING role with select all toggle', () => {
  const js = fs.readFileSync(new URL('../public/admin-users.js', import.meta.url), 'utf8');
  assert.match(js, /id="imaging-subtypes-nested"/, 'Contains nested imaging subtypes panel');
  assert.match(js, /btn-toggle-all-subtypes/, 'Contains toggle all subtypes button');
  assert.match(js, /imagingCheckbox\.addEventListener\('change'/, 'Binds change event to toggle nested panel visibility');
  assert.match(js, /selectedRoles\.includes\('IMAGING'\)\?\[\.\.\.document\.querySelectorAll\('\[name=imagingSubtypes\]:checked'\)\]\.map\(x=>x\.value\):\[\]/, 'Only submits subtypes when IMAGING role is selected');
});

test('v27.6 public/admin-users.css includes nested subtypes styling and hidden display handling', () => {
  const css = fs.readFileSync(new URL('../public/admin-users.css', import.meta.url), 'utf8');
  assert.match(css, /\.nested-subtypes-panel/, 'CSS defines nested subtypes panel');
  assert.match(css, /\.nested-subtypes-panel\[hidden\]\s*\{\s*display:\s*none\s*!important;\s*\}/, 'Hidden panel uses display none');
});
