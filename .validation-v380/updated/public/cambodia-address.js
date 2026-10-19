// Borkeo EMR - Cambodia Address Linked Searchable Dropdowns (v29.1)
// Uses local Cambodia Gazetteer data with offline resilience, race-condition guards,
// leading-zero code preservation, and parent-child validation.

(function () {
  'use strict';

  const GAZETTEER_BASE = '/data/gazetteer';
  const PROVINCES_URL = `${GAZETTEER_BASE}/provinces.json`;

  let provincesList = [];
  const provinceDetailsCache = new Map(); // provinceIdOrCode -> districts array
  let currentLoadRequestId = 0;

  function padCode(code, level) {
    if (code == null) return '';
    const s = String(code).trim();
    if (!s) return '';
    const lengths = { province: 2, district: 4, commune: 6, village: 8 };
    const target = lengths[level] || s.length;
    return s.padStart(target, '0');
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  class SearchableAddressDropdown {
    constructor(config) {
      this.selectId = config.selectId;
      this.codeId = config.codeId;
      this.level = config.level;
      this.placeholder = config.placeholder;
      this.onChange = config.onChange || (() => {});

      this.selectElem = document.getElementById(this.selectId);
      this.codeElem = document.getElementById(this.codeId);
      this.options = []; // Array of { code, nameKh, nameEn, rawData }
      this.selectedValue = '';
      this.selectedCode = '';
      this.isOpen = false;
      this.disabled = true;

      this.initDom();
    }

    initDom() {
      if (!this.selectElem) return;
      // Wrap select element with our custom combobox
      const parent = this.selectElem.parentElement;
      this.wrapper = document.createElement('div');
      this.wrapper.className = 'cambodia-address-wrapper';

      this.combobox = document.createElement('div');
      this.combobox.className = 'cambodia-address-combobox';

      this.btn = document.createElement('button');
      this.btn.type = 'button';
      this.btn.className = 'cambodia-address-btn';
      this.btn.disabled = true;
      this.btn.innerHTML = `
        <span class="btn-text placeholder">${esc(this.placeholder)}</span>
        <span class="btn-chevron"><i class="fa-solid fa-chevron-down"></i></span>
      `;

      this.popover = document.createElement('div');
      this.popover.className = 'cambodia-address-popover';
      this.popover.hidden = true;

      this.searchBox = document.createElement('div');
      this.searchBox.className = 'cambodia-address-search-box';
      this.searchInput = document.createElement('input');
      this.searchInput.type = 'search';
      this.searchInput.className = 'cambodia-address-search-input';
      this.searchInput.placeholder = 'ស្វែងរក... / Type to search...';
      this.searchBox.appendChild(this.searchInput);

      this.listElem = document.createElement('ul');
      this.listElem.className = 'cambodia-address-list';

      this.popover.appendChild(this.searchBox);
      this.popover.appendChild(this.listElem);

      this.combobox.appendChild(this.btn);
      this.combobox.appendChild(this.popover);

      // Hide native select visually while keeping it in the DOM for native form collection
      this.selectElem.style.display = 'none';
      this.selectElem.setAttribute('aria-hidden', 'true');

      parent.insertBefore(this.wrapper, this.selectElem);
      this.wrapper.appendChild(this.combobox);
      this.wrapper.appendChild(this.selectElem);

      // Bind events
      this.btn.addEventListener('click', () => {
        if (!this.disabled) this.toggle();
      });

      this.searchInput.addEventListener('input', () => {
        this.renderFilteredList(this.searchInput.value);
      });

      this.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          this.close();
        } else if (e.key === 'Enter') {
          e.preventDefault();
          const first = this.listElem.querySelector('.cambodia-address-item:not(.empty)');
          if (first) first.click();
        }
      });

      document.addEventListener('click', (e) => {
        if (this.isOpen && !this.wrapper.contains(e.target)) {
          this.close();
        }
      });
    }

    setDisabled(disabled) {
      this.disabled = disabled;
      if (this.btn) this.btn.disabled = disabled;
      if (this.selectElem) this.selectElem.disabled = disabled;
      if (disabled) {
        this.close();
      }
    }

    setOptions(options) {
      this.options = options || [];
      this.syncNativeSelect();
      this.renderFilteredList('');
    }

    syncNativeSelect() {
      if (!this.selectElem) return;
      this.selectElem.innerHTML = '';
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = this.placeholder;
      this.selectElem.appendChild(defaultOpt);

      for (const opt of this.options) {
        const optionElem = document.createElement('option');
        optionElem.value = opt.nameKh;
        optionElem.dataset.code = opt.code;
        optionElem.textContent = opt.nameKh;
        this.selectElem.appendChild(optionElem);
      }
    }

    renderFilteredList(query) {
      if (!this.listElem) return;
      const q = String(query || '').trim().toLowerCase();
      const filtered = this.options.filter(item => {
        if (!q) return true;
        const kh = String(item.nameKh || '').toLowerCase();
        const en = String(item.nameEn || '').toLowerCase();
        const cd = String(item.code || '').toLowerCase();
        return kh.includes(q) || en.includes(q) || cd.includes(q);
      });

      this.listElem.innerHTML = '';

      if (filtered.length === 0) {
        const empty = document.createElement('li');
        empty.className = 'cambodia-address-status empty';
        empty.textContent = 'រកមិនឃើញ / No matching locations';
        this.listElem.appendChild(empty);
        return;
      }

      for (const item of filtered) {
        const li = document.createElement('li');
        li.className = 'cambodia-address-item';
        if (item.code === this.selectedCode) {
          li.classList.add('selected');
        }
        li.innerHTML = `
          <span>${esc(item.nameKh)}</span>
          <span class="item-code">${esc(item.code)}</span>
        `;
        li.addEventListener('click', () => {
          this.selectItem(item);
        });
        this.listElem.appendChild(li);
      }
    }

    selectItem(item) {
      if (!item) {
        this.clearSelection();
        return;
      }
      this.selectedValue = item.nameKh;
      this.selectedCode = item.code;

      if (this.selectElem) {
        let opt = [...this.selectElem.options].find(o => o.dataset.code === item.code || o.value === item.nameKh);
        if (!opt) {
          opt = new Option(item.nameKh, item.nameKh);
          opt.dataset.code = item.code;
          this.selectElem.add(opt);
        }
        this.selectElem.value = item.nameKh;
        this.selectElem.dispatchEvent(new Event('change', { bubbles: true }));
      }

      if (this.codeElem) {
        this.codeElem.value = item.code;
        this.codeElem.dispatchEvent(new Event('input', { bubbles: true }));
      }

      if (this.btn) {
        const textSpan = this.btn.querySelector('.btn-text');
        textSpan.textContent = item.nameKh;
        textSpan.classList.remove('placeholder');
      }

      this.close();
      this.onChange(item);
    }

    setSelectionManual(nameKh, code) {
      const padded = padCode(code, this.level);
      this.selectedValue = nameKh || '';
      this.selectedCode = padded || '';

      if (this.selectElem) {
        let opt = [...this.selectElem.options].find(o => (padded && o.dataset.code === padded) || (nameKh && o.value === nameKh));
        if (!opt && nameKh) {
          opt = new Option(nameKh, nameKh);
          if (padded) opt.dataset.code = padded;
          this.selectElem.add(opt);
        }
        if (opt) this.selectElem.value = opt.value;
      }

      if (this.codeElem && padded) {
        this.codeElem.value = padded;
      }

      if (this.btn) {
        const textSpan = this.btn.querySelector('.btn-text');
        if (nameKh) {
          textSpan.textContent = nameKh;
          textSpan.classList.remove('placeholder');
        } else {
          textSpan.textContent = this.placeholder;
          textSpan.classList.add('placeholder');
        }
      }
    }

    clearSelection() {
      this.selectedValue = '';
      this.selectedCode = '';
      if (this.selectElem) {
        this.selectElem.value = '';
        this.selectElem.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (this.codeElem) {
        this.codeElem.value = '';
      }
      if (this.btn) {
        const textSpan = this.btn.querySelector('.btn-text');
        textSpan.textContent = this.placeholder;
        textSpan.classList.add('placeholder');
      }
      this.renderFilteredList('');
      if (typeof this.onChange === 'function') {
        this.onChange(null);
      }
    }

    setStatus(text, isError = false) {
      if (!this.listElem) return;
      this.listElem.innerHTML = `<li class="cambodia-address-status ${isError ? 'error' : ''}">${esc(text)}</li>`;
    }

    toggle() {
      if (this.isOpen) this.close();
      else this.open();
    }

    open() {
      if (this.disabled) return;
      // Close all other open dropdowns
      document.querySelectorAll('.cambodia-address-combobox.open').forEach(cb => {
        cb.classList.remove('open');
        const pop = cb.querySelector('.cambodia-address-popover');
        if (pop) pop.hidden = true;
      });

      this.isOpen = true;
      this.combobox.classList.add('open');
      this.popover.hidden = false;
      this.searchInput.value = '';
      this.renderFilteredList('');
      setTimeout(() => this.searchInput.focus(), 50);
    }

    close() {
      this.isOpen = false;
      if (this.combobox) this.combobox.classList.remove('open');
      if (this.popover) this.popover.hidden = true;
    }
  }

  // Address Manager
  class CambodiaAddressManager {
    constructor() {
      this.provinceDropdown = null;
      this.districtDropdown = null;
      this.communeDropdown = null;
      this.villageDropdown = null;
      this.currentDistrictsData = [];
      this.selectedProvince = null;
      this.selectedDistrict = null;
      this.selectedCommune = null;
      this.selectedVillage = null;
    }

    async init() {
      this.provinceDropdown = new SearchableAddressDropdown({
        selectId: 'web_province',
        codeId: 'web_province_code',
        level: 'province',
        placeholder: 'ជ្រើសរើសរាជធានី/ខេត្ត',
        onChange: (item) => this.onProvinceChange(item),
      });

      this.districtDropdown = new SearchableAddressDropdown({
        selectId: 'web_district',
        codeId: 'web_district_code',
        level: 'district',
        placeholder: 'ជ្រើសរើសក្រុង/ស្រុក/ខណ្ឌ',
        onChange: (item) => this.onDistrictChange(item),
      });

      this.communeDropdown = new SearchableAddressDropdown({
        selectId: 'web_commune',
        codeId: 'web_commune_code',
        level: 'commune',
        placeholder: 'ជ្រើសរើសឃុំ/សង្កាត់',
        onChange: (item) => this.onCommuneChange(item),
      });

      this.villageDropdown = new SearchableAddressDropdown({
        selectId: 'web_village',
        codeId: 'web_village_code',
        level: 'village',
        placeholder: 'ជ្រើសរើសភូមិ',
        onChange: (item) => this.onVillageChange(item),
      });

      await this.loadProvinces();
    }

    async loadProvinces() {
      try {
        this.provinceDropdown.setDisabled(true);
        this.provinceDropdown.setStatus('កំពុងទាញទិន្នន័យខេត្ត... / Loading provinces...');
        let res = await fetch(PROVINCES_URL, { cache: 'default' });
        if (!res.ok) {
          // Fallback to /public/data/gazetteer
          res = await fetch('/public/data/gazetteer/provinces.json', { cache: 'default' });
        }
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        provincesList = data.map(p => ({
          id: p.id,
          code: padCode(p.code, 'province'),
          nameKh: p.local,
          nameEn: p.english,
        }));
        this.provinceDropdown.setOptions(provincesList);
        this.provinceDropdown.setDisabled(false);
      } catch (err) {
        console.error('Failed to load provinces:', err);
        this.provinceDropdown.setStatus('មិនអាចទាញទិន្នន័យខេត្តបាន / Failed to load provinces', true);
      }
    }

    async onProvinceChange(provinceItem) {
      this.selectedProvince = provinceItem;
      this.selectedDistrict = null;
      this.selectedCommune = null;
      this.selectedVillage = null;

      // Clear child selections
      this.districtDropdown.clearSelection();
      this.districtDropdown.setOptions([]);
      this.communeDropdown.clearSelection();
      this.communeDropdown.setOptions([]);
      this.villageDropdown.clearSelection();
      this.villageDropdown.setOptions([]);

      this.districtDropdown.setDisabled(true);
      this.communeDropdown.setDisabled(true);
      this.villageDropdown.setDisabled(true);

      if (!provinceItem) return;

      const requestId = ++currentLoadRequestId;
      this.districtDropdown.setDisabled(false);
      this.districtDropdown.setStatus('កំពុងទាញទិន្នន័យស្រុក... / Loading districts...');

      try {
        const districts = await this.fetchProvinceDetail(provinceItem);
        // Prevent race condition: if an older request finishes after a newer selection, ignore it
        if (requestId !== currentLoadRequestId) return;

        this.currentDistrictsData = districts;
        const districtOptions = districts.map(d => ({
          id: d.id,
          code: padCode(d.code, 'district'),
          nameKh: `${d.type ? d.type + ' ' : ''}${d.local}`.trim(),
          nameEn: d.english,
          communes: d.communes || [],
        }));
        this.districtDropdown.setOptions(districtOptions);
      } catch (err) {
        if (requestId !== currentLoadRequestId) return;
        console.error('Failed to load district detail:', err);
        this.districtDropdown.setStatus('មិនអាចទាញទិន្នន័យស្រុកបាន / Error loading districts', true);
      }
    }

    async fetchProvinceDetail(provinceItem) {
      const key = provinceItem.id || provinceItem.code;
      if (provinceDetailsCache.has(key)) {
        return provinceDetailsCache.get(key);
      }
      let url = `${GAZETTEER_BASE}/provinces/${provinceItem.id}.json`;
      let res = await fetch(url, { cache: 'default' });
      if (!res.ok) {
        res = await fetch(`/public/data/gazetteer/provinces/${provinceItem.id}.json`, { cache: 'default' });
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      provinceDetailsCache.set(key, data);
      return data;
    }

    onDistrictChange(districtItem) {
      this.selectedDistrict = districtItem;
      this.selectedCommune = null;
      this.selectedVillage = null;

      if (typeof window.updateCoverageAreaFromDistrict === 'function') {
        window.updateCoverageAreaFromDistrict(districtItem?.code, districtItem?.nameKh || districtItem?.local);
      }

      this.communeDropdown.clearSelection();
      this.communeDropdown.setOptions([]);
      this.villageDropdown.clearSelection();
      this.villageDropdown.setOptions([]);

      this.communeDropdown.setDisabled(true);
      this.villageDropdown.setDisabled(true);

      if (typeof window.updateCoverageAreaFromDistrict === 'function') {
        window.updateCoverageAreaFromDistrict(districtItem ? districtItem.code : '', districtItem ? districtItem.nameKh : '');
      }

      if (!districtItem) return;

      const matchedDistrict = this.currentDistrictsData.find(
        d => padCode(d.code, 'district') === districtItem.code
      );
      const communes = (matchedDistrict?.communes || []).map(c => ({
        id: c.id,
        code: padCode(c.code, 'commune'),
        nameKh: `${c.type ? c.type + ' ' : ''}${c.local}`.trim(),
        nameEn: c.english,
        villages: c.villages || [],
      }));

      this.communeDropdown.setOptions(communes);
      this.communeDropdown.setDisabled(false);
    }

    onCommuneChange(communeItem) {
      this.selectedCommune = communeItem;
      this.selectedVillage = null;

      this.villageDropdown.clearSelection();
      this.villageDropdown.setOptions([]);
      this.villageDropdown.setDisabled(true);

      if (!communeItem) return;

      const matchedDistrict = this.currentDistrictsData.find(
        d => padCode(d.code, 'district') === this.selectedDistrict?.code
      );
      const matchedCommune = (matchedDistrict?.communes || []).find(
        c => padCode(c.code, 'commune') === communeItem.code
      );
      const villages = (matchedCommune?.villages || []).map(v => ({
        id: v.id,
        code: padCode(v.code, 'village'),
        nameKh: `${v.type ? v.type + ' ' : ''}${v.local}`.trim(),
        nameEn: v.english,
      }));

      this.villageDropdown.setOptions(villages);
      this.villageDropdown.setDisabled(false);
    }

    onVillageChange(villageItem) {
      this.selectedVillage = villageItem;
    }

    async restoreAddress(recordData) {
      if (!recordData) return;
      const pCode = recordData['scope:registration:id:web_province_code'] || recordData['id:web_province_code'];
      const pName = recordData['scope:registration:id:web_province'] || recordData['id:web_province'];

      const dCode = recordData['scope:registration:id:web_district_code'] || recordData['id:web_district_code'];
      const dName = recordData['scope:registration:id:web_district'] || recordData['id:web_district'];

      const cCode = recordData['scope:registration:id:web_commune_code'] || recordData['id:web_commune_code'];
      const cName = recordData['scope:registration:id:web_commune'] || recordData['id:web_commune'];

      const vCode = recordData['scope:registration:id:web_village_code'] || recordData['id:web_village_code'];
      const vName = recordData['scope:registration:id:web_village'] || recordData['id:web_village'];

      const street = recordData['scope:registration:id:web_street_address'] || recordData['id:web_street_address'] || '';
      const streetInput = document.getElementById('web_street_address');
      if (streetInput) streetInput.value = street;

      // If legacy patient with no province code/name:
      if (!pCode && !pName) {
        if (dName) this.districtDropdown.setSelectionManual(dName, dCode);
        if (cName) this.communeDropdown.setSelectionManual(cName, cCode);
        if (vName) this.villageDropdown.setSelectionManual(vName, vCode);
        return;
      }

      // Match province
      const pPad = padCode(pCode, 'province');
      const provItem = provincesList.find(p => (pPad && p.code === pPad) || (pName && p.nameKh === pName));
      if (!provItem) {
        if (pName) this.provinceDropdown.setSelectionManual(pName, pCode);
        if (dName) this.districtDropdown.setSelectionManual(dName, dCode);
        if (cName) this.communeDropdown.setSelectionManual(cName, cCode);
        if (vName) this.villageDropdown.setSelectionManual(vName, vCode);
        return;
      }

      this.provinceDropdown.setSelectionManual(provItem.nameKh, provItem.code);
      this.selectedProvince = provItem;

      // Load district options
      try {
        const districts = await this.fetchProvinceDetail(provItem);
        this.currentDistrictsData = districts;
        const districtOptions = districts.map(d => ({
          id: d.id,
          code: padCode(d.code, 'district'),
          nameKh: `${d.type ? d.type + ' ' : ''}${d.local}`.trim(),
          nameEn: d.english,
          communes: d.communes || [],
        }));
        this.districtDropdown.setOptions(districtOptions);
        this.districtDropdown.setDisabled(false);

        const dPad = padCode(dCode, 'district');
        const distItem = districtOptions.find(d => (dPad && d.code === dPad) || (dName && (d.nameKh === dName || d.nameKh.includes(dName))));
        if (!distItem) {
          if (dName) this.districtDropdown.setSelectionManual(dName, dCode);
          return;
        }

        this.districtDropdown.setSelectionManual(distItem.nameKh, distItem.code);
        this.selectedDistrict = distItem;

        // Populate communes
        const communes = (distItem.communes || []).map(c => ({
          id: c.id,
          code: padCode(c.code, 'commune'),
          nameKh: `${c.type ? c.type + ' ' : ''}${c.local}`.trim(),
          nameEn: c.english,
          villages: c.villages || [],
        }));
        this.communeDropdown.setOptions(communes);
        this.communeDropdown.setDisabled(false);

        const cPad = padCode(cCode, 'commune');
        const commItem = communes.find(c => (cPad && c.code === cPad) || (cName && (c.nameKh === cName || c.nameKh.includes(cName))));
        if (!commItem) {
          if (cName) this.communeDropdown.setSelectionManual(cName, cCode);
          return;
        }

        this.communeDropdown.setSelectionManual(commItem.nameKh, commItem.code);
        this.selectedCommune = commItem;

        // Populate villages
        const villages = (commItem.villages || []).map(v => ({
          id: v.id,
          code: padCode(v.code, 'village'),
          nameKh: `${v.type ? v.type + ' ' : ''}${v.local}`.trim(),
          nameEn: v.english,
        }));
        this.villageDropdown.setOptions(villages);
        this.villageDropdown.setDisabled(false);

        const vPad = padCode(vCode, 'village');
        const villItem = villages.find(v => (vPad && v.code === vPad) || (vName && (v.nameKh === vName || v.nameKh.includes(vName))));
        if (!villItem) {
          if (vName) this.villageDropdown.setSelectionManual(vName, vCode);
          return;
        }

        this.villageDropdown.setSelectionManual(villItem.nameKh, villItem.code);
        this.selectedVillage = villItem;
        if (typeof window.updateCoverageAreaFromRecord === 'function') {
          window.updateCoverageAreaFromRecord(recordData);
        }
      } catch (e) {
        console.error('Error restoring address detail:', e);
      }
    }
  }

  // Global instance
  const addressManager = new CambodiaAddressManager();

  window.initCambodiaAddress = function () {
    addressManager.init();
  };

  window.restorePatientAddress = function (recordData) {
    addressManager.restoreAddress(recordData);
  };

  // Prepare the complete local hierarchy before changing any registration controls.
  window.applyVerifiedHefAddress = async function (address, stillCurrent) {
    const p = provincesList.find(x => x.code === padCode(address.provinceCode, 'province'));
    if (!p || !addressManager.provinceDropdown) throw new Error('Local address catalogue is not ready or does not contain this province.');
    const rawDistricts = await addressManager.fetchProvinceDetail(p);
    const districts = rawDistricts.map(x => ({...x, code:padCode(x.code,'district'), nameKh:`${x.type || ''} ${x.local}`.trim(), nameEn:x.english}));
    const d = districts.find(x=>x.code===padCode(address.districtCode,'district'));
    const communes = (d?.communes || []).map(x=>({...x,code:padCode(x.code,'commune'),nameKh:`${x.type || ''} ${x.local}`.trim(),nameEn:x.english}));
    const c = communes.find(x=>x.code===padCode(address.communeCode,'commune'));
    const villages = (c?.villages || []).map(x=>({...x,code:padCode(x.code,'village'),nameKh:`${x.type || ''} ${x.local}`.trim(),nameEn:x.english}));
    const v = villages.find(x=>x.code===padCode(address.villageCode,'village'));
    if (!d || !c || !v) throw new Error('Address does not match the local hierarchy. Uncheck Import address and review it manually.');
    if (!stillCurrent()) throw new Error('Patient or form changed; verify again.');
    addressManager.currentDistrictsData=rawDistricts;
    addressManager.selectedProvince=p;addressManager.selectedDistrict=d;addressManager.selectedCommune=c;addressManager.selectedVillage=v;
    addressManager.districtDropdown.setOptions(districts);addressManager.communeDropdown.setOptions(communes);addressManager.villageDropdown.setOptions(villages);
    for (const [dropdown,item] of [[addressManager.provinceDropdown,p],[addressManager.districtDropdown,d],[addressManager.communeDropdown,c],[addressManager.villageDropdown,v]]) {
      dropdown.setDisabled(false);dropdown.setSelectionManual(item.nameKh,item.code);
    }
    for (const id of ['web_province','web_district','web_commune','web_village'])document.getElementById(id)?.dispatchEvent(new Event('change',{bubbles:true}));
    if (typeof window.updateCoverageAreaFromDistrict === 'function' && d) {
      window.updateCoverageAreaFromDistrict(d.code, d.nameKh);
    }
  };

  window.cambodiaAddressManager = addressManager;

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => addressManager.init());
  } else {
    setTimeout(() => addressManager.init(), 0);
  }
})();
