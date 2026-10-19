import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { ensureFinanceSchema, serviceCatalog, SERVICE_CATEGORIES } from '../server/finance.mjs';

test('v14.6 installs the workbook fee schedule and confirmed eye-care fees once',()=>{
  const database=openDatabase(':memory:');
  ensureAccessSchema(database);
  ensureFinanceSchema(database);
  const fees=new Map(serviceCatalog(database,{includeInactive:true}).map(item=>[item.code,item]));
  const expected={
    OPD_REFERRAL:3000,OPD_CONSULT:5000,IPD_CHILD_UNDER_7_DAYS:80000,IPD_OVER_7_DAYS_DAILY:5000,IPD_OVER_7_DAYS_DAILY_REFERRAL:4500,
    GO_NORMAL_DELIVERY_OR_WOMENS_DISEASE:80000,GO_INTERVENTION_DELIVERY:100000,GO_IUD:60000,
    GO_TUBAL_LIGATION:300000,GO_SUBDERMAL_IMPLANT:60000,GO_REFERRAL_OR_DELIVERY_LETTER:20000,
    GO_CERVIX_EXAM:20000,GO_STI_EXAM:20000,GO_VACUUM_ABORTION:120000,GO_MEDICAL_ABORTION:100000,
    GO_GENITAL_WART_TREATMENT:40000,GO_SUSPICIOUS_CELLS_TREATMENT:60000,GO_CERVICAL_CANCER_SCREEN:40000,
    REA_24_HOUR_EMERGENCY:120000,XRAY_SINGLE_PLATE:20000,ULTRASOUND:15000,ECG:0,
    MAJOR_SURGERY:600000,MEDIUM_SURGERY:400000,PHYSICAL_EXAMINATION:40000,MINOR_SURGERY_OUTPATIENT:50000,
    WOUND_CLEANING_OUTPATIENT:10000,MINOR_SURGERY_INPATIENT:120000,SPLINT_OUTPATIENT:60000,
    SPLINT_TRACTION:120000,GASTRIC_LAVAGE_INPATIENT:120000,MALARIA:0,CBC:8000,STOOL_TEST:5000,
    GLUCOSE:5000,TRIGLYCERIDE:8000,URINE_TEST:5000,TYPHOID_TEST:5000,VIRAL_MARKERS:20000,
    CHOLESTEROL:8000,URIC_ACID:8000,DENGUE_NS1:30000,HBA1C:30000,UREA:8000,CREAT:8000,
    AST:8000,ALT:8000,IONOGRAM:20000,CA:10000,TP:15000,INR:15000,BILIRUBIN_DIRECT:15000,
    BILIRUBIN_INDIRECT:15000,CRP:20000,DENTAL_EXAM:5000,DENTAL_NORMAL_EXTRACTION:10000,
    DENTAL_COMPLEX_EXTRACTION:20000,DENTAL_ROOT_EXTRACTION_FILL:50000,DENTAL_CLEANING:20000,
    DENTAL_SURGERY:40000,DENTAL_XRAY_OPD:20000,DENTAL_FILLING:20000,
    AMBULANCE_0_5KM:30000,AMBULANCE_6_15KM:60000,AMBULANCE_15_25KM:90000,
    AMBULANCE_25_50KM:120000,AMBULANCE_OVER_50KM:3000,AMBULANCE_VIETNAM:800000,
    EYE_CONSULT_EXAM_TREAT:10000,EYE_VISION_TEST:5000,EYE_FOREIGN_BODY_REMOVAL:25000,
    EYE_LACRIMAL_IRRIGATION:25000,EYE_PREMADE_GLASSES:40000,EYE_BASIC_GLASSES:60000,
    EYE_MEDIUM_GLASSES:100000,EYE_PREMIUM_GLASSES:140000,EYE_PROGRESSIVE_GLASSES:180000,
    EYE_MINOR_SURGERY:50000,
  };
  for(const [code,amount] of Object.entries(expected)){
    assert.ok(fees.has(code),`${code} missing`);
    assert.equal(fees.get(code).currency,'KHR',code);
    assert.equal(fees.get(code).defaultAmount,amount,code);
  }
  assert.equal(SERVICE_CATEGORIES.find(item=>item.code==='EYE_CARE')?.labelEn,'Eyes Care Facility');
  assert.equal(serviceCatalog(database).filter(item=>item.categoryCode==='EYE_CARE').length,10);
  assert.equal(fees.get('AMBULANCE_OVER_50KM').unitLabel,'km after 50');
  assert.equal(fees.get('MALARIA').defaultAmount,0,'the workbook marks malaria testing as free');
  assert.ok(fees.has('CT_SCAN'),'CT_SCAN service is configured');
  assert.equal(fees.get('GO_GENITAL_WART_TREATMENT').nameKh,'ព្យាបាលសិរមាន់');
  if(fees.has('GO_SYPHILIS_TREATMENT'))assert.equal(fees.get('GO_SYPHILIS_TREATMENT').active,false,'the incorrect old label stays in history but cannot be selected');
  database.sqlite.prepare("UPDATE finance_service_catalog SET default_amount_minor=7777 WHERE code='OPD_CONSULT'").run();
  ensureFinanceSchema(database);
  assert.equal(serviceCatalog(database).find(item=>item.code==='OPD_CONSULT').defaultAmount,7777,'Admin edits remain after the one-time import');
  database.close();
});
