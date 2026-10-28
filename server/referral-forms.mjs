import crypto from 'node:crypto';
import {referralFields,referralChecks} from '../public/referral-schema.mjs';
import {sessionRole,sessionWard,canAccessPatient} from './access.mjs';
import {encounterAccess} from './encounter-access.mjs';
import {canSignReferral,canUseMaternalPatient} from './maternal.mjs';
import {getESignature,signatureSnapshot} from './esign.mjs';

const fail=(status,message)=>{throw Object.assign(new Error(message),{status})};
export function ensureReferralFormSchema(db){db.sqlite.exec(`CREATE TABLE IF NOT EXISTS referral_form_revisions(
 id TEXT PRIMARY KEY,patient_key TEXT NOT NULL REFERENCES patient_records(patient_key) ON DELETE CASCADE,revision INTEGER NOT NULL,
 data_json TEXT NOT NULL,signature_json TEXT NOT NULL,created_by TEXT NOT NULL REFERENCES users(id),created_at INTEGER NOT NULL,
 UNIQUE(patient_key,revision)) STRICT;`)}
export function referralAccess(db,session,key,consultationPaid){
 if(!session)fail(401,'សូមចូលប្រើប្រព័ន្ធជាមុន');
 const row=db.findPatient(key);if(!row)fail(404,'រកមិនឃើញអ្នកជំងឺ');
 const role=sessionRole(session),ward=sessionWard(session);
 const anc=row.department_code==='anc'&&row.service_mode==='opd';
 const signedAnc=anc&&canSignReferral(session,ward)&&Boolean(db.sqlite.prepare("SELECT 1 FROM anc_visits WHERE patient_key=? AND json_extract(referral_json,'$.signed.userId') IS NOT NULL LIMIT 1").get(key));
 const maternalRead=anc&&canUseMaternalPatient(session,row,ward);
 if(!['DOCTOR','CHIEF_WARD','MIDWIFE','ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role)||(!canAccessPatient(db,session,row)&&!signedAnc&&!maternalRead))fail(403,'អ្នកមិនមានសិទ្ធិចូលទម្រង់នេះទេ');
 const access=encounterAccess(db,session,row,'medical');
 const paymentReady=row.service_mode!=='opd'||anc||Boolean(consultationPaid?.(db,row));
 return {row,canEdit:['DOCTOR','CHIEF_WARD'].includes(role)&&paymentReady&&!access.discharged&&!access.received&&(anc?signedAnc:access.canEdit)};
}
export function latestReferral(db,key){const r=db.sqlite.prepare('SELECT * FROM referral_form_revisions WHERE patient_key=? ORDER BY revision DESC LIMIT 1').get(key);return r?{id:r.id,revision:r.revision,data:JSON.parse(r.data_json),signature:JSON.parse(r.signature_json),createdAt:r.created_at}:null}
export function referralDefaults(row){
 const d=JSON.parse(row.record_json||'{}');
 const value=(id)=>d['scope:medical:id:'+id]||d['scope:triage:id:'+id]||'';
 return {province:'រតនគិរី',facility:'មន្ទីរពេទ្យបង្អែក បរកែវ',patientId:row.health_id||row.case_number,name:row.full_name,sex:row.sex,birth:row.date_of_birth||row.age,
 phone:row.phone,equity:row.equity_card,village:d['scope:registration:id:web_village']||'',commune:d['scope:registration:id:web_commune']||'',
 districtAddress:d['scope:registration:id:web_district']||'',provinceAddress:d['scope:registration:id:web_province']||'',admission:row.entry_date,
 diagnosis:value('emr_pmrs_opd_diagnosis')||value('emr_pmrs_ipd_diagnosis'),pulse:value('opd_pulse')||value('p2_pulse'),
 bp:[value('opd_bp_sys')||value('p2_bp_sys'),value('opd_bp_dia')||value('p2_bp_dia')].filter(Boolean).join('/'),
 respiration:value('opd_resp')||value('p2_resp'),temperature:value('opd_temp')||value('p2_temp'),spo2:value('opd_spo2')||value('p2_spo2')};
}
export function saveReferral(db,session,key,body,consultationPaid){
 const access=referralAccess(db,session,key,consultationPaid);if(!access.canEdit)fail(403,'មិនអាចកែប្រែ ឬចុះហត្ថលេខាលើទម្រង់នេះបានទេ');
 if(!Number.isSafeInteger(body.revision)||body.revision<0||!body.data||typeof body.data!=='object'||Array.isArray(body.data))fail(400,'ទិន្នន័យទម្រង់មិនត្រឹមត្រូវ');
 const data={};for(const [k,v] of Object.entries(body.data)){
  if(Object.hasOwn(referralFields,k)){if(typeof v!=='string'||v.length>4000||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v))fail(400,'អត្ថបទវែងពេក ឬមិនត្រឹមត្រូវ');data[k]=v;}
  else if(Object.hasOwn(referralChecks,k)){if(typeof v!=='boolean')fail(400,'ជម្រើសមិនត្រឹមត្រូវ');data[k]=v;}
  else fail(400,'មានទិន្នន័យក្រៅទម្រង់');
 }
 let signature=null;
 if(body.signatureMode==='SAVED'){
  const saved=getESignature(db,session.user_id);if(!saved?.hasSignature)fail(400,'មិនមានហត្ថលេខាដែលបានរក្សាទុកទេ សូមចុះហត្ថលេខាលើអេក្រង់');
  signature={...signatureSnapshot(db,session),signatureDataUrl:saved.signatureDataUrl,source:'saved'};
 }else if(body.signatureMode==='DRAWN'){
  const png=body.signatureDataUrl;if(typeof png!=='string'||png.length>140000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png)||!Buffer.from(png.split(',')[1],'base64').subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))fail(400,'ហត្ថលេខាមិនត្រឹមត្រូវ');
  signature={...signatureSnapshot(db,session),signatureDataUrl:png,source:'drawn'};
 }else if(body.signatureMode!=='NONE')fail(400,'សូមជ្រើសរើសវិធីចុះហត្ថលេខា');
 db.sqlite.exec('BEGIN IMMEDIATE');try{
  const prior=latestReferral(db,key);if((prior?.revision||0)!==body.revision)fail(409,'ទម្រង់ត្រូវបានកែប្រែ សូមបើកឡើងវិញ');
  const revision=body.revision+1,id=crypto.randomUUID();db.sqlite.prepare('INSERT INTO referral_form_revisions VALUES(?,?,?,?,?,?,?)').run(id,key,revision,JSON.stringify(data),JSON.stringify(signature),session.user_id,Date.now());db.sqlite.exec('COMMIT');return latestReferral(db,key);
 }catch(error){db.sqlite.exec('ROLLBACK');throw error}
}
