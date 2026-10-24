/**
 * Borkeo EMR - Persistent Sticky Patient Banner & Chart Layout Controller (Phase 4)
 * WCAG 2.2 AA / IEC 62366-1 Compliant Medical Presentation Layer.
 * Supports all clinical screens (EMR, Lab, Imaging, Pharmacy, Billing).
 */

'use strict';

(function initPatientBannerAndChart() {
  if (window.location.pathname === '/login' || window.location.pathname === '/print-preview') {
    return;
  }

  const escapeHtml = window.escapeHtml || function (v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  };

  const PAYER_LABELS = {
    HEF: { text: 'មូលនិធិសមធម៌ (HEF)', class: 'payer-hef' },
    NSSF: { text: 'ប.ស.ស. (NSSF)', class: 'payer-nssf' },
    DIRECT: { text: 'បង់ផ្ទាល់ (Direct)', class: 'payer-direct' },
    FREE: { text: 'មិនគិតថ្លៃ (Free)', class: 'payer-free' },
    DISCOUNT: { text: 'បញ្ចុះតម្លៃ', class: 'payer-direct' },
    FULL_WAIVER: { text: 'លើកលែងការបង់', class: 'payer-free' }
  };

  const WARD_LABELS = {
    opd: 'ផ្នែកពិគ្រោះក្រៅ',
    medicine: 'ផ្នែកជំងឺទូទៅ',
    surgery: 'ផ្នែកវះកាត់',
    pediatrics: 'ផ្នែកជំងឺកុមារ',
    maternity: 'ផ្នែកសម្ភព',
    obstetric: 'ផ្នែកសម្ភព',
    gynecology: 'ផ្នែករោគស្ត្រី',
    emergency: 'ផ្នែកសង្គ្រោះបន្ទាន់',
    tb: 'ផ្នែកជំងឺរបេង',
    infectious: 'ផ្នែកជំងឺឆ្លង',
    dental: 'ផ្នែកធ្មេញ',
    mental: 'ផ្នែកសុខភាពផ្លូវចិត្ត'
  };

  let activePatient = null;

  // ---- v41.0 clinical summary: structured allergies, active problem list and
  // resuscitation status (/api/clinical-summary). The EMR page editors
  // (public/clinical-summary.js) use the same state through window.EmrClinicalSummary.
  const RECORD_DRUG_ALLERGY_CHECK = 'scope:medical:auto:82';
  const RECORD_DRUG_ALLERGY_TEXT = 'scope:medical:auto:83';
  // The banner's original "no allergy" words (kept as written), plus nil / NKA / NKDA.
  function recordTextIsAllergy(allergyText) {
    const hasAllergy = Boolean(allergyText && !/^(គ្មាន|no|none|neg|negative|-)$/i.test(allergyText.trim()));
    return hasAllergy && !/^(nil|nka|nkda)$/i.test(allergyText.trim());
  }
  const english = () => window.getBorkeoLanguage?.() === 'en' || window.currentLang === 'english';
  // Approved Khmer (docs/approved-new-khmer.json) or a highlighted English
  // placeholder (public/new-text.js) for text that has no approved Khmer yet.
  function label(key, en, kh) {
    if (english()) return escapeHtml(en);
    if (kh) return escapeHtml(kh);
    return window.newTextHtml ? window.newTextHtml(key, en) : escapeHtml(en);
  }
  function plainLabel(key, en, kh) {
    if (english()) return en;
    return kh || (window.newText ? window.newText(key, en) : en);
  }
  const OPTION_LABELS = {
    allergyType: { drug: 'Drug', food: 'Food', other: 'Other' },
    severity: { mild: 'Mild', moderate: 'Moderate', severe: 'Severe', 'life-threatening': 'Life-threatening', unknown: 'Unknown' },
    resuscitation: { full: 'Full resuscitation', dnr: 'Do not resuscitate (DNR)' }
  };
  const optionLabel = (group, code) => label(`clinical.${group}.${code}`, OPTION_LABELS[group]?.[code] || code);
  const plainOptionLabel = (group, code) => plainLabel(`clinical.${group}.${code}`, OPTION_LABELS[group]?.[code] || code);

  const summaryState = { patientKey: '', summary: null, loading: null };

  function allergyState(patient) {
    const data = patient?.data || {};
    const freeText = String(data[RECORD_DRUG_ALLERGY_TEXT] || '').trim();
    const ticked = data[RECORD_DRUG_ALLERGY_CHECK] === true;
    const known = summaryState.patientKey && summaryState.patientKey === patient?.patientKey ? summaryState.summary : null;
    const items = known?.allergies || patient?.allergyAlert?.items || [];
    const freeTextIsNone = Boolean(freeText) && !recordTextIsAllergy(freeText);
    const state = items.length || (freeText && !freeTextIsNone) || (ticked && !freeTextIsNone) ? 'allergy'
      : freeTextIsNone ? 'none' : 'not-recorded';
    return { state, items, freeText: freeTextIsNone ? '' : freeText, ticked };
  }

  // Same sources as the summary card: latest daily note, else admission or OPD prescription.
  function currentMedications(data) {
    try {
      const records = JSON.parse(data['system:dailyMonitoringRecords'] || '[]');
      const latest = Array.isArray(records) ? records[records.length - 1] : null;
      if (Array.isArray(latest?.medications) && latest.medications.length) return latest.medications;
      for (const key of ['system:initialIpdMedications', 'system:opdMedications']) {
        const list = JSON.parse(data[key] || '[]');
        if (Array.isArray(list) && list.length) return list;
      }
    } catch {}
    return [];
  }

  // Risk flags shown only from what is already recorded (no clinical rules invented):
  // a severe or life-threatening allergy, and a DNR status. See docs/clinical-review.md.
  function riskFlags(summary) {
    const flags = [];
    (summary?.allergies || []).filter(a => a.severity === 'severe' || a.severity === 'life-threatening')
      .forEach(a => flags.push(`${a.substance} (${plainOptionLabel('severity', a.severity)})`));
    if (summary?.resuscitation?.status === 'dnr') flags.push(plainOptionLabel('resuscitation', 'dnr'));
    return flags;
  }

  const currentRole = () => String(window.emrSession?.user?.activeRole || window.userRole || '').toUpperCase();
  const canWriteSummary = () => currentRole() === 'DOCTOR';

  async function loadClinicalSummary(patientKey) {
    if (!patientKey) return null;
    const request = fetch(`/api/clinical-summary?patientKey=${encodeURIComponent(patientKey)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then(response => (response.ok ? response.json() : null)).catch(() => null);
    summaryState.loading = request;
    const summary = await request;
    if (summaryState.loading !== request) return summaryState.summary;
    summaryState.patientKey = patientKey;
    summaryState.summary = summary;
    summaryChanged();
    return summary;
  }

  // POST /api/clinical-summary/<path>; returns { ok, error }.
  async function postClinicalSummary(path, body) {
    const patientKey = summaryState.patientKey || activePatient?.patientKey;
    try {
      const response = await fetch(`/api/clinical-summary/${path}`, {
        method: 'POST', credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.emrSession?.csrfToken || '' },
        body: JSON.stringify({ ...body, patientKey })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) return { ok: false, error: result.error || String(response.status) };
      summaryState.patientKey = patientKey;
      summaryState.summary = result;
      summaryChanged();
      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message };
    }
  }

  function summaryChanged() {
    if (activePatient) renderPatientBanner(parsePatientData(activePatient));
    document.dispatchEvent(new CustomEvent('emr:clinical-summary', { detail: { patientKey: summaryState.patientKey, summary: summaryState.summary } }));
  }

  // v41.7: record view log - the page reports printing (and exports) of the open
  // patient record (/api/record-access-log). Opening is logged by the server.
  let lastLogged = { key: '', at: 0 };
  function currentPatientKey() {
    const params = new URLSearchParams(window.location.search);
    return activePatient?.patientKey || window.getLoadedEmrPatient?.()?.patientKey || params.get('patientKey') || params.get('patient') || '';
  }
  window.logRecordAccess = function logRecordAccess(action, detail = '') {
    const patientKey = currentPatientKey();
    if (!patientKey || !['print', 'export'].includes(action)) return;
    const key = `${action}|${patientKey}|${detail}`;
    if (lastLogged.key === key && Date.now() - lastLogged.at < 3000) return; // one click, one entry
    lastLogged = { key, at: Date.now() };
    fetch('/api/record-access-log', {
      method: 'POST', credentials: 'same-origin', keepalive: true,
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.emrSession?.csrfToken || '' },
      body: JSON.stringify({ patientKey, action, detail: String(detail || document.title || '').slice(0, 200) }),
    }).catch(() => {});
  };
  // Printing with the browser's own print command (Ctrl P) is logged too.
  window.addEventListener('beforeprint', () => window.logRecordAccess('print', document.title));

  window.EmrClinicalSummary = {
    get: () => (summaryState.summary ? { patientKey: summaryState.patientKey, summary: summaryState.summary } : null),
    patient: () => activePatient,
    refresh: () => loadClinicalSummary(activePatient?.patientKey),
    post: postClinicalSummary,
    canWrite: canWriteSummary,
    allergyState: () => allergyState(activePatient),
    label, plainLabel, optionLabel, plainOptionLabel, english, escapeHtml
  };

  // Extract patient details from loaded object or existing DOM
  function parsePatientData(patient) {
    if (!patient) return null;
    const data = patient.data || {};

    const fullName = patient.fullName || [patient.lastName, patient.firstName].filter(Boolean).join(' ') ||
      document.getElementById('display_name')?.textContent?.trim() ||
      document.getElementById('web_last_name')?.value || '';

    const age = patient.age || document.getElementById('web_age')?.value || '';
    const sex = patient.sex || (document.querySelector('input[name="web_sex"]:checked')?.value) || '';
    const caseNumber = patient.caseNumber || document.getElementById('web_adm_no')?.value || '';
    const healthId = patient.healthId || document.getElementById('web_health_id')?.value || '';
    const photo = patient.photo || data['system:patientPhoto'] || data['scope:registration:id:web_patient_photo'] ||
      document.getElementById('web_patient_photo')?.value || '';

    const wardCode = patient.departmentCode || data['scope:registration:id:web_department'] || '';
    const wardName = WARD_LABELS[wardCode] || patient.departmentNameKh || wardCode || '';
    const bedId = patient.bedId || data['system:bedNumber'] || data['scope:medical:id:bed_id'] || '';

    const paymentType = patient.paymentType || patient.paymentStatus?.type || data['system:paymentType'] || '';
    const payer = PAYER_LABELS[paymentType] || (paymentType ? { text: paymentType, class: 'payer-direct' } : null);

    // v41.0: the drug allergy is read from the record's own fields (the old
    // emr_pmrs_*_allergy keys never existed, so the banner always said "no
    // allergy") and from the structured allergy record (/api/clinical-summary).
    const allergy = allergyState(patient);
    const allergyText = [allergy.items.map(item => item.substance).join(', '), allergy.freeText].filter(Boolean).join(' · ');
    const hasAllergy = allergy.state === 'allergy';

    const serviceMode = patient.serviceMode || (wardCode === 'opd' ? 'opd' : 'ipd');
    const isDischarged = patient.admissionStatus === 'discharged' || Boolean(patient.dischargeDate);
    const isPaid = patient.paymentStatus?.code === 'PAID';

    return {
      fullName: fullName.trim() || 'មិនបានបញ្ជាក់',
      age: age ? (String(age).includes('ឆ្នាំ') || String(age).includes('ខែ') ? age : `${age} ឆ្នាំ`) : 'មិនបានបញ្ជាក់',
      sex: sex || 'មិនបានបញ្ជាក់',
      caseNumber: caseNumber || 'មិនបានបញ្ជាក់',
      healthId: healthId || 'មិនបានបញ្ជាក់',
      photo,
      wardName: wardName || 'មិនបានបញ្ជាក់',
      bedId: bedId ? `គ្រែ ${bedId}` : (serviceMode === 'opd' ? 'សេវាក្រៅ' : 'មិនទាន់មានគ្រែ'),
      payer,
      hasAllergy,
      allergyState: allergy.state,
      allergyText: hasAllergy ? allergyText : '',
      serviceMode,
      isDischarged,
      isPaid,
      raw: patient
    };
  }

  function isRegistrationUser() {
    const role = String(window.emrSession?.user?.activeRole || window.userRole || sessionStorage.getItem('borkeo-active-role') || '').toUpperCase();
    if (role === 'REGISTRATION') return true;
    const view = new URLSearchParams(window.location.search).get('view');
    if (view === 'register' || view === 'registration') return true;
    if (document.documentElement.classList.contains('registration-user') || document.body?.classList.contains('registration-user') || document.documentElement.classList.contains('on-registration-page') || document.documentElement.classList.contains('bed-direct-register')) return true;
    return false;
  }

  // Render the sticky patient banner into container
  function renderPatientBanner(info) {
    if (isRegistrationUser()) {
      const banner = document.getElementById('emr-persistent-patient-banner');
      if (banner) banner.remove();
      return;
    }
    let banner = document.getElementById('emr-persistent-patient-banner');
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'emr-persistent-patient-banner';
      banner.className = 'emr-patient-banner no-print';
      banner.setAttribute('aria-label', 'ព័ត៌មានអ្នកជំងឺបច្ចុប្បន្ន');
      // Keep sticky tabs below the real header after wrapping, zoom or async alerts.
      if (typeof ResizeObserver !== 'undefined') {
        const observer = new ResizeObserver(() => {
          const height = `${Math.round(banner.getBoundingClientRect().height)}px`;
          if (document.documentElement.style.getPropertyValue('--emr-banner-live-height') !== height) {
            document.documentElement.style.setProperty('--emr-banner-live-height', height);
          }
        });
        observer.observe(banner);
      }

      // Place banner right under topbar / before main-content
      const main = document.getElementById('main-content') || document.querySelector('main, .shell, body > *:first-child');
      if (main) {
        main.insertAdjacentElement('beforebegin', banner);
      } else {
        document.body.prepend(banner);
      }
    }

    if (!info) {
      banner.innerHTML = '';
      return;
    }

    const avatarHtml = info.photo
      ? `<img src="${escapeHtml(info.photo)}" alt="Patient Photo" class="emr-banner-avatar-img">`
      : `<div class="emr-banner-avatar-fallback"><svg><use href="/public/icons.svg#icon-user"></use></svg></div>`;

    // v41.0: three states. "Not recorded" is no longer shown as "no allergy".
    const tickedOnly = info.hasAllergy && !info.allergyText;
    const allergyBadge = info.hasAllergy
      ? `<span class="emr-banner-badge allergy-alert" title="${escapeHtml(info.allergyText)}"><svg><use href="/public/icons.svg#icon-alert-triangle"></use></svg> អាលែកហ្ស៊ី៖ ${tickedOnly ? label('banner.allergy.tickedOnly', 'Drug allergy ticked in the record') : escapeHtml(info.allergyText)}</span>`
      : info.allergyState === 'none'
        ? `<span class="emr-banner-badge allergy-none"><svg><use href="/public/icons.svg#icon-check"></use></svg> គ្មានប្រវត្តិអាលែកហ្ស៊ី</span>`
        : `<span class="emr-banner-badge allergy-unknown"><svg><use href="/public/icons.svg#icon-alert-triangle"></use></svg> ${label('', 'Allergy alert', 'ប្រតិកម្មអាលែកហ្ស៊ី')} · ${label('banner.allergy.notRecorded', 'Allergy not recorded', 'មិនបានបញ្ជាក់')}</span>`;
    const allergyHtml = `<button type="button" class="emr-banner-badge-button" data-banner-details-toggle aria-expanded="${bannerDetailsOpen ? 'true' : 'false'}" aria-controls="emr-banner-summary-panel" aria-label="${escapeHtml(plainLabel('', 'Allergy alert', 'ប្រតិកម្មអាលែកហ្ស៊ី'))}">${allergyBadge}</button>`;

    const payerHtml = info.payer
      ? `<span class="emr-banner-badge ${info.payer.class}">${escapeHtml(info.payer.text)}</span>`
      : `<span class="emr-banner-badge payer-direct">បង់ផ្ទាល់</span>`;

    const statusBadge = info.isDischarged
      ? `<span class="emr-banner-badge muted">បានចេញពីពេទ្យ</span>`
      : `<span class="emr-banner-badge ${info.serviceMode === 'ipd' ? 'status-ipd' : 'status-opd'}">${info.serviceMode === 'ipd' ? 'សម្រាកពេទ្យ (IPD)' : 'ពិគ្រោះក្រៅ (OPD)'}</span>`;

    banner.innerHTML = `
      <div class="emr-banner-identity">
        <div class="emr-banner-avatar-wrap">
          ${avatarHtml}
        </div>
        <div class="emr-banner-titles">
          <div class="emr-banner-name-row">
            <span class="emr-banner-name">${escapeHtml(info.fullName)}</span>
            <span class="emr-banner-demographics">${escapeHtml(info.sex)} · ${escapeHtml(info.age)}</span>
          </div>
          <div class="emr-banner-details">
            <div class="emr-banner-field">
              <span class="emr-banner-field-label">លេខករណី</span>
              <span class="emr-banner-field-value ${info.caseNumber === 'មិនបានបញ្ជាក់' ? 'unknown' : 'highlight'}">${escapeHtml(info.caseNumber)}</span>
            </div>
            <div class="emr-banner-field">
              <span class="emr-banner-field-label">លេខប័ណ្ណសុខភាព</span>
              <span class="emr-banner-field-value ${info.healthId === 'មិនបានបញ្ជាក់' ? 'unknown' : 'highlight'}">${escapeHtml(info.healthId)}</span>
            </div>
            <div class="emr-banner-field">
              <span class="emr-banner-field-label">ផ្នែក & គ្រែ</span>
              <span class="emr-banner-field-value">${escapeHtml(info.wardName)} · ${escapeHtml(info.bedId)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="emr-banner-badges">
        ${allergyHtml}
        ${payerHtml}
        ${statusBadge}
      <button type="button" class="emr-banner-details-button" data-banner-details-toggle aria-expanded="${bannerDetailsOpen ? 'true' : 'false'}" aria-controls="emr-banner-summary-panel" aria-label="${escapeHtml(plainLabel('', 'Patient Summary Banner', 'ផ្ទាំងសង្ខេបព័ត៌មានអ្នកជំងឺ'))}">
        <svg class="emr-banner-details-icon" width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M6 9l6 6 6-6"></path></svg>
        <span>${label('', 'Patient details', 'ផ្ទាំងសង្ខេបព័ត៌មានអ្នកជំងឺ')}</span>
      </button>
      </div>
      ${clinicalRowHtml(info)}
    `;
    banner.classList.toggle('is-details-open', bannerDetailsOpen);
    banner.querySelectorAll('[data-banner-details-toggle]').forEach(button => button.addEventListener('click', toggleBannerDetails));
    renderBannerDetails(banner, info);
    decorateAncBadge(banner);
    // The chart tabs stick just under the banner, whatever its height (v41.0).
    document.documentElement.style.setProperty('--emr-banner-live-height', `${Math.round(banner.getBoundingClientRect().height) || 76}px`);
  }

  // v42.6: colour of the open ANC record (official Ministry of Health colour code).
  const ancBadgeCache = new Map();
  const ANC_COLOUR_KH = { green: 'បៃតង', yellow: 'លឿង', red: 'ក្រហម' };
  const ANC_COLOUR_EN = { green: 'green', yellow: 'yellow', red: 'red' };
  function decorateAncBadge(banner) {
    const key = activePatient?.patientKey || window.getLoadedEmrPatient?.()?.patientKey || '';
    if (!key) return;
    const paint = (colour) => {
      const host = banner.querySelector('.emr-banner-badges');
      if (!colour || !host || host.querySelector('.anc-colour-badge')) return;
      const word = window.getBorkeoLanguage?.() === 'en' ? ANC_COLOUR_EN[colour] : ANC_COLOUR_KH[colour];
      host.insertAdjacentHTML('beforeend', `<span class="emr-banner-badge anc-colour-badge anc-${escapeHtml(colour)}">ANC · ${escapeHtml(word || colour)}</span>`);
    };
    if (ancBadgeCache.has(key)) { paint(ancBadgeCache.get(key)); return; }
    ancBadgeCache.set(key, '');
    fetch(`/api/anc/badge?patientKey=${encodeURIComponent(key)}`, { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : {}))
      .then((body) => { ancBadgeCache.set(key, body.colour || ''); paint(body.colour || ''); })
      .catch(() => {});
  }

  // v41.6: Early Warning Score from public/early-warning.js (medical record page only).
  let earlyWarning = null;
  document.addEventListener('emr:early-warning', (event) => {
    earlyWarning = event.detail || null;
    if (activePatient) renderPatientBanner(parsePatientData(activePatient));
  });

  // ---- v41.0 clinical row (resuscitation status, risk flags, active problems,
  // current medications) and the details panel opened from the banner.
  let bannerDetailsOpen = false;

  function summaryFor(info) {
    const key = info?.raw?.patientKey;
    return key && summaryState.patientKey === key ? summaryState.summary : null;
  }

  function clinicalRowHtml(info) {
    const summary = summaryFor(info);
    const dash = '—';
    const resus = summary?.resuscitation?.status;
    const flags = riskFlags(summary);
    const problems = (summary?.problems || []).filter(p => p.status === 'active');
    const meds = currentMedications(info.raw?.data || {});
    const item = (cls, title, value, extra = '') => `<div class="emr-banner-clinical-item ${cls}"${extra}>
        <span class="emr-banner-field-label">${title}</span>
        <span class="emr-banner-field-value">${value}</span>
      </div>`;
    return `<div class="emr-banner-clinical" aria-label="${escapeHtml(plainLabel('', 'Patient Summary Banner', 'ផ្ទាំងសង្ខេបព័ត៌មានអ្នកជំងឺ'))}">
      ${item(resus === 'dnr' ? 'is-dnr' : '', label('', 'Resuscitation status', 'ស្ថានភាពការសង្គ្រោះជីវិត'),
        resus ? optionLabel('resuscitation', resus) : label('banner.notRecorded', 'Not recorded', 'មិនបានបញ្ជាក់'), ' data-banner-resuscitation')}
      ${item(flags.length ? 'has-flags' : '', label('', 'Risk flags', 'សញ្ញាហានិភ័យ'), flags.length ? escapeHtml(flags.join(' · ')) : dash, ' data-banner-risk-flags')}
      ${earlyWarning ? item(`ews-${earlyWarning.level}`, label('', 'Early Warning Score', 'ពិន្ទុវាយតម្លៃកម្រិតសង្គ្រោះបន្ទាន់'), escapeHtml(earlyWarning.text), ' data-banner-ews') : ''}
      ${item('', label('', 'Active problem list', 'បញ្ជីបញ្ហាសុខភាពកំពុងជួបប្រទះ'),
        problems.length ? escapeHtml(problems.map(p => (p.icd10 ? `${p.problem} (${p.icd10})` : p.problem)).join(' · ')) : dash, ' data-banner-problems')}
      ${item('', label('', 'Current medications', 'ឱសថដែលកំពុងប្រើ'),
        meds.length ? `${meds.length} · ${escapeHtml(meds.map(m => m.name).filter(Boolean).join(', '))}` : dash, ' data-banner-medications')}

    </div>`;
  }

  function toggleBannerDetails() {
    bannerDetailsOpen = !bannerDetailsOpen;
    if (activePatient) renderPatientBanner(parsePatientData(activePatient));
    if (bannerDetailsOpen) document.getElementById('emr-banner-summary-panel')?.focus({ preventScroll: true });
  }

  function renderBannerDetails(banner, info) {
    const old = banner.querySelector('#emr-banner-summary-panel');
    if (!bannerDetailsOpen) { old?.remove(); return; }
    const summary = summaryFor(info);
    const allergy = allergyState(info.raw);
    const problems = summary?.problems || [];
    const meds = currentMedications(info.raw?.data || {});
    const empty = `<p class="emr-banner-panel-empty">—</p>`;
    const date = value => (value ? escapeHtml(value) : '—');
    const allergyRows = allergy.items.map(a => `<tr>
        <td>${optionLabel('allergyType', a.allergyType)}</td><td><strong>${escapeHtml(a.substance)}</strong></td><td>${escapeHtml(a.reaction || '—')}</td>
        <td>${a.severity ? optionLabel('severity', a.severity) : '—'}</td><td>${date(a.notedOn)}</td><td>${escapeHtml(a.recordedBy || '—')}</td></tr>`).join('');
    const panel = document.createElement('div');
    panel.id = 'emr-banner-summary-panel';
    panel.className = 'emr-banner-summary-panel';
    panel.tabIndex = -1;
    panel.innerHTML = `
      <section>
        <h3>${label('', 'Structured allergy record', 'កំណត់ត្រាប្រតិកម្មអាលែកហ្ស៊ី')}</h3>
        ${allergyRows ? `<div class="emr-banner-table-wrap"><table class="emr-banner-table">
          <thead><tr><th>${label('clinical.allergy.type', 'Type')}</th><th>${label('', 'Substance', 'សារធាតុ')}</th><th>${label('', 'Reaction', 'ប្រតិកម្ម')}</th>
          <th>${label('', 'Severity', 'កម្រិតធ្ងន់ធ្ងរ')}</th><th>${label('', 'Date', 'កាលបរិច្ឆេទ')}</th><th>${label('', 'Recorded by', 'អ្នកកត់ត្រា')}</th></tr></thead>
          <tbody>${allergyRows}</tbody></table></div>` : ''}
        ${allergy.freeText || allergy.ticked ? `<p class="emr-banner-record-text"><span>${label('clinical.allergy.recordText', 'Drug allergy written in the medical record')}</span> ${allergy.freeText ? escapeHtml(allergy.freeText) : label('banner.allergy.tickedOnly', 'Drug allergy ticked in the record')}</p>` : ''}
        ${!allergyRows && !allergy.freeText && !allergy.ticked ? `<p class="emr-banner-panel-empty">${allergy.state === 'none' ? 'គ្មានប្រវត្តិអាលែកហ្ស៊ី' : label('banner.allergy.notRecorded', 'Allergy not recorded', 'មិនបានបញ្ជាក់')}</p>` : ''}
      </section>
      <section>
        <h3>${label('', 'Active problem list', 'បញ្ជីបញ្ហាសុខភាពកំពុងជួបប្រទះ')}</h3>
        ${problems.filter(p => p.status === 'active').length ? `<ul>${problems.filter(p => p.status === 'active').map(p => `<li><strong>${escapeHtml(p.problem)}</strong>${p.icd10 ? ` <span class="emr-banner-code">${escapeHtml(p.icd10)}</span>` : ''}${p.notedOn ? ` · ${escapeHtml(p.notedOn)}` : ''}</li>`).join('')}</ul>` : empty}
      </section>
      <section>
        <h3>${label('', 'Current medications', 'ឱសថដែលកំពុងប្រើ')}</h3>
        ${meds.length ? `<ul>${meds.map(m => `<li><strong>${escapeHtml(m.name || '')}</strong> ${escapeHtml([m.doseAmount, (window.BorkeoMedicineUnits?.canonical(m.unit) ?? m.unit)].filter(Boolean).join(' '))}</li>`).join('')}</ul>` : empty}
      </section>
      <section data-banner-resuscitation-section>
        <h3>${label('', 'Resuscitation status', 'ស្ថានភាពការសង្គ្រោះជីវិត')}</h3>
        <p>${summary?.resuscitation ? `<strong>${optionLabel('resuscitation', summary.resuscitation.status)}</strong> · ${escapeHtml(summary.resuscitation.recordedBy || '')} · ${escapeHtml(new Date(summary.resuscitation.recordedAt).toLocaleString())}` : label('banner.notRecorded', 'Not recorded', 'មិនបានបញ្ជាក់')}</p>
        ${summary && canWriteSummary() ? `<div class="emr-banner-resus-form">
          <select data-emr-transient data-banner-resus-select aria-label="${escapeHtml(plainLabel('', 'Resuscitation status', 'ស្ថានភាពការសង្គ្រោះជីវិត'))}">
            ${(summary.options?.resuscitationStatuses || []).map(code => `<option value="${escapeHtml(code)}"${summary.resuscitation?.status === code ? ' selected' : ''}>${escapeHtml(plainOptionLabel('resuscitation', code))}</option>`).join('')}
          </select>
          <button type="button" class="emr-banner-small-button" data-banner-resus-save>${label('clinical.save', 'Save')}</button>
          <span class="emr-banner-form-message" data-banner-resus-message role="status"></span>
        </div>` : ''}
      </section>`;
    if (old) old.replaceWith(panel); else banner.appendChild(panel);
    panel.querySelector('[data-banner-resus-save]')?.addEventListener('click', async event => {
      const button = event.currentTarget;
      button.disabled = true;
      const result = await postClinicalSummary('resuscitation', { status: panel.querySelector('[data-banner-resus-select]').value });
      if (!result.ok) {
        button.disabled = false;
        const message = panel.querySelector('[data-banner-resus-message]');
        if (message) message.textContent = result.error;
      }
    });
  }

  // Build the patient summary dashboard card view
  function createSummaryDashboard(patient) {
    const data = patient.data || {};
    const dashboard = document.createElement('div');
    dashboard.id = 'emr-summary-dashboard-panel';
    dashboard.className = 'emr-summary-dashboard';

    // 1. Latest Vitals & Trend Series
    let allRecords = [];
    try {
      if (data['system:dailyMonitoringRecords']) {
        allRecords = JSON.parse(data['system:dailyMonitoringRecords']);
        if (!Array.isArray(allRecords)) allRecords = [];
      }
    } catch {}
    const vitals = allRecords[allRecords.length - 1] || {};

    const tempSeries = allRecords.map(r => parseFloat(r.temp)).filter(n => !isNaN(n));
    const bpSysSeries = allRecords.map(r => parseFloat(r.bp_sys)).filter(n => !isNaN(n));
    const pulseSeries = allRecords.map(r => parseFloat(r.pulse)).filter(n => !isNaN(n));
    const respSeries = allRecords.map(r => parseFloat(r.resp)).filter(n => !isNaN(n));
    const spo2Series = allRecords.map(r => parseFloat(r.spo2)).filter(n => !isNaN(n));

    const tempSpark = window.EmrVitalsChart?.renderSparkline(tempSeries, {
      stroke: parseFloat(vitals.temp) >= 38 ? '#ea580c' : '#0284c7'
    }) || '';
    const bpSpark = window.EmrVitalsChart?.renderSparkline(bpSysSeries, { stroke: '#7c3aed' }) || '';
    const pulseSpark = window.EmrVitalsChart?.renderSparkline(pulseSeries, { stroke: '#0284c7' }) || '';
    const respSpark = window.EmrVitalsChart?.renderSparkline(respSeries, { stroke: '#0d9488' }) || '';
    const spo2Spark = window.EmrVitalsChart?.renderSparkline(spo2Series, {
      stroke: parseFloat(vitals.spo2) < 95 && vitals.spo2 ? '#dc2626' : '#16a34a'
    }) || '';

    const temp = vitals.temp || data['scope:triage:id:web_triage_temp'] || '';
    const bp = (vitals.bp_sys && vitals.bp_dia) ? `${vitals.bp_sys}/${vitals.bp_dia}` :
      (data['scope:triage:id:web_triage_bp_sys'] ? `${data['scope:triage:id:web_triage_bp_sys']}/${data['scope:triage:id:web_triage_bp_dia']}` : '');
    const pulse = vitals.pulse || data['scope:triage:id:web_triage_pulse'] || '';
    const resp = vitals.resp || data['scope:triage:id:web_triage_resp'] || '';
    const spo2 = vitals.spo2 || data['scope:triage:id:web_triage_spo2'] || '';

    // 2. Primary Diagnoses & ICD-10
    const primaryDiag = data['scope:medical:id:emr_pmrs_ipd_diagnosis'] ||
      data['scope:medical:id:emr_pmrs_opd_diagnosis'] || vitals.conclusion || '';
    const icd10 = data['scope:medical:id:emr_pmrs_ipd_icd10'] ||
      data['scope:medical:id:emr_pmrs_opd_icd10'] || '';

    // 3. Current Medications
    let meds = [];
    try {
      if (vitals.medications && Array.isArray(vitals.medications)) meds = vitals.medications;
      else if (data['system:initialIpdMedications']) meds = JSON.parse(data['system:initialIpdMedications']);
      else if (data['system:opdMedications']) meds = JSON.parse(data['system:opdMedications']);
    } catch {}

    dashboard.innerHTML = `
      <div class="emr-summary-grid">
        <!-- Vitals Card -->
        <article class="emr-summary-card">
          <header class="emr-summary-card-head">
            <span class="emr-summary-card-title">
              <svg><use href="/public/icons.svg#icon-activity"></use></svg>
              សញ្ញាជីវិតចុងក្រោយ
            </span>
          </header>
          <div class="emr-summary-card-body">
            <div class="emr-vitals-summary-grid">
              <div class="emr-vital-pill ${parseFloat(temp) >= 38 ? 'abnormal' : ''}">
                <span class="emr-vital-label">កម្តៅ (Temp)</span>
                <div class="emr-vital-value-wrap">
                  <div>
                    <span class="emr-vital-value">${escapeHtml(temp || '—')}</span>
                    <span class="emr-vital-unit">°C</span>
                  </div>
                  ${tempSpark}
                </div>
              </div>
              <div class="emr-vital-pill">
                <span class="emr-vital-label">សម្ពាធឈាម (BP)</span>
                <div class="emr-vital-value-wrap">
                  <div>
                    <span class="emr-vital-value">${escapeHtml(bp || '—')}</span>
                    <span class="emr-vital-unit">mmHg</span>
                  </div>
                  ${bpSpark}
                </div>
              </div>
              <div class="emr-vital-pill">
                <span class="emr-vital-label">ជីពចរ (Pulse)</span>
                <div class="emr-vital-value-wrap">
                  <div>
                    <span class="emr-vital-value">${escapeHtml(pulse || '—')}</span>
                    <span class="emr-vital-unit">bpm</span>
                  </div>
                  ${pulseSpark}
                </div>
              </div>
              <div class="emr-vital-pill">
                <span class="emr-vital-label">ដង្ហើម (Resp)</span>
                <div class="emr-vital-value-wrap">
                  <div>
                    <span class="emr-vital-value">${escapeHtml(resp || '—')}</span>
                    <span class="emr-vital-unit">/min</span>
                  </div>
                  ${respSpark}
                </div>
              </div>
              <div class="emr-vital-pill ${parseFloat(spo2) < 95 && spo2 ? 'abnormal' : ''}">
                <span class="emr-vital-label">អុកស៊ីសែន (SpO2)</span>
                <div class="emr-vital-value-wrap">
                  <div>
                    <span class="emr-vital-value">${escapeHtml(spo2 || '—')}</span>
                    <span class="emr-vital-unit">%</span>
                  </div>
                  ${spo2Spark}
                </div>
              </div>
            </div>
          </div>
        </article>

        <!-- Diagnosis Card -->
        <article class="emr-summary-card">
          <header class="emr-summary-card-head">
            <span class="emr-summary-card-title">
              <svg><use href="/public/icons.svg#icon-stethoscope"></use></svg>
              រោគវិនិច្ឆ័យបច្ចុប្បន្ន
            </span>
          </header>
          <div class="emr-summary-card-body">
            ${primaryDiag ? `
              <div class="emr-summary-diag-item">
                <span class="emr-summary-diag-name">${escapeHtml(primaryDiag)}</span>
                ${icd10 ? `<span class="emr-summary-diag-code">ICD: ${escapeHtml(icd10)}</span>` : ''}
              </div>
            ` : '<div class="emr-card-empty">មិនទាន់មានរោគវិនិច្ឆ័យដែលបានកត់ត្រានៅឡើយទេ។</div>'}
          </div>
        </article>

        <!-- Medications Card -->
        <article class="emr-summary-card">
          <header class="emr-summary-card-head">
            <span class="emr-summary-card-title">
              <svg><use href="/public/icons.svg#icon-pill"></use></svg>
              ឱសថកំពុងប្រើប្រាស់ (${meds.length})
            </span>
          </header>
          <div class="emr-summary-card-body">
            ${meds.length ? `
              <ul style="margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.6;">
                ${meds.map(m => `<li><strong>${escapeHtml(m.name)}</strong> · ${escapeHtml(m.doseAmount || '')} ${escapeHtml((window.BorkeoMedicineUnits?.canonical(m.unit) ?? m.unit) || '')}</li>`).join('')}
              </ul>
            ` : '<div class="emr-card-empty">មិនមានឱសថកំពុងប្រើប្រាស់នៅឡើយទេ។</div>'}
          </div>
        </article>

        <!-- Pending Orders & Results Card -->
        <article class="emr-summary-card">
          <header class="emr-summary-card-head">
            <span class="emr-summary-card-title">
              <svg><use href="/public/icons.svg#icon-clipboard"></use></svg>
              ការបញ្ជា និងលទ្ធផលប៉ារ៉ាគ្លីនិក
            </span>
          </header>
          <div class="emr-summary-card-body">
            <div style="font-size: 13px; color: var(--text-secondary);">
              <p>សូមពិនិត្យផ្ទាំង <strong>បញ្ជា (Orders)</strong> ឬ <strong>លទ្ធផល (Results)</strong> ដើម្បីមើលព័ត៌មានលម្អិតអំពីតេស្តមន្ទីរពិសោធន៍ និងរូបភាពវេជ្ជសាស្ត្រ។</p>
            </div>
          </div>
        </article>
      </div>
    `;

    return dashboard;
  }

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

  // Setup the Chart Tabs on EMR.html filtered by active user role
  function setupChartTabs(patient) {
    if (window.location.pathname !== '/emr') return;
    if (isRegistrationUser()) {
      const tabsContainer = document.getElementById('emr-chart-tabs-wrapper');
      if (tabsContainer) tabsContainer.remove();
      const dash = document.getElementById('emr-summary-dashboard-panel');
      if (dash) dash.remove();
      return;
    }

    const currentRole = String(window.emrSession?.user?.activeRole || window.userRole || '').toUpperCase();
    const allowed = getAllowedTabsForRole(currentRole);

    let tabsContainer = document.getElementById('emr-chart-tabs-wrapper');
    if (!tabsContainer) {
      tabsContainer = document.createElement('div');
      tabsContainer.id = 'emr-chart-tabs-wrapper';
      tabsContainer.className = 'emr-chart-tabs-wrap no-print';

      const banner = document.getElementById('emr-persistent-patient-banner');
      if (banner) {
        banner.insertAdjacentElement('afterend', tabsContainer);
      } else {
        const main = document.getElementById('main-content') || document.querySelector('main');
        if (main) main.prepend(tabsContainer);
      }
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

    // Mount or update Summary Dashboard
    const oldDash = document.getElementById('emr-summary-dashboard-panel');
    const newDash = createSummaryDashboard(patient);
    if (oldDash) oldDash.replaceWith(newDash);
    else {
      tabsContainer.insertAdjacentElement('afterend', newDash);
    }

    // Handle Tab Click and Panel Switching
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

      const dash = document.getElementById('emr-summary-dashboard-panel');
      if (dash) dash.style.display = tabName === 'summary' ? 'flex' : 'none';

      // Keep legacy EMR workflow intact
      if (tabName === 'vitals') {
        window.switchPage?.(2); // Page 2 is Triage / Vitals
        const p2 = document.getElementById('page2');
        if (p2 && allRecords.length >= 2) {
          let trendPanel = document.getElementById('emr-vitals-trends-container');
          if (!trendPanel) {
            trendPanel = document.createElement('div');
            trendPanel.id = 'emr-vitals-trends-container';
            trendPanel.className = 'no-print';
            trendPanel.style.marginBottom = '16px';
            p2.prepend(trendPanel);
          }
          trendPanel.innerHTML = window.EmrVitalsChart?.renderVitalsTrendPanel(allRecords) || '';
        }
      } else if (tabName === 'notes') {
        window.switchPage?.(3); // Page 3 is Clinical / Notes
      } else if (tabName === 'orders') {
        const ordSection = document.getElementById('paraclinic_orders_panel') || document.getElementById('paraclinic-orders-section');
        if (ordSection) {
          ordSection.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (tabName === 'results') {
        const resSection = document.getElementById('paraclinic_results_panel') || document.getElementById('lab_results_panel') || document.getElementById('paraclinic-orders-section');
        if (resSection) {
          resSection.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (tabName === 'meds') {
        const medSection = document.getElementById('ipd-medications-panel') || document.getElementById('medication_history_table') || document.querySelector('.med-table');
        if (medSection) {
          medSection.scrollIntoView({ behavior: 'smooth' });
        }
      } else if (tabName === 'billing') {
        if (patient?.patientKey && ['CLERK', 'ACCOUNTANT', 'ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(currentRole)) {
          window.location.assign(`/billing?patient=${encodeURIComponent(patient.patientKey)}`);
        }
      }
    }

    tabsContainer.querySelectorAll('.emr-chart-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        activateTab(tab.dataset.chartTab);
      });
    });

    // Check direct view parameter from URL
    const viewParam = new URLSearchParams(window.location.search).get('view');
    if (viewParam === 'daily' || viewParam === 'medical' || viewParam === 'opd' || viewParam === 'nursing') {
      activateTab('notes');
    } else if (viewParam === 'triage') {
      activateTab('vitals');
    }
  }
  window.setupChartTabs = setupChartTabs;

  window.addEventListener('emr-session-ready', () => {
    if (activePatient) {
      setupChartTabs(activePatient);
    }
  });

  // Hook into EMR events
  document.addEventListener('emr:patient-loaded', event => {
    activePatient = event.detail?.patient;
    if (activePatient) {
      const parsed = parsePatientData(activePatient);
      renderPatientBanner(parsed);
      setupChartTabs(activePatient);
      loadClinicalSummary(activePatient.patientKey);
    }
  });

  // v41.0: a saved record may change the free-text drug allergy shown in the banner.
  document.addEventListener('emr:patient-saved', event => {
    const saved = event.detail?.patient;
    if (!saved || (activePatient && saved.patientKey !== activePatient.patientKey)) return;
    activePatient = saved;
    renderPatientBanner(parsePatientData(activePatient));
    if (summaryState.patientKey !== saved.patientKey) loadClinicalSummary(saved.patientKey);
  });
  window.addEventListener('borkeo-language-change', () => {
    if (activePatient) renderPatientBanner(parsePatientData(activePatient));
  });

  // URL fallback / initial check on clinical screens
  async function checkInitialPatient() {
    const params = new URLSearchParams(window.location.search);
    const key = params.get('patientKey') || params.get('id') || params.get('key');

    if (key && !activePatient) {
      try {
        const res = await fetch(`/api/patient-record?patientKey=${encodeURIComponent(key)}&readOnly=1`, { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          if (data.patient) {
            activePatient = data.patient;
            const parsed = parsePatientData(activePatient);
            renderPatientBanner(parsed);
            setupChartTabs(activePatient);
            loadClinicalSummary(activePatient.patientKey);
            return;
          }
        }
      } catch {}
    }

    // Try DOM scraping fallback for forms already populated (e.g. lab/imaging)
    setTimeout(() => {
      if (!activePatient) {
        const fallback = parsePatientData({});
        if (fallback && fallback.fullName !== 'មិនបានបញ្ជាក់') {
          renderPatientBanner(fallback);
        }
      }
    }, 600);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkInitialPatient);
  } else {
    checkInitialPatient();
  }
})();
