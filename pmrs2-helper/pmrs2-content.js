// Runs on PMRS2 pages. Adds one floating button. On click it reads the patient
// fields from the page and opens Borkeo registration pre-filled. It never submits
// anything to PMRS2 and never touches the PMRS2 login.
(function () {
  'use strict';
  if (window.__borkeoPmrs2ButtonAdded) return;
  window.__borkeoPmrs2ButtonAdded = true;

  const BUTTON_TEXT = 'បញ្ចូនទៅ Borkeo';
  const MSG_NONE = 'រកមិនឃើញព័ត៌មានអ្នកជំងឺនៅលើទំព័រនេះ';
  const MSG_SENT = 'បានផ្ញើទៅ Borkeo';

  function defaultBorkeoUrl(cb) {
    chrome.storage.local.get({ borkeoBaseUrl: 'http://127.0.0.1:3001' }, (cfg) => cb(cfg.borkeoBaseUrl));
  }

  function notify(message) {
    const bar = document.createElement('div');
    bar.textContent = message;
    bar.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:16px;transform:translateX(-50%);background:#0b7895;color:#fff;padding:10px 16px;border-radius:8px;font:14px sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)';
    document.body.appendChild(bar);
    setTimeout(() => bar.remove(), 3500);
  }

  function sendToBorkeo() {
    const payload = scrapePmrs2(document);
    const filled = Object.keys(payload).length;
    if (!filled) { notify(MSG_NONE); return; }
    chrome.storage.local.set({ pmrs2Payload: payload, pmrs2PayloadAt: Date.now() }, () => {
      defaultBorkeoUrl((base) => {
        const url = base.replace(/\/+$/, '') + '/emr?view=register&pmrs2Import=1';
        window.open(url, 'borkeoRegistration');
        notify(MSG_SENT + ' (' + filled + ')');
      });
    });
  }

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = BUTTON_TEXT;
  button.style.cssText = 'position:fixed;z-index:2147483647;right:18px;bottom:18px;background:#0b7895;color:#fff;border:0;border-radius:24px;padding:12px 20px;font:600 14px sans-serif;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.3)';
  button.addEventListener('click', sendToBorkeo);
  document.body.appendChild(button);
})();
