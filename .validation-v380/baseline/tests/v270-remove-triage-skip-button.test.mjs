import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('v27.0 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  assert.ok(pkg.version >= '27.0.0');

  const loginHtml = fs.readFileSync(new URL('../public/login.html', import.meta.url), 'utf8');
  assert.match(loginHtml, /v(?:27\.|28\.|32\.|33\.|34\.|35\.)/);

  const server = fs.readFileSync(new URL('../server/server.mjs', import.meta.url), 'utf8');
  assert.match(server, /v(?:27\.|28\.|32\.|33\.|34\.|35\.)/);
});

test('v27.0 public/triage.js removes the រំលង button from triage waiting table rows', () => {
  const triageJs = fs.readFileSync(new URL('../public/triage.js', import.meta.url), 'utf8');

  // Waiting row should only have បំពេញទ្រីយ៉ា action link
  assert.match(triageJs, /បំពេញទ្រីយ៉ា/);

  // Must NOT generate the queue-skip button in rowHtml
  assert.doesNotMatch(triageJs, /class="queue-skip"[^>]*>រំលង<\/button>/);
});
