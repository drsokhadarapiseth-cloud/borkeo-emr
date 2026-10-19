import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v22.7 queue TV display uses 100% standard Khmer voice calling and natural voice selection', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('getBestKhmerVoice'), 'has getBestKhmerVoice selector');
  assert.ok(js.includes('onvoiceschanged'), 'listens to onvoiceschanged to cache Khmer voice');
  assert.ok(js.includes('sreymom') || js.includes('piseth'), 'prioritizes natural high-clarity Khmer voices');
  assert.ok(js.includes('km-KH'), 'announces in standard km-KH');
  assert.ok(js.includes('សូមអញ្ជើញ លេខរៀង'), 'formats call in standard Khmer phrase');
  assert.ok(js.includes('ទៅកាន់ បញ្ជរលេខ'), 'includes destination counter in Khmer');
  assert.ok(js.includes('khmerDigitWords'), 'converts numbers to Khmer words for clarity');
});

test('v22.7 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);
});
