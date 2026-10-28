import {networkLocal,networkCapabilities,referralNetworkLink} from '../emr-network.mjs';
import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import {referralAccess,latestReferral} from '../referral-forms.mjs';
import {linkSettings,checkEnvelope,mac,peerCall,receiveReferral,digest,referralVisits,REFERRAL_MAX_BYTES} from '../referral-link.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const statusOf=row=>row?{id:row.id,revision:row.revision,status:row.status,acceptedAt:row.accepted_at,peerId:row.peer_id,rejectedAt:row.rejected_at,rejectionReason:row.rejection_reason}:null;
const canReject=ctx=>['DOCTOR','CHIEF_WARD','ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(ctx.sessionRole(ctx.session));
export function mountReferralLinkRoutes(router){
 const send=(ctx,body)=>ctx.sendJson(ctx.response,200,body,{secure:ctx.config.cookieSecure});
 const receiver=ctx=>{if(networkLocal(ctx.database).managed)return {role:'receiver',network:true};const link=linkSettings(ctx.config);if(link?.role!=='receiver')fail(403,'មិនមានសិទ្ធិ');return link};
 const session=ctx=>{if(!ctx.session||!ctx.sessionRole(ctx.session))fail(401,'សូមចូលប្រើប្រព័ន្ធជាមុន')};
 router.get('/api/referral-capabilities',ctx=>{session(ctx);return send(ctx,networkLocal(ctx.database).managed?networkCapabilities(ctx):{receiver:linkSettings(ctx.config)?.role==='receiver',sender:linkSettings(ctx.config)?.role==='sender'})},{requireSession:true});
 router.post('/api/referral-link',async ctx=>{
  const envelope=await ctx.readJson(ctx.request,REFERRAL_MAX_BYTES+200000),link=linkSettings(ctx.config);
  const body=checkEnvelope(ctx.database,link,envelope);let result;
  if(link.role==='sender'){
   if(body?.operation!=='history')fail(403,'មិនមានសិទ្ធិ');
   const sent=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE id=?').get(String(body.id||''));if(!sent)fail(404,'រកមិនឃើញ');
   const row=ctx.database.findPatient(sent.patient_key);if(!row)fail(404,'រកមិនឃើញ');
   result={id:sent.id,patientKey:sent.patient_key,visits:referralVisits(ctx,row),reviewedAt:Date.now()};
   if(Buffer.byteLength(JSON.stringify(result))>REFERRAL_MAX_BYTES)fail(413,'ទិន្នន័យមិនត្រឹមត្រូវ');
   ctx.audit(ctx.database,ctx.request,'REFERRAL_HISTORY_SHARED',{details:{transferId:sent.id,patientKey:sent.patient_key}});
  }else result=receiveReferral(ctx.database,body);
  if(body.operation==='deliver')ctx.audit(ctx.database,ctx.request,'REFERRAL_RECEIVED',{details:{transferId:body.id}});
  return send(ctx,{body:result,signature:mac(link.secret,envelope.nonce+JSON.stringify(result))});
 },{skipCsrf:true}); // Authenticated by timestamped HMAC; browser cookies are never used.
 router.post('/api/referral-send',async ctx=>{
  const body=await ctx.readJson(ctx.request,2000),key=String(body.patientKey||'');
  const {row,canEdit}=referralAccess(ctx.database,ctx.session,key,ctx.opdConsultationPaymentConfirmed);
  if(!canEdit)fail(403,'មិនមានសិទ្ធិ');
  const link=referralNetworkLink(ctx,body.peerId),form=latestReferral(ctx.database,key);
  if(!form?.signature||form.revision!==body.revision)fail(409,'សូមរក្សាទុក និងចុះហត្ថលេខាជាមុន');
  if(link?.role!=='sender')fail(503,'ការតភ្ជាប់មិនទាន់រួចរាល់');
  let transfer=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE patient_key=? AND revision=?').get(key,form.revision);
  if(transfer&&(transfer.peer_id||'')!==(link.peerId||''))fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');
  if(!transfer){
   const previous=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE patient_key=? LIMIT 1').get(key);
   if(previous)fail(409,'បានបញ្ជូនរួចហើយ');
   const id=crypto.randomUUID(),patient={};
   const summary=ctx.patientRecordResponse(row,false);
   for(const key of ['patientKey','fullName','healthId','sex','dateOfBirth','age','phone','equityCard','paymentType','departmentCode','departmentNameKh','serviceMode','entryDate','dischargeDate'])patient[key]=summary[key]||'';
   const payload={id,sourceInstanceId:networkLocal(ctx.database).managed?networkLocal(ctx.database).id:undefined,source:'បរកែវ',patient,form,visits:referralVisits(ctx,row),sentAt:Date.now()};
   if(link.peerId)payload.source=networkLocal(ctx.database).name;
   if(Buffer.byteLength(JSON.stringify(payload))>REFERRAL_MAX_BYTES)fail(413,'ទិន្នន័យមិនត្រឹមត្រូវ');
   ctx.database.sqlite.prepare("INSERT INTO referral_outbox(id,patient_key,revision,payload,status,created_at,peer_id) VALUES(?,?,?,?,'SENDING',?,?)").run(id,key,form.revision,JSON.stringify(payload),Date.now(),link.peerId||'');
   transfer=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE id=?').get(id);
  }
  const payload=JSON.parse(transfer.payload);
  try{
   const result=await peerCall(link,{operation:'deliver',id:transfer.id,payload});
   if(result.id!==transfer.id||result.digest!==digest(payload)||!['PENDING','ACCEPTED','REJECTED'].includes(result.status))fail(503,'ទិន្នន័យមិនត្រឹមត្រូវ');
   ctx.database.sqlite.prepare('UPDATE referral_outbox SET status=?,accepted_at=?,rejected_at=?,rejection_reason=? WHERE id=?').run(result.status,result.acceptedAt||null,result.rejectedAt||null,result.rejectionReason||'',transfer.id);
  }catch(error){ctx.database.sqlite.prepare("UPDATE referral_outbox SET status='RETRY' WHERE id=? AND status NOT IN ('ACCEPTED','REJECTED')").run(transfer.id);throw error}
  ctx.audit(ctx.database,ctx.request,'REFERRAL_SENT',{userId:ctx.session.user_id,details:{patientKey:key,transferId:transfer.id,revision:form.revision}});
  return send(ctx,{transfer:statusOf(ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE id=?').get(transfer.id))});
 },{requireSession:true});
 router.get('/api/referral-status',async ctx=>{
  const key=String(ctx.url.searchParams.get('patientKey')||'');referralAccess(ctx.database,ctx.session,key,ctx.opdConsultationPaymentConfirmed);
  let row=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE patient_key=? ORDER BY created_at DESC LIMIT 1').get(key);
  let unavailable=false;
  if(row&&!['ACCEPTED','REJECTED'].includes(row.status))try{
   if(networkLocal(ctx.database).managed&&!row.peer_id)throw Error('unbound legacy transfer');
   const result=await peerCall(referralNetworkLink(ctx,row.peer_id),{operation:'status',id:row.id});
   if(result.id!==row.id||result.digest!==digest(JSON.parse(row.payload))||!['PENDING','ACCEPTED','REJECTED'].includes(result.status))throw Error('invalid');
   ctx.database.sqlite.prepare('UPDATE referral_outbox SET status=?,accepted_at=?,rejected_at=?,rejection_reason=? WHERE id=?').run(result.status,result.acceptedAt||null,result.rejectedAt||null,result.rejectionReason||'',row.id);
   row=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE id=?').get(row.id);
  }catch{unavailable=true}
  return send(ctx,{transfer:statusOf(row),unavailable});
 },{requireSession:true});
 router.get('/referrals',ctx=>{session(ctx);receiver(ctx);return ctx.sendFile(ctx.response,path.join(ctx.config.protectedDirectory,'referrals.html'),'text/html; charset=utf-8',{secure:ctx.config.cookieSecure,request:ctx.request,requestPath:'/referrals',review:true})},{requireSession:true});
 router.get('/api/referral-inbox',ctx=>{session(ctx);receiver(ctx);const rows=ctx.database.sqlite.prepare('SELECT * FROM referral_inbox ORDER BY received_at DESC').all();return send(ctx,{canReject:canReject(ctx),referrals:rows.map(row=>{const payload=JSON.parse(row.payload);delete payload.visits;return {id:row.id,status:row.status,receivedAt:row.received_at,acceptedAt:row.accepted_at,rejectionReason:row.rejection_reason,rejectedAt:row.rejected_at,payload}})})},{requireSession:true});
 router.get('/api/referral-history',async ctx=>{
  session(ctx);const link=receiver(ctx),id=String(ctx.url.searchParams.get('id')||'');
  const row=ctx.database.sqlite.prepare('SELECT * FROM referral_inbox WHERE id=?').get(id);if(!row)fail(404,'រកមិនឃើញ');
  const payload=JSON.parse(row.payload);let visits=payload.visits||[],unavailable=false,patientKey=payload.patient.patientKey;
  try{if(link.network&&!row.peer_id)throw Error('unbound legacy transfer');const current=await peerCall(link.network?referralNetworkLink(ctx,row.peer_id):link,{operation:'history',id});if(current.id!==id||!Array.isArray(current.visits))throw Error('invalid');visits=current.visits;patientKey=current.patientKey}catch{unavailable=true}
  // The delivered referral remains immutable even when newer source visits exist.
  for(const visit of visits)if(visit.patient.patientKey===patientKey||visit.form?.id===payload.form.id)visit.form=payload.form;
  if(!visits.length)visits=[{patient:payload.patient,form:payload.form,unavailable:true}];
  ctx.audit(ctx.database,ctx.request,'REFERRAL_HISTORY_VIEWED',{userId:ctx.session.user_id,details:{transferId:id}});
  return send(ctx,{visits,unavailable});
 },{requireSession:true});
 router.get('/api/referral-record-template',ctx=>{session(ctx);receiver(ctx);return send(ctx,{html:fs.readFileSync(path.join(ctx.config.protectedDirectory,'EMR.html'),'utf8')})},{requireSession:true});
 router.post('/api/referral-accept',async ctx=>{
  session(ctx);receiver(ctx);const body=await ctx.readJson(ctx.request,2000);
  const row=ctx.database.sqlite.prepare('SELECT * FROM referral_inbox WHERE id=?').get(String(body.id||''));if(!row)fail(404,'រកមិនឃើញ');
  if(row.status==='REJECTED')fail(409,'លិខិតបញ្ជូននេះបានបដិសេធរួចហើយ');
  const changed=ctx.database.sqlite.prepare("UPDATE referral_inbox SET status='ACCEPTED',accepted_at=?,accepted_by=? WHERE id=? AND status='PENDING'").run(Date.now(),ctx.session.user_id,row.id);
  if(changed.changes)ctx.audit(ctx.database,ctx.request,'REFERRAL_ACCEPTED',{userId:ctx.session.user_id,details:{transferId:row.id}});
  return send(ctx,{ok:true});
 },{requireSession:true});
 router.post('/api/referral-reject',async ctx=>{
  session(ctx);receiver(ctx);if(!canReject(ctx))fail(403,'មិនមានសិទ្ធិ');
  const body=await ctx.readJson(ctx.request,6000),reason=typeof body.reason==='string'?body.reason.trim():'';
  if(!reason||reason.length>1000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(reason))fail(400,'សូមបញ្ចូលមូលហេតុបដិសេធ');
  const row=ctx.database.sqlite.prepare('SELECT * FROM referral_inbox WHERE id=?').get(String(body.id||''));if(!row)fail(404,'រកមិនឃើញ');
  if(row.status==='ACCEPTED')fail(409,'លិខិតបញ្ជូននេះបានទទួលរួចហើយ');
  const changed=ctx.database.sqlite.prepare("UPDATE referral_inbox SET status='REJECTED',rejection_reason=?,rejected_at=?,rejected_by=? WHERE id=? AND status='PENDING'").run(reason,Date.now(),ctx.session.user_id,row.id);
  if(changed.changes)ctx.audit(ctx.database,ctx.request,'REFERRAL_REJECTED',{userId:ctx.session.user_id,details:{transferId:row.id}});
  return send(ctx,{ok:true});
 },{requireSession:true});
}
