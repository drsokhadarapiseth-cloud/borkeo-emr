import assert from 'node:assert/strict';
import test from 'node:test';
import { medicineReportWards, wardMedicineReport } from '../server/ward-medicines.mjs';

test('a ward request shows only the latest saved orders for the chosen day and ward', () => {
  const date = value => new Date(value).getTime();
  const patientKey = 'case:ward-medicine-example';
  const events = [
    { patient_key:patientKey,event_type:'ADMISSION',to_ward_code:'medicine',event_at:date('2026-09-17T00:00:00') },
    { patient_key:patientKey,event_type:'BED_ASSIGN',to_ward_code:'medicine',details_json:JSON.stringify({bedLabel:'M-3'}),event_at:date('2026-09-17T01:00:00') },
    { patient_key:patientKey,event_type:'INTERNAL_TRANSFER',to_ward_code:'surgery',event_at:date('2026-09-18T09:00:00') },
    { patient_key:patientKey,event_type:'BED_ASSIGN',to_ward_code:'surgery',details_json:JSON.stringify({bedLabel:'S-2'}),event_at:date('2026-09-18T09:30:00') },
    { patient_key:patientKey,event_type:'DISCHARGE',event_at:date('2026-09-20T10:00:00') },
  ];
  const row = {
    patient_key:patientKey,case_number:'WARD-1',full_name:'Example patient',entry_date:'2026-09-17',service_mode:'ipd',
    record_json:JSON.stringify({
      'scope:medical:id:emr_pmrs_ipd_diagnosis':'Admission diagnosis',
      'scope:medical:id:emr_pmrs_ipd_icd10':'j02 - Acute pharyngitis',
      'system:initialIpdMedications':JSON.stringify([{name:'Admission drug',m:'1',a:'0',e:'1',n:'0'}]),
      'system:dailyMonitoringRecords':JSON.stringify([
        {dtVal:'2026-09-17T08:00',conclusion:'First conclusion',medications:[{name:'Morning drug'}]},
        {dtVal:'2026-09-17T18:00',conclusion:'Latest conclusion',medications:[{name:'Evening drug',m:'2'}]},
        {dtVal:'2026-09-19T08:00',conclusion:'Another conclusion',medications:[{name:'New drug',m:'1'}]},
      ]),
    }),
  };
  const database = {
    sqlite:{prepare:()=>({all:(end)=>events.filter(event=>event.event_at<end)})},
    findPatient:key=>key===patientKey?row:null,
  };
  const dayOne = wardMedicineReport(database,'2026-09-17','medicine');
  assert.equal(dayOne.patientCount,1);
  assert.equal(dayOne.patients[0].bedLabel,'M-3');
  assert.equal(dayOne.patients[0].diagnosis,'J02');
  assert.equal(dayOne.matrix.rows[0].diagnosis,'J02');
  assert.deepEqual(dayOne.patients[0].medications.map(item=>item.name),['Evening drug']);
  assert.equal(wardMedicineReport(database,'2026-09-18','medicine').patientCount,0);
  const dayTwo = wardMedicineReport(database,'2026-09-18','surgery');
  assert.equal(dayTwo.patients[0].diagnosis,'J02');
  assert.equal(dayTwo.patientCount,1);
  assert.equal(dayTwo.patients[0].bedLabel,'S-2');
  assert.equal(dayTwo.patients[0].medications.length,0);
  assert.deepEqual(wardMedicineReport(database,'2026-09-19','surgery').patients[0].medications.map(item=>item.name),['New drug']);
  assert.equal(wardMedicineReport(database,'2026-09-20','surgery').patientCount,0);

  const originalData=JSON.parse(row.record_json);
  row.record_json=JSON.stringify({...originalData,'scope:medical:id:emr_pmrs_ipd_icd10':'Headache'});
  assert.equal(wardMedicineReport(database,'2026-09-17','medicine').patients[0].diagnosis,'');
  const legacyData={...originalData,'id:emr_pmrs_ipd_icd10':'i10'};
  delete legacyData['scope:medical:id:emr_pmrs_ipd_icd10'];
  row.record_json=JSON.stringify(legacyData);
  assert.equal(wardMedicineReport(database,'2026-09-17','medicine').patients[0].diagnosis,'I10');
  row.record_json=JSON.stringify({...legacyData,'scope:medical:id:emr_pmrs_ipd_icd10':''});
  assert.equal(wardMedicineReport(database,'2026-09-17','medicine').patients[0].diagnosis,'');

  row.record_json = JSON.stringify({ 'system:initialIpdMedications':JSON.stringify([{name:'Admission drug'}]) });
  assert.deepEqual(wardMedicineReport(database,'2026-09-17','medicine').patients[0].medications.map(item=>item.name),['Admission drug']);
  assert.equal(wardMedicineReport(database,'2026-09-19','surgery').patients[0].medications.length,0);
  row.record_json = JSON.stringify({
    'scope:medical:id:ipd_first_exam_date':'2026-09-19',
    'system:initialIpdMedications':JSON.stringify([{name:'Doctor ordered drug',total:'3',unit:'ampoule'}]),
  });
  assert.equal(wardMedicineReport(database,'2026-09-17','medicine').patients[0].medications.length,0);
  const examinationDay=wardMedicineReport(database,'2026-09-19','surgery');
  assert.equal(examinationDay.patients[0].medications[0].name,'Doctor ordered drug');
  assert.equal(examinationDay.matrix.columns[0].name,'Doctor ordered drug');
  assert.equal(examinationDay.matrix.totals[0].quantity,3);
  assert.throws(()=>wardMedicineReport(database,'2026-02-30','medicine'),/valid report date/);
  assert.throws(()=>wardMedicineReport(database,'2026-09-17','opd'),/inpatient ward/);
  assert.deepEqual(medicineReportWards('DOCTOR','surgery').map(item=>item.code),['surgery']);
  assert.equal(medicineReportWards('PHARMACY','').some(item=>item.code==='surgery'),true);
});
