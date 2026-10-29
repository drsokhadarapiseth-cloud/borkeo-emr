import {lookupId} from './network-registration.mjs';
const invalid=()=>{throw Object.assign(new Error('ទិន្នន័យមិនត្រឹមត្រូវ'),{status:400})};
export function searchMode(value='all'){if(!['all','id','name','phone','other'].includes(value))invalid();return value}
export function searchPatients(db,q,mode='all',offset=0,match='partial'){
 mode=searchMode(mode);const normalized=lookupId(q);if(typeof q!=='string'||q.length>120||normalized.length<3||!Number.isSafeInteger(offset)||offset<0||offset>1000000)invalid();
 const columns={id:['health_id','case_number','patient_key','id'],name:['full_name'],phone:['phone'],other:[`json_extract(CASE WHEN json_valid(record_json) THEN record_json ELSE '{}' END,'$."scope:registration:id:web_other_card_number"')`]};
 if(!['partial','exact'].includes(match)||(mode==='all'&&match==='exact'))invalid();
 const fields=mode==='all'?[...columns.id,...columns.name,...columns.phone]:columns[mode],exact=match==='exact'&&mode!=='name',escaped=normalized.replace(/[\\%_]/g,'\\$&'),needle=exact?normalized:(match==='partial'?'%':'')+escaped+'%';
 return db.sqlite.prepare('SELECT * FROM patient_records WHERE '+fields.map(f=>exact?`emr_lookup_id(${f})=?`:`emr_lookup_id(${f}) LIKE ? ESCAPE '\\'`).join(' OR ')+" ORDER BY CASE WHEN emr_lookup_id(health_id)=? OR emr_lookup_id(case_number)=? THEN 0 ELSE 1 END,entry_date DESC,created_at DESC LIMIT 25 OFFSET ?").all(...fields.map(()=>needle),normalized,normalized,offset);
}
