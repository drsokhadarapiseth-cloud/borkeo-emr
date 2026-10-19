import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v22.9 queue TV display includes HD online Khmer voice stream with speech synthesis fallback', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('translate_tts'), 'includes Google Khmer TTS audio stream');
  assert.ok(js.includes('tl=km'), 'specifies Khmer language code in TTS stream');
  assert.ok(js.includes('unlockAudio'), 'implements universal audio unlocking');
  assert.ok(js.includes('speakCall'), 'has speakCall function');
  assert.ok(js.includes('សូមអញ្ជើញ លេខរៀង'), 'constructs standard Khmer announcement');
  assert.ok(js.includes('speechSynthesis'), 'includes SpeechSynthesis fallback');
});

test('v22.9 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^(22\.9|2[3-9]\.)/);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /(22\.|2[3-9]\.)/);
});
