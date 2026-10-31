import {emrOrigin,permissionPattern} from './transport.mjs';
const $=id=>document.getElementById(id);
const messages={
  IDLE:['សូមបើកកំណត់ត្រាអ្នកជំងឺនៅ PMRS។','Open the patient record in PMRS.'],
  SAVED:['បានកំណត់អាសយដ្ឋាន EMR។','EMR address configured.'],
  OPENING:['កំពុងបើក EMR។','Opening EMR.'],
  LOGIN_REQUIRED:['សូមចូល EMR នៅផ្ទាំងដែលបានបើក។ ការផ្ទេរនឹងបន្តក្រោយចូល។','Sign into EMR in the new tab. Delivery resumes after login.'],
  CONTEXT_REQUIRED:['សូមជ្រើសរើសតួនាទីចុះឈ្មោះនៅ EMR។','Choose your registration context in EMR.'],
  DRAFT_FILLED:['បានបំពេញទម្រង់។ សូមពិនិត្យ និងចុចរក្សាទុកនៅ EMR។','Registration form filled. Review and click Save in EMR.'],
  DRAFT_DUPLICATES:['បានបំពេញទម្រង់ ប៉ុន្តែអាចមានកំណត់ត្រាស្ទួន។ សូមពិនិត្យមុនរក្សាទុក។','Form filled; possible duplicates require review before Save.'],
  DUPLICATE_PATIENT:['មានកំណត់ត្រាអ្នកជំងឺរួចហើយ។ មិនបានបំពេញទម្រង់ថ្មីទេ។','Patient already exists. New form was not filled.'],
  FORM_OCCUPIED:['ទម្រង់មានព័ត៌មានរួចហើយ។ មិនបានសរសេរជាន់លើទេ។','Form already contains information. Nothing was overwritten.'],
  PMRS_PAGE_REQUIRED:['សូមបើកព័ត៌មានអ្នកជំងឺនៅ PMRS មុនចុចផ្ទេរ។','Open PMRS patient details before sending.'],
  CAPTURE_FAILED:['មិនអាចអានព័ត៌មានបានទេ។ សូមពិនិត្យថាបានបើកព័ត៌មានអ្នកជំងឺតែម្នាក់។','Capture failed. Make sure exactly one patient details page is visible.'],
  SERVER_UNAVAILABLE:['មិនអាចភ្ជាប់ EMR បានទេ។ សូមពិនិត្យអាសយដ្ឋាន និងម៉ាស៊ីនមេ។','Cannot reach EMR. Check its address and server.'],
  RECEIVER_UPDATE_REQUIRED:['ត្រូវដំឡើងបច្ចុប្បន្នភាព EMR ជាមុន។','Install the matching EMR update first.'],
  EXPIRED:['ការផ្ទេរផុតកំណត់។ សូមចាប់ផ្តើមពីព័ត៌មានអ្នកជំងឺឡើងវិញ។','Transfer expired. Start again from the patient page.'],
  CANCELLED:['បានបោះបង់ការផ្ទេរ។','Transfer cancelled.'],
  PENDING_EXISTS:['មានការផ្ទេរកំពុងរង់ចាំ។ សូមបន្ត ឬបោះបង់ជាមុន។','An import is pending. Resume or cancel it first.'],
  REGISTRATION_ROLE_REQUIRED:['សូមប្រើតួនាទីដែលអាចចុះឈ្មោះអ្នកជំងឺបាន។','Use a role permitted to register patients.'],
  DELIVERY_UNCONFIRMED:['មិនទាន់បញ្ជាក់ការបំពេញទម្រង់។ សូមពិនិត្យផ្ទាំង EMR មុនផ្ទេរម្តងទៀត។','Delivery unconfirmed. Inspect the EMR tab before sending again.'],
  DELIVERING:['កំពុងបំពេញទម្រង់។','Filling registration form.'],
  RETURN_TO_EMR:['សូមត្រឡប់ទៅអាសយដ្ឋាន EMR នៅផ្ទាំងដែលបានបើក។','Return the new tab to the configured EMR address.'],
  FAILED:['ការផ្ទេរមិនបានសម្រេច។ សូមពិនិត្យការកំណត់ និងសិទ្ធិ។','Transfer blocked. Check configuration and permissions.']
};
let english=false,last='IDLE';
const text=(km,en)=>english?en:km;
function render(){
  document.documentElement.lang=english?'en':'km';$('language').textContent=english?'ខ្មែរ':'EN';
  $('origin-label').textContent=text('អាសយដ្ឋាន EMR','EMR address');
  $('save').textContent=text('កំណត់អាសយដ្ឋាន','Configure address');
  $('resume').textContent=text('បន្តការផ្ទេរ','Resume transfer');
  $('cancel').textContent=text('បោះបង់','Cancel');
  $('help').textContent=text('ព័ត៌មានចុះឈ្មោះប៉ុណ្ណោះ។ មិនរក្សាទុកអ្នកជំងឺដោយស្វ័យប្រវត្តិ។ ការផ្ទេរផុតកំណត់ក្រោយ ១០ នាទី។','Registration details only. Does not automatically save the patient. Pending transfer expires after 10 minutes.');
  $('status').textContent=(messages[last]||messages.FAILED)[english?1:0];
}
async function refresh(){const result=await chrome.runtime.sendMessage({type:'STATUS'});last=result.code;render();}
$('language').onclick=()=>{english=!english;render();};
$('save').onclick=async()=>{
  try {
    const origin=emrOrigin($('origin').value.trim());
    const granted=await chrome.permissions.request({origins:[permissionPattern(origin)]});
    if(!granted)throw Error();
    const current=await chrome.runtime.sendMessage({type:'STATUS'});
    if(current.pending){last='PENDING_EXISTS';render();return;}
    const old=(await chrome.storage.local.get('origin')).origin;
    await chrome.storage.local.set({origin});
    if(old && permissionPattern(old)!==permissionPattern(origin))await chrome.permissions.remove({origins:[permissionPattern(old)]});
    $('origin').value=origin;last='SAVED';render();
  }catch{last='FAILED';render();}
};
for(const [id,type]of [['resume','RESUME'],['cancel','CANCEL']])$(id).onclick=async()=>{
  $(id).disabled=true;
  try{last=(await chrome.runtime.sendMessage({type})).code;render();}catch{last='FAILED';render();}finally{$(id).disabled=false;}
};
$('origin').value=(await chrome.storage.local.get('origin')).origin||'http://127.0.0.1:3001';
chrome.storage.onChanged.addListener((changes,area)=>{if(area==='session'&&changes.status){last=changes.status.newValue||'IDLE';render();}});
await refresh().catch(()=>{last='FAILED';render();});
