// Explicit bootstrap for the two owner-approved installations on this computer.
// Never prints keys or patient content. Does not create users or replace records.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {execFileSync} from 'node:child_process';import {DatabaseSync} from 'node:sqlite';
import {networkLocal,networkPeers,savePeer,apiToken,ensureNetworkSchema,networkCall} from '../server/emr-network.mjs';
import {ensureReferralLinkSchema,linkSettings} from '../server/referral-link.mjs';
const roots=process.argv.slice(2).map(r=>path.resolve(r));
if(roots.length!==2||roots[0]===roots[1])throw Error('Specify the two distinct approved installation roots.');
const configs=roots.map(root=>{
 const configUrl=pathToFileURL(path.join(root,'server/config.mjs')).href,wifiUrl=pathToFileURL(path.join(root,'scripts/wifi-instance.mjs')).href;
 const code=`const {loadConfig}=await import(${JSON.stringify(configUrl)});loadConfig();const {configureWifiInstance}=await import(${JSON.stringify(wifiUrl)});configureWifiInstance(${JSON.stringify(root)});const c=loadConfig();console.log(JSON.stringify({port:c.port,appOrigin:c.appOrigin,databasePath:c.databasePath}));`;
 return JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',code],{cwd:root,encoding:'utf8',windowsHide:true}));
});
if(new Set(configs.map(c=>path.resolve(c.databasePath))).size!==2||!configs.every(c=>fs.existsSync(c.databasePath)))throw Error('Distinct existing databases are required.');
const legacy=configs.map(c=>linkSettings(c));
const migrateLegacy=legacy.every((l,i)=>l?.peer===configs[1-i].appOrigin)&&legacy[0].secret===legacy[1].secret;
const dbs=configs.map(c=>({sqlite:new DatabaseSync(c.databasePath)}));
try{
 dbs.forEach((db,i)=>{ensureReferralLinkSchema(db);ensureNetworkSchema(db,configs[i])});
 const prior=dbs.map(networkLocal);for(let i=0;i<2;i++)if(networkPeers(dbs[i]).some(p=>p.instance_id!==prior[1-i].id))throw Error('Other connections already exist; configure these installations through the admin page.');
 dbs.forEach(db=>db.sqlite.exec('BEGIN IMMEDIATE'));
 try{
  for(let i=0;i<2;i++){const name=process.env[i===0?'EMR_NETWORK_NAME_A':'EMR_NETWORK_NAME_B'];if(name&&!prior[i].managed){if(name.length>160)throw Error('Facility name too long.');dbs[i].sqlite.prepare('UPDATE emr_network_local SET name=?').run(name.trim())}}
  for(let i=0;i<2;i++){
   const db=dbs[i],other=networkLocal(dbs[1-i]),existing=networkPeers(db).find(p=>p.instance_id===other.id);
   const peer=savePeer(db,configs[i],{id:existing?.id,version:existing?.version,name:other.name,origin:configs[1-i].appOrigin,apiKey:apiToken(other),enabled:true,incoming:true,outgoing:true,search:true,messages:true});
   if(migrateLegacy)for(const table of ['referral_inbox','referral_outbox'])db.sqlite.prepare('UPDATE '+table+" SET peer_id=? WHERE peer_id=''").run(peer.id);
   db.sqlite.prepare('UPDATE emr_network_local SET enabled=1,managed=1,version=version+1').run();
  }
  dbs.forEach(db=>db.sqlite.exec('COMMIT'));
 }catch(error){for(const db of dbs)try{db.sqlite.exec('ROLLBACK')}catch{}throw error}
 for(let i=0;i<2;i++){const peer=networkPeers(dbs[i])[0],result=await networkCall({database:dbs[i],config:configs[i]},peer.id,{operation:'ping'},{probe:true});if(!result.incoming)throw Error('Remote approval not enabled.')}
 console.log('Two independent API keys and reciprocal permissions configured; signed identity checks passed. Legacy referral bindings preserved: '+migrateLegacy);
}finally{dbs.forEach(db=>db.sqlite.close())}
