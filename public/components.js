/**
 * Borkeo EMR — Lightweight Vanilla Components Controller
 * Supports accessible modals, drawers, toasts, tabs, and theme toggling
 */

(function () {
  'use strict';

  // 1. THEME CONTROLLER
  const THEME_KEY = 'borkeo_emr_theme';
  
  function getPreferredTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    if (saved && ['light', 'dark', 'high-contrast'].includes(saved)) {
      return saved;
    }
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {}
    document.dispatchEvent(new CustomEvent('emr:theme-changed', { detail: { theme } }));
  }

  // Initialize theme
  applyTheme(getPreferredTheme());

  window.setEmrTheme = applyTheme;
  window.getEmrTheme = () => document.documentElement.getAttribute('data-theme') || 'light';

  // 2. MODAL CONTROLLER
  let activeModal = null;
  let previousFocusedElement = null;

  function openModal(modalId) {
    const modal = typeof modalId === 'string' ? document.getElementById(modalId) : modalId;
    if (!modal) return;
    previousFocusedElement = document.activeElement;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
    activeModal = modal;

    // Focus first focusable element inside modal
    const focusable = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable.length) {
      focusable[0].focus();
    }
  }

  function closeModal(modalId) {
    const modal = modalId ? (typeof modalId === 'string' ? document.getElementById(modalId) : modalId) : activeModal;
    if (!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    activeModal = null;

    if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
      previousFocusedElement.focus();
    }
  }

  // 3. DRAWER CONTROLLER
  function openDrawer(drawerId) {
    const drawer = typeof drawerId === 'string' ? document.getElementById(drawerId) : drawerId;
    if (!drawer) return;
    drawer.classList.add('open');
  }

  function closeDrawer(drawerId) {
    const drawer = typeof drawerId === 'string' ? document.getElementById(drawerId) : drawerId;
    if (!drawer) return;
    drawer.classList.remove('open');
  }

  // 4. TOAST CONTROLLER
  function getToastContainer() {
    let container = document.getElementById('emr-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'emr-toast-container';
      container.className = 'toast-container';
      container.setAttribute('aria-live', 'polite');
      container.setAttribute('role', 'region');
      container.setAttribute('aria-label', 'សេចក្តីជូនដំណឹង');
      document.body.appendChild(container);
    }
    return container;
  }

  function showToast({ message, type = 'info', duration = 4000 }) {
    const container = getToastContainer();
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.setAttribute('role', 'alert');

    const content = document.createElement('div');
    content.className = 'toast-content';
    content.textContent = message;

    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.type = 'button';
    closeBtn.setAttribute('aria-label', 'បិទ');
    closeBtn.innerHTML = '&times;';
    closeBtn.onclick = () => {
      toast.remove();
    };

    toast.appendChild(content);
    toast.appendChild(closeBtn);
    container.appendChild(toast);

    if (duration > 0) {
      setTimeout(() => {
        if (toast.isConnected) {
          toast.remove();
        }
      }, duration);
    }
  }

  // Global event delegation for modal backdrop clicks and Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (activeModal) {
        closeModal(activeModal);
      }
      document.querySelectorAll('.drawer.open').forEach(d => d.classList.remove('open'));
    }
  });

  document.addEventListener('click', (e) => {
    if (e.target.matches('.modal-backdrop') && !e.target.classList.contains('static-backdrop')) {
      closeModal(e.target);
    }
    if (e.target.closest('[data-modal-close]')) {
      const modal = e.target.closest('.modal-backdrop');
      if (modal) closeModal(modal);
    }
    if (e.target.closest('[data-drawer-close]')) {
      const drawer = e.target.closest('.drawer');
      if (drawer) closeDrawer(drawer);
    }
  });

  // Expose global methods
  window.openEmrModal = openModal;
  window.closeEmrModal = closeModal;
  window.openEmrDrawer = openDrawer;
  window.closeEmrDrawer = closeDrawer;
  window.showEmrToast = showToast;

})();
