import { createHash } from 'node:crypto';
import { mapCode, formDefinitions, mappedService, formValueSet } from './codes.mjs';
export const stableCode = (visit, type, id = '') => 'BK-' + type + '-' + createHash('sha256').update(visit + '\0' + type + '\0' + id).digest('hex').slice(0,24);
export function npcaTime(value) {
  if (value === '' || value == null) return null;
  let text = String(value).trim();
  if (typeof value !== 'number') {
    const day=text.slice(0,10),dayValue=new Date(day+'T00:00:00Z');
    if(!/^\d{4}-\d{2}-\d{2}/.test(text)||!Number.isFinite(dayValue.getTime())||dayValue.toISOString().slice(0,10)!==day)return null;
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) text += 'T00:00:00+07:00';
    else if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?$/.test(text)) text += '+07:00';
    else if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(text)) return null;
  }
  const epoch = typeof value === 'number' ? value : Date.parse(text);
  return Number.isFinite(epoch) ? new Date(epoch + 7*3600000).toISOString().replace('Z','+07:00') : null;
}
const array = v => Array.isArray(v) ? v : [];
const numeric = v => v === '' || v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;
const compact = obj => Object.fromEntries(Object.entries(obj).filter(([,v])=>v!==undefined));

// Pure construction from the adapter's visit snapshot. Never reads patient data
// from disk, writes a chart, invents clinical findings, or contacts NPCA.
export function buildVisitPayload(source, config, database) {
  const issues=[];
  const issue=(field,screen,code='missing')=>issues.push({field,screen,code});
  const code=(category,value,field,screen)=>{const result=mapCode(category,value,database);if(!result)issue(field,screen,'unmapped');return result;};
  const patientCode = source.patient.healthId || source.patient.patientKey;
  const visitCode = stableCode(source.patient.patientKey,'visit');
  const link = {patient_code:patientCode,visit_code:visitCode};
  const stamp = {created_at:npcaTime(source.createdAt),updated_at:npcaTime(source.updatedAt)};
  const patient={code:patientCode,surname:source.patient.surname,name:source.patient.name,
    sex:code('sex',source.patient.sex,'patient.sex','registration'),birthdate:source.patient.birthdate,
    phone:String(source.patient.phone||'').replace(/[\s()-]/g,''),nationality:code('nationality',source.patient.nationality,'patient.nationality','registration'),
    marital_status:code('marital',source.patient.maritalStatus,'patient.marital_status','registration'),
    // Optional in the PDF: sent only when Registration has a value.
    ...(source.patient.occupation?{occupation:source.patient.occupation}:{}),...(array(source.patient.disabilities).length?{disabilities:array(source.patient.disabilities)}:{}),spid:source.link?.spid,
    address:source.patient.address,identifications:array(source.patient.identifications).map(item=>({...item,patient_code:patientCode})),...stamp};
  const visit={health_facility_code:config.facilityCode,patient_code:patientCode,code:visitCode,
    admission_type:code('admission',source.admissionType,'admission_type','registration'),
    visit_type:code('visit',source.visitType,'visit_type','triage'),admitted_at:npcaTime(source.admittedAt),...stamp,
    ...(source.completed?{discharge_type:code('discharge',source.dischargeType,'discharge_type','discharge'),visit_outcome:code('outcome',source.outcome,'visit_outcome','discharge'),discharged_at:npcaTime(source.dischargedAt)}:{}),
    ...(source.followupAt?{followup_at:npcaTime(source.followupAt)}:{}),patient};
  const encounterMap=new Map();
  // PDF 5.1: every encounter carries its class ("OPD", "IPD" or "EMERGENCY");
  // surgery and progress notes belong to the visit's own class.
  const visitClass=source.visitType==='ipd'?'IPD':'OPD';
  for(const [key,type,encounterClass] of [['outpatients','opd','OPD'],['inpatients','ipd','IPD'],['emergencies','emergency','EMERGENCY'],['surgeries','surgery',visitClass],['progress_notes','progress','IPD']]){
    visit[key]=array(source[key]).map((item,index)=>{
      const id=item.id??String(index), encounterCode=stableCode(source.patient.patientKey,type,String(id));encounterMap.set(String(id),encounterCode);
      return compact({...item,visit_code:visitCode,code:encounterCode,class:encounterClass,id:undefined,encounterId:undefined,is_new:item.is_new,started_at:npcaTime(item.started_at),ended_at:npcaTime(item.ended_at),...stamp});
    });
  }
  const encounterCode = id => id==null ? null : encounterMap.get(String(id));
  for(const key of ['surgeries','progress_notes'])for(const [index,item]of visit[key].entries())item.encounter_code=encounterCode(source[key][index].encounterId);
  const firstEncounter=[...visit.outpatients,...visit.inpatients,...visit.emergencies].map(e=>e.started_at).filter(Boolean).sort()[0] || visit.admitted_at;
  const candidates=array(source.triages).filter(t=>npcaTime(t.recorded_at)&&npcaTime(t.recorded_at)<=firstEncounter).sort((a,b)=>npcaTime(a.recorded_at).localeCompare(npcaTime(b.recorded_at)));
  // Latest triage before the first consultation/admission, exactly one.
  const triage=candidates.at(-1);
  if(!triage)issue('triages','triage');
  const triageCode=stableCode(source.patient.patientKey,'triage',String(triage?.id||'initial'));
  visit.triages=triage?[{...link,code:triageCode,chief_complaint:triage.chief_complaint,height:numeric(triage.height),weight:numeric(triage.weight),recorded_at:npcaTime(triage.recorded_at),recorded_by:triage.recorded_by,title:triage.title}]:[];
  visit.vital_signs=triage?[{encounter_code:triageCode,recorded_at:npcaTime(triage.recorded_at),recorded_by:triage.recorded_by,title:triage.title,observations:array(triage.observations).map(o=>({name:code('vital',o.name,'vital_signs.name','triage'),value:numeric(o.value)}))}]:[];
  for(const item of array(source.dailyVitals))visit.vital_signs.push(compact({...item,encounterId:undefined,encounter_code:encounterCode(item.encounterId),recorded_at:npcaTime(item.recorded_at),observations:array(item.observations).map(o=>({name:code('vital',o.name,'vital_signs.name','daily'),value:numeric(o.value)}))}));
  for(const [key,category] of [['medical_histories','history'],['physical_examinations','physical']])visit[key]=array(source[key]).filter(item=>item.value!==''&&item.value!=null&&(!Array.isArray(item.value)||item.value.length)).map(item=>compact({...item,...link,encounter_code:encounterCode(item.encounterId),encounterId:undefined,name:code(category,item.name,key+'.name','medical')}));
  for(const key of ['laboratories','imageries'])visit[key]=array(source[key]).filter(item=>item.released===true).map(item=>compact({...item,...link,released:undefined,encounterId:undefined,encounter_code:encounterCode(item.encounterId),requested_at:npcaTime(item.requested_at),results:array(item.results).map(result=>({...result,verified_at:npcaTime(result.verified_at),recorded_at:npcaTime(result.recorded_at),...(key==='imageries'?{images:array(result.images).filter(url=>source.reachableImageUrls?.includes(url)&&/^https:\/\//.test(url))}:{})}))}));
  // The PDF names the field diagnosis_type, the Excel workbook diagnosis_type_name: both are sent.
  visit.diagnoses=array(source.diagnoses).map(item=>compact({...item,...link,diagnosis_type:item.diagnosis_type_name,encounterId:undefined,encounter_code:encounterCode(item.encounterId),diagnosed_at:npcaTime(item.diagnosed_at)}));
  visit.soaps=array(source.soaps).map((item,index)=>compact({...item,encounterId:undefined,encounter_code:encounterCode(item.encounterId),code:stableCode(source.patient.patientKey,'soap',String(item.id??index)),id:undefined,recorded_at:npcaTime(item.recorded_at)}));
  // CMS code as code (Excel) and medicine_code (PDF); form as in the PDF example.
  visit.prescriptions=array(source.prescriptions).map((item,index)=>({...link,encounter_code:item.home===true?null:encounterCode(item.encounterId),code:stableCode(source.patient.patientKey,'rx',String(item.id??index)),prescribed_at:npcaTime(item.prescribed_at),prescribed_by:item.prescribed_by,title:item.title,medications:array(item.medications).map(m=>compact({code:m.cmsCode,medicine_code:m.cmsCode,medicine_name:m.medicine_name,strength:m.strength,form:m.form||undefined,method:m.method,unit:m.unit,
    morning:numeric(m.morning),afternoon:numeric(m.afternoon),evening:numeric(m.evening),night:numeric(m.night),days:numeric(m.days),interval:m.interval||undefined,note:m.note||undefined,dispense:{quantity:numeric(m.dispense?.quantity),unit:m.dispense?.unit}}))}));
  visit.consultations=array(source.consultations).filter(Boolean);
  visit.invoices=array(source.invoices).map(item=>{
    const invoiceCode=stableCode(source.patient.patientKey,'invoice',String(item.id));
    const services=array(item.services).map(s=>{const mapped=mappedService(database,s.localCode);if(!mapped)issue('invoices.services.'+s.localCode,'billing','unmapped');return compact({...s,localCode:undefined,invoice_code:invoiceCode,service_code:mapped});});
    return {...link,code:invoiceCode,payment_type:code('payment',item.paymentType,'invoices.payment_type','billing'),invoice_date:npcaTime(item.date),total:numeric(item.total),cashier:item.cashier,...stamp,services,medications:array(item.medications).map(m=>({...m,invoice_code:invoiceCode}))};
  });
  if(source.referral){visit.referral={};for(const direction of ['referred_from','referred_to'])if(source.referral[direction]){const r=source.referral[direction];visit.referral[direction]={...r,code:stableCode(source.patient.patientKey,'referral',direction),referred_at:npcaTime(r.referred_at),...(r.received_at?{received_at:npcaTime(r.received_at)}:{})};}}
  if(config.sendForms)visit.forms=array(source.forms).map(item=>{
    const definition=formDefinitions.get(item.form_code);if(!definition)issue('forms.form_code','medical','unmapped');
    const values={};for(const field of definition?.fields||[]){let value=item.form_data?.[field.name];
    if(value==null||value===''||Array.isArray(value)&&!value.length)continue;
    if(field.type==='number')value=numeric(value);else if(field.type==='datetime'&&value)value=npcaTime(value);
    if(value!=null&&field.valueSet){
      const set=formValueSet(field.valueSet);
      value=Array.isArray(value)?value.map(v=>code('form:'+set,v,'forms.'+field.name,'medical')):code('form:'+set,value,'forms.'+field.name,'medical');
    }values[field.name]=value;}
    return {visit_code:visitCode,encounter_code:encounterCode(item.encounterId),form_code:item.form_code,form_name:definition?.name,form_data:values};
  });
  return {payload:{visits:[visit]},issues,visitCode};
}
