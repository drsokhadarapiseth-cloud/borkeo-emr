import {api,esc,safeError} from './network-ui.mjs';
export function connectionTable(container,{notice,onEdit,onTest,onChange}={}){
 let generation=0,working=false,stopped=false,checking=false;
 const tell=text=>{if(notice)notice.textContent=text};
 const stateLabel=state=>({PENDING:'កំពុងរង់ចាំការអនុម័ត',ACCEPTED:'បានអនុម័ត',REJECTED:'បានបដិសេធ',STALE:'សំណើផុតសុពលភាព'}[state]||'—');
 async function refresh(){
  const ticket=++generation;
  checking=true;
  try{
   const data=await api('/api/emr-network/table');if(stopped||ticket!==generation)return;
   container.innerHTML='<div class="network-actions"><button type="button" data-refresh-connections>ពិនិត្យស្ថានភាពឡើងវិញ</button></div><div class="network-scroll"><table class="network-connections-table"><caption>តារាងការតភ្ជាប់ API</caption><thead><tr><th scope="col">ល.រ</th><th scope="col">មូលដ្ឋានសុខាភិបាល</th><th scope="col">សោ API</th><th scope="col">ស្ថានភាព</th><th scope="col">សំណើតភ្ជាប់ API</th></tr></thead><tbody>'+data.peers.map((p,i)=>{
    const pending=data.requests.find(r=>r.peer_id===p.id&&r.direction==='OUT');
    return '<tr data-connection-id="'+esc(p.id)+'"><td>'+esc((i+1).toLocaleString('km-KH-u-nu-khmr'))+'</td><td>'+esc(p.name)+'</td><td><code>'+esc(p.keyHint)+'</code></td><td><span data-connection-state class="network-state" role="status">កំពុងពិនិត្យ</span><small data-connection-checked></small></td><td>'+(data.admin?'<button type="button" data-request-peer="'+esc(p.id)+'" '+(!p.enabled?'disabled':'')+'>ស្នើសុំតភ្ជាប់</button>'+(onEdit?' <button type="button" data-edit-peer="'+esc(p.id)+'">កែប្រែ</button>':'')+(onTest?' <button type="button" data-test-peer="'+esc(p.id)+'">សាកល្បងការតភ្ជាប់</button>':''):'—')+(pending?'<small data-request-state>'+stateLabel(pending.state)+'</small>':'')+'</td></tr>'
   }).join('')+'</tbody></table></div>'+(data.peers.length?'':'<p>មិនមានការតភ្ជាប់</p>')+
   (data.admin?'<section><h3>សំណើតភ្ជាប់ចូល</h3>'+data.requests.filter(r=>r.direction==='IN'&&r.state==='PENDING').map(r=>'<div class="network-incoming-request"><strong>'+esc(r.name)+'</strong> <span>'+esc(new Date(r.created_at).toLocaleString('km-KH'))+'</span><button type="button" data-decide-request="'+esc(r.id)+'" data-state="ACCEPTED">អនុម័ត</button><button type="button" data-decide-request="'+esc(r.id)+'" data-state="REJECTED">បដិសេធ</button></div>').join('')+'</section>':'');
   let next=0;await Promise.all(Array.from({length:Math.min(3,data.peers.length)},async()=>{while(next<data.peers.length&&ticket===generation){const peer=data.peers[next++];let result;try{result=await api('/api/emr-network/check',{peerId:peer.id})}catch{result={connected:false,checkedAt:Date.now()}}if(result.requestState==='ACCEPTED')await onChange?.();if(stopped||ticket!==generation)return;const row=[...container.querySelectorAll('[data-connection-id]')].find(n=>n.dataset.connectionId===peer.id);if(!row)continue;if(result.requestState&&row.querySelector('[data-request-state]'))row.querySelector('[data-request-state]').textContent=stateLabel(result.requestState);const label=row.querySelector('[data-connection-state]');label.textContent=result.connected?'បានតភ្ជាប់':'មិនបានតភ្ជាប់';label.classList.toggle('is-connected',result.connected);row.querySelector('[data-connection-checked]').textContent=new Date(result.checkedAt).toLocaleTimeString('km-KH-u-nu-khmr',{hour12:false});row.querySelector('[data-request-peer]')?.toggleAttribute('disabled',result.connected||!peer.enabled)}}));
  }catch(error){if(ticket!==generation)return;tell(safeError(error));container.querySelectorAll('[data-connection-state]').forEach(n=>{n.textContent='មិនបានតភ្ជាប់';n.classList.remove('is-connected')})}finally{if(ticket===generation)checking=false}
 }
 container.addEventListener('click',async event=>{
  if(working)return;const edit=event.target.closest('[data-edit-peer]'),test=event.target.closest('[data-test-peer]'),request=event.target.closest('[data-request-peer]'),decision=event.target.closest('[data-decide-request]');
  if(edit){onEdit?.(edit.dataset.editPeer);return}if(test){onTest?.(test.dataset.testPeer);return}if(event.target.closest('[data-refresh-connections]')){void refresh();return}if(!request&&!decision)return;
  working=true;const button=request||decision;button.disabled=true;try{if(request){await api('/api/emr-network/request',{peerId:request.dataset.requestPeer});tell('បានផ្ញើសំណើតភ្ជាប់')}else{await api('/api/emr-network/decide-request',{id:decision.dataset.decideRequest,state:decision.dataset.state});tell(stateLabel(decision.dataset.state))}await onChange?.();await refresh()}catch(error){tell(safeError(error))}finally{working=false;if(button.isConnected)button.disabled=false}
 });
 const timer=setInterval(()=>{if(!document.hidden&&!working&&!checking)void refresh()},30000);document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!working&&!stopped)void refresh()});window.addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);generation++},{once:true});
 return {refresh};
}
