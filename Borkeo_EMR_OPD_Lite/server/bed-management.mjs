const managers=['ADMIN','DIRECTOR','VICE_DIRECTOR'];
const fail=message=>{throw Object.assign(new Error(message),{status:409})};
export function roomMatchesWard(department,room,ward){return ['gynecology','obstetric'].includes(ward)?department.code==='gyneco-obstetric'&&room.code===ward:department.code===ward;}
export function mergeBedState(existing,incoming,{role,wardCode}){
 if(!Array.isArray(incoming?.departments))fail('Departments are required.');
 const result=structuredClone(existing||{departments:[]});
 if(managers.includes(role))return structuredClone(incoming);
 if(!wardCode)fail('Choose a working ward.');
 for(const department of incoming.departments){
  const rooms=(department.rooms||[]).filter(room=>roomMatchesWard(department,room,wardCode));
  let target=result.departments.find(d=>d.id===department.id&&d.code===department.code);
  if(!target&&rooms.length){target={...department,rooms:[]};result.departments.push(target);}
  if(target){target.rooms=[...(target.rooms||[]).filter(r=>!roomMatchesWard(target,r,wardCode)),...structuredClone(rooms)];}
 }
 return result;
}
export function validateBedState(existing,incoming,findPatient){
 const ids=new Set(),patients=new Set(),beds=new Map();
 if(!Array.isArray(incoming?.departments)||incoming.departments.length>100)fail('Invalid ward map.');
 for(const d of incoming.departments){for(const item of [d,...(d.rooms||[])]){if(!item.id||ids.has(item.id))fail('Room and ward identifiers must be unique.');ids.add(item.id);}if(!Array.isArray(d.rooms)||d.rooms.length>200)fail('Invalid rooms.');
  for(const room of d.rooms){if(!Array.isArray(room.beds)||room.beds.length>200)fail('Choose between 0 and 200 beds in each room.');const labels=new Set();for(const bed of room.beds){if(!bed.id||ids.has(bed.id)||!String(bed.label||'').trim()||labels.has(String(bed.label)))fail('Bed identifiers and numbers must be unique.');ids.add(bed.id);labels.add(String(bed.label));beds.set(bed.id,{bed,room,d});if(bed.patientKey){const p=findPatient(bed.patientKey);if(!p||p.discharge_date||p.department_code!==d.code){bed.patientKey='';continue;}if(patients.has(bed.patientKey))fail('A patient cannot occupy two beds.');patients.add(bed.patientKey);let data={};try{data=JSON.parse(p.record_json||'{}')}catch{}if(data['system:currentBedId']&&data['system:currentBedId']!==bed.id)fail('Use the patient transfer action to move an occupied bed.');}}}
 }
 for(const d of existing?.departments||[])for(const r of d.rooms||[])for(const b of r.beds||[]){if(!b.patientKey)continue;const p=findPatient(b.patientKey);let data={};try{data=JSON.parse(p?.record_json||'{}')}catch{}const stillOccupied=p&&!p.discharge_date&&p.department_code===d.code&&(!data['system:currentBedId']||data['system:currentBedId']===b.id);if(stillOccupied&&beds.get(b.id)?.bed.patientKey!==b.patientKey)fail('Move or discharge the patient before removing an occupied bed.');}
 return incoming;
}
