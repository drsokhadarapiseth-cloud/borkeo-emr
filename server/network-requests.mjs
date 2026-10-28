import crypto from 'node:crypto';
import {networkLocal,networkPeers,publicPeer,networkCall,REVIEW_ROLES} from './emr-network.mjs';
import {networkPublicKey} from './network-signatures.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
const uuid=v=>/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(String(v||''));
const current=(db,row,peer)=>row.peer_version===peer.version&&row.peer_key===peer.secret&&row.local_key===networkPublicKey(networkLocal(db).signing_seed);
const localPeer=(ctx,id)=>{const peer=ctx.database.sqlite.prepare('SELECT * FROM emr_network_peers WHERE id=?').get(String(id||''));if(!peer)fail(404,'រកមិនឃើញ');return peer};
export function ensureConnectionRequestSchema(db){db.sqlite.exec(`CREATE TABLE IF NOT EXISTS emr_connection_requests(
 id TEXT NOT NULL,peer_id TEXT NOT NULL,direction TEXT NOT NULL,state TEXT NOT NULL,peer_version INTEGER NOT NULL,peer_key TEXT NOT NULL,local_key TEXT NOT NULL,created_at INTEGER NOT NULL,decided_at INTEGER,decided_by TEXT,PRIMARY KEY(id,direction)) STRICT;
 CREATE INDEX IF NOT EXISTS emr_connection_requests_peer ON emr_connection_requests(peer_id,direction,created_at);`)}
