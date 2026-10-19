import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { navigationCatalog } from '../server/navigation-settings.mjs';


test('v23.9 navigationCatalog and emr-session.js remove requests tab for TRIAGE role', () => {
  const catalog = navigationCatalog();
  const triageCat = catalog.find(c => c.role === 'TRIAGE');
  assert.ok(triageCat, 'finds TRIAGE catalog');
  const tabIds = triageCat.tabs.map(t => t.id);
  assert.ok(!tabIds.includes('/requests'), 'TRIAGE tabs do not include /requests');
  assert.deepEqual(tabIds, ['/triage', '/queue-display?service=TRIAGE', '/patient-list']);

  const sessionJs = fs.readFileSync(path.join(process.cwd(), 'public/emr-session.js'), 'utf8');
  assert.ok(sessionJs.includes("if (role === 'TRIAGE') return [['/triage'"), 'emr-session.js removes /requests for TRIAGE');
});
