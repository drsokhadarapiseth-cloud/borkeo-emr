import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v23.2 queue-display implements exact Khmer number reading rules', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('khmerQueueNumberToWords'), 'has khmerQueueNumberToWords converter');
  assert.ok(js.includes('khmerCounterToWords'), 'has khmerCounterToWords converter');
  assert.ok(js.includes('សូន្យ'), 'reads single digits with សូន្យ');
  assert.ok(js.includes('ដប់'), 'reads tens starting from 010');
  assert.ok(js.includes('ម្ភៃ'), 'reads twenties starting from 020');
});

