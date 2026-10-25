// Nonvisual print/export audit connection; record opening is logged by the server.
'use strict';
(function recordAccessProvider() {
  let lastLogged = null;
  function patientKey() {
    if (typeof window.getLoadedEmrPatient === 'function') return window.getLoadedEmrPatient()?.patientKey || '';
    const query = new URLSearchParams(window.location.search);
    return query.get('patientKey') || query.get('patient') || '';
  }
  window.logRecordAccess = async function logRecordAccess(action, detail = '') {
    const key = patientKey();
    if (!key || !['print', 'export'].includes(action)) return false;
    const text = String(detail || document.title || '').slice(0, 200);
    const signature = JSON.stringify([action, key, text]);
    const now = Date.now();
    if (lastLogged?.signature === signature && now - lastLogged.at < 3000) return false;
    const current = { signature, at: now };
    lastLogged = current;
    try {
      const response = await fetch('/api/record-access-log', {
        method: 'POST', credentials: 'same-origin', keepalive: true,
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.emrSession?.csrfToken || '' },
        body: JSON.stringify({ patientKey: key, action, detail: text }),
      });
      if (!response.ok && lastLogged === current) lastLogged = null;
      return response.ok;
    } catch {
      if (lastLogged === current) lastLogged = null;
      return false;
    }
  };
  window.addEventListener('beforeprint', () => {
    if (window.frameElement?.classList.contains('viewer-report-source')) return;
    void window.logRecordAccess('print', document.title);
  });
  document.addEventListener('emr:patient-loaded', () => { lastLogged = null; });
})();
