import crypto from 'node:crypto';import {assertEncounterWrite,consumeCorrection,encounterAccess} from './encounter-access.mjs';import {patientRecordChangeNotes,normalizedEditorDay} from './editor-history.mjs';
export const IPD_VITALS=Object.freeze({ipd_temp:'p2_temp',ipd_bp_sys:'p2_bp_sys',ipd_bp_dia:'p2_bp_dia',ipd_pulse:'p2_pulse',ipd_resp:'p2_resp',ipd_spo2:'p2_spo2',ipd_weight:'p2_weight',ipd_height:'p2_height'});
const fail=(status,message='ទិន្នន័យមិនត្រឹមត្រូវ')=>{throw Object.assign(new Error(message),{status})};
export function normalizeIpdVitals(values){
 if(!values||typeof values!=='object'||Array.isArray(values)||!Object.keys(values).length)fail(400);
 return Object.fromEntries(Object.entries(values).map(([key,value])=>{if(!Object.hasOwn(IPD_VITALS,key)||!['string','number'].includes(typeof value))fail(400);const text=String(value).trim().replace(',','.');if(text!==''&&(!/^-?\d{1,6}(?:\.\d{1,3})?$/.test(text)||!Number.isFinite(Number(text))||Number(text)<(key==='ipd_temp'?-100:0)||Number(text)>(key==='ipd_temp'||key==='ipd_spo2'?100:100000)))fail(400);return [key,text]}));
}
export function validateIpdMedicalFields(data,prior={}){
 const changed=Object.fromEntries(Object.keys(IPD_VITALS).filter(id=>data['scope:medical:id:'+id]!==undefined&&data['scope:medical:id:'+id]!==prior['scope:medical:id:'+id]).map(id=>[id,data['scope:medical:id:'+id]]));if(Object.keys(changed).length)for(const [id,v] of Object.entries(normalizeIpdVitals(changed)))data['scope:medical:id:'+id]=v;
 const choices={ipd_past_pregnancy:['','unknown','yes','no'],ipd_current_pregnancy:['','unknown','pregnant','not_pregnant','possible','not_applicable'],ipd_breastfeeding:['','unknown','yes','no'],ipd_soap_manual:['','true','false']};for(const [id,allowed] of Object.entries(choices)){const value=data['scope:medical:id:'+id];if(value!==undefined&&!allowed.includes(value))fail(400)}
 for(const [id,max,integer] of [['ipd_gestational_weeks',50,false],['ipd_previous_ectopic',99,true]]){const value=data['scope:medical:id:'+id];if(value!==undefined&&value!==''&&(!/^\d+(?:\.\d)?$/.test(String(value))||Number(value)>max||integer&&!Number.isInteger(Number(value))))fail(400)}
 for(const [id,max] of [['ipd_pregnancy_history_notes',4000],['ipd_soap_summary',30000]]){const value=data['scope:medical:id:'+id];if(value!==undefined&&(typeof value!=='string'||value.length>max))fail(400)}
 const date=data['scope:medical:id:ipd_pregnancy_confirmed_on'];if(date!==undefined&&date!==''&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!Number.isFinite(Date.parse(date))||new Date(date).toISOString().slice(0,10)!==date))fail(400);
}
export function mountIpdRecordRoutes(router){
 router.post('/api/ipd/vitals',async ctx=>{
  const role=ctx.requireContext(ctx.session);if(!['DOCTOR','CHIEF_WARD','NURSE','MIDWIFE','ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role))fail(403,'មិនមានសិទ្ធិ');
  const body=await ctx.readJson(ctx.request,4000);if(!body||Object.keys(body).some(k=>!['patientKey','expectedVersion','values'].includes(k))||typeof body.patientKey!=='string'||body.patientKey.length>180||!Number.isSafeInteger(body.expectedVersion))fail(400);
  const values=normalizeIpdVitals(body.values),db=ctx.database,scope=['NURSE','MIDWIFE'].includes(role)?'nursing':'medical';let saved;
  db.sqlite.exec('BEGIN IMMEDIATE');try{
   const before=db.findPatient(body.patientKey);if(!before||before.service_mode!=='ipd')fail(404,'រកមិនឃើញ');const access=assertEncounterWrite(db,ctx.session,before,scope);if(before.version!==body.expectedVersion)fail(409,'ទិន្នន័យត្រូវបានកែប្រែ សូមបើកកំណត់ត្រាថ្មីម្តងទៀត');
   const data=JSON.parse(before.record_json),now=Date.now();for(const [key,value] of Object.entries(values))data['scope:medical:id:'+key]=value;
   const result=db.sqlite.prepare('UPDATE patient_records SET record_json=?,version=version+1,updated_by=?,updated_at=? WHERE patient_key=? AND version=?').run(JSON.stringify(data),ctx.session.user_id,now,before.patient_key,before.version);if(result.changes!==1)fail(409);
   saved=db.findPatient(before.patient_key);const notes=patientRecordChangeNotes(before,saved);db.sqlite.prepare('INSERT INTO patient_editor_history(id,patient_key,scope,day,editor_id,editor_name,editor_role,saved_at,notes_json) VALUES(?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(),before.patient_key,scope,normalizedEditorDay('',now),ctx.session.user_id,ctx.session.display_name||ctx.session.username||'',role,now,JSON.stringify(notes));
   consumeCorrection(db,access);ctx.audit(db,ctx.request,'IPD_VITALS_UPDATED',{userId:ctx.session.user_id,details:{patientKey:before.patient_key,version:saved.version,changedFields:notes}});db.sqlite.exec('COMMIT');
  }catch(error){db.sqlite.exec('ROLLBACK');throw error}
  return ctx.sendJson(ctx.response,200,{patient:{...ctx.patientRecordResponse(saved),recordAccess:encounterAccess(db,ctx.session,saved)}},{secure:ctx.config.cookieSecure});
 },{requireSession:true});
}
