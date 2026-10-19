import crypto from 'node:crypto';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {openDatabase} from '../server/database.mjs';
import {ensureDemoAccounts} from '../server/demo-accounts.mjs';
import {ensureAccessSchema} from '../server/access.mjs';
import {ensureFinanceSchema} from '../server/finance.mjs';
import {buildRegistrationData} from './seed-demo-patients.mjs';
import {projectRoot} from '../server/config.mjs';
export function seedTwentyAssessedPatients(db,now=Date.now()){
 ensureAccessSchema(db);ensureFinanceSchema(db);ensureDemoAccounts(db,now);const actor=db.findUser('registration');
 const date=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(now));
 const names=['សុខ ពិសិដ្ឋ','ចាន់ ដារ៉ា','គឹម ស្រីពៅ','លី វណ្ណារិទ្ធ','មាស សុភ័ក្ត្រ','ហេង ស្រីលក្ខណ៍','ឈុន វុទ្ធី','ពេជ្រ ម្លិះ','ទូច ម៉ូនីកា','ខេម វិរៈ','លីម ស្រីនិច','រ័ត្ន រស្មី','ញ៉ាង សុគន្ធា','ហ៊ូ ចាន់ណា','ឈា ភក្តី','វង្ស ស្រីមុំ','ស៊ុន វិសាល','ម៉ៅ បុប្ផា','កែវ សុវណ្ណ','ពៅ រដ្ឋា'];
 let max=0;for(const row of db.sqlite.prepare('SELECT record_json FROM patient_records WHERE entry_date=?').all(date)){try{max=Math.max(max,Number(JSON.parse(row.record_json)['system:registrationQueueNumber']||0))}catch{}}
 let created=0;
 for(let i=0;i<20;i++){
  const caseNumber=`SIM194-${String(i+1).padStart(2,'0')}`,patientKey='case:'+caseNumber,healthId='SIM194-ID-'+String(i+1).padStart(2,'0');
  const existing=db.findPatient(patientKey);
  if(existing){
    if(existing.full_name!==names[i]){
      const [lastName,firstName]=names[i].split(' ');
      let rec={};try{rec=JSON.parse(existing.record_json||'{}')}catch{}
      rec['scope:registration:id:web_first_name']=firstName;
      rec['scope:registration:id:web_last_name']=lastName;
      db.sqlite.prepare('UPDATE patient_records SET first_name=?,last_name=?,full_name=?,record_json=? WHERE patient_key=?').run(firstName,lastName,names[i],JSON.stringify(rec),patientKey);
    }
    continue;
  }
  const profile={fullName:names[i],sex:i%2?'F':'M',age:20+i*2,phone:'010 900 '+String(100+i),father:'សុខ វ៉ាន់',mother:'ចាន់ ស្រី',commune:'បរកែវ',village:'ភូមិ១',marital:1,occupation:'កសិករ',otherId:0,disability:0,nssf:'',equity:'',entry:'មកដោយខ្លួនឯង',complaint:i%2?'ឈឺក្បាល':'ក្តៅខ្លួន និងក្អក'};
  const data=buildRegistrationData({profile,caseNumber,healthId,date,time:`09:${String(i).padStart(2,'0')}`,existingData:{},queueNumber:++max});
  Object.assign(data,{'system:demo194':true,'system:triageObservationsComplete':true,'system:triageAssessedAt':now+i,'system:triageStatus':'WAITING','system:workflowStage':'TRIAGE_ROUTING_PENDING','scope:triage:id:pmrs_chief_complaint':profile.complaint});
  const [lastName,firstName]=profile.fullName.split(' ');const summary={caseNumber,healthId,firstName,lastName,fullName:profile.fullName,sex:profile.sex==='M'?'ប្រុស':'ស្រី',age:String(profile.age),dateOfBirth:data['scope:registration:id:web_dob'],phone:profile.phone,equityCard:'',paymentType:'DIRECT',departmentCode:'',departmentNameKh:'',departmentNameEn:'',serviceMode:'',entryDate:date,dischargeDate:''};
  db.upsertPatient({id:crypto.randomUUID(),patientKey,summary,data,userId:actor.id,savedAt:now+i});
  db.sqlite.prepare("INSERT OR IGNORE INTO patient_finance_profiles (patient_key,payment_type,payment_subtype,hef_type,discount_percent,discount_amount_minor,discount_currency,payer_reference,note,updated_by,created_at,updated_at) VALUES (?,'DIRECT','FULL','',0,0,'KHR','','Simulated v19.4 registration/triage',?,?,?)").run(patientKey,actor.id,now+i,now+i);created++;
 }
 return {created,count:20};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const requested=path.resolve(process.argv[2]||path.join(projectRoot,'data/demo.sqlite'));
 if(requested!==path.join(projectRoot,'data/demo.sqlite'))throw Error('This script only seeds this project’s demo database.');
 const db=openDatabase(requested);try{console.log(seedTwentyAssessedPatients(db))}finally{db.close()}
}
