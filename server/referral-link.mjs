import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {latestReferral} from './referral-forms.mjs';
import {clinicalSummary} from './clinical-summary.mjs';
import {getInterfaceTheme} from './interface-theme.mjs';
import {networkSign,networkVerify,networkRequestText,networkResponseText} from './network-signatures.mjs';

export const REFERRAL_MAX_BYTES=8*1024*1024;
export function referralVisits(ctx,row){
 const rows=row.health_id?.trim()?ctx.database.sqlite.prepare('SELECT * FROM patient_records WHERE lower(trim(health_id))=lower(trim(?)) ORDER BY entry_date DESC,created_at DESC').all(row.health_id):[row];
 // Match the source patient-history policy: authorize the referred encounter,
 // then share that identity's visits, never other identities or writable access.
 return rows.map(visit=>{
  const patient=ctx.patientRecordResponse(visit,true),data={};
  for(const [key,value] of Object.entries(patient.data||{}))if((/^(?:scope:(?:registration|triage|medical|nursing|common):|id:|auto:)/.test(key)&&!/(?:photo|password|csrf)/i.test(key))||/^system:(?:nurs|midwife|initialIpdMedications|opdMedications|dailyMonitoringRecords|doctorDailyMedicineOrders|signature:|discharge|medicalRecordCompleted)/.test(key))data[key]=value;
  patient.data=data;delete patient.photo;
  const {problems,allergies,resuscitation}=clinicalSummary(ctx.database,visit);
  return {patient,presentation:{theme:getInterfaceTheme(ctx.database)},clinical:{problems,allergies,resuscitation},form:latestReferral(ctx.database,visit.patient_key)};
 });
}

