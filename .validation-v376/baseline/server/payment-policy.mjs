import crypto from 'node:crypto';
import {HEF_TARIFFS} from './hef-tariffs.mjs';
export const PAYMENT_CATEGORIES=Object.freeze([
 {code:'DIRECT',labelKh:'បង់ប្រាក់ដោយខ្លួនឯង',labelEn:'Pay by Cash'},
 {code:'HEF',labelKh:'បង់ដោយមូលនិធិសមធម៌',labelEn:'Health Equity Fund'},
 {code:'NSSF',labelKh:'បង់ដោយ ប.ស.ស',labelEn:'NSSF'},
 {code:'INSURANCE',labelKh:'បង់ដោយធានារ៉ាប់រង',labelEn:'Insurance'},
 {code:'NGO',labelKh:'បង់ដោយអង្គការ',labelEn:'Organization / NGO'},
]);
export const NSSF_SUBTYPES=Object.freeze([
 {code:'CIVIL',labelKh:'មន្ត្រីសាធារណៈ',labelEn:'Public officials'},
 {code:'FORMAL',labelKh:'កម្មករនិយោជិតក្នុងប្រព័ន្ធ',labelEn:'Formal-sector employees'},
 {code:'SELF_EMPLOYED',labelKh:'បុគ្គលស្វ័យនិយោជន៍',labelEn:'Self-employed persons'},
 {code:'INFORMAL',labelKh:'កម្មករនិយោជិតក្រៅប្រព័ន្ធ',labelEn:'Informal-sector employees'},
 {code:'COUNCIL',labelKh:'ក្រុមប្រឹក្សាឃុំ/សង្កាត់',labelEn:'Commune / Sangkat council members'},
]);
export const FACILITY_LEVELS=Object.freeze(['HC','CPA1','CPA2','CPA3','NATIONAL']);
export const PAYMENT_REVIEW_ROLES=Object.freeze(['ADMIN','DIRECTOR','VICE_DIRECTOR']);
const categorySet=new Set(PAYMENT_CATEGORIES.map(x=>x.code));
export function majorPaymentCategory(type){
 type=String(type||'DIRECT').toUpperCase();
 if(type.startsWith('HEF'))return 'HEF';if(type.startsWith('NSSF'))return 'NSSF';
 if(['INSURANCE','NGO'].includes(type))return type;return 'DIRECT';
}
const fail=(message,status=400)=>{const e=new Error(message);e.status=status;throw e;};
const clean=(v,max=300)=>{const s=String(v??'').trim();if(s.length>max||/[\u0000-\u001f\u007f]/.test(s))fail('Invalid text.');return s;};
function add(sqlite,table,name,definition){if(!sqlite.prepare(`PRAGMA table_info(${table})`).all().some(c=>c.name===name))sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);}
export function ensurePaymentPolicySchema(database){
 const s=database.sqlite;
 // Expand only the existing payment-type CHECK; preserve all columns/custom indexes.
 const original=s.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='patient_finance_profiles'").get()?.sql;
 if(original&&!original.includes("'INSURANCE'")){
  const columns=s.prepare('PRAGMA table_info(patient_finance_profiles)').all().map(c=>'"'+c.name.replaceAll('"','""')+'"').join(',');
  const objects=s.prepare("SELECT sql FROM sqlite_master WHERE tbl_name='patient_finance_profiles' AND type IN ('index','trigger') AND sql IS NOT NULL").all();
  let definition=original.replace(/CREATE TABLE\s+(?:IF NOT EXISTS\s+)?["`\[]?patient_finance_profiles["`\]]?/i,'CREATE TABLE patient_finance_profiles_v188');
  definition=definition.replace(/(payment_type\s+IN\s*\()([^)]*)(\))/i,"$1$2,'INSURANCE','NGO'$3");
  s.exec('BEGIN IMMEDIATE');try{s.exec(definition);s.exec(`INSERT INTO patient_finance_profiles_v188 (${columns}) SELECT ${columns} FROM patient_finance_profiles; DROP TABLE patient_finance_profiles; ALTER TABLE patient_finance_profiles_v188 RENAME TO patient_finance_profiles;`);objects.forEach(o=>s.exec(o.sql));s.exec('COMMIT');}catch(e){s.exec('ROLLBACK');throw e;}
 }
 for(const table of ['patient_finance_profiles','finance_invoices']){
  add(s,table,'nssf_subtype',"TEXT NOT NULL DEFAULT ''");add(s,table,'payer_name',"TEXT NOT NULL DEFAULT ''");add(s,table,'concession_approval_id',"TEXT NOT NULL DEFAULT ''");
 }
 add(s,'patient_finance_profiles','coverage_required','INTEGER NOT NULL DEFAULT 0');
 add(s,'finance_invoices','coverage_required','INTEGER NOT NULL DEFAULT 0');add(s,'finance_invoices','coverage_at','INTEGER');add(s,'finance_invoices','coverage_by','TEXT');
 for(const [column,definition] of [['tariff_payer',"TEXT NOT NULL DEFAULT 'DIRECT'"],['pmrs_code',"TEXT NOT NULL DEFAULT ''"],['tariff_facility',"TEXT NOT NULL DEFAULT ''"],['tariff_revision','INTEGER NOT NULL DEFAULT 0']])add(s,'finance_charges',column,definition);
 s.exec(`CREATE TABLE IF NOT EXISTS finance_payment_settings (id INTEGER PRIMARY KEY CHECK(id=1),facility_level TEXT NOT NULL DEFAULT 'CPA2',configured INTEGER NOT NULL DEFAULT 0,updated_by TEXT,updated_at INTEGER NOT NULL) STRICT;
 CREATE TABLE IF NOT EXISTS finance_payer_tariffs (
 payer_type TEXT NOT NULL,facility_level TEXT NOT NULL,service_code TEXT NOT NULL,pmrs_code TEXT NOT NULL DEFAULT '',name_kh TEXT NOT NULL,name_en TEXT NOT NULL,
 unit_label TEXT NOT NULL,category_code TEXT NOT NULL,amount_minor INTEGER,currency TEXT NOT NULL DEFAULT 'KHR',active INTEGER NOT NULL DEFAULT 1,
 revision INTEGER NOT NULL DEFAULT 1,updated_by TEXT,updated_at INTEGER NOT NULL,PRIMARY KEY(payer_type,facility_level,service_code)) STRICT;
 CREATE TABLE IF NOT EXISTS finance_concession_requests (
 id TEXT PRIMARY KEY,patient_key TEXT NOT NULL,invoice_id TEXT NOT NULL REFERENCES finance_invoices(id),requested_by TEXT NOT NULL REFERENCES users(id),requested_at INTEGER NOT NULL,
 reason TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'PENDING',fingerprint TEXT NOT NULL,reviewed_by TEXT,reviewed_at INTEGER,review_note TEXT NOT NULL DEFAULT '',applied_at INTEGER) STRICT;
 CREATE INDEX IF NOT EXISTS finance_concession_status_idx ON finance_concession_requests(status,requested_at DESC);`);
 s.prepare('INSERT OR IGNORE INTO finance_payment_settings (id,updated_at) VALUES (1,?)').run(Date.now());
 const insert=s.prepare(`INSERT OR IGNORE INTO finance_payer_tariffs (payer_type,facility_level,service_code,pmrs_code,name_kh,name_en,unit_label,category_code,amount_minor,updated_at) VALUES ('HEF',?,?,?,?,?,?,?,?,?)`);
 for(const row of HEF_TARIFFS){
  const levels=row.code.startsWith('HC-')?['HC']:['CPA1','CPA2','CPA3','NATIONAL'];
  for(const level of levels)insert.run(level,row.code.toUpperCase(),row.code,row.nameKh,row.nameEn,row.unitLabel,row.categoryCode,row.rates[level]??null,Date.now());
 }
}
export function paymentSettings(database){const r=database.sqlite.prepare('SELECT * FROM finance_payment_settings WHERE id=1').get();return {facilityLevel:r.facility_level,configured:r.configured===1,updatedAt:r.updated_at};}
export function setPaymentSettings(database,values,actor){
 if(!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(actor.role))fail('Admin or Director must select the hospital level.',403);
 const level=String(values.facilityLevel||'').toUpperCase();if(!FACILITY_LEVELS.includes(level))fail('Invalid hospital level.');
 database.sqlite.prepare('UPDATE finance_payment_settings SET facility_level=?,configured=1,updated_by=?,updated_at=? WHERE id=1').run(level,actor.userId,Date.now());return paymentSettings(database);
}
export function payerTariffCatalog(database,paymentType,{includeInactive=false,includeUnavailable=false}={}){
 const type=majorPaymentCategory(paymentType);if(type==='DIRECT')return[];
 const facility=type==='HEF'?paymentSettings(database).facilityLevel:'ALL';
 return database.sqlite.prepare(`SELECT * FROM finance_payer_tariffs WHERE payer_type=? AND facility_level=? ${includeInactive?'':'AND active=1'} ${includeUnavailable?'':'AND amount_minor IS NOT NULL'} ORDER BY category_code,service_code`).all(type,facility).map(r=>({
  code:r.service_code,pmrsCode:r.pmrs_code,paymentType:r.payer_type,facilityLevel:r.facility_level,nameKh:r.name_kh,nameEn:r.name_en,
  unitLabel:r.unit_label,categoryCode:r.category_code,departmentCode:'ALL',defaultAmount:r.amount_minor===null?null:r.currency==='USD'?r.amount_minor/100:r.amount_minor,currency:r.currency,
  active:r.active===1,available:r.amount_minor!==null,revision:r.revision,sortOrder:0,
 }));
}
export function setPayerTariff(database,values,actor){
 if(!['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(actor.role))fail('Admin or Director access is required.',403);
 const type=String(values.paymentType||'').toUpperCase();if(!categorySet.has(type)||type==='DIRECT')fail('Select a sponsored price list.');
 const facility=type==='HEF'?paymentSettings(database).facilityLevel:'ALL';
 if(type==='HEF'&&values.facilityLevel&&values.facilityLevel!==facility)fail('The hospital level changed. Reload this price list.',409);
 const code=clean(values.code,60).toUpperCase();if(!/^[A-Z0-9_\-]+$/.test(code))fail('Invalid tariff code.');
 const curr=String(values.currency||'KHR').toUpperCase();if(!['KHR','USD'].includes(curr)||(type==='HEF'&&curr!=='KHR'))fail('Invalid tariff currency.');
 const raw=Number(values.defaultAmount);if(values.defaultAmount==null||values.defaultAmount===''||!Number.isFinite(raw)||raw<0||raw>1e9)fail('Enter a configured tariff amount.');
 const kh=clean(values.nameKh,500),en=clean(values.nameEn,500),unit=clean(values.unitLabel,60);if(!kh||!en||!unit)fail('Tariff name and unit are required.');
 const category=clean(values.categoryCode,50)||'OTHER';
 if(!['REGISTRATION','CONSULTATION','BED','LAB','IMAGING','PROCEDURE','SURGERY','OBSTETRIC','EMERGENCY','DENTAL','EYE_CARE','MEDICINE','AMBULANCE','DOCUMENT','OTHER'].includes(category))fail('Invalid service category.');
 const original=database.sqlite.prepare('SELECT * FROM finance_payer_tariffs WHERE payer_type=? AND facility_level=? AND service_code=?').get(type,facility,code);
 if(type==='HEF'&&!original)fail('Use a supplied PMRS code for HEF.');
 if(original&&values.revision!==undefined&&Number(values.revision)!==original.revision)fail('The price changed. Reload before saving.',409);
 database.sqlite.prepare(`INSERT INTO finance_payer_tariffs (payer_type,facility_level,service_code,pmrs_code,name_kh,name_en,unit_label,category_code,amount_minor,currency,active,updated_by,updated_at)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(payer_type,facility_level,service_code) DO UPDATE SET name_kh=excluded.name_kh,name_en=excluded.name_en,unit_label=excluded.unit_label,category_code=excluded.category_code,amount_minor=excluded.amount_minor,currency=excluded.currency,active=excluded.active,revision=finance_payer_tariffs.revision+1,updated_by=excluded.updated_by,updated_at=excluded.updated_at`).run(type,facility,code,original?.pmrs_code||clean(values.pmrsCode,60),kh,en,unit,category,Math.round(raw*(curr==='USD'?100:1)),curr,values.active===false?0:1,actor.userId,Date.now());
 return payerTariffCatalog(database,type,{includeInactive:true,includeUnavailable:true}).find(r=>r.code===code);
}
export function invoiceConcessionFingerprint(database,patientKey,invoiceId){
 const s=database.sqlite,invoice=s.prepare('SELECT id,patient_key FROM finance_invoices WHERE id=? AND patient_key=?').get(invoiceId,patientKey);if(!invoice)fail('Invoice was not found.');
 const charges=s.prepare('SELECT id,service_code,quantity,unit_amount_minor,amount_minor,currency,voided_at FROM finance_charges WHERE invoice_id=? ORDER BY id').all(invoiceId);
 const payments=s.prepare('SELECT id,amount_minor,currency,voided_at FROM finance_payments WHERE invoice_id=? ORDER BY id').all(invoiceId);
 return crypto.createHash('sha256').update(JSON.stringify({invoice,charges,payments})).digest('hex');
}
function assertConcessionInvoice(database,patientKey,invoiceId){
 const r=database.sqlite.prepare('SELECT * FROM finance_invoices WHERE id=? AND patient_key=?').get(invoiceId,patientKey);if(!r)fail('Invoice was not found.');if(r.closed_at)fail('This invoice is already completed.',409);
 if(database.sqlite.prepare('SELECT 1 FROM finance_payments WHERE invoice_id=? AND voided_at IS NULL LIMIT 1').get(invoiceId))fail('An invoice with received payments cannot be fully exempted.');
 if(!database.sqlite.prepare('SELECT 1 FROM finance_charges WHERE invoice_id=? AND voided_at IS NULL AND amount_minor>0 LIMIT 1').get(invoiceId))fail('Add services before requesting an exemption.');
 if(['HEF','NSSF','INSURANCE','NGO'].includes(majorPaymentCategory(r.payment_type)))fail('Full exemption is a cash payment option.');
 return r;
}
export function listConcessions(database,actor,{invoiceId=''}={}){
 const manager=PAYMENT_REVIEW_ROLES.includes(actor.role);if(!manager&&!['CLERK','ACCOUNTANT'].includes(actor.role))fail('Billing access is required.',403);
 const where=invoiceId?'r.invoice_id=?':manager?"r.status='PENDING'":"r.requested_by=? AND r.status IN ('PENDING','APPROVED','REJECTED','STALE')";
 return database.sqlite.prepare(`SELECT r.*,i.invoice_no,p.full_name,u.display_name requester_name,v.display_name reviewer_name
 FROM finance_concession_requests r JOIN finance_invoices i ON i.id=r.invoice_id JOIN patient_records p ON p.patient_key=r.patient_key
 JOIN users u ON u.id=r.requested_by LEFT JOIN users v ON v.id=r.reviewed_by WHERE ${where} ORDER BY r.requested_at DESC`).all(...(invoiceId?[invoiceId]:manager?[]:[actor.userId])).map(r=>({
 id:r.id,patientKey:r.patient_key,invoiceId:r.invoice_id,invoiceNo:r.invoice_no,patientName:r.full_name,requestedBy:r.requested_by,requestedByName:r.requester_name,requestedAt:r.requested_at,
 charges:database.sqlite.prepare('SELECT description,quantity,amount_minor amount,currency FROM finance_charges WHERE invoice_id=? AND voided_at IS NULL').all(r.invoice_id).map(c=>({...c,amount:c.currency==='USD'?c.amount/100:c.amount})),
 reason:r.reason,status:r.status,reviewedByName:r.reviewer_name,reviewedAt:r.reviewed_at,reviewNote:r.review_note,appliedAt:r.applied_at,
 }));
}
export function requestConcession(database,values,actor){
 if(!['CLERK','ACCOUNTANT','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(actor.role))fail('Billing access is required.',403);
 const patientKey=clean(values.patientKey,180),invoiceId=clean(values.invoiceId,60),reason=clean(values.reason,1000);if(!reason)fail('A reason for the full exemption is required.');
 assertConcessionInvoice(database,patientKey,invoiceId);
 const fingerprint=invoiceConcessionFingerprint(database,patientKey,invoiceId);
 const existing=database.sqlite.prepare("SELECT id FROM finance_concession_requests WHERE invoice_id=? AND fingerprint=? AND status IN ('PENDING','APPROVED') ORDER BY requested_at DESC LIMIT 1").get(invoiceId,fingerprint);
 if(existing)return listConcessions(database,actor,{invoiceId}).find(r=>r.id===existing.id);
 const id=crypto.randomUUID();database.sqlite.prepare('INSERT INTO finance_concession_requests (id,patient_key,invoice_id,requested_by,requested_at,reason,fingerprint) VALUES (?,?,?,?,?,?,?)').run(id,patientKey,invoiceId,actor.userId,Date.now(),reason,fingerprint);
 return listConcessions(database,actor,{invoiceId}).find(r=>r.id===id);
}
export function reviewConcession(database,id,values,actor){
 if(!PAYMENT_REVIEW_ROLES.includes(actor.role))fail('Admin, Director or Vice Director approval is required.',403);
 if(typeof values.approved!=='boolean')fail('Choose approve or reject.');
 const row=database.sqlite.prepare('SELECT * FROM finance_concession_requests WHERE id=?').get(id);if(!row)fail('Request was not found.',404);if(row.status!=='PENDING')fail('Request was already reviewed.',409);
 assertConcessionInvoice(database,row.patient_key,row.invoice_id);
 if(invoiceConcessionFingerprint(database,row.patient_key,row.invoice_id)!==row.fingerprint){database.sqlite.prepare("UPDATE finance_concession_requests SET status='STALE' WHERE id=?").run(id);fail('Services changed. Request a new approval.',409);}
 database.sqlite.prepare('UPDATE finance_concession_requests SET status=?,reviewed_by=?,reviewed_at=?,review_note=? WHERE id=?').run(values.approved?'APPROVED':'REJECTED',actor.userId,Date.now(),clean(values.note,1000),id);
 return listConcessions(database,actor,{invoiceId:row.invoice_id}).find(r=>r.id===id);
}
export function requireConcessionApproval(database,patientKey,invoiceId,values){
 const id=clean(values.approvalId,60);const row=database.sqlite.prepare('SELECT * FROM finance_concession_requests WHERE id=? AND invoice_id=? AND patient_key=?').get(id,invoiceId,patientKey);
 if(!row||!['APPROVED','APPLIED'].includes(row.status))fail('Full exemption requires an approved request from Admin, Director or Vice Director.',403);
 if(invoiceConcessionFingerprint(database,patientKey,invoiceId)!==row.fingerprint)fail('Invoice services changed after approval. Request approval again.',409);
 return row;
}
export function concessionMetadata(database,id){if(!id)return null;return database.sqlite.prepare('SELECT r.reason,r.reviewed_at approvedAt,u.display_name approvedByName FROM finance_concession_requests r LEFT JOIN users u ON u.id=r.reviewed_by WHERE r.id=?').get(id)||null;}
