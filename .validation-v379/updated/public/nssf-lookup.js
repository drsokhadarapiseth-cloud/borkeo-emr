(function(){
  'use strict';

  const byId = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const en = () => typeof window !== 'undefined' && window.getBorkeoLanguage?.() === 'en';
  const txt = (kh, eng) => en() ? eng : kh;

  const cardValue = () => String(byId('web_nssf')?.value || '').replace(/[០-៩]/g, c => String(c.charCodeAt(0) - 0x17e0)).trim();
  const patientIdentity = () => JSON.stringify([byId('web_health_id')?.value || '',byId('web_adm_no')?.value || '']);

  let generation = 0;
  let controller = null;
  let timer = null;
  let dialog = null;
  let result = null;
  let context = null;
  let initialized = false;

  const allowed = () => {
    const role = window.emrSession?.user?.activeRole;
    const roleOk = ['REGISTRATION', 'ADMIN', 'VICE_DIRECTOR'].includes(role);
    return roleOk && !byId('web_nssf')?.disabled && !byId('web_nssf')?.readOnly;
  };

  function setMessage(textKh, textEn, type = '') {
    const node = byId('nssf_verify_status');
    if (!node) return;
    node.textContent = textEn !== undefined ? txt(textKh, textEn) : textKh;
    node.className = 'hef-lookup-status nssf-lookup-status' + (type ? ' status-' + type : '');
    if (result) {
      node.title = txt('ចុចដើម្បីមើលព័ត៌មានលម្អិត', 'Click to view details');
    } else {
      node.removeAttribute('title');
    }
  }

  function formatDisplayDate(isoDate) {
    if (!isoDate) return '—';
    const parts = String(isoDate).split('-');
    if (parts.length !== 3) return String(isoDate);
    let s = `${parts[2]}/${parts[1]}/${parts[0]}`;
    if (!en()) s = s.replace(/[0-9]/g, d => String.fromCharCode(0x17e0 + Number(d)));
    return s;
  }

  function currentContext() {
    return context && context.generation === generation && context.card === cardValue() && context.patient === patientIdentity() && allowed();
  }

  function ensureDialog() {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'hef-dialog nssf-dialog';
    dialog.dataset.languageExclude = '1';
    dialog.dataset.emrTransient = 'true';
    dialog.setAttribute('aria-labelledby', 'nssf_title');

    dialog.innerHTML = `
      <div class="nssf-dialog-header">
        <h2 id="nssf_title">${txt('ផ្ទៀងផ្ទាត់ប័ណ្ណ ប.ស.ស.', 'Verify NSSF Member Card')}</h2>
        <button type="button" class="nssf-dialog-close" id="nssf_close_x" aria-label="Close" data-emr-transient>✕</button>
      </div>
      <div id="nssf_banner" class="hef-banner" data-emr-transient></div>
      <div class="hef-summary-card" data-emr-transient>
        <div class="hef-summary-grid">
          <div class="hef-summary-col">
            <h4 class="hef-col-title" id="nssf_col_card_title">${txt('ព័ត៌មានប័ណ្ណផ្លូវការ', 'Official Card Details')}</h4>
            <div class="hef-info-row">
              <span class="hef-k">${txt('លេខប័ណ្ណ ប.ស.ស.:', 'NSSF Card Number:')}</span>
              <span class="hef-v" id="nssf_val_card_no">—</span>
            </div>
            <div class="hef-info-row">
              <span class="hef-k">${txt('ឈ្មោះសមាជិក:', 'Member Name:')}</span>
              <span class="hef-v nssf-member-name" id="nssf_val_member_name">
                <span id="nssf_val_name_kh">—</span>
                <span id="nssf_val_name_en" class="nssf-name-sub"></span>
              </span>
            </div>
            <div class="hef-info-row">
              <span class="hef-k">${txt('ស្ថានភាពផ្លូវការ:', 'Official Status:')}</span>
              <span class="hef-v" id="nssf_val_status">—</span>
            </div>
            <div class="hef-info-row">
              <span class="hef-k">${txt('សុពលភាពដល់:', 'Valid Until:')}</span>
              <span class="hef-v" id="nssf_val_valid_until">—</span>
            </div>
          </div>
          <div class="hef-summary-col">
            <h4 class="hef-col-title" id="nssf_col_verify_title">${txt('ការផ្ទៀងផ្ទាត់', 'Verification Audit')}</h4>
            <div class="hef-info-row">
              <span class="hef-k">${txt('ប្រភពផ្ទៀងផ្ទាត់:', 'Source:')}</span>
              <span class="hef-v" id="nssf_val_source">NSSF Portal</span>
            </div>
            <div class="hef-info-row">
              <span class="hef-k">${txt('កាលបរិច្ឆេទ:', 'Verified Date:')}</span>
              <span class="hef-v" id="nssf_val_time">—</span>
            </div>
          </div>
        </div>
      </div>
      <div class="nssf-note-box" data-emr-transient>
        ${txt(
          'សម្គាល់៖ ការផ្ទៀងផ្ទាត់នេះសម្រាប់តែពិនិត្យសុពលភាពប័ណ្ណផ្លូវការរបស់ ប.ស.ស. ប៉ុណ្ណោះ។ មិនមានការផ្លាស់ប្តូរប្រភេទបង់ប្រាក់ ឬកែប្រែទិន្នន័យអ្នកជំងឺដោយស្វ័យប្រវត្តិឡើយ។',
          'Notice: This verification confirms official NSSF membership validity only. It does not import personal demographics or automatically alter payment category.'
        )}
      </div>
      <div class="nssf-actions" data-emr-transient>
        <button id="nssf_dialog_close_btn" type="button" class="btn-grey" data-emr-transient>${txt('បិទ', 'Close')}</button>
      </div>
    `;

    document.body.appendChild(dialog);

    const closeBtn = byId('nssf_dialog_close_btn');
    if (closeBtn) closeBtn.addEventListener('click', () => dialog.close());
    const closeX = byId('nssf_close_x');
    if (closeX) closeX.addEventListener('click', () => dialog.close());

    return dialog;
  }

  function renderDialog(data) {
    const modal = ensureDialog();
    const banner = byId('nssf_banner');
    const isEn = en();

    if (banner) {
      if (data.card?.valid === true) {
        banner.className = 'hef-banner hef-banner-success';
        banner.innerHTML = `<span class="hef-banner-icon">✔</span> <span class="hef-banner-text">${txt('ប័ណ្ណមានសុពលភាពផ្លូវការ (ប.ស.ស.)', 'Officially Valid NSSF Member')}</span>`;
      } else if (data.card?.status === 'EXPIRED') {
        banner.className = 'hef-banner hef-banner-danger';
        banner.innerHTML = `<span class="hef-banner-icon">✖</span> <span class="hef-banner-text">${txt('ប័ណ្ណផុតសុពលភាព', 'Expired NSSF Membership')}</span>`;
      } else if (data.card?.status === 'NOT_FOUND') {
        banner.className = 'hef-banner hef-banner-danger';
        banner.innerHTML = `<span class="hef-banner-icon">✖</span> <span class="hef-banner-text">${txt('រកមិនឃើញទិន្នន័យប័ណ្ណ', 'NSSF Member Not Found')}</span>`;
      } else if (data.card?.valid === false) {
        banner.className = 'hef-banner hef-banner-danger';
        banner.innerHTML = `<span class="hef-banner-icon">✖</span> <span class="hef-banner-text">${txt('ប័ណ្ណគ្មានសុពលភាព / អសកម្ម', 'Inactive / Ineligible NSSF Member')}</span>`;
      } else {
        banner.className = 'hef-banner hef-banner-warning';
        banner.innerHTML = `<span class="hef-banner-icon">!</span> <span class="hef-banner-text">${txt('មិនអាចផ្ទៀងផ្ទាត់បាន', 'Unable to Verify')}</span>`;
      }
    }

    if (byId('nssf_val_card_no')) byId('nssf_val_card_no').textContent = data.card?.number || data.requestedCard || '—';
    const khNode = byId('nssf_val_name_kh');
    const enNode = byId('nssf_val_name_en');
    const nameKh = data.card?.nameKh || '';
    const nameEn = data.card?.nameEn || '';
    if (khNode) {
      khNode.textContent = nameKh || (nameEn ? '' : '—');
      if (khNode.style) khNode.style.display = (nameKh || !nameEn) ? 'block' : 'none';
    }
    if (enNode) {
      enNode.textContent = nameEn;
      if (enNode.style) enNode.style.display = nameEn ? 'block' : 'none';
    }
    if (byId('nssf_val_status')) byId('nssf_val_status').textContent = isEn ? (data.card?.statusEn || data.card?.status || data.error || '—') : (data.card?.statusKh || data.card?.status || data.error || '—');
    if (byId('nssf_val_valid_until')) byId('nssf_val_valid_until').textContent = data.card?.validityType === 'INDEFINITE'
      ? txt('សុពលភាពមិនកំណត់','Valid indefinitely') : formatDisplayDate(data.card?.endEligibleDate);
    if (byId('nssf_val_time')) byId('nssf_val_time').textContent = data.verifiedAt ? new Date(data.verifiedAt).toLocaleString() : '—';

    if (!modal.open) modal.showModal();
  }

  async function verify(options = {}) {
    const openModal = Boolean(options?.openModal);
    clearTimeout(timer);

    if (!allowed()) {
      setMessage('មិនអាចផ្ទៀងផ្ទាត់ក្នុងសិទ្ធិនេះ', 'Registration access required.', 'unknown');
      return;
    }

    const card = cardValue();
    if (!/^\d{4,20}$/.test(card)) {
      if (openModal) {
        setMessage('សូមបញ្ចូលលេខប័ណ្ណ ប.ស.ស. ត្រឹមត្រូវ', 'Enter a valid numeric NSSF card number.', 'unknown');
      }
      return;
    }

    controller?.abort();
    controller = new AbortController();
    const token = ++generation;
    const ownController = controller;

    context = { generation: token, card, patient: patientIdentity() };
    result = null;
    const oldMetadata = byId('web_nssf_verification');
    if (oldMetadata) oldMetadata.value = '';
    setMessage('កំពុងផ្ទៀងផ្ទាត់…', 'Verifying with NSSF portal…', 'unknown');

    try {
      let csrf = window.emrSession?.csrfToken;
      if (!csrf) {
        const me = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
        if (!me.ok) throw new Error(txt('សូមចូលគណនីឡើងវិញ', 'Please sign in again.'));
        csrf = (await me.json()).csrfToken;
      }
      if (token !== generation || !currentContext()) return;

      const response = await fetch('/api/nssf/verify', {
        method: 'POST',
        credentials: 'same-origin',
        signal: ownController.signal,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf
        },
        body: JSON.stringify({ cardNumber: card })
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || txt('ការផ្ទៀងផ្ទាត់បរាជ័យ', 'Verification failed.'));
      }

      // Stale response guard
      if (token !== generation || !currentContext()) {
        return;
      }

      result = data;

      // Update inline status text and visual state
      if (data.card?.valid === true) {
        setMessage('✔ មានសុពលភាពផ្លូវការ (ប.ស.ស.)', '✔ Officially Valid (NSSF)', 'valid');
      } else if (data.card?.status === 'EXPIRED') {
        setMessage('✖ ប័ណ្ណផុតសុពលភាព', '✖ Card Expired', 'invalid');
      } else if (data.card?.status === 'NOT_FOUND') {
        setMessage('✖ រកមិនឃើញទិន្នន័យ', '✖ Card Not Found', 'invalid');
      } else if (data.card?.valid === false) {
        setMessage('✖ ប័ណ្ណគ្មានសុពលភាព', '✖ Card Inactive / Invalid', 'invalid');
      } else {
        setMessage('! មិនច្បាស់លាស់', '! Status Unknown', 'unknown');
      }

      // Save transient verification metadata (does not shift field index or change clinical data)
      const metadataNode = byId('web_nssf_verification');
      if (metadataNode) {
        metadataNode.value = JSON.stringify({
          source: data.source,
          verifiedAt: data.verifiedAt,
          card: data.card
        });
        metadataNode.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (openModal) {
        renderDialog(data);
      }
    } catch (error) {
      if (token === generation && currentContext() && error.name !== 'AbortError') {
        const msg = error.message || txt('មិនអាចផ្ទៀងផ្ទាត់បាន', 'Unable to verify');
        setMessage(
          txt('! មិនអាចផ្ទៀងផ្ទាត់: ', '! Unable to verify: ') + msg,
          txt('! មិនអាចផ្ទៀងផ្ទាត់: ', '! Unable to verify: ') + msg,
          'unknown'
        );
        if (openModal) {
          renderDialog({
            requestedCard: card,
            card: {
              number: card,
              valid: null,
              status: 'ERROR',
              statusKh: 'មិនអាចផ្ទៀងផ្ទាត់បាន',
              statusEn: 'Unable to Verify',
              endEligibleDate: null
            },
            error: msg
          });
        }
      }
    }
  }

  function invalidate() {
    generation++;
    controller?.abort();
    clearTimeout(timer);
    context = null;
    result = null;
    if (dialog?.open) dialog.close();
    setMessage('');
    const metadataNode = byId('web_nssf_verification');
    if (metadataNode) metadataNode.value = '';
  }

  function updateLanguage() {
    if (byId('nssf_verify_button')) {
      byId('nssf_verify_button').textContent = txt('ផ្ទៀងផ្ទាត់ ប.ស.ស.', 'Verify NSSF');
    }
    if (result && currentContext() && dialog?.open) {
      renderDialog(result);
    }
  }

  function init() {
    if (initialized || !byId('web_nssf') || !byId('nssf_verify_button')) return;
    initialized = true;

    byId('nssf_verify_button').textContent = txt('ផ្ទៀងផ្ទាត់ ប.ស.ស.', 'Verify NSSF');
    byId('nssf_verify_button').addEventListener('click', () => {
      void verify({ openModal: true });
    });

    byId('nssf_verify_status')?.addEventListener('click', () => {
      if (result && currentContext()) renderDialog(result);
    });

    byId('web_nssf').addEventListener('input', event => {
      if (!event.isTrusted) return;
      invalidate();
      const val = cardValue();
      if (/^\d{14}$/.test(val) && allowed()) {
        timer = setTimeout(() => {
          void verify({ openModal: true });
        }, 650);
      }
    });

    byId('web_nssf').addEventListener('keydown', event => {
      if (event.key === 'Enter' && !event.isComposing) {
        event.preventDefault();
        clearTimeout(timer);
        void verify({ openModal: true });
      }
    });

    document.addEventListener('emr:patient-loaded', invalidate);
    byId('nssf_verify_button').disabled = !allowed();
    window.addEventListener('emr-session-ready', () => {
      invalidate();
      if (byId('nssf_verify_button')) {
        byId('nssf_verify_button').disabled = !allowed();
      }
    });
    window.addEventListener('borkeo-language-change', updateLanguage);
  }

  window.addEventListener('DOMContentLoaded', init);
  if (document.readyState !== 'loading') init();
})();
