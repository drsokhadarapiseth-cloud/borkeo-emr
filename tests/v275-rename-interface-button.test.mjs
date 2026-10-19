import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v27.5 public/emr-session.js and server/navigation-settings.mjs label interface link as រចនាគេហទំព័រ', () => {
  const sessionJs = fs.readFileSync(new URL('../public/emr-session.js', import.meta.url), 'utf8');
  assert.match(sessionJs, /\['\/admin\/interface','រចនាគេហទំព័រ'\]/);
  assert.doesNotMatch(sessionJs, /រចនាប័ទ្មប៊ូតុង និងផ្ទាំង/);

  const navMjs = fs.readFileSync(new URL('../server/navigation-settings.mjs', import.meta.url), 'utf8');
  assert.match(navMjs, /\['\/admin\/interface','រចនាគេហទំព័រ'\]/);
  assert.doesNotMatch(navMjs, /រចនាប័ទ្មប៊ូតុង និងផ្ទាំង/);
});

test('v27.5 protected/interface-theme.html displays header as រចនាគេហទំព័រ', () => {
  const html = fs.readFileSync(new URL('../protected/interface-theme.html', import.meta.url), 'utf8');
  assert.match(html, /<h1>រចនាគេហទំព័រ<\/h1>/);
  assert.match(html, /<h2>រចនាគេហទំព័រ EMR<\/h2>/);
  assert.doesNotMatch(html, /រចនាប័ទ្មប៊ូតុង និងផ្ទាំង/);
});
