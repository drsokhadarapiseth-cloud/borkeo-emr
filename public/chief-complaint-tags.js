(function () {
  'use strict';

  if (window._borkeoChiefComplaintInitialized) return;
  window._borkeoChiefComplaintInitialized = true;

  const STORAGE_KEY = 'borkeo-emr-symptoms-catalog';
  let catalog = [];
  const selectedSymptoms = new Set();
  let dropdownOpen = false;

  const catalogDetails = new Map();
  let canCreate = false, initialized = false, catalogRequest = null, lastRefresh = 0;
  let patientGeneration = 0, adding = false, migrating = false;
  function normalize(value) {
    return String(value || '').normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/\s+/gu, ' ').trim().toLowerCase();
  }
  function status(text) {
    const node = document.getElementById('cc_catalog_status');
    if (node) { node.textContent = text; node.hidden = !text; }
  }
  function editable() { const input=getTargetInput(); return Boolean(input && !input.disabled && !input.readOnly && window.EmrSharedEncounter?.chiefEditable() !== false); }
  function remember(item) {
    const name = item.nameKh || item.nameEn;
    const key = normalize(name);
    let names = catalogDetails.get(key);
    if (!names) { names=[]; catalogDetails.set(key,names); catalog.push(name); }
    if (!names.some(x=>x.id===item.id)) names.push(item);
    return catalog.find(x=>normalize(x)===key) || name;
  }
  function findLabel(text) {
    const key=normalize(text);
    return catalog.find(name=>normalize(name)===key || (catalogDetails.get(normalize(name))||[]).some(x=>[x.nameKh,x.nameEn,x.code].some(v=>v && normalize(v)===key))) || text.trim();
  }
  function selectUnique(text) {
    const key=normalize(text);
    if (key && !Array.from(selectedSymptoms).some(s=>normalize(findLabel(s))===normalize(findLabel(text)))) selectedSymptoms.add(text);
  }
  function isEnglish() {
    try {
      if (typeof window !== 'undefined' && typeof window.getBorkeoLanguage === 'function') {
        return window.getBorkeoLanguage() === 'en';
      }
      if (typeof currentLang !== 'undefined') {
        return currentLang === 'english';
      }
      if (typeof document !== 'undefined' && document.documentElement) {
        return document.documentElement.lang === 'en';
      }
    } catch {}
    return false;
  }
  function getLocalizedName(item) {
    const canonical = typeof findLabel === 'function' ? findLabel(item) : item;
    const details = (typeof catalogDetails !== 'undefined' && catalogDetails.get(normalize(canonical))) || [];
    if (isEnglish()) {
      const en = details.find(x => x.nameEn)?.nameEn;
      if (en) return en;
      return canonical;
    } else {
      const kh = details.find(x => x.nameKh)?.nameKh;
      if (kh) return kh;
      return canonical;
    }
  }
  async function securityToken() {
    if (window.emrSession?.csrfToken) return window.emrSession.csrfToken;
    const response=await fetch('/api/auth/me',{credentials:'same-origin',cache:'no-store'});
    if (!response.ok) throw new Error('Please sign in again.');
    return (await response.json()).csrfToken;
  }
  async function persist(text) {
    const response=await fetch('/api/symptoms',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':await securityToken()},body:JSON.stringify({text})});
    const result=await response.json();
    if (!response.ok) throw new Error(result.error || 'Cannot save symptom.');
    remember(result.item); return result;
  }
  async function migrateLocalCatalog() {
    if (migrating || !canCreate) return;
    let old; try { old=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]'); } catch { return; }
    if (!Array.isArray(old) || !old.length) return;
    migrating=true;
    try {
      // Catalogue labels only: do not import stored patient records or auto-add them to a visit.
      for (const text of [...new Set(old.filter(x=>typeof x==='string' && normalize(x)))]) await persist(text);
      localStorage.removeItem(STORAGE_KEY);
    } catch { status('បញ្ជីចាស់មិនទាន់រក្សាទុកទាំងអស់ / Some old catalogue labels could not be saved. Retry after reconnecting.'); }
    finally { migrating=false; renderOptions(document.getElementById('cc_search_input')?.value || ''); }
  }
  async function loadCatalog(force=false) {
    if (catalogRequest) return catalogRequest;
    if (!force && Date.now()-lastRefresh<15000) return;
    catalogRequest=(async()=>{
      try {
        const response=await fetch('/api/symptoms',{credentials:'same-origin',cache:'no-store'});
        if (!response.ok) throw new Error('Cannot load shared symptoms.');
        const result=await response.json();
        if (!Array.isArray(result.items)) throw new Error('Invalid symptom catalogue.');
        catalog=[]; catalogDetails.clear(); result.items.forEach(remember);
        canCreate=Boolean(result.canCreate); lastRefresh=Date.now(); status('');
        const button=document.getElementById('cc_add_btn');if(button)button.disabled=!canCreate||!editable();
        renderOptions(document.getElementById('cc_search_input')?.value || '');
        void migrateLocalCatalog();
      } catch { status('មិនអាចទាញយកបញ្ជីរោគសញ្ញា / Cannot load symptoms. Reopen to retry; saved patient symptoms remain intact.'); }
      finally { catalogRequest=null; }
    })();
    return catalogRequest;
  }
  async function saveCatalog(text) {
    if (!canCreate) return null;
    try { return await persist(text); }
    catch (error) { status('មិនទាន់រក្សាទុកក្នុងបញ្ជី / Catalogue save failed: '+error.message); return null; }
  }

  function getTargetInput() {
    return document.getElementById('pmrs_chief_complaint');
  }

  function syncToInput() {
    const input = getTargetInput();
    if (!input) return;
    const labels = Array.from(selectedSymptoms).map(s => typeof getLocalizedName === 'function' ? getLocalizedName(s) : s);
    const value = labels.join(', ');
    const items = document.getElementById('pmrs_chief_complaint_items');
    if (items) items.value = JSON.stringify(labels);
    if (input.value !== value) {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
    renderTags();
  }

  function syncFromInput() {
    const input = getTargetInput();
    if (!input) return;
    const val = (input.value || '').trim();
    if (!val) {
      selectedSymptoms.clear();
      renderTags();
      renderOptions();
      return;
    }
    let saved; try { saved=JSON.parse(document.getElementById('pmrs_chief_complaint_items')?.value || 'null'); } catch {}
    const parts = Array.isArray(saved) && saved.every(x=>typeof x==='string') && saved.join(', ')===val
      ? saved : val.split(/[,،、]+/).map(s => s.trim()).filter(Boolean);
    selectedSymptoms.clear();
    parts.forEach(s => {
      selectUnique(s);
    });
    renderTags();
    renderOptions();
  }

  function renderTags() {
    const list = document.getElementById('chief_complaint_tags_list');
    const placeholder = document.getElementById('cc_placeholder_text');
    if (!list) return;
    list.innerHTML = '';
    selectedSymptoms.forEach(symptom => {
      const display = typeof getLocalizedName === 'function' ? getLocalizedName(symptom) : symptom;
      const tag = document.createElement('span');
      tag.className = 'cc-tag';
      tag.innerHTML = `<span>${escapeHtml(display)}</span><span class="cc-tag-remove" data-symptom="${escapeHtml(symptom)}" title="${isEnglish() ? 'Remove' : 'លុប'}">✕</span>`;
      list.appendChild(tag);
    });

    if (placeholder) {
      placeholder.style.display = selectedSymptoms.size > 0 ? 'none' : 'block';
      placeholder.textContent = isEnglish() ? 'Select or type symptoms...' : 'ជ្រើសរើស ឬវាយបញ្ចូលរោគសញ្ញា...';
    }
  }

  function renderOptions(filterText = '') {
    const list = document.getElementById('cc_options_list');
    if (!list) return;
    list.innerHTML = '';
    const query = normalize(filterText);

    const options=[...catalog];
    for(const text of selectedSymptoms)if(!options.some(x=>normalize(x)===normalize(text)))options.push(text);
    const filtered = options.filter(item => {
      if (!query) return true;
      const details=catalogDetails.get(normalize(item))||[];
      return normalize(item).includes(query) || details.some(x=>[x.nameKh,x.nameEn,x.code].some(v=>v && normalize(v).includes(query)));
    });

    if (isEnglish()) {
      filtered.sort((a, b) => getLocalizedName(a).localeCompare(getLocalizedName(b), 'en', { sensitivity: 'base' }));
    }

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'cc-no-results';
      empty.textContent = query
        ? (isEnglish() ? 'Not in list (press + or Enter to add)' : 'គ្មានក្នុងបញ្ជី (ចុច + ឬ Enter ដើម្បីបន្ថែម)')
        : (isEnglish() ? 'No data' : 'គ្មានទិន្នន័យ');
      list.appendChild(empty);
      return;
    }

    const selectedKeys = new Set();
    for (const text of selectedSymptoms) {
      selectedKeys.add(normalize(findLabel(text)));
    }

    const canEdit = editable();
    const fragment = typeof document.createDocumentFragment === 'function' ? document.createDocumentFragment() : null;
    const targetParent = fragment || list;

    filtered.forEach(item => {
      const canonical = findLabel(item);
      const key = normalize(canonical);
      const isSelected = selectedKeys.has(key);
      const row = document.createElement('div');
      row.className = `cc-option-item${isSelected ? ' selected' : ''}`;
      row.dataset.symptom = item;
      row.dataset.key = key;

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.dataset.emrTransient = '1';
      cb.checked = isSelected;
      cb.disabled = !canEdit;

      const span = document.createElement('span');
      const details = catalogDetails.get(normalize(item)) || [];
      span.textContent = getLocalizedName(item);
      row.title = details.map(x => x.code || 'Custom symptom — no official code').join(', ');

      row.appendChild(cb);
      row.appendChild(span);
      targetParent.appendChild(row);
    });

    if (fragment) {
      list.appendChild(fragment);
    }

    if (!list._ccDelegated) {
      list._ccDelegated = true;
      list.addEventListener('click', (e) => {
        if (!editable()) return;
        const row = e.target.closest('.cc-option-item');
        if (!row) return;
        const cb = row.querySelector('input[type="checkbox"]');
        if (!cb || cb.disabled) return;
        const sym = row.dataset.symptom;
        if (!sym) return;
        if (e.target === cb) {
          toggleSymptom(sym, cb.checked, row);
        } else {
          cb.checked = !cb.checked;
          toggleSymptom(sym, cb.checked, row);
        }
      });
    }
  }

  function toggleSymptom(symptom, select, sourceRow) {
    if (!editable()) return;
    const name = findLabel(symptom);
    const key = normalize(name);
    if (select) {
      selectUnique(name);
    } else {
      for (const text of selectedSymptoms) {
        if (normalize(findLabel(text)) === key) selectedSymptoms.delete(text);
      }
    }
    syncToInput();

    // Fast in-place DOM update without re-rendering all options:
    const list = document.getElementById('cc_options_list');
    let targetRow = sourceRow;
    if (!targetRow && list && list.querySelectorAll) {
      const rows = list.querySelectorAll('.cc-option-item');
      for (let i = 0; i < rows.length; i++) {
        if (rows[i].dataset && rows[i].dataset.key === key) {
          targetRow = rows[i];
          break;
        }
      }
    }

    if (targetRow) {
      if (targetRow.classList) {
        if (typeof targetRow.classList.toggle === 'function') {
          targetRow.classList.toggle('selected', select);
        } else if (select) {
          targetRow.classList.add('selected');
        } else {
          targetRow.classList.remove('selected');
        }
      }
      const cb = targetRow.querySelector ? targetRow.querySelector('input[type="checkbox"]') : null;
      if (cb && cb.checked !== select) cb.checked = select;
    }
  }

  async function addCustomSymptom(text) {
    const clean = String(text || '').trim();
    if (!clean || adding || !editable()) return;
    if (!canCreate) { status('មិនអាចបន្ថែមរោគសញ្ញា / You cannot create symptoms in this role.'); return; }
    const generation=patientGeneration;
    adding=true; const button=document.getElementById('cc_add_btn');if(button)button.disabled=true;
    try {
      const result=await persist(clean);
      if (generation!==patientGeneration || !editable()) return;
      selectUnique(result.item.nameKh || result.item.nameEn);
      syncToInput();
      const input=document.getElementById('cc_search_input');if(input)input.value='';
      status(result.created?'បានបន្ថែមរោគសញ្ញាថ្មី / New symptom saved.':'រោគសញ្ញាមានរួចហើយ / Existing symptom selected; no duplicate added.');
      renderOptions('');
    } catch (error) { status('មិនអាចរក្សាទុករោគសញ្ញា / Cannot save symptom: '+error.message); }
    finally { adding=false;if(button)button.disabled=!canCreate||!editable(); }
  }

  function toggleDropdown(show) {
    const dropdown = document.getElementById('chief_complaint_dropdown');
    const tagBox = document.getElementById('chief_complaint_tag_box');
    const searchInput = document.getElementById('cc_search_input');
    if (!dropdown || !tagBox) return;
    dropdownOpen = show !== undefined ? show : !dropdownOpen;
    dropdown.style.display = dropdownOpen ? 'block' : 'none';
    tagBox.classList.toggle('is-open', dropdownOpen);
    if (dropdownOpen) {
      void loadCatalog(true);
      renderOptions(searchInput?.value || '');
      setTimeout(() => {
        if (searchInput) searchInput.focus();
      }, 50);
    }
  }

  function bindEmergencyCheckboxes() {
    const emergencyCheckboxes = document.querySelectorAll('.s1-check, .s2-check');
    emergencyCheckboxes.forEach(cb => {
      if (cb._ccBound) return;
      cb._ccBound = true;
      cb.addEventListener('change', () => {
        const row = cb.closest('.symptom-row');
        const symptomText = row?.querySelector('.symptom-text')?.textContent?.trim();
        if (!symptomText) return;
        if (cb.checked) {
          saveCatalog(symptomText);
          selectUnique(findLabel(symptomText));
          syncToInput();
        } else {
          selectedSymptoms.delete(symptomText);
          syncToInput();
        }
        renderOptions(document.getElementById('cc_search_input')?.value || '');
      });
    });
  }

  function syncCheckedEmergencyBoxes() {
    document.querySelectorAll('.s1-check:checked, .s2-check:checked').forEach(cb => {
      const row = cb.closest('.symptom-row');
      const text = row?.querySelector('.symptom-text')?.textContent?.trim();
      if (text) {
        saveCatalog(text);
        selectUnique(findLabel(text));
      }
    });
    syncToInput();
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function init() {
    if (initialized) return;
    initialized=true;
    void loadCatalog();
    const tagBox = document.getElementById('chief_complaint_tag_box');
    const searchInput = document.getElementById('cc_search_input');
    const addBtn = document.getElementById('cc_add_btn');
    const targetInput = getTargetInput();

    if (!tagBox) return;

    tagBox.addEventListener('click', (e) => {
      const removeBtn = e.target.closest('.cc-tag-remove');
      if (removeBtn) {
        if (!editable()) return;
        e.stopPropagation();
        const sym = removeBtn.dataset.symptom;
        if (sym) {
          toggleSymptom(sym, false);
        }
        return;
      }
      toggleDropdown(true);
    });

    tagBox.addEventListener('keydown', (e) => {
      if (e.key === 'Tab' || e.key === 'Shift' || e.key === 'Alt' || e.key === 'Control') return;
      toggleDropdown(true);
      if (searchInput && e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
        setTimeout(() => {
          if (searchInput) searchInput.focus();
        }, 10);
      }
    });

    if (searchInput) {
      searchInput.addEventListener('input', () => {
        renderOptions(searchInput.value);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.isComposing) return;
        if (e.key === 'Enter') {
          e.preventDefault();
          if (searchInput.value.trim()) {
            addCustomSymptom(searchInput.value);
          }
        } else if (e.key === 'Escape') {
          toggleDropdown(false);
        }
      });
    }

    if (addBtn) {
      addBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        addCustomSymptom(searchInput?.value);
      });
    }

    document.addEventListener('click', (e) => {
      if (!dropdownOpen) return;
      const wrapper = document.querySelector('.chief-complaint-wrapper');
      if (wrapper && !wrapper.contains(e.target)) {
        toggleDropdown(false);
      }
    });

    if (targetInput) {
      targetInput.addEventListener('input', syncFromInput);
      targetInput.addEventListener('change', syncFromInput);
    }

    bindEmergencyCheckboxes();
    syncFromInput();
    syncCheckedEmergencyBoxes();
    updateLanguage();

    window.addEventListener('borkeo-language-change', updateLanguage);
    if (typeof MutationObserver !== 'undefined' && document.documentElement) {
      const langObserver = new MutationObserver((mutations) => {
        for (const m of mutations) {
          if (m.attributeName === 'lang') { updateLanguage(); break; }
        }
      });
      langObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
    }

    document.addEventListener('emr:patient-loaded', () => {
      patientGeneration++;
      status('');
      setTimeout(() => {
        syncFromInput();
        bindEmergencyCheckboxes();
        syncCheckedEmergencyBoxes();
        updateLanguage();
      }, 50);
    });
  }

  function updateLanguage() {
    const searchInput = document.getElementById('cc_search_input');
    if (searchInput) {
      searchInput.placeholder = isEnglish() ? 'Search Khmer / English / Code' : 'ស្វែងរកខ្មែរ / English / Code';
    }
    const placeholder = document.getElementById('cc_placeholder_text');
    if (placeholder) {
      placeholder.textContent = isEnglish() ? 'Select or type symptoms...' : 'ជ្រើសរើស ឬវាយបញ្ចូលរោគសញ្ញា...';
    }
    syncToInput();
    renderOptions(searchInput?.value || '');
  }

  window.addEventListener('DOMContentLoaded', init);
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(init, 0);
  }

  window.BorkeoChiefComplaint = {
    addSymptom: addCustomSymptom,
    toggleSymptom,
    syncFromInput,
    syncToInput,
    getSelected: () => Array.from(selectedSymptoms),
    clear: () => { if (editable()) { selectedSymptoms.clear(); syncToInput(); } },
    updateLanguage,
    isEnglish,
    getLocalizedName
  };
})();
