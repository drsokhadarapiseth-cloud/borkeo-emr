/**
 * Borkeo EMR - Patient Chart Layout Controller (Banner Removed)
 * WCAG 2.2 AA / IEC 62366-1 Compliant Medical Presentation Layer.
 * Supports all clinical screens (EMR, Lab, Imaging, Pharmacy, Billing).
 */

'use strict';

(function initPatientChartTabs() {
  // UI component removed per request. Banner logic is completely gone.

  const TAB_DEFINITIONS = [
    { id: 'summary', icon: 'icon-home', label: 'សង្ខេប', html: '<span>សង្ខេប</span>' },
    { id: 'vitals', icon: 'icon-activity', label: 'សញ្ញាជីវិត', html: '<span>សញ្ញាជីវិត</span>' },
    { id: 'orders', icon: 'icon-clipboard', label: 'បញ្ជា', html: '<span>បញ្ជា</span>' },
    { id: 'results', icon: 'icon-file-text', label: 'លទ្ធផល', html: '<span>លទ្ធផល</span>' },
    { id: 'meds', icon: 'icon-pill', label: 'ឱសថ', html: '<span>ឱសថ</span>' },
    { id: 'notes', icon: 'icon-edit', label: 'កំណត់ត្រា', html: '<span>កំណត់ត្រា</span>' },
    { id: 'billing', icon: 'icon-dollar', label: 'បេឡា', html: '<span>បេឡា</span>' }
  ];

  function getAllowedTabsForRole(role) {
    const r = String(role || '').toUpperCase();
    if (['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(r)) {
      return ['summary', 'vitals', 'orders', 'results', 'meds', 'notes', 'billing'];
    }
    if (['DOCTOR', 'WARD_HEAD', 'CHIEF_WARD'].includes(r)) {
      return ['summary', 'vitals', 'orders', 'results', 'meds', 'notes'];
    }
    if (['NURSE', 'MIDWIFE'].includes(r)) {
      return ['summary', 'vitals', 'orders', 'results', 'meds', 'notes'];
    }
    if (r === 'TRIAGE' || r === 'REGISTRATION') {
      return ['summary', 'vitals'];
    }
    if (['CLERK', 'ACCOUNTANT'].includes(r)) {
      return ['summary', 'billing'];
    }
    if (r === 'PHARMACY') {
      return ['summary', 'meds'];
    }
    if (['LAB', 'IMAGING'].includes(r)) {
      return ['summary', 'orders', 'results'];
    }
    return ['summary', 'vitals', 'orders', 'results', 'meds', 'notes'];
  }
  window.getAllowedTabsForRole = getAllowedTabsForRole;

  function setupChartTabs(patient) {
    if (window.location.pathname !== '/emr') return;

    const currentRole = String(window.emrSession?.user?.activeRole || window.userRole || '').toUpperCase();
    const allowed = getAllowedTabsForRole(currentRole);

    let tabsContainer = document.getElementById('emr-chart-tabs-wrapper');
    if (!tabsContainer) {
      tabsContainer = document.createElement('div');
      tabsContainer.id = 'emr-chart-tabs-wrapper';
      tabsContainer.className = 'emr-chart-tabs-wrap no-print';

      const main = document.getElementById('main-content') || document.querySelector('main');
      if (main) main.prepend(tabsContainer);
      else document.body.prepend(tabsContainer);
    }

    const currentTab = tabsContainer.querySelector('.emr-chart-tab.is-active')?.dataset.chartTab || 'summary';
    const activeTabId = allowed.includes(currentTab) ? currentTab : (allowed[0] || 'summary');

    tabsContainer.innerHTML = `
      <nav class="emr-chart-tabs" role="tablist" aria-label="ផ្ទាំងឯកសារអ្នកជំងឺ">
        ${TAB_DEFINITIONS.filter(t => allowed.includes(t.id)).map(t => `
          <button type="button" class="emr-chart-tab ${t.id === activeTabId ? 'is-active' : ''}" role="tab" data-chart-tab="${t.id}" aria-selected="${t.id === activeTabId ? 'true' : 'false'}">
            <svg><use href="/public/icons.svg#${t.icon}"></use></svg>
            <span>${t.label}</span>
          </button>
        `).join('')}
      </nav>
    `;

    function activateTab(tabName) {
      if (!allowed.includes(tabName)) {
        tabName = allowed[0] || 'summary';
      }
      const tabs = tabsContainer.querySelectorAll('.emr-chart-tab');
      tabs.forEach(tab => {
        const isTarget = tab.dataset.chartTab === tabName;
        tab.classList.toggle('is-active', isTarget);
        tab.setAttribute('aria-selected', String(isTarget));
      });

      if (tabName === 'vitals') {
        window.switchPage?.(2);
      } else if (tabName === 'notes') {
        window.switchPage?.(3);
      } else if (tabName === 'orders') {
        document.getElementById('paraclinic_orders_panel')?.scrollIntoView({ behavior: 'smooth' });
      } else if (tabName === 'results') {
        document.getElementById('paraclinic_results_panel')?.scrollIntoView({ behavior: 'smooth' });
      } else if (tabName === 'meds') {
        document.getElementById('ipd-medications-panel')?.scrollIntoView({ behavior: 'smooth' });
      } else if (tabName === 'billing') {
        if (patient?.patientKey && ['CLERK', 'ACCOUNTANT', 'ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(currentRole)) {
          window.location.assign(`/billing?patient=${encodeURIComponent(patient.patientKey)}`);
        }
      }
    }

    tabsContainer.querySelectorAll('.emr-chart-tab').forEach(tab => {
      tab.addEventListener('click', () => activateTab(tab.dataset.chartTab));
    });
  }
  window.setupChartTabs = setupChartTabs;

  window.addEventListener('emr-session-ready', () => {
    if (window.getLoadedEmrPatient) {
      setupChartTabs(window.getLoadedEmrPatient());
    }
  });

  document.addEventListener('emr:patient-loaded', event => {
    setupChartTabs(event.detail?.patient);
  });
})();
