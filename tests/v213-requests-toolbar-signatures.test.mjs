import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { projectRoot } from '../server/config.mjs';

const read = file => fs.readFileSync(path.join(projectRoot, file), 'utf8');

test('v21.3 requests toolbar buttons have matching height with inputs and clean baseline alignment', () => {
  const requestsCss = read('public/requests.css');
  assert.match(requestsCss, /\.request-toolbar,\s*body \.request-toolbar\s*\{\s*display:\s*flex\s*!important;\s*align-items:\s*flex-end\s*!important/);
  assert.match(requestsCss, /\.request-toolbar button,\s*body \.request-toolbar button\s*\{\s*flex:\s*0 0 auto\s*!important;\s*min-height:\s*38px\s*!important;\s*height:\s*38px\s*!important/);

  const sharedCss = read('public/shared-controls.css');
  assert.match(sharedCss, /\.request-toolbar\s*\{\s*display:\s*flex;\s*align-items:\s*flex-end;\s*gap:\s*10px;\s*flex-wrap:\s*wrap\s*\}/);
});

test('v21.3 ward medicine order delivery form removes Workflow: pending note and orders 6 signatures correctly', () => {
  const tableJs = read('public/ward-medicine-table.js');
  assert.doesNotMatch(tableJs, /Workflow:\s*\$\{/);
  assert.doesNotMatch(tableJs, /approved-print-note/);

  const directorIdx = tableJs.indexOf("[3,'ប្រធានមន្ទីរពេទ្យ'");
  const pharmacyIdx = tableJs.indexOf("[4,'ឱសថការី'");
  const senderIdx = tableJs.indexOf("[5,'អ្នកប្រគល់'");
  const chiefIdx = tableJs.indexOf("[2,");
  const receiverIdx = tableJs.indexOf("[6,'អ្នកទទួល'");
  const nurseIdx = tableJs.indexOf("[1,'នាយសាល'");

  assert.ok(directorIdx > 0 && pharmacyIdx > directorIdx && senderIdx > pharmacyIdx && chiefIdx > senderIdx && receiverIdx > chiefIdx && nurseIdx > receiverIdx);
});

