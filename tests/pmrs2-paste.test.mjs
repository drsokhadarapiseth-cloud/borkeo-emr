import test from 'node:test';
import assert from 'node:assert/strict';
import { parsePmrs2Text, PMRS2_PASTE_FIELDS } from '../public/pmrs2-paste.mjs';
const caption = key => PMRS2_PASTE_FIELDS.find(f => f[0] === key)[2][0];
const line = (key, value, punctuation=':') => caption(key) + punctuation + ' ' + value;
test('PMRS2 pasted summary extracts identifiers and normalizes age without guessing DOB', () => {
  const result=parsePmrs2Text([line('fullName','Synthetic Patient','\u17d6'), line('sex','Male'),line('age','49 years'),line('phone','012 555 777'),line('healthId','SYNTH-HEALTH'),line('caseNumber','SYNTH-CASE'),line('street','Synthetic village, Synthetic province')].join('\n'));
  assert.deepEqual(result,{payload:{fullName:'Synthetic Patient',sex:'\u1794\u17d2\u179a\u17bb\u179f',age:'49',phone:'012 555 777',healthId:'SYNTH-HEALTH',caseNumber:'SYNTH-CASE',street:'Synthetic village, Synthetic province'},warnings:[]});
  assert.equal(result.payload.dob,undefined);
});
test('PMRS2 pasted date validates calendar values and refuses month-based ages', () => {
  assert.equal(parsePmrs2Text(line('dob','05/06/2010')).payload.dob,'2010-06-05');
  assert.equal(parsePmrs2Text(line('dob','2025-02-30')).payload.dob,undefined);
  assert.equal(parsePmrs2Text(line('age','4 months')).payload.age,undefined);
});
test('PMRS2 paste blocks conflicting identities and rejects HTML and oversized text', () => {
  assert.deepEqual(parsePmrs2Text('Patient name: Person One\nPatient name: Person Two'),{payload:{},warnings:['conflict']});
  assert.equal(parsePmrs2Text('Patient name: <script>alert(1)</script>').payload.fullName,undefined);
  assert.equal(parsePmrs2Text('x'.repeat(30001)).warnings[0],'size');
  assert.deepEqual(parsePmrs2Text('unrelated text'),{payload:{},warnings:[]});
});
