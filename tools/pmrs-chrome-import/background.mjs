import {capturePatient} from './capture.mjs';
import {TTL, emrOrigin, permissionPattern, inspectEmr, deliverPatient} from './transport.mjs';

export function installBackground(api) {
  let running = false;
  const store = api.storage.session;
  const status = async code => {
    await store.set({status:code});
    const text=['DRAFT_FILLED','DRAFT_DUPLICATES'].includes(code)?'✓':['OPENING','DELIVERING','LOGIN_REQUIRED','CONTEXT_REQUIRED'].includes(code)?'…':['IDLE','CANCELLED'].includes(code)?'':'!';
    await api.action.setBadgeText({text});
  };
  const purge = async code => { await store.remove('pending'); await status(code); };
  const pending = async () => {
    const value = (await store.get('pending')).pending;
    if (value && Date.now() >= value.expiresAt) { await purge('EXPIRED'); return null; }
    return value;
  };
  async function resume(tabId) {
    if (running) return;
    running = true;
    try {
      const job = await pending();
      if (!job || job.tabId !== tabId) return;
      if (job.phase === 'delivering') { await purge('DELIVERY_UNCONFIRMED'); return; }
      const tab = await api.tabs.get(tabId);
      if (!tab.url || new URL(tab.url).origin !== job.origin) { await status('RETURN_TO_EMR'); return; }
      if (tab.status === 'loading') return;
      const [{result}] = await api.scripting.executeScript({target:{tabId},world:'MAIN',func:inspectEmr,args:[job.origin]});
      if (result.code !== 'READY') { await status(result.code); return; }
      const target = job.origin + '/emr?view=register&pmrsExtension=' + job.nonce;
      if (tab.url !== target) { await status('OPENING'); await api.tabs.update(tabId,{url:target}); return; }
      // Persist uncertainty BEFORE sending. Never automatically replay an
      // injection whose result was lost, even if the worker is restarted.
      await store.set({pending:{...job,phase:'delivering'},status:'DELIVERING'});
      let delivery;
      try {
        [{result:delivery}] = await api.scripting.executeScript({target:{tabId},world:'MAIN',func:deliverPatient,args:[job.origin,job.nonce,job.registration]});
      } catch { await purge('DELIVERY_UNCONFIRMED'); return; }
      await purge(delivery?.code || 'DELIVERY_UNCONFIRMED');
    } catch { await status('SERVER_UNAVAILABLE'); }
    finally { running = false; }
  }
  async function handle(message, sender) {
    if (sender.id !== api.runtime.id || sender.url !== api.runtime.getURL('popup.html')) return {code:'ACCESS_DENIED'};
    if (message.type === 'STATUS') { const job=await pending(); if(job?.phase==='delivering'&&!running)await purge('DELIVERY_UNCONFIRMED'); return {code:(await store.get('status')).status || 'IDLE',pending:!!(await pending())}; }
    if (message.type === 'CANCEL') { if(running)return {code:'BUSY'}; await purge('CANCELLED'); return {code:'CANCELLED'}; }
    if (message.type === 'RESUME') { const job=await pending(); if(job)await resume(job.tabId); return {code:(await store.get('status')).status || 'IDLE'}; }
    if (message.type !== 'CAPTURE') return {code:'INVALID_ACTION'};
    if (running || await pending()) return {code:'PENDING_EXISTS'};
    running=true;
    try {
      const origin=emrOrigin((await api.storage.local.get('origin')).origin || '');
      if (!await api.permissions.contains({origins:[permissionPattern(origin)]})) return {code:'PERMISSION_REQUIRED'};
      const [tab]=await api.tabs.query({active:true,currentWindow:true});
      if (!tab?.url || new URL(tab.url).origin !== 'https://pmrs.digitalsp.gov.kh') return {code:'PMRS_PAGE_REQUIRED'};
      const [{result:registration}]=await api.scripting.executeScript({target:{tabId:tab.id},func:capturePatient});
      if (!registration?.healthId || !registration?.caseNumber || !registration?.fullName) return {code:'PAGE_CHANGED'};
      const nonce=crypto.randomUUID();
      // New tab: never navigate away from or overwrite an existing EMR draft.
      const destination=await api.tabs.create({url:origin+'/emr?view=register&pmrsExtension='+nonce});
      await store.set({pending:{origin,nonce,registration,tabId:destination.id,expiresAt:Date.now()+TTL,phase:'waiting'},status:'OPENING'});
      return {code:'OPENING'};
    } catch { return {code:'CAPTURE_FAILED'}; }
    finally { running=false; const job=await pending(); if(job)await resume(job.tabId); }
  }
  api.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});
  api.runtime.onMessage.addListener((message,sender,respond)=>{handle(message,sender).then(respond,()=>respond({code:'TRANSFER_FAILED'}));return true;});
  api.tabs.onUpdated.addListener((tabId,change)=>{if(change.status==='complete')void resume(tabId);});
  api.tabs.onRemoved.addListener(tabId=>{void pending().then(job=>{if(job?.tabId===tabId)return purge('CANCELLED');});});
  api.alarms.create('expire-pmrs-import',{periodInMinutes:1});
  api.alarms.onAlarm.addListener(alarm=>{if(alarm.name==='expire-pmrs-import')void pending();});
  api.action.onClicked.addListener(()=>{
    void api.storage.local.get('origin').then(async settings=>{
      if(!settings.origin){await api.runtime.openOptionsPage();return;}
      const result=await handle({type:'CAPTURE'},{id:api.runtime.id,url:api.runtime.getURL('popup.html')});
      if(result.code!=='OPENING')await status(result.code);
    }).catch(()=>status('TRANSFER_FAILED'));
  });
  return {handle,resume};
}
if (globalThis.chrome?.runtime?.onMessage) installBackground(chrome);
