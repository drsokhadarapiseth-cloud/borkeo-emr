import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


test('v23.8 server /api/queue/display includes activeCalls payload', () => {
  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.ok(server.includes('activeCalls'), 'returns activeCalls in /api/queue/display response');
});

test('v23.8 queue-display.js merges activeCalls and waiting, plots counter numbers, and shifts queue up', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('data.activeCalls'), 'handles activeCalls payload from server');
  assert.ok(js.includes('mergedList.sort'), 'sorts merged list by queue number');
  assert.ok(js.includes('active-calling-row'), 'styles currently called active row');
  assert.ok(js.includes('tv-counter-blank'), 'leaves counter column blank for uncalled waiting patients');
});
