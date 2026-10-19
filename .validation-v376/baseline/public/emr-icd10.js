'use strict';
(() => {
  const mappings = {diag_input:'emr_pmrs_opd_diagnosis', emr_pmrs_ipd_icd10:'emr_pmrs_ipd_diagnosis', mon_input_icd10:'mon_input_conclusion', emr_discharge_icd10:'emr_discharge_diagnosis'};
  const english = () => window.getBorkeoLanguage?.() === 'en' || window.currentLang === 'english';
  const popup = document.createElement('div'); popup.className='emr-icd-popup no-print'; popup.hidden=true; popup.dataset.languageExclude=''; popup.id='emr-icd-results'; popup.setAttribute('role','listbox');
  document.body.append(popup);
  let active, timer, controller, sequence=0, selected=-1;
  const cache=new Map();
  function close() { clearTimeout(timer); controller?.abort(); sequence++; popup.hidden=true; active?.setAttribute('aria-expanded','false'); }
  function target(input) {
    const row=input.closest('[data-diagnosis-row]');
    if(row) return row.querySelector('[data-diagnosis-text]');
    if(input.name==='dischargeIcd10') return input.form?.elements.dischargeDiagnosis;
    return document.getElementById(mappings[input.id]);
  }
  function position() {
    if(!active || popup.hidden) return;
    const r=active.getBoundingClientRect(), width=Math.min(Math.max(r.width,430),window.innerWidth-16);
    popup.style.width=width+'px'; popup.style.left=Math.max(8,Math.min(r.left,window.innerWidth-width-8))+'px';
    const below=window.innerHeight-r.bottom;
    popup.style.maxHeight=Math.max(100,Math.min(320,below>150?below-12:r.top-12))+'px';
    popup.style.top=below>150?(r.bottom+4)+'px':''; popup.style.bottom=below>150?'':(window.innerHeight-r.top+4)+'px';
  }
  function message(text) { popup.replaceChildren(); const p=document.createElement('div');p.className='emr-icd-status';p.textContent=text;popup.append(p); }
  function choose(item) {
    if(!active || active.disabled || active.readOnly || !item.selectable) return;
    const input=active, note=target(input);
    input.value=item.code; input.setCustomValidity('');
    // Existing clinical notes are never silently overwritten.
    if(note && !note.disabled && !note.readOnly && !note.value.trim()) {
      note.value=english()?(item.en||item.kh||item.fr):(item.kh||item.en||item.fr);
      note.dispatchEvent(new Event('input',{bubbles:true}));note.dispatchEvent(new Event('change',{bubbles:true}));
    }
    input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));
    close();input.focus(); close();
  }
  function render(data) {
    popup.replaceChildren(); selected=-1; active.removeAttribute('aria-activedescendant');
    for(const item of data.items) {
      const button=document.createElement('button');button.type='button';button.role='option';button.id='icd-option-'+item.id;button.setAttribute('aria-selected','false');button.disabled=!item.selectable;
      const desc = english() ? (item.en || item.kh || item.fr || '') : (item.kh || item.en || item.fr || '');
      const text = item.code + ' - ' + desc;
      button.textContent = text;
      button.title = item.selectable ? text : text + (english() ? ' (Source code needs review)' : ' (កូដក្នុងប្រភពត្រូវការផ្ទៀងផ្ទាត់)');
      button.onmouseenter = () => {
        if (button.disabled) return;
        const options=[...popup.querySelectorAll('button:not(:disabled)')];
        selected=options.indexOf(button);
        options.forEach(option=>option.setAttribute('aria-selected',String(option===button)));
        active.setAttribute('aria-activedescendant',button.id);
      };
      button.onclick=()=>choose(item);popup.append(button);
    }
    if(!data.items.length) message(english()?'No matches.':'រកមិនឃើញ។');
    else if(data.limited) { const p=document.createElement('div');p.className='emr-icd-status';p.textContent=english()?'First 40 matches. Type more to narrow your search.':'បង្ហាញ ៤០ លទ្ធផលដំបូង។ សូមវាយបន្ថែមដើម្បីស្វែងរក។';popup.append(p); }
    position();
  }
  async function search(input) {
    if(input.disabled || input.readOnly || document.activeElement!==input) return;
    const q=input.value.trim(); active=input;
    const surface=input.closest('dialog') || document.body; if(popup.parentNode!==surface)surface.append(popup); const ticket=++sequence;controller?.abort();controller=new AbortController();popup.hidden=false;input.setAttribute('aria-expanded','true');position();
    if(q && q.length<2) {message(english()?'Type at least 2 characters.':'សូមវាយយ៉ាងតិច ២ តួអក្សរ។');return;}
    message(english()?'Searching…':'កំពុងស្វែងរក…');
    try {
      let data=cache.get(q);
      if(!data) {const response=await fetch('/api/icd10/search?q='+encodeURIComponent(q),{credentials:'same-origin',signal:controller.signal});if(!response.ok)throw Error('Search unavailable');data=await response.json();if(cache.size>=60)cache.delete(cache.keys().next().value);cache.set(q,data);}
      if(ticket!==sequence || active!==input || document.activeElement!==input)return;render(data);
    } catch(error) {if(error.name!=='AbortError' && ticket===sequence)message(english()?'Search unavailable. Retry or enter a code manually.':'មិនអាចស្វែងរកបាន។ សូមព្យាយាមម្តងទៀត ឬបញ្ចូលកូដដោយដៃ។');}
  }
  function attach(input) {
    if(input.dataset.icdSearchBound)return;input.dataset.icdSearchBound='1';input.removeAttribute('list');input.autocomplete='off';input.setAttribute('role','combobox');input.setAttribute('aria-autocomplete','list');input.setAttribute('aria-controls',popup.id);input.setAttribute('aria-expanded','false');
    input.addEventListener('focus',()=>search(input));input.addEventListener('click',()=>{if(popup.hidden)search(input);});
    input.addEventListener('input',()=>{clearTimeout(timer);controller?.abort();sequence++;if(active===input)popup.hidden=true;timer=setTimeout(()=>search(input),200);});
    input.addEventListener('keydown',event=>{
      if(event.key==='Escape'){close();return;}
      if(popup.hidden || active!==input)return;
      const options=[...popup.querySelectorAll('button:not(:disabled)')];
      if(event.key==='ArrowDown'||event.key==='ArrowUp'){event.preventDefault();selected=Math.max(0,Math.min(options.length-1,selected+(event.key==='ArrowDown'?1:-1)));options.forEach((b,i)=>b.setAttribute('aria-selected',String(i===selected)));if(options[selected]){input.setAttribute('aria-activedescendant',options[selected].id);options[selected].scrollIntoView({block:'nearest'});}}
      if(event.key==='Enter' && selected>=0 && options[selected]){event.preventDefault();options[selected].click();}
    });
    input.addEventListener('blur',()=>setTimeout(()=>{if(!popup.contains(document.activeElement))close();},150));
  }
  function scan(root=document) {root.querySelectorAll('input').forEach(input=>{if(mappings[input.id] || input.hasAttribute('data-diagnosis-code') || input.name==='dischargeIcd10')attach(input);});}
  scan();new MutationObserver(records=>{for(const record of records)for(const node of record.addedNodes)if(node.nodeType===1 && !popup.contains(node)){if(node.matches('input[data-diagnosis-code]'))attach(node);scan(node);}}).observe(document.body,{childList:true,subtree:true});
  document.addEventListener('focusin',event=>{if(event.target!==active && !popup.contains(event.target))close();});
  document.addEventListener('pointerdown',event=>{if(event.target!==active && !popup.contains(event.target))close();});
  document.addEventListener('emr:patient-loaded',close);window.addEventListener('borkeo-language-change',close);
  window.addEventListener('resize',close);window.addEventListener('scroll',event=>{if(!popup.contains(event.target))close();},true);
})();
