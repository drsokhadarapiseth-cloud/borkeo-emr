import {fail} from './playwright.mjs';
import {preparePmrsMedicineImport,applyPmrsMedicineImport,normalizePmrsId} from './medicine-import.mjs';
export function identityFor(patient) {
  const data=patient.data||{}, link=data['system:pmrsLink'];
  if(link?.patientId && link?.encounterId) return link;
  const issuer=data['scope:registration:id:web_other_card_issuer'];
  return {patientId:/^PMRS2?$/i.test(issuer||'')?data['scope:registration:id:web_other_card_number']:'',
    encounterId:data['scope:registration:id:web_pmrs2_case_number']||''};
}
export function assertIdentity(patient,identity) {
  const local=identityFor(patient);
  if(!local.patientId||!local.encounterId||normalizePmrsId(local.patientId)!==normalizePmrsId(identity.patientId)||local.encounterId!==identity.encounterId)fail('IDENTITY_MISMATCH');
}
export function clinicalPayload(preview) {
  const {triage,caseType,chiefComplaint,diagnosisText,diagnosisIcd10,ancillaryService,followUps,prescription,discharge}=preview;
  return {triage,caseType,chiefComplaint,diagnosisText,diagnosisIcd10,ancillaryService,followUps,prescription,discharge};
}
// Imports are explicit field updates, never replacement patient objects or admission/finance actions.
export function clinicalImport(patient,snapshot) {
  assertIdentity(patient,snapshot.identity);
  const clinical=snapshot.clinical||{}, data=structuredClone(patient.data||{}), changes=[];
  const add=(key,value)=>{
    if(value===undefined||value===null||value==='')return;
    if(typeof value!=='string'||value.length>12000)fail('INVALID_FIELD');
    const before=data[key]??'';if(before!==value){changes.push({field:key,before,after:value});data[key]=value;}
  };
  const allowed=new Set(['triage','chiefComplaint','diagnosisText','diagnosisIcd10','prescription','followUps']);
  if(Object.keys(clinical).some(key=>!allowed.has(key)))fail('IMPORT_FIELD_UNSUPPORTED');
  // Triage belongs to triage staff. Show it in source preview, but never bypass their scope.
  if(clinical.triage && Object.values(clinical.triage).some(v=>v!==''))fail('IMPORT_TRIAGE_REVIEW');
  if(clinical.chiefComplaint && clinical.chiefComplaint!==data['scope:triage:id:pmrs_chief_complaint'])fail('IMPORT_TRIAGE_REVIEW');
  const ipd=patient.serviceMode==='ipd';
  add(ipd?'scope:medical:id:emr_pmrs_ipd_diagnosis':'scope:medical:id:emr_pmrs_opd_diagnosis',clinical.diagnosisText);
  if(clinical.diagnosisIcd10) {
    if(!/^[A-Z]\d{2}(?:\.[0-9A-Z]{1,4})?$/.test(clinical.diagnosisIcd10))fail('ICD10_INVALID');
    add(ipd?'scope:medical:id:emr_pmrs_ipd_icd10':'scope:medical:id:diag_input',clinical.diagnosisIcd10);
  }
  let added=0,skipped=0;
  const medicines=(meds,target,at)=>{
    if(!Array.isArray(meds)||!meds.length)return;
    const prepared=preparePmrsMedicineImport({sourcePid:snapshot.identity.patientId,sourceVisit:snapshot.identity.encounterId,target,recordAt:at,
      medications:meds.map((m,index)=>({sourceRowIndex:index,name:m.name,route:m.route,unit:m.unit,m:m.morning,a:m.afternoon,e:m.evening,n:m.night,d:m.days}))});
    // Link is verified separately; the old hospital health ID is never overwritten.
    const result=applyPmrsMedicineImport(data,prepared,{...patient,healthId:snapshot.identity.patientId});
    Object.assign(data,result.data);added+=result.added;skipped+=result.skipped;
  };
  if(clinical.prescription) {
    if(ipd)fail('IMPORT_DISCHARGE_REVIEW');
    medicines(clinical.prescription.medications,'opd',clinical.prescription.sourceDateTime);
    add('scope:medical:id:web_rx_counsel_note',clinical.prescription.counselling);
    add('scope:medical:id:web_opd_followup',clinical.prescription.followUpDate);
  }
  for(const follow of clinical.followUps||[]) {
    if(!ipd)fail('SERVICE_MISMATCH');
    // Only import into the exact already-reviewed daily follow-up; never replace clinical notes.
    const records=JSON.parse(data['system:dailyMonitoringRecords']||'[]');
    if(records.filter(row=>row.dtVal===follow.dateTime).length!==1)fail('FOLLOW_UP_REQUIRED');
    if(Object.keys(follow).some(key=>!['dateTime','medications'].includes(key)))fail('IMPORT_FIELD_UNSUPPORTED');
    medicines(follow.medications,'daily',follow.dateTime);
  }
  return {data,changes,added,skipped,hasMedicines:!!(clinical.prescription?.medications?.length||clinical.followUps?.some(f=>f.medications?.length))};
}
