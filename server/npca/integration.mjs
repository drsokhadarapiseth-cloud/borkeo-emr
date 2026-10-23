import { createHash, randomUUID } from 'node:crypto';
import { NpcaClient, NpcaError, errorText } from './client.mjs';
import { buildVisitPayload } from './visit-builder.mjs';
import { validateVisitPayload } from './validation.mjs';
import { sourceForPatient, parse } from './source.mjs';
import { validAddress } from './address.mjs';
import { createDiagnosisSearch } from '../icd10.mjs';
import { medicineCatalogue } from '../medicine-catalogue.mjs';
import { npcaAudit } from './storage.mjs';
const hash=body=>createHash('sha256').update(JSON.stringify(body)).digest('hex');
export class NpcaIntegration {
  constructor(config,database,{client,sourceFactory=sourceForPatient,validationOptions={},clock=Date.now}={}){
    this.config=config;this.database=database;this.client=client||new NpcaClient(config,database);this.sourceFactory=sourceFactory;this.validationOptions=validationOptions;this.clock=clock;this.running=false;this.stopped=false;
    this.diagnoses=createDiagnosisSearch();
    this.cmsCodes=new Set(medicineCatalogue().items.map(m=>m.code).filter(Boolean));
  }
  prepare(patientKey){
    const row=this.database.findPatient(patientKey);if(!row)throw Object.assign(new Error('រកមិនឃើញអ្នកជំងឺ។'),{status:404});
    const source=this.sourceFactory(this.database,row),built=buildVisitPayload(source,this.config,this.database);
    const admissionClaim=!source.completed&&source.visitType==='ipd'&&source.link?.payment_type==='PATY-0000N09';
    const validation={completed:source.completed,admissionClaim,sourceIssues:[...built.issues,...(source.sourceIssues||[]).filter(i=>this.config.sendForms||!i.field.startsWith('forms.'))],
      eligible:source.link?.eligible===1,sendForms:this.config.sendForms,addressValid:validAddress,
      diagnosisExists:code=>typeof code==='string'&&this.diagnoses.search(code).items.some(d=>d.code===code),medicineExists:code=>this.cmsCodes.has(code),...this.validationOptions};
    const errors=validateVisitPayload(built.payload,validation);
    if(source.link&&!['PATY-0000N09','PATY-00003LD','PATY-00002NF','PATY-00002EH','PATY-000K010','PATY-0000G3E','PATY-00B003F','PATY-000T040'].includes(source.link.payment_type))errors.push({field:'invoices.payment_type',screen:'billing',code:'not-claim-scheme',messageKh:'ករណីនេះមិនមែនជាការទាមទារប្រាក់ HEF ឬ NSSF ទេ។',messageEn:'This is not an HEF or NSSF claim.'});
    return {...built,errors,admissionClaim,sourceVersion:row.version};
  }
  enqueue(patientKey,actorId){
    if(!this.config.enabled)throw new NpcaError('disabled');
    const built=this.prepare(patientKey),payloadHash=hash(built.payload),now=this.clock();
    const prior=this.database.sqlite.prepare('SELECT * FROM npca_submissions WHERE visit_code=?').get(built.visitCode);
    if(prior&&(prior.status===1||prior.status===5||['sending','queued','retry','reconcile'].includes(prior.queue_state)))throw Object.assign(new Error('ករណីនេះបានបញ្ជូនរួច ឬកំពុងដំណើរការ។'),{status:409});
    if(prior?.submitted_at&&prior.payload_hash===payloadHash)throw Object.assign(new Error('សូមកែព័ត៌មាន មុនបញ្ជូនម្តងទៀត។'),{status:409});
    if(built.errors.length){npcaAudit(this.database,'VALIDATION_BLOCKED',{actorId,patientKey,visitCode:built.visitCode});return {...built,queued:false};}
    const queued=this.database.sqlite.prepare(`INSERT INTO npca_submissions(id,patient_key,visit_code,payload_hash,payload,status,submitted_by,queue_state,next_attempt_at,updated_at)
      VALUES(?,?,?,?,?,3,?,'queued',?,?) ON CONFLICT(visit_code) DO UPDATE SET payload_hash=excluded.payload_hash,payload=excluded.payload,
      submitted_by=excluded.submitted_by,queue_state='queued',next_attempt_at=excluded.next_attempt_at,updated_at=excluded.updated_at,errors='[]',message='',lease_until=0
      WHERE npca_submissions.status IN(2,3) AND npca_submissions.queue_state IN('blocked','terminal','waiting')
      AND (npca_submissions.submitted_at IS NULL OR npca_submissions.payload_hash<>excluded.payload_hash)`).run(
        prior?.id||randomUUID(),patientKey,built.visitCode,payloadHash,JSON.stringify(built.payload),actorId,now,now);
    if(!queued.changes)throw Object.assign(new Error('ករណីនេះបានបញ្ជូនរួច ឬកំពុងដំណើរការ។'),{status:409});
    npcaAudit(this.database,'QUEUED',{actorId,patientKey,visitCode:built.visitCode});
    return {queued:true,visitCode:built.visitCode,errors:[]};
  }
  start(){if(!this.config.enabled||this.timer||this.stopped)return;this.timer=setInterval(()=>void this.tick().catch(()=>{}),30000);this.timer.unref();}
  stop(){this.stopped=true;clearInterval(this.timer);this.diagnoses.close();}
  backoff(attempt){return Math.min(8*3600000,30000*2**Math.min(attempt,10));}
  update(row,fields){const entries=Object.entries({...fields,updated_at:this.clock()});this.database.sqlite.prepare('UPDATE npca_submissions SET '+entries.map(([k])=>k+'=?').join(',')+' WHERE id=?').run(...entries.map(([,v])=>v),row.id);}
  responseRecord(body,visitCode){
    let data=body?.data;
    if(Array.isArray(data))return data.find(r=>r.visit_code===visitCode||r.code===visitCode)||null;
    if(Array.isArray(data?.data))return data.data.find(r=>r.visit_code===visitCode||r.code===visitCode)||null;
    if(data&&(data.visit_code===visitCode||data.code===visitCode))return data;
    return null;
  }
  accept(row,body,{poll=false}={}){
    const result=this.responseRecord(body,row.visit_code);
    if(!result||![1,2,3,5].includes(Number(result.status)))return false;
    const status=Number(result.status),now=this.clock();
    this.update(row,{status,queue_state:[1,2].includes(status)?'terminal':'waiting',visit_ulid:result.visit_ulid||result.uuld||row.visit_ulid||null,
      message:this.client.redact(result.message||body.message||''),errors:JSON.stringify({remote:this.client.redact(result.errors||body.errors||[])}),
      ...(poll?{checked_at:now}:{submitted_at:now}),next_attempt_at:now+this.config.pollHours*3600000,lease_until:0,last_http:200});
    npcaAudit(this.database,poll?'STATUS_RESULT':'SUBMISSION_RESULT',{actorId:row.submitted_by,patientKey:row.patient_key,visitCode:row.visit_code,status});return true;
  }
  async poll(row){
    try{
      const body=await this.client.request('processed',{visit_code:row.visit_code,per_page:100},{actorId:row.submitted_by,patientKey:row.patient_key,visitCode:row.visit_code});
      if(!this.accept(row,body,{poll:true})){
        // A timeout can mean the remote server accepted the visit. Reconcile
        // before replaying the same stable visit code.
        const data=body?.data,knownEmpty=Array.isArray(data)&&data.length===0||Array.isArray(data?.data)&&data.data.length===0;
        if(row.queue_state==='reconcile'&&knownEmpty)this.update(row,{queue_state:'retry',next_attempt_at:this.clock()+this.backoff(row.attempt),checked_at:this.clock(),lease_until:0});
        else this.update(row,{next_attempt_at:this.clock()+this.config.pollHours*3600000,checked_at:this.clock(),lease_until:0});
      }
    }catch(error){this.update(row,{message:errorText(error),next_attempt_at:this.clock()+this.backoff(row.attempt),checked_at:this.clock(),lease_until:0});}
  }
  async tick(){
    if(!this.config.enabled||this.running||this.stopped)return;
    this.running=true;
    const lockUntil=this.clock()+this.config.timeoutMs*8+60000;
    let locked=false;
    try{
      const now=this.clock();
      locked=Boolean(this.database.sqlite.prepare('UPDATE npca_worker_lock SET lease_until=? WHERE id=1 AND lease_until<=?').run(lockUntil,now).changes);
      if(!locked)return;
      this.database.sqlite.prepare("UPDATE npca_submissions SET queue_state='reconcile',next_attempt_at=?,lease_until=0 WHERE queue_state='sending' AND lease_until<?").run(now,now);
      const row=this.database.sqlite.prepare(`SELECT * FROM npca_submissions WHERE queue_state IN ('queued','retry','reconcile','waiting') AND next_attempt_at<=? AND lease_until<=? ORDER BY next_attempt_at,updated_at LIMIT 1`).get(now,now);
      if(!row)return;
      const acquired=this.database.sqlite.prepare('UPDATE npca_submissions SET lease_until=? WHERE id=? AND lease_until<=?').run(lockUntil,row.id,now);if(!acquired.changes)return;
      if(['waiting','reconcile'].includes(row.queue_state)){await this.poll(row);return;}
      const latest=this.prepare(row.patient_key);
      if(latest.errors.length||hash(latest.payload)!==row.payload_hash){this.update(row,{queue_state:'blocked',status:2,errors:JSON.stringify(latest.errors),message:'សូមពិនិត្យការកែប្រែព័ត៌មាន ហើយបញ្ជូនម្តងទៀត។',lease_until:0});return;}
      this.update(row,{queue_state:'sending',attempt:row.attempt+1});
      try{
        const body=await this.client.request('submit',parse(row.payload),{actorId:row.submitted_by,patientKey:row.patient_key,visitCode:row.visit_code});
        if(!this.accept(row,body))throw new NpcaError('response',502);
      }catch(error){
        const ambiguous=!error.httpStatus||error.httpStatus>=500;
        this.update(row,{status:ambiguous?3:2,queue_state:ambiguous?'reconcile':'blocked',message:errorText(error),errors:JSON.stringify(error.details||[]),last_http:error.httpStatus||0,
          next_attempt_at:this.clock()+this.backoff(row.attempt+1),lease_until:0});
      }
    }finally{if(locked)this.database.sqlite.prepare('UPDATE npca_worker_lock SET lease_until=0 WHERE id=1 AND lease_until=?').run(lockUntil);this.running=false;}
  }
}
