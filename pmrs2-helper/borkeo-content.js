// Direct DOM-event handshake: no injected script tag, no cross-origin window access.
(function () {
  'use strict';
  const send = data => new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(data, reply => chrome.runtime.lastError ? reject(Error('extension')) : resolve(reply));
  });
  (async () => {
    const pending = await send({type:'pmrs2-pending'});
    if (!pending?.ok) return;
    const root = document.documentElement;
    const status = document.createElement('p');
    status.id = 'borkeo-pmrs2-receive-status'; status.setAttribute('role','status');
    status.style.cssText = 'position:fixed;top:8px;left:16px;right:16px;z-index:2147483647;padding:12px 18px;background:#e8f6fb;color:#123c51;border:1px solid #9cc8db;border-radius:8px;font:14px/1.8 sans-serif;white-space:pre-wrap';
    document.body.append(status);
    const stage = (name, extra={}) => send({type:'pmrs2-stage', id:pending.id, stage:name,...extra});
    if (location.pathname === '/login') {
      status.textContent = 'មានព័ត៌មានអ្នកជំងឺកំពុងរង់ចាំ។ សូមចូលគណនី ដើម្បីបន្តការនាំចូល។'; await stage('login'); return;
    }
    const query = new URL(location.href).searchParams;
    if (query.has('patientKey') || query.has('patient')) {
      status.textContent = 'មិនអាចនាំចូលលើកំណត់ត្រាអ្នកជំងឺដែលបានបើកទេ។ សូមប្រើទម្រង់ចុះឈ្មោះថ្មី។'; await stage('failed',{reason:'record'}); return;
    }
    if (location.pathname !== '/emr' || query.get('view') !== 'register') {
      const route = await send({type:'pmrs2-navigate',id:pending.id});
      if (route?.ok) location.replace('/emr?view=register&pmrs2Import=1');
      else status.textContent = 'មិនអាចបើកទម្រង់ចុះឈ្មោះបានទេ។ សូមពិនិត្យសិទ្ធិគណនី និងអាសយដ្ឋានប្រព័ន្ធ។';
      return;
    }
    status.textContent = 'កំពុងរង់ចាំទម្រង់ចុះឈ្មោះ។'; await stage('ready');
    let tries = 0, delivered = false;
    const cleanup = () => { root.removeAttribute('data-borkeo-pmrs2-import'); root.removeAttribute('data-borkeo-pmrs2-id'); root.removeAttribute('data-borkeo-pmrs2-result'); };
    const check = async () => {
      let result;
      try { result = JSON.parse(root.getAttribute('data-borkeo-pmrs2-result') || 'null'); } catch { /* wait */ }
      if (result?.id === pending.id) {
        cleanup();
        if (result.ok) {
          await stage('filled',{fields:result.fields,duplicates:result.duplicates});
          status.textContent = 'បានបញ្ចូលព័ត៌មានពី PMRS2។ សូមពិនិត្យទម្រង់ និងអ្នកជំងឺដែលអាចស្ទួន មុនរក្សាទុក។';
          if (Array.isArray(result.matches) && result.matches.length) status.textContent += '\n' + result.matches.join('\n');
          status.dataset.stage = 'filled';
        } else { await stage('failed',{reason:result.reason || 'apply'}); status.textContent = 'មិនអាចបញ្ចូលព័ត៌មានបានទេ។ សូមបើកទម្រង់ចុះឈ្មោះថ្មី ហើយសាកល្បងម្ដងទៀត។'; }
        return;
      }
      if (tries++ >= 150) {
        cleanup(); await stage('failed',{reason:delivered?'apply':'module'});
        status.textContent = 'ទម្រង់មិនបានឆ្លើយតប។ សូមចាប់ផ្ដើម Borkeo ឡើងវិញ ផ្ទុកទំព័រឡើងវិញ ហើយសាកល្បងម្ដងទៀត។'; status.dataset.stage='failed'; return;
      }
      if (!delivered && root.getAttribute('data-borkeo-pmrs2-ready') === '1' && document.getElementById('web_last_name')) {
        delivered = true;
        root.removeAttribute('data-borkeo-pmrs2-result');
        root.setAttribute('data-borkeo-pmrs2-id', pending.id);
        root.setAttribute('data-borkeo-pmrs2-import', JSON.stringify(pending.payload));
        await stage('applying');
        document.dispatchEvent(new Event('borkeo:pmrs2-import'));
      }
      setTimeout(() => check().catch(() => { status.textContent = 'សូមផ្ទុកកម្មវិធីជំនួយ និងទំព័រឡើងវិញ។'; }),400);
    };
    await check();
  })().catch(() => { /* No transfer is applied when the extension is unavailable. */ });
})();
