import {medicationTable} from './medication-review.mjs';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function clinicalValues(value){
 if(typeof value==='string'){try{return clinicalValues(JSON.parse(value))}catch{return esc(value)}}
 if(Array.isArray(value)&&value.length&&value.every(m=>m&&typeof m==='object'&&['regularRow','protocolRow'].includes(m.rowType)))return medicationTable(value);
 if(Array.isArray(value))return '<ul>'+value.map(v=>'<li>'+clinicalValues(v)+'</li>').join('')+'</ul>';
 if(value&&typeof value==='object'){
  const labels={name:'ឈ្មោះ',medicine:'ឈ្មោះថ្នាំ',drugName:'ឈ្មោះថ្នាំ',dose:'កម្រិតថ្នាំ',unit:'ឯកតា',route:'ផ្លូវប្រើប្រាស់',frequency:'ចំនួនដង',duration:'រយៈពេល',date:'កាលបរិច្ឆេទ',dtVal:'កាលបរិច្ឆេទ',temp:'កម្តៅ',bp_sys:'សម្ពាធឈាម',bp_dia:'សម្ពាធឈាម',pulse:'ជីពចរ',resp:'ដង្ហើម',spo2:'អុកស៊ីសែន',evol:'ការវិវត្ត',conclusion:'សេចក្តីសន្និដ្ឋាន',medications:'វេជ្ជបញ្ជា'};
  return '<table>'+Object.entries(value).filter(([k,v])=>v!==''&&v!=null&&!/^(?:id|key|patientKey|createdBy|updatedBy|signatureDataUrl)$/.test(k)).map(([k,v])=>'<tr><th>'+esc(labels[k]||'ព័ត៌មានបន្ថែម')+'</th><td>'+clinicalValues(v)+'</td></tr>').join('')+'</table>';
 }
 return esc(value);
}

