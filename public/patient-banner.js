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
    dental: 'ផ្នែកធ្មេញ',
    mental: 'ផ្នែកសុខភាពផ្លូវចិត្ត'
  };

  let activePatient = null;

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

    const allergyText = data['scope:medical:id:emr_pmrs_ipd_allergy'] ||
      data['scope:medical:id:emr_pmrs_opd_allergy'] ||
      patient.allergy || '';

    const hasAllergy = Boolean(allergyText && !/^(គ្មាន|no|none|neg|negative|-)$/i.test(allergyText.trim()));

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
      allergyText: hasAllergy ? allergyText : '',
      serviceMode,
      isDischarged,
      isPaid,
      raw: patient
    };
  }

  // Render the sticky patient banner into container
  function renderPatientBanner(info) {
    let banner = document.getElementById('emr-persistent-patient-banner');
    if (!banner) {
      banner = document.createElement('section');
      banner.id = 'emr-persistent-patient-banner';
      banner.className = 'emr-patient-banner no-print';
      banner.setAttribute('aria-label', 'ព័ត៌មានអ្នកជំងឺបច្ចុប្បន្ន');

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

    const allergyHtml = info.hasAllergy
      ? `<span class="emr-banner-badge allergy-alert" title="${escapeHtml(info.allergyText)}"><svg><use href="/public/icons.svg#icon-alert-triangle"></use></svg> អាលែកហ្ស៊ី៖ ${escapeHtml(info.allergyText)}</span>`
      : `<span class="emr-banner-badge allergy-none"><svg><use href="/public/icons.svg#icon-check"></use></svg> គ្មានប្រវត្តិអាលែកហ្ស៊ី</span>`;

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
      </div>
    `;
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
                ${meds.map(m => `<li><strong>${escapeHtml(m.name)}</strong> · ${escapeHtml(m.doseAmount || '')} ${escapeHtml(m.unit || '')}</li>`).join('')}
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

  // Setup the 7 Chart Tabs on EMR.html
  function setupChartTabs(patient) {
    if (window.location.pathname !== '/emr') return;

    let tabsContainer = document.getElementById('emr-chart-tabs-wrapper');
    if (!tabsContainer) {
      tabsContainer = document.createElement('div');
      tabsContainer.id = 'emr-chart-tabs-wrapper';
      tabsContainer.className = 'emr-chart-tabs-wrap no-print';
      tabsContainer.innerHTML = `
        <nav class="emr-chart-tabs" role="tablist" aria-label="ផ្ទាំងឯកសារអ្នកជំងឺ">
          <button type="button" class="emr-chart-tab is-active" role="tab" data-chart-tab="summary" aria-selected="true">
            <svg><use href="/public/icons.svg#icon-home"></use></svg>
            <span>សង្ខេប</span>
          </button>
          <button type="button" class="emr-chart-tab" role="tab" data-chart-tab="vitals" aria-selected="false">
            <svg><use href="/public/icons.svg#icon-activity"></use></svg>
            <span>សញ្ញាជីវិត</span>
          </button>
          <button type="button" class="emr-chart-tab" role="tab" data-chart-tab="orders" aria-selected="false">
            <svg><use href="/public/icons.svg#icon-clipboard"></use></svg>
            <span>បញ្ជា</span>
          </button>
          <button type="button" class="emr-chart-tab" role="tab" data-chart-tab="results" aria-selected="false">
            <svg><use href="/public/icons.svg#icon-file-text"></use></svg>
            <span>លទ្ធផល</span>
          </button>
          <button type="button" class="emr-chart-tab" role="tab" data-chart-tab="meds" aria-selected="false">
            <svg><use href="/public/icons.svg#icon-pill"></use></svg>
            <span>ឱសថ</span>
          </button>
          <button type="button" class="emr-chart-tab" role="tab" data-chart-tab="notes" aria-selected="false">
            <svg><use href="/public/icons.svg#icon-edit"></use></svg>
            <span>កំណត់ត្រា</span>
          </button>
          <button type="button" class="emr-chart-tab" role="tab" data-chart-tab="billing" aria-selected="false">
            <svg><use href="/public/icons.svg#icon-dollar"></use></svg>
            <span>បេឡា</span>
          </button>
        </nav>
      `;

      const banner = document.getElementById('emr-persistent-patient-banner');
      if (banner) {
        banner.insertAdjacentElement('afterend', tabsContainer);
      } else {
        const main = document.getElementById('main-content') || document.querySelector('main');
        if (main) main.prepend(tabsContainer);
      }
    }

    // Mount or update Summary Dashboard
    const oldDash = document.getElementById('emr-summary-dashboard-panel');
    const newDash = createSummaryDashboard(patient);
    if (oldDash) oldDash.replaceWith(newDash);
    else {
      tabsContainer.insertAdjacentElement('afterend', newDash);
    }

    // Handle Tab Click and Panel Switching
    const tabs = tabsContainer.querySelectorAll('.emr-chart-tab');
    function activateTab(tabName) {
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
      }
    }

    tabs.forEach(tab => {
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

  // Hook into EMR events
  document.addEventListener('emr:patient-loaded', event => {
    activePatient = event.detail?.patient;
    if (activePatient) {
      const parsed = parsePatientData(activePatient);
      renderPatientBanner(parsed);
      setupChartTabs(activePatient);
    }
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
