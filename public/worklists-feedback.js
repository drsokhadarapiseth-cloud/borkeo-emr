/**
 * Borkeo EMR - Worklists, Forms & Feedback Controller (Phase 7)
 * Aligned with WCAG 2.2 AA & IEC 62366-1.
 * - LocalStorage filter persistence for worklists & queues.
 * - Autosave-state indicators (saving / saved / error).
 * - Accessible Modal replacements for alert() & confirm() with Khmer defaults.
 * - Form validation helpers with consistent Khmer messages.
 */
(function (global) {
  'use strict';

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getDoc() {
    return typeof document !== 'undefined' ? document : (global.document || null);
  }

  // =========================================================================
  // 1. LocalStorage Filter Persistence
  // =========================================================================
  const EmrFilterStorage = {
    save(key, value) {
      try {
        global.localStorage?.setItem(`emr-filter:${key}`, JSON.stringify(value));
      } catch {}
    },

    load(key, fallback = null) {
      try {
        const item = global.localStorage?.getItem(`emr-filter:${key}`);
        return item ? JSON.parse(item) : fallback;
      } catch {
        return fallback;
      }
    },

    clear(key) {
      try {
        global.localStorage?.removeItem(`emr-filter:${key}`);
      } catch {}
    },

    /**
     * Auto-bind an input element to localStorage persistence
     * @param {string} inputId DOM element ID
     * @param {string} storageKey Storage key suffix
     * @param {Function} onChange Callback triggered on change
     */
    bindInput(inputId, storageKey, onChange) {
      const doc = getDoc();
      const el = doc?.getElementById ? doc.getElementById(inputId) : null;
      if (!el) return;

      const saved = this.load(storageKey);
      if (saved != null && !el.value) {
        el.value = saved;
        if (typeof onChange === 'function') onChange(saved);
      }

      el.addEventListener('input', () => {
        this.save(storageKey, el.value);
        if (typeof onChange === 'function') onChange(el.value);
      });
    }
  };

  // =========================================================================
  // 2. Autosave-State Indicator Widget
  // =========================================================================
  const EmrAutosaveIndicator = {
    setState(badgeOrContainer, state, msg) {
      const badge = badgeOrContainer?.element || badgeOrContainer;
      if (!badge) return;

      if (state === 'saving') {
        badge.className = 'emr-autosave-badge saving';
        badge.innerHTML = `<span class="autosave-dot"></span><span class="autosave-text">${esc(msg || 'កំពុងរក្សាទុក…')}</span>`;
      } else if (state === 'saved') {
        badge.className = 'emr-autosave-badge saved';
        badge.innerHTML = `<span class="autosave-dot"></span><span class="autosave-text">${esc(msg || 'បានរក្សាទុក')}</span>`;
      } else if (state === 'error') {
        badge.className = 'emr-autosave-badge error';
        badge.innerHTML = `<span class="autosave-dot"></span><span class="autosave-text">${esc(msg || 'មិនអាចរក្សាទុក')}</span>`;
      }
    },

    create(containerId) {
      const doc = getDoc();
      if (!doc) return null;

      let container = typeof containerId === 'string' && doc.getElementById ? doc.getElementById(containerId) : containerId;
      let badge;

      if (!container && typeof containerId === 'string') {
        badge = doc.createElement('div');
        badge.id = containerId;
      } else if (container) {
        badge = container.querySelector ? container.querySelector('.emr-autosave-badge') : null;
        if (!badge) {
          badge = doc.createElement('div');
          container.appendChild(badge);
        }
      } else {
        badge = doc.createElement('div');
      }

      this.setState(badge, 'saved');
      badge.setSaving = (msg) => this.setState(badge, 'saving', msg);
      badge.setSaved = (msg) => this.setState(badge, 'saved', msg);
      badge.setError = (msg) => this.setState(badge, 'error', msg);

      return badge;
    }
  };

  // =========================================================================
  // 3. Accessible Modal Dialog Replacements for alert() / confirm()
  // =========================================================================
  const EmrDialog = {
    /**
     * Accessible themed replacement for window.alert()
     * @param {string} message Alert message
     * @param {Object} options Configuration (title, tone)
     * @returns {Promise<void>}
     */
    alert(message, options = {}) {
      return new Promise(resolve => {
        const doc = getDoc();
        if (!doc) {
          resolve();
          return;
        }

        const title = options.title || 'ដំណឹង';
        const tone = options.tone || 'info';

        const overlay = doc.createElement('div');
        overlay.className = 'emr-dialog-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'emr-dialog-title');

        overlay.innerHTML = `
          <div class="emr-dialog-card" tabindex="-1">
            <header class="emr-dialog-header">
              <svg class="emr-dialog-icon ${esc(tone)}"><use href="/public/icons.svg#icon-info"></use></svg>
              <h3 id="emr-dialog-title" class="emr-dialog-title">${esc(title)}</h3>
            </header>
            <div class="emr-dialog-body">${esc(message)}</div>
            <footer class="emr-dialog-actions">
              <button type="button" class="emr-dialog-btn-confirm" data-emr-action="ok">យល់ព្រម</button>
            </footer>
          </div>
        `;

        function cleanup() {
          overlay.remove ? overlay.remove() : doc.body?.removeChild(overlay);
          doc.removeEventListener?.('keydown', onKeyDown);
          resolve();
        }

        function onKeyDown(e) {
          if (e.key === 'Escape' || e.key === 'Enter') {
            e.preventDefault();
            cleanup();
          }
        }

        overlay.querySelector?.('[data-emr-action="ok"]')?.addEventListener('click', cleanup);
        doc.addEventListener?.('keydown', onKeyDown);
        doc.body?.appendChild(overlay);

        const btn = overlay.querySelector?.('[data-emr-action="ok"]');
        btn?.focus?.();
      });
    },

    /**
     * Accessible themed replacement for window.confirm()
     * @param {string} message Confirmation prompt
     * @param {Object} options Configuration (title, isDanger, confirmText, cancelText)
     * @returns {Promise<boolean>}
     */
    confirm(message, options = {}) {
      return new Promise(resolve => {
        const doc = getDoc();
        if (!doc) {
          resolve(false);
          return;
        }

        const title = options.title || 'ការបញ្ជាក់';
        const isDanger = options.isDanger === true;
        const confirmText = options.confirmText || (isDanger ? 'លុប' : 'យល់ព្រម');
        const cancelText = options.cancelText || 'បោះបង់';

        const overlay = doc.createElement('div');
        overlay.className = 'emr-dialog-overlay';
        overlay.setAttribute('role', 'alertdialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.setAttribute('aria-labelledby', 'emr-confirm-title');

        overlay.innerHTML = `
          <div class="emr-dialog-card" tabindex="-1">
            <header class="emr-dialog-header">
              <svg class="emr-dialog-icon ${isDanger ? 'danger' : 'warning'}"><use href="/public/icons.svg#icon-${isDanger ? 'alert-circle' : 'info'}"></use></svg>
              <h3 id="emr-confirm-title" class="emr-dialog-title">${esc(title)}</h3>
            </header>
            <div class="emr-dialog-body">${esc(message)}</div>
            <footer class="emr-dialog-actions">
              <button type="button" class="emr-dialog-btn-cancel" data-emr-action="cancel">${esc(cancelText)}</button>
              <button type="button" class="${isDanger ? 'emr-dialog-btn-danger' : 'emr-dialog-btn-confirm'}" data-emr-action="confirm">${esc(confirmText)}</button>
            </footer>
          </div>
        `;

        function cleanup(result) {
          overlay.remove ? overlay.remove() : doc.body?.removeChild(overlay);
          doc.removeEventListener?.('keydown', onKeyDown);
          resolve(result);
        }

        function onKeyDown(e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            cleanup(false);
          }
        }

        overlay.querySelector?.('[data-emr-action="cancel"]')?.addEventListener('click', () => cleanup(false));
        overlay.querySelector?.('[data-emr-action="confirm"]')?.addEventListener('click', () => cleanup(true));
        doc.addEventListener?.('keydown', onKeyDown);
        doc.body?.appendChild(overlay);

        const cancelBtn = overlay.querySelector?.('[data-emr-action="cancel"]');
        cancelBtn?.focus?.();
      });
    }
  };

  const EmrValidation = {
    messages: {
      required: 'សូមបំពេញប្រអប់នេះ (ចាំបាច់)។',
      invalidPattern: 'សូមបញ្ចូលទិន្នន័យឱ្យបានត្រឹមត្រូវ។',
      rangeError: 'តម្លៃមិនត្រឹមត្រូវតាមដែនកំណត់។',
      invalidDate: 'កាលបរិច្ឆេទមិនត្រឹមត្រូវ។',
      saveError: 'ការរក្សាទុកទិន្នន័យបានបរាជ័យ។'
    },

    setupKhmerValidation(form) {
      if (!form) return;
      form.addEventListener('invalid', event => {
        const field = event.target;
        if (!field.validity) return;

        if (field.validity.valueMissing) {
          field.setCustomValidity(this.messages.required);
        } else if (field.validity.typeMismatch || field.validity.patternMismatch) {
          field.setCustomValidity(this.messages.invalidPattern);
        } else if (field.validity.rangeUnderflow || field.validity.rangeOverflow) {
          field.setCustomValidity(this.messages.rangeError);
        } else {
          field.setCustomValidity('');
        }
      }, true);

      form.addEventListener('input', event => {
        event.target.setCustomValidity('');
      });
    }
  };

  // Expose global APIs
  global.EmrFilterStorage = EmrFilterStorage;
  global.EmrAutosaveIndicator = EmrAutosaveIndicator;
  global.EmrDialog = EmrDialog;
  global.EmrValidation = EmrValidation;

  // Polyfill window.emrAlert and window.emrConfirm
  global.emrAlert = EmrDialog.alert;
  global.emrConfirm = EmrDialog.confirm;

  // Auto-init filter persistence on DOMContentLoaded
  if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
    document.addEventListener('DOMContentLoaded', () => {
      // Bind search persistence if inputs exist
      EmrFilterStorage.bindInput('queue-search', 'opd-queue-search');
      EmrFilterStorage.bindInput('triage-search', 'triage-search');
      EmrFilterStorage.bindInput('pharmacy-search', 'pharmacy-search');

      // Attach Khmer validation to forms
      if (typeof document.querySelectorAll === 'function') {
        document.querySelectorAll('form').forEach(form => {
          EmrValidation.setupKhmerValidation(form);
        });
      }
    });
  }

})(typeof window !== 'undefined' ? window : globalThis);
