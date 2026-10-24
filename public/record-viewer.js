'use strict';
(async function managementRecordViewer() {
  const $=id=>document.getElementById(id),escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key=new URLSearchParams(location.search).get('patient');
  let encounters=[],kind='ipd',generation=0,scope='medical';
  const language = new URLSearchParams(location.search).get('lang') === 'en' ? 'en' : 'kh';
  const copy = language === 'en' ? {visit:'Visit date',department:'Department',exit:'Exit date',payment:'Payment status',edit:'Edit',request:'Request correction',active:'Active visit',paid:'Paid',unpaid:'Unpaid',pending:'Pending',close:'Close'} :
    {visit:'កាលបរិច្ឆេទពិនិត្យ',department:'ផ្នែក',exit:'កាលបរិច្ឆេទចេញ',payment:'ស្ថានភាពបង់ប្រាក់',edit:'កែប្រែព័ត៌មាន',request:'ស្នើសុំកែប្រែ',active:'មិនទាន់ចេញពីពេទ្យ',paid:'បានបង់ប្រាក់',unpaid:'មិនទាន់បង់ប្រាក់',pending:'កំពុងរង់ចាំ',close:'បិទ'};
  function visitList(){
    const host=document.createElement('section');host.className='viewer-visits';
    host.innerHTML='<table><thead><tr>'+[copy.visit,copy.department,copy.exit,copy.payment,''].map(label=>'<th>'+escape(label)+'</th>').join('')+'</tr></thead><tbody>'+encounters.map(entry=>{
      const patient=entry.patient,access=patient.recordAccess||{},payment=patient.paymentStatus||{};
      const paid=payment.paid===true||['PAID','FULLY_PAID','HEF_PAID','NSSF_PAID','FULL_WAIVER','EXEMPT'].includes(payment.code);
      const status=(language==='en'?payment.labelEn:payment.labelKh)||(paid?copy.paid:['UNPAID','NOT_PAID'].includes(payment.code)?copy.unpaid:copy.pending);
      return '<tr><td><button type="button" data-visit="'+escape(patient.patientKey)+'">'+escape(date(patient.entryDate)+(patient.entryTime?' '+patient.entryTime:'')+' · '+(patient.caseNumber||''))+'</button></td><td>'+escape(patient.departmentNameKh||patient.departmentCode||'—')+'</td><td>'+escape(patient.dischargeDate?date(patient.dischargeDate):copy.active)+'</td><td>'+escape(status)+'</td><td>'+
        (access.canEdit||access.requiresApproval?'<a target="_blank" rel="noopener" href="/emr?'+escape(new URLSearchParams({patient:patient.patientKey,view:access.view,mode:'edit'}).toString())+'">'+escape(access.requiresApproval?copy.request:copy.edit)+'</a>':'')+'</td></tr>';
    }).join('')+'</tbody></table>';
    host.addEventListener('click',event=>{const button=event.target.closest('[data-visit]');if(!button)return;const entry=encounters.find(item=>item.patient.patientKey===button.dataset.visit);if(!entry)return;choose(scope==='triage'?'triage':entry.patient.serviceMode==='opd'?'opd':'ipd',entry.patient.patientKey);});
    document.querySelector('.viewer-toolbar').after(host);
  }
  const date=value=>value?String(value).replace('T',' ').slice(0,19):'—';
  const readArray=value=>{try{const list=typeof value==='string'?JSON.parse(value):value;return Array.isArray(list)?list:[]}catch{return []}};
  function imagingHtml(orders){
    const title=language==='en'?'Imaging results':'លទ្ធផលរូបភាពវេជ្ជសាស្ត្រ';
    const modalities={XRAY:'ថតកាំរស្មី',ULTRASOUND:'អេកូសាស្ត្រ',CT:'ថតស្កេន',MRI:'ថតអនុភាពម៉ាញេទិក'};
    return '<section class="viewer-imaging"><h3>'+title+'</h3>'+orders.filter(order=>order.modality!=='LAB').map(order=>{
      const result=order.result||{};
      return '<article><h4>'+escape(language==='en'?order.modality:modalities[order.modality]||title)+' · '+escape(order.accessionNumber)+'</h4><p>'+escape(order.releasedAt?(language==='en'?'Verified result':'បានផ្ទៀងផ្ទាត់លទ្ធផល'):copy.pending)+'</p>'+[result.findings,result.conclusion,result.recommendation].filter(Boolean).map(value=>'<p>'+escape(value)+'</p>').join('')+
        (order.attachments||[]).map(file=>'<p><a target="_blank" rel="noopener" href="/api/paraclinic/attachments/'+encodeURIComponent(file.id)+'?history=1">'+escape(file.filename)+'</a></p>').join('')+'</article>';
    }).join('')+'</section>';
  }
  function labHtml(orders){
    const labs=orders.filter(order=>order.modality==='LAB');
    return '<section class="viewer-lab"><h3>លទ្ធផលមន្ទីរពិសោធន៍</h3>'+(labs.length?labs.map(order=>{
      const rows=Array.isArray(order.result?.items)?order.result.items:[];
      return '<h4>'+escape(order.accessionNumber)+'</h4><p class="'+(order.releasedAt?'':'viewer-draft')+'">'+(order.releasedAt?'បានផ្ទៀងផ្ទាត់លទ្ធផល':'មិនទាន់ផ្ទៀងផ្ទាត់លទ្ធផល')+'</p>'+
        (rows.length?'<table><thead><tr><th>តេស្ត</th><th>លទ្ធផល</th><th>ឯកតា</th><th>តម្លៃយោង</th></tr></thead><tbody>'+rows.map(item=>'<tr><td>'+escape(item.name||item.testName||item.code)+'</td><td>'+escape(item.value)+'</td><td>'+escape(item.unit)+'</td><td>'+escape(item.reference||item.referenceRange||'')+'</td></tr>').join('')+'</tbody></table>':'<p>មិនទាន់មានលទ្ធផល។</p>');
    }).join(''):'<p>មិនមានលទ្ធផលមន្ទីរពិសោធន៍ក្នុងកំណត់ត្រានេះ។</p>')+'</section>';
  }
  function dailyHtml(entry){
    const rows=entry.resume?.evolution || readArray(entry.patient.data?.['system:dailyMonitoringRecords']);
    return rows.length?rows.map((row,index)=>'<article class="viewer-followup"><h3>ការតាមដានទី '+(index+1)+' · '+escape(date(row.date||row.dtVal))+'</h3><p>'+escape(row.vitals||[row.temp&&'កម្ដៅ '+row.temp,row.bp_sys&&'សម្ពាធឈាម '+row.bp_sys+'/'+row.bp_dia,row.pulse&&'ជីពចរ '+row.pulse].filter(Boolean).join(' · '))+'</p><p>'+escape(row.progress||row.evol||'')+'</p><p>'+escape(row.conclusion||'')+'</p><ul>'+readArray(row.medications).map(item=>'<li>'+escape(typeof item==='string'?item:item.name||item.medicineName||'')+'</li>').join('')+'</ul></article>').join(''):'<p>មិនទាន់មានកំណត់ត្រាតាមដានប្រចាំថ្ងៃ។</p>';
  }
  function resumeHtml(entry){
    const resume=entry.resume||{},admission=resume.admission||{},discharge=resume.discharge||{},treatment=resume.treatment||{};
    return '<h3>'+escape(entry.patient.fullName)+'</h3><p>លេខករណី៖ '+escape(entry.patient.caseNumber)+' · លេខបណ្ណសុខភាព៖ '+escape(entry.patient.healthId)+'</p>'+ 
      '<h3>ការចូលសម្រាកពេទ្យ</h3><p>កាលបរិច្ឆេទ៖ '+escape(date(admission.at||entry.patient.entryDate))+'</p><p>រោគវិនិច្ឆ័យ៖ '+escape(admission.diagnosis||'មិនទាន់បានកត់ត្រា')+'</p><p>រោគសញ្ញា៖ '+escape(admission.chiefComplaint||'មិនទាន់បានកត់ត្រា')+'</p>'+ 
      '<h3>ការព្យាបាល</h3><ul>'+readArray(treatment.all).map(item=>'<li>'+escape(item)+'</li>').join('')+'</ul>'+dailyHtml(entry)+
      '<h3>ការចេញពីពេទ្យ</h3><p>កាលបរិច្ឆេទ៖ '+escape(discharge.at||entry.patient.dischargeDate||'មិនទាន់ចេញពីពេទ្យ')+'</p><p>រោគវិនិច្ឆ័យចេញ៖ '+escape(discharge.diagnosis||'មិនទាន់បានកត់ត្រា')+'</p><p>ថ្ងៃណាត់ជួប៖ '+escape(discharge.followUpDate||'មិនទាន់បានកំណត់')+'</p>';
  }
  function snapshot(source){
    if(!source)return '<p>មិនទាន់មានទិន្នន័យក្នុងទម្រង់នេះ។</p>';
    const clone=source.cloneNode(true),originals=source.querySelectorAll('input,select,textarea');
    clone.querySelectorAll('input,select,textarea').forEach((control,index)=>{
      const original=originals[index];if(['hidden','file','button','submit'].includes(original.type)){control.remove();return;}
      const text=source.ownerDocument.createElement('span');text.className='viewer-field';
      text.textContent=['checkbox','radio'].includes(original.type)?(original.checked?'☑':'☐'):original.tagName==='SELECT'?[...original.selectedOptions].map(option=>option.textContent).join(', '):original.value;
      control.replaceWith(text);
    });
    clone.querySelectorAll('script,iframe,button,.action-bar,.emr-save-bar,.emr-save-button,.opd-module-toolbar').forEach(node=>node.remove());
    [clone,...clone.querySelectorAll('*')].forEach(node=>{
      for(const attr of [...node.attributes])if(attr.name.startsWith('on')||attr.name==='contenteditable')node.removeAttribute(attr.name);
      if(node.tagName==='IMG')node.src=node.src;
      if(node.tagName==='A'){node.removeAttribute('href');node.removeAttribute('target')}
    });
    clone.hidden=false;clone.style.display='block';clone.removeAttribute('aria-hidden');
    return clone.outerHTML;
  }
  function staticPage(doc,html){
    const styles=[...doc.querySelectorAll('style,link[rel=stylesheet]')].map(node=>{const copy=node.cloneNode(true);if(copy.tagName==='LINK')copy.href=node.href;return copy.outerHTML}).join('');
    return '<!doctype html><html lang="km"><head><meta charset="utf-8">'+styles+'<style>body{background:white!important;margin:0!important;padding:4px!important}.page,.sub-tab{display:block!important;padding:0!important;box-shadow:none!important}.viewer-field{display:inline-block;white-space:pre-wrap;min-width:16px;padding:2px 4px;color:#123b54}a,button{pointer-events:none}.action-bar,.emr-save-bar,.emr-save-button{display:none!important}</style></head><body>'+html+'</body></html>';
  }
  async function loadSource(entry,ticket){
    const frame=document.createElement('iframe');frame.className='viewer-report-source';frame.setAttribute('aria-hidden','true');frame.tabIndex=-1;
    const loaded=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(Error('ការផ្ទុកទម្រង់ចំណាយពេលយូរ។ សូមសាកល្បងម្តងទៀត។')),20000);
      frame.addEventListener('load',()=>{
        const check=()=>{if(ticket!==generation){clearTimeout(timer);reject(Error('cancelled'));return;}
          try{const patient=frame.contentWindow.getLoadedEmrPatient?.();if(patient?.patientKey===entry.patient.patientKey){clearTimeout(timer);resolve(frame);return;}}catch{}
          setTimeout(check,60);
        };check();
      },{once:true});
    });
    const view=scope==='triage'?'triage':kind==='opd'?'opd':'medical';
    frame.src='/emr?'+new URLSearchParams({patient:entry.patient.patientKey,view,mode:'view',recordPage:view});
    document.querySelectorAll('.viewer-report-source').forEach(item=>item.remove());document.body.append(frame);
    try{return await loaded}catch(error){frame.remove();throw error}
  }
  function matches(entry){return scope==='triage' || entry.patient.serviceMode===kind || kind==='opd'&&Boolean(entry.patient.data?.['system:opdEncounterAt']);}
  async function render(){
    const ticket=++generation,entry=encounters.find(item=>item.patient.patientKey===$('viewer-encounter').value);if(!entry)return;
    $('viewer-status').textContent='កំពុងរៀបចំកំណត់ត្រាសម្រាប់មើល…';$('viewer-document').replaceChildren();$('viewer-pages').replaceChildren();
    try{
      const frame=await loadSource(entry,ticket);if(ticket!==generation){frame.remove();return;}
      const doc=frame.contentDocument;
      const specs=kind==='ipd'?[['ព័ត៌មានចុះឈ្មោះ','page1'],['ព័ត៌មានទ្រីយ៉ា','page2'],['កំណត់ត្រាវេជ្ជសាស្ត្រ និងលទ្ធផលមន្ទីរពិសោធន៍','sub_ipd'],['ការតាមដានប្រចាំថ្ងៃ និងលទ្ធផលមន្ទីរពិសោធន៍','daily'],['ដំណើរការថែទាំ','sub_nursing'],['លិខិតចេញពីមន្ទីរពេទ្យ','emr-discharge-view'],['សង្ខេបករណីសម្រាកពេទ្យ','resume']]:[['កំណត់ត្រាពិគ្រោះក្រៅ និងលទ្ធផលមន្ទីរពិសោធន៍','sub_opd']];
      if(scope==='triage')specs.splice(0,specs.length,['ព័ត៌មានទ្រីយ៉ា','page2']);
      for(const [index,[title,id]] of specs.entries()){
        const page=document.createElement('section');page.className='viewer-page';page.id='record-page-'+(index+1);
        const heading=document.createElement('h2');heading.textContent='ទំព័រទី '+(index+1)+' · '+title;page.append(heading);
        if(id==='daily'||id==='resume'){const content=document.createElement('div');content.innerHTML=id==='daily'?dailyHtml(entry)+labHtml(entry.orders):resumeHtml(entry);page.append(content);}
        else{
          const paper=document.createElement('iframe');paper.title=title;paper.setAttribute('sandbox','allow-same-origin');
          paper.addEventListener('load',()=>{try{const resize=()=>{paper.style.height=Math.max(paper.contentDocument.documentElement.scrollHeight,paper.contentDocument.body.scrollHeight,500)+'px'};resize();paper.contentDocument.fonts?.ready.then(resize);new ResizeObserver(resize).observe(paper.contentDocument.body);}catch{}});
          paper.srcdoc=staticPage(doc,snapshot(doc.getElementById(id)));page.append(paper);
          if(id==='sub_ipd'||id==='sub_opd'){const labs=document.createElement('div');labs.innerHTML=labHtml(entry.orders)+imagingHtml(entry.orders);page.append(labs);}
        }
        $('viewer-document').append(page);
        const jump=document.createElement('button');jump.type='button';jump.textContent='ទំព័រទី '+(index+1);jump.onclick=()=>page.scrollIntoView({block:'start'});$('viewer-pages').append(jump);
      }
      frame.remove();$('viewer-status').textContent='មើលបានតែប៉ុណ្ណោះ។ កំណត់ត្រាពិនិត្យ៖ '+date(entry.patient.entryDate)+' · '+(entry.patient.caseNumber||'');
    }catch(error){if(ticket===generation)$('viewer-status').textContent=error.message;}
  }
  function choose(next,selected=key){kind=next;const options=encounters.filter(matches);$('viewer-encounter').replaceChildren(...options.map(entry=>new Option(date(entry.patient.entryDate)+' · '+(entry.patient.caseNumber||entry.patient.healthId),entry.patient.patientKey)));
    if(options.some(entry=>entry.patient.patientKey===selected))$('viewer-encounter').value=selected;
    document.querySelectorAll('[data-view-kind]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.viewKind===kind)));
    if(options.length)render();else{$('viewer-document').replaceChildren();$('viewer-pages').replaceChildren();$('viewer-status').textContent='មិនមានកំណត់ត្រាប្រភេទនេះសម្រាប់អ្នកជំងឺនេះទេ។'}
  }
  $('viewer-print').onclick=()=>window.print();$('viewer-encounter').onchange=render;
  document.querySelectorAll('[data-view-kind]').forEach(button=>button.onclick=()=>choose(button.dataset.viewKind));
  try{const response=await fetch('/api/record-viewer?'+new URLSearchParams({patientKey:key||''}),{cache:'no-store',credentials:'same-origin'});const result=await response.json();if(!response.ok)throw Error(result.error);encounters=result.encounters||[];scope=result.scope||'medical';
    document.querySelectorAll('[data-view-kind]').forEach(button=>{button.hidden=scope==='triage'});visitList();
    const initial=encounters.find(item=>item.patient.patientKey===key);choose(scope==='triage'?'triage':initial?.patient.serviceMode==='opd'?'opd':'ipd');}catch(error){$('viewer-status').textContent=error.message;}
})();
