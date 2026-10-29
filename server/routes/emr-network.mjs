import path from 'node:path';
import crypto from 'node:crypto';
import {searchMode,searchPatients} from '../network-search.mjs';
import {CHAT_ROLES,CHAT_JSON_LIMIT,staffDirectory,validateAttachments,attachmentMetadata,sameAttachments,saveChat} from '../network-chat.mjs';
import {encounterAccess} from '../encounter-access.mjs';
import {networkLocal,networkPeers,publicPeer,savePeer,apiToken,networkCall,incomingPairKey,REVIEW_ROLES} from '../emr-network.mjs';
import {checkEnvelope,mac,receiveReferral,referralVisits,REFERRAL_MAX_BYTES} from '../referral-link.mjs';
import {networkPublicKey,networkSign,networkVerify,networkRequestText,networkResponseText} from '../network-signatures.mjs';
import {mountConnectionRequestRoutes,receiveConnectionControl} from '../network-requests.mjs';
import {mountNetworkRegistrationRoutes,NETWORK_REGISTRATION_ROLES,lookupId} from '../network-registration.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(String(value||''));
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');return v.trim()};
const role=(ctx,roles)=>{if(!ctx.session)fail(401,'សូមចូលប្រើប្រព័ន្ធជាមុន');if(!roles.includes(ctx.requireContext(ctx.session)))fail(403,'មិនមានសិទ្ធិ')};
const summary=patient=>Object.fromEntries(['patientKey','caseNumber','healthId','fullName','sex','age','phone','departmentCode','departmentNameKh','entryDate','dischargeDate','serviceMode'].map(k=>[k,patient[k]]));
export function mountEmrNetworkRoutes(router){
 mountConnectionRequestRoutes(router);
 mountNetworkRegistrationRoutes(router);
 const send=(ctx,body)=>ctx.sendJson(ctx.response,200,body,{secure:ctx.config.cookieSecure});
 const audit=(ctx,action,details={})=>ctx.audit(ctx.database,ctx.request,action,{userId:ctx.session?.user_id,details});
 const opts={requireSession:true};
 for(const [url,file,roles] of [['/admin/emr-connections','emr-connections.html',['ADMIN']],['/connected-emrs','connected-emrs.html',REVIEW_ROLES],['/connected-record','connected-record.html',REVIEW_ROLES]])router.get(url,ctx=>{role(ctx,roles);return ctx.sendFile(ctx.response,path.join(ctx.config.protectedDirectory,file),'text/html; charset=utf-8',{secure:ctx.config.cookieSecure,request:ctx.request,requestPath:url,review:url!=='/admin/emr-connections'})},opts);
 router.get('/api/emr-network/settings',ctx=>{role(ctx,['ADMIN']);const local=networkLocal(ctx.database);return send(ctx,{local:{id:local.id,name:local.name,enabled:!!local.enabled,managed:!!local.managed,version:local.version,keyHint:'••••'+networkPublicKey(local.signing_seed).slice(-4)},peers:networkPeers(ctx.database).map(publicPeer)})},opts);
 router.post('/api/emr-network/local',async ctx=>{
  role(ctx,['ADMIN']);const body=await ctx.readJson(ctx.request,3000),local=networkLocal(ctx.database),name=text(body.name,160);
  if(body.version!==local.version)fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');if(typeof body.enabled!=='boolean')fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
  ctx.database.sqlite.prepare('UPDATE emr_network_local SET name=?,enabled=?,managed=1,version=version+1 WHERE id=? AND version=?').run(name,Number(body.enabled),local.id,local.version);audit(ctx,'EMR_NETWORK_SETTINGS_CHANGED');return send(ctx,{ok:true});
 },opts);
 router.post('/api/emr-network/key',async ctx=>{
  role(ctx,['ADMIN']);const body=await ctx.readJson(ctx.request,2000),local=networkLocal(ctx.database);
  if(body.rotate===true){if(body.version!==local.version)fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');ctx.database.sqlite.prepare('UPDATE emr_network_local SET signing_seed=?,version=version+1 WHERE id=? AND version=?').run(crypto.randomBytes(32).toString('hex'),local.id,local.version);audit(ctx,'EMR_NETWORK_KEY_ROTATED')}
  else audit(ctx,'EMR_NETWORK_KEY_COPIED');
  return send(ctx,body.rotate===true?{ok:true}:{apiKey:apiToken(networkLocal(ctx.database))});
 },opts);
 router.post('/api/emr-network/peers',async ctx=>{role(ctx,['ADMIN']);const peer=savePeer(ctx.database,ctx.config,await ctx.readJson(ctx.request,12000));audit(ctx,'EMR_NETWORK_PEER_SAVED',{peerId:peer.id});return send(ctx,{peer:publicPeer(peer)})},opts);
 router.post('/api/emr-network/test',async ctx=>{role(ctx,['ADMIN']);const body=await ctx.readJson(ctx.request,2000),result=await networkCall(ctx,String(body.peerId||''),{operation:'ping'},{probe:true});audit(ctx,'EMR_NETWORK_CONNECTION_TESTED',{peerId:body.peerId});return send(ctx,{result})},opts);
 router.get('/api/emr-network/connections',ctx=>{role(ctx,REVIEW_ROLES);const local=networkLocal(ctx.database);return send(ctx,{doctor:CHAT_ROLES.includes(ctx.sessionRole(ctx.session)),canMessage:CHAT_ROLES.includes(ctx.sessionRole(ctx.session)),canRegister:NETWORK_REGISTRATION_ROLES.includes(ctx.sessionRole(ctx.session)),peers:local.managed&&local.enabled?networkPeers(ctx.database).filter(p=>p.enabled&&p.outgoing).map(p=>({id:p.id,name:p.name,search:!!p.search,messages:!!p.messages})):[]})},opts);
 router.get('/api/emr-network/local-search',ctx=>{ctx.requireContext(ctx.session);const rows=searchPatients(ctx.database,text(ctx.url.searchParams.get('q'),120),ctx.url.searchParams.get('mode')||'id');audit(ctx,'EMR_LOCAL_PATIENT_SEARCH');return send(ctx,{patients:rows.map(row=>({...summary(ctx.patientRecordResponse(row,false)),canOpenRecord:ctx.canAccessPatient(ctx.database,ctx.session,row),recordAccess:encounterAccess(ctx.database,ctx.session,row)}))})},opts);
 router.get('/api/emr-network/search',async ctx=>{role(ctx,REVIEW_ROLES);const peerId=String(ctx.url.searchParams.get('peerId')||''),q=text(ctx.url.searchParams.get('q'),120);if(q.length<3)fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');const result=await networkCall(ctx,peerId,{operation:'search',q,mode:searchMode(ctx.url.searchParams.get('mode')||'all'),offset:Number(ctx.url.searchParams.get('offset')||0)});
  const known=ctx.database.sqlite.prepare('SELECT 1 FROM patient_records WHERE emr_lookup_id(health_id)=? LIMIT 1');
  result.patients=result.patients.map(patient=>({...patient,localCaseType:typeof patient.healthId==='string'&&patient.healthId.trim()&&known.get(lookupId(patient.healthId))?'old':'new'}));
  audit(ctx,'EMR_NETWORK_PATIENT_SEARCH',{peerId});return send(ctx,result)},opts);
 router.post('/api/emr-network/local-search',async ctx=>{ctx.requireContext(ctx.session);const body=await ctx.readJson(ctx.request,2000),rows=searchPatients(ctx.database,text(body.q,120),searchMode(body.mode||'id'),0,'exact');audit(ctx,'EMR_LOCAL_PATIENT_SEARCH');return send(ctx,{patients:rows.map(row=>({...summary(ctx.patientRecordResponse(row,false)),canOpenRecord:ctx.canAccessPatient(ctx.database,ctx.session,row),recordAccess:encounterAccess(ctx.database,ctx.session,row)}))})},opts);
 router.post('/api/emr-network/search',async ctx=>{role(ctx,REVIEW_ROLES);const body=await ctx.readJson(ctx.request,2000),peerId=text(body.peerId,36),q=text(body.q,120),mode=searchMode(body.mode||'id');if(mode==='all')fail(400,'\u1791\u17b7\u1793\u17d2\u1793\u1793\u17d0\u1799\u1798\u17b7\u1793\u178f\u17d2\u179a\u17b9\u1798\u178f\u17d2\u179a\u17bc\u179c');const result=await networkCall(ctx,peerId,{operation:'search',q,mode,match:'exact'}),known=ctx.database.sqlite.prepare('SELECT 1 FROM patient_records WHERE emr_lookup_id(health_id)=? LIMIT 1');result.patients=result.patients.map(patient=>({...patient,localCaseType:patient.healthId&&known.get(lookupId(patient.healthId))?'old':'new'}));audit(ctx,'EMR_NETWORK_PATIENT_SEARCH',{peerId});return send(ctx,result)},opts);
 router.get('/api/emr-network/records',async ctx=>{role(ctx,REVIEW_ROLES);const peerId=String(ctx.url.searchParams.get('peerId')||''),patientKey=text(ctx.url.searchParams.get('patientKey'),180),result=await networkCall(ctx,peerId,{operation:'records',patientKey});audit(ctx,'EMR_NETWORK_RECORD_VIEWED',{peerId,patientKey});return send(ctx,{...result,readOnly:true})},opts);
 router.get('/api/emr-network/doctors',async ctx=>{role(ctx,REVIEW_ROLES);return send(ctx,await networkCall(ctx,String(ctx.url.searchParams.get('peerId')||''),{operation:'doctors'}))},opts);
 router.get('/api/emr-network/messages',ctx=>{role(ctx,CHAT_ROLES);return send(ctx,{messages:ctx.database.sqlite.prepare('SELECT m.id,m.peer_id,m.direction,m.sender_name,m.recipient_name,m.subject,m.body,m.state,m.created_at,p.name AS facility FROM emr_network_messages m JOIN emr_network_peers p ON p.id=m.peer_id WHERE (direction=\'IN\' AND recipient_id=?) OR (direction=\'OUT\' AND sender_id=?) ORDER BY created_at DESC LIMIT 100').all(ctx.session.user_id,ctx.session.user_id).map(m=>({...m,attachments:attachmentMetadata(ctx.database,m.id)}))})},opts);
 router.post('/api/emr-network/messages',async ctx=>{
  role(ctx,CHAT_ROLES);const body=await ctx.readJson(ctx.request,CHAT_JSON_LIMIT),peerId=text(body.peerId,36),id=String(body.id||'');if(!uuid(id)||!uuid(body.recipientId))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
  const files=validateAttachments(body.attachments),subject=text(body.subject,200),message=text(body.body,6000),sender=ctx.database.sqlite.prepare('SELECT id,display_name FROM users WHERE id=?').get(ctx.session.user_id);
  let row=ctx.database.sqlite.prepare('SELECT * FROM emr_network_messages WHERE id=?').get(id);
  if(row&&(row.direction!=='OUT'||row.sender_id!==sender.id||row.peer_id!==peerId||row.recipient_id!==body.recipientId||row.subject!==subject||row.body!==message||!sameAttachments(ctx.database,id,files)))fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');
  if(row?.state==='DELIVERED')return send(ctx,{ok:true});
  const directory=await networkCall(ctx,peerId,{operation:'doctors'}),recipient=directory.doctors.find(d=>d.id===body.recipientId);if(!recipient)fail(400,'រកមិនឃើញ');
  if(!row)saveChat(ctx.database,[id,peerId,'OUT',sender.id,sender.display_name,recipient.id,recipient.display_name,subject,message,'PENDING',Date.now()],files);
  try{const result=await networkCall(ctx,peerId,{operation:'message',id,sender:{id:sender.id,name:sender.display_name},recipientId:recipient.id,subject,body:message,attachments:files.map(f=>({name:f.name,mime:f.mime,data:f.content.toString('base64')}))});if(result.id!==id)fail(503,'ទិន្នន័យមិនត្រឹមត្រូវ');ctx.database.sqlite.prepare("UPDATE emr_network_messages SET state='DELIVERED' WHERE id=?").run(id)}catch(error){ctx.database.sqlite.prepare("UPDATE emr_network_messages SET state='RETRY' WHERE id=?").run(id);throw error}
  audit(ctx,'EMR_NETWORK_MESSAGE_SENT',{peerId,messageId:id});return send(ctx,{ok:true});
 },opts);
 router.get('/api/emr-network/attachment',ctx=>{
  role(ctx,CHAT_ROLES);const f=ctx.database.sqlite.prepare('SELECT a.*,m.direction,m.sender_id,m.recipient_id,p.enabled,p.incoming,p.outgoing,p.messages FROM emr_network_attachments a JOIN emr_network_messages m ON m.id=a.message_id JOIN emr_network_peers p ON p.id=m.peer_id WHERE a.id=?').get(String(ctx.url.searchParams.get('id')||'')),local=networkLocal(ctx.database);
  if(!f||!local.enabled||!local.managed||!f.enabled||!f.messages||(f.direction==='OUT'?f.sender_id!==ctx.session.user_id||!f.outgoing:f.recipient_id!==ctx.session.user_id||!f.incoming))fail(404,'រកមិនឃើញ');
  audit(ctx,'EMR_NETWORK_ATTACHMENT_DOWNLOADED',{attachmentId:f.id});ctx.response.writeHead(200,{'Content-Type':'application/octet-stream','Content-Length':f.content.length,'Content-Disposition':"attachment; filename=attachment; filename*=UTF-8''"+encodeURIComponent(f.name),'X-Content-Type-Options':'nosniff','Cache-Control':'no-store','Content-Security-Policy':"default-src 'none'; sandbox"});ctx.response.end(Buffer.from(f.content));
 },opts);
 const rate=new Map();
 router.post('/api/emr-network/rpc',async ctx=>{
  const envelope=await ctx.readJson(ctx.request,REFERRAL_MAX_BYTES+200000),local=networkLocal(ctx.database);
  if(!local.managed||!local.enabled||envelope?.to!==local.id)fail(403,'មិនមានសិទ្ធិ');
  const peer=ctx.database.sqlite.prepare('SELECT * FROM emr_network_peers WHERE instance_id=?').get(String(envelope.from||''));if(!peer?.enabled)fail(403,'មិនមានសិទ្ធិ');
  if(!networkVerify(peer.secret,networkRequestText(envelope),envelope.auth))fail(403,'មិនមានសិទ្ធិ');
  const key=incomingPairKey(local,peer),body=checkEnvelope(ctx.database,{role:'receiver',secret:key},envelope);
  const limit=rate.get(peer.id);if(!limit||Date.now()-limit.start>60000)rate.set(peer.id,{start:Date.now(),count:1});else if(++limit.count>600)fail(429,'មិនអាចផ្ទុកទិន្នន័យបាន');
  let result;
  if(body?.operation==='ping')result={protocol:1,instanceId:local.id,name:local.name,incoming:!!peer.incoming,outgoing:!!peer.outgoing,search:!!peer.search,messages:!!peer.messages,typedSearch:true,exactSearch:true,staffChat:true,attachments:true};
  else if(['connection-request','connection-request-status'].includes(body?.operation))result=receiveConnectionControl(ctx,peer,body);
  else{
   if(!peer.incoming)fail(403,'មិនមានសិទ្ធិ');
   if(['search','records'].includes(body?.operation)&&!peer.search)fail(403,'មិនមានសិទ្ធិ');
   if(['doctors','message'].includes(body?.operation)&&!peer.messages)fail(403,'មិនមានសិទ្ធិ');
   if(['deliver','status'].includes(body?.operation)){
    const prior=ctx.database.sqlite.prepare('SELECT peer_id FROM referral_inbox WHERE id=?').get(String(body.id||''));if(prior&&prior.peer_id!==peer.id)fail(404,'រកមិនឃើញ');
    ctx.database.sqlite.exec('BEGIN IMMEDIATE');try{result=receiveReferral(ctx.database,body);if(!prior)ctx.database.sqlite.prepare('UPDATE referral_inbox SET peer_id=? WHERE id=?').run(peer.id,body.id);ctx.database.sqlite.exec('COMMIT')}catch(error){ctx.database.sqlite.exec('ROLLBACK');throw error}
    if(body.operation==='deliver')audit(ctx,'EMR_NETWORK_REFERRAL_RECEIVED',{peerId:peer.id,transferId:body.id});
   }else if(body?.operation==='history'){
    const sent=ctx.database.sqlite.prepare('SELECT * FROM referral_outbox WHERE id=? AND peer_id=?').get(String(body.id||''),peer.id);if(!sent)fail(404,'រកមិនឃើញ');const patient=ctx.database.findPatient(sent.patient_key);if(!patient)fail(404,'រកមិនឃើញ');result={id:sent.id,patientKey:sent.patient_key,visits:referralVisits(ctx,patient)};
   }else if(body?.operation==='search'){
    const rows=searchPatients(ctx.database,text(body.q,120),body.mode||'all',body.offset??0,body.match||'partial');
    result={patients:rows.map(r=>summary(ctx.patientRecordResponse(r,false))),nextOffset:rows.length===25?offset+25:null};audit(ctx,'EMR_NETWORK_SEARCH_RECEIVED',{peerId:peer.id});
   }else if(body?.operation==='records'){
    const row=ctx.database.findPatient(text(body.patientKey,180));if(!row)fail(404,'រកមិនឃើញ');result={visits:referralVisits(ctx,row),patientKey:row.patient_key,readOnly:true};audit(ctx,'EMR_NETWORK_RECORD_SHARED',{peerId:peer.id,patientKey:row.patient_key});
   }else if(body?.operation==='doctors')result={doctors:staffDirectory(ctx.database)};
   else if(body?.operation==='message'){
    if(!uuid(body.id)||!uuid(body.sender?.id)||!uuid(body.recipientId))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');const files=validateAttachments(body.attachments),name=text(body.sender.name,160),subject=text(body.subject,200),message=text(body.body,6000),recipient=staffDirectory(ctx.database).find(d=>d.id===body.recipientId);if(!recipient)fail(404,'រកមិនឃើញ');
    const prior=ctx.database.sqlite.prepare('SELECT * FROM emr_network_messages WHERE id=?').get(body.id);
    if(prior&&(prior.peer_id!==peer.id||prior.direction!=='IN'||prior.sender_id!==body.sender.id||prior.recipient_id!==recipient.id||prior.subject!==subject||prior.body!==message||!sameAttachments(ctx.database,body.id,files)))fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');
    if(!prior){saveChat(ctx.database,[body.id,peer.id,'IN',body.sender.id,name,recipient.id,recipient.display_name,subject,message,'DELIVERED',Date.now()],files);audit(ctx,'EMR_NETWORK_MESSAGE_RECEIVED',{peerId:peer.id,messageId:body.id})}result={id:body.id};
   }else fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
  }
  if(Buffer.byteLength(JSON.stringify(result))>REFERRAL_MAX_BYTES)fail(413,'ទិន្នន័យមិនត្រឹមត្រូវ');
  return send(ctx,{body:result,signature:mac(key,envelope.nonce+JSON.stringify(result)),auth:networkSign(local.signing_seed,networkResponseText(envelope.nonce,result))});
 },{skipCsrf:true});
}
