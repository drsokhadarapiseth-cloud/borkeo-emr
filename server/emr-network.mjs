import crypto from 'node:crypto';
import {linkSettings,peerCall} from './referral-link.mjs';
import {networkPublicKey} from './network-signatures.mjs';
import {ensureConnectionRequestSchema} from './network-requests.mjs';
import {ensureNetworkRegistrationSchema} from './network-registration.mjs';
const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
export const DOCTORS=['DOCTOR','CHIEF_WARD'];
export const REVIEW_ROLES=['ADMIN','DIRECTOR','VICE_DIRECTOR','DOCTOR','CHIEF_WARD','NURSE','MIDWIFE','REGISTRATION','TRIAGE'];
export function ensureNetworkSchema(db,config){
 ensureConnectionRequestSchema(db);
 ensureNetworkRegistrationSchema(db);
 db.sqlite.exec(`CREATE TABLE IF NOT EXISTS emr_network_local(id TEXT PRIMARY KEY,secret TEXT NOT NULL,name TEXT NOT NULL,enabled INTEGER NOT NULL DEFAULT 0,managed INTEGER NOT NULL DEFAULT 0,version INTEGER NOT NULL DEFAULT 1) STRICT;
 CREATE TABLE IF NOT EXISTS emr_network_peers(id TEXT PRIMARY KEY,instance_id TEXT NOT NULL UNIQUE,name TEXT NOT NULL,origin TEXT NOT NULL,secret TEXT NOT NULL,enabled INTEGER NOT NULL,incoming INTEGER NOT NULL,outgoing INTEGER NOT NULL,search INTEGER NOT NULL,messages INTEGER NOT NULL,version INTEGER NOT NULL DEFAULT 1) STRICT;
 CREATE TABLE IF NOT EXISTS emr_network_messages(id TEXT PRIMARY KEY,peer_id TEXT NOT NULL,direction TEXT NOT NULL,sender_id TEXT NOT NULL,sender_name TEXT NOT NULL,recipient_id TEXT NOT NULL,recipient_name TEXT NOT NULL,subject TEXT NOT NULL,body TEXT NOT NULL,state TEXT NOT NULL,created_at INTEGER NOT NULL) STRICT;`);
 if(!db.sqlite.prepare('SELECT 1 FROM emr_network_local').get())db.sqlite.prepare('INSERT INTO emr_network_local(id,secret,name) VALUES(?,?,?)').run(crypto.randomUUID(),crypto.randomBytes(32).toString('hex'),'EMR '+config.port);
 if(!db.sqlite.prepare('PRAGMA table_info(emr_network_local)').all().some(c=>c.name==='signing_seed'))db.sqlite.exec("ALTER TABLE emr_network_local ADD COLUMN signing_seed TEXT NOT NULL DEFAULT ''");
 db.sqlite.prepare("UPDATE emr_network_local SET signing_seed=? WHERE signing_seed=''").run(crypto.randomBytes(32).toString('hex'));
 for(const table of ['referral_inbox','referral_outbox'])if(!db.sqlite.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name==='peer_id'))db.sqlite.exec("ALTER TABLE "+table+" ADD COLUMN peer_id TEXT NOT NULL DEFAULT ''");
}
export const networkLocal=db=>db.sqlite.prepare('SELECT * FROM emr_network_local').get();
export const networkPeers=db=>db.sqlite.prepare('SELECT * FROM emr_network_peers ORDER BY name,id').all();
export const apiToken=local=>'EMR1:'+local.id+':'+networkPublicKey(local.signing_seed);
export function parseApiToken(value){const m=/^EMR1:([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}):([a-f0-9]{64})$/.exec(String(value||'').trim());if(!m)fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');return {id:m[1],secret:m[2]}}
export function publicPeer(p){return {id:p.id,instanceId:p.instance_id,name:p.name,origin:p.origin,enabled:!!p.enabled,incoming:!!p.incoming,outgoing:!!p.outgoing,search:!!p.search,messages:!!p.messages,version:p.version,keyHint:'••••'+p.secret.slice(-4)}}
export function savePeer(db,config,body){
 const local=networkLocal(db),prior=body.id?db.sqlite.prepare('SELECT * FROM emr_network_peers WHERE id=?').get(String(body.id)):null;
 if(body.id&&!prior)fail(404,'រកមិនឃើញ');if(prior&&body.version!==prior.version)fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ');
 const name=String(body.name||'').trim();if(!name||name.length>160)fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
 let url;try{url=new URL(body.origin)}catch{fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ')}
 if(url.protocol!=='http:'||!['127.0.0.1','localhost'].includes(url.hostname)||!url.port||url.username||url.password||url.search||url.hash||url.pathname!=='/'||url.port===new URL(config.appOrigin).port)fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
 const token=body.apiKey?parseApiToken(body.apiKey):prior?{id:prior.instance_id,secret:prior.secret}:parseApiToken('');
 if(token.id===local.id||(prior&&token.id!==prior.instance_id))fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');
 const flags={};for(const key of ['enabled','incoming','outgoing','search','messages']){if(body[key]!==undefined&&typeof body[key]!=='boolean')fail(400,'ទិន្នន័យមិនត្រឹមត្រូវ');flags[key]=body[key]===undefined?(prior?.[key]||0):Number(body[key])}
 const id=prior?.id||crypto.randomUUID();
 try{if(prior)db.sqlite.prepare('UPDATE emr_network_peers SET name=?,origin=?,secret=?,enabled=?,incoming=?,outgoing=?,search=?,messages=?,version=version+1 WHERE id=? AND version=?').run(name,url.origin,token.secret,flags.enabled,flags.incoming,flags.outgoing,flags.search,flags.messages,id,prior.version);
 else db.sqlite.prepare('INSERT INTO emr_network_peers(id,instance_id,name,origin,secret,enabled,incoming,outgoing,search,messages) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id,token.id,name,url.origin,token.secret,flags.enabled,flags.incoming,flags.outgoing,flags.search,flags.messages)}catch{fail(409,'ទិន្នន័យមិនត្រឹមត្រូវ')}
 return db.sqlite.prepare('SELECT * FROM emr_network_peers WHERE id=?').get(id);
}
export function pairLink(local,peer){
 const secret=crypto.createHash('sha256').update('emr-network:'+local.id+':'+peer.instance_id+':'+networkPublicKey(local.signing_seed)+':'+peer.secret).digest('hex');
 return {role:'sender',peer:peer.origin,secret,networkFrom:local.id,networkTo:peer.instance_id,signingSeed:local.signing_seed,peerVerifyKey:peer.secret};
}
export function incomingPairKey(local,peer){return crypto.createHash('sha256').update('emr-network:'+peer.instance_id+':'+local.id+':'+peer.secret+':'+networkPublicKey(local.signing_seed)).digest('hex')}
export async function networkCall(ctx,peerId,body,{probe=false}={}){
 const local=networkLocal(ctx.database),peer=ctx.database.sqlite.prepare('SELECT * FROM emr_network_peers WHERE id=?').get(String(peerId||''));
 const control=['connection-request','connection-request-status'].includes(body.operation);
 if(!local.managed||!local.enabled||!peer?.enabled||(!probe&&!control&&!peer.outgoing))fail(403,'មិនមានសិទ្ធិ');
 if(!probe&&['search','records'].includes(body.operation)&&!peer.search)fail(403,'មិនមានសិទ្ធិ');
 if(!probe&&['doctors','message'].includes(body.operation)&&!peer.messages)fail(403,'មិនមានសិទ្ធិ');
 const link=pairLink(local,peer);
 // Verify the actual remote EMR before sending any query, clinical data or text.
 const ping=await peerCall(link,{operation:'ping'});
 if(ping.instanceId!==peer.instance_id||ping.protocol!==1)fail(403,'មិនមានសិទ្ធិ');
 const latestLocal=networkLocal(ctx.database),latestPeer=ctx.database.sqlite.prepare('SELECT * FROM emr_network_peers WHERE id=?').get(peer.id);
 if(!latestLocal.managed||!latestLocal.enabled||latestLocal.signing_seed!==local.signing_seed||!latestPeer?.enabled||latestPeer.version!==peer.version)fail(403,'មិនមានសិទ្ធិ');
 if(probe||body.operation==='ping')return ping;
 if((!control&&!ping.incoming)||(['search','records'].includes(body.operation)&&!ping.search)||(['doctors','message'].includes(body.operation)&&!ping.messages))fail(403,'មិនមានសិទ្ធិ');
 return peerCall(link,body);
}
export function referralNetworkLink(ctx,peerId){
 const local=networkLocal(ctx.database);if(!local.managed)return linkSettings(ctx.config);
 const peers=networkPeers(ctx.database).filter(p=>p.enabled&&p.outgoing);const peer=peerId?peers.find(p=>p.id===peerId):peers.length===1?peers[0]:null;
 if(!local.enabled||!peer)fail(403,'មិនមានសិទ្ធិ');
 return {role:'sender',peerId:peer.id,invoke:body=>networkCall(ctx,peer.id,body)};
}
export function networkCapabilities(ctx){
 const local=networkLocal(ctx.database),peers=networkPeers(ctx.database);return {managed:!!local.managed,receiver:!!local.managed,sender:!!(local.enabled&&peers.some(p=>p.enabled&&p.outgoing)),outgoingPeers:local.enabled?peers.filter(p=>p.enabled&&p.outgoing).map(p=>({id:p.id,name:p.name})):[],network:!!local.managed};
}
