import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');

test('v13.2 hides the triage paraclinic routing option from printed triage forms while keeping the screen control', () => {
  const html = fs.readFileSync(path.join(root, 'protected', 'EMR.html'), 'utf8');
  const match = html.match(/<div class=\"triage-paraclinic-routing no-print\"[\s\S]*?<\/div>/);
  assert.ok(match, 'triage paraclinic control should be inside a no-print container');
  assert.match(match[0], /id=\"triage_paraclinic\"/);
  assert.match(html, /function printAdmissionAndTriage\(\)/);
});
