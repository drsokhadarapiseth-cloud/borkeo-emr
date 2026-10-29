import crypto from 'node:crypto';import {listAllWards} from './access.mjs';
export const CHAT_ROLES=['DOCTOR','CHIEF_WARD','NURSE','MIDWIFE'];
export const CHAT_JSON_LIMIT=1500000;
const fail=(status=400)=>{throw Object.assign(new Error('ទិន្នន័យមិនត្រឹមត្រូវ'),{status})};
export function ensureChatSchema(db){db.sqlite.exec(`CREATE TABLE IF NOT EXISTS emr_network_attachments(id TEXT PRIMARY KEY,message_id TEXT NOT NULL REFERENCES emr_network_messages(id),name TEXT NOT NULL,mime TEXT NOT NULL,sha256 TEXT NOT NULL,content BLOB NOT NULL) STRICT; CREATE INDEX IF NOT EXISTS emr_network_attachments_message ON emr_network_attachments(message_id);`)}
export function staffDirectory(db){
 return db.sqlite.prepare("SELECT id,display_name FROM users u WHERE is_active=1 AND EXISTS(SELECT 1 FROM user_roles r WHERE r.user_id=u.id AND r.role IN ('DOCTOR','CHIEF_WARD','NURSE','MIDWIFE')) ORDER BY display_name LIMIT 500").all().map(u=>({...u,roles:db.sqlite.prepare("SELECT role FROM user_roles WHERE user_id=? AND role IN ('DOCTOR','CHIEF_WARD','NURSE','MIDWIFE') ORDER BY role").all(u.id).map(r=>r.role),wards:db.sqlite.prepare('SELECT ward_code FROM user_wards WHERE user_id=? ORDER BY ward_code').all(u.id).map(r=>({code:r.ward_code,name_kh:listAllWards(db).find(w=>w.code===r.ward_code)?.nameKh||r.ward_code}))}));
}
export function validateAttachments(value=[]){
 if(!Array.isArray(value)||value.length>3)fail();let total=0;
 return value.map(f=>{
  if(!f||typeof f.name!=='string'||f.name.length>120||!f.name.trim()||/[\\/\u0000-\u001f\u007f]/.test(f.name)||typeof f.data!=='string'||f.data.length>700000||!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(f.data))fail();
  const content=Buffer.from(f.data,'base64');total+=content.length;if(!content.length||content.length>512*1024||total>1024*1024||content.toString('base64')!==f.data)fail();
  const png=content.length>24&&content.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex'))&&content.toString('ascii',12,16)==='IHDR',jpg=content.length>4&&content[0]===255&&content[1]===216&&content[2]===255&&content.at(-2)===255&&content.at(-1)===217,pdf=content.subarray(0,5).toString()==='%PDF-'&&content.subarray(-1024).includes(Buffer.from('%%EOF'));
  if(!((f.mime==='image/png'&&/\.png$/i.test(f.name)&&png)||(f.mime==='image/jpeg'&&/\.jpe?g$/i.test(f.name)&&jpg)||(f.mime==='application/pdf'&&/\.pdf$/i.test(f.name)&&pdf)))fail();
  return {name:f.name.trim(),mime:f.mime,content,sha256:crypto.createHash('sha256').update(content).digest('hex')};
 });
}
export const attachmentMetadata=(db,id)=>db.sqlite.prepare('SELECT id,name,mime,sha256,length(content) AS size FROM emr_network_attachments WHERE message_id=? ORDER BY rowid').all(id);
export function sameAttachments(db,id,files){return JSON.stringify(attachmentMetadata(db,id).map(({name,mime,sha256})=>({name,mime,sha256})))===JSON.stringify(files.map(({name,mime,sha256})=>({name,mime,sha256})))}
export function saveChat(db,values,files){db.sqlite.exec('BEGIN IMMEDIATE');try{db.sqlite.prepare('INSERT INTO emr_network_messages VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(...values);const insert=db.sqlite.prepare('INSERT INTO emr_network_attachments VALUES(?,?,?,?,?,?)');for(const f of files)insert.run(crypto.randomUUID(),values[0],f.name,f.mime,f.sha256,f.content);db.sqlite.exec('COMMIT')}catch(error){db.sqlite.exec('ROLLBACK');throw error}}
