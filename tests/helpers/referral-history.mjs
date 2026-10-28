import crypto from 'node:crypto';
export function seedReferralHistory(app,patient,userId){
 const historyKey='case:HIST-IPD-001';
 const data={'scope:medical:id:ipd_history_present_illness':'Historical illness sentinel <script>parent.referralXss=1</script>','scope:nursing:auto:10':'Historical nursing sentinel','system:nursingReviewFixture':[{date:'2026-09-02',note:'Structured nursing sentinel'}],'system:admissionStatus':'discharged','system:discharge':{dischargeAt:'2026-09-03T08:00:00Z'}};
 app.database.upsertPatient({id:crypto.randomUUID(),patientKey:historyKey,summary:{...patient.summary,caseNumber:'HIST-IPD-001',serviceMode:'ipd',departmentCode:'surgery',entryDate:'2026-09-01',dischargeDate:'2026-09-03'},data,userId,savedAt:Date.now()-86400000});
 app.database.upsertPatient({id:crypto.randomUUID(),patientKey:'case:UNRELATED-001',summary:{...patient.summary,caseNumber:'UNRELATED-001',healthId:'UNRELATED-ID',fullName:'Unrelated patient sentinel',serviceMode:'ipd',departmentCode:'surgery',entryDate:'2026-09-02'},data:{'scope:medical:id:ipd_history_present_illness':'Private unrelated sentinel'},userId,savedAt:Date.now()});
 app.database.upsertPatient({id:crypto.randomUUID(),patientKey:'case:LATER-VISIT-001',summary:{...patient.summary,caseNumber:'LATER-VISIT-001',serviceMode:'ipd',departmentCode:'surgery',entryDate:'2026-12-01'},data:{},userId,savedAt:Date.now()});
 return historyKey;
}
