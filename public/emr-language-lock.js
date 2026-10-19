'use strict';

// Remove language controls regardless of the page, active role or header layout.
(function lockKhmerInterface() {
  const selector = '.emr-language-switch,[data-emr-language],#langBtn,.lang-btn,button[onclick*="toggleLanguage"],button[onclick*="setBorkeoLanguage"]';
  const installed = new WeakSet();

  function install(doc) {
    if (!doc?.documentElement || installed.has(doc)) return;
    installed.add(doc);
    doc.documentElement.lang = 'km';

    function clean(root) {
      if (root.nodeType !== 1) return;
      if (root.matches(selector)) { root.remove(); return; }
      root.querySelectorAll(selector).forEach(control => control.remove());
      if (root.matches('iframe')) inspectFrame(root);
      root.querySelectorAll('iframe').forEach(inspectFrame);
    }

    function inspectFrame(frame) {
      // Cross-origin frames are outside the EMR's document access.
      try { install(frame.contentDocument); } catch {}
    }

    clean(doc.documentElement);
    const observer = new MutationObserver(records => {
      for (const record of records) {
        for (const node of record.addedNodes) clean(node);
      }
    });
    // No text/attribute observation or translation passes over clinical content.
    observer.observe(doc.documentElement, { childList: true, subtree: true });
    doc.addEventListener('load', event => {
      if (event.target?.tagName === 'IFRAME') inspectFrame(event.target);
    }, true);
  }

  install(document);
})();
