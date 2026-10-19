import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';
import {createEmrServer} from '../server/server.mjs';
import {submitOpdPrescription,ensureOpdReceiptDischarges} from '../server/pharmacy-prescriptions.mjs';

test('existing pharmacy receipts restore the original local discharge date once, without discharging an IPD transfer',()=>{
  const app=createEmrServer({demoMode:true,databasePath:':memory:',autoDatabase:false,nodeEnv:'test'});
  const db=app.database,doctor=db.findUser('doctor_opd').id,pharmacy=db.findUser('pharmacy').id;
  try{
    const dispensedAt=Date.UTC(2026,8,30,20,15);
    for(const mode of ['opd','ipd']){
      const patientKey='case:RECEIPT177-'+mode;
      const summary={caseNumber:'RECEIPT177-'+mode,healthId:'',firstName:'Receipt',lastName:mode,fullName:'Receipt '+mode,sex:'ស្រី',age:'25',dateOfBirth:'',phone:'',equityCard:'',paymentType:'DIRECT',departmentCode:mode==='opd'?'opd':'medicine',departmentNameKh:'',departmentNameEn:mode,serviceMode:mode,entryDate:'2026-09-30',dischargeDate:''};
      db.upsertPatient({id:crypto.randomUUID(),patientKey,userId:doctor,savedAt:Date.now(),summary,data:{'system:workflowStage':mode==='opd'?'DOCTOR_READY':'WARD_ADMITTED','clinical-note':'Preserve this note'}});
      const rx=submitOpdPrescription(db,db.findPatient(patientKey),{patient:summary,medications:[{name:'Example medicine',total:'10'}],prescriber:{userId:doctor,role:'DOCTOR',signerName:'Doctor'}},{userId:doctor,role:'DOCTOR',wardCode:'opd'});
      db.sqlite.prepare('UPDATE pharmacy_prescriptions SET dispensed_at=?,dispensed_by=? WHERE id=?').run(dispensedAt,pharmacy,rx.id);
      const before=db.findPatient(patientKey);ensureOpdReceiptDischarges(db);const after=db.findPatient(patientKey),data=JSON.parse(after.record_json);
      assert.equal(data['clinical-note'],'Preserve this note');
      if(mode==='opd'){
        assert.equal(after.discharge_date,'2026-10-01','Cambodia local date comes from the receipt, not migration time');
        assert.equal(data['system:opdDischarge'].dispensedAt,dispensedAt);assert.equal(data['system:opdDischarge'].prescriptionId,rx.id);assert.equal(data['system:workflowStage'],'OPD_DISCHARGED');assert.equal(after.version,before.version+1);
      }else{
        assert.equal(after.discharge_date,'');assert.equal(data['system:opdDischarge'],undefined);assert.equal(after.record_json,before.record_json);assert.equal(after.version,before.version);
      }
      ensureOpdReceiptDischarges(db);assert.equal(db.findPatient(patientKey).version,after.version,'repeated restarts do not change the receipt or patient version');
    }
  }finally{db.close();}
});
