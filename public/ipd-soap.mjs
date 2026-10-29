import {NORMAL_EXAM, normalExamText} from './pmrs2-exam-normal.js?v=5070';

export const SOAP_KEYS = ['S','O','A','P'];
export const SOAP_TITLES = {
  S:['ព័ត៌មានពីអ្នកជំងឺ','Subjective'], O:['លទ្ធផលពិនិត្យ','Objective'],
  A:['ការវាយតម្លៃ','Assessment'], P:['ផែនការព្យាបាល','Plan']
};
export const EXAM_GROUPS = NORMAL_EXAM;
export const EXAM_ORDER = ['pain','heent','respiratory','cardiovascular','abdomen','genitourinary','extremities','musculoskeletal','neurological','other'];
const clean = value => String(value ?? '').trim();
const normalized = value => clean(value).normalize('NFC').replace(/\s+/g,' ').toLowerCase();

export function buildSoap(parts){
  return SOAP_KEYS.map(key=>key+':\n'+[...new Set((parts[key]||[]).map(clean).filter(Boolean))].join('\n')).join('\n\n');
}

// Keep legacy unsectioned notes intact. No saved text is rewritten by rendering.
export function splitSoap(value){
  const raw=String(value??''),out={S:'',O:'',A:'',P:''};
  const headers=[...raw.matchAll(/^([SOAP]):[ \t]*(.*)$/gm)];
  if(!headers.length || headers.some((h,i)=>i>0&&SOAP_KEYS.indexOf(h[1])<=SOAP_KEYS.indexOf(headers[i-1][1]))){out.S=raw;return out}
  const prefix=raw.slice(0,headers[0].index).trim();if(prefix)out.S=prefix;
  headers.forEach((header,index)=>{
    const body=raw.slice(header.index+2,headers[index+1]?.index??raw.length).trim();
    out[header[1]]=[out[header[1]],body].filter(Boolean).join('\n');
  });
  return out;
}

export function knownNormal(id,value){
  const template=Object.values(NORMAL_EXAM).map(system=>system.fields[id]).find(Boolean);
  if(!template || !clean(value))return false;
  return ['kh','en','fr'].some(language=>normalized(value)===normalized(normalExamText(template[1],language)))
    || ['normal','normale','ធម្មតា'].includes(normalized(value));
}

// Only complete, explicitly documented normal systems become "normal".
// Mixed systems retain their non-template findings; untouched/missing fields
// never become negative findings. Numeric GCS facts remain with abnormal status.
export function summarizeExam(data,{systemLabels={},fieldLabels={},statusLabels={},normal='normal'}={}){
  const lines=[];
  const neuro=['conscious','delirium','coma','seizure'].find(name=>data['ipd_exam_neuro_'+name]===true);
  for(const name of EXAM_ORDER){
    const system=NORMAL_EXAM[name];
    const fields=Object.entries(system.fields).map(([id,[label,template]])=>({id,label:fieldLabels[id]===false?'':fieldLabels[id]||label,template,value:clean(data[id])}));
    const present=fields.filter(part=>part.value),isNeuro=name==='neurological';
    if(!present.length&&!(isNeuro&&neuro))continue;
    const label=systemLabels[name]||system.label;
    if(name==='pain'){if(present.length)lines.push(label+': '+present[0].value);continue}
    const unexpected=present.filter(part=>!knownNormal(part.id,part.value));
    const abnormalStatus=isNeuro&&neuro&&neuro!=='conscious';
    const complete=present.length===fields.length&&(!isNeuro||neuro==='conscious');
    if(complete&&!unexpected.length&&!abnormalStatus){lines.push(label+': '+normal);continue}
    let chosen=unexpected.length||abnormalStatus?unexpected:present;
    if(abnormalStatus)chosen=[...new Map([...chosen,...present.filter(part=>/^ipd_exam_gcs_/.test(part.id))].map(part=>[part.id,part])).values()];
    const detail=[];
    if(isNeuro&&neuro&&(abnormalStatus||!complete))detail.push(statusLabels[neuro]||neuro);
    for(const part of chosen){
      const numeric=/^\d+(?:\.\d+)?$/.test(part.value);
      const value=knownNormal(part.id,part.value)&&!numeric?normal:part.value;
      detail.push((fields.length>1&&part.label?part.label+': ':'')+value);
    }
    if(detail.length)lines.push(label+': '+[...new Set(detail)].join('; '));
  }
  return lines;
}

