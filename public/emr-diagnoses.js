'use strict';
(function () {
  const definitions = {
    opd: { code: 'diag_input', text: 'emr_pmrs_opd_diagnosis', hidden: 'emr_opd_diagnoses', mainSecondary: true },
    // mainSecondary (v40.7): one code is shown as the main diagnosis, the others as
    // secondary diagnoses. The main code is always kept first in the list, so the
    // primary-code field (read by PMRS2, discharge and reports) stays correct.
    ipd: { code: 'emr_pmrs_ipd_icd10', text: 'emr_pmrs_ipd_diagnosis', hidden: 'emr_ipd_diagnoses', mainSecondary: true },
    followup: { code: 'mon_input_icd10', text: 'mon_input_conclusion', mainSecondary: true },
    // v41.6: discharge form (drawn by emr-inpatient-workflow.js, mounted with mountEmrDiagnosisEditor).
    discharge: { code: 'emr_discharge_icd10', text: 'emr_discharge_diagnosis', hidden: 'emr_discharge_diagnoses', mainSecondary: true }
  };

  const hosts = new Map();
  const el = id => document.getElementById(id);
  const english = () => window.getBorkeoLanguage?.() === 'en' || window.currentLang === 'english';

  const placeholders = () => english()
    ? 'Type ICD-10 code (e.g. A90) or disease name...'
    : 'វាយលេខកូដ ICD-10 (ឧ. A90) ឬឈ្មោះជំងឺ...';
  const mainLabels = () => english()
    ? { main: 'Main diagnosis', secondary: 'Secondary diagnoses', setMain: 'Set as main' }
    : { main: 'រោគវិនិច្ឆ័យចម្បង', secondary: 'រោគវិនិច្ឆ័យបន្ទាប់បន្សំ', setMain: 'កំណត់ជារោគវិនិច្ឆ័យចម្បង' };

  // Store selected diagnoses per host: Map<kind, Array<{icd10: string, text: string}>>
  const selectedState = new Map();
  const searchCache = new Map();

  function getSelected(kind) {
    if (!selectedState.has(kind)) selectedState.set(kind, []);
    return selectedState.get(kind);
  }

  function sync(kind) {
    const def = definitions[kind];
    if (!def) return;
    const items = getSelected(kind);
    const first = items[0] || { icd10: '', text: '' };

    // Update primary code field
    const codeEl = el(def.code);
    if (codeEl) {
      codeEl.value = first.icd10 || '';
      codeEl.dispatchEvent(new Event('input', { bubbles: true }));
      codeEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // Update hidden JSON field if present
    const hiddenEl = def.hidden && el(def.hidden);
    if (hiddenEl) {
      hiddenEl.value = JSON.stringify(def.mainSecondary
        ? items.map((item, index) => ({ icd10: item.icd10, text: item.text || '', main: index === 0 }))
        : items);
      hiddenEl.dispatchEvent(new Event('input', { bubbles: true }));
      hiddenEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    window.syncAdmissionDiagnosis?.();
  }

  function renderTags(kind) {
    const host = hosts.get(kind);
    if (!host) return;
    const list = host.querySelector('.diag-tags-list');
    if (!list) return;

    const items = getSelected(kind);
    const mainSecondary = Boolean(definitions[kind]?.mainSecondary);
    list.replaceChildren();

    items.forEach((item, index) => {
      if (mainSecondary && index === 1) {
        const heading = document.createElement('span');
        heading.className = 'diag-secondary-heading';
        heading.textContent = mainLabels().secondary;
        list.append(heading);
      }
      const tag = document.createElement('span');
      tag.className = 'diag-tag';
      tag.dataset.code = item.icd10;
      if (mainSecondary && index === 0) {
        tag.classList.add('diag-tag-main');
        const badge = document.createElement('span');
        badge.className = 'diag-main-badge';
        badge.textContent = mainLabels().main;
        tag.append(badge);
      }

      const codeSpan = document.createElement('strong');
      codeSpan.className = 'diag-tag-code';
      codeSpan.textContent = item.icd10;

      const descSpan = document.createElement('span');
      descSpan.className = 'diag-tag-desc';
      descSpan.textContent = item.text ? (item.text.startsWith(item.icd10) ? item.text : ` - ${item.text}`) : '';

      const removeBtn = document.createElement('span');
      removeBtn.className = 'diag-tag-remove no-print';
      removeBtn.textContent = '×';
      removeBtn.title = english() ? 'Remove' : 'លុប';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        items.splice(index, 1);
        renderTags(kind);
        sync(kind);
      });

      tag.append(codeSpan);
      if (item.text) tag.append(descSpan);
      if (mainSecondary && index > 0) {
        const setMainButton = document.createElement('button');
        setMainButton.type = 'button';
        setMainButton.className = 'diag-set-main no-print';
        setMainButton.textContent = mainLabels().setMain;
        setMainButton.addEventListener('click', (e) => {
          e.stopPropagation();
          setMain(kind, index);
        });
        tag.append(setMainButton);
      }
      tag.append(removeBtn);
      list.append(tag);
    });

    const input = host.querySelector('.diag-search-input');
    if (input) {
      input.placeholder = items.length === 0 ? placeholders() : (english() ? '+ Add another ICD-10...' : '+ បន្ថែម ICD-10 ទៀត...');
    }
  }

  function addDiagnosis(kind, icd10, text) {
    if (!icd10) return;
    const cleanCode = String(icd10).trim().toUpperCase();
    const items = getSelected(kind);
    if (items.some(x => x.icd10 === cleanCode)) return;

    const cleanText = String(text || '').trim();
    items.push({ icd10: cleanCode, text: cleanText });

    // Auto-fill clinical textarea if currently empty
    const def = definitions[kind];
    const textEl = el(def?.text);
    if (textEl && !textEl.value.trim() && cleanText) {
      textEl.value = cleanText;
      textEl.dispatchEvent(new Event('input', { bubbles: true }));
      textEl.dispatchEvent(new Event('change', { bubbles: true }));
    }

    renderTags(kind);
    sync(kind);
  }

  // Moves the chosen code to the front: the first code is the main diagnosis.
  function setMain(kind, index) {
    const items = getSelected(kind);
    if (!definitions[kind]?.mainSecondary || index <= 0 || index >= items.length) return;
    const [item] = items.splice(index, 1);
    items.unshift(item);
    renderTags(kind);
    sync(kind);
  }

  function restore(kind, rows) {
    const items = getSelected(kind);
    items.length = 0;

    let parsed = [];
    try {
      parsed = typeof rows === 'string' ? JSON.parse(rows) : (Array.isArray(rows) ? rows : []);
    } catch {
      parsed = [];
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      parsed.forEach(r => {
        if (!r) return;
        const c = String(r.icd10 || r.code || '').trim().toUpperCase();
        const t = String(r.text || '').trim();
        if (c && !items.some(x => x.icd10 === c)) {
          items.push({ icd10: c, text: t });
        }
      });
      // A saved main flag wins; records saved before v40.7 have none, so their
      // first code stays the main diagnosis exactly as before.
      const flagged = definitions[kind]?.mainSecondary && parsed.find(r => r && r.main === true);
      const flaggedCode = flagged ? String(flagged.icd10 || flagged.code || '').trim().toUpperCase() : '';
      const flaggedIndex = flaggedCode ? items.findIndex(x => x.icd10 === flaggedCode) : -1;
      if (flaggedIndex > 0) items.unshift(...items.splice(flaggedIndex, 1));
    } else {
      const def = definitions[kind];
      const legacyCode = el(def?.code)?.value?.trim()?.toUpperCase();
      const legacyText = el(def?.text)?.value?.trim();
      if (legacyCode) {
        items.push({ icd10: legacyCode, text: legacyText || '' });
      }
    }

    renderTags(kind);
    sync(kind);
  }

  function collect(kind) {
    const items = getSelected(kind);
    if (!items.length) {
      const def = definitions[kind];
      const codeVal = el(def?.code)?.value?.trim()?.toUpperCase();
      const textVal = el(def?.text)?.value?.trim() || '';
      if (codeVal) return [{ icd10: codeVal, text: textVal }];
      return [];
    }
    // Daily notes store this list directly; the main code is first and flagged.
    if (definitions[kind]?.mainSecondary) return items.map((x, index) => ({ icd10: x.icd10, text: x.text || '', main: index === 0 }));
    return items.map(x => ({ icd10: x.icd10, text: x.text || '' }));
  }

  async function searchIcd10(query) {
    const q = String(query || '').trim();
    if (!q || q.length < 2) return { items: [] };
    if (searchCache.has(q)) return searchCache.get(q);

    const response = await fetch('/api/icd10/search?q=' + encodeURIComponent(q), { credentials: 'same-origin' });
    if (!response.ok) return { items: [] };
    const data = await response.json();
    if (searchCache.size >= 80) searchCache.delete(searchCache.keys().next().value);
    searchCache.set(q, data);
    return data;
  }

  function setupHost(kind, host) {
    hosts.set(kind, host);
    host.dataset.languageExclude = '';

    host.innerHTML = `
      <div class="diag-tag-wrapper">
        <div class="diag-tag-box" tabindex="0">
          <div class="diag-tags-list"></div>
          <input type="text" class="diag-search-input no-print" data-emr-no-save placeholder="${placeholders()}" autocomplete="off" spellcheck="false">
        </div>
        <div class="diag-dropdown no-print" hidden>
          <div class="diag-status" hidden></div>
          <div class="diag-options-list"></div>
        </div>
      </div>
    `;

    const tagBox = host.querySelector('.diag-tag-box');
    const input = host.querySelector('.diag-search-input');
    const dropdown = host.querySelector('.diag-dropdown');
    const statusEl = host.querySelector('.diag-status');
    const optionsList = host.querySelector('.diag-options-list');

    let activeIndex = -1;
    let searchTimer = null;
    let currentResults = [];

    tagBox.addEventListener('click', () => input.focus());

    function closeDropdown() {
      dropdown.hidden = true;
      activeIndex = -1;
    }

    function renderOptions(results) {
      currentResults = results.items || [];
      optionsList.replaceChildren();
      activeIndex = -1;

      if (!currentResults.length) {
        statusEl.hidden = false;
        statusEl.textContent = english() ? 'No matching ICD-10 codes found.' : 'រកមិនឃើញកូដ ICD-10 ទេ។';
        dropdown.hidden = false;
        return;
      }

      statusEl.hidden = true;
      currentResults.forEach((item, idx) => {
        const row = document.createElement('div');
        row.className = 'diag-option-item';
        row.dataset.idx = idx;

        const desc = english() ? (item.en || item.kh || item.fr || '') : (item.kh || item.en || item.fr || '');
        const codeSpan = document.createElement('span');
        codeSpan.className = 'diag-option-code';
        codeSpan.textContent = item.code;
        const sepSpan = document.createElement('span');
        sepSpan.className = 'diag-option-sep';
        sepSpan.textContent = ' - ';
        const nameSpan = document.createElement('span');
        nameSpan.className = 'diag-option-name';
        nameSpan.textContent = desc;
        row.append(codeSpan, sepSpan, nameSpan);

        row.addEventListener('mousedown', (e) => {
          e.preventDefault();
          addDiagnosis(kind, item.code, desc);
          input.value = '';
          closeDropdown();
          input.focus();
        });

        row.addEventListener('mouseenter', () => {
          activeIndex = idx;
          updateOptionHighlights();
        });

        optionsList.append(row);
      });

      dropdown.hidden = false;
    }

    function updateOptionHighlights() {
      const rows = optionsList.querySelectorAll('.diag-option-item');
      rows.forEach((r, i) => {
        r.classList.toggle('active', i === activeIndex);
        if (i === activeIndex) r.scrollIntoView({ block: 'nearest' });
      });
    }

    input.addEventListener('input', () => {
      clearTimeout(searchTimer);
      const q = input.value.trim();
      if (q.length < 2) {
        closeDropdown();
        return;
      }
      statusEl.hidden = false;
      statusEl.textContent = english() ? 'Searching...' : 'កំពុងស្វែងរក...';
      dropdown.hidden = false;

      searchTimer = setTimeout(async () => {
        try {
          const res = await searchIcd10(q);
          renderOptions(res);
        } catch {
          statusEl.hidden = false;
          statusEl.textContent = english() ? 'Search unavailable.' : 'មិនអាចស្វែងរកបានទេ។';
        }
      }, 150);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeDropdown();
        return;
      }
      if (e.key === 'Backspace' && !input.value) {
        const items = getSelected(kind);
        if (items.length > 0) {
          items.pop();
          renderTags(kind);
          sync(kind);
        }
        return;
      }
      if (!dropdown.hidden && currentResults.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeIndex = (activeIndex + 1) % currentResults.length;
          updateOptionHighlights();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIndex = (activeIndex - 1 + currentResults.length) % currentResults.length;
          updateOptionHighlights();
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          if (activeIndex >= 0 && currentResults[activeIndex]) {
            const item = currentResults[activeIndex];
            const desc = english() ? (item.en || item.kh || item.fr || '') : (item.kh || item.en || item.fr || '');
            addDiagnosis(kind, item.code, desc);
            input.value = '';
            closeDropdown();
            input.focus();
          }
          return;
        }
      }
    });

    input.addEventListener('blur', () => {
      setTimeout(closeDropdown, 200);
    });

    renderTags(kind);
  }

  function initialize() {
    document.querySelectorAll('[data-diagnosis-editor]').forEach(host => {
      const kind = host.dataset.diagnosisEditor;
      if (!definitions[kind]) return;
      setupHost(kind, host);
    });
  }

  window.collectEmrDiagnoses = collect;
  window.mountEmrDiagnosisEditor = (kind, host) => { if (definitions[kind] && host && !hosts.has(kind)) setupHost(kind, host); };
  window.restoreEmrDiagnoses = restore;
  window.setEmrMainDiagnosis = (kind, code) => {
    const index = getSelected(kind).findIndex(x => x.icd10 === String(code || '').trim().toUpperCase());
    setMain(kind, index);
  };
  window.syncEmrDiagnosisFields = () => {
    for (const kind of ['opd', 'ipd']) sync(kind);
  };
  window.validateEmrDiagnoses = () => true;

  document.addEventListener('emr:patient-loaded', () => {
    for (const kind of ['opd', 'ipd']) {
      const def = definitions[kind];
      const val = el(def?.hidden)?.value;
      restore(kind, val);
    }
  });

  window.addEventListener('borkeo-language-change', () => {
    for (const kind of ['opd', 'ipd']) renderTags(kind);
  });

  initialize();
})();
