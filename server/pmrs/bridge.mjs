import crypto from 'node:crypto';
import {readProfile,importProfileIssues,exportProfileIssues,validateExportProfile,openPmrs,fail} from './playwright.mjs';
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const TTL=10*60*1000;
export class PmrsBridge {
  constructor({database,profile,profilePath=process.env.PMRS_PLAYWRIGHT_PROFILE,open=openPmrs,now=Date.now}={}) {
    this.database=database;this.open=open;this.now=now;this.sessions=new Map();this.profileError=false;this.profilePathConfigured=profile!==undefined?Boolean(profile):Boolean(profilePath);
    try {this.profile=profile===undefined?readProfile(profilePath):profile;} catch {this.profile=null;this.profileError=true;}
    database.sqlite.exec(`CREATE TABLE IF NOT EXISTS pmrs_browser_exports (
      fingerprint TEXT PRIMARY KEY, state TEXT NOT NULL, actor TEXT NOT NULL, created_at INTEGER NOT NULL
    )`);
    this.timer=setInterval(()=>void this.expire(),30000);this.timer.unref();
  }
  status() {
    const importBlockers=!this.profilePathConfigured?['PROFILE_PATH_REQUIRED']:this.profileError?['PROFILE_UNREADABLE']:importProfileIssues(this.profile);
    const exportBlockers=[...new Set([...importBlockers,...exportProfileIssues(this.profile)])];
    return {configured:importBlockers.length===0,importReady:importBlockers.length===0,exportReady:exportBlockers.length===0,
      profilePathConfigured:this.profilePathConfigured,profileError:this.profileError,desktopRequired:true,importBlockers,exportBlockers};
  }
  requireExport(){validateExportProfile(this.profile);}
  async expire() {
    for(const [key,s] of this.sessions) {
      const row=this.database.sqlite.prepare('SELECT expires_at, active_role, active_ward_code FROM sessions WHERE token_hash=?').get(s.token);
      if(this.now()>s.expires || !row || row.expires_at<this.now() || row.active_role!==s.role || (row.active_ward_code||'')!==s.ward) await this.close(key);
    }
  }
  async close(key) {
    const s=this.sessions.get(key);this.sessions.delete(key);
    if(s) {s.closed=true;s.pending=null;await s.browser?.close().catch(()=>{});}
  }
  async closeToken(token){for(const [key,s] of this.sessions)if(s.token===token)await this.close(key);}
  async closeAll(){clearInterval(this.timer);for(const key of this.sessions.keys())await this.close(key);}
  async run(key, actor, action, callback) {
    if(action==='open') {
      if(!this.status().importReady)fail('PROFILE_UNVERIFIED',503);
      if(this.sessions.has(key))fail('SESSION_EXISTS');
      const s={...actor,expires:this.now()+TTL,busy:true,browser:null,closed:false,pending:null};this.sessions.set(key,s);
      try {s.browser=await this.open(this.profile);if(s.closed){await s.browser.close();fail('SESSION_EXPIRED');}return {opened:true};}
      catch {await this.close(key);fail('BROWSER_UNAVAILABLE',503);}finally{s.busy=false;}
    }
    const s=this.sessions.get(key);
    if(!s || s.closed || this.now()>s.expires) {await this.close(key);fail('SESSION_EXPIRED');}
    if(s.busy)fail('BUSY');s.busy=true;
    try {return await callback(s,s.browser.adapter);}finally{s.busy=false;}
  }
  async capture(s,adapter,registrationOnly=false) {
    const snapshot=await adapter.capture({registrationOnly});
    if(registrationOnly)snapshot.clinical={};
    s.pending={id:crypto.randomUUID(),kind:'import',snapshot,expires:this.now()+TTL};
    return {job:s.pending.id,...snapshot};
  }
  pending(s,id,kind) {
    if(!s.pending||s.pending.id!==id||s.pending.kind!==kind||s.pending.expires<this.now())fail('REVIEW_EXPIRED');
    return s.pending;
  }
  async exportPreview(s,adapter,patient,clinical) {
    this.requireExport();
    const target=await adapter.identity();
    const operations=await adapter.plan(clinical);
    s.pending={id:crypto.randomUUID(),kind:'export',patientKey:patient.patientKey,version:patient.version,
      target,clinical,operations,expires:this.now()+TTL,filled:false};
    return {job:s.pending.id,identity:target,version:patient.version,changes:operations.map(({path,before,after})=>({path,before,after}))};
  }
  async fill(s,adapter,id,patient) {
    this.requireExport();
    const p=this.pending(s,id,'export');
    if(p.filled)fail('ALREADY_FILLED');
    this.assertPatient(p,patient);
    if(JSON.stringify(await adapter.identity())!==JSON.stringify(p.target))fail('IDENTITY_CHANGED');
    try {await adapter.fill(p.operations);p.filled=true;return {filled:true};}
    catch {s.pending=null;fail('FILL_FAILED');}
  }
  assertPatient(p,patient) {if(p.patientKey!==patient.patientKey||p.version!==patient.version)fail('RECORD_CHANGED');}
  async submit(s,adapter,id,patient,actor) {
    this.requireExport();
    const p=this.pending(s,id,'export');this.assertPatient(p,patient);
    if(!p.filled)fail('FILL_REQUIRED');
    if(JSON.stringify(await adapter.identity())!==JSON.stringify(p.target))fail('IDENTITY_CHANGED');
    await adapter.check(p.operations,true);
    const fingerprint=digest([p.target,p.clinical]);
    // Persist uncertainty BEFORE clicking, so timeout/restart never causes an automatic resubmit.
    try {this.database.sqlite.prepare('INSERT INTO pmrs_browser_exports VALUES (?,?,?,?)').run(fingerprint,'unknown',actor,this.now());}
    catch {fail('EXPORT_ALREADY_ATTEMPTED');}
    s.pending=null;
    try {
      await adapter.submit(p.target,p.operations);
      this.database.sqlite.prepare('UPDATE pmrs_browser_exports SET state=? WHERE fingerprint=?').run('confirmed',fingerprint);
      return {submitted:true};
    } catch {fail('SUBMISSION_UNKNOWN');}
  }
}
