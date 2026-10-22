/**
 * Borkeo EMR - Modern App Shell & Navigation Controller (Phase 3)
 * Implements WCAG 2.2 AA and IEC 62366-1 accessible navigation,
 * role-aware navigation, command palette (Ctrl+K), and keyboard shortcuts.
 */

'use strict';

(function initEmrAppShell() {
  // Avoid running on login page or blank print-preview
  if (window.location.pathname === '/login' || window.location.pathname === '/print-preview') {
    return;
  }

  const escapeHtml = window.escapeHtml || function (v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  };

  const ROLE_LABELS = {
    ADMIN: 'អ្នកគ្រប់គ្រងប្រព័ន្ធ',
    REGISTRATION: 'ចុះឈ្មោះ',
    TRIAGE: 'ផ្នែកទ្រីយ៉ា',
    DOCTOR: 'វេជ្ជបណ្ឌិត',
    NURSE: 'គិលានុបដ្ឋាក',
    MIDWIFE: 'ឆ្មប',
    LAB: 'មន្ទីរពិសោធន៍',
    IMAGING: 'រូបភាពវេជ្ជសាស្ត្រ',
    PHARMACY: 'ឱសថស្ថាន',
    ACCOUNTANT: 'គណនេយ្យករ',
    CLERK: 'បេឡា',
    VICE_DIRECTOR: 'អនុប្រធានមន្ទីរពេទ្យ',
    DIRECTOR: 'នាយកមន្ទីរពេទ្យ',
    CHIEF_WARD: 'ប្រធានផ្នែក',
    WARD_HEAD: 'នាយសាល'
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

  const PAGE_TITLES = {
    '/home': 'ទំព័រដើម',
    '/patient-list': 'បញ្ជីអ្នកជំងឺ',
    '/emr': 'កំណត់ត្រាវេជ្ជសាស្ត្រ',
    '/departments': 'គ្រប់គ្រងផ្នែក និងគ្រែ',
    '/ward-medicines': 'បញ្ជីឱសថប្រចាំថ្ងៃ',
    '/opd-queue': 'បញ្ជីរង់ចាំ OPD',
    '/pharmacy/opd': 'ចែកឱសថ OPD',
    '/pharmacy/medicines': 'បញ្ជីឱសថ',
    '/stock': 'ឃ្លាំងឱសថ និងសម្ភារៈ',
    '/lab': 'មន្ទីរពិសោធន៍',
    '/imaging': 'រូបភាពវេជ្ជសាស្ត្រ',
    '/billing': 'បេឡា និងវិក្កយបត្រ',
    '/expenses': 'កត់ត្រាចំណាយ',
    '/finance': 'លំហូរសាច់ប្រាក់',
    '/admin/users': 'គ្រប់គ្រងគណនី',
    '/admin/health-facility': 'ព័ត៌មានមូលដ្ឋានសុខាភិបាល',
    '/admin/organization': 'ឈ្មោះ និងស្លាកសញ្ញា',
    '/admin/interface': 'រចនាគេហទំព័រ',
    '/styleguide': 'រចនាប័ទ្ម Styleguide',
    '/requests': 'ការស្នើសុំ និងសវនកម្ម',
    '/triage': 'ផ្នែកទ្រីយ៉ា',
    '/ipd-transfer': 'ផ្ទេរ និងចេញអ្នកជំងឺ',
    '/pmrs-import': 'នាំចូលទិន្នន័យ PMRS2'
  };

  const NAV = window.EmrNavConfig || null;

  const UI = {
    kh: {
      mainNav: 'ការរុករកចម្បង', menu: 'ម៉ឺនុយ', openMenu: 'បើកម៉ឺនុយរុករក', closeMenu: 'បិទម៉ឺនុយរុករក',
      pin: 'ខ្ទាស់ម៉ឺនុយឱ្យបើកជានិច្ច', unpin: 'ឈប់ខ្ទាស់ម៉ឺនុយ', account: 'គណនីអ្នកប្រើប្រាស់',
      switchContext: 'ប្តូរតួនាទី ឬផ្នែក', changePassword: 'ប្តូរពាក្យសម្ងាត់', shortcuts: 'ផ្លូវកាត់ក្ដារចុច (?)',
      logout: 'ចាកចេញពីប្រព័ន្ធ', language: 'ភាសាប្រព័ន្ធ', languageName: 'ភាសាខ្មែរ', search: 'ស្វែងរក',
      switching: 'កំពុងប្តូរតួនាទី…', switchFailed: 'មិនអាចប្តូរតួនាទី ឬផ្នែកបានទេ។',
      switched: 'បានប្តូរទៅ', reloadHint: 'ផ្ទុកទំព័រឡើងវិញ ដើម្បីបង្ហាញទិន្នន័យសម្រាប់តួនាទីថ្មី។', reload: 'ផ្ទុកឡើងវិញ', dismiss: 'បិទ',
      noItems: 'មិនមានទំព័រសម្រាប់តួនាទីនេះទេ',
      switchUserType: 'ប្តូរប្រភេទអ្នកប្រើ', userTypeRole: 'តួនាទី', userTypeWard: 'ផ្នែក', chooseWard: 'ជ្រើសរើសផ្នែក'
    },
    en: {
      mainNav: 'Main navigation', menu: 'Menu', openMenu: 'Open navigation menu', closeMenu: 'Close navigation menu',
      pin: 'Keep menu expanded', unpin: 'Unpin menu', account: 'User account',
      switchContext: 'Switch role or ward', changePassword: 'Change password', shortcuts: 'Keyboard shortcuts (?)',
      logout: 'Sign out', language: 'Interface language', languageName: 'English', search: 'Search',
      switching: 'Switching role…', switchFailed: 'Could not switch role or ward.',
      switched: 'Switched to', reloadHint: 'Reload the page to show data for the new role.', reload: 'Reload', dismiss: 'Close',
      noItems: 'No pages for this role',
      switchUserType: 'Switch user type', userTypeRole: 'Role', userTypeWard: 'Ward', chooseWard: 'Choose ward'
    }
  };

  function lang() {
    try { return window.getBorkeoLanguage?.() === 'en' ? 'en' : 'kh'; } catch { return 'kh'; }
  }

  function t(key) {
    return (UI[lang()] || UI.kh)[key] ?? UI.kh[key];
  }

  // Sidebar preferences are a per-browser convenience; storage may be blocked.
  const storage = {
    get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
    set(key, value) { try { window.localStorage.setItem(key, value); } catch {} }
  };

  function roleLabel(role) {
    return lang() === 'en' ? String(role || '').replace(/_/g, ' ') : (ROLE_LABELS[role] || role || '');
  }

  function wardLabel(user, code) {
    if (!code) return '';
    const ward = (user.wards || []).find(item => item.code === code) || (user.activeWard?.code === code ? user.activeWard : null);
    return (lang() === 'en' ? ward?.nameEn : ward?.nameKh) || WARD_LABELS[code] || ward?.name || code;
  }

  // v42.1: the Superuser "switch user type" window. The same 15 user types
  // and ward rules as the /context picker (server/access.mjs roleWardAllowed).
  const USER_TYPE_ORDER = ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR', 'REGISTRATION', 'TRIAGE', 'DOCTOR', 'NURSE', 'MIDWIFE',
    'CHIEF_WARD', 'WARD_HEAD', 'LAB', 'IMAGING', 'PHARMACY', 'CLERK', 'ACCOUNTANT'];

  function userTypeNeedsWard(role) {
    return ['DOCTOR', 'NURSE', 'MIDWIFE', 'CHIEF_WARD', 'WARD_HEAD'].includes(role);
  }

  function userTypeWardAllowed(role, code) {
    if (role === 'MIDWIFE') return code === 'obstetric';
    if (role === 'NURSE') return code !== 'obstetric';
    if (role === 'CHIEF_WARD' || role === 'WARD_HEAD') return code !== 'opd';
    return true;
  }

  function contextLabel(user, role, wardCode) {
    const ward = wardLabel(user, wardCode);
    return ward ? `${roleLabel(role)} · ${ward}` : roleLabel(role);
  }

  function initialsFor(user) {
    const name = String(user.displayName || user.username || 'U').trim();
    const words = name.split(/\s+/).filter(Boolean);
    if (/^[A-Za-z]/.test(name)) return words.slice(0, 2).map(word => word[0]).join('').toUpperCase();
    // Khmer: one whole grapheme so subscripts and vowel signs stay attached.
    try {
      const first = new Intl.Segmenter('km', { granularity: 'grapheme' }).segment(name)[Symbol.iterator]().next().value;
      return first ? first.segment : name.slice(0, 1);
    } catch {
      return name.slice(0, 1);
    }
  }

  function navGroupsFor(user, settings) {
    return NAV ? NAV.visibleGroups(user, settings?.[user.activeRole]) : [];
  }

  function navHtml(groups) {
    const en = lang() === 'en';
    const items = groups.flatMap(group => group.items);
    const activeId = NAV ? NAV.activeItemId(items, window.location.pathname, window.location.search) : null;
    if (!groups.length) return `<p class="emr-sidebar-empty">${escapeHtml(t('noItems'))}</p>`;
    return groups.map(group => `
      <div class="emr-sidebar-section" role="group" aria-labelledby="emr-nav-group-${escapeHtml(group.id)}">
        <div class="emr-sidebar-section-title" id="emr-nav-group-${escapeHtml(group.id)}"><span>${escapeHtml(en ? group.labelEn : group.label)}</span></div>
        <ul class="emr-sidebar-list">
          ${group.items.map(item => {
            // v41.2: an item without approved Khmer uses its newText key (public/new-text.js).
            const label = en ? item.labelEn : (item.label || window.newText?.(item.newTextKey, item.labelEn) || item.labelEn);
            const active = item.id === activeId;
            return `<li><a href="${escapeHtml(item.href)}" class="emr-sidebar-item${active ? ' is-active' : ''}" data-nav-id="${escapeHtml(item.id)}" aria-label="${escapeHtml(label)}" data-tooltip="${escapeHtml(label)}"${active ? ' aria-current="page"' : ''}>
              <svg class="emr-sidebar-icon" aria-hidden="true" focusable="false"><use href="/public/icons.svg#${escapeHtml(item.icon)}"></use></svg>
              <span class="emr-sidebar-label">${escapeHtml(label)}</span>
            </a></li>`;
          }).join('')}
        </ul>
      </div>
    `).join('');
  }

  function footerHtml(user) {
    const name = user.displayName || user.username || '';
    const current = contextLabel(user, user.activeRole, user.activeWard?.code || '');
    const contexts = user.contexts || [];
    // A short list switches in place; very long lists (e.g. admin with every
    // ward) use the full /context page.
    const contextItems = contexts.length > 8 ? `
      <a href="/context" class="emr-dropdown-item" role="menuitem">
        <svg aria-hidden="true"><use href="/public/icons.svg#icon-refresh"></use></svg>
        <span>${escapeHtml(t('switchContext'))}…</span>
      </a>
      <div class="emr-dropdown-divider" role="separator"></div>` : contexts.length > 1 ? `
      <div class="emr-dropdown-group-label" aria-hidden="true">${escapeHtml(t('switchContext'))}</div>
      ${contexts.map(context => {
        const active = context.role === user.activeRole && (context.wardCode || '') === (user.activeWard?.code || '');
        return `<button type="button" class="emr-dropdown-item emr-context-option${active ? ' is-current' : ''}" role="menuitemradio" aria-checked="${active}" data-role="${escapeHtml(context.role)}" data-ward="${escapeHtml(context.wardCode || '')}">
          <svg aria-hidden="true"><use href="/public/icons.svg#${active ? 'icon-check' : 'icon-refresh'}"></use></svg>
          <span>${escapeHtml(contextLabel(user, context.role, context.wardCode || ''))}</span>
        </button>`;
      }).join('')}
      <div class="emr-dropdown-divider" role="separator"></div>` : '';
    return `
      <div class="emr-user-menu-wrap">
        <div class="emr-user-dropdown" id="emr-user-dropdown" role="menu" aria-label="${escapeHtml(t('account'))}">
          <div class="emr-dropdown-header">
            <div class="emr-dropdown-user">${escapeHtml(name)}</div>
            <div class="emr-dropdown-sub">@${escapeHtml(user.username || '')} · ${escapeHtml(current)}</div>
          </div>
          ${contextItems}
          <button type="button" class="emr-dropdown-item" id="emr-dropdown-change-pw" role="menuitem">
            <svg aria-hidden="true"><use href="/public/icons.svg#icon-lock"></use></svg>
            <span>${escapeHtml(t('changePassword'))}</span>
          </button>
          <button type="button" class="emr-dropdown-item" id="emr-dropdown-shortcuts-btn" role="menuitem">
            <svg aria-hidden="true"><use href="/public/icons.svg#icon-help-circle"></use></svg>
            <span>${escapeHtml(t('shortcuts'))}</span>
          </button>
          <div class="emr-dropdown-divider" role="separator"></div>
          <button type="button" class="emr-dropdown-item danger" id="emr-dropdown-logout" role="menuitem">
            <svg aria-hidden="true"><use href="/public/icons.svg#icon-log-out"></use></svg>
            <span>${escapeHtml(t('logout'))}</span>
          </button>
        </div>
        <button type="button" class="emr-user-trigger" id="emr-user-trigger" aria-haspopup="menu" aria-expanded="false" aria-controls="emr-user-dropdown" aria-label="${escapeHtml(`${t('account')}: ${name}, ${current}`)}" data-tooltip="${escapeHtml(`${name} · ${current}`)}">
          <span class="emr-user-avatar" aria-hidden="true">${escapeHtml(initialsFor(user))}</span>
          <span class="emr-user-info">
            <span class="emr-user-name">${escapeHtml(name)}</span>
            <span class="emr-user-role-badge">${escapeHtml(current)}</span>
          </span>
          <svg class="emr-user-chevron" aria-hidden="true"><use href="/public/icons.svg#icon-chevron-up"></use></svg>
        </button>
      </div>
      <div class="emr-sidebar-footer-row">
        <span class="emr-lang-pill" title="${escapeHtml(t('language'))}">
          <svg aria-hidden="true"><use href="/public/icons.svg#icon-globe"></use></svg>
          <span>${escapeHtml(t('languageName'))}</span>
        </span>
        <button type="button" class="emr-sidebar-logout" id="emr-sidebar-logout" aria-label="${escapeHtml(t('logout'))}" data-tooltip="${escapeHtml(t('logout'))}">
          <svg aria-hidden="true"><use href="/public/icons.svg#icon-log-out"></use></svg>
          <span class="emr-sidebar-label">${escapeHtml(t('logout'))}</span>
        </button>
      </div>
    `;
  }

  function getBreadcrumbs() {
    const path = window.location.pathname;
    const items = [{ href: '/home', label: 'ទំព័រដើម' }];
    if (path !== '/home' && PAGE_TITLES[path]) {
      items.push({ href: path, label: PAGE_TITLES[path] });
    }
    return items;
  }

  // Live Patient Search Cache
  let cachedPatients = null;
  let isFetchingPatients = false;

  async function fetchPatientsList() {
    if (cachedPatients) return cachedPatients;
    if (isFetchingPatients) return [];
    isFetchingPatients = true;
    try {
      const response = await fetch('/api/patients?includePayment=1&omitPhotos=1', { credentials: 'same-origin' });
      if (response.ok) {
        const data = await response.json();
        cachedPatients = data.patients || [];
        return cachedPatients;
      }
    } catch {
      // silently fallback
    } finally {
      isFetchingPatients = false;
    }
    return [];
  }

  let shellMounting = false;

  async function mountAppShell() {
    // The session event and the timed fallback can both fire; mount once.
    if (shellMounting || document.getElementById('emr-topbar')) return;
    shellMounting = true;

    // Obtain session
    let session = window.emrSession;
    if (!session || !session.user) {
      try {
        const res = await fetch('/api/auth/me', { credentials: 'same-origin' });
        if (res.ok) {
          const data = await res.json();
          session = { user: data.user, csrfToken: data.csrfToken };
          window.emrSession = session;
        }
      } catch {
        shellMounting = false;
        return;
      }
    }

    if (!session || !session.user) {
      shellMounting = false;
      return;
    }

    // Admin "Interface -> navigation" hide/order settings (never adds items).
    let navSettings = null;
    try {
      const res = await fetch('/api/navigation-settings', { credentials: 'same-origin', cache: 'no-store' });
      if (res.ok) navSettings = (await res.json()).settings || null;
    } catch {}

    const user = session.user;
    const role = user.activeRole || '';
    const wardCode = user.activeWard?.code || '';
    const wardName = wardLabel(user, wardCode);

    // Apply body shell class
    document.body.classList.add('has-emr-shell');

    // 1. Skip-to-content accessibility link
    if (!document.querySelector('.skip-to-content')) {
      const skipLink = document.createElement('a');
      skipLink.className = 'skip-to-content';
      skipLink.href = '#main-content';
      skipLink.textContent = 'រំលងទៅមាតិកាចម្បង';
      document.body.prepend(skipLink);
    }

    // Ensure #main-content exists
    let mainContent = document.getElementById('main-content');
    if (!mainContent) {
      mainContent = document.querySelector('main, [class$="-shell"]');
      if (mainContent) {
        mainContent.id = 'main-content';
      }
    }

    // 2. Breadcrumbs
    const breadcrumbItems = getBreadcrumbs();
    if (breadcrumbItems.length > 1 && mainContent && !mainContent.querySelector(':scope > .emr-breadcrumbs-container')) {
      const bcContainer = document.createElement('div');
      bcContainer.className = 'emr-breadcrumbs-container';
      bcContainer.innerHTML = `
        <nav class="emr-breadcrumbs" aria-label="ការរុករកទំព័រ">
          ${breadcrumbItems.map((item, idx) => {
            const isLast = idx === breadcrumbItems.length - 1;
            if (isLast) {
              return `<span class="emr-breadcrumbs-current" aria-current="page">${escapeHtml(item.label)}</span>`;
            }
            return `<a href="${escapeHtml(item.href)}">${escapeHtml(item.label)}</a><span class="emr-breadcrumbs-separator" aria-hidden="true">›</span>`;
          }).join('')}
        </nav>
      `;
      mainContent.prepend(bcContainer);
    }

    // 3. Topbar
    const topbar = document.createElement('header');
    topbar.className = 'emr-topbar no-print';
    topbar.id = 'emr-topbar';
    topbar.setAttribute('role', 'banner');

    const hasContextSwitch = (user.contexts || []).length > 1;
    const wardChipHtml = wardName ? `
      <a href="${hasContextSwitch ? '/context' : '#'}" class="emr-ward-chip" id="emr-ward-chip" title="${hasContextSwitch ? 'ចុចដើម្បីប្តូរផ្នែក' : 'ផ្នែកបច្ចុប្បន្ន'}">
        <svg class="emr-icon" aria-hidden="true"><use href="/public/icons.svg#icon-hospital"></use></svg>
        <span>${escapeHtml(wardName)}</span>
      </a>
    ` : '';

    const counterRole = ['REGISTRATION', 'TRIAGE'].includes(role) || (role === 'DOCTOR' && wardCode === 'opd');
    let counterHtml = '';
    if (counterRole) {
      const savedCounter = window.sessionStorage.getItem('borkeo-counter-number') || '1';
      counterHtml = `
        <div class="emr-topbar-counter-wrap">
          <label for="emr-topbar-counter-sel">បញ្ជរ:</label>
          <select id="emr-topbar-counter-sel" class="emr-topbar-counter-select" aria-label="ជ្រើសរើសបញ្ជរ">
            ${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${String(n) === savedCounter ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </div>
      `;
    }

    const userTypeHtml = user.isSuperuser ? `
        <button type="button" class="emr-user-type-btn" id="emr-user-type-btn" aria-haspopup="dialog" aria-controls="emr-user-type-backdrop" aria-label="${escapeHtml(t('switchUserType'))}" title="${escapeHtml(t('switchUserType'))}">
          <svg class="emr-icon" aria-hidden="true"><use href="/public/icons.svg#icon-users"></use></svg>
          <span>${escapeHtml(t('switchUserType'))}</span>
        </button>
    ` : '';

    topbar.innerHTML = `
      <div class="emr-topbar-left">
        <button type="button" class="emr-sidebar-toggle-btn" id="emr-sidebar-toggle-btn" aria-label="${escapeHtml(t('openMenu'))}" aria-controls="emr-sidebar" aria-expanded="false">
          <svg aria-hidden="true"><use href="/public/icons.svg#icon-menu"></use></svg>
        </button>
        <a href="/home" class="emr-topbar-brand">
          <img src="/public/logo-hospital.jpg" alt="" class="emr-topbar-logo">
          <div class="emr-topbar-title-wrap">
            <span class="emr-topbar-title">មន្ទីរពេទ្យបង្អែក បរកែវ</span>
          </div>
        </a>
        ${wardChipHtml}
      </div>

      <div class="emr-topbar-center">
        <button type="button" class="emr-topbar-search-trigger" id="emr-global-search-trigger" aria-label="ស្វែងរកអ្នកជំងឺ (Ctrl+K)">
          <svg aria-hidden="true"><use href="/public/icons.svg#icon-search"></use></svg>
          <span class="emr-topbar-search-text">ស្វែងរកអ្នកជំងឺ (ឈ្មោះ, លេខកូដ, ទូរស័ព្ទ)...</span>
          <kbd class="emr-search-kbd">Ctrl K</kbd>
        </button>
      </div>

      <div class="emr-topbar-right">
        ${userTypeHtml}
        ${counterHtml}
        <div class="emr-sync-status" id="emr-sync-status" title="ស្ថានភាពការតភ្ជាប់ប្រព័ន្ធ">
          <span class="emr-status-dot online"></span>
          <span class="emr-status-text">អនឡាញ</span>
        </div>

        <button type="button" class="emr-topbar-btn" id="emr-topbar-notif-btn" aria-label="សារ និងការជូនដំណឹង" title="សារ និងការជូនដំណឹង">
          <svg aria-hidden="true"><use href="/public/icons.svg#icon-bell"></use></svg>
          <span class="emr-topbar-badge" id="emr-topbar-notif-badge" hidden>0</span>
        </button>
      </div>
    `;

    document.body.prepend(topbar);

    // 4. Left Sidebar Navigation (one shared component; rules in nav-config.js)
    let navGroups = navGroupsFor(user, navSettings);
    const sidebar = document.createElement('aside');
    sidebar.className = 'emr-sidebar no-print';
    sidebar.id = 'emr-sidebar';
    sidebar.dataset.state = 'collapsed';
    sidebar.setAttribute('aria-label', t('mainNav'));
    // Labels are rendered in the active language here; keep the page
    // translator from rewriting them a second time.
    sidebar.setAttribute('data-language-exclude', '');

    sidebar.innerHTML = `
      <div class="emr-sidebar-brand">
        <a href="${escapeHtml(navGroups[0]?.items[0]?.href || '/home')}" class="emr-sidebar-brand-link">
          <img src="/public/logo-hospital.jpg" alt="" class="emr-sidebar-logo">
          <span class="emr-sidebar-brand-text">
            <span class="emr-sidebar-brand-name">មន្ទីរពេទ្យបង្អែក បរកែវ</span>
            <span class="emr-sidebar-brand-sub">Borkeo EMR</span>
          </span>
        </a>
        <button type="button" class="emr-sidebar-pin-btn" id="emr-sidebar-pin-btn" aria-pressed="false" aria-label="${escapeHtml(t('pin'))}" title="${escapeHtml(t('pin'))}">
          <svg aria-hidden="true"><use href="/public/icons.svg#icon-pin"></use></svg>
        </button>
      </div>
      <nav class="emr-sidebar-nav" id="emr-sidebar-nav" aria-label="${escapeHtml(t('mainNav'))}">
        ${navHtml(navGroups)}
      </nav>
      <div class="emr-sidebar-footer" id="emr-sidebar-footer">
        ${footerHtml(user)}
      </div>
    `;

    topbar.insertAdjacentElement('afterend', sidebar);

    for (const logo of document.querySelectorAll('.emr-topbar-logo, .emr-sidebar-logo')) {
      logo.addEventListener('error', () => { logo.hidden = true; }, { once: true });
    }

    const sidebarBackdrop = document.createElement('div');
    sidebarBackdrop.className = 'emr-sidebar-backdrop no-print';
    sidebarBackdrop.id = 'emr-sidebar-backdrop';
    sidebarBackdrop.hidden = true;
    sidebar.insertAdjacentElement('afterend', sidebarBackdrop);

    const sidebarTooltip = document.createElement('div');
    sidebarTooltip.className = 'emr-sidebar-tooltip no-print';
    sidebarTooltip.id = 'emr-sidebar-tooltip';
    sidebarTooltip.setAttribute('role', 'tooltip');
    sidebarTooltip.hidden = true;
    document.body.append(sidebarTooltip);

    // 5. Mobile Bottom Navigation (narrow screens): first two menu pages.
    const mobileNav = document.createElement('nav');
    mobileNav.className = 'emr-mobile-nav no-print';
    mobileNav.setAttribute('aria-label', 'ម៉ឺនុយទូរស័ព្ទ');
    const renderMobileNav = () => {
      const items = navGroups.flatMap(group => group.items).slice(0, 2);
      const activeId = NAV ? NAV.activeItemId(items, window.location.pathname, window.location.search) : null;
      const en = lang() === 'en';
      mobileNav.innerHTML = `
        ${items.map(item => `
          <a href="${escapeHtml(item.href)}" class="emr-mobile-nav-item ${item.id === activeId ? 'is-active' : ''}"${item.id === activeId ? ' aria-current="page"' : ''}>
            <svg aria-hidden="true"><use href="/public/icons.svg#${escapeHtml(item.icon)}"></use></svg>
            <span>${escapeHtml(en ? item.labelEn : (item.label || window.newText?.(item.newTextKey, item.labelEn) || item.labelEn))}</span>
          </a>
        `).join('')}
        <button type="button" class="emr-mobile-nav-item" id="emr-mobile-search-btn">
          <svg aria-hidden="true"><use href="/public/icons.svg#icon-search"></use></svg>
          <span>${escapeHtml(t('search'))}</span>
        </button>
        <button type="button" class="emr-mobile-nav-item" id="emr-mobile-menu-btn" aria-controls="emr-sidebar" aria-expanded="false">
          <svg aria-hidden="true"><use href="/public/icons.svg#icon-menu"></use></svg>
          <span>${escapeHtml(t('menu'))}</span>
        </button>
      `;
    };
    renderMobileNav();
    document.body.append(mobileNav);

    // 6. Global Command Palette Dialog (Ctrl+K)
    const paletteBackdrop = document.createElement('div');
    paletteBackdrop.className = 'emr-command-palette-backdrop no-print';
    paletteBackdrop.id = 'emr-command-palette-backdrop';
    paletteBackdrop.setAttribute('role', 'dialog');
    paletteBackdrop.setAttribute('aria-modal', 'true');
    paletteBackdrop.setAttribute('aria-label', 'ស្វែងរកអ្នកជំងឺទូទាំងប្រព័ន្ធ');

    paletteBackdrop.innerHTML = `
      <div class="emr-command-palette">
        <div class="emr-palette-header">
          <svg><use href="/public/icons.svg#icon-search"></use></svg>
          <input type="search" class="emr-palette-input" id="emr-palette-input" placeholder="វាយបញ្ចូលឈ្មោះ, លេខកូដ, លេខទូរស័ព្ទ ឬលេខបណ្ណអ្នកជំងឺ..." autocomplete="off">
          <button type="button" class="emr-palette-close" id="emr-palette-close" aria-label="បិទ">×</button>
        </div>
        <div class="emr-palette-results" id="emr-palette-results">
          <div class="emr-palette-empty">សូមវាយបញ្ចូលពាក្យដើម្បីស្វែងរកអ្នកជំងឺ...</div>
        </div>
        <div class="emr-palette-footer">
          <span><strong>↑↓</strong> ផ្លាស់ទី · <strong>Enter</strong> បើក · <strong>Esc</strong> បិទ</span>
          <span id="emr-palette-count">០ លទ្ធផល</span>
        </div>
      </div>
    `;
    document.body.append(paletteBackdrop);

    // 7. Keyboard Shortcuts Modal (?)
    const shortcutsBackdrop = document.createElement('div');
    shortcutsBackdrop.className = 'emr-shortcuts-backdrop no-print';
    shortcutsBackdrop.id = 'emr-shortcuts-backdrop';
    shortcutsBackdrop.setAttribute('role', 'dialog');
    shortcutsBackdrop.setAttribute('aria-modal', 'true');
    shortcutsBackdrop.setAttribute('aria-label', 'បញ្ជីផ្លូវកាត់ក្ដារចុច');

    shortcutsBackdrop.innerHTML = `
      <div class="emr-shortcuts-dialog">
        <div class="emr-shortcuts-head">
          <h3>ផ្លូវកាត់ក្ដារចុច (Keyboard Shortcuts)</h3>
          <button type="button" class="emr-palette-close" id="emr-shortcuts-close" aria-label="បិទ">×</button>
        </div>
        <div class="emr-shortcuts-grid">
          <div class="emr-shortcut-row">
            <span>ស្វែងរកអ្នកជំងឺរហ័ស (Command Palette)</span>
            <div class="emr-shortcut-keys"><kbd>Ctrl</kbd> + <kbd>K</kbd></div>
          </div>
          <div class="emr-shortcut-row">
            <span>ផ្លាស់ទីទៅកាន់ធាតុរុករកទី ១ ដល់ ៦</span>
            <div class="emr-shortcut-keys"><kbd>Alt</kbd> + <kbd>1</kbd> .. <kbd>6</kbd></div>
          </div>
          <div class="emr-shortcut-row">
            <span>បិទផ្ទាំង ឬប្រអប់សារដែលកំពុងបើក</span>
            <div class="emr-shortcut-keys"><kbd>Esc</kbd></div>
          </div>
          <div class="emr-shortcut-row">
            <span>បង្ហាញបញ្ជីផ្លូវកាត់ក្ដារចុចនេះ</span>
            <div class="emr-shortcut-keys"><kbd>?</kbd></div>
          </div>
        </div>
      </div>
    `;
    document.body.append(shortcutsBackdrop);

    // 8. Switch user type window (Superuser account only, v42.1)
    let userTypeBackdrop = null;
    if (user.isSuperuser) {
      userTypeBackdrop = document.createElement('div');
      userTypeBackdrop.className = 'emr-shortcuts-backdrop emr-user-type-backdrop no-print';
      userTypeBackdrop.id = 'emr-user-type-backdrop';
      userTypeBackdrop.setAttribute('role', 'dialog');
      userTypeBackdrop.setAttribute('aria-modal', 'true');
      userTypeBackdrop.setAttribute('aria-labelledby', 'emr-user-type-title');
      userTypeBackdrop.setAttribute('data-language-exclude', '');
      const roles = USER_TYPE_ORDER.filter(item => (user.roles || []).includes(item));
      userTypeBackdrop.innerHTML = `
        <form class="emr-shortcuts-dialog emr-user-type-dialog" id="emr-user-type-form">
          <div class="emr-shortcuts-head">
            <h3 id="emr-user-type-title">${escapeHtml(t('switchUserType'))}</h3>
            <button type="button" class="emr-palette-close" id="emr-user-type-close" aria-label="${escapeHtml(t('dismiss'))}">×</button>
          </div>
          <label for="emr-user-type-role">${escapeHtml(t('userTypeRole'))}</label>
          <select id="emr-user-type-role" required>
            ${roles.map(item => `<option value="${escapeHtml(item)}">${escapeHtml(roleLabel(item))}</option>`).join('')}
          </select>
          <label for="emr-user-type-ward" id="emr-user-type-ward-label">${escapeHtml(t('userTypeWard'))}</label>
          <select id="emr-user-type-ward"></select>
          <div class="emr-user-type-status" id="emr-user-type-status" role="alert" aria-live="polite"></div>
          <div class="emr-user-type-actions">
            <button type="submit" class="emr-user-type-submit">${escapeHtml(t('switchUserType'))}</button>
          </div>
        </form>
      `;
      document.body.append(userTypeBackdrop);
    }

    // =========================================================================
    // EVENT HANDLERS & BEHAVIORS
    // =========================================================================

    // Sidebar: collapsed icon rail that expands over the content on hover or
    // keyboard focus, a pin that keeps it open, and a drawer on touch/narrow.
    const drawerQuery = window.matchMedia('(max-width: 768px), (hover: none)');
    const pinKey = `borkeo_sidebar_pinned:${user.id || user.username || ''}`;
    const sidebarToggleBtn = document.getElementById('emr-sidebar-toggle-btn');
    const pinBtn = document.getElementById('emr-sidebar-pin-btn');
    const COLLAPSE_DELAY_MS = 200;
    let pinned = storage.get(pinKey) === '1';
    let collapseTimer = null;
    let dragging = false;
    let printing = false;

    const isDrawerMode = () => drawerQuery.matches;
    const modalOpen = () => Boolean(document.querySelector(
      'dialog[open], .emr-command-palette-backdrop.is-open, .emr-shortcuts-backdrop.is-open, [aria-modal="true"].open, [aria-modal="true"].is-open'
    ));

    const hideTooltip = () => { sidebarTooltip.hidden = true; };
    const showTooltip = (target) => {
      if (isDrawerMode() || sidebar.classList.contains('is-expanded')) return;
      const text = target.dataset.tooltip;
      if (!text) return;
      const rect = target.getBoundingClientRect();
      sidebarTooltip.textContent = text;
      sidebarTooltip.style.top = `${Math.round(rect.top + rect.height / 2)}px`;
      sidebarTooltip.style.left = `${Math.round(rect.right + 10)}px`;
      sidebarTooltip.hidden = false;
    };

    const setExpanded = (wanted) => {
      const expanded = !isDrawerMode() && (pinned || wanted);
      sidebar.classList.toggle('is-expanded', expanded);
      sidebar.dataset.state = expanded ? 'expanded' : 'collapsed';
      if (expanded) hideTooltip();
      else closeUserMenu();
    };

    const applyPinned = () => {
      document.body.classList.toggle('sidebar-pinned', pinned && !isDrawerMode());
      pinBtn.setAttribute('aria-pressed', String(pinned));
      pinBtn.setAttribute('aria-label', pinned ? t('unpin') : t('pin'));
      pinBtn.title = pinned ? t('unpin') : t('pin');
      setExpanded(false);
    };

    const scheduleCollapse = () => {
      clearTimeout(collapseTimer);
      collapseTimer = setTimeout(() => {
        // Keyboard users keep it open while focus is inside.
        if (sidebar.querySelector(':focus-visible') || sidebar.matches(':hover')) return;
        setExpanded(false);
      }, COLLAPSE_DELAY_MS);
    };

    sidebar.addEventListener('pointerenter', (e) => {
      if (isDrawerMode() || e.pointerType === 'touch') return;
      clearTimeout(collapseTimer);
      if (dragging || printing || e.buttons || modalOpen()) return;
      setExpanded(true);
    });
    sidebar.addEventListener('pointerleave', () => {
      if (!isDrawerMode()) scheduleCollapse();
    });
    sidebar.addEventListener('focusin', () => {
      if (isDrawerMode() || printing || modalOpen()) return;
      if (!sidebar.querySelector(':focus-visible')) return;
      clearTimeout(collapseTimer);
      setExpanded(true);
    });
    sidebar.addEventListener('focusout', (e) => {
      if (isDrawerMode() || sidebar.contains(e.relatedTarget)) return;
      scheduleCollapse();
    });

    sidebar.addEventListener('pointerover', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target && sidebar.contains(target)) showTooltip(target);
    });
    sidebar.addEventListener('pointerout', (e) => {
      if (e.target.closest('[data-tooltip]')) hideTooltip();
    });
    sidebar.addEventListener('focusin', (e) => {
      const target = e.target.closest('[data-tooltip]');
      if (target) showTooltip(target);
    });
    sidebar.addEventListener('focusout', hideTooltip);

    document.addEventListener('dragstart', () => { dragging = true; setExpanded(false); }, true);
    document.addEventListener('dragend', () => { dragging = false; }, true);
    document.addEventListener('drop', () => { dragging = false; }, true);
    window.addEventListener('beforeprint', () => { printing = true; setExpanded(false); closeDrawer(); });
    window.addEventListener('afterprint', () => { printing = false; });

    pinBtn.addEventListener('click', () => {
      pinned = !pinned;
      storage.set(pinKey, pinned ? '1' : '0');
      applyPinned();
      if (!pinned && sidebar.matches(':hover')) setExpanded(true);
    });

    // Drawer (phones, tablets and other touch screens)
    const setDrawerButtons = (open) => {
      for (const button of [sidebarToggleBtn, document.getElementById('emr-mobile-menu-btn')]) {
        if (!button) continue;
        button.setAttribute('aria-expanded', String(open));
        if (button === sidebarToggleBtn) button.setAttribute('aria-label', open ? t('closeMenu') : t('openMenu'));
      }
    };
    const openDrawer = () => {
      if (printing) return;
      document.body.classList.add('mobile-sidebar-open');
      sidebarBackdrop.hidden = false;
      setDrawerButtons(true);
      (sidebar.querySelector('.emr-sidebar-item.is-active') || sidebar.querySelector('.emr-sidebar-item'))?.focus({ preventScroll: true });
    };
    function closeDrawer(returnFocus = false) {
      if (!document.body.classList.contains('mobile-sidebar-open')) return;
      document.body.classList.remove('mobile-sidebar-open');
      sidebarBackdrop.hidden = true;
      setDrawerButtons(false);
      if (returnFocus) sidebarToggleBtn?.focus({ preventScroll: true });
    }
    const toggleDrawer = () => {
      if (document.body.classList.contains('mobile-sidebar-open')) closeDrawer(true);
      else openDrawer();
    };

    sidebarToggleBtn?.addEventListener('click', () => {
      if (isDrawerMode()) toggleDrawer();
      else pinBtn.click();
    });
    mobileNav.addEventListener('click', (e) => {
      if (e.target.closest('#emr-mobile-menu-btn')) toggleDrawer();
    });
    sidebarBackdrop.addEventListener('click', () => closeDrawer(true));
    drawerQuery.addEventListener('change', () => {
      closeDrawer();
      applyPinned();
    });

    // Close the drawer when a link is chosen
    sidebar.addEventListener('click', (e) => {
      if (e.target.closest('a.emr-sidebar-item')) closeDrawer();
    });

    // Phones render pages in the 1200px desktop viewport (v22.4). Scale only
    // the shell (topbar and drawer) back to finger size; content keeps
    // pinch-zoom.
    const applyPhoneScale = () => {
      const screenWidth = window.screen?.width || window.innerWidth;
      const scale = Math.min(3.2, window.innerWidth / screenWidth);
      const phone = isDrawerMode() && scale >= 1.5;
      document.body.classList.toggle('emr-phone-desktop-mode', phone);
      if (phone) document.documentElement.style.setProperty('--emr-shell-zoom', scale.toFixed(2));
      else document.documentElement.style.removeProperty('--emr-shell-zoom');
    };
    window.addEventListener('resize', applyPhoneScale);
    drawerQuery.addEventListener('change', applyPhoneScale);
    applyPhoneScale();

    applyPinned();

    // Counter Selector Sync
    const topbarCounter = document.getElementById('emr-topbar-counter-sel');
    if (topbarCounter) {
      topbarCounter.addEventListener('change', () => {
        const val = topbarCounter.value;
        window.sessionStorage.setItem('borkeo-counter-number', val);
        window.emrCounterNumber = val;
        window.dispatchEvent(new CustomEvent('emr-counter-changed', { detail: val }));
      });

      window.addEventListener('emr-counter-changed', event => {
        if (event.detail && topbarCounter.value !== String(event.detail)) {
          topbarCounter.value = String(event.detail);
        }
      });
    }

    // User menu (sidebar footer). Rendered again after a role/ward switch, so
    // all handlers are delegated from the sidebar.
    function closeUserMenu(returnFocus = false) {
      const dropdown = document.getElementById('emr-user-dropdown');
      const trigger = document.getElementById('emr-user-trigger');
      if (!dropdown?.classList.contains('is-open')) return;
      dropdown.classList.remove('is-open');
      trigger?.setAttribute('aria-expanded', 'false');
      if (returnFocus) trigger?.focus({ preventScroll: true });
    }

    function openUserMenu() {
      const dropdown = document.getElementById('emr-user-dropdown');
      const trigger = document.getElementById('emr-user-trigger');
      if (!dropdown) return;
      setExpanded(true);
      dropdown.classList.add('is-open');
      trigger?.setAttribute('aria-expanded', 'true');
      dropdown.querySelector('[role^="menuitem"]')?.focus({ preventScroll: true });
    }

    const toggleUserMenu = (open) => {
      const dropdown = document.getElementById('emr-user-dropdown');
      const isOpen = open !== undefined ? open : !dropdown?.classList.contains('is-open');
      if (isOpen) openUserMenu();
      else closeUserMenu();
    };

    const logout = async () => {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'X-CSRF-Token': session.csrfToken }
        });
      } finally {
        window.sessionStorage.removeItem('borkeo-counter-number');
        window.location.replace('/login');
      }
    };

    const changePassword = () => {
      toggleUserMenu(false);
      const existingBtn = document.querySelector('.session-password-save, .portal-account-actions button');
      if (existingBtn) {
        // Trigger existing password modal if available
        const pwBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('ប្តូរពាក្យសម្ងាត់') && !b.closest('#emr-sidebar'));
        if (pwBtn) {
          pwBtn.click();
          return;
        }
      }
      alert('សូមទំនាក់ទំនងអ្នកគ្រប់គ្រងប្រព័ន្ធដើម្បីប្តូរពាក្យសម្ងាត់');
    };

    const renderShellForUser = () => {
      navGroups = navGroupsFor(session.user, navSettings);
      document.getElementById('emr-sidebar-nav').innerHTML = navHtml(navGroups);
      document.getElementById('emr-sidebar-footer').innerHTML = footerHtml(session.user);
      const brandLink = sidebar.querySelector('.emr-sidebar-brand-link');
      if (brandLink) brandLink.href = navGroups[0]?.items[0]?.href || '/home';
      const chipText = document.querySelector('#emr-ward-chip span');
      if (chipText) chipText.textContent = wardLabel(session.user, session.user.activeWard?.code || '');
      renderMobileNav();
      // request-badges.js adds counters to /requests and /ward-medicines links.
      window.dispatchEvent(new CustomEvent('emr-requests-changed'));
    };

    let contextNotice = null;
    const showContextNotice = (text, withReload) => {
      contextNotice?.remove();
      contextNotice = document.createElement('div');
      contextNotice.className = 'emr-context-notice no-print';
      contextNotice.setAttribute('role', 'status');
      contextNotice.innerHTML = `
        <span>${escapeHtml(text)}</span>
        ${withReload ? `<button type="button" data-context-reload>${escapeHtml(t('reload'))}</button>` : ''}
        <button type="button" data-context-dismiss aria-label="${escapeHtml(t('dismiss'))}">×</button>
      `;
      contextNotice.querySelector('[data-context-reload]')?.addEventListener('click', () => window.location.reload());
      contextNotice.querySelector('[data-context-dismiss]').addEventListener('click', () => contextNotice.remove());
      document.body.append(contextNotice);
    };

    // Switch role/ward in place: the menu updates without a page reload.
    // The server then decides whether the current page is still open to the
    // new context; if not, go to the first page of the new menu.
    const switchContext = async (nextRole, nextWard) => {
      closeUserMenu();
      showContextNotice(t('switching'), false);
      try {
        const res = await fetch('/api/auth/context', {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken },
          body: JSON.stringify({ role: nextRole, wardCode: nextWard })
        });
        const result = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(result.error || t('switchFailed'));
        const me = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
        if (me.ok) {
          const data = await me.json();
          session.user = data.user;
          if (data.csrfToken) session.csrfToken = data.csrfToken;
        } else if (result.user) {
          session.user = { ...session.user, ...result.user };
        }
        window.emrSession = session;
        renderShellForUser();
        window.dispatchEvent(new CustomEvent('emr-context-changed', { detail: { user: session.user } }));

        if (window.location.pathname === '/context') {
          window.location.assign(navGroups[0]?.items[0]?.href || '/home');
          return;
        }
        const check = await fetch(window.location.pathname + window.location.search, { credentials: 'same-origin', cache: 'no-store' });
        if (!check.ok || check.redirected) {
          window.location.assign(check.ok ? check.url : (navGroups[0]?.items[0]?.href || '/context'));
          return;
        }
        const label = contextLabel(session.user, session.user.activeRole, session.user.activeWard?.code || '');
        showContextNotice(`${t('switched')} ${label}។ ${t('reloadHint')}`, true);
      } catch (error) {
        showContextNotice(error.message || t('switchFailed'), false);
      }
    };

    sidebar.addEventListener('click', (e) => {
      const target = e.target.closest('button');
      if (!target || !sidebar.contains(target)) return;
      if (target.id === 'emr-user-trigger') {
        e.stopPropagation();
        toggleUserMenu();
      } else if (target.id === 'emr-dropdown-logout' || target.id === 'emr-sidebar-logout') {
        void logout();
      } else if (target.id === 'emr-dropdown-change-pw') {
        changePassword();
      } else if (target.id === 'emr-dropdown-shortcuts-btn') {
        toggleUserMenu(false);
        openShortcuts();
      } else if (target.classList.contains('emr-context-option')) {
        if (target.getAttribute('aria-checked') === 'true') closeUserMenu(true);
        else void switchContext(target.dataset.role, target.dataset.ward || '');
      }
    });

    // Arrow keys move through the open user menu.
    sidebar.addEventListener('keydown', (e) => {
      const dropdown = document.getElementById('emr-user-dropdown');
      if (!dropdown?.classList.contains('is-open') || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
      const items = [...dropdown.querySelectorAll('[role^="menuitem"]')];
      if (!items.length) return;
      e.preventDefault();
      const index = items.indexOf(document.activeElement);
      const next = e.key === 'Home' ? 0 : e.key === 'End' ? items.length - 1
        : e.key === 'ArrowDown' ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
      items[next].focus();
    });

    document.addEventListener('click', (e) => {
      const wrap = sidebar.querySelector('.emr-user-menu-wrap');
      if (wrap && !wrap.contains(e.target)) closeUserMenu();
    });

    window.addEventListener('borkeo-language-change', () => {
      sidebar.setAttribute('aria-label', t('mainNav'));
      document.getElementById('emr-sidebar-nav')?.setAttribute('aria-label', t('mainNav'));
      renderShellForUser();
      applyPinned();
    });

    // Notification Bell Sync
    const notifBtn = document.getElementById('emr-topbar-notif-btn');
    const notifBadge = document.getElementById('emr-topbar-notif-badge');

    if (notifBtn) {
      notifBtn.addEventListener('click', () => {
        const bell = document.querySelector('.emr-notification-bell');
        if (bell) bell.click();
      });

      // Observe notification count changes
      const syncNotifCount = () => {
        const origCount = document.querySelector('[data-notification-count]');
        if (origCount && notifBadge) {
          const count = parseInt(origCount.textContent || '0', 10);
          notifBadge.textContent = String(count);
          notifBadge.hidden = count <= 0;
        }
      };

      const bell = document.querySelector('.emr-notification-bell');
      if (bell) {
        new MutationObserver(syncNotifCount).observe(bell, { childList: true, subtree: true, characterData: true });
        syncNotifCount();
      }
    }

    // Connection Sync Status
    const syncStatus = document.getElementById('emr-sync-status');
    const updateOnlineStatus = () => {
      if (!syncStatus) return;
      const isOnline = navigator.onLine;
      const dot = syncStatus.querySelector('.emr-status-dot');
      const text = syncStatus.querySelector('.emr-status-text');
      if (dot && text) {
        dot.className = `emr-status-dot ${isOnline ? 'online' : 'offline'}`;
        text.textContent = isOnline ? 'អនឡាញ' : 'ក្រៅបណ្តាញ';
      }
    };
    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // Command Palette Logic
    const openPalette = async () => {
      paletteBackdrop.classList.add('is-open');
      const input = document.getElementById('emr-palette-input');
      input.value = '';
      input.focus();
      renderPaletteResults([]);
      await fetchPatientsList();
    };

    const closePalette = () => {
      paletteBackdrop.classList.remove('is-open');
    };

    document.getElementById('emr-global-search-trigger')?.addEventListener('click', openPalette);
    mobileNav.addEventListener('click', (e) => {
      if (e.target.closest('#emr-mobile-search-btn')) openPalette();
    });
    document.getElementById('emr-palette-close')?.addEventListener('click', closePalette);

    paletteBackdrop.addEventListener('click', (e) => {
      if (e.target === paletteBackdrop) closePalette();
    });

    let selectedIndex = 0;
    let currentFiltered = [];

    function renderPaletteResults(patients) {
      currentFiltered = patients;
      selectedIndex = 0;
      const container = document.getElementById('emr-palette-results');
      const countEl = document.getElementById('emr-palette-count');

      if (!patients.length) {
        container.innerHTML = '<div class="emr-palette-empty">មិនមានអ្នកជំងឺដែលត្រូវគ្នានឹងការស្វែងរកទេ។</div>';
        if (countEl) countEl.textContent = '០ លទ្ធផល';
        return;
      }

      if (countEl) countEl.textContent = `${patients.length} លទ្ធផល`;

      container.innerHTML = patients.slice(0, 15).map((p, idx) => {
        const idText = p.healthId || p.caseNumber || p.patientKey || '';
        const dept = WARD_LABELS[p.departmentCode] || p.departmentNameKh || p.departmentCode || '';
        const statusClass = p.serviceMode === 'ipd' ? 'status-ipd' : 'status-opd';
        const statusText = p.serviceMode === 'ipd' ? 'សម្រាកពេទ្យ' : 'ពិគ្រោះក្រៅ';

        return `
          <a href="/emr?patientKey=${encodeURIComponent(p.patientKey)}" class="emr-palette-item ${idx === 0 ? 'is-selected' : ''}" data-idx="${idx}">
            <div class="emr-palette-patient-main">
              <span class="emr-palette-patient-name">${escapeHtml(p.fullName || p.name || 'គ្មានឈ្មោះ')}</span>
              <span class="emr-palette-patient-meta">
                <span>លេខ: <strong>${escapeHtml(idText)}</strong></span>
                ${p.age ? `<span>អាយុ: ${escapeHtml(p.age)}</span>` : ''}
                ${p.sex ? `<span>ភេទ: ${escapeHtml(p.sex)}</span>` : ''}
                ${dept ? `<span>ផ្នែក: ${escapeHtml(dept)}</span>` : ''}
              </span>
            </div>
            <div class="emr-palette-badges">
              <span class="emr-badge ${statusClass}">${escapeHtml(statusText)}</span>
            </div>
          </a>
        `;
      }).join('');
    }

    const paletteInput = document.getElementById('emr-palette-input');
    let searchDebounceTimer = null;

    paletteInput?.addEventListener('input', () => {
      clearTimeout(searchDebounceTimer);
      searchDebounceTimer = setTimeout(async () => {
        const q = (paletteInput.value || '').trim().toLowerCase();
        if (!q) {
          renderPaletteResults([]);
          return;
        }

        const all = await fetchPatientsList();
        const matches = all.filter(p => {
          const name = String(p.fullName || p.name || '').toLowerCase();
          const healthId = String(p.healthId || '').toLowerCase();
          const caseNo = String(p.caseNumber || '').toLowerCase();
          const phone = String(p.phone || '').toLowerCase();
          return name.includes(q) || healthId.includes(q) || caseNo.includes(q) || phone.includes(q);
        });

        renderPaletteResults(matches);
      }, 150);
    });

    paletteInput?.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const items = document.querySelectorAll('.emr-palette-item');
        if (items.length > 0) {
          items[selectedIndex]?.classList.remove('is-selected');
          selectedIndex = (selectedIndex + 1) % items.length;
          items[selectedIndex]?.classList.add('is-selected');
          items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const items = document.querySelectorAll('.emr-palette-item');
        if (items.length > 0) {
          items[selectedIndex]?.classList.remove('is-selected');
          selectedIndex = (selectedIndex - 1 + items.length) % items.length;
          items[selectedIndex]?.classList.add('is-selected');
          items[selectedIndex]?.scrollIntoView({ block: 'nearest' });
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = document.querySelector('.emr-palette-item.is-selected');
        if (selected) {
          window.location.href = selected.href;
        }
      }
    });

    // Shortcuts Modal Logic
    const openShortcuts = () => shortcutsBackdrop.classList.add('is-open');
    const closeShortcuts = () => shortcutsBackdrop.classList.remove('is-open');

    document.getElementById('emr-shortcuts-close')?.addEventListener('click', closeShortcuts);
    shortcutsBackdrop.addEventListener('click', (e) => {
      if (e.target === shortcutsBackdrop) closeShortcuts();
    });

    // Switch user type window: role first, then the ward for roles that need
    // one; the server returns the landing page of the chosen user type.
    const closeUserType = () => {
      if (!userTypeBackdrop?.classList.contains('is-open')) return;
      userTypeBackdrop.classList.remove('is-open');
      document.getElementById('emr-user-type-btn')?.focus({ preventScroll: true });
    };
    if (userTypeBackdrop) {
      const roleSelect = document.getElementById('emr-user-type-role');
      const wardSelect = document.getElementById('emr-user-type-ward');
      const wardLabelEl = document.getElementById('emr-user-type-ward-label');
      const status = document.getElementById('emr-user-type-status');
      const renderUserTypeWards = () => {
        const nextRole = roleSelect.value;
        const needed = userTypeNeedsWard(nextRole);
        wardSelect.hidden = !needed;
        wardLabelEl.hidden = !needed;
        wardSelect.required = needed;
        const available = (user.wards || []).filter(ward => userTypeWardAllowed(nextRole, ward.code));
        wardSelect.innerHTML = `<option value="">${escapeHtml(t('chooseWard'))}</option>` +
          available.map(ward => `<option value="${escapeHtml(ward.code)}">${escapeHtml(wardLabel(user, ward.code))}</option>`).join('');
        const current = session.user.activeRole === nextRole ? session.user.activeWard?.code : '';
        if (current && available.some(ward => ward.code === current)) wardSelect.value = current;
        else if (needed && available.length === 1) wardSelect.value = available[0].code;
      };
      const openUserType = () => {
        if (USER_TYPE_ORDER.includes(session.user.activeRole)) roleSelect.value = session.user.activeRole;
        renderUserTypeWards();
        status.textContent = '';
        userTypeBackdrop.classList.add('is-open');
        roleSelect.focus({ preventScroll: true });
      };
      roleSelect.addEventListener('change', renderUserTypeWards);
      document.getElementById('emr-user-type-btn')?.addEventListener('click', openUserType);
      document.getElementById('emr-user-type-close')?.addEventListener('click', closeUserType);
      userTypeBackdrop.addEventListener('click', (e) => {
        if (e.target === userTypeBackdrop) closeUserType();
      });
      document.getElementById('emr-user-type-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        status.textContent = '';
        const submit = e.currentTarget.querySelector('button[type=submit]');
        submit.disabled = true;
        try {
          const res = await fetch('/api/auth/context', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': session.csrfToken },
            body: JSON.stringify({ role: roleSelect.value, wardCode: wardSelect.hidden ? '' : wardSelect.value })
          });
          const result = await res.json().catch(() => ({}));
          if (!res.ok) throw new Error(result.error || t('switchFailed'));
          window.location.assign(result.landingPath || '/home');
        } catch (error) {
          status.textContent = error.message || t('switchFailed');
          submit.disabled = false;
        }
      });
    }

    // Global Keyboard Navigation
    document.addEventListener('keydown', (e) => {
      // Ctrl+K or Cmd+K: Open Palette
      if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (paletteBackdrop.classList.contains('is-open')) {
          closePalette();
        } else {
          openPalette();
        }
        return;
      }

      // Escape: Close any open modal
      if (e.key === 'Escape') {
        if (paletteBackdrop.classList.contains('is-open')) {
          closePalette();
          return;
        }
        if (shortcutsBackdrop.classList.contains('is-open')) {
          closeShortcuts();
          return;
        }
        if (userTypeBackdrop?.classList.contains('is-open')) {
          closeUserType();
          return;
        }
        if (document.getElementById('emr-user-dropdown')?.classList.contains('is-open')) {
          closeUserMenu(true);
          return;
        }
        closeDrawer(true);
        return;
      }

      // Alt+1 to Alt+6: Quick nav jumps
      if (e.altKey && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        const idx = parseInt(e.key, 10);
        const navItems = sidebar.querySelectorAll('.emr-sidebar-item');
        if (navItems[idx - 1]) {
          navItems[idx - 1].click();
        }
        return;
      }

      // ?: Open Shortcuts Dialog (only when not in an input/textarea)
      if (e.key === '?' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        const tag = (e.target?.tagName || '').toLowerCase();
        if (tag !== 'input' && tag !== 'textarea' && !e.target?.isContentEditable) {
          e.preventDefault();
          openShortcuts();
        }
      }
    });
  }

  // Initialize once session is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      window.addEventListener('emr-session-ready', mountAppShell, { once: true });
      // Fallback in case session was already ready
      setTimeout(() => {
        if (!document.getElementById('emr-topbar')) mountAppShell();
      }, 500);
    });
  } else {
    window.addEventListener('emr-session-ready', mountAppShell, { once: true });
    setTimeout(() => {
      if (!document.getElementById('emr-topbar')) mountAppShell();
    }, 300);
  }
})();
