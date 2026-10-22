import crypto from 'node:crypto';
import { sameMedicineUnit } from './medicine-units.mjs';

export function ensureStockSchema(db){
  const table = db.sqlite.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='stock_items'").get();
  if (table) {
    const cols = db.sqlite.prepare('PRAGMA table_info(stock_items)').all().map(c => c.name);
    if (!table.sql.includes("'film'")) {
      const selectCols = [
        'id', 'kind', 'name', 'unit', 'balance',
        cols.includes('test_code') ? 'test_code' : "''",
        cols.includes('per_test') ? 'per_test' : '1',
        cols.includes('cms_code') ? 'cms_code' : "''",
        cols.includes('atc_code') ? 'atc_code' : "''",
        cols.includes('strength') ? 'strength' : "''",
        cols.includes('dose_form') ? 'dose_form' : "''",
        cols.includes('expiry_date') ? 'expiry_date' : "''",
        cols.includes('ref_code') ? 'ref_code' : "''",
        cols.includes('category') ? 'category' : "''",
        cols.includes('lot_no') ? 'lot_no' : "''",
        cols.includes('storage_condition') ? 'storage_condition' : "''",
      ].join(', ');

      db.sqlite.exec(`
        DROP TABLE IF EXISTS stock_items_new;
        CREATE TABLE stock_items_new(
          id TEXT PRIMARY KEY,
          kind TEXT NOT NULL CHECK(kind IN ('medicine','material','film')),
          name TEXT NOT NULL,
          unit TEXT NOT NULL,
          balance REAL NOT NULL CHECK(balance>=0),
          test_code TEXT NOT NULL DEFAULT '',
          per_test REAL NOT NULL DEFAULT 1 CHECK(per_test>0),
          cms_code TEXT NOT NULL DEFAULT '',
          atc_code TEXT NOT NULL DEFAULT '',
          strength TEXT NOT NULL DEFAULT '',
          dose_form TEXT NOT NULL DEFAULT '',
          expiry_date TEXT NOT NULL DEFAULT '',
          ref_code TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT '',
          lot_no TEXT NOT NULL DEFAULT '',
          storage_condition TEXT NOT NULL DEFAULT '',
          UNIQUE(kind,name,unit)
        ) STRICT;
        INSERT INTO stock_items_new SELECT ${selectCols} FROM stock_items;
        DROP TABLE stock_items;
        ALTER TABLE stock_items_new RENAME TO stock_items;
      `);
    } else {
      if (!cols.includes('cms_code')) db.sqlite.exec(`ALTER TABLE stock_items ADD COLUMN cms_code TEXT NOT NULL DEFAULT ''`);
      if (!cols.includes('atc_code')) db.sqlite.exec(`ALTER TABLE stock_items ADD COLUMN atc_code TEXT NOT NULL DEFAULT ''`);
      if (!cols.includes('strength')) db.sqlite.exec(`ALTER TABLE stock_items ADD COLUMN strength TEXT NOT NULL DEFAULT ''`);
      if (!cols.includes('dose_form')) db.sqlite.exec(`ALTER TABLE stock_items ADD COLUMN dose_form TEXT NOT NULL DEFAULT ''`);
      if (!cols.includes('expiry_date')) db.sqlite.exec(`ALTER TABLE stock_items ADD COLUMN expiry_date TEXT NOT NULL DEFAULT ''`);
      if (!cols.includes('ref_code')) db.sqlite.exec(`ALTER TABLE stock_items ADD COLUMN ref_code TEXT NOT NULL DEFAULT ''`);
      if (!cols.includes('category')) db.sqlite.exec(`ALTER TABLE stock_items ADD COLUMN category TEXT NOT NULL DEFAULT ''`);
      if (!cols.includes('lot_no')) db.sqlite.exec(`ALTER TABLE stock_items ADD COLUMN lot_no TEXT NOT NULL DEFAULT ''`);
      if (!cols.includes('storage_condition')) db.sqlite.exec(`ALTER TABLE stock_items ADD COLUMN storage_condition TEXT NOT NULL DEFAULT ''`);
    }
  } else {
    db.sqlite.exec(`CREATE TABLE IF NOT EXISTS stock_items(
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL CHECK(kind IN ('medicine','material','film')),
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      balance REAL NOT NULL CHECK(balance>=0),
      test_code TEXT NOT NULL DEFAULT '',
      per_test REAL NOT NULL DEFAULT 1 CHECK(per_test>0),
      cms_code TEXT NOT NULL DEFAULT '',
      atc_code TEXT NOT NULL DEFAULT '',
      strength TEXT NOT NULL DEFAULT '',
      dose_form TEXT NOT NULL DEFAULT '',
      expiry_date TEXT NOT NULL DEFAULT '',
      ref_code TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT '',
      lot_no TEXT NOT NULL DEFAULT '',
      storage_condition TEXT NOT NULL DEFAULT '',
      UNIQUE(kind,name,unit)
    ) STRICT;
  `);
  }
  db.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS stock_usage(source TEXT NOT NULL,item_id TEXT NOT NULL REFERENCES stock_items(id),quantity REAL NOT NULL CHECK(quantity>=0),PRIMARY KEY(source,item_id)) STRICT;
    CREATE TABLE IF NOT EXISTS stock_movements(id TEXT PRIMARY KEY,item_id TEXT NOT NULL REFERENCES stock_items(id),delta REAL NOT NULL,source TEXT NOT NULL,actor TEXT NOT NULL,created_at INTEGER NOT NULL) STRICT;
  `);
}
const stockError=message=>Object.assign(new Error(message),{status:409});
const number=(v,positive=false)=>{const n=Number(v);if(v==null||String(v).trim()===''||!Number.isFinite(n)||(positive?n<=0:n<0))throw stockError('Enter a valid stock quantity.');return n};
export function listStock(db,kind){ensureStockSchema(db);return db.sqlite.prepare('SELECT * FROM stock_items WHERE kind=? ORDER BY name,unit').all(kind)}
function move(db,item,delta,source,actor){if(!Number.isFinite(delta))throw stockError('Invalid quantity.');if(item.balance+delta < -1e-9)throw stockError(`Insufficient stock: ${item.name} (${item.unit}). Available: ${item.balance}`);db.sqlite.prepare('UPDATE stock_items SET balance=MAX(0,balance+?) WHERE id=?').run(delta,item.id);if(delta)db.sqlite.prepare('INSERT INTO stock_movements VALUES(?,?,?,?,?,?)').run(crypto.randomUUID(),item.id,delta,source,String(actor||''),Date.now())}
export function addStockItem(db,kind,body,actor){
  ensureStockSchema(db);
  if(!['medicine','material','film'].includes(kind))throw stockError('Invalid stock list.');
  const name=String(body.name||'').trim(),unit=String(body.unit||'').trim();
  if(!name||!unit||name.length>240||unit.length>40)throw stockError('Name and unit are required.');
  const balance=number(body.quantity),per=number(body.perTest??1,true),code=kind==='material'?String(body.testCode||'').trim().toUpperCase():'';
  const cmsCode=String(body.cmsCode||body.cms_code||'').trim();
  const atcCode=String(body.atcCode||body.atc_code||'').trim();
  const strength=String(body.strength||'').trim();
  const doseForm=String(body.doseForm||body.dose_form||'').trim();
  const expiryDate=String(body.expiryDate||body.expiry_date||'').trim();
  const refCode=String(body.refCode||body.ref_code||body.ref||'').trim();
  const category=String(body.category||'').trim();
  const lotNo=String(body.lotNo||body.lot_no||body.lot||'').trim();
  const storageCondition=String(body.storageCondition||body.storage_condition||body.storage||'').trim();

  if(code&&!db.sqlite.prepare('SELECT code FROM lab_catalog WHERE code=?').get(code))throw stockError('Choose an existing laboratory test code.');
  const id=crypto.randomUUID();
  db.sqlite.exec('SAVEPOINT stock_add');
  try{
    db.sqlite.prepare('INSERT INTO stock_items(id,kind,name,unit,balance,test_code,per_test,cms_code,atc_code,strength,dose_form,expiry_date,ref_code,category,lot_no,storage_condition) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id,kind,name,unit,0,code,per,cmsCode,atcCode,strength,doseForm,expiryDate,refCode,category,lotNo,storageCondition);
    move(db,{id,name,unit,balance:0},balance,'OPENING',actor);
    db.sqlite.exec('RELEASE stock_add');
    return id;
  }catch(e){
    db.sqlite.exec('ROLLBACK TO stock_add');
    db.sqlite.exec('RELEASE stock_add');
    throw e;
  }
}
export function receiveStock(db,id,quantity,actor){ensureStockSchema(db);const item=db.sqlite.prepare('SELECT * FROM stock_items WHERE id=?').get(id);if(!item)throw stockError('Item not found.');db.sqlite.exec('SAVEPOINT stock_receive');try{move(db,item,number(quantity,true),'RECEIPT',actor);db.sqlite.exec('RELEASE stock_receive')}catch(e){db.sqlite.exec('ROLLBACK TO stock_receive');db.sqlite.exec('RELEASE stock_receive');throw e}}
// Desired quantities replace prior quantities for the same order: edits apply only the difference.
export function syncStockUsage(db,source,desired,actor){ensureStockSchema(db);db.sqlite.exec('SAVEPOINT stock_usage_sync');try{const prior=db.sqlite.prepare('SELECT * FROM stock_usage WHERE source=?').all(source);const ids=new Set([...prior.map(x=>x.item_id),...desired.keys()]);for(const id of ids){const item=db.sqlite.prepare('SELECT * FROM stock_items WHERE id=?').get(id);if(!item)throw stockError('Item not found.');const old=prior.find(x=>x.item_id===id)?.quantity||0,next=number(desired.get(id)??0);move(db,item,old-next,source,actor);db.sqlite.prepare('INSERT INTO stock_usage VALUES(?,?,?) ON CONFLICT(source,item_id) DO UPDATE SET quantity=excluded.quantity').run(source,id,next)}db.sqlite.exec('RELEASE stock_usage_sync')}catch(e){db.sqlite.exec('ROLLBACK TO stock_usage_sync');db.sqlite.exec('RELEASE stock_usage_sync');throw e}}
export function syncMedicineStock(db,source,medications,actor){const stock=listStock(db,'medicine'),desired=new Map();for(const med of medications||[]){const item=stock.find(x=>x.name.toLowerCase()===String(med.name||'').trim().toLowerCase()&&sameMedicineUnit(x.unit,med.unit));if(!item){if(stock.some(x=>x.name.toLowerCase()===String(med.name||'').trim().toLowerCase()))throw stockError(`Stock unit does not match prescription: ${med.name}`);continue}const qty=number(med.total,true);desired.set(item.id,(desired.get(item.id)||0)+qty)}syncStockUsage(db,source,desired,actor)}
export function useLabMaterials(db,order,actor){const desired=new Map(),codes=new Set((order.request?.tests||order.request?.items||[]).map(x=>x.code));for(const x of order.result?.items||[])codes.add(x.code);for(const item of listStock(db,'material'))if(item.test_code&&codes.has(item.test_code))desired.set(item.id,item.per_test);syncStockUsage(db,`LAB:${order.id}`,desired,actor)}
export function manualMaterialUsage(db,id,qty,reference,actor){if(!String(reference||'').trim())throw stockError('A unique usage reference is required.');syncStockUsage(db,`MANUAL:${id}:${String(reference).trim()}`,new Map([[id,number(qty,true)]]),actor)}
export function manualFilmUsage(db,id,qty,reference,actor){if(!String(reference||'').trim())throw stockError('A unique usage reference is required.');syncStockUsage(db,`MANUAL_FILM:${id}:${String(reference).trim()}`,new Map([[id,number(qty,true)]]),actor)}
export function stockHistory(db,kind){ensureStockSchema(db);return db.sqlite.prepare('SELECT m.*,i.name,i.unit FROM stock_movements m JOIN stock_items i ON i.id=m.item_id WHERE i.kind=? ORDER BY m.created_at DESC,m.rowid DESC LIMIT 100').all(kind)}
