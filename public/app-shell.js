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

  function getRoleNavGroups(role, wardCode) {
    const isOpdDoctor = role === 'DOCTOR' && wardCode === 'opd';

    if (role === 'REGISTRATION') {
      return [
        {
          title: 'ការងារចម្បង',
          items: [
            { href: '/emr', label: 'ចុះឈ្មោះអ្នកជំងឺ', icon: 'icon-user', shortcut: 'Alt+1' },
            { href: '/patient-list', label: 'បញ្ជីអ្នកជំងឺ', icon: 'icon-users', shortcut: 'Alt+2' },
            { href: '/patient-list?view=appointments', label: 'អ្នកជំងឺណាត់ជួប', icon: 'icon-calendar', shortcut: 'Alt+3' }
          ]
        }
      ];
    }

    if (role === 'TRIAGE') {
      return [
        {
          title: 'ការងារចម្បង',
          items: [
            { href: '/triage', label: 'បញ្ជីរង់ចាំទ្រីយ៉ា', icon: 'icon-activity', shortcut: 'Alt+1' },
            { href: '/queue-display?service=TRIAGE', label: 'បើកផ្ទាំងលេខរៀង', icon: 'icon-calendar', shortcut: 'Alt+2' },
            { href: '/patient-list', label: 'បញ្ជីអ្នកជំងឺ', icon: 'icon-users', shortcut: 'Alt+3' }
          ]
        }
      ];
    }

    if (['NURSE', 'MIDWIFE'].includes(role)) {
      return [
        {
          title: 'ការងារគិលានុបដ្ឋាក',
          items: [
            { href: '/departments', label: 'គ្រប់គ្រងផ្នែក និងគ្រែ', icon: 'icon-bed', shortcut: 'Alt+1' },
            { href: '/ward-medicines', label: 'បញ្ជីឱសថប្រចាំថ្ងៃ', icon: 'icon-pill', shortcut: 'Alt+2' },
            { href: '/patient-list', label: 'បញ្ជីអ្នកជំងឺ', icon: 'icon-users', shortcut: 'Alt+3' }
          ]
        }
      ];
    }

    if (role === 'DOCTOR') {
      if (isOpdDoctor) {
        return [
          {
            title: 'ពិគ្រោះជំងឺក្រៅ (OPD)',
            items: [
              { href: '/opd-queue', label: 'បញ្ជីរង់ចាំ OPD', icon: 'icon-stethoscope', shortcut: 'Alt+1' },
              { href: '/queue-display?service=OPD', label: 'បើកផ្ទាំងលេខរៀង', icon: 'icon-calendar', shortcut: 'Alt+2' },
              { href: '/patient-list', label: 'បញ្ជីអ្នកជំងឺ', icon: 'icon-users', shortcut: 'Alt+3' }
            ]
          },
          {
            title: 'សេវាបន្ថែម',
            items: [
              { href: '/lab', label: 'មន្ទីរពិសោធន៍', icon: 'icon-syringe' },
              { href: '/imaging', label: 'រូបភាពវេជ្ជសាស្ត្រ', icon: 'icon-hospital' }
            ]
          }
        ];
      }
      return [
        {
          title: 'ការងារព្យាបាល (IPD)',
          items: [
            { href: '/departments', label: 'គ្រប់គ្រងផ្នែក និងគ្រែ', icon: 'icon-bed', shortcut: 'Alt+1' },
            { href: '/emr', label: 'កំណត់ត្រាវេជ្ជសាស្ត្រ', icon: 'icon-clipboard', shortcut: 'Alt+2' },
            { href: '/patient-list', label: 'បញ្ជីអ្នកជំងឺ', icon: 'icon-users', shortcut: 'Alt+3' },
            { href: '/ward-medicines', label: 'បញ្ជីឱសថប្រចាំថ្ងៃ', icon: 'icon-pill', shortcut: 'Alt+4' }
          ]
        },
        {
          title: 'សេវា និងផ្ទេរ',
          items: [
            { href: '/ipd-transfer', label: 'ផ្ទេរ និងចេញអ្នកជំងឺ', icon: 'icon-arrow-right', shortcut: 'Alt+5' },
            { href: '/lab', label: 'មន្ទីរពិសោធន៍', icon: 'icon-syringe' },
            { href: '/imaging', label: 'រូបភាពវេជ្ជសាស្ត្រ', icon: 'icon-hospital' },
            { href: '/home', label: 'របាយការណ៍', icon: 'icon-chart', shortcut: 'Alt+6' }
          ]
        }
      ];
    }

    if (role === 'LAB') {
      return [
        {
          title: 'ការងារមន្ទីរពិសោធន៍',
          items: [
            { href: '/lab', label: 'បញ្ជីវិភាគ និងលទ្ធផល', icon: 'icon-syringe', shortcut: 'Alt+1' },
            { href: '/stock', label: 'សម្ភារៈ និងឧបករណ៍', icon: 'icon-clipboard', shortcut: 'Alt+2' },
            { href: '/patient-list', label: 'បញ្ជីអ្នកជំងឺ', icon: 'icon-users', shortcut: 'Alt+3' }
          ]
        }
      ];
    }

    if (role === 'IMAGING') {
      return [
        {
          title: 'ការងាររូបភាពវេជ្ជសាស្ត្រ',
          items: [
            { href: '/imaging', label: 'បញ្ជីរូបភាពវេជ្ជសាស្ត្រ', icon: 'icon-hospital', shortcut: 'Alt+1' },
            { href: '/stock', label: 'សម្ភារៈ និងហ្វីល', icon: 'icon-clipboard', shortcut: 'Alt+2' },
            { href: '/patient-list', label: 'បញ្ជីអ្នកជំងឺ', icon: 'icon-users', shortcut: 'Alt+3' }
          ]
        }
      ];
    }

    if (role === 'PHARMACY') {
      return [
        {
          title: 'ការងារឱសថស្ថាន',
          items: [
            { href: '/pharmacy/opd', label: 'ចែកឱសថ OPD', icon: 'icon-pill', shortcut: 'Alt+1' },
            { href: '/ward-medicines', label: 'បញ្ជីឱសថប្រចាំថ្ងៃ', icon: 'icon-clipboard', shortcut: 'Alt+2' },
            { href: '/pharmacy/medicines', label: 'បញ្ជីឱសថ', icon: 'icon-file-text', shortcut: 'Alt+3' },
            { href: '/stock', label: 'ឃ្លាំងឱសថ', icon: 'icon-hospital', shortcut: 'Alt+4' },
            { href: '/pharmacy/display', label: 'បើកផ្ទាំងលេខរៀង', icon: 'icon-calendar' }
          ]
        }
      ];
    }

    if (['CLERK', 'ACCOUNTANT'].includes(role)) {
      return [
        {
          title: 'ការងារហិរញ្ញវត្ថុ និងបេឡា',
          items: [
            { href: '/billing', label: 'បេឡា និងវិក្កយបត្រ', icon: 'icon-dollar', shortcut: 'Alt+1' },
            { href: '/expenses', label: 'កត់ត្រាចំណាយ', icon: 'icon-file-text', shortcut: 'Alt+2' },
            { href: '/patient-list', label: 'បញ្ជីអ្នកជំងឺ', icon: 'icon-users', shortcut: 'Alt+3' }
          ]
        }
      ];
    }

    // ADMIN, DIRECTOR, VICE_DIRECTOR
    return [
      {
        title: 'ទិដ្ឋភាពទូទៅ និងរបាយការណ៍',
        items: [
          { href: '/home', label: 'របាយការណ៍ទូទៅ', icon: 'icon-home', shortcut: 'Alt+1' },
          { href: '/finance', label: 'លំហូរសាច់ប្រាក់', icon: 'icon-chart', shortcut: 'Alt+2' },
          { href: '/patient-list', label: 'បញ្ជីអ្នកជំងឺ', icon: 'icon-users', shortcut: 'Alt+3' },
          { href: '/departments', label: 'គ្រប់គ្រងផ្នែក និងគ្រែ', icon: 'icon-bed', shortcut: 'Alt+4' }
        ]
      },
      {
        title: 'សេវា និងការពិនិត្យ',
        items: [
          { href: '/billing', label: 'បេឡា', icon: 'icon-dollar' },
          { href: '/expenses', label: 'ចំណាយ', icon: 'icon-file-text' },
          { href: '/pharmacy/opd', label: 'ឱសថស្ថាន', icon: 'icon-pill' },
          { href: '/lab', label: 'មន្ទីរពិសោធន៍', icon: 'icon-syringe' },
          { href: '/imaging', label: 'រូបភាពវេជ្ជសាស្ត្រ', icon: 'icon-hospital' },
          { href: '/requests', label: 'សំណើសុំ និងសវនកម្ម', icon: 'icon-clipboard', shortcut: 'Alt+5' }
        ]
      },
      {
        title: 'ការគ្រប់គ្រងប្រព័ន្ធ',
        items: [
          { href: '/admin/users', label: 'គ្រប់គ្រងគណនី', icon: 'icon-lock', shortcut: 'Alt+6' },
          { href: '/admin/organization', label: 'ឈ្មោះ និងស្លាកសញ្ញា', icon: 'icon-building' },
          { href: '/admin/health-facility', label: 'ព័ត៌មានមូលដ្ឋាន', icon: 'icon-hospital' },
          { href: '/admin/interface', label: 'រចនាគេហទំព័រ', icon: 'icon-palette' },
          { href: '/styleguide', label: 'Styleguide សមាសភាគ', icon: 'icon-sliders' }
        ]
      }
    ];
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

  async function mountAppShell() {
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
        return;
      }
    }

    if (!session || !session.user) return;
    const user = session.user;
    const role = user.activeRole || '';
    const wardCode = user.activeWard?.code || '';
    const wardName = user.activeWard?.name || WARD_LABELS[wardCode] || wardCode || '';
    const roleKh = ROLE_LABELS[role] || role;

    // Apply body shell class
    document.body.classList.add('has-emr-shell');
    const isCollapsed = window.localStorage.getItem('borkeo_sidebar_collapsed') === '1';
    if (isCollapsed) document.body.classList.add('sidebar-collapsed');

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
    if (breadcrumbItems.length > 1 && mainContent) {
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
      <a href="${hasContextSwitch ? '/context' : '#'}" class="emr-ward-chip" title="${hasContextSwitch ? 'ចុចដើម្បីប្តូរផ្នែក' : 'ផ្នែកបច្ចុប្បន្ន'}">
        <svg class="emr-icon"><use href="/public/icons.svg#icon-hospital"></use></svg>
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

    const userInitials = (user.displayName || user.username || 'U').trim().slice(0, 2);

    topbar.innerHTML = `
      <div class="emr-topbar-left">
        <button type="button" class="emr-sidebar-toggle-btn" id="emr-sidebar-toggle-btn" aria-label="បិទ/បើក ម៉ឺនុយរុករក">
          <svg><use href="/public/icons.svg#icon-menu"></use></svg>
        </button>
        <a href="/home" class="emr-topbar-brand">
          <img src="/public/logo-hospital.jpg" alt="Logo" class="emr-topbar-logo" onerror="this.style.display='none'">
          <div class="emr-topbar-title-wrap">
            <span class="emr-topbar-title">មន្ទីរពេទ្យបង្អែក បរកែវ</span>
            <span class="emr-topbar-subtitle">Borkeo Referral Hospital</span>
          </div>
        </a>
        ${wardChipHtml}
      </div>

      <div class="emr-topbar-center">
        <button type="button" class="emr-topbar-search-trigger" id="emr-global-search-trigger" aria-label="ស្វែងរកអ្នកជំងឺ (Ctrl+K)">
          <svg><use href="/public/icons.svg#icon-search"></use></svg>
          <span class="emr-topbar-search-text">ស្វែងរកអ្នកជំងឺ (ឈ្មោះ, លេខកូដ, ទូរស័ព្ទ)...</span>
          <kbd class="emr-search-kbd">Ctrl K</kbd>
        </button>
      </div>

      <div class="emr-topbar-right">
        ${counterHtml}
        <div class="emr-sync-status" id="emr-sync-status" title="ស្ថានភាពការតភ្ជាប់ប្រព័ន្ធ">
          <span class="emr-status-dot online"></span>
          <span class="emr-status-text">អនឡាញ</span>
        </div>

        <button type="button" class="emr-topbar-btn" id="emr-topbar-notif-btn" aria-label="សារ និងការជូនដំណឹង" title="សារ និងការជូនដំណឹង">
          <svg><use href="/public/icons.svg#icon-bell"></use></svg>
          <span class="emr-topbar-badge" id="emr-topbar-notif-badge" hidden>0</span>
        </button>

        <span class="emr-lang-pill" title="ភាសាប្រព័ន្ធ">ភាសាខ្មែរ</span>

        <div class="emr-user-menu-wrap">
          <button type="button" class="emr-user-trigger" id="emr-user-trigger" aria-haspopup="true" aria-expanded="false">
            <div class="emr-user-avatar">${escapeHtml(userInitials)}</div>
            <div class="emr-user-info">
              <span class="emr-user-name">${escapeHtml(user.displayName || user.username)}</span>
              <span class="emr-user-role-badge">${escapeHtml(roleKh)}</span>
            </div>
            <svg style="width: 14px; height: 14px; color: var(--text-muted);"><use href="/public/icons.svg#icon-chevron-down"></use></svg>
          </button>

          <div class="emr-user-dropdown" id="emr-user-dropdown" role="menu">
            <div class="emr-dropdown-header">
              <div class="emr-dropdown-user">${escapeHtml(user.displayName)}</div>
              <div class="emr-dropdown-sub">@${escapeHtml(user.username)} · ${escapeHtml(roleKh)}</div>
            </div>
            ${hasContextSwitch ? `
              <a href="/context" class="emr-dropdown-item" role="menuitem">
                <svg><use href="/public/icons.svg#icon-refresh"></use></svg>
                <span>ប្តូរតួនាទី / ផ្នែក</span>
              </a>
            ` : ''}
            <button type="button" class="emr-dropdown-item" id="emr-dropdown-change-pw" role="menuitem">
              <svg><use href="/public/icons.svg#icon-lock"></use></svg>
              <span>ប្តូរពាក្យសម្ងាត់</span>
            </button>
            <button type="button" class="emr-dropdown-item" id="emr-dropdown-shortcuts-btn" role="menuitem">
              <svg><use href="/public/icons.svg#icon-help-circle"></use></svg>
              <span>ផ្លូវកាត់ក្ដារចុច (?)</span>
            </button>
            <div class="emr-dropdown-divider"></div>
            <button type="button" class="emr-dropdown-item danger" id="emr-dropdown-logout" role="menuitem">
              <svg><use href="/public/icons.svg#icon-x-circle"></use></svg>
              <span>ចាកចេញពីប្រព័ន្ធ</span>
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.prepend(topbar);

    // 4. Left Sidebar Navigation
    const navGroups = getRoleNavGroups(role, wardCode);
    const sidebar = document.createElement('aside');
    sidebar.className = 'emr-sidebar no-print';
    sidebar.id = 'emr-sidebar';
    sidebar.setAttribute('aria-label', 'ការរុករកចម្បង');

    const currentPath = window.location.pathname;
    const currentQuery = window.location.search;

    const navHtml = navGroups.map(group => `
      <div class="emr-sidebar-section">
        <div class="emr-sidebar-section-title">${escapeHtml(group.title)}</div>
        ${group.items.map(item => {
          let isActive = false;
          if (item.href.includes('?')) {
            isActive = (currentPath + currentQuery) === item.href;
          } else {
            isActive = currentPath === item.href && !currentQuery.includes('view=');
          }
          return `
            <a href="${escapeHtml(item.href)}" class="emr-sidebar-item ${isActive ? 'is-active' : ''}" data-tooltip="${escapeHtml(item.label)}" ${isActive ? 'aria-current="page"' : ''}>
              <svg class="emr-sidebar-icon"><use href="/public/icons.svg#${item.icon}"></use></svg>
              <span class="emr-sidebar-label">${escapeHtml(item.label)}</span>
              ${item.shortcut ? `<span class="emr-sidebar-shortcut">${item.shortcut}</span>` : ''}
            </a>
          `;
        }).join('')}
      </div>
    `).join('');

    sidebar.innerHTML = `
      <nav class="emr-sidebar-nav">
        ${navHtml}
      </nav>
      <div class="emr-sidebar-footer">
        <button type="button" class="emr-sidebar-collapse-btn" id="emr-sidebar-collapse-btn" title="បង្រួម / ពង្រីក ម៉ឺនុយ">
          <svg><use href="/public/icons.svg#icon-panel-left"></use></svg>
          <span>បង្រួមរបាររុករក</span>
        </button>
        <div class="emr-sidebar-version">Borkeo EMR v39.2.0</div>
      </div>
    `;

    topbar.insertAdjacentElement('afterend', sidebar);

    // 5. Mobile Bottom Navigation Bar
    const mobileNav = document.createElement('nav');
    mobileNav.className = 'emr-mobile-nav no-print';
    mobileNav.setAttribute('aria-label', 'ម៉ឺនុយចល័ត');
    mobileNav.innerHTML = `
      <a href="/home" class="emr-mobile-nav-item ${currentPath === '/home' ? 'is-active' : ''}">
        <svg><use href="/public/icons.svg#icon-home"></use></svg>
        <span>ទំព័រដើម</span>
      </a>
      <a href="/patient-list" class="emr-mobile-nav-item ${currentPath === '/patient-list' ? 'is-active' : ''}">
        <svg><use href="/public/icons.svg#icon-users"></use></svg>
        <span>អ្នកជំងឺ</span>
      </a>
      <a href="${role === 'DOCTOR' ? (wardCode === 'opd' ? '/opd-queue' : '/departments') : (['NURSE','MIDWIFE'].includes(role) ? '/departments' : '/home')}" class="emr-mobile-nav-item">
        <svg><use href="/public/icons.svg#icon-stethoscope"></use></svg>
        <span>ព្យាបាល</span>
      </a>
      <button type="button" class="emr-mobile-nav-item" id="emr-mobile-search-btn">
        <svg><use href="/public/icons.svg#icon-search"></use></svg>
        <span>ស្វែងរក</span>
      </button>
      <button type="button" class="emr-mobile-nav-item" id="emr-mobile-menu-btn">
        <svg><use href="/public/icons.svg#icon-menu"></use></svg>
        <span>ម៉ឺនុយ</span>
      </button>
    `;
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

    // =========================================================================
    // EVENT HANDLERS & BEHAVIORS
    // =========================================================================

    // Sidebar Collapse
    const toggleCollapse = () => {
      document.body.classList.toggle('sidebar-collapsed');
      const isNowCollapsed = document.body.classList.contains('sidebar-collapsed');
      window.localStorage.setItem('borkeo_sidebar_collapsed', isNowCollapsed ? '1' : '0');
    };

    document.getElementById('emr-sidebar-collapse-btn')?.addEventListener('click', toggleCollapse);
    document.getElementById('emr-sidebar-toggle-btn')?.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        document.body.classList.toggle('mobile-sidebar-open');
      } else {
        toggleCollapse();
      }
    });

    document.getElementById('emr-mobile-menu-btn')?.addEventListener('click', () => {
      document.body.classList.toggle('mobile-sidebar-open');
    });

    // Close mobile sidebar when clicking on a link
    sidebar.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => {
        document.body.classList.remove('mobile-sidebar-open');
      });
    });

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

    // User Dropdown
    const userTrigger = document.getElementById('emr-user-trigger');
    const userDropdown = document.getElementById('emr-user-dropdown');

    const toggleUserMenu = (open) => {
      const isOpen = open !== undefined ? open : !userDropdown.classList.contains('is-open');
      userDropdown.classList.toggle('is-open', isOpen);
      userTrigger.setAttribute('aria-expanded', String(isOpen));
    };

    userTrigger?.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleUserMenu();
    });

    document.addEventListener('click', (e) => {
      if (!userDropdown.contains(e.target) && !userTrigger.contains(e.target)) {
        toggleUserMenu(false);
      }
    });

    // Logout Action
    document.getElementById('emr-dropdown-logout')?.addEventListener('click', async () => {
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
    });

    // Change Password Action
    document.getElementById('emr-dropdown-change-pw')?.addEventListener('click', () => {
      toggleUserMenu(false);
      const existingBtn = document.querySelector('.session-password-save, .portal-account-actions button');
      if (existingBtn) {
        // Trigger existing password modal if available
        const pwBtn = [...document.querySelectorAll('button')].find(b => b.textContent.includes('ប្តូរពាក្យសម្ងាត់'));
        if (pwBtn && pwBtn !== document.getElementById('emr-dropdown-change-pw')) {
          pwBtn.click();
          return;
        }
      }
      alert('សូមទំនាក់ទំនងអ្នកគ្រប់គ្រងប្រព័ន្ធដើម្បីប្តូរពាក្យសម្ងាត់');
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
    document.getElementById('emr-mobile-search-btn')?.addEventListener('click', openPalette);
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

    document.getElementById('emr-dropdown-shortcuts-btn')?.addEventListener('click', () => {
      toggleUserMenu(false);
      openShortcuts();
    });
    document.getElementById('emr-shortcuts-close')?.addEventListener('click', closeShortcuts);
    shortcutsBackdrop.addEventListener('click', (e) => {
      if (e.target === shortcutsBackdrop) closeShortcuts();
    });

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
        toggleUserMenu(false);
        document.body.classList.remove('mobile-sidebar-open');
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
