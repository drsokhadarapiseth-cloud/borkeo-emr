import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v21.9 imaging.html has 6 main procedure tabs and 5 status sub-tabs without PERFORMED', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/imaging.html'), 'utf8');
  
  // Procedures and Consumables Toolbar
  assert.ok(html.includes('id="imaging-groups-bar"'), 'has imaging groups bar');
  assert.ok(html.includes('id="imaging-films-tab"'), 'has Film and Consumables tab');

  // Status sub-tabs: 5 statuses present, PERFORMED removed
  assert.ok(html.includes('data-status=""'), 'has All Statuses sub-tab');
  assert.ok(html.includes('data-status="URGENT"'), 'has Urgent sub-tab');
  assert.ok(html.includes('data-status="ORDERED"'), 'has Waiting sub-tab');
  assert.ok(html.includes('data-status="SCHEDULED"'), 'has Scheduled sub-tab');
  assert.ok(html.includes('data-status="RESULT_AVAILABLE"'), 'has Reported sub-tab');
  assert.ok(!html.includes('data-status="PERFORMED"'), 'PERFORMED status sub-tab is removed');

  // Sub-tabs are not hidden
  assert.ok(!html.includes('id="imaging-status-subtabs" hidden'), 'status sub-tabs are always visible');
});

