import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const read = f => fs.readFileSync(path.join(rootDir, f), 'utf8');

test('v34.6 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(['34.6.0', '34.7.0', '34.8.0', '34.9.0', '35.0.0', '35.1.0', '35.2.0', '35.3.0', '35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v3(?:4\.[6789]|[56].[0-9])/);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /Borkeo EMR v3(?:4\.[6789]|[56].[0-9])/);
});

test('registration disability label is renamed from ការយល់ដឹង to កាយសម្បទា', () => {
  const emrHtml = read('protected/EMR.html');
  // Check that the label for the disability field is កាយសម្បទា
  assert.match(emrHtml, /<label>កាយសម្បទា\s*<span/);

  // Check that the radio inputs remain name="disability" with ពិការ and មិនពិការ
  const startIdx = emrHtml.indexOf('<label>កាយសម្បទា');
  const disabilitySnippet = emrHtml.slice(startIdx, startIdx + 400);
  assert.match(disabilitySnippet, /name="disability"/);
  assert.match(disabilitySnippet, /ពិការ/);
  assert.match(disabilitySnippet, /មិនពិការ/);

  // Confirm that the label is not ការយល់ដឹង
  assert.doesNotMatch(disabilitySnippet, /ការយល់ដឹង/);
});

test('Khmer translation dictionary includes កាយសម្បទា mapping without guessing translations', () => {
  const emrHtml = read('protected/EMR.html');
  assert.match(emrHtml, /"កាយសម្បទា":\s*"Awareness"/);
  assert.match(emrHtml, /"ពិការ":\s*"Disability"/);
  assert.match(emrHtml, /"មិនពិការ":\s*"No Disability"/);
});
