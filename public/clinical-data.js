/**
 * Borkeo EMR - Clinical Data Display Utilities (Phase 6)
 * Aligned with WCAG 2.2 AA & IEC 62366-1.
 * - Consistent Asia/Phnom_Penh date/time formatting.
 * - Consistent KHR & USD currency formatting with tabular-nums.
 * - Inline-SVG sparkline & vitals trend charts generator.
 * - Laboratory multi-modal flags formatter (Color + Icon + Text).
 * - Unified professional hospital report letterhead.
 */
(function (global) {
  'use strict';

  const PNH_TIMEZONE = 'Asia/Phnom_Penh';

  function toDate(input) {
    if (!input) return null;
    if (input instanceof Date) return isNaN(input.getTime()) ? null : input;
    if (typeof input === 'number') return new Date(input);
    if (typeof input === 'string') {
      const parsed = new Date(input.replace(' ', 'T'));
      return isNaN(parsed.getTime()) ? null : parsed;
    }
    return null;
  }

  function esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // =========================================================================
  // 1. Date, Time & Currency Formatting (Asia/Phnom_Penh & KHR/USD)
  // =========================================================================
  const EmrFormat = {
    timeZone: PNH_TIMEZONE,

    formatDate(input, locale = 'en-CA') {
      const d = toDate(input);
      if (!d) return '—';
      try {
        return new Intl.DateTimeFormat(locale, {
          timeZone: PNH_TIMEZONE,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(d);
      } catch {
        return d.toLocaleDateString();
      }
    },

    formatTime(input, locale = 'en-GB') {
      const d = toDate(input);
      if (!d) return '—';
      try {
        return new Intl.DateTimeFormat(locale, {
          timeZone: PNH_TIMEZONE,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(d);
      } catch {
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
    },

    formatDateTime(input, locale = 'en-GB') {
      const d = toDate(input);
      if (!d) return '—';
      try {
        const datePart = new Intl.DateTimeFormat('en-CA', {
          timeZone: PNH_TIMEZONE,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        }).format(d);
        const timePart = new Intl.DateTimeFormat('en-GB', {
          timeZone: PNH_TIMEZONE,
          hour: '2-digit',
          minute: '2-digit',
          hour12: false
        }).format(d);
        return `${datePart} ${timePart}`;
      } catch {
        return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
      }
    },

    formatCurrency(amount, currency = 'KHR') {
      const val = Number(amount) || 0;
      const isKhr = String(currency || 'KHR').toUpperCase() === 'KHR';
      if (isKhr) {
        const rounded = Math.round(val);
        return `<span class="emr-currency emr-currency-khr emr-tabular-num">${rounded.toLocaleString('en-US')} ៛</span>`;
      }
      return `<span class="emr-currency emr-currency-usd emr-tabular-num">$${val.toFixed(2)}</span>`;
    },

    formatCurrencyPlain(amount, currency = 'KHR') {
      const val = Number(amount) || 0;
      const isKhr = String(currency || 'KHR').toUpperCase() === 'KHR';
      if (isKhr) {
        return `${Math.round(val).toLocaleString('en-US')} ៛`;
      }
      return `$${val.toFixed(2)}`;
    },

    formatNumber(value, options = {}) {
      const val = Number(value);
      if (isNaN(val)) return '—';
      return `<span class="emr-tabular-num">${val.toLocaleString('en-US', options)}</span>`;
    }
  };

  // =========================================================================
  // 2. Multi-Modal Lab Results Flag Formatter (Color + Icon + Text)
  // =========================================================================
  const EmrLabDisplay = {
    flagLabel(flag) {
      switch (flag) {
        case 'LOW':
          return '▼ Low';
        case 'HIGH':
          return '▲ High';
        case 'CRITICAL_LOW':
          return '⚠️▼ Crit Low';
        case 'CRITICAL_HIGH':
          return '⚠️▲ Crit High';
        default:
          return '';
      }
    },

    flagBadgeHtml(flag) {
      if (!flag) return '';
      const text = this.flagLabel(flag);
      const flagClass = flag.toLowerCase().replace('_', '-');
      const ariaText = flag.includes('CRITICAL') ? `គ្រោះថ្នាក់ (Critical): ${text}` : text;
      return `<span class="lab-flag-badge flag-${esc(flagClass)} ${esc(flag)}" role="status" aria-label="${esc(ariaText)}">${esc(text)}</span>`;
    },

    referenceIntervalText(low, high, unit) {
      if (low == null && high == null) return '—';
      const u = unit ? ` ${unit}` : '';
      if (low != null && high != null) return `${low} – ${high}${u}`;
      if (low != null) return `> ${low}${u}`;
      return `< ${high}${u}`;
    }
  };

  // =========================================================================
  // 3. Inline-SVG Vitals Sparkline & Trend Charts Generator
  // =========================================================================
  const EmrVitalsChart = {
    /**
     * Generate an accessible inline SVG sparkline
     * @param {Array<number>} series List of measurements in chronological order
     * @param {Object} options Configuration (width, height, stroke, minNormal, maxNormal)
     * @returns {string} SVG markup string
     */
    renderSparkline(series, options = {}) {
      if (!Array.isArray(series) || series.length < 2) return '';

      const width = options.width || 76;
      const height = options.height || 24;
      const pad = 4;
      const valid = series.filter(n => typeof n === 'number' && !isNaN(n));
      if (valid.length < 2) return '';

      let min = Math.min(...valid);
      let max = Math.max(...valid);
      if (min === max) { min -= 1; max += 1; }

      const count = valid.length;
      const points = valid.map((val, idx) => {
        const x = pad + (idx * (width - 2 * pad)) / (count - 1);
        const y = height - pad - ((val - min) / (max - min)) * (height - 2 * pad);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');

      const lastVal = valid[valid.length - 1];
      const lastX = width - pad;
      const lastY = height - pad - ((lastVal - min) / (max - min)) * (height - 2 * pad);
      const stroke = options.stroke || '#0284c7';

      const trendTitle = `និន្នាការ (${valid.length} ដង): ${valid.join(' → ')}`;

      return `
        <span class="emr-sparkline-wrap" title="${esc(trendTitle)}">
          <svg class="emr-sparkline" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(trendTitle)}">
            <polyline fill="none" stroke="${esc(stroke)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${points}" />
            <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="3" fill="${esc(stroke)}" />
          </svg>
        </span>
      `.trim();
    },

    /**
     * Generate a comprehensive vitals trend panel for the Vitals Chart Tab
     * @param {Array<Object>} monitoringRecords List of daily monitoring records
     * @returns {string} HTML markup
     */
    renderVitalsTrendPanel(monitoringRecords) {
      if (!Array.isArray(monitoringRecords) || monitoringRecords.length === 0) {
        return '<div class="emr-card-empty">មិនទាន់មានទិន្នន័យតាមដានសញ្ញាជីវិតនៅឡើយទេ។</div>';
      }

      const records = [...monitoringRecords].sort((a, b) => {
        return (new Date(a.dtVal || 0).getTime()) - (new Date(b.dtVal || 0).getTime());
      });

      const temps = records.map(r => parseFloat(r.temp)).filter(n => !isNaN(n));
      const bpsSys = records.map(r => parseFloat(r.bp_sys)).filter(n => !isNaN(n));
      const bpsDia = records.map(r => parseFloat(r.bp_dia)).filter(n => !isNaN(n));
      const pulses = records.map(r => parseFloat(r.pulse)).filter(n => !isNaN(n));
      const resps = records.map(r => parseFloat(r.resp)).filter(n => !isNaN(n));
      const spo2s = records.map(r => parseFloat(r.spo2)).filter(n => !isNaN(n));

      const latest = records[records.length - 1] || {};

      const trendCard = (label, value, unit, series, stroke, abnormal) => {
        const sparkline = EmrVitalsChart.renderSparkline(series, { width: 140, height: 38, stroke });
        return `
          <div class="emr-trend-card ${abnormal ? 'abnormal' : ''}">
            <div class="emr-trend-card-title">
              <span>${esc(label)}</span>
              ${series.length > 1 ? `<span class="emr-sparkline-caption">${series.length} កំណត់ត្រា</span>` : ''}
            </div>
            <div class="emr-trend-card-current">
              ${esc(value || '—')} <span style="font-size:12px; font-weight:normal;">${esc(unit)}</span>
            </div>
            <div class="emr-trend-chart-box">
              ${sparkline || '<small style="color:#94a3b8; font-style:italic;">ត្រូវការទិន្នន័យយ៉ាងតិច ២ ដង</small>'}
            </div>
          </div>
        `;
      };

      const bpVal = (latest.bp_sys && latest.bp_dia) ? `${latest.bp_sys}/${latest.bp_dia}` : '—';
      const isTempAbnormal = parseFloat(latest.temp) >= 38;
      const isSpo2Abnormal = parseFloat(latest.spo2) < 95 && Boolean(latest.spo2);

      return `
        <div class="emr-vitals-history-panel">
          <h3 style="margin: 0 0 14px 0; font-size: 15px; color: var(--color-primary-dark, #0369a1); display: flex; align-items: center; gap: 8px;">
            <svg style="width:18px;height:18px;"><use href="/public/icons.svg#icon-activity"></use></svg>
            ប្រវត្តិតាមដានសញ្ញាជីវិត និងនិន្នាការ (Vitals Trends)
          </h3>
          <div class="emr-vitals-trend-grid">
            ${trendCard('កម្តៅ (Temperature)', latest.temp, '°C', temps, isTempAbnormal ? '#ea580c' : '#0284c7', isTempAbnormal)}
            ${trendCard('សម្ពាធឈាម (Blood Pressure)', bpVal, 'mmHg', bpsSys, '#7c3aed', false)}
            ${trendCard('ជីពចរ (Pulse / Heart Rate)', latest.pulse, 'bpm', pulses, '#0284c7', false)}
            ${trendCard('ចង្វាក់ដង្ហើម (Respiration)', latest.resp, '/min', resps, '#0d9488', false)}
            ${trendCard('អុកស៊ីសែន (SpO2)', latest.spo2, '%', spo2s, isSpo2Abnormal ? '#dc2626' : '#16a34a', isSpo2Abnormal)}
          </div>
        </div>
      `;
    }
  };

  // =========================================================================
  // 4. Unified Professional Hospital Print Letterhead (A4 Format)
  // =========================================================================
  const EmrLetterhead = {
    renderLetterhead(options = {}) {
      const khmer = options.lang !== 'en';
      const title = options.title || (khmer ? 'របាយការណ៍វេជ្ជសាស្ត្រ' : 'Medical Report');
      const pageInfo = options.page ? `<span class="emr-print-copy">${esc(options.page)}</span>` : '';

      return `
        <header class="emr-print-letterhead">
          <div class="emr-print-national-heading">
            <div class="emr-print-national-text">
              <div>${khmer ? 'ព្រះរាជាណាចក្រកម្ពុជា' : 'Kingdom of Cambodia'}</div>
              <div>${khmer ? 'ជាតិ សាសនា ព្រះមហាក្សត្រ' : 'Nation Religion King'}</div>
              <img class="emr-print-tacteing" src="/emr-assets/Tacteing-6.png" alt="">
            </div>
            <img class="emr-print-logo" src="/api/organization/logo" alt="Borkeo Referral Hospital logo">
          </div>
          <div class="emr-print-hospital-name">${khmer ? 'មន្ទីរពេទ្យបង្អែក បរកែវ' : 'Borkeo Referral Hospital'}</div>
          <h2 class="emr-print-report-title"><span>${esc(title)}</span>${pageInfo}</h2>
        </header>
      `.trim();
    },

    renderPatientGrid(patientData = {}) {
      const khmer = patientData.lang !== 'en';
      return `
        <div class="emr-print-patient-grid">
          <div><strong>${khmer ? 'លេខកូដអ្នកជំងឺ (Patient ID):' : 'Patient ID:'}</strong> ${esc(patientData.caseId || patientData.healthId || '—')}</div>
          <div><strong>${khmer ? 'ផ្នែក / វួដ (Ward):' : 'Ward / Dept:'}</strong> ${esc(patientData.department || '—')}</div>
          <div><strong>${khmer ? 'ឈ្មោះអ្នកជំងឺ (Name):' : 'Patient Name:'}</strong> <span class="emr-print-patient-name">${esc(patientData.fullName || '—')}</span></div>
          <div><strong>${khmer ? 'ភេទ / អាយុ (Sex/Age):' : 'Sex, Age:'}</strong> ${esc(patientData.sex || '—')} · ${esc(patientData.age || '—')}</div>
          <div style="grid-column: 1 / -1;"><strong>${khmer ? 'រោគវិនិច្ឆ័យ (Diagnosis):' : 'Diagnosis:'}</strong> ${esc(patientData.diagnosis || '—')}</div>
        </div>
      `.trim();
    },

    renderSignatures(signatures = []) {
      if (!Array.isArray(signatures) || signatures.length === 0) return '';
      return `
        <footer class="emr-print-signatures">
          ${signatures.map(sig => `
            <span>
              ${esc(sig.role || '')}<br>
              <b>${esc(sig.name || '')}</b><br>
              <small>${esc(sig.date || '')}</small>
            </span>
          `).join('')}
        </footer>
      `.trim();
    }
  };

  // Expose to window / global
  global.EmrFormat = EmrFormat;
  global.EmrLabDisplay = EmrLabDisplay;
  global.EmrVitalsChart = EmrVitalsChart;
  global.EmrLetterhead = EmrLetterhead;

  // Enhance existing global money function if present or define standard
  if (!global.money) {
    global.money = EmrFormat.formatCurrencyPlain;
  }
})(typeof window !== 'undefined' ? window : globalThis);
