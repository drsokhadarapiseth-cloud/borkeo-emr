import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();


test('v32.6 protected/EMR.html page 2 action bar has print triage button and printTriageOnly function', () => {
  const emrHtml = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');

  // Verify Page 2 action bar button
  const p2Start = emrHtml.indexOf('id="page2"');
  const p2End = emrHtml.indexOf('id="page3"');
  const p2Slice = emrHtml.slice(p2Start, p2End);

  assert.ok(p2Slice.includes('onclick="printTriageOnly()"'), 'Page 2 action bar must have onclick printTriageOnly()');
  assert.ok(p2Slice.includes('បោះពុម្ពទម្រង់ទ្រីយ៉ា'), 'Page 2 action bar button must be labeled បោះពុម្ពទម្រង់ទ្រីយ៉ា');
  assert.ok(!p2Slice.includes('បោះពុម្ភទម្រង់ពិគ្រោះក្រៅ'), 'Page 2 action bar must no longer have print OPD form button');

  // Verify function printTriageOnly exists and targets #page2
  assert.ok(emrHtml.includes('function printTriageOnly()'), 'Must define function printTriageOnly()');
  assert.match(emrHtml, /selectors:\s*\[['"]#page2['"]\]/, 'printTriageOnly must target #page2');
  assert.ok(emrHtml.includes('classes: [\'print-forms\', \'print-triage-only\']') || emrHtml.includes('print-triage-only'), 'Must use print-triage-only class');

  // Verify CSS contains print-triage-only rule
  assert.ok(emrHtml.includes('body.print-triage-only #page2'), 'Must have CSS rule for body.print-triage-only #page2');
});

test('v32.6 public/emr-language-data.js includes translation for Print Triage Form', () => {
  const langData = fs.readFileSync(path.join(root, 'public', 'emr-language-data.js'), 'utf8');
  assert.ok(langData.includes('បោះពុម្ពទម្រង់ទ្រីយ៉ា'), 'Must include Khmer translation entry for បោះពុម្ពទម្រង់ទ្រីយ៉ា');
  assert.ok(langData.includes('Print Triage Form'), 'Must include English translation entry for Print Triage Form');
});
