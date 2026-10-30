// Runs on the Borkeo EMR page. When the registration view was opened from PMRS2
// (?pmrs2Import=1), it hands the stored payload to the page and lets the page's
// own pmrs2-import module fill the form. Staff review and save.
(function () {
  'use strict';
  if (!/[?&]pmrs2Import=1\b/.test(location.search)) return;

  chrome.storage.local.get({ pmrs2Payload: null, pmrs2PayloadAt: 0 }, (cfg) => {
    // Ignore a stale payload (older than 10 minutes).
    if (!cfg.pmrs2Payload || Date.now() - cfg.pmrs2PayloadAt > 600000) return;
    chrome.storage.local.remove(['pmrs2Payload', 'pmrs2PayloadAt']);

    const deliver = () => {
      if (!document.getElementById('web_last_name')) { setTimeout(deliver, 400); return; }
      document.documentElement.setAttribute('data-borkeo-pmrs2-import', JSON.stringify(cfg.pmrs2Payload));
      // page-fill.js runs in the page world and calls window.applyPmrs2Registration.
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('page-fill.js');
      script.onload = () => script.remove();
      (document.head || document.documentElement).appendChild(script);
    };
    deliver();
  });
})();
