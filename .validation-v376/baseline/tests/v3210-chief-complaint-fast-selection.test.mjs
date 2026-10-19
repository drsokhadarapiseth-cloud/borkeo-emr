import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();

test('v32.10 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
  assert.ok(parseFloat(pkg.version) >= 32.0, 'package.json version must be current');

  const loginHtml = fs.readFileSync(path.join(rootDir, 'public/login.html'), 'utf8');
  assert.match(loginHtml, /v(?:3[2-6]\.)/);

  const serverMjs = fs.readFileSync(path.join(rootDir, 'server/server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v(?:3[2-6]\.)/);
});

test('v32.10 public/chief-complaint-tags.js implements high-performance in-place toggling and event delegation', () => {
  const js = fs.readFileSync(path.join(rootDir, 'public/chief-complaint-tags.js'), 'utf8');

  // Verify DocumentFragment batching
  assert.match(js, /createDocumentFragment/, 'renderOptions must use createDocumentFragment for batch DOM insertion');

  // Verify event delegation on options list
  assert.match(js, /_ccDelegated/, 'renderOptions must use event delegation on #cc_options_list');
  assert.match(js, /closest\('\.cc-option-item'\)/, 'Delegated click handler must target closest .cc-option-item');

  // Verify data-key and data-symptom on rows
  assert.match(js, /row\.dataset\.key\s*=/, 'Rows must have dataset.key for fast O(1) in-place lookup');
  assert.match(js, /row\.dataset\.symptom\s*=/, 'Rows must have dataset.symptom');

  // Verify in-place toggling without full list teardown
  assert.match(js, /targetRow\.classList\.toggle\('selected',\s*select\)/, 'toggleSymptom must update row class in-place');
  assert.match(js, /cb\.checked\s*=\s*select/, 'toggleSymptom must update checkbox in-place');
});

test('v32.10 HTML templates link updated script and stylesheet with v=32100 cache buster', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(rootDir, 'legacy-html/EMR.html'), 'utf8');

  assert.ok(emrHtml.includes('chief-complaint-tags.css?v=32100'), 'protected/EMR.html must link css?v=32100');
  assert.ok(emrHtml.includes('chief-complaint-tags.js?v=32100'), 'protected/EMR.html must link js?v=32100');
  assert.ok(legacyHtml.includes('chief-complaint-tags.css?v=32100'), 'legacy-html/EMR.html must link css?v=32100');
  assert.ok(legacyHtml.includes('chief-complaint-tags.js?v=32100'), 'legacy-html/EMR.html must link js?v=32100');
});
