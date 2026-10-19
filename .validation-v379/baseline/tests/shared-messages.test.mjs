import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.mjs';
import { ensureMessagingSchema,createStaffMessage,listStaffMessages,completeStaffMessage,
  completePatientMessages,markStaffMessageRead,getStaffMessage } from '../server/messages.mjs';

function setup(t) {
  const db=openDatabase(':memory:'); ensureMessagingSchema(db);t.after(()=>db.close());
  const users={};
  for(const [name,role,wardCode] of [['sender','TRIAGE',''],['nurse1','NURSE','medicine'],['nurse2','NURSE','medicine'],
    ['pediatric','NURSE','pediatric'],['doctor1','DOCTOR','medicine'],['doctor2','DOCTOR','medicine'],['admin','ADMIN',''],['director','DIRECTOR','']]){
    db.createUser({id:name,username:name,displayName:name,role,passwordHash:'test',createdAt:Date.now()});
    users[name]={userId:name,role,wardCode};
  }
  const send=(values={})=>createStaffMessage(db,{senderUserId:'sender',senderRole:'TRIAGE',destinationType:'WARD',
    destinationCode:'medicine',subject:'Patient waiting',patientKey:'case:1',...values});
  return {db,users,send};
}

test('reading does not complete; two nurses share completion and retain the first actor/time',t=>{
  const {db,users,send}=setup(t);const message=send({destinationRole:'NURSE'});
  markStaffMessageRead(db,message.id,'nurse1');
  assert.equal(listStaffMessages(db,users.nurse2).length,1);
  const done=completeStaffMessage(db,message.id,users.nurse1);
  assert.equal(listStaffMessages(db,users.nurse1).length,0);
  assert.equal(listStaffMessages(db,users.nurse2).length,0);
  assert.equal(completeStaffMessage(db,message.id,users.nurse2).completedBy,'nurse1');
  const history=listStaffMessages(db,users.nurse2,{state:'completed'});
  assert.equal(history[0].completedBy,'nurse1');assert.equal(history[0].completedAt,done.completedAt);
  assert.equal(getStaffMessage(db,message.id).body,message.body);
});

test('completion is scoped to ward and role; two doctors share their own completion',t=>{
  const {db,users,send}=setup(t);const message=send();
  assert.equal(completeStaffMessage(db,message.id,users.pediatric),null);
  assert.equal(completeStaffMessage(db,message.id,users.sender),null);
  completeStaffMessage(db,message.id,users.nurse1);
  assert.equal(listStaffMessages(db,users.doctor1).length,1,'doctor work remains pending');
  completeStaffMessage(db,message.id,users.doctor1);
  assert.equal(listStaffMessages(db,users.doctor2).length,0);
});

test('Admin and Director share inbox and history, including messages from Lab',t=>{
  const {db,users,send}=setup(t);
  const a=send({destinationType:'ADMIN',senderRole:'LAB',senderWardCode:''});
  const b=send({destinationType:'DIRECTOR'});
  assert.equal(listStaffMessages(db,users.admin).length,2);
  assert.equal(listStaffMessages(db,users.director).length,2);
  completeStaffMessage(db,a.id,users.director);
  assert.equal(listStaffMessages(db,users.admin)[0].id,b.id);
  assert.equal(listStaffMessages(db,users.admin,{state:'completed'})[0].completedBy,'director');
});

test('interventions preserve other patients, other tests and messages after the action cutoff',t=>{
  const {db,users,send}=setup(t);
  const old=send({subject:'Result • LAB-001'}),otherTest=send({subject:'Result • LAB-002'});
  const otherPatient=send({patientKey:'case:2',subject:'Result • LAB-001'});
  const later=send({subject:'Result • LAB-001'});
  const cutoff=Date.now();db.sqlite.prepare('UPDATE staff_messages SET created_at=? WHERE id=?').run(cutoff+1,later.id);
  completePatientMessages(db,'case:1',users.doctor1,{before:cutoff,subjectIncludes:'LAB-001'});
  const ids=listStaffMessages(db,users.doctor2).map(row=>row.id);
  assert.ok(!ids.includes(old.id));
  for(const message of [later,otherTest,otherPatient])assert.ok(ids.includes(message.id));
});

test('completed messages do not consume the pending inbox limit',t=>{
  const {db,users,send}=setup(t);const pending=send();
  for(let i=0;i<105;i++)completeStaffMessage(db,send().id,users.nurse1);
  assert.equal(listStaffMessages(db,users.nurse2,{limit:1})[0].id,pending.id);
});
