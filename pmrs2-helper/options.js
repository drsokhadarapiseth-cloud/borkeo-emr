// Stores the Borkeo EMR address the helper opens for registration.
(function () {
  'use strict';
  const input = document.getElementById('borkeoBaseUrl');
  const saved = document.getElementById('saved');
  chrome.storage.local.get({ borkeoBaseUrl: 'http://127.0.0.1:3001' }, (cfg) => { input.value = cfg.borkeoBaseUrl; });
  document.getElementById('save').addEventListener('click', () => {
    const value = input.value.trim().replace(/\/+$/, '') || 'http://127.0.0.1:3001';
    chrome.storage.local.set({ borkeoBaseUrl: value }, () => {
      input.value = value;
      saved.hidden = false;
      setTimeout(() => { saved.hidden = true; }, 1500);
    });
  });
})();
