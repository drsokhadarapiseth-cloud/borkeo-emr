import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v21.4 OPD/IPD queue toolbar places Counter before Date and standardizes control dimensions and fonts', () => {
  const html = read('protected/opd-queue.html');
  const counterIdx = html.indexOf('id="opd-counter"');
  const dateIdx = html.indexOf('id="queue-date"');
  const searchIdx = html.indexOf('id="queue-search"');
  const refreshIdx = html.indexOf('id="queue-refresh"');

  assert.ok(counterIdx > 0 && dateIdx > counterIdx && searchIdx > dateIdx && refreshIdx > searchIdx, 'Toolbar order must be: Counter -> Date -> Search -> Refresh');

  const css = read('public/opd-queue.css');
  assert.match(css, /\.opd-toolbar\s*\{\s*display:\s*flex\s*!important;\s*align-items:\s*flex-end\s*!important/);
  assert.match(css, /\.opd-toolbar select,\s*\.opd-toolbar input\s*\{\s*font-family:\s*inherit\s*!important;\s*font-size:\s*13\.5px\s*!important;\s*color:\s*#123e58\s*!important;\s*border:\s*1px solid #9fc9dc\s*!important;\s*border-radius:\s*8px\s*!important;\s*padding:\s*7px 12px\s*!important;\s*min-height:\s*40px\s*!important;\s*height:\s*40px\s*!important/);
  assert.match(css, /\.opd-counter-label select\s*\{\s*width:\s*90px\s*!important;\s*min-width:\s*90px\s*!important/);
});

