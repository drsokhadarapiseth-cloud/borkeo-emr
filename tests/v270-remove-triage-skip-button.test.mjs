import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v27.0 public/triage.js removes the រំលង button from triage waiting table rows', () => {
  const triageJs = fs.readFileSync(new URL('../public/triage.js', import.meta.url), 'utf8');

  // Waiting row should only have បំពេញទ្រីយ៉ា action link
  assert.match(triageJs, /បំពេញទ្រីយ៉ា/);

  // Must NOT generate the queue-skip button in rowHtml
  assert.doesNotMatch(triageJs, /class="queue-skip"[^>]*>រំលង<\/button>/);
});
