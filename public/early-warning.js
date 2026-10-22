// v41.6 - Early Warning Score (NEWS2, owner's choice) from the latest vital signs.
// The scoring table is configurable (server/clinical-options.json "earlyWarning",
// GET /api/clinical-options) and listed in docs/clinical-review.md for a doctor.
// Vital signs: the latest daily note, otherwise the IPD admission vital signs.
// Oxygen and consciousness: fields ipd_ews_oxygen and ipd_ews_acvpu in the IPD O box.
// Shown in the IPD O box (slot "early-warning-score") and in the patient banner.
// NEWS2 is not used under the configured age or for pregnant women.
'use strict';
(function () {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en' || window.currentLang === 'english';
  const label = (key, en, kh) => (english() ? escapeHtml(en) : kh ? escapeHtml(kh) : window.newTextHtml ? window.newTextHtml(key, en) : escapeHtml(en));
  const plain = (key, en, kh) => (english() ? en : kh || (window.newText ? window.newText(key, en) : en));
  const TITLE = { en: 'Early Warning Score', kh: 'ពិន្ទុវាយតម្លៃកម្រិតសង្គ្រោះបន្ទាន់' }; // approved Khmer (RULE 2)
  const PARAMS = {
    respRate: 'Respiration rate (/min)', spo2: 'SpO2 (%)', onOxygen: 'On oxygen', systolic: 'Systolic BP (mmHg)',
    pulse: 'Pulse (/min)', consciousness: 'Consciousness (ACVPU)', temperature: 'Temperature (°C)',
  };
  const ACVPU = { A: 'Alert', C: 'New confusion', V: 'Responds to voice', P: 'Responds to pain', U: 'Unresponsive' };
  const LEVELS = { low: 'Low', lowMedium: 'Low-medium (one parameter scores 3)', medium: 'Medium', high: 'High' };
  let table = null;

  fetch('/api/clinical-options', { credentials: 'same-origin', cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null)).then((r) => { table = r?.earlyWarning || null; refresh(); }).catch(() => {});

  const num = (value) => { const n = parseFloat(String(value ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
  function bandPoints(bands, value) {
    for (const band of bands) if (band.max === undefined || value <= band.max) return band.points;
    return null;
  }

  // vitals: { respRate, spo2, onOxygen (true/false/null), systolic, pulse, consciousness ('A'..'U'|''), temperature }
  function compute(vitals, config = table) {
    if (!config?.parameters) return null;
    const parts = {};
    const missing = [];
    for (const name of Object.keys(PARAMS)) {
      const rule = config.parameters[name];
      if (!rule) continue;
      const value = vitals[name];
      let points = null;
      if (name === 'onOxygen') points = value === true ? rule.yes : value === false ? rule.no : null;
      else if (name === 'consciousness') points = value ? rule[value] ?? null : null;
      else if (Array.isArray(rule) && num(value) !== null) points = bandPoints(rule, num(value));
      if (points === null || points === undefined) missing.push(name); else parts[name] = points;
    }
    const total = Object.values(parts).reduce((sum, points) => sum + points, 0);
    let level = 'low';
    for (const risk of config.risk || []) {
      if (risk.anySingle !== undefined ? Object.values(parts).some((p) => p >= risk.anySingle) : total >= risk.min) { level = risk.level; break; }
    }
    return { total, parts, missing, level, name: config.name || '' };
  }

  // Applies to the patient? (age from date of birth or typed age; pregnancy: obstetric ward or EDD)
  function applies(patient) {
    const rules = table || {};
    const age = window.EmrDisplayRules?.ageYears?.() ?? num(patient?.age);
    if (rules.minAge && age !== null && age < rules.minAge) return false;
    if (rules.excludePregnant && window.EmrDisplayRules?.pregnant?.()) return false;
    return true;
  }

  const field = (id) => document.getElementById(id);
  // Latest vital signs: daily notes on the page (saved data as fallback), else the IPD admission vitals.
  function latestVitals(patient) {
    const data = patient?.data || {};
    let records = Array.from(document.querySelectorAll('#daily_monitoring_feed .ipd-mon-card')).map((card) => card._monitoringCopyData).filter(Boolean);
    if (!records.length) { try { records = JSON.parse(data['system:dailyMonitoringRecords'] || '[]'); } catch { records = []; } }
    const latest = records.slice().sort((a, b) => String(a.dtVal || '').localeCompare(String(b.dtVal || ''))).pop();
    // What the page shows; the saved value when the field is empty (the IPD vitals are copied from triage on screen).
    const value = (id) => { const shown = field(id)?.value; return shown !== undefined && shown !== '' ? shown : data[`scope:medical:id:${id}`] ?? ''; };
    const oxygenField = field('ipd_ews_oxygen');
    const onOxygen = oxygenField ? oxygenField.checked : (data['scope:medical:id:ipd_ews_oxygen'] === true ? true : data['scope:medical:id:ipd_ews_oxygen'] === false ? false : null);
    const consciousness = value('ipd_ews_acvpu') || '';
    const common = { onOxygen: onOxygen === null ? null : onOxygen, consciousness };
    if (latest && [latest.resp, latest.spo2, latest.bp_sys, latest.pulse, latest.temp].some((v) => num(v) !== null)) {
      return { source: 'daily', at: latest.dtVal || '', vitals: { respRate: latest.resp, spo2: latest.spo2, systolic: latest.bp_sys, pulse: latest.pulse, temperature: latest.temp, ...common } };
    }
    const ipd = { respRate: value('ipd_resp'), spo2: value('ipd_spo2'), systolic: value('ipd_bp_sys'), pulse: value('ipd_pulse'), temperature: value('ipd_temp') };
    if (Object.values(ipd).some((v) => num(v) !== null)) return { source: 'admission', at: '', vitals: { ...ipd, ...common } };
    return null;
  }

  function forPatient(patient) {
    if (!table || !patient) return null;
    if (!applies(patient)) return { notApplicable: true };
    const latest = latestVitals(patient);
    if (!latest) return { noVitals: true };
    return { ...compute(latest.vitals), source: latest.source, at: latest.at };
  }

  const levelLabel = (level) => label(`ews.${level}`, LEVELS[level] || level);
  const levelPlain = (level) => plain(`ews.${level}`, LEVELS[level] || level);

  // Short text for the patient banner.
  function bannerText(patient) {
    const result = forPatient(patient);
    if (!result || result.notApplicable || result.noVitals) return null;
    return { text: `${result.missing.length ? '≥' : ''}${result.total} · ${levelPlain(result.level)}`, level: result.level, incomplete: result.missing.length > 0 };
  }

  function render() {
    const slot = document.querySelector('#sub_ipd [data-soap-slot="early-warning-score"]');
    const out = slot?.querySelector('[data-ews-result]');
    if (!slot || !out) return;
    slot.hidden = false;
    const patient = window.getLoadedEmrPatient?.();
    const result = forPatient(patient);
    if (!table) { out.innerHTML = ''; return; }
    if (!result || result.noVitals) { out.innerHTML = `<p class="ews-note">${label('ews.noVitals', 'No vital signs recorded yet.')}</p>`; return; }
    if (result.notApplicable) { out.innerHTML = `<p class="ews-note">${label('ews.notApplicable', 'NEWS2 is not used for patients under 16 or for pregnant women.')}</p>`; return; }
    const source = result.source === 'daily'
      ? `${label('ews.fromDaily', 'From the daily note of')} ${escapeHtml(String(result.at).replace('T', ' '))}`
      : label('ews.fromAdmission', 'From the admission vital signs');
    out.innerHTML = `<div class="ews-score ews-${escapeHtml(result.level)}"><strong>${result.missing.length ? '≥' : ''}${result.total}</strong>
        <span>${escapeHtml(result.name)} · ${levelLabel(result.level)}</span></div>
      <p class="ews-note">${source}</p>
      ${result.missing.length ? `<p class="ews-missing">${label('ews.incomplete', 'Incomplete, missing:')} ${result.missing.map((name) => label(`ews.${name}`, PARAMS[name])).join(', ')}</p>` : ''}
      <table class="ews-table"><tbody>${Object.keys(PARAMS).map((name) => `<tr><th>${label(`ews.${name}`, PARAMS[name])}</th><td>${result.parts[name] ?? '—'}</td></tr>`).join('')}</tbody></table>`;
  }

  function translateStatic() {
    document.querySelectorAll('#sub_ipd [data-ews-label]').forEach((node) => { node.innerHTML = label(`ews.${node.dataset.ewsLabel}`, PARAMS[node.dataset.ewsLabel] || node.dataset.ewsLabel); });
    document.querySelectorAll('#ipd_ews_acvpu option[value]').forEach((option) => { if (option.value) option.textContent = `${option.value} · ${plain(`ews.${option.value}`, ACVPU[option.value])}`; });
  }

  let timer = null;
  function refresh() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      translateStatic();
      render();
      const patient = window.getLoadedEmrPatient?.();
      if (patient) document.dispatchEvent(new CustomEvent('emr:early-warning', { detail: bannerText(patient) }));
    }, 50);
  }

  document.addEventListener('emr:patient-loaded', refresh);
  document.addEventListener('emr:patient-saved', refresh);
  document.addEventListener('input', (event) => { if (event.target.closest?.('#sub_ipd, #mon_modal')) refresh(); });
  document.addEventListener('change', (event) => { if (event.target.closest?.('#sub_ipd, #mon_modal, #web_age, #web_dob')) refresh(); });
  document.addEventListener('click', (event) => { if (event.target.closest?.('#mon_modal .modal-actions, [data-daily-save]')) setTimeout(refresh, 300); });
  window.addEventListener('borkeo-language-change', refresh);
  window.EmrEarlyWarning = { compute, forPatient, bannerText, refresh, title: () => label('', TITLE.en, TITLE.kh), config: () => table };
})();
