// v41.1 - Display rules by age and sex in the IPD medical record
// (rules: server/clinical-options.json "displayRules", GET /api/clinical-options;
// confirmed by a doctor in docs/clinical-review.md).
// - [data-display-rule] blocks are hidden or shown; hiding never clears a field,
//   and a block that holds a saved value is always shown.
// - Unknown age or sex shows the block (nothing is hidden by mistake).
// - Ob/gyn history: window.EmrDisplayRules.obgynVisible() is used by
//   updateIpdObGynVisibility() in emr-patient-record.js.
'use strict';
(function () {
  let rules = null;
  let loading = null;
  const manuallyShown = new Set();

  function loadRules() {
    if (loading) return loading;
    loading = fetch('/api/clinical-options', { credentials: 'same-origin', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => { rules = result?.displayRules || null; })
      .catch(() => { rules = null; })
      .finally(apply);
    return loading;
  }

  // Age in completed years from date of birth or the typed age (same reading as
  // the triage paediatric panel, getExactAge in EMR.html); null when unknown.
  function ageYears() {
    const exact = typeof window.getExactAge === 'function' ? window.getExactAge() : null;
    if (exact && Number.isFinite(exact.years)) return exact.years;
    const patientAge = parseFloat(window.getLoadedEmrPatient?.()?.age);
    return Number.isFinite(patientAge) ? Math.floor(patientAge) : null;
  }

  // 'female', 'male' or '' (unknown).
  function sex() {
    const value = document.querySelector('input[name="sex_radio"]:checked')?.value || window.getLoadedEmrPatient?.()?.sex || '';
    const text = String(value).trim().toLowerCase();
    if (value === 'ស្រី' || ['f', 'female', 'girl'].includes(text)) return 'female';
    if (value === 'ប្រុស' || ['m', 'male', 'boy'].includes(text)) return 'male';
    return '';
  }

  function inObstetricWard() {
    const codes = rules?.obstetricWardCodes || [];
    const patient = window.getLoadedEmrPatient?.() || {};
    const ward = [patient.departmentCode, window.getEmrCarePath?.()?.code].filter(Boolean);
    return ward.some((code) => codes.includes(code));
  }

  // Pregnancy signals already in the record: obstetric ward, or an EDD in the ob/gyn history.
  function pregnant() {
    return inObstetricWard() || Boolean(document.getElementById('ipd_obgyn_edd')?.value);
  }

  const atMost = (age, limit) => age === null || limit === null || age <= limit;
  const atLeast = (age, limit) => age === null || limit === null || age >= limit;

  function ruleVisible(name) {
    if (!rules) return true;
    const age = ageYears();
    const female = sex() === 'female';
    const unknownSex = sex() === '';
    switch (name) {
      case 'immunization': return atMost(age, rules.immunizationMaxAge);
      case 'substance-use': return atLeast(age, rules.substanceUseMinAge);
      case 'paediatric': return atMost(age, rules.paediatricMaxAge);
      case 'head-circumference': return atMost(age, rules.headCircumferenceMaxAge);
      case 'tetanus-status':
        if (unknownSex) return true;
        if (!female) return false;
        return (atLeast(age, rules.tetanusFemaleMinAge) && atMost(age, rules.tetanusFemaleMaxAge))
          || (rules.tetanusWhenPregnant && pregnant());
      default: return true;
    }
  }

  // Ob/gyn history: females from obgynFemaleMinAge; younger females when pregnant
  // or in the obstetric ward; any female when a doctor presses "show".
  // null = no decision (sex unknown or rules not loaded): the caller keeps its own rule.
  function obgynVisible() {
    const value = sex();
    if (value === 'male') return false;
    if (value === '' || !rules) return null;
    const age = ageYears();
    if (atLeast(age, rules.obgynFemaleMinAge)) return true;
    if (rules.obgynYoungerWhenPregnant && pregnant()) return true;
    return manuallyShown.has('obgyn');
  }

  function hasSavedValue(block) {
    return Array.from(block.querySelectorAll('input, select, textarea')).some((control) => {
      if (control.type === 'checkbox' || control.type === 'radio') return control.checked;
      return String(control.value || '').trim() !== '';
    });
  }

  function newTextHtml(key, english) {
    if (window.getBorkeoLanguage?.() === 'en' || !window.newTextHtml) return english;
    return window.newTextHtml(key, english);
  }

  // A small "show" button for the ob/gyn history of a female patient outside the rule.
  function obgynShowButton(section, visible) {
    let button = document.getElementById('ipd_obgyn_show_button');
    const offer = !visible && sex() === 'female';
    if (!offer) { button?.remove(); return; }
    if (!button) {
      button = document.createElement('button');
      button.type = 'button';
      button.id = 'ipd_obgyn_show_button';
      button.className = 'emr-rule-show-button no-print';
      button.addEventListener('click', () => { manuallyShown.add('obgyn'); window.updateIpdObGynVisibility?.(); });
      section.insertAdjacentElement('beforebegin', button);
    }
    button.innerHTML = newTextHtml('displayRules.showObgyn', 'Show obstetric / gynaecological history');
  }

  function updateVitals() {
    const target = document.querySelector('[data-paediatric-vitals]');
    if (!target) return;
    const weight = document.getElementById('ipd_weight')?.value?.trim();
    const height = document.getElementById('ipd_height')?.value?.trim();
    const values = [weight ? `${weight} kg` : '', height ? `${height} cm` : ''].filter(Boolean).join(' · ');
    target.innerHTML = values ? `${newTextHtml('paediatric.fromVitals', 'From vital signs:')} ${values.replace(/[&<>"']/g, '')}` : '';
  }

  function apply() {
    if (!document.getElementById('sub_ipd')) return;
    document.querySelectorAll('[data-display-rule]').forEach((block) => {
      const show = ruleVisible(block.dataset.displayRule) || hasSavedValue(block);
      block.hidden = !show;
      block.classList.toggle('emr-rule-hidden', !show);
    });
    updateVitals();
    window.updateIpdObGynVisibility?.();
  }

  window.EmrDisplayRules = { apply, obgynVisible, obgynShowButton, ruleVisible, ageYears, sex, pregnant, rulesLoaded: () => Boolean(rules) };

  // Re-check after the record loads or is saved, and when age, sex, EDD or weight/height change.
  document.addEventListener('emr:patient-loaded', () => window.setTimeout(apply, 0));
  document.addEventListener('emr:patient-saved', () => window.setTimeout(apply, 0));
  const watched = '#web_age, #web_dob, input[name="sex_radio"], #ipd_obgyn_edd, #ipd_weight, #ipd_height';
  document.addEventListener('change', (event) => { if (event.target.matches?.(watched)) apply(); });
  document.addEventListener('input', (event) => { if (event.target.matches?.('#ipd_weight, #ipd_height')) updateVitals(); });
  window.addEventListener('borkeo-language-change', apply);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', loadRules, { once: true });
  else loadRules();
})();