// Move existing controls rather than recreating clinical fields. Frozen storage
// indexes and migration keys remain on their original nodes.
export function organizeIpdExam(doc){
  const root=doc.getElementById('sub_ipd');if(!root||doc.getElementById('ipd_head_to_toe'))return;
  const title=key=>root.querySelector('[data-key="'+key+'"]');
  const general=title('ipd_gen_app')?.parentElement,heent=title('ipd_heent')?.parentElement;
  const neuro=title('ipd_neuro')?.parentElement,gcs=title('ipd_gcs')?.parentElement;
  const pain=doc.getElementById('ipd_exam_pain')?.parentElement,neuroOther=doc.getElementById('ipd_exam_neuro_other')?.parentElement;
  const ids=['ipd_exam_gu','ipd_exam_extremities','ipd_exam_crt','ipd_exam_msk','ipd_exam_other'];
  if(!general||!heent||!neuro||!gcs||!pain||!neuroOther||ids.some(id=>!doc.getElementById(id)))return;
  const originalControls=[...root.querySelectorAll('input,select,textarea')],source=general.parentElement;
  const layout=doc.createElement('div');layout.id='ipd_head_to_toe';layout.className='ipd-head-to-toe';source.before(layout);
  const normalButton=name=>[...root.querySelectorAll('button[onclick]')].find(n=>n.getAttribute('onclick')==="fillClinicalExamNormal('"+name+"')");
  const singleRow=id=>{const row=doc.createElement('div');row.className='ipd-exam-field-row';row.append(doc.getElementById(id));return row};
  const limb=singleRow('ipd_exam_extremities'),crt=doc.createElement('label');crt.className='ipd-exam-crt';crt.append('CRT: ',doc.getElementById('ipd_exam_crt'));limb.append(crt);
  const gu=singleRow('ipd_exam_gu'),msk=singleRow('ipd_exam_msk'),other=singleRow('ipd_exam_other');
  const measurements=doc.createElement('div');measurements.className='ipd-exam-measurements';
  for(const suffix of ['eye','verbal','motor','total']){const input=doc.getElementById('ipd_exam_gcs_'+suffix);if(!input)continue;const caption=input.previousElementSibling;const label=doc.createElement('label');if(caption?.tagName==='SPAN')label.append(caption);label.append(input);measurements.append(label)}
  gcs.append(measurements);
  const specs=[
    ['general','ipd_gen_app',[general,pain],null],
    ['heent','ipd_heent',[heent],'heent'],
    ['respiratory','ipd_resp',[title('ipd_resp')?.parentElement],'respiratory'],
    ['cardiovascular','ipd_cvs',[title('ipd_cvs')?.parentElement],'cardiovascular'],
    ['abdomen','ipd_abd',[title('ipd_abd')?.parentElement],'abdomen'],
    ['genitourinary','ipd_gu',[gu],'genitourinary'],
    ['extremities','ipd_ext',[limb],'extremities'],
    ['musculoskeletal','ipd_msk',[msk],'musculoskeletal'],
    ['neurological','ipd_neuro',[neuro,gcs,neuroOther],'neurological'],
    ['other','ipd_other_sys',[other],'other']
  ];
  specs.forEach(([name,key,blocks,normal],index)=>{
    const heading=title(key);if(!heading)return;
    const section=doc.createElement('section');section.className='ipd-exam-card';section.dataset.ipdExamSection=name;
    const header=doc.createElement('header'),number=doc.createElement('span');number.className='ipd-exam-number';number.textContent=String(index+1).padStart(2,'0');number.setAttribute('aria-hidden','true');
    const h4=doc.createElement('h4');heading.classList.add('ipd-exam-title');h4.append(heading);header.append(number,h4);
    const button=normal&&normalButton(normal);if(button){button.classList.add('ipd-exam-normal');header.append(button)}
    const body=doc.createElement('div');body.className='ipd-exam-body';blocks.filter(Boolean).forEach(block=>{block.classList.add('ipd-exam-source');body.append(block)});
    section.append(header,body);layout.append(section);
  });
  const tools=doc.getElementById('ipd_exam_normal_language')?.parentElement;tools?.classList.add('ipd-exam-tools');
  if(!source.querySelector('input,select,textarea,button')&&!source.textContent.replace(/[\s\u00a0]/g,'').replace('CRT:',''))source.remove();
  if(originalControls.some(n=>!root.contains(n))||root.querySelectorAll('input,select,textarea').length!==originalControls.length)throw Error('Examination controls must be preserved');
  updateExamLabels(doc);
}

