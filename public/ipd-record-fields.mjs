import {labels as L} from './ipd-record-labels.mjs?v=5050';
import {organizeIpdExam,expandIpdTextFields,mountSoapCards} from './ipd-soap.mjs?v=5100';
const esc=v=>String(v).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const key=id=>'scope:medical:id:'+id;
// Visibility changes presentation only; stored history is never cleared.
export function pregnancyHistoryVisible(patient={},today=new Date(Date.now()+7*3600000).toISOString().slice(0,10)){
 patient=patient||{};
 const sex=String(patient.sex||'').trim().toLowerCase();
 if(!['female','f','girl','\u179f\u17d2\u179a\u17b8'].includes(sex))return false;
 const dob=String(patient.dateOfBirth||'');let age;
 if(/^\d{4}-\d{2}-\d{2}$/.test(dob)&&Number.isFinite(Date.parse(dob))&&new Date(dob).toISOString().slice(0,10)===dob&&dob<=today){
  age=Number(today.slice(0,4))-Number(dob.slice(0,4))-(today.slice(5)<dob.slice(5)?1:0);
 }else{const raw=String(patient.age??'').replace(/[\u17e0-\u17e9]/g,c=>String(c.charCodeAt(0)-0x17e0)).trim();age=/^\d+(?:\.\d+)?$/.test(raw)?Math.floor(Number(raw)):NaN}
 return Number.isFinite(age)&&age>13;
}
export function applyPregnancyHistoryVisibility(doc,patient){const section=doc.getElementById('ipd_pregnancy_history');if(section){const visible=pregnancyHistoryVisible(patient);section.hidden=!visible;section.dataset.pregnancyVisible=String(visible)}}
const input=(id,label,type='text')=>'<label>'+esc(label)+'<input id="'+id+'" type="'+type+'" data-emr-no-auto-index data-emr-storage-key="'+key(id)+'" data-emr-storage-scope="medical" maxlength="300"></label>';
const select=(id,label,choices)=>'<label>'+esc(label)+'<select id="'+id+'" data-emr-no-auto-index data-emr-storage-key="'+key(id)+'" data-emr-storage-scope="medical">'+choices.map(([v,t])=>'<option value="'+v+'">'+esc(t)+'</option>').join('')+'</select></label>';
export function ensureIpdRecordFields(doc){organizeIpdExam(doc);expandIpdTextFields(doc);const get=id=>doc.getElementById(id);if(get('ipd_soap_summary')){mountSoapCards(doc);return {history:get('ipd_pregnancy_history'),summary:get('ipd_soap_summary_panel')}};
 doc.querySelectorAll('#sub_ipd [data-ipd-retired]').forEach(n=>{const section=n.closest('.opd-section');if(section)section.dataset.ipdRetired=''});
 const history=doc.createElement('section');history.id='ipd_pregnancy_history';history.className='ipd-clean-panel';history.innerHTML='<h3>'+esc(L.pregnancy)+'</h3><div class="ipd-clean-grid">'+select('ipd_past_pregnancy',L.past,[['unknown',L.unknown],['yes',L.yes],['no',L.no]])+select('ipd_current_pregnancy',L.current,[['unknown',L.unknown],['pregnant',L.pregnant],['not_pregnant',L.notPregnant],['possible',L.possible],['not_applicable',L.notApplicable]])+input('ipd_gestational_weeks',L.weeks,'number')+select('ipd_breastfeeding',L.breastfeeding,[['unknown',L.unknown],['yes',L.yes],['no',L.no]])+input('ipd_pregnancy_confirmed_on',L.confirmed,'date')+input('ipd_previous_ectopic',L.ectopic,'number')+'<label class="wide">'+esc(L.history)+'<textarea id="ipd_pregnancy_history_notes" data-emr-no-auto-index data-emr-storage-key="'+key('ipd_pregnancy_history_notes')+'" data-emr-storage-scope="medical" maxlength="4000"></textarea></label></div>';
 get('ipd_obgyn_history_section').before(history);get('ipd_gestational_weeks').min='0';get('ipd_gestational_weeks').max='50';get('ipd_gestational_weeks').step='0.1';get('ipd_previous_ectopic').min='0';get('ipd_previous_ectopic').max='99';get('ipd_previous_ectopic').step='1';
 const summary=doc.createElement('section');summary.id='ipd_soap_summary_panel';summary.className='ipd-clean-panel';summary.innerHTML='<h3>'+esc(L.soap)+'</h3><p class="ipd-clean-status" data-soap-mode>'+esc(L.draft)+'</p><textarea id="ipd_soap_summary" class="ipd-soap-summary" data-emr-no-auto-index data-emr-storage-key="'+key('ipd_soap_summary')+'" data-emr-storage-scope="medical" maxlength="30000"></textarea><input type="hidden" id="ipd_soap_manual" value="false" data-emr-no-auto-index data-emr-storage-key="'+key('ipd_soap_manual')+'" data-emr-storage-scope="medical"><div class="ipd-clean-actions no-print"><button type="button" data-refresh-ipd-soap>'+esc(L.refresh)+'</button></div>';
 get('ipd_plan_notes').closest('.opd-section').after(summary);
 mountSoapCards(doc);return {history,summary};
}
