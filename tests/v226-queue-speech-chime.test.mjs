import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v22.6 queue TV display includes 4-tone hospital chime and bilingual voice calling', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('speakCall'), 'has speakCall function');
  assert.ok(js.includes('triggerCallAlert'), 'has triggerCallAlert function');
  assert.ok(js.includes('km-KH'), 'supports Khmer speech lang');
  assert.ok(js.includes('speechSynthesis'), 'uses browser SpeechSynthesis API');
  assert.ok(js.includes('dingDing'), 'preserves dingDing function');
});