export const linkFile=path.join(os.homedir(),'Borkeo_EMR_Referral_Link','link.json');
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
export function linkSettings(config){
  if(config.referralNetworkManaged?.())return null;
  const link=config.referralLink ?? (!config.demoMode && fs.existsSync(linkFile)?JSON.parse(fs.readFileSync(linkFile,'utf8')).instances?.[String(config.port)]:null);
  if(!link)return null;
  if(!/^[a-f0-9]{64}$/.test(link.secret||'')||!['sender','receiver'].includes(link.role))fail(503,'ការតភ្ជាប់មិនទាន់រួចរាល់');
  const url=new URL(link.peer);
  if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||url.username||url.password||url.pathname!=='/'||url.search||url.hash)fail(503,'ការតភ្ជាប់មិនទាន់រួចរាល់');
  return {...link,peer:url.origin};
}
export function ensureReferralLinkSchema(db){db.sqlite.exec(`
 CREATE TABLE IF NOT EXISTS referral_outbox(id TEXT PRIMARY KEY,patient_key TEXT NOT NULL,revision INTEGER NOT NULL,payload TEXT NOT NULL,status TEXT NOT NULL,accepted_at INTEGER,created_at INTEGER NOT NULL,UNIQUE(patient_key,revision)) STRICT;
 CREATE TABLE IF NOT EXISTS referral_inbox(id TEXT PRIMARY KEY,payload TEXT NOT NULL,digest TEXT NOT NULL,status TEXT NOT NULL,received_at INTEGER NOT NULL,accepted_at INTEGER,accepted_by TEXT) STRICT;
 CREATE TABLE IF NOT EXISTS referral_link_nonces(nonce TEXT PRIMARY KEY,created_at INTEGER NOT NULL) STRICT;
`);
 for(const table of ['referral_inbox','referral_outbox']){
  const columns=new Set(db.sqlite.prepare('PRAGMA table_info('+table+')').all().map(c=>c.name));
  for(const [name,type] of [['rejection_reason',"TEXT NOT NULL DEFAULT ''"],['rejected_at','INTEGER'],...(table==='referral_inbox'?[['rejected_by','TEXT']]:[])])if(!columns.has(name))db.sqlite.exec('ALTER TABLE '+table+' ADD COLUMN '+name+' '+type);
 }
}
export const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
export const mac=(secret,value)=>crypto.createHmac('sha256',secret).update(value).digest('hex');
const equal=(a,b)=>typeof a==='string'&&typeof b==='string'&&a.length===b.length&&crypto.timingSafeEqual(Buffer.from(a),Buffer.from(b));
export function checkEnvelope(db,link,envelope){
 if(!link||!['sender','receiver'].includes(link.role))fail(503,'ការតភ្ជាប់មិនទាន់រួចរាល់');
 const {timestamp,nonce,body,signature}=envelope||{};
 if(!Number.isSafeInteger(timestamp)||Math.abs(Date.now()-timestamp)>60000||!/^[-a-f0-9]{36}$/.test(nonce||'')||!/^[a-f0-9]{64}$/.test(signature||'')||!equal(signature,mac(link.secret,JSON.stringify({timestamp,nonce,body}))))fail(403,'មិនមានសិទ្ធិ');
 db.sqlite.prepare('DELETE FROM referral_link_nonces WHERE created_at<?').run(Date.now()-120000);
 if(db.sqlite.prepare('SELECT 1 FROM referral_link_nonces WHERE nonce=?').get(nonce))fail(409,'សំណើដដែល');
 db.sqlite.prepare('INSERT INTO referral_link_nonces VALUES(?,?)').run(nonce,Date.now());
 return body;
}
export async function peerCall(link,body){
 if(typeof link?.invoke==='function')return link.invoke(body);
 if(!link||(link.role!=='sender'&&!(link.role==='receiver'&&body.operation==='history')))fail(503,'ការតភ្ជាប់មិនទាន់រួចរាល់');
 const request={timestamp:Date.now(),nonce:crypto.randomUUID(),body};
 request.signature=mac(link.secret,JSON.stringify(request));
 if(link.networkFrom){request.from=link.networkFrom;request.to=link.networkTo;request.auth=networkSign(link.signingSeed,networkRequestText(request))}
 try{
  const response=await fetch(link.peer+(link.networkFrom?'/api/emr-network/rpc':'/api/referral-link'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),redirect:'error',signal:AbortSignal.timeout(8000)});
  if(!response.ok)throw Error('peer');
  const maximum=['history','records'].includes(body.operation)?REFERRAL_MAX_BYTES+200000:['search','doctors'].includes(body.operation)?200000:20000;
  const chunks=[];let size=0;for await(const chunk of response.body){size+=chunk.byteLength;if(size>maximum)throw Error('peer');chunks.push(Buffer.from(chunk))}const raw=Buffer.concat(chunks).toString('utf8');
  const result=JSON.parse(raw);
  if(link.networkFrom&&!networkVerify(link.peerVerifyKey,networkResponseText(request.nonce,result.body),result.auth))throw Error('signature');
  if(!equal(result.signature,mac(link.secret,request.nonce+JSON.stringify(result.body))))throw Error('signature');
  return result.body;
 }catch{fail(503,'មិនអាចបញ្ជូនបាន សូមព្យាយាមម្ដងទៀត')}
}
export function receiveReferral(db,body){
 const id=body?.id;
 if(!/^[-a-f0-9]{36}$/.test(id||''))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
 if(body.operation==='deliver'){
  const p=body.payload;
  if(!p||p.id!==id||typeof p.patient?.fullName!=='string'||!p.form?.signature||!Number.isSafeInteger(p.form.revision)||Buffer.byteLength(JSON.stringify(p))>REFERRAL_MAX_BYTES)fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
  const prior=db.sqlite.prepare('SELECT * FROM referral_inbox WHERE id=?').get(id);
  if(prior&&prior.digest!==digest(p))fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');
  if(!prior)db.sqlite.prepare("INSERT INTO referral_inbox(id,payload,digest,status,received_at) VALUES(?,?,?,'PENDING',?)").run(id,JSON.stringify(p),digest(p),Date.now());
 }else if(body.operation!=='status')fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
 const row=db.sqlite.prepare('SELECT id,digest,status,accepted_at,rejected_at,rejection_reason FROM referral_inbox WHERE id=?').get(id);
 if(!row)fail(404,'រកមិនឃើញ');
 return {id:row.id,digest:row.digest,status:row.status,acceptedAt:row.accepted_at,rejectedAt:row.rejected_at,rejectionReason:row.rejection_reason};
}
