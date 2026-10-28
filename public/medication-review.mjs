import './medication-routes.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const present=v=>v!==undefined&&v!==null&&String(v).trim()!=='';
const shown=v=>present(v)?esc(v):'មិនបានកត់ត្រា';
function schedule(m){
 const parts=[];
 for(const [key,label] of [['m','ព្រឹក'],['a','រសៀល'],['e','ល្ងាច'],['n','យប់']])if(present(m[key]))parts.push(label+': '+esc(m[key]));
 if(present(m.qHours))parts.push('រៀងរាល់ '+esc(m.qHours)+' ម៉ោង');
 if(m.timingMode==='protocol'||m.rowType==='protocolRow'||m.scheduleType==='protocol'){
  if(present(m.protocolDose))parts.push('កម្រិតថ្នាំតាមលំដាប់: '+esc(m.protocolDose));
  let intervals=m.protocolIntervals;
  if(typeof intervals==='string'){try{intervals=JSON.parse(intervals)}catch{parts.push(esc(intervals));intervals=[]}}
  if(Array.isArray(intervals))for(const interval of intervals)parts.push(shown(interval.value)+' '+(interval.unit==='minutes'?'នាទី':interval.unit==='hours'?'ម៉ោង':shown(interval.unit)));
  if(present(m.protocolRepeatValue))parts.push('បន្តរៀងរាល់: '+esc(m.protocolRepeatValue)+' '+(m.protocolRepeatUnit==='minutes'?'នាទី':m.protocolRepeatUnit==='hours'?'ម៉ោង':shown(m.protocolRepeatUnit)));
  if(present(m.protocolMaxDoses))parts.push('ចំនួនលើកសរុប: '+esc(m.protocolMaxDoses));
  if(present(m.protocolStopAt))parts.push('បញ្ឈប់នៅ: '+esc(m.protocolStopAt));
 }
 if(present(m.effectiveAt))parts.push('ចាប់ផ្តើម: '+esc(m.effectiveAt));
 return parts.length?parts.join('<br>'):'មិនបានកត់ត្រា';
}
export function medicationTable(value){
 let medications=value;
 if(typeof value==='string'){try{medications=JSON.parse(value)}catch{return '<p>'+esc(value)+'</p>'}}
 if(!Array.isArray(medications))return '<p>ព័ត៌មានវេជ្ជបញ្ជាមិនអាចបង្ហាញបាន</p>';
 return '<div class="medication-review-scroll"><table class="medication-review"><thead><tr>'+['ល.រ','ឈ្មោះថ្នាំ និងកម្លាំង','កម្រិតថ្នាំ','ឯកតា','ផ្លូវប្រើប្រាស់','ពេលប្រើប្រាស់','រយៈពេល (ថ្ងៃ)','ចំនួនសរុប','ការណែនាំ'].map(t=>'<th scope="col">'+t+'</th>').join('')+'</tr></thead><tbody>'+medications.map((m,index)=>{
  if(!m||typeof m!=='object'||Array.isArray(m))return '<tr><td>'+String(index+1)+'</td><td colspan="8">ព័ត៌មានវេជ្ជបញ្ជាមិនអាចបង្ហាញបាន</td></tr>';
  const notes=[m.instructions,m.note,m.doseOverrideReason].filter(present).map(esc).join('<br>');
  const route=present(m.route)?globalThis.BorkeoMedicationRoutes.label(m.route,'khmer'):'';
  return '<tr><td>'+String(index+1)+'</td><td>'+shown(m.name??m.drugName??m.medicine)+'</td><td>'+shown(m.doseAmount??m.dose)+'</td><td>'+shown(m.unit)+'</td><td>'+shown(route)+'</td><td>'+schedule(m)+'</td><td>'+shown(m.d??m.duration)+'</td><td>'+shown(m.total)+'</td><td>'+(notes||'មិនបានកត់ត្រា')+'</td></tr>';
 }).join('')+'</tbody></table></div>';
}
