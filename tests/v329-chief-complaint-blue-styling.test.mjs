import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();


test('v32.9 public/chief-complaint-tags.css uses blue styling matching patient name and ID (#0284c7)', () => {
  const css = fs.readFileSync(path.join(rootDir, 'public/chief-complaint-tags.css'), 'utf8');

  // Tag badges should be blue #0284c7
  assert.match(css, /\.cc-tag\s*\{[^}]*background:\s*#0284c7;/s, '.cc-tag badge background must be #0284c7');

  // Tag box border should be #0284c7
  assert.match(css, /\.cc-tag-box\s*\{[^}]*border:\s*1\.5px\s*solid\s*#0284c7;/s, '.cc-tag-box border must be #0284c7');

  // Focus and open states should use blue accents
  assert.match(css, /\.cc-tag-box:focus-within[^}]*border-color:\s*#0369a1;/s, '.cc-tag-box focus border must be #0369a1');
  assert.match(css, /box-shadow:\s*0 0 0 2px rgba\(2,\s*132,\s*199,\s*0\.2\);/, '.cc-tag-box focus shadow must be blue glow');

  // Search input and add button
  assert.match(css, /\.cc-search-input\s*\{[^}]*border:\s*1\.5px\s*solid\s*#0284c7;/s, '.cc-search-input border must be #0284c7');
  assert.match(css, /\.cc-add-btn\s*\{[^}]*background:\s*#0284c7;/s, '.cc-add-btn background must be #0284c7');
  assert.match(css, /\.cc-add-btn:hover\s*\{[^}]*background:\s*#0369a1;/s, '.cc-add-btn hover must be #0369a1');

  // Dropdown selected item and checkbox accent
  assert.match(css, /\.cc-option-item\.selected\s*\{[^}]*background:\s*#e0f2fe;/s, '.cc-option-item.selected background must be #e0f2fe');
  assert.match(css, /\.cc-option-item input\[type="checkbox"\]\s*\{[^}]*accent-color:\s*#0284c7;/s, 'checkbox accent-color must be #0284c7');

  // Ensure old green colors are not present
  assert.doesNotMatch(css, /#10b981/, 'No green #10b981 in chief-complaint-tags.css');
  assert.doesNotMatch(css, /#16a34a/, 'No green #16a34a in chief-complaint-tags.css');
});

test('v32.9 protected/EMR.html and legacy-html/EMR.html link updated CSS and script with v=3290 and inline styles', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(rootDir, 'legacy-html/EMR.html'), 'utf8');

  // Both should link ?v=3290 or later
  assert.ok(emrHtml.includes('chief-complaint-tags.css?v=32100') || emrHtml.includes('chief-complaint-tags.css?v=3290'), 'protected/EMR.html must link css');
  assert.ok(emrHtml.includes('chief-complaint-tags.js?v=32100') || emrHtml.includes('chief-complaint-tags.js?v=3290'), 'protected/EMR.html must link js');
  assert.ok(legacyHtml.includes('chief-complaint-tags.css?v=32100') || legacyHtml.includes('chief-complaint-tags.css?v=3290'), 'legacy-html/EMR.html must link css');
  assert.ok(legacyHtml.includes('chief-complaint-tags.js?v=32100') || legacyHtml.includes('chief-complaint-tags.js?v=3290'), 'legacy-html/EMR.html must link js');

  // Check inline styles match #0284c7
  assert.match(emrHtml, /\.cc-tag\s*\{[^}]*background:\s*#0284c7;/s, 'EMR.html inline .cc-tag must be #0284c7');
  assert.match(emrHtml, /\.cc-tag-box\s*\{[^}]*border:\s*1\.5px\s*solid\s*#0284c7;/s, 'EMR.html inline .cc-tag-box must be #0284c7');

  // Verify patient code and patient name color in triage form is #0284c7
  assert.match(emrHtml, /color:\s*#0284c7;[^>]*id="p2_patient_code"/, 'p2_patient_code must have color #0284c7');
  assert.match(emrHtml, /color:\s*#0284c7;[^>]*id="p2_name"/, 'p2_name must have color #0284c7');
});
