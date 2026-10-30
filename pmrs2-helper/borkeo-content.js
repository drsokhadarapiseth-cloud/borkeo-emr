// Pending details are cleared only after the registration module acknowledges them.
(function () {
  'use strict';
  if (!/[?&]pmrs2Import=1\b/.test(location.search)) return;
  chrome.storage.local.get({ pmrs2Payload: null, pmrs2PayloadAt: 0, pmrs2TransferId: '', pmrs2TargetOrigin: '' }, cfg => {
    if (!cfg.pmrs2Payload || Date.now() - cfg.pmrs2PayloadAt > 600000 || cfg.pmrs2TargetOrigin !== location.origin) return;
    const root = document.documentElement;
    let tries = 0;
    let injected = false;
    const fail = () => {
      root.removeAttribute('data-borkeo-pmrs2-import');
      root.removeAttribute('data-borkeo-pmrs2-id');
      const bar = document.createElement('p');
      bar.textContent = 'មិនអាចបញ្ចូលព័ត៌មានបានទេ។ សូមចូលគណនី បើកទម្រង់ចុះឈ្មោះ រួចសាកល្បងបញ្ជូនពីទំព័រដើមម្ដងទៀត។';
      bar.setAttribute('role', 'alert');
      bar.style.cssText = 'position:fixed;top:12px;left:12px;right:12px;z-index:2147483647;background:#fff3cd;color:#513b00;padding:16px;border:1px solid #bd9100;border-radius:8px';
      document.body.appendChild(bar);
    };
    const deliver = () => {
      let result;
      try { result = JSON.parse(root.getAttribute('data-borkeo-pmrs2-result') || 'null'); } catch { /* no acknowledgement */ }
      if (result && result.id === cfg.pmrs2TransferId) {
        root.removeAttribute('data-borkeo-pmrs2-result');
        root.removeAttribute('data-borkeo-pmrs2-id');
        if (!result.ok) { fail(); return; }
        chrome.storage.local.get({ pmrs2TransferId: '' }, current => {
          if (current.pmrs2TransferId === cfg.pmrs2TransferId) chrome.storage.local.remove(['pmrs2Payload', 'pmrs2PayloadAt', 'pmrs2TransferId', 'pmrs2TargetOrigin']);
        });
        return;
      }
      if (tries++ >= 150) { fail(); return; }
      if (!injected && document.getElementById('web_last_name')) {
        injected = true;
        root.removeAttribute('data-borkeo-pmrs2-result');
        root.setAttribute('data-borkeo-pmrs2-id', cfg.pmrs2TransferId);
        root.setAttribute('data-borkeo-pmrs2-import', JSON.stringify(cfg.pmrs2Payload));
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('page-fill.js');
        script.onload = () => script.remove();
        script.onerror = () => { script.remove(); };
        (document.head || root).appendChild(script);
      }
      setTimeout(deliver, 400);
    };
    deliver();
  });
})();
