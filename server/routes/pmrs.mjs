import crypto from 'node:crypto';
import {sessionRole,sessionWard} from '../access.mjs';
import {assertEncounterWrite,consumeCorrection} from '../encounter-access.mjs';
import {logFromContext} from '../record-access.mjs';
import {pmrs2Preview} from '../pmrs/mapping.mjs';
import {pmrs2ReviewIssues} from '../pmrs/review.mjs';
import {normalizePmrsId} from '../pmrs/medicine-import.mjs';
import {identityFor,assertIdentity,clinicalPayload,clinicalImport} from '../pmrs/records.mjs';
import {fail} from '../pmrs/playwright.mjs';
const IMPORT_ROLES=['ADMIN','VICE_DIRECTOR','DOCTOR','REGISTRATION'];
const WRITE_ROLES=['ADMIN','VICE_DIRECTOR','DOCTOR'];
function authorize(ctx,write=false) {
  if(!ctx.session)fail('LOGIN_REQUIRED',401);
  if(ctx.config.demoMode)fail('DEMO_DISABLED',403);
  const role=ctx.requireContext(ctx.session);
  if(!(write?WRITE_ROLES:IMPORT_ROLES).includes(role))fail('ACCESS_DENIED',403);
  return role;
}
function owner(ctx) {return [ctx.session.tokenHash,sessionRole(ctx.session),sessionWard(ctx.session)].join(':');}
function actor(ctx) {return {token:ctx.session.tokenHash,role:sessionRole(ctx.session),ward:sessionWard(ctx.session)};}
function patient(ctx,key) {
  const row=ctx.database.findPatient(ctx.clinicalPatientKey(key));
  if(!row)fail('PATIENT_NOT_FOUND',404);
  if(!ctx.canAccessPatient(ctx.database,ctx.session,row))fail('ACCESS_DENIED',403);
  return {row,record:ctx.patientRecordResponse(row,true)};
}
function reviewed(body) {if(body.reviewed!==true)fail('REVIEW_REQUIRED',400);}
function current(body,record) {if(!Number.isInteger(body.version)||body.version!==record.version)fail('RECORD_CHANGED');}
function log(ctx,event,details={}) {ctx.audit(ctx.database,ctx.request,event,{userId:ctx.session.user_id,subjectUsername:ctx.session.username,details});}
export function mountPmrsRoutes(router) {
  const send=(ctx,value)=>ctx.sendJson(ctx.response,200,value,{secure:ctx.config.cookieSecure});
  const wrap=fn=>async ctx=>{
    try{return await fn(ctx);}catch(error){
      // Never send selector text, page content, credentials or raw Playwright errors to HTTP logs.
      return ctx.sendJson(ctx.response,error.status||409,{code:error.code||'TRANSFER_BLOCKED'},{secure:ctx.config.cookieSecure});
    }
  };
  router.get('/api/pmrs/status',wrap(async ctx=>{authorize(ctx);return send(ctx,ctx.pmrs.status());}));
  router.get('/api/pmrs/clinical-preview',wrap(async ctx=>{
    if(!ctx.session)fail('LOGIN_REQUIRED',401);
    if(ctx.config.demoMode)fail('DEMO_DISABLED',403);
    if(!['ADMIN','VICE_DIRECTOR','REGISTRATION','DOCTOR','NURSE','MIDWIFE'].includes(ctx.requireContext(ctx.session)))fail('ACCESS_DENIED',403);
    const {row,record}=patient(ctx,ctx.url.searchParams.get('patientKey'));
    const preview=pmrs2Preview(record);logFromContext(ctx,row,'open','PMRS Playwright review');
    return send(ctx,{preview,reviewIssues:pmrs2ReviewIssues(preview,preview.triage)});
  }));
  router.get('/api/pmrs/registration',wrap(async ctx=>{
    authorize(ctx);const result=await ctx.pmrs.run(owner(ctx),actor(ctx),'registration',async s=>{
      const p=ctx.pmrs.pending(s,ctx.url.searchParams.get('job'),'import');
      return {registration:p.snapshot.registration};
    });return send(ctx,result);
  }));
  for(const action of ['open','close','capture','link','import-preview','import','export-preview','fill','submit']) {
    router.post('/api/pmrs/'+action,wrap(async ctx=>{
      authorize(ctx,['link','import-preview','import','export-preview','fill','submit'].includes(action));
      if(['export-preview','fill','submit'].includes(action))ctx.pmrs.requireExport();
      const body=await ctx.readJson(ctx.request,4096);
      if(action==='close') {await ctx.pmrs.close(owner(ctx));return send(ctx,{closed:true});}
      const result=await ctx.pmrs.run(owner(ctx),actor(ctx),action,async(s,adapter)=>{
        if(action==='capture') {
          const captured=await ctx.pmrs.capture(s,adapter,!WRITE_ROLES.includes(sessionRole(ctx.session)));
          log(ctx,'PMRS_BROWSER_CAPTURED');return captured;
        }
        const {row,record}=patient(ctx,body.patientKey);
        current(body,record);
        if(action==='link') {
          reviewed(body);const p=ctx.pmrs.pending(s,body.job,'import'), identity=p.snapshot.identity;
          if(body.confirmedPatientId!==identity.patientId||body.confirmedEncounterId!==identity.encounterId||body.confirmedLocalId!==record.caseNumber)fail('IDENTITY_MISMATCH');
          const existing=identityFor(record);
          if(existing.patientId && normalizePmrsId(existing.patientId)!==normalizePmrsId(identity.patientId) || existing.encounterId && existing.encounterId!==identity.encounterId)fail('IDENTITY_MISMATCH');
          if(existing.patientId&&existing.encounterId) {assertIdentity(record,identity);return {linked:true,version:record.version};}
          const duplicate=ctx.database.listPatients().some(other=>{
            if(other.patient_key===row.patient_key)return false;
            const id=identityFor(ctx.patientRecordResponse(other,true));
            return id.patientId===identity.patientId&&id.encounterId===identity.encounterId;
          });
          if(duplicate)fail('DUPLICATE_ENCOUNTER');
          const access=assertEncounterWrite(ctx.database,ctx.session,row,'medical');
          const data={...record.data,'system:pmrsLink':identity};
          const saved=saveRecord(ctx,row,record,data,access);
          log(ctx,'PMRS_ENCOUNTER_LINKED',{patientKey:record.patientKey});
          return {linked:true,version:saved.version};
        }
        if(action==='import-preview'||action==='import') {
          const p=ctx.pmrs.pending(s,body.job,'import');
          const access=assertEncounterWrite(ctx.database,ctx.session,row,'medical');
          const imported=clinicalImport(record,p.snapshot);
          if(imported.hasMedicines&&!['HEF_EQUITY','HEF_VULNERABLE','HEF_POOR','HEF_VULNERABLE_FAMILY'].includes(ctx.pmrsPaymentCategoryStatus(ctx.database,record.patientKey)))fail('HEF_REQUIRED',403);
          if(action==='import-preview') {
            p.review={patientKey:record.patientKey,version:record.version};
            return {changes:imported.changes,medicinesAdded:imported.added,skipped:imported.skipped};
          }
          reviewed(body);
          if(p.review?.patientKey!==record.patientKey||p.review?.version!==record.version)fail('REVIEW_EXPIRED');
          // Re-read target page identity immediately before a local write.
          if(JSON.stringify(await adapter.identity())!==JSON.stringify(p.snapshot.identity))fail('IDENTITY_CHANGED');
          const saved=saveRecord(ctx,row,record,imported.data,access);s.pending=null;
          logFromContext(ctx,row,'open','PMRS browser import');
          log(ctx,'PMRS_BROWSER_IMPORTED',{patientKey:record.patientKey,added:imported.added});
          return {imported:true,version:saved.version};
        }
        if(action==='export-preview') {
          const target=await adapter.identity();assertIdentity(record,target);
          const preview=pmrs2Preview(record),issues=pmrs2ReviewIssues(preview,preview.triage);
          if(issues.length) return {blocked:true,reviewIssues:issues};
          logFromContext(ctx,row,'export','PMRS browser preview');
          return ctx.pmrs.exportPreview(s,adapter,record,clinicalPayload(preview));
        }
        reviewed(body);
        const pending=ctx.pmrs.pending(s,body.job,'export');assertIdentity(record,pending.target);
        if(action==='fill')return ctx.pmrs.fill(s,adapter,body.job,record);
        log(ctx,'PMRS_BROWSER_SUBMISSION_ATTEMPTED',{patientKey:record.patientKey});
        const result=await ctx.pmrs.submit(s,adapter,body.job,record,ctx.session.user_id);
        log(ctx,'PMRS_BROWSER_SUBMITTED',{patientKey:record.patientKey});return result;
      });
      return send(ctx,result);
    }));
  }
}
function saveRecord(ctx,row,record,data,access) {
  const summary=Object.fromEntries(['caseNumber','healthId','firstName','lastName','fullName','sex','age','dateOfBirth','phone','equityCard','paymentType','departmentCode','departmentNameKh','departmentNameEn','serviceMode','entryDate','dischargeDate'].map(key=>[key,record[key]]));
  ctx.database.sqlite.exec('BEGIN IMMEDIATE');
  try {
    if(ctx.database.findPatient(row.patient_key).version!==record.version)fail('RECORD_CHANGED');
    const saved=ctx.database.upsertPatient({id:crypto.randomUUID(),patientKey:record.patientKey,summary,data,userId:ctx.session.user_id,savedAt:Date.now()});
    consumeCorrection(ctx.database,access);ctx.database.sqlite.exec('COMMIT');return saved;
  } catch(error) {ctx.database.sqlite.exec('ROLLBACK');throw error;}
}
