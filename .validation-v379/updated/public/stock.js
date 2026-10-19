'use strict';
(async () => {
  const kind = location.pathname.startsWith('/imaging') ? 'film' : location.pathname.startsWith('/lab') ? 'material' : 'medicine';
  const el = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  
  let csrf = '';
  let items = [];
  let history = [];
  let activeFilter = 'all';
  let searchQuery = '';

  // Setup department-specific UI: remove non-matching toolbars from DOM
  if (kind !== 'film') {
    document.querySelectorAll('.film-field, .imaging-toolbar').forEach(x => { x.style.display = 'none'; x.remove(); });
  }
  if (kind !== 'material') {
    document.querySelectorAll('.material-field, .lab-toolbar').forEach(x => { x.style.display = 'none'; x.remove(); });
  }
  if (kind !== 'medicine') {
    document.querySelectorAll('.medicine-field').forEach(x => { x.style.display = 'none'; x.remove(); });
  }

  if (kind === 'film') {
    if (el('stock-title')) el('stock-title').textContent = 'បញ្ជីហ្វីល និងសម្ភារៈរូបភាពវេជ្ជសាស្ត្រ';
    if (el('stock-help')) el('stock-help').textContent = 'គ្រប់គ្រងស្តុកហ្វីល X-Ray, CT Scan, MRI, ក្រដាសអេកូ និងសម្ភារៈរូបភាពវេជ្ជសាស្ត្រ។';
    if (el('stock-name-label')) el('stock-name-label').textContent = 'ឈ្មោះហ្វីល ឬសម្ភារៈ *';
    if (el('stock-name-input')) el('stock-name-input').placeholder = 'ឧ. X-Ray Dry Film 14x17"';
    if (el('stock-qty-label')) el('stock-qty-label').textContent = 'ចំនួនបន្ថែមក្នុងស្តុក *';
    if (el('stock-submit-btn')) el('stock-submit-btn').textContent = 'បន្ថែមមុខហ្វីល/សម្ភារៈ';
    if (el('stock-table-title')) el('stock-table-title').textContent = 'បញ្ជីហ្វីល និងសម្ភារៈក្នុងស្តុក';
    if (el('stock-search')) el('stock-search').placeholder = 'ស្វែងរកតាមឈ្មោះ Modality ទំហំ ឬកូដ…';
  } else if (kind === 'medicine') {
    if (el('stock-title')) el('stock-title').textContent = 'បញ្ជីឱសថ';
    if (el('stock-help')) el('stock-help').textContent = 'គ្រប់គ្រងស្តុកឱសថ ដកស្តុកស្វ័យប្រវត្តិតាមវេជ្ជបញ្ជា OPD/IPD និងកត់ត្រាការទទួលឱសថចូលស្តុក។';
    if (el('stock-name-label')) el('stock-name-label').textContent = 'ឈ្មោះឱសថ *';
    if (el('stock-name-input')) el('stock-name-input').placeholder = 'ឧ. Paracetamol';
    if (el('stock-qty-label')) el('stock-qty-label').textContent = 'ចំនួនបន្ថែមក្នុងស្តុក *';
    if (el('stock-submit-btn')) el('stock-submit-btn').textContent = 'បន្ថែមមុខឱសថ';
    if (el('stock-table-title')) el('stock-table-title').textContent = 'បញ្ជីឱសថក្នុងស្តុក';
    if (el('stock-search')) el('stock-search').placeholder = 'ស្វែងរកតាមឈ្មោះ កូដ CMS/ATC ឬទម្រង់…';
  } else {
    if (el('stock-title')) el('stock-title').textContent = 'បញ្ជីសម្ភារៈមន្ទីរពិសោធន៍';
    if (el('stock-help')) el('stock-help').textContent = 'គ្រប់គ្រងស្តុកសម្ភារៈមន្ទីរពិសោធន៍ ដកស្តុកស្វ័យប្រវត្តិតាមកូដតេស្ត និងកត់ត្រាការទទួល/ប្រើប្រាស់ដោយផ្ទាល់។';
    if (el('stock-name-label')) el('stock-name-label').textContent = 'ឈ្មោះសម្ភារៈ / Reagent *';
    if (el('stock-name-input')) el('stock-name-input').placeholder = 'ឧ. Rapid Test Kit ឬ Reagent A';
    if (el('stock-qty-label')) el('stock-qty-label').textContent = 'ចំនួនបន្ថែមក្នុងស្តុក *';
    if (el('stock-submit-btn')) el('stock-submit-btn').textContent = 'បន្ថែមមុខសម្ភារៈ';
    if (el('stock-table-title')) el('stock-table-title').textContent = 'បញ្ជីសម្ភារៈ និង Reagent ក្នុងស្តុក';
    if (el('stock-search')) el('stock-search').placeholder = 'ស្វែងរកតាមឈ្មោះ កូដ REF/CMS ប្រភេទ ឬតេស្ត…';
  }

  function renderHeader() {
    const thead = el('stock-thead');
    if (!thead) return;
    if (kind === 'film') {
      thead.innerHTML = `
        <tr>
          <th>REF / កូដទំនិញ</th>
          <th>កូដ CMS</th>
          <th>ឈ្មោះហ្វីល / សម្ភារៈ</th>
          <th>Modality</th>
          <th>ទំហំ / Specification</th>
          <th>លេខ Lot</th>
          <th>កាលបរិច្ឆេទផុតកំណត់</th>
          <th>ឯកតា</th>
          <th>ស្តុកនៅសល់</th>
          <th>ប្រើ/ករណី</th>
          <th style="text-align:right">សកម្មភាព</th>
        </tr>
      `;
    } else if (kind === 'medicine') {
      thead.innerHTML = `
        <tr>
          <th>កូដ CMS</th>
          <th>កូដ ATC</th>
          <th>ឈ្មោះឱសថ</th>
          <th>កំហាប់</th>
          <th>ទម្រង់ និងកម្រិតប្រើ</th>
          <th>កាលបរិច្ឆេទផុតកំណត់</th>
          <th>ឯកតា</th>
          <th>ស្តុកនៅសល់</th>
          <th style="text-align:right">សកម្មភាព</th>
        </tr>
      `;
    } else {
      thead.innerHTML = `
        <tr>
          <th>REF / កូដទំនិញ</th>
          <th>កូដ CMS</th>
          <th>ឈ្មោះសម្ភារៈ / Reagent</th>
          <th>ប្រភេទ</th>
          <th>លេខ Lot</th>
          <th>លក្ខខណ្ឌរក្សាទុក</th>
          <th>កាលបរិច្ឆេទផុតកំណត់</th>
          <th>ឯកតា</th>
          <th>ស្តុកនៅសល់</th>
          <th>តេស្តភ្ជាប់ & បរិមាណប្រើ</th>
          <th style="text-align:right">សកម្មភាព</th>
        </tr>
      `;
    }
  }
  renderHeader();

  async function api(action = '', body) {
    const url = `/api/stock/${kind}${action ? '/' + action : ''}`;
    const r = await fetch(url, {
      credentials: 'same-origin',
      cache: 'no-store',
      ...(body ? {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrf
        },
        body: JSON.stringify(body)
      } : {})
    });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Error(d.error || 'ដំណើរការស្នើសុំមិនបានជោគជ័យ');
    return d;
  }

  function updateKpis() {
    const totalItems = items.length;
    let totalQty = 0;
    let lowOrOut = 0;
    for (const it of items) {
      const b = Number(it.balance) || 0;
      totalQty += b;
      if (b <= 10) lowOrOut++;
    }
    if (el('kpi-total-items')) el('kpi-total-items').textContent = totalItems;
    if (el('kpi-total-qty')) el('kpi-total-qty').textContent = totalQty.toLocaleString();
    if (el('kpi-low-stock')) el('kpi-low-stock').textContent = lowOrOut;
  }

  function renderRows() {
    const q = searchQuery.trim().toLowerCase();
    const filtered = items.filter(x => {
      const name = String(x.name || '').toLowerCase();
      const code = String(x.test_code || '').toLowerCase();
      const cms = String(x.cms_code || '').toLowerCase();
      const atc = String(x.atc_code || '').toLowerCase();
      const ref = String(x.ref_code || '').toLowerCase();
      const cat = String(x.category || '').toLowerCase();
      const lot = String(x.lot_no || '').toLowerCase();
      const storage = String(x.storage_condition || '').toLowerCase();
      const strength = String(x.strength || '').toLowerCase();
      const doseForm = String(x.dose_form || '').toLowerCase();
      const unit = String(x.unit || '').toLowerCase();
      const matchesSearch = !q || name.includes(q) || code.includes(q) || cms.includes(q) || atc.includes(q) ||
        ref.includes(q) || cat.includes(q) || lot.includes(q) || storage.includes(q) ||
        strength.includes(q) || doseForm.includes(q) || unit.includes(q);
      if (!matchesSearch) return false;
      const b = Number(x.balance) || 0;
      if (activeFilter === 'low') return b > 0 && b <= 10;
      if (activeFilter === 'out') return b <= 0;
      return true;
    });

    const tbody = el('stock-rows');
    const colCount = kind === 'medicine' ? 9 : 11;
    if (!filtered.length) {
      tbody.innerHTML = `<tr><td colspan="${colCount}" class="empty-table-msg">មិនមានទិន្នន័យស្តុកបង្ហាញ</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(x => {
      const b = Number(x.balance) || 0;
      let badgeClass = 'in-stock';
      let icon = '';
      if (b <= 0) {
        badgeClass = 'out-of-stock';
        icon = '🚫 ';
      } else if (b <= 10) {
        badgeClass = 'low-stock';
        icon = '⚠️ ';
      }
      const expStr = x.expiry_date ? esc(x.expiry_date) : '<span style="color:#94a3b8">—</span>';
      if (kind === 'film') {
        return `
          <tr data-id="${esc(x.id)}">
            <td data-language-exclude>${x.ref_code ? `<span class="code-badge ref">${esc(x.ref_code)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
            <td data-language-exclude>${x.cms_code ? `<span class="code-badge cms">${esc(x.cms_code)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
            <td data-language-exclude><strong>${esc(x.name)}</strong></td>
            <td data-language-exclude>${x.category ? `<span class="category-chip modality-chip">${esc(x.category)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
            <td data-language-exclude>${esc(x.strength || '—')}</td>
            <td data-language-exclude>${x.lot_no ? `<span class="lot-badge">${esc(x.lot_no)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
            <td><small style="color:#5e7e8d">${expStr}</small></td>
            <td data-language-exclude>${esc(x.unit)}</td>
            <td><span class="stock-badge ${badgeClass}">${icon}${esc(x.balance)} ${esc(x.unit)}</span></td>
            <td>${esc(x.per_test)} / ករណី</td>
            <td style="text-align:right">
              <button type="button" class="quick-select-btn" data-select-id="${esc(x.id)}" title="ជ្រើសរើសសម្រាប់ទទួល ឬកត់ត្រាការប្រើ">ជ្រើសរើស</button>
            </td>
          </tr>
        `;
      }
      if (kind === 'medicine') {
        return `
          <tr data-id="${esc(x.id)}">
            <td data-language-exclude>${x.cms_code ? `<span class="code-badge cms">${esc(x.cms_code)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
            <td data-language-exclude>${x.atc_code ? `<span class="code-badge atc">${esc(x.atc_code)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
            <td data-language-exclude><strong>${esc(x.name)}</strong></td>
            <td data-language-exclude>${esc(x.strength || '—')}</td>
            <td data-language-exclude>${esc(x.dose_form || '—')}</td>
            <td><small style="color:#5e7e8d">${expStr}</small></td>
            <td data-language-exclude>${esc(x.unit)}</td>
            <td><span class="stock-badge ${badgeClass}">${icon}${esc(x.balance)} ${esc(x.unit)}</span></td>
            <td style="text-align:right">
              <button type="button" class="quick-select-btn" data-select-id="${esc(x.id)}" title="ជ្រើសរើសសម្រាប់ទទួល ឬកត់ត្រាការប្រើ">ជ្រើសរើស</button>
            </td>
          </tr>
        `;
      }
      return `
        <tr data-id="${esc(x.id)}">
          <td data-language-exclude>${x.ref_code ? `<span class="code-badge ref">${esc(x.ref_code)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
          <td data-language-exclude>${x.cms_code ? `<span class="code-badge cms">${esc(x.cms_code)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
          <td data-language-exclude><strong>${esc(x.name)}</strong></td>
          <td data-language-exclude>${x.category ? `<span class="category-chip">${esc(x.category)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
          <td data-language-exclude>${x.lot_no ? `<span class="lot-badge">${esc(x.lot_no)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
          <td data-language-exclude>${x.storage_condition ? `<span class="storage-chip">${esc(x.storage_condition)}</span>` : '<span style="color:#94a3b8">—</span>'}</td>
          <td><small style="color:#5e7e8d">${expStr}</small></td>
          <td data-language-exclude>${esc(x.unit)}</td>
          <td><span class="stock-badge ${badgeClass}">${icon}${esc(x.balance)} ${esc(x.unit)}</span></td>
          <td data-language-exclude>${x.test_code ? `<span class="test-code-badge">${esc(x.test_code)}</span> <small style="color:#5e7e8d">(${esc(x.per_test)}/តេស្ត)</small>` : '<span style="color:#94a3b8">—</span>'}</td>
          <td style="text-align:right">
            <button type="button" class="quick-select-btn" data-select-id="${esc(x.id)}" title="ជ្រើសរើសសម្រាប់ទទួល ឬកត់ត្រាការប្រើ">ជ្រើសរើស</button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderMovementOptions() {
    const sel = el('stock-movement')?.elements?.itemId;
    if (!sel) return;
    const currentVal = sel.value;
    sel.innerHTML = '<option value="">-- ជ្រើសរើសមុខស្តុក --</option>' +
      items.map(x => `<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.unit)} (${esc(x.balance)})</option>`).join('');
    if (currentVal && items.some(x => String(x.id) === String(currentVal))) {
      sel.value = currentVal;
    }
  }

  function renderHistory() {
    const tbody = el('stock-history');
    if (!tbody) return;
    if (!history.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="empty-table-msg">មិនទាន់មានប្រវត្តិប្រតិបត្តិការ</td></tr>';
      return;
    }
    tbody.innerHTML = history.map(x => {
      const d = Number(x.delta) || 0;
      const isPos = d > 0;
      const dt = new Date(x.created_at);
      const timeStr = isNaN(dt.getTime()) ? esc(x.created_at) : dt.toLocaleString('km-KH');
      return `
        <tr>
          <td><small style="color:#5e7e8d">${timeStr}</small></td>
          <td data-language-exclude><strong>${esc(x.name)}</strong></td>
          <td><span class="delta-badge ${isPos ? 'pos' : 'neg'}">${isPos ? '+' : ''}${esc(x.delta)} ${esc(x.unit)}</span></td>
          <td data-language-exclude><span class="source-chip">${esc(x.source)}</span></td>
        </tr>
      `;
    }).join('');
  }

  function renderAll() {
    updateKpis();
    renderRows();
    renderMovementOptions();
    renderHistory();
  }

  async function loadData() {
    try {
      const [itemsRes, histRes] = await Promise.all([
        api(),
        api('history').catch(() => ({ history: [] }))
      ]);
      items = itemsRes.items || [];
      history = histRes.history || [];
      renderAll();
    } catch (e) {
      const st = el('stock-status');
      if (st) {
        st.textContent = e.message;
        st.className = 'stock-status status-error';
      }
    }
  }

  async function submit(form, action) {
    if (form.dataset.busy) return;
    form.dataset.busy = '1';
    const buttons = [...form.querySelectorAll('button')];
    const statusEl = el('stock-status');
    try {
      const body = Object.fromEntries(new FormData(form));
      buttons.forEach(b => b.disabled = true);
      await api(action, body);
      if (statusEl) {
        statusEl.textContent = 'បានរក្សាទុកដោយជោគជ័យ';
        statusEl.className = 'stock-status status-success';
      }
      if (form.id === 'stock-add') {
        form.reset();
      } else if (form.id === 'stock-movement') {
        const qInput = form.querySelector('input[name="quantity"]');
        if (qInput) qInput.value = '';
        const rInput = form.querySelector('input[name="reference"]');
        if (rInput) rInput.value = '';
      }
      await loadData();
    } catch (e) {
      if (statusEl) {
        statusEl.textContent = e.message;
        statusEl.className = 'stock-status status-error';
      }
    } finally {
      delete form.dataset.busy;
      buttons.forEach(b => b.disabled = false);
    }
  }

  // Quick select from table into movement form
  el('stock-rows')?.addEventListener('click', e => {
    const btn = e.target.closest('[data-select-id]');
    if (!btn) return;
    const id = btn.dataset.selectId;
    const sel = el('stock-movement')?.elements?.itemId;
    if (sel) {
      sel.value = id;
      const qInput = el('stock-movement')?.elements?.quantity;
      if (qInput) {
        qInput.focus();
        qInput.select();
      }
    }
  });

  // Search inputs
  const searchIds = ['stock-search', 'stock-search-top', 'film-stock-search', 'lab-search'];
  searchIds.forEach(id => {
    el(id)?.addEventListener('input', e => {
      searchQuery = e.target.value;
      searchIds.forEach(otherId => {
        const other = el(otherId);
        if (other && other !== e.target && other.value !== searchQuery) other.value = searchQuery;
      });
      renderRows();
    });
  });

  // Filter pills
  el('stock-filter-pills')?.addEventListener('click', e => {
    const btn = e.target.closest('.pill-btn');
    if (!btn) return;
    activeFilter = btn.dataset.filter || 'all';
    document.querySelectorAll('.pill-btn').forEach(b => b.classList.toggle('active', b === btn));
    renderRows();
  });

  // Form submit listeners
  el('stock-add')?.addEventListener('submit', e => {
    e.preventDefault();
    submit(e.target, '');
  });

  el('stock-movement')?.addEventListener('submit', e => {
    e.preventDefault();
    submit(e.target, e.submitter?.value || 'receipt');
  });

  // Initial load
  try {
    const me = await fetch('/api/auth/me', { cache: 'no-store' }).then(r => r.json());
    csrf = me.csrfToken;
    await loadData();

    if (kind === 'material') {
      const catalogData = await fetch('/api/lab-catalog', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
      const rows = catalogData.catalog || catalogData.tests || [];
      const testCodeSel = el('stock-add')?.elements?.testCode;
      if (testCodeSel && rows.length) {
        testCodeSel.innerHTML = '<option value="">មិនភ្ជាប់</option>' +
          '<optgroup label="បញ្ជីតេស្តមន្ទីរពិសោធន៍">' +
          rows.map(x => `<option value="${esc(x.code)}">${esc(x.code)} · ${esc(x.name)}</option>`).join('') +
          '</optgroup>';
      }
    }
  } catch (e) {
    const st = el('stock-status');
    if (st) {
      st.textContent = e.message;
      st.className = 'stock-status status-error';
    }
  }
})();
