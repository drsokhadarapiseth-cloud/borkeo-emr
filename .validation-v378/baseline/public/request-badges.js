'use strict';
(()=>{
  let session = null;
  let inFlight = false;
  let initialized = false;

  async function refresh() {
    if (inFlight || !session?.user) return;
    const role = session.user.activeRole;
    if (!['ADMIN','DIRECTOR','VICE_DIRECTOR','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','PHARMACY','CLERK','ACCOUNTANT'].includes(role)) return;
    inFlight = true;
    try {
      const r = await fetch('/api/requests/counts', { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) return;
      const { counts = {} } = await r.json();
      const total = Object.values(counts).reduce((a, b) => a + Number(b || 0), 0);
      for (const link of document.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href')?.split('?')[0];
        if (!['/requests', '/ward-medicines'].includes(href)) continue;
        const count = href === '/requests' ? total : Number(counts.MEDICINE || 0);
        let badge = link.querySelector('[data-request-count]');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'request-badge';
          badge.dataset.requestCount = '';
          link.append(badge);
        }
        const textStr = String(count);
        if (badge.textContent !== textStr) badge.textContent = textStr;
        const ariaStr = count + ' pending requests';
        if (badge.getAttribute('aria-label') !== ariaStr) badge.setAttribute('aria-label', ariaStr);
        const shouldHide = count === 0;
        if (badge.hidden !== shouldHide) badge.hidden = shouldHide;
      }
    } catch {} finally {
      inFlight = false;
    }
  }

  function init(s) {
    session = s;
    if (!initialized) {
      initialized = true;
      window.addEventListener('emr-requests-changed', () => void refresh());
      window.addEventListener('focus', () => void refresh());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void refresh();
      });
      setInterval(() => {
        if (!document.hidden) void refresh();
      }, 15000);
    }
    void refresh();
  }

  if (window.emrSession) init(window.emrSession);
  window.addEventListener('emr-session-ready', e => init(e.detail));
})();
