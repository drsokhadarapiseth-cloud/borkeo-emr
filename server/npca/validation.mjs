import { modelDefinitions, formDefinitions, validCode, referenceSheets, formValueSet } from './codes.mjs';
const blank=v=>v==null||v===''||(Array.isArray(v)&&!v.length);
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v+'T00:00:00Z'))&&new Date(v+'T00:00:00Z').toISOString().slice(0,10)===v;
const datetime=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}\+07:00$/.test(v)&&Number.isFinite(Date.parse(v));
const get=(obj,path)=>path.split('.').reduce((v,k)=>v?.[k],obj);
const findModel=name=>modelDefinitions.find(m=>m.name.startsWith(name));
const screens={patient:'registration',triages:'triage',vital_signs:'triage',invoices:'billing',progress_notes:'daily',prescriptions:'pharmacy',forms:'medical',referral:'discharge'};
export function validateVisitPayload(payload,{completed=true,admissionClaim=false,sourceIssues=[],diagnosisExists=()=>false,medicineExists=()=>false,addressValid=()=>false,eligible=false,sendForms=true}={}){
  const errors=[];
  const add=(field,code='required',label='')=>{const screen=screens[field.split('.')[0]]||'medical';errors.push({field,code,screen,
    messageKh:'សូមបំពេញ ឬកែព័ត៌មាននេះ៖ '+(label||field),messageEn:'Complete or correct: '+field});};
  for(const item of sourceIssues){add(item.field,item.code);errors.at(-1).screen=item.screen;}
  if(!payload||!Array.isArray(payload.visits)||payload.visits.length!==1){add('visits');return errors;}
  const v=payload.visits[0];
  const model=(obj,name,path,{skip=[]}={})=>{
    if(!obj||typeof obj!=='object'||Array.isArray(obj)){add(path,'object');return;}
    for(const field of findModel(name)?.fields||[]){if(skip.includes(field.name))continue;const value=get(obj,field.name),p=path?path+'.'+field.name:field.name;
      if(blank(value)){if(field.required)add(p,'required',field.kh);continue;}
      const type=field.name==='diagnosis_name'?'string':field.type;
      if(type==='date'&&!date(value))add(p,'date');
      else if(type==='datetime'&&!datetime(value))add(p,'datetime');
      else if(['number','numeric','integer'].includes(type)&&(typeof value!=='number'||!Number.isFinite(value)||(type==='integer'&&!Number.isInteger(value))))add(p,'number');
      else if(type==='boolean'&&typeof value!=='boolean')add(p,'boolean');
      else if(['string','text'].includes(type)&&typeof value!=='string')add(p,'string');
      else if(type.startsWith('array')&&!Array.isArray(value))add(p,'array');
    }
  };
  model(v,'Visit','',{skip:completed?[]:['discharge_type','visit_outcome','discharged_at']});
  model(v.patient,'Patient','patient');model(v.patient?.address,'Patient.Address','patient.address');
  if(!eligible)add('patient.spid','beneficiary-not-eligible');
  if(!/^\d{9,10}$/.test(v.patient?.phone||''))add('patient.phone','phone');
  if(!addressValid(v.patient?.address))add('patient.address','ncdd');
  for(const [field,category]of [['sex','sex'],['marital_status','marital'],['nationality','nationality']])if(!validCode(category,v.patient?.[field]))add('patient.'+field,'code');
  for(const [field,category]of [['admission_type','admission'],['visit_type','visit'],...(completed?[['discharge_type','discharge'],['visit_outcome','outcome']]:[])])if(!validCode(category,v[field]))add(field,'code');
  if(v.patient_code!==v.patient?.code)add('patient_code','link');
  if(completed&&datetime(v.discharged_at)&&v.discharged_at<v.admitted_at)add('discharged_at','chronology');
  if(!completed&&!(admissionClaim&&v.visit_type==='VITY-00J000C'))add('discharged_at','visit-not-completed');
  const initial=new Set(),progress=new Set(),allCodes=new Set();
  for(const [key,definition]of [['outpatients','Outpatients'],['inpatients','Inpatients'],['emergencies','Emergency'],['surgeries','Surgeries'],['progress_notes','Progress Notes']])for(const [i,e]of (v[key]||[]).entries()){
    const path=key+'.'+i;model(e,definition,path);
    if(allCodes.has(e.code))add(path+'.code','duplicate');allCodes.add(e.code);
    if(key==='progress_notes')progress.add(e.code);else if(key!=='surgeries')initial.add(e.code);
    if(e.visit_code!==v.code)add(path+'.visit_code','link');
    if(e.ended_at&&e.started_at>e.ended_at)add(path+'.ended_at','chronology');
  }
  if(v.visit_type==='VITY-00J000C'&&!v.inpatients?.length)add('inpatients');
  if(v.visit_type==='VITY-00L000D'&&!v.outpatients?.length)add('outpatients');
  for(const [key,parents]of [['surgeries',initial],['progress_notes',new Set((v.inpatients||[]).map(e=>e.code))]])for(const [i,e]of(v[key]||[]).entries())if(!parents.has(e.encounter_code))add(key+'.'+i+'.encounter_code','link');
  if(completed&&v.visit_type==='VITY-00J000C'&&Date.parse(v.discharged_at)-Date.parse(v.admitted_at)>86400000&&!progress.size)add('progress_notes');
  if(!Array.isArray(v.triages)||v.triages.length!==1)add('triages','one-triage');
  for(const [i,t]of(v.triages||[]).entries()){
    model(t,'Triages','triages.'+i);if(!(t.height>0&&t.weight>0))add('triages.'+i,'height-weight');
    if(t.visit_code!==v.code||t.patient_code!==v.patient_code)add('triages.'+i,'link');
    const first=[...(v.inpatients||[]),...(v.outpatients||[]),...(v.emergencies||[])].map(e=>e.started_at).filter(Boolean).sort()[0];if(first&&t.recorded_at>first)add('triages.'+i+'.recorded_at','chronology');
  }
  const triageCodes=new Set((v.triages||[]).map(t=>t.code));
  const requiredVitals=referenceSheets['Vital signs'].slice(1,7).map(row=>row[0]);
  for(const [i,block]of(v.vital_signs||[]).entries()){
    model(block,'Vital Signs','vital_signs.'+i);if(!triageCodes.has(block.encounter_code)&&!progress.has(block.encounter_code))add('vital_signs.'+i+'.encounter_code','link');
    for(const [j,o]of(block.observations||[]).entries()){model(o,'Vital Sign.Observations',`vital_signs.${i}.observations.${j}`);if(!validCode('vital',o.name))add(`vital_signs.${i}.observations.${j}.name`,'code');}
    const names=(block.observations||[]).map(o=>o.name);if(new Set(names).size!==names.length)add('vital_signs.'+i,'duplicate');
    if(triageCodes.has(block.encounter_code))for(const name of requiredVitals)if(!names.includes(name))add('vital_signs.'+i+'.'+name);
  }
  if(!(v.vital_signs||[]).some(b=>triageCodes.has(b.encounter_code)))add('vital_signs');
  for(const [key,definition,category]of [['medical_histories','Medical Histories','history'],['physical_examinations','Physical Examination','physical'],['laboratories','Laboratories'],['imageries','Imageries'],['diagnoses','Diagnosis']])for(const [i,row]of(v[key]||[]).entries()){
    const path=key+'.'+i;model(row,definition,path);
    if(row.visit_code!==v.code||row.patient_code!==v.patient_code)add(path,'link');
    if(row.encounter_code&&!initial.has(row.encounter_code))add(path+'.encounter_code','link');
    if(category&&!validCode(category,row.name))add(path+'.name','code');
    if(key==='laboratories'||key==='imageries'){
      if(!row.results?.length)add(path+'.results');
      for(const [j,result]of(row.results||[]).entries())model(result,key==='laboratories'?'Laboratories.Results':'Imageries.Results',path+'.results.'+j);
    }
    if(key==='diagnoses'&&(!diagnosisExists(row.diagnosis_code)||!['In','Out','Primary','Secondary','Differential'].includes(row.diagnosis_type_name)))add(path,'diagnosis');
  }
  if(!(v.diagnoses||[]).some(d=>d.diagnosis_type_name==='In'))add('diagnoses.In');
  if(completed&&!(v.diagnoses||[]).some(d=>['Out','Primary'].includes(d.diagnosis_type_name)))add('diagnoses.Out');
  for(const [i,soap]of(v.soaps||[]).entries()){model(soap,'SOAPs','soaps.'+i);if(!initial.has(soap.encounter_code)&&!progress.has(soap.encounter_code))add('soaps.'+i+'.encounter_code','link');}
  for(const e of [...(v.outpatients||[]),...(v.progress_notes||[])])if(!(v.soaps||[]).some(s=>s.encounter_code===e.code))add('soaps.'+e.code);
  for(const [i,rx]of(v.prescriptions||[]).entries()){
    const path='prescriptions.'+i;model(rx,'Prescriptions',path);if(rx.encounter_code!==null&&!allCodes.has(rx.encounter_code))add(path+'.encounter_code','link');
    if(rx.patient_code!==v.patient_code||rx.visit_code!==v.code)add(path,'link');
    if(!rx.medications?.length)add(path+'.medications');const seen=new Set();
    for(const [j,m]of(rx.medications||[]).entries()){
      const p=path+'.medications.'+j;model(m,'Prescription.Medications',p,{skip:m.interval?['morning','afternoon','evening','night']:['interval']});model(m.dispense,'Prescription.Medications.Dispense',p+'.dispense');
      if(!m.code||!medicineExists(m.code))add(p+'.code','cms');
      if(seen.has(m.code))add(p+'.code','duplicate');seen.add(m.code);
      if(!(m.days>0&&Number.isInteger(m.days)))add(p+'.days','days');
      if(!(m.dispense?.quantity>0)||typeof m.dispense?.unit!=='string'||!m.dispense.unit)add(p+'.dispense','dispense');
      if(m.interval&&!/^\d+(?:\.\d+)?h$/.test(m.interval))add(p+'.interval','schedule');
      if(!m.interval&&(!['morning','afternoon','evening','night'].some(k=>m[k]>0)||['morning','afternoon','evening','night'].some(k=>m[k]<0)))add(p,'schedule');
    }
  }
  if(completed&&!v.prescriptions?.length&&!v.consultations?.some(x=>typeof x==='string'&&x.trim()))add('consultations');
  if(completed&&!v.invoices?.length)add('invoices');
  for(const [i,inv]of(v.invoices||[]).entries()){
    const p='invoices.'+i;model(inv,'Invoice',p,{skip:['encounter_code']});if(!validCode('payment',inv.payment_type))add(p+'.payment_type','code');
    if(inv.patient_code!==v.patient_code||inv.visit_code!==v.code)add(p,'link');
    if(!inv.services?.length&&!inv.medications?.length)add(p+'.services');
    for(const [j,service]of(inv.services||[]).entries()){model(service,'Invoice.Services',p+'.services.'+j);if(service.invoice_code!==inv.code)add(p+'.services.'+j,'link');}
    for(const [j,m]of(inv.medications||[]).entries()){model(m,'Invoice.Medications',p+'.medications.'+j);if(!medicineExists(m.medicine_code)||m.invoice_code!==inv.code)add(p+'.medications.'+j,'cms');}
  }
  for(const direction of ['referred_from','referred_to'])if(v.referral?.[direction]){const p='referral.'+direction,r=v.referral[direction];model(r,direction==='referred_to'?'Refer To':'referral.referred_from',p);model(r.health_facility,'referral.referred_from.health_facility',p+'.health_facility');if(!r.health_facility?.code)add(p+'.health_facility.code');if(r.document_file&&!/^https:\/\//.test(r.document_file))add(p+'.document_file','public-url');}
  if(v.discharge_type==='DITY-000Y00F'&&!v.referral?.referred_to)add('referral.referred_to');
  if(sendForms)for(const [i,form]of(v.forms||[]).entries()){
    const p='forms.'+i,definition=formDefinitions.get(form.form_code);model(form,'Form (',p);if(!initial.has(form.encounter_code))add(p+'.encounter_code','link');if(!definition){add(p+'.form_code','code');continue;}
    for(const field of definition.fields){const value=form.form_data?.[field.name];if(blank(value)){if(field.required)add(p+'.'+field.name,'required',field.kh);continue;}
      if(field.type==='number'&&(typeof value!=='number'||!Number.isFinite(value)))add(p+'.'+field.name,'number');
      if(field.type==='date'&&!date(value))add(p+'.'+field.name,'date');if(field.type==='datetime'&&!datetime(value))add(p+'.'+field.name,'datetime');
      if(field.valueSet){const set=formValueSet(field.valueSet);for(const x of Array.isArray(value)?value:[value])if(!validCode('form:'+set,x))add(p+'.'+field.name,'code');}
    }
  }
  return errors;
}
