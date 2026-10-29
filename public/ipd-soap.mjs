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
// indexes and migration keys remain on their original nodes. Each caption stays
// the previous sibling of its control because the SOAP summary reads it there.
export function organizeIpdExam(doc){
  const root=doc.getElementById('sub_ipd');if(!root||doc.getElementById('ipd_head_to_toe'))return;
  const get=id=>doc.getElementById(id),title=key=>root.querySelector('[data-key="'+key+'"]');
  const general=title('ipd_gen_app')?.parentElement,source=general?.parentElement;
  const keys=['ipd_gen_app','ipd_heent','ipd_resp','ipd_cvs','ipd_abd','ipd_gu','ipd_ext','ipd_msk','ipd_neuro','ipd_gcs','ipd_other_sys'];
  const ids=[...Object.values(NORMAL_EXAM).flatMap(system=>Object.keys(system.fields)),...['good','fair','severe','very_severe'].map(s=>'ipd_exam_general_'+s),...['conscious','delirium','coma','seizure'].map(s=>'ipd_exam_neuro_'+s)];
  if(!source||keys.some(key=>!title(key))||ids.some(id=>!get(id)))return;
  const originalControls=[...root.querySelectorAll('input,select,textarea')];
  const el=(tag,className,...children)=>{const n=doc.createElement(tag);if(className)n.className=className;n.append(...children.filter(Boolean));return n};
  const mark=(node,className)=>{node.classList.add(className);return node};
  const row=(label,...content)=>el('div','ipd-exam-row'+(label?'':' ipd-exam-row-full'),label&&mark(label,'ipd-exam-label'),...content);
  const field=id=>row(get(id).previousElementSibling,get(id));
  const alone=id=>row(null,get(id));
  const choices=inputs=>row(null,el('div','ipd-exam-choices',...inputs.map(n=>mark(n.closest('label'),'ipd-exam-choice'))));
  const side=id=>[mark(get(id).previousElementSibling,'ipd-exam-side'),get(id)];
  const pair=(key,left,right)=>row(get(left).parentElement.querySelector('[data-key="'+key+'"]'),el('div','ipd-exam-pair',...side(left),...side(right)));
  const short=id=>mark(get(id),'ipd-exam-short');
  const gcs=row(title('ipd_gcs'),el('div','ipd-exam-numbers',...['eye','verbal','motor','total'].map(s=>el('label','ipd-exam-number-field',...side('ipd_exam_gcs_'+s)))));
  const radios=(prefix,names)=>names.map(s=>get(prefix+s));
  const specs=[
    ['general','ipd_gen_app',[choices(radios('ipd_exam_general_',['good','fair','severe','very_severe'])),choices([...general.querySelectorAll('input[type=checkbox]')]),row(get('ipd_exam_pain').previousElementSibling,short('ipd_exam_pain'))],null],
    ['heent','ipd_heent',[field('ipd_exam_head'),pair('ipd_eyes','ipd_exam_eye_left','ipd_exam_eye_right'),field('ipd_exam_fundus'),pair('ipd_ears','ipd_exam_ear_left','ipd_exam_ear_right'),field('ipd_exam_nose'),field('ipd_exam_throat'),field('ipd_exam_neck'),field('ipd_exam_lymph')],'heent'],
    ...[['respiratory','ipd_resp','resp'],['cardiovascular','ipd_cvs','cvs'],['abdomen','ipd_abd','abd']].map(([name,key,prefix])=>[name,key,['inspection','auscultation','palpation','percussion'].map(s=>field('ipd_exam_'+prefix+'_'+s)),name]),
    ['genitourinary','ipd_gu',[alone('ipd_exam_gu')],'genitourinary'],
    ['extremities','ipd_ext',[alone('ipd_exam_extremities'),row(el('span','','CRT'),el('div','',short('ipd_exam_crt')))],'extremities'],
    ['musculoskeletal','ipd_msk',[alone('ipd_exam_msk')],'musculoskeletal'],
    ['neurological','ipd_neuro',[choices(radios('ipd_exam_neuro_',['conscious','delirium','coma','seizure'])),gcs,field('ipd_exam_neuro_other')],'neurological'],
    ['other','ipd_other_sys',[alone('ipd_exam_other')],'other']
  ];
  const layout=el('div','ipd-head-to-toe');layout.id='ipd_head_to_toe';source.before(layout);
  const normalButton=name=>[...root.querySelectorAll('button[onclick]')].find(n=>n.getAttribute('onclick')==="fillClinicalExamNormal('"+name+"')");
  specs.forEach(([name,key,rows,normal],index)=>{
    const number=el('span','ipd-exam-number',String(index+1).padStart(2,'0'));number.setAttribute('aria-hidden','true');
    const header=el('header','',number,el('h4','',mark(title(key),'ipd-exam-title')));
    const button=normal&&normalButton(normal);if(button){button.classList.add('ipd-exam-normal');header.append(button)}
    const section=el('section','ipd-exam-card',header,el('div','ipd-exam-body',...rows));section.dataset.ipdExamSection=name;layout.append(section);
  });
  get('ipd_exam_normal_language')?.parentElement?.classList.add('ipd-exam-tools');
  if(!source.querySelector('input,select,textarea,button'))source.remove();
  if(originalControls.some(n=>!root.contains(n))||root.querySelectorAll('input,select,textarea').length!==originalControls.length)throw Error('Examination controls must be preserved');
  updateExamLabels(doc);
  // Language switching rewrites captions with list markers and colons; tidy them again.
  const Observer=doc.defaultView?.MutationObserver;
  if(Observer)new Observer(()=>updateExamLabels(doc)).observe(layout,{subtree:true,childList:true,characterData:true});
}

export function updateExamLabels(doc){
  const set=(n,text)=>{if(n.textContent!==text)n.textContent=text};
  doc.querySelectorAll('#ipd_head_to_toe :is(.ipd-exam-title,.ipd-exam-label,.ipd-exam-side)').forEach(n=>set(n,n.textContent.replace(/^[·•\-–\s\u00a0]+|[:\uff1a\u17c8\s\u00a0]+$/g,'')));
  const normal=doc.querySelector('#sub_ipd [data-key="ipd_diet_normal"]')?.textContent.trim()||'ធម្មតា';
  doc.querySelectorAll('#ipd_head_to_toe .ipd-exam-normal').forEach(n=>set(n,normal));
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
