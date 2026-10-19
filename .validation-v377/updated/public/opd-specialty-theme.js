'use strict';

(function applyOceanThemeToSpecialtyForms() {
  const specialtyCss = `
    :root {
      --opd-ocean-bg: #e9f7fb;
      --opd-ocean-soft: #dff4fa;
      --opd-ocean-pale: #f7fdff;
      --opd-ocean-border: #a9d7e5;
      --opd-ocean: #087fa8;
      --opd-ocean-dark: #066888;
      --opd-ocean-title: #07516f;
      color-scheme: light;
    }
    html, body {
      min-height: 100%;
      background: var(--opd-ocean-bg) !important;
      color: #1d3a49 !important;
    }
    body { padding: 18px !important; }
    .container, .container-fluid { background: transparent !important; }
    .container-fluid.bg-white,
    .container.bg-white {
      padding: clamp(14px, 2vw, 24px) !important;
      border: 1px solid var(--opd-ocean-border) !important;
      border-radius: 12px !important;
      background: var(--opd-ocean-pale) !important;
      box-shadow: 0 5px 16px rgba(7, 81, 111, .08) !important;
    }
    .card {
      overflow: hidden;
      border: 1px solid var(--opd-ocean-border) !important;
      border-radius: 10px !important;
      background: var(--opd-ocean-pale) !important;
      box-shadow: 0 3px 11px rgba(7, 81, 111, .07) !important;
    }
    .card-header,
    .card-header-blue,
    .card-header-green {
      padding: 11px 15px !important;
      border-color: #08769d !important;
      background: linear-gradient(100deg, #08769d, #0c9abd) !important;
      color: #fff !important;
      font-weight: 700 !important;
    }
    .card-body { background: var(--opd-ocean-pale) !important; }
    .form-label, .form-check-label, label { color: #244554 !important; }
    .text-danger { color: #be313d !important; }
    .dashed-divider, hr {
      border-color: var(--opd-ocean-border) !important;
      opacity: 1 !important;
    }
    .form-control, .form-select,
    input:not([type='checkbox']):not([type='radio']), textarea, select {
      border-color: #b8d9e3 !important;
      background-color: var(--opd-ocean-pale) !important;
      color: #1d3a49 !important;
    }
    .form-control:focus, .form-select:focus,
    input:focus, textarea:focus, select:focus {
      border-color: var(--opd-ocean) !important;
      box-shadow: 0 0 0 3px rgba(12, 150, 188, .15) !important;
      outline: 0 !important;
    }
    .form-check-input:checked {
      border-color: var(--opd-ocean) !important;
      background-color: var(--opd-ocean) !important;
    }
    .bg-success, [class*='bg-success'] {
      background-color: var(--opd-ocean) !important;
    }
    .text-success, [class*='text-success'] { color: var(--opd-ocean) !important; }
    .border-success, [class*='border-success'] { border-color: var(--opd-ocean) !important; }
    button, .btn, .btn-blue, .btn-green, .btn-orange,
    .btn-primary, .btn-success, .btn-warning {
      border: 1px solid var(--opd-ocean) !important;
      border-radius: 7px !important;
      background: var(--opd-ocean) !important;
      color: #fff !important;
      box-shadow: 0 2px 5px rgba(7, 81, 111, .14) !important;
      font-weight: 700 !important;
    }
    button:hover, .btn:hover, .btn-blue:hover, .btn-green:hover,
    .btn-orange:hover, .btn-primary:hover, .btn-success:hover, .btn-warning:hover {
      border-color: var(--opd-ocean-dark) !important;
      background: var(--opd-ocean-dark) !important;
      color: #fff !important;
    }
    #opd-patient-context {
      border-color: var(--opd-ocean-border) !important;
      background: var(--opd-ocean-soft) !important;
      color: var(--opd-ocean-title) !important;
    }
    @media print {
      html, body { background: #fff !important; }
      body { padding: 0 !important; }
    }
  `;

  const preparedFrames = new WeakSet();

  function themeFrame(frame) {
    function injectTheme() {
      try {
        const documentInsideFrame = frame.contentDocument;
        if (!documentInsideFrame?.head || documentInsideFrame.getElementById('opd-ocean-theme')) return;
        const style = documentInsideFrame.createElement('style');
        style.id = 'opd-ocean-theme';
        style.textContent = specialtyCss;
        documentInsideFrame.head.append(style);
      } catch (error) {
        console.error('Unable to style the OPD specialty form.', error);
      }
    }

    if (!preparedFrames.has(frame)) {
      preparedFrames.add(frame);
      frame.addEventListener('load', injectTheme);
    }
    [0, 50, 250, 800].forEach(delay => window.setTimeout(injectTheme, delay));
  }

  const panels = document.getElementById('opd-specialty-panels');
  if (!panels) return;
  panels.querySelectorAll('iframe.opd-specialty-frame').forEach(themeFrame);
  new MutationObserver(records => {
    records.forEach(record => {
      record.addedNodes.forEach(node => {
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        if (node.matches?.('iframe.opd-specialty-frame')) themeFrame(node);
        node.querySelectorAll?.('iframe.opd-specialty-frame').forEach(themeFrame);
      });
    });
  }).observe(panels, { childList: true, subtree: true });
  document.getElementById('opd-module-select')?.addEventListener('change', () => {
    [0, 80, 300].forEach(delay => window.setTimeout(() => {
      panels.querySelectorAll('iframe.opd-specialty-frame').forEach(themeFrame);
    }, delay));
  });
})();
