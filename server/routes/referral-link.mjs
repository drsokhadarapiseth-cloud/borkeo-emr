import path from 'node:path';
import crypto from 'node:crypto';
import {referralAccess,latestReferral} from '../referral-forms.mjs';
import {linkSettings,checkEnvelope,mac,peerCall,receiveReferral,digest} from '../referral-link.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const statusOf=row=>row?{id:row.id,revision:row.revision,status:row.status,acceptedAt:row.accepted_at}:null;
export function mountReferralLinkRoutes(router){
 const send=(ctx,body)=>ctx.sendJson(ctx.response,200,body,{secure:ctx.config.cookieSecure});
 const receiver=ctx=>{const link=linkSettings(ctx.config);if(link?.role!=='receiver')fail(403,'មិនមានសិទ្ធិ');return link};
 const session=ctx=>{if(!ctx.session||!ctx.sessionRole(ctx.session))fail(401,'សូមចូលប្រើប្រព័ន្ធជាមុន')};
 router.get('/api/referral-capabilities',ctx=>{session(ctx);return send(ctx,{receiver:linkSettings(ctx.config)?.role==='receiver',sender:linkSettings(ctx.config)?.role==='sender'})},{requireSession:true});
 router.post('/api/referral-link',async ctx=>{
  const envelope=await ctx.readJson(ctx.request,360000),link=linkSettings(ctx.config);
  const body=checkEnvelope(ctx.database,link,envelope),result=receiveReferral(ctx.database,body);
  if(body.operation==='deliver')ctx.audit(ctx.database,ctx.request,'REFERRAL_RECEIVED',{details:{transferId:body.id}});
  return send(ctx,{body:result,signature:mac(link.secret,envelope.nonce+JSON.stringify(result))});
 },{skipCsrf:true}); // Authenticated by timestamped HMAC; browser cookies are never used.
 router.post('/api/referral-send',async ctx=>{
  const body=await ctx.readJson(ctx.request,2000),key=String(body.patientKey||'');
  const {row,canEdit}=referralAccess(ctx.database,ctx.session,key,ctx.opdConsultationPaymentConfirmed);
  if(!canEdit)fail(403,'មិនមានសិទ្ធិ');
  const link=linkSettings(ctx.config),form=latestReferral(ctx.database,key);
  if(!form?.signature||form.revision!==body.revision)fail(409,'សូមរក្សាទុក និងចុះហត្ថលេខាជាមុន');
  if(link?.role!=='sender')fail(503,'ការតភ្ជាប់មិនទាន់រួចរាល់');
  let transfer=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE patient_key=? AND revision=?').get(key,form.revision);
  if(!transfer){
   const previous=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE patient_key=? LIMIT 1').get(key);
   if(previous)fail(409,'បានបញ្ជូនរួចហើយ');
   const id=crypto.randomUUID(),patient={};
   for(const [target,source] of Object.entries({fullName:'full_name',healthId:'health_id',sex:'sex',dateOfBirth:'date_of_birth',age:'age',phone:'phone',departmentCode:'department_code',serviceMode:'service_mode'}))patient[target]=row[source]||'';
   const payload={id,source:'បរកែវ',patient,form,sentAt:Date.now()};
   ctx.database.sqlite.prepare("INSERT INTO referral_outbox(id,patient_key,revision,payload,status,created_at) VALUES(?,?,?,?,'SENDING',?)").run(id,key,form.revision,JSON.stringify(payload),Date.now());
   transfer=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE id=?').get(id);
  }
  const payload=JSON.parse(transfer.payload);
  try{
   const result=await peerCall(link,{operation:'deliver',id:transfer.id,payload});
   if(result.id!==transfer.id||result.digest!==digest(payload)||!['PENDING','ACCEPTED'].includes(result.status))fail(503,'ទិន្នន័យមិនត្រឹមត្រូវ');
   ctx.database.sqlite.prepare('UPDATE referral_outbox SET status=?,accepted_at=? WHERE id=?').run(result.status,result.acceptedAt||null,transfer.id);
  }catch(error){ctx.database.sqlite.prepare("UPDATE referral_outbox SET status='RETRY' WHERE id=? AND status!='ACCEPTED'").run(transfer.id);throw error}
  ctx.audit(ctx.database,ctx.request,'REFERRAL_SENT',{userId:ctx.session.user_id,details:{patientKey:key,transferId:transfer.id,revision:form.revision}});
  return send(ctx,{transfer:statusOf(ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE id=?').get(transfer.id))});
 },{requireSession:true});
 router.get('/api/referral-status',async ctx=>{
  const key=String(ctx.url.searchParams.get('patientKey')||'');referralAccess(ctx.database,ctx.session,key,ctx.opdConsultationPaymentConfirmed);
  let row=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE patient_key=? ORDER BY created_at DESC LIMIT 1').get(key);
  let unavailable=false;
  if(row&&row.status!=='ACCEPTED')try{
   const result=await peerCall(linkSettings(ctx.config),{operation:'status',id:row.id});
   if(result.id!==row.id||result.digest!==digest(JSON.parse(row.payload))||!['PENDING','ACCEPTED'].includes(result.status))throw Error('invalid');
   ctx.database.sqlite.prepare('UPDATE referral_outbox SET status=?,accepted_at=? WHERE id=?').run(result.status,result.acceptedAt||null,row.id);
   row=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE id=?').get(row.id);
  }catch{unavailable=true}
  return send(ctx,{transfer:statusOf(row),unavailable});
 },{requireSession:true});
 router.get('/referrals',ctx=>{session(ctx);receiver(ctx);return ctx.sendFile(ctx.response,path.join(ctx.config.protectedDirectory,'referrals.html'),'text/html; charset=utf-8',{secure:ctx.config.cookieSecure,request:ctx.request,requestPath:'/referrals'})},{requireSession:true});
 router.get('/api/referral-inbox',ctx=>{session(ctx);receiver(ctx);const rows=ctx.database.sqlite.prepare('SELECT * FROM referral_inbox ORDER BY received_at DESC').all();return send(ctx,{referrals:rows.map(row=>({id:row.id,status:row.status,receivedAt:row.received_at,acceptedAt:row.accepted_at,payload:JSON.parse(row.payload)}))})},{requireSession:true});
 router.post('/api/referral-accept',async ctx=>{
  session(ctx);receiver(ctx);const body=await ctx.readJson(ctx.request,2000);
  const row=ctx.database.sqlite.prepare('SELECT * FROM referral_inbox WHERE id=?').get(String(body.id||''));if(!row)fail(404,'រកមិនឃើញ');
  const changed=ctx.database.sqlite.prepare("UPDATE referral_inbox SET status='ACCEPTED',accepted_at=?,accepted_by=? WHERE id=? AND status='PENDING'").run(Date.now(),ctx.session.user_id,row.id);
  if(changed.changes)ctx.audit(ctx.database,ctx.request,'REFERRAL_ACCEPTED',{userId:ctx.session.user_id,details:{transferId:row.id}});
  return send(ctx,{ok:true});
 },{requireSession:true});
}
