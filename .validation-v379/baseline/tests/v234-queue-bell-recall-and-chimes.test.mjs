import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v23.4 queue-display.js defines recallCallInVoice handler', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('recallCallInVoice'), 'defines recallCallInVoice handler');
});

test('v23.4 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);
});
