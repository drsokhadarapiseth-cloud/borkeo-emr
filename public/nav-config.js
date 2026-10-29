/**
 * Borkeo EMR - central side navigation map.
 *
 * The ONE place that decides which sidebar buttons a user sees. Every rule
 * mirrors a page the server already allows (server/access.mjs roleCanPage and
 * the ward checks in server/server.mjs). Hiding a button is not security: the
 * server still rejects a direct URL for a role that cannot open the page.
 *
 * Access rules: 'ROLE' (any ward), 'ROLE@ward' (only that ward) or
 * 'ROLE@!ward' (any ward except that one).
 */
'use strict';

(function (root) {
  const MGMT = ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR'];
  const ALL_ROLES = ['ADMIN', 'VICE_DIRECTOR', 'DIRECTOR', 'REGISTRATION', 'TRIAGE', 'DOCTOR', 'NURSE', 'MIDWIFE',
    'CHIEF_WARD', 'WARD_HEAD', 'LAB', 'IMAGING', 'PHARMACY', 'ACCOUNTANT', 'CLERK'];
  const WARD_STAFF = ['DOCTOR@!opd', 'NURSE@!opd', 'MIDWIFE', 'CHIEF_WARD', 'WARD_HEAD'];

  const GROUPS = [
    { id: 'care', label: 'ការថែទាំអ្នកជំងឺ', labelEn: 'Patient care' },
    { id: 'clinical', label: 'សេវាគ្លីនិក', labelEn: 'Clinical services' },
    { id: 'pharmacy', label: 'ឱសថ និងស្តុក', labelEn: 'Pharmacy and stock' },
    { id: 'finance', label: 'ហិរញ្ញវត្ថុ', labelEn: 'Finance' },
    { id: 'admin', label: 'រដ្ឋបាល', labelEn: 'Administration' },
  ];

  const ITEMS = [
    { id: 'connected-emrs', group: 'care', href: '/connected-emrs', icon: 'icon-building', label: 'បណ្ដាញមូលដ្ឋានសុខាភិបាល', labelEn: 'Health facility network', access: ['ADMIN','DIRECTOR','VICE_DIRECTOR','DOCTOR','CHIEF_WARD','NURSE','MIDWIFE','REGISTRATION','TRIAGE'], networkOnly: true },
    // Patient care
    { id: 'home', group: 'care', href: '/home', icon: 'icon-home', label: 'ទំព័រដើម និងរបាយការណ៍', labelEn: 'Home and reports', access: [...MGMT, 'DOCTOR@!opd'] },
    { id: 'register', group: 'care', href: '/emr?view=register', icon: 'icon-user-plus', label: 'ចុះឈ្មោះអ្នកជំងឺ', labelEn: 'Register patient', access: ['REGISTRATION'] },
    { id: 'triage', group: 'care', href: '/triage', icon: 'icon-activity', label: 'បញ្ជីរង់ចាំទ្រីយ៉ា', labelEn: 'Triage queue', access: ['TRIAGE'] },
    { id: 'opd-queue', group: 'care', href: '/opd-queue', icon: 'icon-stethoscope', label: 'បញ្ជីរង់ចាំ OPD', labelEn: 'OPD queue', access: ['DOCTOR@opd'] },
    // v42.6: the midwife's outpatient queue (ANC, PNC, family planning, cervical screening, vaccination)
    // and the safe-abortion outpatients of the Gynecology ward.
    { id: 'maternal-queue', group: 'care', href: '/maternal', icon: 'icon-heart-pulse', label: 'បញ្ជីអ្នកជំងឺសេវាមាតា', labelEn: 'Maternal services queue', access: ['MIDWIFE'] },
    { id: 'gynecology-outpatients', group: 'care', href: '/maternal?kind=gynecology', icon: 'icon-heart-pulse', label: 'រំលូតកូនដោយសុវត្ថិភាព', labelEn: 'Safe abortion', access: ['DOCTOR@gynecology', 'CHIEF_WARD@gynecology'] },
    { id: 'medical-record', group: 'care', href: '/emr', icon: 'icon-clipboard', label: 'កំណត់ត្រាវេជ្ជសាស្ត្រ', labelEn: 'Medical record', access: ['DOCTOR@!opd'] },
    { id: 'departments', group: 'care', href: '/departments', icon: 'icon-bed', label: 'គ្រប់គ្រងផ្នែក និងគ្រែ', labelEn: 'Wards and beds', access: [...WARD_STAFF, ...MGMT] },
    { id: 'patient-list', group: 'care', href: '/patient-list', icon: 'icon-users', label: 'បញ្ជីអ្នកជំងឺ', labelEn: 'Patient list', access: ALL_ROLES },
    { id: 'incoming-referrals', group: 'care', href: '/referrals', icon: 'icon-inbox', label: 'អ្នកជំងឺពីមូលដ្ឋានសុខាភិបាលផ្សេង', labelEn: 'Patients from other health facilities', access: ALL_ROLES, receiverOnly: true },
    { id: 'appointments', group: 'care', href: '/patient-list?view=appointments', icon: 'icon-calendar', label: 'បញ្ជីអ្នកជំងឺណាត់ជួប', labelEn: 'Appointments', access: ['REGISTRATION'] },

    // Clinical services
    { id: 'opd-handoff', group: 'clinical', href: '/opd-paraclinic-nurse', icon: 'icon-heart-pulse', label: 'បញ្ជីបញ្ជូន Paraclinic', labelEn: 'Paraclinic handoffs', access: ['NURSE@opd'] },
    { id: 'ipd-transfer', group: 'clinical', href: '/ipd-transfer', icon: 'icon-arrow-right', label: 'ផ្ទេរ និងចេញអ្នកជំងឺ', labelEn: 'Transfer and discharge', access: ['DOCTOR@opd'] },
    { id: 'lab', group: 'clinical', href: '/lab', icon: 'icon-flask', label: 'មន្ទីរពិសោធន៍', labelEn: 'Laboratory', access: ['LAB', ...MGMT] },
    { id: 'imaging', group: 'clinical', href: '/imaging', icon: 'icon-scan', label: 'រូបភាពវេជ្ជសាស្ត្រ', labelEn: 'Medical imaging', access: ['IMAGING', ...MGMT] },
    { id: 'queue-display-triage', group: 'clinical', href: '/queue-display?service=TRIAGE', icon: 'icon-monitor', label: 'បើកផ្ទាំងលេខរៀង', labelEn: 'Open queue display', access: ['TRIAGE'] },
    { id: 'queue-display-opd', group: 'clinical', href: '/queue-display?service=OPD', icon: 'icon-monitor', label: 'បើកផ្ទាំងលេខរៀង', labelEn: 'Open queue display', access: ['DOCTOR@opd'] },

    // Pharmacy and stock
    { id: 'pharmacy-opd', group: 'pharmacy', href: '/pharmacy/opd', icon: 'icon-pill', label: 'ចែកឱសថ OPD', labelEn: 'OPD dispensing', access: ['PHARMACY', ...MGMT] },
    { id: 'ward-medicines', group: 'pharmacy', href: '/ward-medicines', icon: 'icon-file-text', label: 'បញ្ជីឱសថប្រចាំថ្ងៃ', labelEn: 'Daily ward medicines', access: [...WARD_STAFF, 'PHARMACY', ...MGMT] },
    { id: 'pharmacy-medicines', group: 'pharmacy', href: '/pharmacy/medicines', icon: 'icon-package', label: 'បញ្ជីឱសថ', labelEn: 'Medicine list', access: ['PHARMACY', ...MGMT] },
    { id: 'pharmacy-display', group: 'pharmacy', href: '/pharmacy/display', icon: 'icon-monitor', label: 'បើកផ្ទាំងលេខរៀង', labelEn: 'Open queue display', access: ['PHARMACY'] },
    { id: 'lab-materials', group: 'pharmacy', href: '/lab/materials', icon: 'icon-package', label: 'សម្ភារៈមន្ទីរពិសោធន៍', labelEn: 'Laboratory materials', access: ['LAB'] },
    { id: 'imaging-films', group: 'pharmacy', href: '/imaging/films', icon: 'icon-package', label: 'ហ្វីល និងសម្ភារៈ', labelEn: 'Films and materials', access: ['IMAGING'] },

    // Finance
    { id: 'billing', group: 'finance', href: '/billing', icon: 'icon-receipt', label: 'បេឡា និងវិក្កយបត្រ', labelEn: 'Billing', access: ['CLERK', 'ACCOUNTANT', ...MGMT] },
    { id: 'expenses', group: 'finance', href: '/expenses', icon: 'icon-wallet', label: 'កត់ត្រាចំណាយ', labelEn: 'Expenses', access: ['ACCOUNTANT', ...MGMT] },
    { id: 'finance', group: 'finance', href: '/finance', icon: 'icon-chart', label: 'លំហូរសាច់ប្រាក់', labelEn: 'Cash flow', access: MGMT },

    // Administration (requests stay management-only, v23.9 / v24.7)
    { id: 'requests', group: 'admin', href: '/requests', icon: 'icon-inbox', label: 'ការស្នើសុំ', labelEn: 'Requests', access: MGMT },
    { id: 'admin-users', group: 'admin', href: '/admin/users', icon: 'icon-lock', label: 'គ្រប់គ្រងគណនី', labelEn: 'User accounts', access: MGMT },
    { id: 'admin-organization', group: 'admin', href: '/admin/organization', icon: 'icon-building', label: 'ឈ្មោះ និងស្លាកសញ្ញា', labelEn: 'Name and logo', access: MGMT },
    { id: 'admin-health-facility', group: 'admin', href: '/admin/health-facility', icon: 'icon-hospital', label: 'ព័ត៌មានមូលដ្ឋានសុខាភិបាល', labelEn: 'Health facility', access: MGMT },
    { id: 'admin-record-log', group: 'admin', href: '/admin/record-log', icon: 'icon-eye', label: 'កំណត់ត្រាអ្នកបើកមើលឯកសារ', labelEn: 'Record view log', access: MGMT },
    { id: 'admin-drug-safety', group: 'admin', href: '/admin/drug-safety', icon: 'icon-pill', label: '', newTextKey: 'nav.drugSafety', labelEn: 'Drug safety tables', access: MGMT },
    { id: 'admin-interface', group: 'admin', href: '/admin/interface', icon: 'icon-palette', label: 'រចនាគេហទំព័រ', labelEn: 'Interface design', access: MGMT },
    { id: 'styleguide', group: 'admin', href: '/styleguide', icon: 'icon-sliders', label: 'មគ្គុទ្ទេសក៍រចនាប័ទ្ម', labelEn: 'Styleguide', access: MGMT },
  ];

  ITEMS.push({ id:'admin-emr-connections',group:'admin',href:'/admin/emr-connections',icon:'icon-lock',label:'ការតភ្ជាប់ API រវាងមូលដ្ឋានសុខាភិបាល',labelEn:'EMR API connections',access:['ADMIN'] });

  function ruleMatches(rule, role, ward) {
    const [ruleRole, wardRule] = String(rule).split('@');
    if (ruleRole !== role) return false;
    if (!wardRule) return true;
    return wardRule.startsWith('!') ? ward !== wardRule.slice(1) : ward === wardRule;
  }

  // v42.1: the Superuser account gets exactly the menu of its active user
  // type, like a real account of that type.
  function itemVisible(item, user) {
    if(item.networkOnly && user?.referralNetwork!==true)return false;
    if (item.receiverOnly && user?.referralReceiver !== true) return false;
    const role = String(user?.activeRole || '').toUpperCase();
    const ward = String(user?.activeWard?.code || '').toLowerCase();
    return Boolean(role) && item.access.some(rule => ruleMatches(rule, role, ward));
  }

  // prefs: the admin "Interface -> navigation" settings for this role
  // ({ hidden: [href], order: [href] }). They can hide or reorder, never add.
  function visibleGroups(user, prefs) {
    const hidden = new Set(prefs?.hidden || []);
    const order = prefs?.order || [];
    const rank = href => { const i = order.indexOf(href); return i < 0 ? order.length : i; };
    return GROUPS.map(group => {
      const items = ITEMS
        .filter(item => item.group === group.id && itemVisible(item, user) && !hidden.has(item.href))
        .map((item, index) => ({ item, index }))
        .sort((a, b) => (rank(a.item.href) - rank(b.item.href)) || (a.index - b.index))
        .map(entry => entry.item);
      return { ...group, items };
    }).filter(group => group.items.length > 0);
  }

  function visibleItemIds(user, prefs) {
    return visibleGroups(user, prefs).flatMap(group => group.items.map(item => item.id));
  }

  // The best matching item for a URL: same path and every query parameter the
  // item declares; the most specific match wins.
  function activeItemId(items, pathname, search) {
    const params = new URLSearchParams(search || '');
    let best = null, bestScore = -1;
    for (const item of items) {
      const url = new URL(item.href, 'http://emr.local');
      if (url.pathname !== pathname) continue;
      const wanted = [...url.searchParams.entries()];
      if (!wanted.every(([key, value]) => params.get(key) === value)) continue;
      if (wanted.length > bestScore) { best = item.id; bestScore = wanted.length; }
    }
    return best;
  }

  root.EmrNavConfig = Object.freeze({ GROUPS, ITEMS, ALL_ROLES, itemVisible, visibleGroups, visibleItemIds, activeItemId });
})(typeof window !== 'undefined' ? window : globalThis);
