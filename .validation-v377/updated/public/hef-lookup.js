(function(){
  'use strict';
  const byId=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const en=()=>typeof window!=='undefined'&&window.getBorkeoLanguage?.()==='en';
  const txt=(kh,eng)=>en()?eng:kh;
  const cardValue=()=>String(byId('web_equity')?.value||'').replace(/[០-៩]/g,c=>String(c.charCodeAt(0)-0x17e0)).trim();
  let generation=0,controller,timer,dialog,result,context,changes=[],initialized=false;
  const allowed=()=>['REGISTRATION','ADMIN','VICE_DIRECTOR'].includes(window.emrSession?.user?.activeRole)&&!byId('web_equity')?.disabled&&!byId('web_equity')?.readOnly;
  function message(textKh,textEn){
    const node=byId('hef_lookup_status');
    if(!node)return;
    node.textContent=textEn!==undefined?txt(textKh,textEn):textKh;
  }
  function sexValue(){return document.querySelector('input[name="sex_radio"]:checked')?.value||'';}
  function current(id){return id==='sex'?sexValue():byId(id)?.value||'';}
  function currentContext(){return context&&context.generation===generation&&context.card===cardValue()&&allowed();}
  function formatHefDate(isoDate){
    if(!isoDate)return '—';
    const parts=String(isoDate).split('-');
    if(parts.length!==3)return String(isoDate);
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  function relationLabel(rel){
    const r=String(rel||'').trim().toUpperCase();
    if(r==='HEAD'||r==='មេគ្រួសារ')return txt('មេគ្រួសារ','Head of household');
    if(r==='SPOUSE'||r==='WIFE'||r==='HUSBAND'||r==='ប្តី'||r==='ប្រពន្ធ'||r==='ប្ដី ឬប្រពន្ធ')return txt('ប្ដី ឬប្រពន្ធ','Spouse');
    if(r==='CHILD'||r==='SON'||r==='DAUGHTER'||r==='កូន')return txt('កូន','Child');
    if(r==='PARENT'||r==='FATHER'||r==='MOTHER'||r==='ឪពុក'||r==='ម្តាយ')return txt('ឪពុកម្តាយ','Parent');
    if(r==='GRANDCHILD'||r==='ចៅ')return txt('ចៅ','Grandchild');
    return rel||'—';
  }
  function sexLabel(s){
    if(!s)return '—';
    const lower=String(s).toLowerCase();
    if(lower==='male'||lower==='m'||s==='ប្រុស')return txt('ប្រុស','Male');
    if(lower==='female'||lower==='f'||s==='ស្រី')return txt('ស្រី','Female');
    return s;
  }
  function povertyStatusLabel(status){
    const s=String(status||'').trim().toUpperCase();
    if(s==='POOR_1'||s==='1'||s==='ក្រ១'||s==='ក្រកម្រិត១')return txt('ក្រកម្រិត១','Level 1 / Very Poor');
    if(s==='POOR_2'||s==='2'||s==='ក្រ២'||s==='ក្រកម្រិត២')return txt('ក្រកម្រិត២','Level 2 / Poor');
    if(s==='NEAR_POOR'||s==='NEAR POOR'||s==='ងាយរងហានិភ័យ')return txt('ងាយរងហានិភ័យ','Near-Poor');
    if(s==='NOT_POOR'||s==='NOT POOR'||s==='មិនក្រ'||s==='មិនក្រីក្រ')return txt('មិនក្រីក្រ','Not Poor');
    return status||'—';
  }
  function fieldChanges(member){
    const t=typeof txt==='function'?txt:(k,e)=>k;
    return [['web_equity',t('លេខប័ណ្ណ','Card number'),result.card.number],['web_last_name',t('នាមត្រកូល','Surname'),member.lastName],['web_first_name',t('នាម','Given name'),member.firstName],['web_dob',t('ថ្ងៃកំណើត','Birth date'),member.dateOfBirth],['sex',t('ភេទ','Sex'),member.sex]]
      .filter(x=>x[2]).map(([id,label,value])=>({id,label,value,before:current(id)}));
  }
  function preview(){
    const member=result?.members?.find(m=>m.id===byId('hef_member')?.value);
    if(!member){if(byId('hef_changes'))byId('hef_changes').innerHTML='';if(byId('hef_apply'))byId('hef_apply').disabled=true;return;}
    changes=fieldChanges(member);
    byId('hef_changes').innerHTML=changes.map((c,i)=>`<tr><td>${esc(c.label)}</td><td>${esc(c.before||'—')}</td><td>${esc(c.value)}</td><td><input type="checkbox" data-emr-transient data-hef-field="${i}" ${!c.before||c.before===c.value?'checked':''}></td></tr>`).join('');
    byId('hef_apply').disabled=false;
  }
  function renderBanner(data){
    const banner=byId('hef_banner');
    if(!banner)return;
    if(data.card.disqualified){
      banner.className='hef-banner hef-banner-danger';
      banner.innerHTML=`<span class="hef-banner-icon">✖</span> <span class="hef-banner-text">${txt('ប័ណ្ណត្រូវបានដកសិទ្ធិ','Card Disqualified')}</span>`;
    }else if(data.card.valid===true){
      banner.className='hef-banner hef-banner-success';
      banner.innerHTML=`<span class="hef-banner-icon">✔</span> <span class="hef-banner-text">${txt('ប័ណ្ណត្រឹមត្រូវ','Valid Card')}</span>`;
    }else if(data.card.valid===false){
      banner.className='hef-banner hef-banner-danger';
      banner.innerHTML=`<span class="hef-banner-icon">✖</span> <span class="hef-banner-text">${txt('ប័ណ្ណមិនត្រឹមត្រូវ','Invalid Card')}</span>`;
    }else{
      banner.className='hef-banner hef-banner-warning';
      banner.innerHTML=`<span class="hef-banner-icon">!</span> <span class="hef-banner-text">${txt('ប័ណ្ណមិនច្បាស់លាស់','Card Status Unknown')}</span>`;
    }
  }
  function selectMember(id){
    if(byId('hef_member'))byId('hef_member').value=id;
    const cards=dialog?.querySelectorAll('.hef-member-card');
    cards?.forEach(c=>{
      const isSel=c.dataset.memberId===id;
      c.classList.toggle('selected',isSel);
      const mark=c.querySelector('.hef-member-radio-check');
      if(mark)mark.textContent=isSel?'✔':'';
    });
    const rev=byId('hef_review_section');
    if(rev)rev.style.display=id?'block':'none';
    preview();
  }
  function renderMemberCards(data){
    const container=byId('hef_member_cards');
    if(!container)return;
    const currentVal=byId('hef_member')?.value;
    container.innerHTML=(data.members||[]).map(m=>{
      const isSel=m.id===currentVal;
      return `<div class="hef-member-card ${isSel?'selected':''}" data-member-id="${esc(m.id)}" role="button" tabindex="0">
        <div class="hef-member-avatar" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
        </div>
        <div class="hef-member-content">
          <div class="hef-member-primary">
            <span class="hef-m-item"><strong class="hef-k">${txt('ឈ្មោះ:','Name:')}</strong> <span class="hef-v">${esc(m.fullName)}</span></span>
            <span class="hef-sep">|</span>
            <span class="hef-m-item"><strong class="hef-k">${txt('ភេទ:','Sex:')}</strong> <span class="hef-v">${esc(sexLabel(m.sex))}</span></span>
            <span class="hef-sep">|</span>
            <span class="hef-m-item"><strong class="hef-k">${txt('ថ្ងៃខែឆ្នាំកំណើត:','DOB:')}</strong> <span class="hef-v">${formatHefDate(m.dateOfBirth)}</span></span>
          </div>
          <div class="hef-member-secondary">
            <span class="hef-m-item"><strong class="hef-k">${txt('ទំនាក់ទំនងនឹងមេគ្រួសារ:','Relation to head:')}</strong> <span class="hef-v">${esc(relationLabel(m.relation))}</span></span>
          </div>
        </div>
        <div class="hef-member-radio-check" aria-hidden="true">${isSel?'✔':''}</div>
      </div>`;
    }).join('');
    container.querySelectorAll('.hef-member-card').forEach(card=>{
      card.addEventListener('click',()=>selectMember(card.dataset.memberId));
      card.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();selectMember(card.dataset.memberId);}});
    });
  }
  function updateLanguage(){
    if(!dialog)return;
    const setT=(id,kh,e)=>{const n=byId(id);if(n)n.textContent=txt(kh,e);};
    setT('hef_title','ផ្ទៀងផ្ទាត់ប័ណ្ណសមធម៌','Verify Equity Card');
    setT('hef_col_card_title','ព័ត៌មាននៃប័ណ្ណ','Card Information');
    setT('hef_lbl_card_no','លេខប័ណ្ណសមធម៌:','Equity Card No.:');
    setT('hef_lbl_valid_until','សុពលភាពប័ណ្ណ:','Card Validity:');
    setT('hef_col_addr_title','ទីលំនៅបច្ចុប្បន្ន','Current Residence');
    setT('hef_lbl_village','ភូមិ:','Village:');
    setT('hef_lbl_commune','ឃុំ សង្កាត់:','Commune:');
    setT('hef_lbl_district','ក្រុង ស្រុក ខណ្ឌ:','District:');
    setT('hef_lbl_province','រាជធានីខេត្ត:','Province:');
    setT('hef_col_other_title','ផ្សេងៗ','Other');
    setT('hef_lbl_geo_code','កូដភូមិសាស្ត្រ:','Geographic Code:');
    setT('hef_lbl_poverty','ស្ថានភាពក្រីក្រ:','Poverty Status:');
    setT('hef_lbl_hh_code','លេខកូដគ្រួសារ:','Household Code:');
    setT('hef_lbl_rep','ចំណាំ:','Note:');
    setT('hef_members_heading','ព័ត៌មានសមាជិកគ្រួសារ','Household Member Information');
    setT('hef_review_heading','ពិនិត្យទិន្នន័យមុនបញ្ចូល','Review Fields Before Import');
    setT('hef_th_field','ព័ត៌មាន','Field');
    setT('hef_th_curr','បច្ចុប្បន្ន','Current');
    setT('hef_th_import','បញ្ចូល','Import');
    setT('hef_lbl_import_address','បញ្ចូលអាសយដ្ឋាន','Import address');
    setT('hef_apply','បញ្ចូលក្នុងទម្រង់','Fill form');
    setT('hef_cancel','បោះបង់','Cancel');
    const btn=byId('hef_lookup_button');if(btn)btn.textContent=txt('ផ្ទៀងផ្ទាត់','Verify');
    if(result){
      renderBanner(result);
      if(byId('hef_val_poverty'))byId('hef_val_poverty').textContent=povertyStatusLabel(result.card.povertyStatus);
      renderMemberCards(result);
      preview();
    }
  }
  function ensureDialog(){
    if(dialog)return dialog;
    dialog=document.createElement('dialog');dialog.className='hef-dialog';dialog.dataset.languageExclude='1';
    dialog.setAttribute('aria-labelledby','hef_title');
    dialog.innerHTML=`
      <div class="hef-dialog-header">
        <h2 id="hef_title">${txt('ផ្ទៀងផ្ទាត់ប័ណ្ណសមធម៌','Verify Equity Card')}</h2>
        <button type="button" class="hef-dialog-close" id="hef_close_x" aria-label="Close">✕</button>
      </div>
      <div id="hef_banner" class="hef-banner"></div>
      <div class="hef-summary-card">
        <div class="hef-summary-grid">
          <div class="hef-summary-col">
            <h4 class="hef-col-title" id="hef_col_card_title">${txt('ព័ត៌មាននៃប័ណ្ណ','Card Information')}</h4>
            <div class="hef-info-row"><span class="hef-k" id="hef_lbl_card_no">${txt('លេខប័ណ្ណសមធម៌:','Equity Card No.:')}</span> <span class="hef-v" id="hef_val_card_no"></span></div>
            <div class="hef-info-row"><span class="hef-k" id="hef_lbl_valid_until">${txt('សុពលភាពប័ណ្ណ:','Card Validity:')}</span> <span class="hef-v" id="hef_val_valid_until"></span></div>
          </div>
          <div class="hef-summary-col">
            <h4 class="hef-col-title" id="hef_col_addr_title">${txt('ទីលំនៅបច្ចុប្បន្ន','Current Residence')}</h4>
            <div class="hef-info-row"><span class="hef-k" id="hef_lbl_village">${txt('ភូមិ:','Village:')}</span> <span class="hef-v" id="hef_val_village"></span></div>
            <div class="hef-info-row"><span class="hef-k" id="hef_lbl_commune">${txt('ឃុំ សង្កាត់:','Commune:')}</span> <span class="hef-v" id="hef_val_commune"></span></div>
            <div class="hef-info-row"><span class="hef-k" id="hef_lbl_district">${txt('ក្រុង ស្រុក ខណ្ឌ:','District:')}</span> <span class="hef-v" id="hef_val_district"></span></div>
            <div class="hef-info-row"><span class="hef-k" id="hef_lbl_province">${txt('រាជធានីខេត្ត:','Province:')}</span> <span class="hef-v" id="hef_val_province"></span></div>
          </div>
          <div class="hef-summary-col">
            <h4 class="hef-col-title" id="hef_col_other_title">${txt('ផ្សេងៗ','Other')}</h4>
            <div class="hef-info-row"><span class="hef-k" id="hef_lbl_geo_code">${txt('កូដភូមិសាស្ត្រ:','Geographic Code:')}</span> <span class="hef-v" id="hef_val_geo_code"></span></div>
            <div class="hef-info-row"><span class="hef-k" id="hef_lbl_poverty">${txt('ស្ថានភាពក្រីក្រ:','Poverty Status:')}</span> <span class="hef-v" id="hef_val_poverty"></span></div>
            <div class="hef-info-row"><span class="hef-k" id="hef_lbl_hh_code">${txt('លេខកូដគ្រួសារ:','Household Code:')}</span> <span class="hef-v" id="hef_val_hh_code"></span></div>
            <div class="hef-info-row" id="hef_row_replacement" style="display:none;"><span class="hef-k" id="hef_lbl_rep">${txt('ចំណាំ:','Note:')}</span> <span class="hef-v" id="hef_val_rep"></span></div>
          </div>
        </div>
      </div>
      <p id="hef_card_info" style="display:none;"></p>
      <div class="hef-members-section">
        <h4 class="hef-section-title" id="hef_members_heading">${txt('ព័ត៌មានសមាជិកគ្រួសារ','Household Member Information')}</h4>
        <div id="hef_member_cards" class="hef-member-cards-list"></div>
        <select id="hef_member" data-emr-transient style="display:none;"></select>
      </div>
      <div id="hef_review_section" class="hef-review-section">
        <h4 class="hef-sub-title" id="hef_review_heading">${txt('ពិនិត្យទិន្នន័យមុនបញ្ចូល','Review Fields Before Import')}</h4>
        <div class="hef-table-wrap">
          <table>
            <thead>
              <tr>
                <th id="hef_th_field">${txt('ព័ត៌មាន','Field')}</th>
                <th id="hef_th_curr">${txt('បច្ចុប្បន្ន','Current')}</th>
                <th>IDPoor</th>
                <th id="hef_th_import">${txt('បញ្ចូល','Import')}</th>
              </tr>
            </thead>
            <tbody id="hef_changes"></tbody>
          </table>
        </div>
        <label class="hef-address-choice">
          <input id="hef_import_address" type="checkbox" data-emr-transient>
          <span id="hef_lbl_import_address">${txt('បញ្ចូលអាសយដ្ឋាន','Import address')}</span>
        </label>
        <p id="hef_address_preview" class="hef-address-preview"></p>
      </div>
      <p id="hef_dialog_status" role="status" class="hef-dialog-status"></p>
      <div class="hef-actions">
        <button id="hef_apply" type="button" class="btn-green">${txt('បញ្ចូលក្នុងទម្រង់','Fill form')}</button>
        <button id="hef_cancel" type="button" class="btn-grey">${txt('បោះបង់','Cancel')}</button>
      </div>`;
    document.body.appendChild(dialog);
    byId('hef_member').addEventListener('change',preview);
    byId('hef_cancel').addEventListener('click',()=>dialog.close());
    const closeX=byId('hef_close_x');if(closeX)closeX.addEventListener('click',()=>dialog.close());
    byId('hef_apply').addEventListener('click',apply);
    return dialog;
  }
  async function verify(){
    if(!allowed()){message('មិនអាចផ្ទៀងផ្ទាត់ក្នុងសិទ្ធិនេះ','Registration access required.');return;}
    const card=cardValue();if(!/^\d{10}$/.test(card)){message('សូមបញ្ចូលលេខបណ្ណ ១០ ខ្ទង់','Enter a 10-digit card number.');return;}
    controller?.abort();controller=new AbortController();const token=++generation,ownController=controller;
    context={generation:token,card};message('កំពុងផ្ទៀងផ្ទាត់…','Verifying…');
    try{
      let csrf=window.emrSession?.csrfToken;
      if(!csrf){const me=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});if(!me.ok)throw Error(txt('សូមចូលគណនីឡើងវិញ','Please sign in again.'));csrf=(await me.json()).csrfToken;}
      const response=await fetch('/api/hef/lookup',{method:'POST',credentials:'same-origin',signal:ownController.signal,headers:{'Content-Type':'application/json','X-CSRF-Token':csrf},body:JSON.stringify({cardNumber:card})});
      const data=await response.json();if(!response.ok)throw Error(data.error||txt('ការផ្ទៀងផ្ទាត់បរាជ័យ','Verification failed.'));
      if(token!==generation||card!==cardValue()||!allowed())return;
      if(!data.found){message('មិនមានបណ្ណសម្រាប់លេខនេះ','No card found.');return;}
      result=data;const modal=ensureDialog();
      if(byId('hef_card_info'))byId('hef_card_info').textContent=`Card: ${data.card.number} | Status: ${data.card.disqualified?'DISQUALIFIED':data.card.valid===true?'VALID':data.card.valid===false?'NOT VALID':'UNKNOWN'} | Valid until: ${data.card.validUntil||'—'} | Poverty category: ${data.card.povertyStatus||'—'} | Household: ${data.card.householdCode||'—'}${data.card.redirected?' | IDPoor returned a replacement card.':''}`;
      if(byId('hef_val_card_no'))byId('hef_val_card_no').textContent=data.card.number;
      if(byId('hef_val_valid_until'))byId('hef_val_valid_until').textContent=formatHefDate(data.card.validUntil);
      const address=data.address||{};
      if(byId('hef_val_village'))byId('hef_val_village').textContent=address.village||'—';
      if(byId('hef_val_commune'))byId('hef_val_commune').textContent=address.commune||'—';
      if(byId('hef_val_district'))byId('hef_val_district').textContent=address.district||'—';
      if(byId('hef_val_province'))byId('hef_val_province').textContent=address.province||'—';
      if(byId('hef_val_geo_code'))byId('hef_val_geo_code').textContent=data.card.villageCode||address.villageCode||'—';
      if(byId('hef_val_poverty'))byId('hef_val_poverty').textContent=povertyStatusLabel(data.card.povertyStatus);
      if(byId('hef_val_hh_code'))byId('hef_val_hh_code').textContent=data.card.householdCode||'—';
      if(byId('hef_row_replacement')){
        byId('hef_row_replacement').style.display=data.card.redirected?'flex':'none';
        if(byId('hef_val_rep'))byId('hef_val_rep').textContent=txt('IDPoor បានប្តូរប័ណ្ណថ្មីជំនួស','IDPoor returned a replacement card');
      }
      if(typeof renderBanner==='function')renderBanner(data);
      if(byId('hef_member')){
        byId('hef_member').innerHTML='<option value="">'+txt('ជ្រើសរើសអ្នកជំងឺ','Select patient')+'</option>'+data.members.map(m=>`<option value="${esc(m.id)}">${esc(m.fullName)} — ${esc(sexLabel(m.sex))} — ${esc(formatHefDate(m.dateOfBirth))}</option>`).join('');
      }
      if(typeof renderMemberCards==='function')renderMemberCards(data);
      if(byId('hef_address_preview')){
        byId('hef_address_preview').textContent='IDPoor: '+['village','commune','district','province'].map(k=>address[k]).filter(Boolean).join(', ')+(address.canImport?'':(' — '+txt('អាសយដ្ឋានត្រូវការបញ្ចូលដោយដៃ','Address requires manual review.')));
        byId('hef_address_preview').textContent+=' | '+txt('បច្ចុប្បន្ន:','Current:')+' '+['village','commune','district','province'].map(k=>current('web_'+k)).filter(Boolean).join(', ');
      }
      const addressEmpty=['province','district','commune','village'].every(k=>!current('web_'+k)&&!current('web_'+k+'_code'));
      const addressMatches=['province','district','commune','village'].every(k=>current('web_'+k+'_code')===address[k+'Code']);
      if(byId('hef_import_address')){
        byId('hef_import_address').checked=Boolean(address.canImport)&&(addressEmpty||addressMatches);
        byId('hef_import_address').disabled=!address.canImport;
      }
      if(byId('hef_dialog_status')){
        byId('hef_dialog_status').textContent=data.members.length?'':txt('មិនមានព័ត៌មានសមាជិកគ្រួសារឡើយ','No household-member information was returned.');
      }
      if(data.members.length===1){
        selectMember(data.members[0].id);
      }else{
        if(byId('hef_review_section'))byId('hef_review_section').style.display='none';
        preview();
      }
      modal.showModal();message('បានទទួលព័ត៌មាន។ សូមជ្រើសរើសអ្នកជំងឺ','Information received; select the patient.');
    }catch(error){if(token===generation&&error.name!=='AbortError')message(txt('មិនអាចផ្ទៀងផ្ទាត់: ','Cannot verify: ')+error.message);}
  }
  async function apply(){
    if(!currentContext()){dialog.close();message('ព័ត៌មានអ្នកជំងឺ ឬលេខបណ្ណបានផ្លាស់ប្តូរ','Patient or card changed; verify again.');return;}
    const member=result.members.find(m=>m.id===byId('hef_member').value);if(!member)return;
    const chosen=[...dialog.querySelectorAll('[data-hef-field]:checked')].map(c=>changes[Number(c.dataset.hefField)]);
    if(chosen.some(c=>current(c.id)!==c.before)){preview();byId('hef_dialog_status').textContent=txt('ទម្រង់បានផ្លាស់ប្តូរ សូមពិនិត្យឡើងវិញ','Form changed. Review the differences again.');return;}
    const ownContext=context;byId('hef_apply').disabled=true;
    try{
      const addressSelected=byId('hef_import_address').checked;
      const addressSnapshot=['province','district','commune','village'].flatMap(k=>['web_'+k,'web_'+k+'_code']).map(id=>[id,current(id)]);
      const addressUnchanged=()=>addressSnapshot.every(([id,value])=>current(id)===value);
      if(addressSelected){
        if(typeof window.applyVerifiedHefAddress!=='function')throw Error(txt('ប្រព័ន្ធអាសយដ្ឋានមិនទាន់រួចរាល់ សូមព្យាយាមម្តងទៀត ឬដោះធីកបញ្ចូលអាសយដ្ឋាន','Address module is not ready. Retry, or uncheck Import address.'));
        await window.applyVerifiedHefAddress(result.address,()=>context===ownContext&&currentContext()&&addressUnchanged()&&chosen.every(c=>current(c.id)===c.before));
      }
      if(context!==ownContext||!currentContext())return;
      for(const change of chosen){
        if(change.id==='sex'){
          const node=byId(change.value==='ប្រុស'?'web_sex_male':'web_sex_female');if(node&&!node.disabled){node.checked=true;node.dispatchEvent(new Event('change',{bubbles:true}));}
        }else{
          const node=byId(change.id);if(node&&!node.disabled&&!node.readOnly){node.value=change.value;node.dispatchEvent(new Event('input',{bubbles:true}));node.dispatchEvent(new Event('change',{bubbles:true}));}
        }
      }
      if(chosen.some(c=>c.id==='web_dob'))window.calculateAgeFromDOB?.();window.syncFields?.();
      const metadata=byId('web_hef_verification');
      if(metadata){metadata.value=JSON.stringify({source:result.source,verifiedAt:result.verifiedAt,requestedCard:result.requestedCard,card:result.card,selectedMemberId:member.id,importedFields:chosen.map(c=>c.id),addressImported:addressSelected});metadata.dispatchEvent(new Event('input',{bubbles:true}));}
      dialog.close();message('បានបញ្ចូលក្នុងទម្រង់។ សូមពិនិត្យ និងរក្សាទុក','Form filled. Review and save using the existing registration button.');
    }catch(error){byId('hef_dialog_status').textContent=error.message;}
    finally{byId('hef_apply').disabled=false;}
  }
  function invalidate(){generation++;controller?.abort();clearTimeout(timer);context=null;result=null;if(dialog?.open)dialog.close();message('');}
  function init(){
    if(initialized||!byId('web_equity')||!byId('hef_lookup_button'))return;initialized=true;
    byId('hef_lookup_button').textContent=txt('ផ្ទៀងផ្ទាត់','Verify');
    byId('hef_lookup_button').addEventListener('click',verify);
    byId('web_equity').addEventListener('input',event=>{
      if(!event.isTrusted)return;
      invalidate();const metadata=byId('web_hef_verification');if(metadata)metadata.value='';
      if(/^\d{10}$/.test(cardValue())&&allowed())timer=setTimeout(verify,650);
    });
    byId('web_equity').addEventListener('keydown',event=>{if(event.key==='Enter'&&!event.isComposing){event.preventDefault();clearTimeout(timer);void verify();}});
    document.addEventListener('emr:patient-loaded',invalidate);
    window.addEventListener('emr-session-ready',()=>{byId('hef_lookup_button').disabled=!allowed();});
    window.addEventListener('borkeo-language-change',updateLanguage);
  }
  window.addEventListener('DOMContentLoaded',init);if(document.readyState!=='loading')init();
})();
