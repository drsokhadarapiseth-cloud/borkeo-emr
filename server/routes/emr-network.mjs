import path from 'node:path';
import crypto from 'node:crypto';
import {networkLocal,networkPeers,publicPeer,savePeer,apiToken,networkCall,incomingPairKey,DOCTORS,REVIEW_ROLES} from '../emr-network.mjs';
import {checkEnvelope,mac,receiveReferral,referralVisits,REFERRAL_MAX_BYTES} from '../referral-link.mjs';
import {networkPublicKey,networkSign,networkVerify,networkRequestText,networkResponseText} from '../network-signatures.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const uuid=value=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(String(value||''));
const text=(v,max)=>{if(typeof v!=='string'||!v.trim()||v.length>max||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');return v.trim()};
const role=(ctx,roles)=>{if(!ctx.session)fail(401,'សូមចូលប្រើប្រព័ន្ធជាមុន');if(!roles.includes(ctx.requireContext(ctx.session)))fail(403,'មិនមានសិទ្ធិ')};
const summary=patient=>Object.fromEntries(['patientKey','caseNumber','healthId','fullName','sex','age','phone','departmentCode','departmentNameKh','entryDate','dischargeDate','serviceMode'].map(k=>[k,patient[k]]));
const doctors=db=>db.sqlite.prepare("SELECT id,display_name FROM users u WHERE is_active=1 AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role IN ('DOCTOR','CHIEF_WARD')) ORDER BY display_name LIMIT 200").all();
export function mountEmrNetworkRoutes(router){
 const send=(ctx,body)=>ctx.sendJson(ctx.response,200,body,{secure:ctx.config.cookieSecure});
 const audit=(ctx,action,details={})=>ctx.audit(ctx.database,ctx.request,action,{userId:ctx.session?.user_id,details});
 const opts={requireSession:true};
 for(const [url,file,roles] of [['/admin/emr-connections','emr-connections.html',['ADMIN']],['/connected-emrs','connected-emrs.html',REVIEW_ROLES]])router.get(url,ctx=>{role(ctx,roles);return ctx.sendFile(ctx.response,path.join(ctx.config.protectedDirectory,file),'text/html; charset=utf-8',{secure:ctx.config.cookieSecure,request:ctx.request,requestPath:url,review:url==='/connected-emrs'})},opts);
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
 router.get('/api/emr-network/connections',ctx=>{role(ctx,REVIEW_ROLES);const local=networkLocal(ctx.database);return send(ctx,{doctor:DOCTORS.includes(ctx.sessionRole(ctx.session)),peers:local.managed&&local.enabled?networkPeers(ctx.database).filter(p=>p.enabled&&p.outgoing).map(p=>({id:p.id,name:p.name,search:!!p.search,messages:!!p.messages})):[]})},opts);
 router.get('/api/emr-network/search',async ctx=>{role(ctx,REVIEW_ROLES);const peerId=String(ctx.url.searchParams.get('peerId')||''),q=text(ctx.url.searchParams.get('q'),120);if(q.length<3)fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');const result=await networkCall(ctx,peerId,{operation:'search',q,offset:Number(ctx.url.searchParams.get('offset')||0)});audit(ctx,'EMR_NETWORK_PATIENT_SEARCH',{peerId});return send(ctx,result)},opts);
 router.get('/api/emr-network/records',async ctx=>{role(ctx,REVIEW_ROLES);const peerId=String(ctx.url.searchParams.get('peerId')||''),patientKey=text(ctx.url.searchParams.get('patientKey'),180),result=await networkCall(ctx,peerId,{operation:'records',patientKey});audit(ctx,'EMR_NETWORK_RECORD_VIEWED',{peerId,patientKey});return send(ctx,{...result,readOnly:true})},opts);
 router.get('/api/emr-network/doctors',async ctx=>{role(ctx,DOCTORS);return send(ctx,await networkCall(ctx,String(ctx.url.searchParams.get('peerId')||''),{operation:'doctors'}))},opts);
 router.get('/api/emr-network/messages',ctx=>{role(ctx,DOCTORS);return send(ctx,{messages:ctx.database.sqlite.prepare('SELECT m.id,m.peer_id,m.direction,m.sender_name,m.recipient_name,m.subject,m.body,m.state,m.created_at,p.name AS facility FROM emr_network_messages m JOIN emr_network_peers p ON p.id=m.peer_id WHERE (direction=\'IN\' AND recipient_id=?) OR (direction=\'OUT\' AND sender_id=?) ORDER BY created_at DESC LIMIT 100').all(ctx.session.user_id,ctx.session.user_id)})},opts);
 router.post('/api/emr-network/messages',async ctx=>{
  role(ctx,DOCTORS);const body=await ctx.readJson(ctx.request,20000),peerId=text(body.peerId,36),id=String(body.id||'');if(!uuid(id)||!uuid(body.recipientId))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
  const subject=text(body.subject,200),message=text(body.body,6000),sender=ctx.database.sqlite.prepare('SELECT id,display_name FROM users WHERE id=?').get(ctx.session.user_id);
  let row=ctx.database.sqlite.prepare('SELECT * FROM emr_network_messages WHERE id=?').get(id);
  if(row&&(row.direction!=='OUT'||row.sender_id!==sender.id||row.peer_id!==peerId||row.recipient_id!==body.recipientId||row.subject!==subject||row.body!==message))fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');
  if(row?.state==='DELIVERED')return send(ctx,{ok:true});
  const directory=await networkCall(ctx,peerId,{operation:'doctors'}),recipient=directory.doctors.find(d=>d.id===body.recipientId);if(!recipient)fail(400,'រកមិនឃើញ');
  if(!row)ctx.database.sqlite.prepare('INSERT INTO emr_network_messages VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,peerId,'OUT',sender.id,sender.display_name,recipient.id,recipient.display_name,subject,message,'PENDING',Date.now());
  try{const result=await networkCall(ctx,peerId,{operation:'message',id,sender:{id:sender.id,name:sender.display_name},recipientId:recipient.id,subject,body:message});if(result.id!==id)fail(503,'ទិន្នន័យមិនត្រឹមត្រូវ');ctx.database.sqlite.prepare("UPDATE emr_network_messages SET state='DELIVERED' WHERE id=?").run(id)}catch(error){ctx.database.sqlite.prepare("UPDATE emr_network_messages SET state='RETRY' WHERE id=?").run(id);throw error}
  audit(ctx,'EMR_NETWORK_MESSAGE_SENT',{peerId,messageId:id});return send(ctx,{ok:true});
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
  if(body?.operation==='ping')result={protocol:1,instanceId:local.id,name:local.name,incoming:!!peer.incoming,search:!!peer.search,messages:!!peer.messages};
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
    const q=text(body.q,120),offset=body.offset??0;if(q.length<3||!Number.isSafeInteger(offset)||offset<0||offset>1000000)fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');const needle='%'+q.replace(/[\\%_]/g,'\\$&')+'%';
    const rows=ctx.database.sqlite.prepare("SELECT * FROM patient_records WHERE full_name LIKE ? ESCAPE '\\' OR health_id LIKE ? ESCAPE '\\' OR phone LIKE ? ESCAPE '\\' ORDER BY entry_date DESC,created_at DESC LIMIT 25 OFFSET ?").all(needle,needle,needle,offset);
    result={patients:rows.map(r=>summary(ctx.patientRecordResponse(r,false))),nextOffset:rows.length===25?offset+25:null};audit(ctx,'EMR_NETWORK_SEARCH_RECEIVED',{peerId:peer.id});
   }else if(body?.operation==='records'){
    const row=ctx.database.findPatient(text(body.patientKey,180));if(!row)fail(404,'រកមិនឃើញ');result={visits:referralVisits(ctx,row),patientKey:row.patient_key,readOnly:true};audit(ctx,'EMR_NETWORK_RECORD_SHARED',{peerId:peer.id,patientKey:row.patient_key});
   }else if(body?.operation==='doctors')result={doctors:doctors(ctx.database)};
   else if(body?.operation==='message'){
    if(!uuid(body.id)||!uuid(body.sender?.id)||!uuid(body.recipientId))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');const name=text(body.sender.name,160),subject=text(body.subject,200),message=text(body.body,6000),recipient=doctors(ctx.database).find(d=>d.id===body.recipientId);if(!recipient)fail(404,'រកមិនឃើញ');
    const prior=ctx.database.sqlite.prepare('SELECT * FROM emr_network_messages WHERE id=?').get(body.id);
    if(prior&&(prior.peer_id!==peer.id||prior.direction!=='IN'||prior.sender_id!==body.sender.id||prior.recipient_id!==recipient.id||prior.subject!==subject||prior.body!==message))fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');
    if(!prior){ctx.database.sqlite.prepare('INSERT INTO emr_network_messages VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(body.id,peer.id,'IN',body.sender.id,name,recipient.id,recipient.display_name,subject,message,'DELIVERED',Date.now());audit(ctx,'EMR_NETWORK_MESSAGE_RECEIVED',{peerId:peer.id,messageId:body.id})}result={id:body.id};
   }else fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
  }
  if(Buffer.byteLength(JSON.stringify(result))>REFERRAL_MAX_BYTES)fail(413,'ទិន្នន័យមិនត្រឹមត្រូវ');
  return send(ctx,{body:result,signature:mac(key,envelope.nonce+JSON.stringify(result)),auth:networkSign(local.signing_seed,networkResponseText(envelope.nonce,result))});
 },{skipCsrf:true});
}
