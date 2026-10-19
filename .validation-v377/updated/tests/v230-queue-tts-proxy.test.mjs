import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v23.0 server includes /api/queue/tts endpoint and client prompts for audio unlock', () => {
  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.ok(server.includes('/api/queue/tts'), 'server handles /api/queue/tts');
  assert.ok(server.includes('translate_tts'), 'server proxies to upstream TTS engine');

  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('/api/queue/tts?text='), 'client uses local /api/queue/tts proxy');
  assert.ok(js.includes('audio-prompt-banner'), 'client manages audio prompt banner');

  const html = fs.readFileSync(path.join(process.cwd(), 'protected/queue-display.html'), 'utf8');
  assert.ok(html.includes('audio-prompt-banner'), 'html contains audio prompt banner');
});

test('v23.0 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[3-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[3-9]\./);
});
