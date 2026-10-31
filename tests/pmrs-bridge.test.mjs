import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {syntheticImportProfile,syntheticExportProfile} from './helpers/pmrs-profiles.mjs';
import {PmrsBridge} from '../server/pmrs/bridge.mjs';
import {validateProfile,validateExportProfile,importProfileIssues,exportProfileIssues} from '../server/pmrs/playwright.mjs';

test('unverified origins/profiles and prototype paths are refused before opening a browser',()=>{
  const p={exportVerified:true,exportVerifiedAt:'2026-10-31',exportVerificationReference:'Synthetic export fixture',origin:'https://pmrs.digitalsp.gov.kh',automationAuthorized:true,selectorsVerified:true,verifiedAt:'2026-10-30',verificationReference:'Synthetic only',authenticated:{selector:'#auth'},patientId:{selector:'#patient'},encounterId:{selector:'#encounter'},save:{selector:'#save'},receipt:{selector:'#receipt'},submission:{path:'/save',method:'POST'},read:{'registration.fullName':{selector:'#name'}},write:{'clinical.diagnosisText':{selector:'#diagnosis',kind:'input'}}};
  assert.equal(validateProfile(p),p);
  assert.throws(()=>validateExportProfile({...p,submission:{path:'//example.com/save',method:'POST'}}));
  for(const changed of [{origin:'https://example.com'},{automationAuthorized:false},{selectorsVerified:false},{verificationReference:''},{read:{'registration.__proto__.name':{selector:'#name'}}}])assert.throws(()=>validateProfile({...p,...changed}));
});
test('browser contexts are exclusive to a session/context, close on expiry/logout and reject overlapping jobs',async()=>{
  const sqlite=new DatabaseSync(':memory:');sqlite.exec('CREATE TABLE sessions(token_hash TEXT,expires_at INTEGER,active_role TEXT,active_ward_code TEXT)');
  sqlite.prepare('INSERT INTO sessions VALUES (?,?,?,?)').run('token',99999999,'DOCTOR','opd');
  let now=1000,closed=0,release;
  const bridge=new PmrsBridge({database:{sqlite},profile:syntheticImportProfile(),now:()=>now,open:async()=>({adapter:{},close:async()=>{closed++;}})});
  const actor={token:'token',role:'DOCTOR',ward:'opd'};
  try{
    await bridge.run('owner',actor,'open');
    const work=bridge.run('owner',actor,'work',async()=>new Promise(resolve=>{release=resolve;}));
    await assert.rejects(bridge.run('owner',actor,'another',async()=>{}),/BUSY/);release({});await work;
    await assert.rejects(bridge.run('other',actor,'work',async()=>{}),/SESSION_EXPIRED/);
    await bridge.closeToken('token');assert.equal(closed,1);
    await bridge.run('owner',actor,'open');now+=600001;await bridge.expire();assert.equal(closed,2);
    await assert.rejects(bridge.run('owner',actor,'work',async()=>{}),/SESSION_EXPIRED/);
    now=1000;await bridge.run('owner',actor,'open');sqlite.prepare('UPDATE sessions SET active_role=?').run('REGISTRATION');await bridge.expire();assert.equal(closed,3);
  }finally{await bridge.closeAll();sqlite.close();}
});

test('verified read-only profile needs no export configuration and never enables export implicitly',async()=>{
  const p=syntheticImportProfile();
  assert.equal(validateProfile(p),p);
  assert.deepEqual(importProfileIssues(p),[]);
  assert.ok(exportProfileIssues(p).includes('EXPORT_VERIFICATION_REQUIRED'));
  assert.ok(exportProfileIssues(p).includes('SUBMISSION_ENDPOINT_REQUIRED'));
  assert.throws(()=>validateExportProfile(p),/EXPORT_UNVERIFIED/);
  const {PmrsPage}=await import('../server/pmrs/playwright.mjs');
  const adapter=new PmrsPage({},p);
  await assert.rejects(adapter.plan({diagnosisText:'Synthetic'}),/EXPORT_UNVERIFIED/);
  await assert.rejects(adapter.fill([]),/EXPORT_UNVERIFIED/);
  await assert.rejects(adapter.submit({},[]),/EXPORT_UNVERIFIED/);
  // A previous full profile without independent export evidence is import-only too.
  const old=syntheticExportProfile();delete old.exportVerified;
  assert.equal(validateProfile(old),old);
  assert.throws(()=>validateExportProfile(old),/EXPORT_UNVERIFIED/);
});

test('draft flags and missing mappings remain blocked with precise, non-sensitive readiness reasons',()=>{
  const draft={origin:'https://pmrs.digitalsp.gov.kh',automationAuthorized:false,selectorsVerified:false};
  const before=structuredClone(draft),sqlite=new DatabaseSync(':memory:');
  const bridge=new PmrsBridge({database:{sqlite},profile:draft});
  try{
    const status=bridge.status();assert.equal(status.importReady,false);assert.equal(status.exportReady,false);
    for(const code of ['AUTOMATION_AUTHORIZATION_REQUIRED','IMPORT_VERIFICATION_REQUIRED','IMPORT_EVIDENCE_REQUIRED','IDENTITY_MAPPING_REQUIRED','READ_MAPPING_REQUIRED'])assert.ok(status.importBlockers.includes(code),code);
    assert.deepEqual(draft,before);
    assert.equal(JSON.stringify(status).includes('https://'),false);
  }finally{void bridge.closeAll();sqlite.close();}
});

test('missing and unreadable profile paths have different blockers without disclosing paths or file contents',async()=>{
  const fs=await import('node:fs'),os=await import('node:os'),path=await import('node:path');
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'pmrs-profile-test-'));
  const badPath=path.join(directory,'invalid.json');fs.writeFileSync(badPath,'not JSON');
  const sqlite=new DatabaseSync(':memory:');
  const missing=new PmrsBridge({database:{sqlite},profilePath:''});
  const bad=new PmrsBridge({database:{sqlite},profilePath:badPath});
  try{
    assert.deepEqual(missing.status().importBlockers,['PROFILE_PATH_REQUIRED']);
    assert.deepEqual(bad.status().importBlockers,['PROFILE_UNREADABLE']);
    assert.equal(bad.status().profileError,true);
    assert.equal(JSON.stringify(bad.status()).includes(directory),false);
    const file=path.join(directory,'readonly.json');fs.writeFileSync(file,JSON.stringify(syntheticImportProfile()));
    const ready=new PmrsBridge({database:{sqlite},profilePath:file});
    try{assert.equal(ready.status().importReady,true);assert.equal(ready.status().exportReady,false);}finally{await ready.closeAll();}
  }finally{await missing.closeAll();await bad.closeAll();sqlite.close();fs.rmSync(directory,{recursive:true,force:true});}
});
