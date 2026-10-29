import crypto from 'node:crypto';
import {networkLocal,networkCall} from './emr-network.mjs';
import {networkPublicKey} from './network-signatures.mjs';
export const NETWORK_REGISTRATION_ROLES=['REGISTRATION','ADMIN','DIRECTOR','VICE_DIRECTOR'];
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
export const lookupId=value=>String(value??'').normalize('NFKC').replace(/[\u17e0-\u17e9]/g,c=>String(c.charCodeAt(0)-0x17e0)).replace(/[\s\-\u2010-\u2015\u2212]/gu,'').toLowerCase();
export function ensureNetworkRegistrationSchema(db){
 db.sqlite.function('emr_lookup_id',{deterministic:true},lookupId);
 db.sqlite.exec(`CREATE TABLE IF NOT EXISTS emr_network_registration_drafts(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,peer_id TEXT NOT NULL,peer_version INTEGER NOT NULL,local_key TEXT NOT NULL,source_patient_key TEXT NOT NULL,health_id TEXT NOT NULL,previous_local_key TEXT NOT NULL,identity_json TEXT NOT NULL,expires_at INTEGER NOT NULL,patient_key TEXT NOT NULL DEFAULT '') STRICT;`);
}
const peerFor=(db,id)=>db.sqlite.prepare('SELECT * FROM emr_network_peers WHERE id=?').get(id);
function validDraft(ctx,token){
 const row=ctx.database.sqlite.prepare('SELECT * FROM emr_network_registration_drafts WHERE token=? AND user_id=?').get(String(token||''),ctx.session.user_id),local=networkLocal(ctx.database);
 if(!row||row.expires_at<Date.now()||row.patient_key)fail(409,'សំណើចុះឈ្មោះផុតសុពលភាព សូមស្វែងរកអ្នកជំងឺម្តងទៀត');
 const peer=peerFor(ctx.database,row.peer_id);if(!local.enabled||!peer?.enabled||!peer.outgoing||!peer.search||peer.version!==row.peer_version||row.local_key!==networkPublicKey(local.signing_seed))fail(403,'មិនមានសិទ្ធិ');
 return row;
}
export function validateNetworkRegistration(ctx,body,patientKey,existing,summary,data){
 if(!body.networkRegistrationToken)return null;
 if(!NETWORK_REGISTRATION_ROLES.includes(ctx.sessionRole(ctx.session))||existing||body.editorScope!=='registration')fail(403,'មិនមានសិទ្ធិ');
 const row=validDraft(ctx,body.networkRegistrationToken),known=ctx.database.sqlite.prepare('SELECT patient_key FROM patient_records WHERE emr_lookup_id(health_id)=? ORDER BY entry_date DESC,created_at DESC LIMIT 1').get(lookupId(row.health_id));
 if((known?.patient_key||'')!==row.previous_local_key||String(body.newVisitFrom||'')!==row.previous_local_key||String(summary.healthId).trim()!==row.health_id)fail(409,'ព័ត៌មានអ្នកជំងឺបានផ្លាស់ប្តូរ សូមស្វែងរកម្តងទៀត');
 const old=data['scope:registration:id:emr_pmrs_case_old']===true||data['scope:registration:id:emr_pmrs_case_old']==='true',fresh=data['scope:registration:id:emr_pmrs_case_new']===true||data['scope:registration:id:emr_pmrs_case_new']==='true';
 if(old===fresh||old!==!!row.previous_local_key)fail(409,'ប្រភេទករណីត្រូវផ្អែកលើប្រវត្តិរបស់មន្ទីរពេទ្យនេះ');
 return row;
}
export function consumeNetworkRegistration(db,row,patientKey){
 if(!row)return;
 const peer=peerFor(db,row.peer_id),local=networkLocal(db);if(!local.enabled||!peer?.enabled||!peer.outgoing||!peer.search||peer.version!==row.peer_version||row.local_key!==networkPublicKey(local.signing_seed))fail(403,'មិនមានសិទ្ធិ');
 const known=db.sqlite.prepare('SELECT patient_key FROM patient_records WHERE emr_lookup_id(health_id)=? ORDER BY entry_date DESC,created_at DESC LIMIT 1').get(lookupId(row.health_id));if((known?.patient_key||'')!==row.previous_local_key)fail(409,'ព័ត៌មានអ្នកជំងឺបានផ្លាស់ប្តូរ សូមស្វែងរកម្តងទៀត');
 const result=db.sqlite.prepare("UPDATE emr_network_registration_drafts SET patient_key=?,identity_json='{}' WHERE token=? AND patient_key='' AND expires_at>=?").run(patientKey,row.token,Date.now());if(result.changes!==1)fail(409,'សំណើចុះឈ្មោះផុតសុពលភាព សូមស្វែងរកអ្នកជំងឺម្តងទៀត');
}
export function mountNetworkRegistrationRoutes(router){
 const role=ctx=>{if(!ctx.session)fail(401,'មិនមានសិទ្ធិ');if(!NETWORK_REGISTRATION_ROLES.includes(ctx.requireContext(ctx.session)))fail(403,'មិនមានសិទ្ធិ')};
 const send=(ctx,value)=>ctx.sendJson(ctx.response,200,value,{secure:ctx.config.cookieSecure});
 router.post('/api/emr-network/registration-draft',async ctx=>{
  role(ctx);const body=await ctx.readJson(ctx.request,3000);if(typeof body?.peerId!=='string'||typeof body.patientKey!=='string'||body.patientKey.length>180)fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
  const peer=peerFor(ctx.database,body.peerId);if(!peer)fail(404,'រកមិនឃើញ');
  const result=await networkCall(ctx,peer.id,{operation:'records',patientKey:body.patientKey}),visit=result.visits?.find(v=>v.patient?.patientKey===body.patientKey);if(!visit?.patient?.healthId?.trim())fail(409,'សូមផ្ទៀងផ្ទាត់លេខសម្គាល់អ្នកជំងឺមុនចុះឈ្មោះ');
  const local=ctx.database.sqlite.prepare('SELECT * FROM patient_records WHERE emr_lookup_id(health_id)=? ORDER BY entry_date DESC,created_at DESC LIMIT 1').get(lookupId(visit.patient.healthId));
  const source=local?ctx.patientRecordResponse(local,true):visit.patient,patient={};
  for(const key of ['healthId','firstName','lastName','fullName','sex','dateOfBirth','age','phone','equityCard'])patient[key]=source[key]||'';
  patient.data={};for(const key of ['web_nssf','web_nat','web_province','web_province_code','web_district','web_district_code','web_commune','web_commune_code','web_village','web_village_code','web_street_address','web_coverage_area','web_caregiver_name','web_caregiver_phone','web_caregiver_relation']){const value=source.data?.['scope:registration:id:'+key]??source.data?.['id:'+key];if(typeof value==='string')patient.data['scope:registration:id:'+key]=value}
  const token=crypto.randomBytes(32).toString('hex');ctx.database.sqlite.prepare("DELETE FROM emr_network_registration_drafts WHERE expires_at<? AND patient_key=''").run(Date.now());
  ctx.database.sqlite.prepare('INSERT INTO emr_network_registration_drafts(token,user_id,peer_id,peer_version,local_key,source_patient_key,health_id,previous_local_key,identity_json,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(token,ctx.session.user_id,peer.id,peer.version,networkPublicKey(networkLocal(ctx.database).signing_seed),body.patientKey,patient.healthId,local?.patient_key||'',JSON.stringify(patient),Date.now()+30*60000);
  ctx.audit(ctx.database,ctx.request,'EMR_NETWORK_REGISTRATION_PREPARED',{userId:ctx.session.user_id,details:{peerId:peer.id,sourcePatientKey:body.patientKey}});return send(ctx,{url:'/emr?view=register&networkRegistration='+token});
 },{requireSession:true});
 router.get('/api/emr-network/registration-draft',ctx=>{role(ctx);const row=validDraft(ctx,ctx.url.searchParams.get('token'));return send(ctx,{patient:JSON.parse(row.identity_json),previousLocalKey:row.previous_local_key,caseType:row.previous_local_key?'old':'new'})},{requireSession:true});
}
