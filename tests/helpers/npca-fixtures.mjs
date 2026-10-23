export function syntheticVisit(mode = 'opd') {
  const date='2026-10-23',time=t=>date+'T'+t;
  const encounterId='initial-'+mode;
  const s={patient:{patientKey:'case:NPCA-SYNTHETIC-'+mode,healthId:'NPCA-SYNTHETIC-ONLY',surname:'Synthetic',name:'Patient',sex:'F',birthdate:'1990-01-01',phone:'012345678',nationality:'KHM',maritalStatus:'Married',
    address:{province:{code:'16',name:'Synthetic province'},district:{code:'1603',name:'Synthetic district'},commune:{code:'160301',name:'Synthetic commune'},village:{code:'16030104',name:'Synthetic village'}}},
    link:{spid:'MOCK-SPID',eligible:1},createdAt:time('08:00'),updatedAt:time('10:00'),visitType:mode,admissionType:'Walk-in',admittedAt:time('08:00'),dischargedAt:time('10:00'),completed:true,dischargeType:'Authorized',outcome:'Improved',
    outpatients:[],inpatients:[],emergencies:[],surgeries:[],progress_notes:[],triages:[{id:'initial',chief_complaint:'Synthetic complaint',height:160,weight:55,recorded_at:time('08:10'),recorded_by:'Synthetic triage',title:'TRIAGE',observations:[['Temperature',37],['Heart Rate',80],['Respiratory Rate',18],['Systolic Blood Pressure',120],['Diastolic Blood Pressure',80],['Blood Oxygen',98]].map(([name,value])=>({name,value}))}],dailyVitals:[],medical_histories:[],physical_examinations:[],laboratories:[],imageries:[],forms:[],
    diagnoses:['In','Out'].map(diagnosis_type_name=>({encounterId,diagnosis_type_name,diagnosis_code:'A09',diagnosis_name:'Synthetic diagnosis',diagnosed_at:time('08:30'),diagnosed_by:'Synthetic clinician',title:'DOCTOR'})),
    soaps:mode==='opd'?[{id:'initial',encounterId,subjective:'Synthetic subjective',objective:'Synthetic objective',assessment:'Synthetic assessment',plan:'Synthetic plan',recorded_at:time('08:30'),recorded_by:'Synthetic clinician',title:'DOCTOR'}]:[],
    prescriptions:[{id:'rx',home:mode==='opd',encounterId,prescribed_at:time('08:30'),prescribed_by:'Synthetic clinician',title:'DOCTOR',medications:[{cmsCode:'AA0410',medicine_name:'Synthetic medicine',strength:'500 mg',method:'po',unit:'tablet',morning:1,afternoon:0,evening:1,night:0,days:3,dispense:{quantity:6,unit:'tablet'}}]}],consultations:[],
    invoices:[{id:'invoice',paymentType:'HEF_POOR',date:time('10:00'),total:1000,cashier:'Synthetic cashier',services:[{localCode:'SYNTHETIC_SERVICE',service_name:'Synthetic service',service_category:'Synthetic category',quantity:1,price:1000}],medications:[]}],sourceIssues:[]};
  s[mode==='opd'?'outpatients':'inpatients'].push({id:encounterId,is_new:true,name:'Synthetic ward',service_type:mode.toUpperCase(),started_at:time('08:30'),ended_at:time('10:00'),encountered_by:'Synthetic clinician',title:'DOCTOR'});
  return s;
}
export const syntheticValidation={eligible:true,diagnosisExists:code=>code==='A09',medicineExists:code=>code==='AA0410',addressValid:address=>address?.village?.code==='16030104'};
