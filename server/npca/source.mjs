import { pmrs2Preview } from '../pmrs/mapping.mjs';
import { findPregnancy, listVisits } from '../maternal.mjs';
import { medicineCatalogue } from '../medicine-catalogue.mjs';
import { summarizeClinicalExamination } from '../../public/pmrs2-exam-normal.js';
import { formDefinitions } from './codes.mjs';
import { canonicalAddress } from './address.mjs';
import { patientBill } from '../finance.mjs';
import { activeAllergies } from '../clinical-summary.mjs';
import { registrationMarital, registrationOccupation, registrationDisabilities } from './registration-fields.mjs';
export function parse(value, fallback = {}) { try { return typeof value==='string'?JSON.parse(value):value??fallback; } catch { return fallback; } }
const list = value => { const result=parse(value,[]);return Array.isArray(result)?result:[]; };
const num=value=>value==null||value===''?null:Number.isFinite(Number(value))?Number(value):null;
const nonempty=value=>value!=null&&String(value).trim()!=='';
const vitals = values => [['Temperature','temp'],['Heart Rate','pulse'],['Respiratory Rate','resp'],['Systolic Blood Pressure','bp_sys'],['Diastolic Blood Pressure','bp_dia'],['Blood Oxygen','spo2'],['Random Blood Glucose','glucose']].filter(([,key])=>nonempty(values[key])).map(([name,key])=>({name,value:num(values[key])}));
function medication(m) {
  const catalogue=medicineCatalogue().items;
  const item=catalogue.find(item=>item.code===m.cmsCode);
  const slots={qd:['morning'],bid:['morning','evening'],tid:['morning','afternoon','evening'],qid:['morning','afternoon','evening','night']}[m.scheduleType];
  const dose=num(m.doseAmount), times={};
  for(const [name,legacy]of [['morning','m'],['afternoon','a'],['evening','e'],['night','n']]) times[name]=nonempty(m[legacy])?num(m[legacy]):slots&&dose!=null?(slots.includes(name)?dose:0):null;
  return {cmsCode:m.cmsCode,medicine_name:item?.name||m.name,strength:item?.strength||m.strength,form:item?.form||m.form,method:m.route,unit:m.unit,...times,
    interval:m.scheduleType==='qh'&&num(m.qHours??m.qh)>0?String(m.qHours??m.qh)+'h':m.interval,days:m.days??m.d,note:m.note,
    // Use the saved/dispensed quantity. Do not ask NPCA to calculate it.
    dispense:{quantity:num(m.dispense?.quantity??m.dispensedQuantity??m.total),unit:m.dispense?.unit??m.dispenseUnit??m.unit}};
}
export function sourceForPatient(database, row) {
  const data=parse(row.record_json), field=(id,scope='medical')=>data[`scope:${scope}:id:${id}`]??data[`id:${id}`]??'';
  const reg=id=>field(id,'registration'), tri=id=>field(id,'triage');
  const signatures=Object.fromEntries(['medical','triage','discharge','registration'].map(k=>[k,parse(data['system:signature:'+k])]));
  const patient={patientKey:row.patient_key,healthId:row.health_id,surname:row.last_name||reg('web_last_name'),name:row.first_name||reg('web_first_name'),sex:row.sex,birthdate:row.date_of_birth||reg('web_dob'),phone:row.phone||reg('web_phone'),nationality:reg('web_nat'),maritalStatus:reg('web_marital'),address:{}};
  for(const level of ['province','district','commune','village'])patient.address[level]={code:String(reg('web_'+level+'_code')||''),name:String(reg('web_'+level)||'')};
  patient.address=canonicalAddress(patient.address)||patient.address;
  patient.maritalStatus||=registrationMarital(data);
  patient.occupation=registrationOccupation(data);patient.disabilities=registrationDisabilities(data);
  patient.identifications=[];
  const link=database.sqlite.prepare('SELECT * FROM npca_patient_links WHERE patient_key=?').get(row.patient_key);
  for(const card of parse(link?.cards,[]))patient.identifications.push({card_code:String(card.card_number??card.card_code??''),card_type:card.card_type??card.type});
  const preview=pmrs2Preview({patientKey:row.patient_key,healthId:row.health_id,caseNumber:row.case_number,fullName:row.full_name,serviceMode:row.service_mode,entryDate:row.entry_date,departmentCode:row.department_code,departmentNameKh:row.department_name_kh,departmentNameEn:row.department_name_en,data});
  const discharge=parse(data['system:discharge']),opdDischarge=parse(data['system:opdDischarge']);
  const initialEditor=database.sqlite.prepare("SELECT * FROM patient_editor_history WHERE patient_key=? AND scope='medical' ORDER BY saved_at LIMIT 1").get(row.patient_key);
  const mode=row.service_mode, start=initialEditor?.saved_at||signatures.medical.signedAt;
  const completed=mode==='ipd'?data['system:admissionStatus']==='discharged':data['system:workflowStage']==='OPD_DISCHARGED';
  const registeredAt=reg('web_date')&&reg('web_time')?reg('web_date')+'T'+reg('web_time'):null;
  const s={patient,link,createdAt:row.created_at,updatedAt:row.updated_at,visitType:mode,admissionType:reg('web_entry_type'),admittedAt:discharge.admissionAt||registeredAt,
    dischargedAt:mode==='ipd'?discharge.dischargeAt:opdDischarge.dispensedAt,completed,
    dischargeType:mode==='ipd'?({ordered:'Authorized','against-advice':'Unauthorized',absconded:'Absconded',referred:'Refer Out',died:'Deceased'}[discharge.status]||discharge.status):'Authorized',
    // Pharmacy receipt proves completion, not clinical improvement. OPD outcome
    // must be explicitly recorded in the clinical record before claiming.
    outcome:mode==='ipd'?({recovered:'Recovered',improved:'Improved',unchanged:'Unchanged',died:'Deceased'}[discharge.outcome]||discharge.outcome):field('npca_outcome'),
    followupAt:discharge.followUpDate||field('web_opd_followup'),outpatients:[],inpatients:[],emergencies:[],surgeries:[],progress_notes:[],triages:[],dailyVitals:[],medical_histories:[],physical_examinations:[],laboratories:[],imageries:[],diagnoses:[],soaps:[],prescriptions:[],consultations:[],invoices:[],forms:[],sourceIssues:[]};
  const provider=initialEditor?.editor_name||signatures.medical.signerName||signatures.medical.displayName||'', title=initialEditor?.editor_role||signatures.medical.role||'';
  const encounter={id:'initial-'+mode,is_new:data['system:caseType']==='new',name:row.department_name_kh||row.department_name_en,service_type:preview.serviceType,started_at:start,ended_at:s.dischargedAt,encountered_by:provider,title,symptoms:[preview.chiefComplaint].filter(Boolean)};
  if(mode==='opd')s.outpatients.push(encounter);else if(mode==='ipd')s.inpatients.push(encounter);
  if(row.department_code==='emergency'){
    s.emergencies.push({...encounter,id:'emergency',emergency_notes:field('emergency_notes')});
  }
  // Retain a previous OPD consultation in an OPD-to-IPD visit using its saved
  // prescription snapshot/signature; never turn today's ward fields into it.
  const opd=database.sqlite.prepare('SELECT * FROM pharmacy_prescriptions WHERE patient_key=? ORDER BY submitted_at LIMIT 1').get(row.patient_key);
  if(mode==='ipd'&&opd){const snap=parse(opd.snapshot_json);s.outpatients.push({id:'before-admission',is_new:true,name:snap.patient?.departmentNameKh||'OPD',service_type:'OPD',started_at:opd.submitted_at,ended_at:opd.submitted_at,encountered_by:snap.prescriber?.signerName,title:snap.prescriber?.role});}
  const t=signatures.triage;
  s.triages.push({id:'initial',chief_complaint:preview.chiefComplaint,height:tri('p2_height'),weight:tri('p2_weight'),recorded_at:t.signedAt,recorded_by:t.signerName||t.displayName,title:t.role,
    observations:vitals(Object.fromEntries(['temp','pulse','resp','bp_sys','bp_dia','spo2','glucose'].map(k=>[k,tri('p2_'+k)])))});
  const clinicalTime=start||s.admittedAt;
  const diag=(type,code,name,encounterId=encounter.id)=>{if(code||name)s.diagnoses.push({encounterId,diagnosis_type_name:type,diagnosis_code:code,diagnosis_name:name,diagnosed_at:clinicalTime,diagnosed_by:provider,title});};
  diag('In',mode==='ipd'?preview.discharge?.admissionIcd10:preview.diagnosisIcd10,mode==='ipd'?preview.discharge?.admissionDiagnosis:preview.diagnosisText);
  if(completed)diag('Out',mode==='ipd'?preview.discharge?.dischargeIcd10:preview.diagnosisIcd10,mode==='ipd'?preview.discharge?.dischargeDiagnosis:preview.diagnosisText);
  const historyFields={'History of Present Illness':mode==='ipd'?'ipd_history_present_illness':'opd_history_present_illness','Past Medical History':'ipd_past_medical_history','Past Surgical History':'ipd_past_surgical_history','Current Medication':'ipd_current_medications','Allergies':'ipd_allergy_history','Family History':'ipd_family_history','Social History':'ipd_social_history','Obstetric & Gynecologic History':'ipd_obgyn_history','Immunization History':'ipd_immunization_history'};
  for(const [name,id]of Object.entries(historyFields)){const value=field(id);if(value)s.medical_histories.push({encounterId:encounter.id,name,value:[value]});}
  const allergies=activeAllergies(database,row).map(a=>[a.substance,a.reaction,a.severity].filter(Boolean).join('; '));
  if(allergies.length){const history=s.medical_histories.find(h=>h.name==='Allergies');if(history)history.value.push(...allergies);else s.medical_histories.push({encounterId:encounter.id,name:'Allergies',value:allergies});}
  const exam=summarizeClinicalExamination(data);
  const groups={'gen':'General Appearance','orl':'ENT(ORL)','cvs':'Cardiovascular System','resp':'Respiratory System','abd':'Gastro-Intestinal System','neuro':'Central Nervouse System','skin':'Skin & Extremities','uro':'Urogenital System','mental':'Mental Status','gcs':'Glasgow Coma Scale','other':'Other body parts'};
  for(const [prefix,name]of Object.entries(groups)){const values=Object.entries(data).filter(([k,v])=>k.startsWith('scope:medical:id:ipd_exam_'+prefix+'_')&&typeof v==='string'&&v.trim()).map(([,v])=>v);if(values.length)s.physical_examinations.push({encounterId:encounter.id,name,value:values,value_type:'array',value_unit:null});}
  if(mode==='opd')s.soaps.push({id:'initial',encounterId:encounter.id,subjective:field('opd_history_present_illness')||preview.chiefComplaint,objective:exam.join('\n'),assessment:preview.diagnosisText,plan:preview.prescription?.counselling||field('web_rx_counsel_note'),recorded_at:clinicalTime,recorded_by:provider,title});
  const rx=(id,meds,home,encounterId,time,who=provider,role=title)=>{const prescribed=meds.filter(m=>m&&(m.name||m.cmsCode));if(prescribed.length)s.prescriptions.push({id,medications:prescribed.map(medication),home,encounterId,prescribed_at:time,prescribed_by:who,title:role});};
  if(mode==='opd')rx('opd',list(data['system:opdMedications']),true,null,clinicalTime);
  else {
    rx('admission',list(data['system:initialIpdMedications']),false,encounter.id,clinicalTime);
    for(const [index,d]of list(data['system:dailyMonitoringRecords']).filter(d=>d&&typeof d==='object').entries()){
      const id=String(d.id||d.dtVal||index),sign=parse(d.npcaSignature||d.signature||d.signedBy);
      const who=sign.signerName||d.doctorName||'',role=sign.role||'';
      s.progress_notes.push({id,encounterId:encounter.id,started_at:d.dtVal,ended_at:d.dtVal,encountered_by:who,title:role});
      s.dailyVitals.push({encounterId:id,recorded_at:d.dtVal,recorded_by:who,title:role,observations:vitals(d)});
      s.soaps.push({id,encounterId:id,subjective:d.soap?.s,objective:d.soap?.o,assessment:d.soap?.a,plan:d.soap?.p,evaluation:d.evol,recorded_at:d.dtVal,recorded_by:who,title:role});
      rx(id,Array.isArray(d.medications)?d.medications:[],false,id,d.dtVal,who,role);
    }
    rx('home',Array.isArray(discharge.medications)?discharge.medications:[],true,null,discharge.dischargeAt,signatures.discharge.signerName,signatures.discharge.role);
  }
  if(field('web_rx_counsel_note'))s.consultations.push(field('web_rx_counsel_note'));
  for(const invoice of database.sqlite.prepare('SELECT * FROM finance_invoices WHERE patient_key=? ORDER BY created_at').all(row.patient_key)){
    const charges=database.sqlite.prepare('SELECT c.*,u.display_name provider FROM finance_charges c LEFT JOIN users u ON u.id=c.created_by WHERE invoice_id=? AND voided_at IS NULL').all(invoice.id);
    const payment=database.sqlite.prepare('SELECT p.*,u.display_name cashier_name FROM finance_payments p LEFT JOIN users u ON u.id=p.received_by WHERE invoice_id=? AND voided_at IS NULL ORDER BY received_at DESC LIMIT 1').get(invoice.id);
    const bill=patientBill(database,row.patient_key,invoice.id,{skipAttachments:true});
    const cashier=payment?.cashier_name||(invoice.coverage_by?database.sqlite.prepare('SELECT display_name FROM users WHERE id=?').get(invoice.coverage_by)?.display_name:null);
    if(bill.summary.KHR.discount||bill.summary.KHR.waived)s.sourceIssues.push({field:'invoices.discount',screen:'billing',code:'discount-allocation-confirmation'});
    if(charges.some(c=>c.currency!=='KHR'))s.sourceIssues.push({field:'invoices.currency',screen:'billing',code:'currency-confirmation'});
    const isMedicine=c=>/medicine|pharmacy/i.test(c.category);
    s.invoices.push({id:invoice.id,paymentType:link?.payment_type||invoice.payment_type,date:invoice.created_at,total:bill.summary.KHR.patientDue+bill.summary.KHR.payerDue,cashier,
      services:charges.filter(c=>!isMedicine(c)).map(c=>({localCode:c.service_code,service_name:c.description,service_category:c.category,quantity:c.quantity,price:c.unit_amount_minor,paid:Boolean(payment||invoice.coverage_at)})),
      medications:charges.filter(isMedicine).map(c=>({medicine_code:medicineCatalogue().items.find(m=>m.code===c.service_code)?.code,medicine_name:c.description,quantity:c.quantity,price:c.unit_amount_minor,paid:Boolean(payment||invoice.coverage_at)}))});
  }
  for(const order of database.sqlite.prepare('SELECT o.*,u.display_name requester,v.display_name verifier FROM paraclinic_orders o LEFT JOIN users u ON u.id=o.requested_by LEFT JOIN users v ON v.id=o.validated_by WHERE patient_key=? AND released_at IS NOT NULL AND cancelled_at IS NULL').all(row.patient_key)){
    const result=parse(order.result_json),common={released:true,encounterId:encounter.id,request_code:order.id,requested_at:order.created_at,requested_by:order.requester,title:order.requested_role};
    if(order.modality==='LAB')s.laboratories.push({...common,results:(result.items||[]).map(item=>({name:item.name||item.code,category:item.category,value:item.value,value_type:typeof item.value==='number'?'number':'string',value_unit:item.unit,reference_range:item.referenceRange||item.reference_range,interpretation:item.interpretation,verified_at:order.released_at,verified_by:order.verifier,recorded_at:order.updated_at,recorded_by:order.verifier}))});
    else s.imageries.push({...common,results:[{name:order.modality,category:order.modality,images:[],result:result.report?.findings||result.findings,conclusion:result.report?.conclusion||result.conclusion,verified_at:order.released_at,verified_by:order.verifier,recorded_at:order.updated_at,recorded_by:order.verifier}]});
  }
  const pregnancy=row.department_code==='anc'?findPregnancy(database,row):null;
  if(pregnancy){const visits=listVisits(database,pregnancy.id).filter(v=>v.patientKey===row.patient_key),visit=visits.at(-1);if(visit){s.forms.push({encounterId:encounter.id,form_code:'ENTY-000H014',form_data:{pregnancy_number_of_pregnancies:num(pregnancy.record.identity?.gravida),pregnancy_age:visit.gaWeeks,uterine_height_cm:num(visit.uh),fetal_heart_rate:num(visit.fhr),pregnancy_last_menstrual_period_date:pregnancy.record.lmp}});
    if(visit.referred&&visit.referral?.signed){s.completed=true;s.dischargeType='Refer Out';s.dischargedAt=visit.referral.signed.signedAt;
      s.referral={referred_to:{reason:[...(visit.referral.reasons||[]),visit.referral.note].filter(Boolean).join('; '),referred_by:visit.referral.signed.signerName,referred_at:visit.referral.signed.signedAt,medications:visit.referral.treatment}};
      encounter.ended_at=s.dischargedAt;
      if(!completed&&preview.diagnosisIcd10&&preview.diagnosisText){diag('Out',preview.diagnosisIcd10,preview.diagnosisText);Object.assign(s.diagnoses.at(-1),{diagnosed_at:s.dischargedAt,diagnosed_by:visit.referral.signed.signerName,title:visit.referral.signed.role});}
    }
  }}
  if(row.department_code==='anc'&&!s.forms.some(f=>f.form_code==='ENTY-000H014'))s.sourceIssues.push({field:'forms.anc',screen:'anc',code:'anc-visit-required'});
  // Other structured forms keep their exact official property names. Values
  // not captured structurally are explicit validation gaps, not defaults.
  const serviceForm={'pnc':'ENTY-000001B2','family-planning':'ENTY-000016Z','safe-abortion':'ENTY-0000K1B','delivery':'ENTY-0000K15','newborn':'ENTY-00000A8C','child':'ENTY-00000A9M'}[row.department_code];
  if(serviceForm){const def=formDefinitions.get(serviceForm),values={};for(const f of def.fields)values[f.name]=field(f.name);s.forms.push({encounterId:encounter.id,form_code:serviceForm,form_data:values});}
  const ageDays=patient.birthdate&&row.entry_date?(Date.parse(row.entry_date)-Date.parse(patient.birthdate))/86400000:null;
  if(row.department_code==='pediatric'&&ageDays!=null&&ageDays>=0&&ageDays<=5*366){const form_code=ageDays<=28?'ENTY-00000A8C':'ENTY-00000A9M';s.forms.push({encounterId:encounter.id,form_code,form_data:{}});}
  const newborn=database.sqlite.prepare("SELECT * FROM perioperative_forms WHERE patient_key=? AND form_type='newbornRecord' ORDER BY form_date DESC LIMIT 1").get(row.patient_key);
  if(newborn&&!s.forms.some(f=>f.form_code==='ENTY-0000K15'))s.forms.push({encounterId:encounter.id,form_code:'ENTY-0000K15',form_data:{}});
  for(const definition of formDefinitions.values()){
    const values={};for(const f of definition.fields){const raw=field('npca_form_'+definition.code+'_'+f.name);if(nonempty(raw))values[f.name]=f.type.startsWith('array')?parse(raw,[]):raw;}
    if(Object.keys(values).length){const existing=s.forms.find(f=>f.form_code===definition.code);if(existing)Object.assign(existing.form_data,values);else if(definition.code!=='ENTY-000H014')s.forms.push({encounterId:encounter.id,form_code:definition.code,form_data:values});}
  }
  for(const record of database.sqlite.prepare("SELECT * FROM perioperative_forms WHERE patient_key=? AND form_type='operativeNote' ORDER BY form_date,created_at").all(row.patient_key)){
    const value=parse(record.data_json),anaesthesia=database.sqlite.prepare("SELECT data_json FROM perioperative_forms WHERE patient_key=? AND form_date=? AND form_type='anaesthesiaRecord'").get(row.patient_key,record.form_date),a=parse(anaesthesia?.data_json);
    s.surgeries.push({id:record.id,encounterId:encounter.id,is_new:true,theater_name:value.theaterName,service_type:value.procedureName,started_at:value.startTime?record.form_date+'T'+value.startTime:null,ended_at:value.endTime?record.form_date+'T'+value.endTime:null,
      reason:value.reason,anesthesia_type:a.anaesthesiaType,procedure_notes:value.procedureDetails,complications:value.complications?[value.complications]:[],specimens:value.specimens?[value.specimens]:[],pre_operative_diagnosis:value.preopDiagnosis,post_operative_diagnosis:value.postopDiagnosis,blood_loss:value.bloodLoss?String(value.bloodLoss):undefined,
      surgeon_name:value.surgeon,anesthetist_name:value.anaesthetist,assistant_names:value.assistant?[value.assistant]:[],type_of_surgery:value.surgeryType,anesthetist_assistant_name:a.assistant?[a.assistant]:[],surgical_technique:value.surgicalTechnique,surgical_approach:value.surgicalApproach});
  }
  if(discharge.status==='referred')s.referral={referred_to:{referral_number:discharge.referralNumber,transportation:discharge.referralTransport,reason:discharge.referralReason,
    health_facility:{name:discharge.referralDestinationName,code:discharge.referralDestinationCode,label:discharge.referralDestinationType,type:discharge.referralFacilityType},
    referred_by:signatures.discharge.signerName,referred_by_phone:discharge.referringPhone,referred_at:discharge.dischargeAt,document_file:discharge.referralDocumentUrl,medications:discharge.referralMedications}};
  if(s.referral?.referred_to){const r=s.referral.referred_to;
    for(const [key,fieldName]of [['referral_number','number'],['transportation','transport'],['referred_by_phone','phone'],['document_file','document_url']])r[key]||=field('npca_referral_'+fieldName);
    r.health_facility||={};for(const key of ['name','code','type'])r.health_facility[key]||=field('npca_referral_facility_'+key);
  }
  // An explicit NPCA outcome is an additive clinical field; no change to
  // existing discharge, stock, tariff, or payment calculations.
  return s;
}
