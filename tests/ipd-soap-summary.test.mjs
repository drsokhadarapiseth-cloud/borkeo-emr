import test from 'node:test';
import assert from 'node:assert/strict';
import {EXAM_GROUPS,buildSoap,splitSoap,knownNormal,summarizeExam} from '../public/ipd-soap.mjs';
import {normalExamText} from '../public/pmrs2-exam-normal.js';

test('IPD examination summary collapses only fully documented normal systems',()=>{
  assert.deepEqual(summarizeExam({}),[]);
  for(const language of ['kh','en','fr']){
    const data=Object.fromEntries(Object.entries(EXAM_GROUPS.heent.fields).map(([id,[,normal]])=>[id,normalExamText(normal,language)]));
    assert.deepEqual(summarizeExam(data),['HEENT: normal']);
    data.ipd_exam_eye_right='Right eye swollen; vision change reported';
    const summary=summarizeExam(data).join('\n');
    assert.equal(summary,'HEENT: Right eye: Right eye swollen; vision change reported');
    assert.ok(!summary.includes(normalExamText(EXAM_GROUPS.heent.fields.ipd_exam_head[1],language)));
  }
  assert.deepEqual(summarizeExam({ipd_exam_resp_inspection:'Normal'}),['Respiratory system: Inspection: normal']);
  assert.deepEqual(summarizeExam({ipd_exam_neuro_conscious:true}),['Neurological system: conscious']);
  assert.equal(knownNormal('ipd_exam_throat','not normal'),false);
  const free='Normal appearance except a documented focal finding';
  assert.ok(summarizeExam({ipd_exam_throat:free})[0].includes(free));
  assert.deepEqual(summarizeExam({ipd_exam_pain:'0'}),['Pain score: 0']);
});

test('abnormal neurological status retains numeric GCS facts rather than hiding contradictions',()=>{
  const data=Object.fromEntries(Object.entries(EXAM_GROUPS.neurological.fields).map(([id,[,normal]])=>[id,normal]));
  data.ipd_exam_neuro_coma=true;
  const summary=summarizeExam(data)[0];
  assert.match(summary,/coma/);assert.match(summary,/GCS total: 15/);
  assert.ok(!summary.endsWith(': normal'));
});

test('SOAP sections preserve legacy notes and safely round trip structured clinician text',()=>{
  const raw='Legacy manual note\n<literal clinical text>\n';
  assert.deepEqual(splitSoap(raw),{S:raw,O:'',A:'',P:''});
  const fields={S:'Documented symptoms',O:'Documented examination\nSecond line',A:'J02',P:'Documented plan'};
  const note=buildSoap(Object.fromEntries(Object.entries(fields).map(([key,value])=>[key,[value]])));
  assert.deepEqual(splitSoap(note),fields);
  assert.deepEqual(splitSoap('S:\nEarlier manual note'),{S:'Earlier manual note',O:'',A:'',P:''});
  const ambiguous='S:\nOne note\nS:\nAnother note';
  assert.equal(splitSoap(ambiguous).S,ambiguous);
});

test('documented findings follow the head-to-toe order without changing their clinical text',()=>{
  const data={ipd_exam_neuro_other:'Neurological finding',ipd_exam_head:'Head finding',ipd_exam_resp_auscultation:'Chest finding',ipd_exam_gu:'GU finding',ipd_exam_extremities:'Limb finding',ipd_exam_pain:'0'};
  const result=summarizeExam(data).join('\n');
  assert.ok(result.indexOf('Pain score')<result.indexOf('HEENT'));
  assert.ok(result.indexOf('HEENT')<result.indexOf('Respiratory'));
  assert.ok(result.indexOf('Genitourinary')<result.indexOf('Extremities'));
  assert.ok(result.indexOf('Extremities')<result.indexOf('Neurological'));
  for(const text of Object.values(data))assert.ok(result.includes(text));
});
