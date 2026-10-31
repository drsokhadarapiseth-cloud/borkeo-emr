'use strict';
(() => {
  const $=id=>document.getElementById('pmrs-'+id);
  const words={
    title:['ផ្ទេរទិន្នន័យ PMRS','PMRS transfer'],
    intro:['ការផ្ទេរត្រូវការកម្មវិធីរុករកនៅកុំព្យូទ័រមន្ទីរពេទ្យ។ សូមចូលគណនី និងបញ្ចូលលេខផ្ទៀងផ្ទាត់ក្នុងកម្មវិធីរុករកដោយខ្លួនឯង។','A browser on the hospital computer is required. Complete login and authenticator verification in that browser.'],
    open:['បើកការតភ្ជាប់','Open connection'],close:['បិទការតភ្ជាប់','Close connection'],capture:['អានអ្នកជំងឺដែលបានបើកក្នុង PMRS','Read the patient open in PMRS'],local:['លេខសម្គាល់កំណត់ត្រាក្នុង EMR','EMR record key'],
    new:['បញ្ចូលទៅទម្រង់ចុះឈ្មោះថ្មី','Fill a new registration'],importPreview:['ពិនិត្យការនាំចូល','Preview import'],exportPreview:['ពិនិត្យការនាំចេញ','Preview export'],reviewed:['ខ្ញុំបានផ្ទៀងផ្ទាត់អ្នកជំងឺ ករណី និងទិន្នន័យដែលត្រូវផ្ទេរ។','I verified the patient, encounter and transfer data.'],
    import:['រក្សាទុកការនាំចូលទៅ EMR','Save import to EMR'],fill:['បំពេញទម្រង់ក្នុង PMRS','Fill PMRS form'],submit:['បញ្ជាក់ និងផ្ញើទៅ PMRS','Confirm and submit to PMRS'],
    linkTitle:['ភ្ជាប់កំណត់ត្រាដែលមានស្រាប់','Link an existing record'],linkNote:['ផ្ទៀងផ្ទាត់ឈ្មោះ ភេទ ថ្ងៃកំណើត និងករណីទាំងពីរជាមុន។ វាយលេខទាំងបីឡើងវិញដើម្បីបញ្ជាក់ការភ្ជាប់។','Verify name, sex, date of birth and encounter in both systems. Retype all three IDs to confirm linking.'],sourcePatient:['លេខអ្នកជំងឺ PMRS','PMRS patient ID'],sourceEncounter:['លេខករណី PMRS','PMRS encounter ID'],localCase:['លេខករណី EMR','EMR case number'],link:['បញ្ជាក់ការភ្ជាប់','Confirm link'],
    disabled:['មិនទាន់អាចផ្ទេរបានទេ។ ត្រូវផ្ទៀងផ្ទាត់ការអនុញ្ញាត និងទម្រង់ PMRS ជាមុនសិន។','Transfers are disabled until PMRS automation authorization and page mappings are verified.'],
    importOnly:['អាចនាំចូលពី PMRS បាន។ ការនាំចេញមិនទាន់បានផ្ទៀងផ្ទាត់។','PMRS import is ready. Export has not been verified.'],
    profilePath:['មិនទាន់បានកំណត់ការតភ្ជាប់ PMRS ទេ។','The PMRS connection has not been configured.'],
    profileUnreadable:['មិនអាចអានការកំណត់ PMRS បានទេ។','The PMRS connection settings could not be read.'],
    authorizationRequired:['ត្រូវបញ្ជាក់ការអនុញ្ញាតប្រើប្រាស់ PMRS ជាមុន។','PMRS automation authorization must be confirmed.'],
    importUnverified:['ត្រូវផ្ទៀងផ្ទាត់ការអានព័ត៌មានពី PMRS ជាមុន។','PMRS reading mappings must be verified first.'],
    identityMapping:['ត្រូវកំណត់ការផ្ទៀងផ្ទាត់អ្នកជំងឺ និងករណី។','Patient and encounter identity mappings are required.'],
    readMapping:['ត្រូវកំណត់ព័ត៌មានដែលត្រូវនាំចូល។','The import fields must be mapped.'],
    exportUnverified:['ការនាំចេញទៅ PMRS មិនទាន់បានផ្ទៀងផ្ទាត់។','PMRS export has not been independently verified.'],
    patientMissing:['រកមិនឃើញកំណត់ត្រា EMR ទេ។ សូមបើកទំព័រនេះពីកំណត់ត្រាអ្នកជំងឺ។','EMR record not found. Open this page from the saved patient record.'],
    ready:['សូមបើកការតភ្ជាប់ រួចចូលគណនី PMRS។','Open the connection, then sign in to PMRS.'],opened:['សូមចូលគណនី បញ្ចូលលេខផ្ទៀងផ្ទាត់ និងបើកករណីអ្នកជំងឺដែលត្រូវការ។','Sign in, complete authentication, and open the intended patient encounter.'],
    done:['បានបញ្ចប់។','Completed.'],filled:['បានបំពេញទម្រង់។ សូមពិនិត្យក្នុង PMRS ម្ដងទៀត មុនបញ្ជាក់ការផ្ញើ។','Form filled. Review it again in PMRS before confirming submission.'],blocked:['ព័ត៌មានខ្លះត្រូវការការពិនិត្យបន្ថែម។ សូមកែតម្រូវកំណត់ត្រាមុនផ្ទេរ។','Some information needs review. Correct the record before transferring.'],
    error:['មិនអាចផ្ទេរបានទេ។ សូមពិនិត្យអត្តសញ្ញាណ សិទ្ធិ ទម្រង់ និងការភ្ជាប់ រួចពិនិត្យឡើងវិញ។','Transfer blocked. Check identity, access, mappings and connection, then preview again.'],
    unknown:['មិនអាចបញ្ជាក់ថា PMRS បានរក្សាទុករួចឬនៅទេ។ សូមពិនិត្យក្នុង PMRS ដោយខ្លួនឯង។ កុំផ្ញើម្ដងទៀត។','PMRS save could not be confirmed. Check PMRS manually. Do not resubmit.'],
    sessionExpired:['ការតភ្ជាប់បានផុតកំណត់។ សូមបើកការតភ្ជាប់ថ្មី ហើយពិនិត្យឡើងវិញ។','Connection expired. Open a new connection and preview again.'],
    browserUnavailable:['មិនអាចបើកកម្មវិធីរុករកបានទេ។ សូមពិនិត្យការដំឡើងនៅកុំព្យូទ័រមន្ទីរពេទ្យ។','The hospital computer could not open the browser. Check its installation.'],
    field:['ព័ត៌មាន','Field'],before:['មុនផ្ទេរ','Before'],after:['ក្រោយផ្ទេរ','After'],source:['ព័ត៌មានពី PMRS','PMRS source information'],changes:['ព័ត៌មានដែលត្រូវផ្លាស់ប្ដូរ','Changes to review'],
  };
  const fieldNames={identity:'អត្តសញ្ញាណ',patientId:'លេខអ្នកជំងឺ',encounterId:'លេខករណី',registration:'ព័ត៌មានចុះឈ្មោះ',clinical:'ព័ត៌មានគ្លីនិក',fullName:'ឈ្មោះពេញ',firstName:'នាមខ្លួន',lastName:'នាមត្រកូល',healthId:'លេខអ្នកជំងឺ PMRS',caseNumber:'លេខករណី',sex:'ភេទ',dob:'ថ្ងៃកំណើត',dateOfBirth:'ថ្ងៃកំណើត',age:'អាយុ',phone:'ទូរស័ព្ទ',province:'ខេត្ត',district:'ស្រុក',commune:'ឃុំ',village:'ភូមិ',street:'អាសយដ្ឋាន',equityCard:'លេខបណ្ណសមធម៌',entryType:'ប្រភេទអ្នកជំងឺ',caregiverName:'ឈ្មោះអ្នកថែទាំ',caregiverPhone:'ទូរស័ព្ទអ្នកថែទាំ',caregiverSex:'ភេទអ្នកថែទាំ',caregiverRelation:'ទំនាក់ទំនងអ្នកថែទាំ',triage:'ទ្រីយ៉ា',chiefComplaint:'រោគសញ្ញា',diagnosisText:'រោគវិនិច្ឆ័យ',diagnosisIcd10:'កូដរោគវិនិច្ឆ័យ',weight:'ទម្ងន់',height:'កម្ពស់',dateTime:'ថ្ងៃម៉ោង',temperature:'សីតុណ្ហភាព',systolic:'សម្ពាធឈាមខាងលើ',diastolic:'សម្ពាធឈាមខាងក្រោម',pulse:'ជីពចរ',respiratoryRate:'អត្រាដង្ហើម',oxygenSaturation:'អុកស៊ីសែន',receivingWard:'ផ្នែកទទួល',serviceType:'ប្រភេទសេវា',caseType:'ប្រភេទករណី',ancillaryService:'សេវាអមវេជ្ជសាស្ត្រ',followUps:'ការតាមដាន',prescription:'វេជ្ជបញ្ជា',discharge:'ការចេញពីពេទ្យ',medications:'ឱសថ',name:'ឈ្មោះ',route:'ផ្លូវប្រើ',pmrsRoute:'ផ្លូវប្រើ',unit:'ឯកតា',morning:'ព្រឹក',afternoon:'ថ្ងៃ',evening:'ល្ងាច',night:'យប់',days:'ចំនួនថ្ងៃ',quantity:'បរិមាណ',note:'កំណត់សម្គាល់',evolution:'ការវិវត្តន៍',conclusion:'សេចក្តីសន្និដ្ឋាន',vitals:'សញ្ញាជីវិត',counselling:'ការណែនាំ',followUpDate:'ថ្ងៃណាត់',sourceDateTime:'ថ្ងៃម៉ោងប្រភព',medicinesAdded:'ឱសថដែលត្រូវបន្ថែម',skipped:'ទិន្នន័យស្ទួនដែលរំលង'};
  let me,clinicalAllowed=false,configured=false,exportReady=false,opened=false,busy=false,sourceJob=null,job=null,kind=null,version=null,filled=false;
  const en=()=>document.documentElement.lang==='en';const t=key=>words[key]?.[en()?1:0]||words.error[0];
  function label(path){return path.split('.').map(key=>en()?key:(fieldNames[key]||(/^\d+$/.test(key)?String(Number(key)+1):'ព័ត៌មាន'))).join(' · ');}
  function renderLanguage(){document.querySelectorAll('[data-t]').forEach(node=>node.textContent=t(node.dataset.t));}
  function controls(){
    $('open').disabled=busy||!configured||opened;$('close').disabled=busy||!opened;$('capture').disabled=busy||!opened;
    $('patient').disabled=busy;$('new').disabled=busy||!sourceJob||!$('reviewed').checked;
    for(const id of ['import-preview','export-preview'])$(id).disabled=!clinicalAllowed||busy||!opened||!$('patient').value.trim()||(id==='import-preview'&&!sourceJob)||(id==='export-preview'&&!exportReady)||version===null;
    $('link').disabled=!clinicalAllowed||busy||!sourceJob||version===null||!$('reviewed').checked;
    $('import').disabled=!clinicalAllowed||busy||kind!=='import'||!job||!$('reviewed').checked;
    $('fill').disabled=!exportReady||!clinicalAllowed||busy||kind!=='export'||!job||filled||!$('reviewed').checked;
    $('submit').disabled=!exportReady||!clinicalAllowed||busy||kind!=='export'||!job||!filled||!$('reviewed').checked;
  }
  function showCapabilities(status){
    const names={PROFILE_PATH_REQUIRED:'profilePath',PROFILE_MISSING:'profilePath',PROFILE_UNREADABLE:'profileUnreadable',AUTOMATION_AUTHORIZATION_REQUIRED:'authorizationRequired',IMPORT_VERIFICATION_REQUIRED:'importUnverified',IMPORT_EVIDENCE_REQUIRED:'importUnverified',IDENTITY_MAPPING_REQUIRED:'identityMapping',READ_MAPPING_REQUIRED:'readMapping'};
    const messages=status.importReady?[t(status.exportReady?'ready':'importOnly')]:[...new Set((status.importBlockers||[]).map(code=>t(names[code]||'disabled')))];
    $('capabilities').textContent=messages.join('\n');
  }
  async function api(path,body){const response=await fetch('/api/pmrs/'+path,{method:body?'POST':'GET',credentials:'same-origin',cache:'no-store',headers:body?{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken}:{},body:body?JSON.stringify(body):undefined});const data=await response.json();if(!response.ok)throw data;return data;}
  function reset(){job=null;kind=null;filled=false;$('reviewed').checked=false;controls();}
  function preview(rows,caption='changes'){
    const host=$('preview');host.replaceChildren();host.hidden=false;
    const table=document.createElement('table'),title=document.createElement('caption');title.textContent=t(caption);table.append(title);
    const head=document.createElement('tr');for(const name of ['field','before','after']){const th=document.createElement('th');th.textContent=t(name);head.append(th);}table.append(head);
    for(const item of rows){const tr=document.createElement('tr');for(const value of [label(item.path||item.field),item.before??'',item.after??'']){const td=document.createElement('td');td.textContent=String(value);tr.append(td);}table.append(tr);}host.append(table);
  }
  function sourceRows(value,path='',rows=[]){for(const [key,entry]of Object.entries(value||{})){if(['job','changes'].includes(key))continue;const next=path?path+'.'+key:key;if(entry&&typeof entry==='object')sourceRows(entry,next,rows);else rows.push({path:next,after:entry});}return rows;}
  async function loadPatient(){version=null;const key=$('patient').value.trim();if(!key){controls();return;}const data=await api('clinical-preview?patientKey='+encodeURIComponent(key));version=data.preview.patientVersion;$('local-identity').textContent=[data.preview.patientName,data.preview.caseNumber,data.preview.healthId].filter(Boolean).join(' · ');controls();}
  async function run(action){busy=true;controls();try{
    const body={patientKey:$('patient').value.trim(),version,job:action==='link'||action==='import-preview'?sourceJob:job,reviewed:$('reviewed').checked};
    if(action==='link')Object.assign(body,{confirmedPatientId:$('confirm-patient').value,confirmedEncounterId:$('confirm-encounter').value,confirmedLocalId:$('confirm-local').value});
    const data=await api(action,body);
    if(action==='open'){opened=true;$('status').textContent=t('opened');}
    else if(action==='close'){opened=false;sourceJob=null;reset();$('preview').replaceChildren();$('status').textContent=t('done');}
    else if(action==='capture'){sourceJob=data.job;reset();preview(sourceRows(data),'source');$('status').textContent=t('reviewed');}
    else if(action==='link'){version=data.version;reset();$('status').textContent=t('done');}
    else if(action.endsWith('preview')){reset();if(data.blocked){$('status').textContent=t('blocked');return;}kind=action==='import-preview'?'import':'export';job=kind==='import'?sourceJob:data.job;preview(data.changes||[]);if(kind==='import'&&data.medicinesAdded){const p=document.createElement('p');p.textContent=label('medicinesAdded')+': '+data.medicinesAdded;$('preview').append(p);}$('status').textContent=t('reviewed');}
    else if(action==='fill'){filled=true;$('reviewed').checked=false;$('status').textContent=t('filled');}
    else{if(data.version)version=data.version;reset();$('status').textContent=t('done');}
  }catch(error){
    reset();if(error.code==='SESSION_EXPIRED'){opened=false;sourceJob=null;}
    $('status').textContent=error.code==='PATIENT_NOT_FOUND'?t('patientMissing'):error.code==='EXPORT_UNVERIFIED'?t('exportUnverified'):t(error.code==='SUBMISSION_UNKNOWN'||error.code==='EXPORT_ALREADY_ATTEMPTED'?'unknown':error.code==='SESSION_EXPIRED'?'sessionExpired':error.code==='BROWSER_UNAVAILABLE'?'browserUnavailable':'error');
  }finally{busy=false;controls();}}
  for(const action of ['open','close','capture','link','import-preview','import','export-preview','fill','submit'])$(action).addEventListener('click',()=>void run(action));
  $('patient').value=new URL(location.href).searchParams.get('patientKey')||'';
  $('patient').addEventListener('input',()=>{version=null;reset();$('local-identity').textContent='';$('preview').hidden=true;});
  $('patient').addEventListener('change',()=>void loadPatient().catch(()=>{$('status').textContent=t('error');}));
  $('reviewed').addEventListener('change',controls);
  $('new').addEventListener('click',()=>{if(sourceJob&&$('reviewed').checked)location.href='/emr?view=register&pmrsImport='+encodeURIComponent(sourceJob);});
  window.addEventListener('borkeo-language-change',renderLanguage);
  async function start(){renderLanguage();controls();try{const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!response.ok)return;me=await response.json();clinicalAllowed=['ADMIN','VICE_DIRECTOR','DOCTOR'].includes(me.user?.activeRole);for(const id of ['import-preview','export-preview','import','fill','submit'])$(id).hidden=!clinicalAllowed;document.querySelector('.pmrs-link').hidden=!clinicalAllowed;$('patient').closest('label').hidden=!clinicalAllowed;const status=await api('status');configured=status.importReady===true;exportReady=status.exportReady===true;showCapabilities(status);$('status').textContent=t(configured?'ready':'disabled');await loadPatient();}catch{$('status').textContent=t('error');}controls();}
  void start();
})();
