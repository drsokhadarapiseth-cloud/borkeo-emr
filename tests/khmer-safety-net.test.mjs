// Runs the Khmer text safety net inside npm test. Khmer in this file is written
// as \u escapes so the test itself adds no Khmer strings to the project.
import test from 'node:test';
import assert from 'node:assert/strict';
import { runKhmerCheck } from '../scripts/check-khmer.mjs';
import { checkAgainstBaseline, extractFromText, stripSectionNumber } from '../scripts/khmer-lib.mjs';

const KH = '\u1794\u17d2\u179a\u179c\u178f\u17d2\u178f\u17b7'; // a Khmer word
const KH2 = '\u1780\u17b6\u179a';
const ZWSP = '\u200b';

test('check:khmer - existing Khmer text in the project matches docs/khmer-baseline.json', () => {
  const problems = runKhmerCheck();
  assert.deepEqual(problems, [], problems.slice(0, 20).join('\n'));
});

const run = (baselineText, currentText, { changes = [], approved = [] } = {}) => checkAgainstBaseline({
  baseline: extractFromText(baselineText, 'a.html'),
  current: extractFromText(currentText, 'b.html'),
  approvedChanges: changes,
  approvedNew: new Set(approved),
});

test('check:khmer - moving a string elsewhere passes, editing or removing it fails', () => {
  assert.deepEqual(run(`<span>${KH}</span>`, `<div>\n  <b>${KH}</b></div>`), []);
  assert.equal(run(`<span>${KH}</span>`, `<span>${KH}\u17cb</span>`).length, 2);
  assert.match(run(`<span>${KH}</span><i>${KH2}</i>`, `<i>${KH2}</i>`)[0], /CHANGED OR REMOVED/);
});

test('check:khmer - invisible characters are part of the text', () => {
  assert.equal(extractFromText(`"${KH}${ZWSP}${KH2}"`, 'x.js')[0].text, `${KH}${ZWSP}${KH2}`);
  assert.equal(run(`"${KH}${ZWSP}${KH2}"`, `"${KH}${KH2}"`).length, 2);
});

test('check:khmer - section number removal passes only when listed', () => {
  const before = `\u17e1. ${KH}`;
  assert.equal(stripSectionNumber(before), KH);
  assert.equal(stripSectionNumber(`II. ${KH}`), KH);
  assert.notDeepEqual(run(`<b>${before}</b><i>${KH}</i>`, `<b>${KH}</b><i>${KH}</i>`), []);
  assert.deepEqual(run(`<b>${before}</b>`, `<b>${KH}</b>`, { changes: [{ before, after: KH }] }), []);
});

test('check:khmer - new Khmer is allowed only from the approved list', () => {
  assert.match(run('<b>x</b>', `<b>${KH}</b>`)[0], /NEW, NOT APPROVED/);
  assert.deepEqual(run('<b>x</b>', `<b>${KH}</b>`, { approved: [KH] }), []);
});
