import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');


test('v36.9 - HEF dialog status does not display the warning message when members exist', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'hef-lookup.js'), 'utf8');

  // Verify the warning message was removed from the active status assignment
  assert.ok(!code.includes("data.members.length?txt('សិទ្ធិទទួលសេវា HEF"), 'Warning message must not be shown on members loaded');
  assert.ok(code.includes("byId('hef_dialog_status').textContent=data.members.length?'':txt("));
});

test('v36.9 - Operational District and Health Facility UI removes English bilingual slashes in Khmer mode', () => {
  const code = fs.readFileSync(path.join(ROOT, 'public', 'health-facility.js'), 'utf8');

  // Verify title does not concatenate kh + ' / ' + en
  assert.ok(!code.includes("title.textContent=kh+' / '+en"), 'Titles must not hardcode bilingual slash');
  assert.ok(code.includes("title.textContent=txt(kh,enLabel)"), 'Titles must use localized txt helper');

  // Verify Operational District note does not include English slash text
  assert.ok(!code.includes(" / Define districts covered"), 'OD note in Khmer must not contain English slash explanation');

  // Verify District checkbox labels do not append english transliteration in parentheses in Khmer mode
  assert.ok(!code.includes("d.local+' ('+d.english+')'"), 'District checkboxes in Khmer must not append (english)');

  // Verify Save button is pure Khmer without / Save
  assert.ok(!code.includes("button('រក្សាទុក / Save'"), 'Save button must not have bilingual slash');
  assert.ok(code.includes("button(txt('រក្សាទុក','Save')"), 'Save button must use localized txt');

  // Verify Status announcement does not have bilingual slash
  assert.ok(!code.includes("បានរក្សាទុកចុងក្រោយ / Last saved:"), 'Status announcement must not have bilingual slash');
  assert.ok(code.includes("txt('បានរក្សាទុកចុងក្រោយ: '"), 'Status announcement must use clean Khmer text');
});

test('v36.9 - AGENTS.md records permanent language preference rule with Lab exception', () => {
  const agentsMd = fs.readFileSync(path.join(ROOT, 'AGENTS.md'), 'utf8');

  assert.ok(agentsMd.includes('Default UI text must be in Khmer only'), 'Must state Khmer default');
  assert.ok(agentsMd.includes('Do not display bilingual slash text'), 'Must forbid bilingual slash text');
  assert.ok(agentsMd.includes('Laboratory test names and lab test group names remain in English'), 'Must preserve English Lab exception');
});
