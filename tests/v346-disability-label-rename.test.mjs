import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const read = f => fs.readFileSync(path.join(rootDir, f), 'utf8');


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
