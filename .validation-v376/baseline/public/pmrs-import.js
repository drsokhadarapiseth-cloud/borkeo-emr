(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const routeOptions = [
    ['','បញ្ជាក់ផ្លូវប្រើ...'],['po','លេប (PO)'],['other_iv','ចាក់តាមសរសៃ (IV)'],
    ['antibiotic_iv','អង់ទីប៊ីយ៉ូទិក IV'],['iv_fluid','សារធាតុរាវ IV'],
    ['other_im','ចាក់សាច់ដុំ (IM)'],['antibiotic_im','អង់ទីប៊ីយ៉ូទិក IM'],
    ['subcutaneous','ចាក់ក្រោមស្បែក (SC)'],['topical','លាប'],['drops','បន្តក់'],
    ['inhaled','ស្រូប'],['vaginal','តាមទ្វារមាស'],['rectal','តាមទ្វារធំ'],['sublingual','ក្រោមអណ្តាត'],
  ];
  const units = ['', 'គ្រាប់','កាប់ស៊ុល','អំពូល','ផ្លាកុង','ដប','ទីប','កញ្ចប់','ដំណក់','គ្រាប់សុល','បន្ទះ','បាញ់','ស្លាបព្រា','ម.ល','ម.ក្រ','ក្រាម','លីត្រ','UI','mEq','mmol','ឯកតា'];
  let csrf = '';
  let payload = null;
  let candidates = [];
  let busy = false;
  const visibleText = value => String(value ?? '').replace(/\s+/g,' ').trim();
  const norm = value => visibleText(value).replace(/[\s-]/g,'').toLowerCase();
  const status = (id,text,error=false) => { $(id).textContent=text;$(id).className=`status ${error?'error':'success'}`; };
  const opt = (value,label) => { const element=document.createElement('option');element.value=value;element.textContent=label;return element; };
  function guessedRoute(text) {
    const value=visibleText(text).toLowerCase();
    if (/លេប|\bpo\b|oral/.test(value)) return 'po';
    if (/សរសៃ|\biv\b/.test(value)) return 'other_iv';
    if (/សាច់ដុំ|\bim\b/.test(value)) return 'other_im';
    if (/ក្រោមស្បែក|\bsc\b/.test(value)) return 'subcutaneous';
    if (/លាប/.test(value)) return 'topical';
    if (/បន្តក់/.test(value)) return 'drops';
    if (/ស្រូប/.test(value)) return 'inhaled';
    return '';
  }
  function guessedUnit(text) {
    const value=visibleText(text);
    return units.find(unit => unit && unit===value) || '';
  }
  function field(type,cls,value,aria) {
    const node=document.createElement('input');node.type=type;node.className=cls;node.value=String(value??'');node.setAttribute('aria-label',aria);
    if (type==='number') {node.min='0';node.max='99';node.step='0.5';}
    return node;
  }
  function drawRows() {
    const body=$('meds');body.replaceChildren();
    for (const med of payload.rows) {
      const tr=document.createElement('tr');tr.dataset.sourceRowIndex=med.sourceRowIndex;
      const append=child=>{const td=document.createElement('td');td.append(child);tr.append(td);return child;};
      const check=field('checkbox','selected','','ជ្រើសថ្នាំ');check.checked=true;append(check);
      append(field('text','medicine',med.name,'ឈ្មោះថ្នាំ'));
      const route=document.createElement('select');route.className='route';route.setAttribute('aria-label','ផ្លូវប្រើ EMR');
      route.append(...routeOptions.map(([id,label])=>opt(id,label)));route.value=guessedRoute(med.routeText);append(route);
      for (const key of ['m','a','e','n']) append(field('number',`dose ${key}`,med[key] || '0','ចំនួន '+key));
      const days=field('number','days',med.d || '1','ចំនួនថ្ងៃ');days.min='1';days.max='90';days.step='1';append(days);
      const unit=document.createElement('select');unit.className='unit';unit.setAttribute('aria-label','ឯកតា EMR');
      unit.append(...units.map(code=>opt(code,code||'ជ្រើសឯកតា...')));unit.value=guessedUnit(med.unitText);append(unit);
      const source=document.createElement('span');source.className='small';source.textContent=`${med.routeText||'—'} · ${med.unitText||'—'}`;append(source);
      body.append(tr);
    }
    $('save').disabled=false;
  }
  async function api(url,body) {
    const response=await fetch(url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify(body)});
    const data=await response.json();if (!response.ok) throw Error(data.error||'មិនអាចទាក់ទង EMR បាន។');return data;
  }
  async function getCandidates() {
    const data=await api('/api/pmrs2/import-candidates',{sourcePid:payload.sourcePid});
    candidates=data.patients||[];
    $('patient').replaceChildren(opt('','ជ្រើសអ្នកជំងឺ EMR...'));
    for (const patient of candidates) {
      $('patient').append(opt(patient.patientKey,
        `${patient.fullName} · ${patient.healthId} · ${patient.caseNumber||'—'} · ${patient.departmentNameKh||'—'} · ${patient.paymentStatus}`));
    }
    if (candidates.length===1) $('patient').value=candidates[0].patientKey;
    if (!candidates.length) status('patient-status','រកមិនឃើញលេខបណ្ណសុខភាពដូចគ្នាក្នុងផ្នែកដែលអ្នកមានសិទ្ធិ។ សូមពិនិត្យលេខទាំងពីរ។',true);
    else if (candidates.length===1 && !/^HEF_/.test(candidates[0].paymentStatus)) status('patient-status','អ្នកជំងឺនេះមិនទាន់បានកំណត់ថា HEF ក្នុងប្រភេទការបង់ប្រាក់ EMR។',true);
    else status('patient-status',`រកឃើញ ${candidates.length} កំណត់ត្រា។ សូមផ្ទៀងផ្ទាត់ឈ្មោះ និងករណីចូលពេទ្យ។`);
  }
  async function receive(data) {
    if (payload || !data || data.format!=='borkeo.pmrs2.medicines.v1' ||
        !Array.isArray(data.rows) || data.rows.length<1 || data.rows.length>60 ||
        !data.sourcePid || !data.sourceVisit) return;
    payload=data;
    $('source-meta').textContent=`លេខអ្នកជំងឺ PMRS2៖ ${data.sourcePid} · លេខការពិនិត្យ៖ ${data.sourceVisit} · ថ្នាំ ${data.rows.length} មុខ`;
    if (data.recordAt) $('record-at').value=data.recordAt;
    drawRows();
    try {await getCandidates();}catch(error){status('patient-status',error.message,true);}
  }
  function selectedRows() {
    const rows=[];
    for (const tr of $('meds').querySelectorAll('tr[data-source-row-index]')) {
      if (!tr.querySelector('.selected').checked) continue;
      const get=cls=>tr.querySelector('.'+cls)?.value ?? '';
      rows.push({sourceRowIndex:Number(tr.dataset.sourceRowIndex),name:visibleText(get('medicine')),
        route:get('route'),m:get('m'),a:get('a'),e:get('e'),n:get('n'),d:get('days'),unit:get('unit')});
    }
    return rows;
  }
  $('save').addEventListener('click',async()=>{
    if (!payload || busy) return;
    const patient=candidates.find(item=>item.patientKey===$('patient').value);
    if (!patient) return status('status','ជ្រើសអ្នកជំងឺ EMR ជាមុន។',true);
    if (norm(patient.healthId)!==norm(payload.sourcePid)) return status('status','លេខបណ្ណសុខភាពមិនដូចគ្នា។',true);
    if (!/^HEF_/.test(patient.paymentStatus)) return status('status','អ្នកជំងឺនេះមិនមែនប្រភេទ HEF ក្នុង EMR ទេ។',true);
    if (!$('reviewed').checked) return status('status','សូមពិនិត្យទិន្នន័យ និងធីកប្រអប់ផ្ទៀងផ្ទាត់។',true);
    const rows=selectedRows();
    if (!rows.length) return status('status','ជ្រើសថ្នាំយ៉ាងតិចមួយមុខ។',true);
    const recordAt=$('record-at').value;
    if (!recordAt) return status('status','សូមបញ្ចូលថ្ងៃ និងម៉ោងពី PMRS2។',true);
    const target=$('target').value;
    if ((target==='opd') !== (patient.serviceMode==='opd')) return status('status','ទម្រង់ថ្នាំមិនត្រូវនឹងប្រភេទ OPD/IPD អ្នកជំងឺ។',true);
    busy=true;$('save').disabled=true;
    try {
      const result=await api('/api/pmrs2/import-medicines',{
        patientKey:patient.patientKey,reviewedVersion:patient.version,sourcePid:payload.sourcePid,
        sourceVisit:payload.sourceVisit,recordAt,target,medications:rows,reviewed:true,
      });
      status('status',`បានរក្សាទុកថ្នាំ ${result.added} មុខក្នុង EMR។ ថ្នាំដែលធ្លាប់ផ្ទេរ៖ ${result.skipped} មុខ។ បើកកំណត់ត្រាអ្នកជំងឺដើម្បីមើល/កែ។`);
      window.postMessage({type:'BORKEO_PMRS_IMPORT_DONE_V1'},location.origin);
      patient.version=result.patientVersion;
    } catch(error) {status('status',error.message,true);$('save').disabled=false;}finally {busy=false;}
  });
  window.addEventListener('message',event=>{
    if (event.source!==window || event.origin!==location.origin ||
        event.data?.type!=='BORKEO_PMRS_IMPORT_PAYLOAD_V1') return;
    receive(event.data.payload);
  });
  async function start() {
    try {
      const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
      if (!response.ok) {status('status','ចូលគណនី EMR ជាមុន។',true);return;}
      const result=await response.json();csrf=result.csrfToken;
      if (!['DOCTOR','ADMIN','VICE_DIRECTOR'].includes(result.user?.activeRole)) {
        status('status','សូមជ្រើសសិទ្ធិវេជ្ជបណ្ឌិត ឬអ្នកគ្រប់គ្រងក្នុងគណនី EMR។',true);return;
      }
      window.postMessage({type:'BORKEO_PMRS_IMPORT_REQUEST_V1'},location.origin);
    } catch {status('status','មិនអាចបើកទំព័រផ្ទេរថ្នាំបាន។',true);}
  }
  start();
})();
