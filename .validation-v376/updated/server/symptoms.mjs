import fs from 'node:fs';
import crypto from 'node:crypto';

export const SYMPTOM_CREATE_ROLES = new Set(['ADMIN','DIRECTOR','VICE_DIRECTOR','REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD']);
export function normalizeSymptom(value) {
  return String(value ?? '').normalize('NFKC').replace(/\p{Cf}/gu,'').replace(/\s+/gu,' ').trim().toLowerCase();
}
function label(value) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new Error('Symptom names must be text.');
  const text=value.normalize('NFKC').replace(/\p{Cf}/gu,'').replace(/\s+/gu,' ').trim();
  if (text.length>240 || /[\u0000-\u001f\u007f]/u.test(text)) throw new Error('Symptom names must be at most 240 characters without control characters.');
  return text;
}
function dto(row) {
  return {id:row.id,code:row.code ?? null,nameKh:row.name_kh,nameEn:row.name_en,source:row.source};
}
export function ensureSymptomSchema(database) {
  const db=database.sqlite;
  db.exec(`CREATE TABLE IF NOT EXISTS symptom_catalog (
    id TEXT PRIMARY KEY, code TEXT UNIQUE, name_kh TEXT NOT NULL DEFAULT '', name_en TEXT NOT NULL DEFAULT '',
    norm_kh TEXT NOT NULL DEFAULT '', norm_en TEXT NOT NULL DEFAULT '', source TEXT NOT NULL,
    created_by TEXT REFERENCES users(id) ON DELETE SET NULL, created_at INTEGER NOT NULL
  ) STRICT;
  CREATE INDEX IF NOT EXISTS symptom_kh_idx ON symptom_catalog(norm_kh);
  CREATE INDEX IF NOT EXISTS symptom_en_idx ON symptom_catalog(norm_en);
  CREATE TABLE IF NOT EXISTS symptom_aliases (
    normalized TEXT PRIMARY KEY, symptom_id TEXT NOT NULL REFERENCES symptom_catalog(id) ON DELETE CASCADE
  ) STRICT;
  CREATE TABLE IF NOT EXISTS symptom_catalog_imports (source_hash TEXT PRIMARY KEY, imported_at INTEGER NOT NULL) STRICT;`);
  const bytes=fs.readFileSync(new URL('./catalogues/symptoms-v327.json',import.meta.url));
  const hash=crypto.createHash('sha256').update(bytes).digest('hex');
  if(db.prepare('SELECT 1 FROM symptom_catalog_imports WHERE source_hash=?').get(hash))return;
  const items=JSON.parse(bytes).items;
  const insert=db.prepare('INSERT OR IGNORE INTO symptom_catalog(id,code,name_kh,name_en,norm_kh,norm_en,source,created_at) VALUES(?,?,?,?,?,?,?,?)');
  const alias=db.prepare('INSERT OR IGNORE INTO symptom_aliases(normalized,symptom_id) VALUES(?,?)');
  db.exec('BEGIN IMMEDIATE');
  try {
    for(const item of items){
      if(!/^SYMP:\d+$/.test(item.code))throw new Error('Invalid imported symptom code.');
      const id='catalog:'+item.code,kh=label(item.nameKh),en=label(item.nameEn);
      insert.run(id,item.code,kh,en,normalizeSymptom(kh),normalizeSymptom(en),'excel',Date.now());
      for(const name of [kh,en,...(item.synonyms||[])]){const key=normalizeSymptom(name);if(key)alias.run(key,id);}
    }
    db.prepare('INSERT OR IGNORE INTO symptom_catalog_imports VALUES(?,?)').run(hash,Date.now());
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
export function listSymptoms(database) {
  return database.sqlite.prepare('SELECT * FROM symptom_catalog ORDER BY name_kh COLLATE BINARY, name_en COLLATE NOCASE, id').all().map(dto);
}
function match(database,key) {
  return database.sqlite.prepare(`SELECT * FROM symptom_catalog WHERE norm_kh=? OR norm_en=? OR id=(SELECT symptom_id FROM symptom_aliases WHERE normalized=?) ORDER BY (code IS NULL), id LIMIT 1`).get(key,key,key);
}
export function addCustomSymptom(database,body,userId) {
  let kh=label(body?.nameKh),en=label(body?.nameEn);
  if(!kh&&!en){const text=label(body?.text);if(/[\u1780-\u17ff]/u.test(text))kh=text;else en=text;}
  if(!kh&&!en)throw new Error('Enter a symptom name.');
  const keys=[...new Set([normalizeSymptom(kh),normalizeSymptom(en)].filter(Boolean))];
  const db=database.sqlite;
  db.exec('BEGIN IMMEDIATE');
  try {
    const existing=keys.map(key=>match(database,key)).filter(Boolean);
    if(new Set(existing.map(x=>x.id)).size>1)throw new Error('These names match different existing symptoms. Select the intended existing term.');
    if(existing.length){db.exec('COMMIT');return{item:dto(existing[0]),created:false};}
    const id='custom:'+crypto.randomUUID();
    // An internal database ID is not an official symptom code. Never accept a client-supplied code.
    db.prepare('INSERT INTO symptom_catalog(id,code,name_kh,name_en,norm_kh,norm_en,source,created_by,created_at) VALUES(?,NULL,?,?,?,?,?,?,?)')
      .run(id,kh,en,normalizeSymptom(kh),normalizeSymptom(en),'custom',userId,Date.now());
    const insertAlias=db.prepare('INSERT INTO symptom_aliases(normalized,symptom_id) VALUES(?,?)');
    for(const key of keys)insertAlias.run(key,id);
    const item=dto(db.prepare('SELECT * FROM symptom_catalog WHERE id=?').get(id));
    db.exec('COMMIT');return{item,created:true};
  }catch(error){db.exec('ROLLBACK');throw error;}
}
