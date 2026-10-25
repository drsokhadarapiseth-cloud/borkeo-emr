import test from 'node:test';
import assert from 'node:assert/strict';
import { ANC_REQUIRED_FIELDS, missingAncFields } from '../public/anc-required-fields.mjs';
test('ANC completion requires each configured entry, accepts explicit zero and does not demand pending results', () => {
  const record = {}, visit = {};
  assert.equal(missingAncFields(record, visit).length, ANC_REQUIRED_FIELDS.length);
  for (const [scope, path] of ANC_REQUIRED_FIELDS) {
    const keys = path.split('.'); let node = scope === 'record' ? record : visit;
    for (const key of keys.slice(0, -1)) node = node[key] ||= {};
    node[keys.at(-1)] = '0';
  }
  assert.deepEqual(missingAncFields(record, visit), []);
  visit.legacyDetails['37'] = '  ';
  assert.deepEqual(missingAncFields(record, visit), [['visit', 'legacyDetails.37']]);
});
