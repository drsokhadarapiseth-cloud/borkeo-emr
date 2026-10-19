import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v23.5 queue-display.js implements gentle 3-note welcome bell (C5, E5, G5 at 0.05, 0.45, 0.85s)', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('playWelcomeBell'), 'defines playWelcomeBell function');
  assert.ok(js.includes('523.25'), 'includes C5 note frequency (523.25 Hz)');
  assert.ok(js.includes('659.25'), 'includes E5 note frequency (659.25 Hz)');
  assert.ok(js.includes('783.99'), 'includes G5 note frequency (783.99 Hz)');
  assert.ok(js.includes('0.05'), 'starts note 1 at 0.05s');
  assert.ok(js.includes('0.45'), 'starts note 2 at 0.45s');
  assert.ok(js.includes('0.85'), 'starts note 3 at 0.85s');
});

test('v23.5 queue-display prevents duplicate audio playback on page load/refresh', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('lastCallEventKey'), 'tracks last processed call event key');
  assert.ok(js.includes('firstLoad'), 'suppresses audio alert on initial load/refresh');
});

test('v23.5 TV display includes sound controls (Enable Sound, Test Bell, Mute, Volume slider)', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/queue-display.html'), 'utf8');
  assert.ok(html.includes('sound-enable'), 'has sound-enable button');
  assert.ok(html.includes('sound-test'), 'has sound-test button');
  assert.ok(html.includes('sound-mute'), 'has sound-mute button');
  assert.ok(html.includes('sound-volume'), 'has sound-volume slider');

  const css = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.css'), 'utf8');
  assert.ok(css.includes('sound-ctrl-btn'), 'styles sound control buttons');
  assert.ok(css.includes('sound-volume-slider'), 'styles volume slider');
});

test('v23.5 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const login = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(login, /v2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);
});
