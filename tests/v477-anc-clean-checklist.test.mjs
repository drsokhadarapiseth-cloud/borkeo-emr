// v47.7 - The ANC to-do list is a clean checklist (tick box + text, grouped,
// no buttons). The text opens the field to fill; orders sit next to the fields.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
const page = read('public/anc-record.js');
const css = read('public/anc-record.css');
const taskItem = page.slice(page.indexOf('function taskItem('), page.indexOf('function taskGroups('));

test('a task is a tick box and its text; no buttons in the list', () => {
  assert.equal(/function taskButton/.test(page), false);
  assert.equal(/<button/.test(taskItem), false, 'no button in a task row');
  assert.match(taskItem, /<a href="#" class="anc-task-text" data-task-go=/);
  assert.match(taskItem, /data-auto="1" aria-readonly="true"/, 'data ticks stay green (locked, not disabled)');
  assert.equal(/data-task-close|data-task-reopen|data-focus/.test(page), false, 'old list buttons are gone');
  for (const key of ['records', 'lab', 'exam', 'ultrasound', 'care']) assert.match(page, new RegExp(`\\['${key}', 'anc\\.cat\\.${key}'`));
});

test('the text opens the field where the task is filled', () => {
  for (const [action, target] of [['data:weight', '[data-visit="weight"]'], ['data:vitals', '[data-visit="bp"]'], ['own:hiv', '[data-visit="rapid.hiv"]'],
    ['data:breast', '[data-path="history.mouth.breast"]'], ['data:height', '[data-path="heightCm"]'], ['vaccine:tt', '[data-visit="legacyDetails.44"]']]) {
    assert.ok(page.includes(`'${action}': () => '${target}'`), action);
  }
  assert.match(page, /'order:ULTRASOUND': \(\) => firstEmpty\('\[data-path\^="ultrasounds\."\]\[data-path\$="\.date"\]'\)/);
  assert.match(page, /if \(button\.dataset\.taskGo\) \{ event\.preventDefault\(\); const task = shownTasks\.get/);
  assert.match(page, /place\.classList\.add\('anc-flash'\)/);
});

test('ticking: a data task asks the reason; education ticks today\'s box; cancel shows the saved state', () => {
  assert.match(page, /if \(hasData\(task\)\) \{ event\.target\.checked = false; askCloseReason\(key\); return; \}/);
  assert.match(page, /task\.action === 'data:education'\) \{\n\s+draft\.educationDone = true;/);
  assert.match(page, /dialog\.addEventListener\('close', \(\) => refreshLive\(\), \{ once: true \}\);/);
});

test('orders are next to their fields and are not printed', () => {
  assert.match(page, /const LAB_ORDERS = \{ hbsag: 'HBSAG', hb: 'CBC', group: 'BLOOD_GROUP' \};/);
  assert.match(page, /OGTT \$\{orderButton\('OGTT'\)\}/);
  assert.match(page, /\$\{esc\(u\.title\)\} \$\{orderButton\('ULTRASOUND'\)\}/);
  assert.match(page, /data-action="rx-iron"/);
  assert.match(page, /vaccine=tt">\$\{esc\(t\('anc\.giveVaccine'/);
  assert.match(page, /\.anc-rapid, \.anc-order, \.anc-order-line'\)\.forEach\(\(node\) => node\.remove\(\)\)/);
});

test('styles: 3 / 2 / 1 columns, plain text (screen only)', () => {
  const v477 = css.slice(css.indexOf('/* v47.7'));
  assert.match(v477, /^@media screen \{/m);
  assert.equal(/@media print/.test(v477), false);
  assert.match(v477, /\.anc-tasks \.anc-task-list \{ display:grid; grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(v477, /\.anc-tasks \.anc-task-text \{ all:unset;/);
  assert.match(v477, /max-width:1100px\) \{ \.anc-tasks \.anc-task-list \{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
});
