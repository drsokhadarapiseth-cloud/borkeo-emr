import crypto from 'node:crypto';
export function seedReferralHistory(app,patient,userId){
 const treatment=JSON.stringify([{rowType:'regularRow',name:'AA0050-Amoxicillin + clavulanic acid 500 mg + 125 mg',route:'po',unit:'tablet',m:'0',a:'0',e:'1',n:'0',d:'1',total:'12',note:'Synthetic treatment note'}]);
 const historyKey='case:HIST-IPD-001';
 const data={'system:initialIpdMedications':treatment,'scope:medical:id:ipd_history_present_illness':'Historical illness sentinel <script>parent.referralXss=1</script>','scope:medical:id:ipd_past_pregnancy':'yes','scope:medical:id:ipd_current_pregnancy':'unknown','scope:medical:id:ipd_pregnancy_history_notes':'Historical pregnancy sentinel','scope:medical:id:ipd_soap_summary':'S:\nReviewed SOAP sentinel <script>parent.referralXss=1</script>','scope:medical:id:ipd_soap_manual':'true','scope:nursing:auto:10':'Historical nursing sentinel','system:nursingReviewFixture':[{date:'2026-09-02',note:'Structured nursing sentinel'}],'system:admissionStatus':'discharged','system:discharge':{dischargeAt:'2026-09-03T08:00:00Z'}};
 app.database.upsertPatient({id:crypto.randomUUID(),patientKey:historyKey,summary:{...patient.summary,caseNumber:'HIST-IPD-001',serviceMode:'ipd',departmentCode:'surgery',entryDate:'2026-09-01',dischargeDate:'2026-09-03'},data,userId,savedAt:Date.now()-86400000});
 app.database.upsertPatient({id:crypto.randomUUID(),patientKey:'case:UNRELATED-001',summary:{...patient.summary,caseNumber:'UNRELATED-001',healthId:'UNRELATED-ID',fullName:'Unrelated patient sentinel',serviceMode:'ipd',departmentCode:'surgery',entryDate:'2026-09-02'},data:{'scope:medical:id:ipd_history_present_illness':'Private unrelated sentinel'},userId,savedAt:Date.now()});
 app.database.upsertPatient({id:crypto.randomUUID(),patientKey:'case:LATER-VISIT-001',summary:{...patient.summary,caseNumber:'LATER-VISIT-001',serviceMode:'ipd',departmentCode:'surgery',entryDate:'2026-12-01'},data:{},userId,savedAt:Date.now()});
 return historyKey;
}