export function receiveConnectionControl(ctx,peer,body){
 const db=ctx.database;if(!uuid(body.id))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
 let row=db.sqlite.prepare("SELECT * FROM emr_connection_requests WHERE id=? AND direction='IN'").get(body.id);
 if(row&&row.peer_id!==peer.id)fail(404,'រកមិនឃើញ');
 if(row&&row.state==='PENDING'&&!current(db,row,peer)){db.sqlite.prepare("UPDATE emr_connection_requests SET state='STALE' WHERE id=? AND direction='IN'").run(row.id);row={...row,state:'STALE'}}
 if(body.operation==='connection-request'){
  if(!row){
   const pending=db.sqlite.prepare("SELECT * FROM emr_connection_requests WHERE peer_id=? AND direction='IN' AND state='PENDING'").all(peer.id);
   for(const old of pending)db.sqlite.prepare("UPDATE emr_connection_requests SET state='STALE' WHERE id=? AND direction='IN'").run(old.id);
   db.sqlite.prepare("INSERT INTO emr_connection_requests(id,peer_id,direction,state,peer_version,peer_key,local_key,created_at) VALUES(?,?,'IN','PENDING',?,?,?,?)").run(body.id,peer.id,peer.version,peer.secret,networkPublicKey(networkLocal(db).signing_seed),Date.now());
   row=db.sqlite.prepare("SELECT * FROM emr_connection_requests WHERE id=? AND direction='IN'").get(body.id);
   ctx.audit(ctx.database,ctx.request,'EMR_CONNECTION_REQUEST_RECEIVED',{details:{peerId:peer.id,requestId:row.id}});
  }
 }else if(!row)fail(404,'រកមិនឃើញ');
 return {id:row.id,state:row.state==='ACCEPTED'&&!current(db,row,peer)?'STALE':row.state};
}
export function mountConnectionRequestRoutes(router){
 const role=(ctx,roles)=>{if(!ctx.session)fail(401,'មិនមានសិទ្ធិ');if(!roles.includes(ctx.requireContext(ctx.session)))fail(403,'មិនមានសិទ្ធិ')};
 const send=(ctx,data)=>ctx.sendJson(ctx.response,200,data,{secure:ctx.config.cookieSecure});
 const read=async ctx=>{const body=await ctx.readJson(ctx.request,3000);if(!body||Array.isArray(body)||typeof body!=='object')fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');return body};
 const audit=(ctx,action,details)=>ctx.audit(ctx.database,ctx.request,action,{userId:ctx.session.user_id,details});
 const opts={requireSession:true};
 router.get('/api/emr-network/table',ctx=>{role(ctx,REVIEW_ROLES);const admin=ctx.sessionRole(ctx.session)==='ADMIN';const requests=admin?ctx.database.sqlite.prepare("SELECT r.id,r.peer_id,r.direction,r.state,r.created_at,p.name FROM emr_connection_requests r JOIN emr_network_peers p ON p.id=r.peer_id ORDER BY CASE WHEN r.state='PENDING' THEN 0 ELSE 1 END,r.created_at DESC LIMIT 100").all():[];return send(ctx,{admin,peers:networkPeers(ctx.database).map(publicPeer),requests})},opts);
 router.post('/api/emr-network/request',async ctx=>{
  role(ctx,['ADMIN']);const body=await read(ctx),peer=localPeer(ctx,body.peerId),db=ctx.database;
  if(!networkLocal(db).enabled||!peer.enabled)fail(403,'មិនមានសិទ្ធិ');
  let row=db.sqlite.prepare("SELECT * FROM emr_connection_requests WHERE peer_id=? AND direction='OUT' AND state='PENDING' ORDER BY created_at DESC LIMIT 1").get(peer.id);
  if(row&&!current(db,row,peer)){db.sqlite.prepare("UPDATE emr_connection_requests SET state='STALE' WHERE id=? AND direction='OUT'").run(row.id);row=null}
  if(!row){const id=crypto.randomUUID();db.sqlite.prepare("INSERT INTO emr_connection_requests(id,peer_id,direction,state,peer_version,peer_key,local_key,created_at) VALUES(?,?,'OUT','PENDING',?,?,?,?)").run(id,peer.id,peer.version,peer.secret,networkPublicKey(networkLocal(db).signing_seed),Date.now());row=db.sqlite.prepare("SELECT * FROM emr_connection_requests WHERE id=? AND direction='OUT'").get(id)}
  const result=await networkCall(ctx,peer.id,{operation:'connection-request',id:row.id});if(result.id!==row.id)fail(503,'ទិន្នន័យមិនត្រឹមត្រូវ');
  audit(ctx,'EMR_CONNECTION_REQUEST_SENT',{peerId:peer.id,requestId:row.id});return send(ctx,{id:row.id,state:result.state});
 },opts);
 router.post('/api/emr-network/decide-request',async ctx=>{
  role(ctx,['ADMIN']);const body=await read(ctx);if(!['ACCEPTED','REJECTED'].includes(body.state))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
  const db=ctx.database,row=db.sqlite.prepare("SELECT * FROM emr_connection_requests WHERE id=? AND direction='IN'").get(String(body.id||''));if(!row)fail(404,'រកមិនឃើញ');
  if(row.state!=='PENDING'){if(row.state===body.state)return send(ctx,{ok:true});fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ')}
  const peer=localPeer(ctx,row.peer_id);if(!networkLocal(db).enabled||!peer.enabled||!current(db,row,peer))fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');
  db.sqlite.exec('BEGIN IMMEDIATE');try{
   if(body.state==='ACCEPTED')db.sqlite.prepare('UPDATE emr_network_peers SET incoming=1,outgoing=1,version=version+1 WHERE id=? AND version=?').run(peer.id,peer.version);
   db.sqlite.prepare("UPDATE emr_connection_requests SET state=?,peer_version=?,decided_at=?,decided_by=? WHERE id=? AND direction='IN' AND state='PENDING'").run(body.state,peer.version+(body.state==='ACCEPTED'?1:0),Date.now(),ctx.session.user_id,row.id);db.sqlite.exec('COMMIT');
  }catch(error){db.sqlite.exec('ROLLBACK');throw error}
  audit(ctx,'EMR_CONNECTION_REQUEST_'+body.state,{peerId:peer.id,requestId:row.id});return send(ctx,{ok:true});
 },opts);
 router.post('/api/emr-network/check',async ctx=>{
  role(ctx,REVIEW_ROLES);const body=await read(ctx),db=ctx.database;let peer=localPeer(ctx,body.peerId),requestState=null;
  const checkedAt=Date.now();try{
   const pending=db.sqlite.prepare("SELECT * FROM emr_connection_requests WHERE peer_id=? AND direction='OUT' AND state='PENDING' ORDER BY created_at DESC LIMIT 1").get(peer.id);
   if(pending){
    if(!current(db,pending,peer)){db.sqlite.prepare("UPDATE emr_connection_requests SET state='STALE' WHERE id=? AND direction='OUT'").run(pending.id);requestState='STALE'}
    else{const result=await networkCall(ctx,peer.id,{operation:'connection-request-status',id:pending.id});if(result.id!==pending.id||!['PENDING','ACCEPTED','REJECTED','STALE'].includes(result.state))fail(503,'ទិន្នន័យមិនត្រឹមត្រូវ');requestState=result.state;
     // Re-read after the network wait: a later disable/key edit must win.
     peer=localPeer(ctx,peer.id);
     if(result.state!=='PENDING'){db.sqlite.exec('BEGIN IMMEDIATE');try{const valid=current(db,pending,peer)&&networkLocal(db).enabled&&peer.enabled;if(result.state==='ACCEPTED'&&valid)db.sqlite.prepare('UPDATE emr_network_peers SET incoming=1,outgoing=1,version=version+1 WHERE id=? AND version=?').run(peer.id,peer.version);db.sqlite.prepare("UPDATE emr_connection_requests SET state=?,decided_at=? WHERE id=? AND direction='OUT' AND state='PENDING'").run(valid?result.state:'STALE',Date.now(),pending.id);db.sqlite.exec('COMMIT')}catch(error){db.sqlite.exec('ROLLBACK');throw error}}
    }
    requestState=db.sqlite.prepare("SELECT state FROM emr_connection_requests WHERE id=? AND direction='OUT'").get(pending.id).state;
   }
   const result=await networkCall(ctx,peer.id,{operation:'ping'},{probe:true});peer=localPeer(ctx,peer.id);
   return send(ctx,{connected:!!(networkLocal(db).enabled&&peer.enabled&&peer.incoming&&peer.outgoing&&result.incoming&&result.outgoing),checkedAt,requestState});
  }catch{return send(ctx,{connected:false,checkedAt,requestState})}
 },opts);
}
