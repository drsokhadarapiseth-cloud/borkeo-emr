/**
 * Borkeo EMR — Styleguide Interactive Controller
 * Strictly external script for compliance with strict Content Security Policy (no inline script)
 */
(function() {
  'use strict';

  function initStyleguide() {
    // Theme toggle buttons
    const themeSelect = document.getElementById('styleguide-theme-select');
    if (themeSelect) {
      themeSelect.value = window.getEmrTheme ? window.getEmrTheme() : 'light';
      themeSelect.addEventListener('change', (e) => {
        if (window.setEmrTheme) {
          window.setEmrTheme(e.target.value);
        }
      });
    }

    // Modal demos
    const modalTrigger = document.getElementById('demo-modal-trigger');
    if (modalTrigger) {
      modalTrigger.addEventListener('click', () => {
        if (window.openEmrModal) window.openEmrModal('demo-sample-modal');
      });
    }

    // Drawer demo
    const drawerTrigger = document.getElementById('demo-drawer-trigger');
    if (drawerTrigger) {
      drawerTrigger.addEventListener('click', () => {
        if (window.openEmrDrawer) window.openEmrDrawer('demo-sample-drawer');
      });
    }

    // Toast triggers
    const toastSuccessBtn = document.getElementById('toast-success-btn');
    if (toastSuccessBtn) {
      toastSuccessBtn.addEventListener('click', () => {
        if (window.showEmrToast) window.showEmrToast({ message: 'បានរក្សាទុកទិន្នន័យដោយជោគជ័យ!', type: 'success' });
      });
    }

    const toastDangerBtn = document.getElementById('toast-danger-btn');
    if (toastDangerBtn) {
      toastDangerBtn.addEventListener('click', () => {
        if (window.showEmrToast) window.showEmrToast({ message: 'មានបញ្ហាបច្ចេកទេសក្នុងការតភ្ជាប់។', type: 'danger' });
      });
    }

    const toastWarningBtn = document.getElementById('toast-warning-btn');
    if (toastWarningBtn) {
      toastWarningBtn.addEventListener('click', () => {
        if (window.showEmrToast) window.showEmrToast({ message: 'សូមផ្ទៀងផ្ទាត់លេខកូដ ICD-10 ឡើងវិញ។', type: 'warning' });
      });
    }

    const toastInfoBtn = document.getElementById('toast-info-btn');
    if (toastInfoBtn) {
      toastInfoBtn.addEventListener('click', () => {
        if (window.showEmrToast) window.showEmrToast({ message: 'អ្នកជំងឺត្រូវបានបញ្ជូនទៅផ្នែកពិគ្រោះជំងឺក្រៅ។', type: 'info' });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStyleguide);
  } else {
    initStyleguide();
  }
})();
