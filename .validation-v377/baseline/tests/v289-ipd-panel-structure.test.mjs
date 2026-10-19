import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html = fs.readFileSync(new URL('../protected/EMR.html', import.meta.url), 'utf8');
// Track actual div nesting, excluding scripts and comments containing markup.
function divParents(source) {
  const clean = source.replace(/<!--[\s\S]*?-->|<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  const stack = [], parents = new Map();
  for (const match of clean.matchAll(/<\/?div\b[^>]*>/gi)) {
    if (/^<\//.test(match[0])) { stack.pop(); continue; }
    const id = /\bid="([^"]+)"/.exec(match[0])?.[1] || null;
    if (id) parents.set(id, stack.at(-1));
    stack.push(id);
  }
  return parents;
}

test('IPD medical and nursing panels are siblings of OPD, not hidden descendants', () => {
  const parents = divParents(html);
  for (const id of ['sub_opd', 'sub_ipd', 'sub_nursing']) assert.equal(parents.get(id), 'page3', id);
  assert.equal(parents.get('nursing_general'), 'sub_nursing');
  assert.equal(parents.get('nursing_maternity'), 'sub_nursing');
});

test('structure regression detects the original missing OPD footer closing tag', () => {
  const broken = html.replace('                </div> <!-- Close OPD footer before the referral actions. -->', '');
  assert.equal(divParents(broken).get('sub_ipd'), 'sub_opd');
  assert.equal(divParents(broken).get('sub_nursing'), 'sub_opd');
});

const switchSource = html.slice(html.indexOf('        function switchOpdTab(tabName) {'), html.indexOf('        // ==========================================\r\n        // PARTOGRAPH TAB'));
for (const [role, tab, form] of [['DOCTOR', 'ipd', 'general'], ['NURSE', 'nursing', 'general'], ['MIDWIFE', 'nursing', 'maternity']]) {
  test(`${role} activates the correct IPD panel`, () => {
    const nodes = new Map();
    const node = id => {
      if (!nodes.has(id)) {
        const classes = new Set();
        nodes.set(id, { classList: { add: x => classes.add(x), remove: x => classes.delete(x), contains: x => classes.has(x) }, style: {}, removeAttribute() {}, setAttribute() {}, appendChild() {}, value: form });
      }
      return nodes.get(id);
    };
    let chosenForm;
    const context = { window: { emrSession: { user: { activeRole: role } }, getEmrCarePath: () => ({ mode: 'ipd' }) }, document: { getElementById: node }, switchNursingForm: x => { chosenForm = x; }, scheduleNursingChartRender() {} };
    vm.runInNewContext(switchSource + `\nswitchOpdTab('${tab}');`, context);
    assert.equal(node(tab === 'ipd' ? 'sub_ipd' : 'sub_nursing').classList.contains('active'), true);
    assert.equal(node('sub_opd').classList.contains('active'), false);
    if (tab === 'nursing') assert.equal(chosenForm, form);
  });
}