export function updateExamLabels(doc){
  doc.querySelectorAll('#ipd_head_to_toe .ipd-exam-title').forEach(n=>n.textContent=n.textContent.replace(/^[·•\s]+|[:：\s]+$/g,''));
  const normal=doc.querySelector('#sub_ipd [data-key="ipd_diet_normal"]')?.textContent.trim()||'ធម្មតា';
  doc.querySelectorAll('#ipd_head_to_toe .ipd-exam-normal').forEach(n=>n.textContent=normal);
}

export function expandIpdTextFields(doc){
  for(const system of Object.values(NORMAL_EXAM))for(const [id,[,normal]] of Object.entries(system.fields)){
    const original=doc.getElementById(id);
    if(!original || original.tagName!=='INPUT' || /^\d+(?:\.\d+)?$/.test(normal))continue;
    const next=doc.createElement('textarea');
    for(const attribute of original.attributes)if(!['type','value'].includes(attribute.name))next.setAttribute(attribute.name,attribute.value);
    next.defaultValue=original.defaultValue;next.value=original.value;
    next.disabled=original.disabled;next.readOnly=original.readOnly;
    next.rows=1;next.wrap='soft';next.classList.add('ipd-expanding-text');
    original.parentElement.classList.add('ipd-expanding-field');
    if(original.parentElement.parentElement?.style.display==='grid')original.parentElement.parentElement.classList.add('ipd-expanding-grid');
    original.replaceWith(next);
  }
}

export function mountSoapCards(doc){
  const panel=doc.getElementById('ipd_soap_summary_panel'),canonical=doc.getElementById('ipd_soap_summary');
  if(!panel||!canonical||panel.querySelector('[data-ipd-soap-part]'))return;
  canonical.classList.add('ipd-soap-canonical');
  const cards=doc.createElement('div');cards.className='ipd-soap-cards';
  for(const part of SOAP_KEYS){
    const section=doc.createElement('section');section.className='ipd-soap-card ipd-soap-'+part.toLowerCase();
    const label=doc.createElement('label');label.htmlFor='ipd_soap_'+part.toLowerCase();
    const letter=doc.createElement('span');letter.className='ipd-soap-letter';letter.textContent=part;
    const title=doc.createElement('strong');title.dataset.ipdSoapTitle=part;
    label.append(letter,title);
    const entry=doc.createElement('textarea');entry.id=label.htmlFor;entry.className='ipd-soap-entry';entry.dataset.ipdSoapPart=part;
    entry.dataset.emrTransient='';entry.dataset.emrNoAutoIndex='';entry.maxLength=30000;entry.rows=3;entry.wrap='soft';
    section.append(label,entry);cards.append(section);
  }
  canonical.before(cards);updateSoapTitles(doc);populateSoapCards(doc,canonical.value);
}

export function updateSoapTitles(doc){
  const en=doc.documentElement.lang==='en'||(typeof window!=='undefined'&&(window.getBorkeoLanguage?.()==='en'||window.currentLang==='english'));
  doc.querySelectorAll('[data-ipd-soap-title]').forEach(n=>n.textContent=SOAP_TITLES[n.dataset.ipdSoapTitle][en?1:0]);
}

export function populateSoapCards(doc,value){
  const parts=splitSoap(value);
  doc.querySelectorAll('[data-ipd-soap-part]').forEach(n=>n.value=parts[n.dataset.ipdSoapPart]);
}

export function fitIpdText(doc){
  doc.querySelectorAll('#sub_ipd textarea:not(.ipd-soap-canonical)').forEach(n=>{
    if(!n.getClientRects().length)return;
    n.style.height='auto';n.style.height=Math.max(n.classList.contains('ipd-soap-entry')?100:36,n.scrollHeight+8)+'px';
  });
}
