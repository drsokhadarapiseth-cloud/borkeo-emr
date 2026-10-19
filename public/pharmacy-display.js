'use strict';
(function(){
  const $=id=>document.getElementById(id);
  const esc=value=>String(value??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const localTime=value=>value?new Date(value).toLocaleTimeString('km-KH',{hour:'2-digit',minute:'2-digit'}):'';
  function renderList(target,items,kind){
    const visible=(items||[]).slice(0,8);
    target.innerHTML=visible.map((item,index)=>`<li><strong class="display-number">${kind==='OPD'?(item.queueNumber||index+1):(item.registrationQueueNumber||item.queueNumber||index+1)}</strong><span class="display-patient">${esc(item.fullName||item.patient?.fullName||'អ្នកជំងឺ')}<small>${esc(item.healthId||item.patient?.healthId||item.caseNumber||item.patient?.caseNumber||'')}</small></span><span class="display-status">កំពុងរង់ចាំទទួលថ្នាំ</span></li>`).join('');
    if(!visible.length)target.innerHTML='<li class="display-empty">មិនមានអ្នកជំងឺរង់ចាំទេ</li>';
  }
  async function load(){
    try{
      const response=await fetch('/api/pharmacy/dispensing-board',{credentials:'same-origin',cache:'no-store'});
      const data=await response.json();if(!response.ok)throw new Error(data.error||'មិនអាចទាញបញ្ជីបាន');
      renderList($('opd-dispensing-rows'),data.opd,'OPD');renderList($('ipd-dispensing-rows'),data.ipd,'IPD');
      $('display-updated').textContent=`បានធ្វើបច្ចុប្បន្នភាព ${localTime(data.updatedAt)}`;
    }catch(error){$('display-updated').textContent=error.message;}
  }
  function tick(){$('display-clock').textContent=new Date().toLocaleTimeString('km-KH',{hour:'2-digit',minute:'2-digit',second:'2-digit'});}
  tick();load();setInterval(tick,1000);setInterval(load,5000);
})();