// Render a detached, script-free copy. Never load the source EMR in an iframe
// or turn a referred visit into a writable receiving-hospital encounter.
export function recordDocument(template,visit,kind){
 const doc=new DOMParser().parseFromString(template,'text/html'),data=visit.patient.data||{};
 doc.querySelectorAll('script,iframe,object,embed').forEach(n=>n.remove());
 doc.querySelectorAll('#sub_nursing .vital-tbl').forEach(table=>{
  [...(table.tBodies[0]?.rows||[])].forEach((row,index)=>{
   if(index<2||row.matches('.graph-tr,.nursing-resp-row,.nursing-spo2-row')||row.closest('.midwife-assessment-pages'))return;
   [...row.cells].forEach(cell=>{if(!cell.matches('.nursing-calculated-cell,.nursing-med-time-cell,.nursing-medication-source-cell')&&!cell.textContent.trim()&&!cell.children.length)cell.setAttribute('contenteditable','true')});
  });
 });
 const controls=[...doc.querySelectorAll('input:not([type=button]):not([type=submit]):not([type=reset]):not([type=file]):not([type=password]),select,textarea,[contenteditable="true"],[data-original-contenteditable="true"],[data-editor-editable="true"]')].filter(n=>!n.matches('.emr-palette-input')&&!n.closest('.ward-service-panel'));
 const counters={};let added=0;
 for(const [index,n] of controls.entries()){
  if(n.hasAttribute('data-emr-transient')){added++;continue}
  const scope=['pmrs_chief_complaint','pmrs_chief_complaint_items'].includes(n.id)?'triage':n.closest('#page1')?'registration':n.closest('#page2')?'triage':n.closest('#sub_nursing')?'nursing':n.closest('#page3')?'medical':'common';
  const position=counters[scope]||0,newControl=n.hasAttribute('data-emr-no-auto-index');if(!newControl)counters[scope]=position+1;
  if(!n.hasAttribute('data-emr-no-save')){
   const key=n.id?`scope:${scope}:id:${n.id}`:`scope:${scope}:auto:${n.dataset.emrKeyIndex??position}`;
   const legacy=n.id?'id:'+n.id:'auto:'+(n.dataset.emrLegacyIndex??index-added);
   const keys=[key];if(n.hasAttribute('data-emr-migrate-auto-key'))keys.push(`scope:${scope}:auto:${n.dataset.emrKeyIndex??position}`);keys.push(legacy);
   const saved=keys.find(k=>Object.hasOwn(data,k));n.dataset.reviewKey=key;
   const value=saved===undefined?'':data[saved];
   if(n.matches('[type=checkbox],[type=radio]'))n.checked=value===true||value==='true';
   else if(n.hasAttribute('contenteditable'))n.textContent=value??'';
   else n.value=typeof value==='object'?JSON.stringify(value):value??'';
  }
  if(newControl)added++;
 }
 const root=doc.getElementById(kind==='nursing'?'sub_nursing':kind==='opd'?'sub_opd':'sub_ipd');
 if(!root)return '';
 for(const prefix of ['opd','ipd']){const name=doc.getElementById(prefix+'_banner_patient_name');if(name)name.textContent=visit.patient.fullName||'';for(const [suffix,value] of Object.entries({adm_no:visit.patient.caseNumber,health_id:visit.patient.healthId,ward:visit.patient.departmentNameKh||visit.patient.departmentCode})){const n=doc.getElementById(prefix+'_banner_'+suffix);if(n)n.textContent=value||''}const meta=doc.getElementById(prefix+'_banner_patient_meta');if(meta)meta.textContent=[visit.patient.healthId,visit.patient.sex,visit.patient.age].filter(Boolean).join(' · ')}
 if(kind==='nursing'){
  const maternity=visit.patient.departmentCode==='obstetric';
  root.querySelector('#'+(maternity?'nursing_general':'nursing_maternity'))?.remove();
 }
 root.querySelectorAll('input,select,textarea').forEach(n=>{
  if(['hidden','file','button','submit','reset','password'].includes(n.type)){n.remove();return}
  if(n.tagName==='TEXTAREA'){const text=doc.createElement('div');text.className=n.className+' referred-value';text.id=n.id;text.dataset.reviewKey=n.dataset.reviewKey||'';text.style.cssText=n.style.cssText;text.style.height='auto';text.style.whiteSpace='pre-wrap';text.textContent=n.value;n.replaceWith(text);return}
  n.disabled=true;n.setAttribute('disabled','');n.removeAttribute('name');
  if(n.matches('[type=checkbox],[type=radio]'))n.toggleAttribute('checked',n.checked);
  else if(n.tagName==='SELECT'){for(const option of n.options)option.toggleAttribute('selected',option.selected)}
  else n.setAttribute('value',n.value);
 });
 root.querySelectorAll('button,script,iframe,object,embed,form .action-bar,.action-bar,.emr-save-bar,.emr-save-button,.opd-module-toolbar,.nursing-section-tabs').forEach(n=>n.remove());
 for(const n of [root,...root.querySelectorAll('*')]){
  for(const a of [...n.attributes])if(a.name.startsWith('on')||['contenteditable','srcdoc','href','target','formaction','action','srcset'].includes(a.name))n.removeAttribute(a.name);
  if(n.tagName==='IMG'&&!/^data:image\/(?:png|jpeg);base64,/.test(n.getAttribute('src')||'')&&n.getAttribute('src')!=='/public/logo-hospital.jpg')n.removeAttribute('src');
  if(n.hasAttribute('hidden'))n.removeAttribute('hidden');
 }
 root.style.display='block';root.classList.add('active');
 const supplements=[];
 for(const [key,title] of [['system:opdMedications','វេជ្ជបញ្ជា'],['system:initialIpdMedications','ការព្យាបាល'],['system:dailyMonitoringRecords','ការតាមដានប្រចាំថ្ងៃ']]){
  const value=data[key];if(value&&value!=='[]')supplements.push(`<section><h2>${title}</h2>${key==='system:dailyMonitoringRecords'?clinicalValues(value):medicationTable(value)}</section>`);
 }
 if(kind==='nursing')for(const [key,value] of Object.entries(data))if(/^system:(?:nurs|midwife)/.test(key)&&value&&value!=='[]')supplements.push('<section><h2>តារាងថែទាំ</h2>'+clinicalValues(value)+'</section>');
 const styles=[...doc.querySelectorAll('head style')].map(n=>n.outerHTML).join('');
 const theme=visit.presentation?.theme||{},preset=/^(?:0[1-9]|10)$/.test(theme.preset)?theme.preset:'06';
 const themeVars=['primary','background','surface','text'].filter(key=>/^#[0-9a-f]{6}$/i.test(theme[key]||'')).map(key=>'--emr-'+key+':'+theme[key]).join(';');
 return `<!doctype html><html lang="km" data-emr-preset="${preset}" data-emr-style="preset" style="${themeVars}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; font-src 'self'; img-src 'self' data:; form-action 'none'; base-uri 'none'"><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>.medication-review-scroll{overflow:auto;margin:16px 0}.medication-review{width:100%;border-collapse:collapse;font:14px/1.6 sans-serif}.medication-review th,.medication-review td{padding:10px;border:1px solid #d4e2e9;text-align:left;vertical-align:top;min-width:70px;white-space:normal}.medication-review th{background:#edf6fa}.medication-review td:nth-child(2){min-width:220px;font-weight:600}@media print{.medication-review-scroll{overflow:visible}.medication-review{font-size:10px}.medication-review td{min-width:0!important;overflow-wrap:anywhere}.medication-review tr{break-inside:avoid}}body{margin:0;padding:16px;background:white;color:var(--emr-text,#102f42);font:14px/1.7 BorkeoInterface,sans-serif}input:disabled,select:disabled{opacity:1;-webkit-text-fill-color:currentColor}.page,.sub-tab,.nursing-form-pane{display:block!important}.referred-value{display:inline-block;min-width:20px;white-space:pre-wrap;color:#102f42;padding:3px 6px}pre{white-space:pre-wrap;overflow-wrap:anywhere}.action-bar,.no-print button{display:none!important}img:not([src]){display:none}button,a,input,textarea,select{pointer-events:none}</style></head><body class="emr-readonly-record"><p>${esc(visit.patient.entryDate)} — ${esc(visit.patient.dischargeDate||'—')}</p><main id="page3" class="page active">${root.outerHTML}${supplements.join('')}</main></body></html>`;
}
