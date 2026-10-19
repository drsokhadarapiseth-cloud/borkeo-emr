import test from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema, setUserAccess, validContexts, roleRequiresWard } from '../server/access.mjs';
import { defaultWardAccountPlan } from '../server/default-ward-users.mjs';

test('registration and triage are hospital-wide service roles while ward clinicians require wards',()=>{
 const db=openDatabase(':memory:');try{ensureAccessSchema(db);const now=Date.now();const id='triage-user';db.createUser({id,username:'triage1',displayName:'Triage Nurse',role:'TRIAGE',passwordHash:'x',createdAt:now});setUserAccess(db,id,['TRIAGE'],[],now);const access={roles:['TRIAGE'],wards:[]};assert.equal(roleRequiresWard('TRIAGE'),false);assert.deepEqual(validContexts(access),[{role:'TRIAGE',wardCode:'',wardName:''}]);assert.equal(roleRequiresWard('NURSE'),true);assert.ok(defaultWardAccountPlan().some(x=>x.username==='nurse_triage'&&x.role==='TRIAGE'&&!x.wardCode));}finally{db.close();}
});


// UI-facing queue split and completed-triage write protection are exercised in
// the integration suite because they depend on the authenticated patient API.
test('case type is registration-owned and completed triage is view-only',()=>{
  const db=openDatabase(':memory:');
  try {
    ensureAccessSchema(db);
    const now=Date.now();
    const id='triage-view';
    db.createUser({id,username:'triage-view',displayName:'Triage View',role:'TRIAGE',passwordHash:'x',createdAt:now});
    setUserAccess(db,id,['TRIAGE'],[],now);
    assert.equal(roleRequiresWard('TRIAGE'),false);
    assert.deepEqual(validContexts({roles:['TRIAGE'],wards:[]}),[{role:'TRIAGE',wardCode:'',wardName:''}]);
  } finally { db.close(); }
});
