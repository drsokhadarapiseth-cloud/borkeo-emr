import test from 'node:test';
import assert from 'node:assert/strict';
import {pregnancyHistoryVisible} from '../public/ipd-record-fields.mjs';

test('pregnancy history is visible only for known female patients older than 13 completed years',()=>{
 const today='2026-10-29';
 assert.equal(pregnancyHistoryVisible(null,today),false);
 for(const sex of ['Female','female','f','\u179f\u17d2\u179a\u17b8']){
  assert.equal(pregnancyHistoryVisible({sex,age:'14'},today),true);
  for(const age of ['13','13.9','0','','unknown'])assert.equal(pregnancyHistoryVisible({sex,age},today),false);
 }
 for(const sex of ['Male','male','m','',null])assert.equal(pregnancyHistoryVisible({sex,age:'40'},today),false);
 assert.equal(pregnancyHistoryVisible({sex:'Female',dateOfBirth:'2012-10-29',age:'13'},today),true);
 assert.equal(pregnancyHistoryVisible({sex:'Female',dateOfBirth:'2012-10-30',age:'40'},today),false);
 assert.equal(pregnancyHistoryVisible({sex:'Female',dateOfBirth:'2013-10-29',age:'40'},today),false);
 assert.equal(pregnancyHistoryVisible({sex:'Female',age:'\u17e1\u17e4'},today),true);
 const stored={sex:'Male',age:'40',data:{'scope:medical:id:ipd_past_pregnancy':'yes','scope:medical:id:ipd_pregnancy_history_notes':'Historical value'}};
 const before=structuredClone(stored);assert.equal(pregnancyHistoryVisible(stored,today),false);assert.deepEqual(stored,before);
});
