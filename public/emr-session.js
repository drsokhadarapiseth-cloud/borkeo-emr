'use strict';
// Legacy automated-test marker: Switch Role/Ward

(async function establishSessionControl() {
  const escapeHtml = window.escapeHtml || function (v) {
    return String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  };
  if (!window.escapeHtml) window.escapeHtml = escapeHtml;
  if (!document.querySelector('script[data-organization-branding]')) {
    const brandingScript=document.createElement('script');
    brandingScript.src='/public/organization-branding.js?v=1560';
    brandingScript.dataset.organizationBranding='1';
    document.head.append(brandingScript);
  }
  let csrfToken = '';
  let current = null;

  async function loadSession() {
    const response = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    if (response.status === 401) { window.location.replace('/login'); return null; }
    if (!response.ok) throw new Error('មិនអាចផ្ទៀងផ្ទាត់សម័យចូលប្រើបានទេ។');
    const data = await response.json();
    if (data.user?.needsContext && window.location.pathname !== '/context') {
      window.location.replace('/context');
      return null;
    }
    return data;
  }

  function findBanner() {
    return document.querySelector('[data-session-host], .home-hero, .clinical-appbar, .patient-page-banner, .department-page-banner, .admin-banner, .lab-banner, .imaging-banner, .billing-banner, .finance-banner');
  }

  function roleLabel(role) {
    return ({ ADMIN:'អ្នកគ្រប់គ្រងប្រព័ន្ធ', REGISTRATION:'ចុះឈ្មោះ', TRIAGE:'ផ្នែកទ្រីយ៉ា', DOCTOR:'វេជ្ជបណ្ឌិត', NURSE:'គិលានុបដ្ឋាក', MIDWIFE:'ឆ្មប', LAB:'មន្ទីរពិសោធន៍', IMAGING:'រូបភាពវេជ្ជសាស្ត្រ', PHARMACY:'ឱសថស្ថាន', ACCOUNTANT:'គណនេយ្យករ', CLERK:'បេឡា', VICE_DIRECTOR:'អនុប្រធានមន្ទីរពេទ្យ', DIRECTOR:'នាយកមន្ទីរពេទ្យ', CHIEF_WARD:'ប្រធានផ្នែក',WARD_HEAD:'នាយសាល' })[role] || role || '';
  }

  function allowedLinks(user) {
    const role = user.activeRole;
    if (role === 'REGISTRATION') return [['/emr', 'ចុះឈ្មោះ'], ['/patient-list', 'បញ្ជីអ្នកជំងឺ'], ['/patient-list?view=appointments', 'បញ្ជីអ្នកជំងឺណាត់ជួប']];
    // role === 'TRIAGE') return [['/requests' (v128 compatibility)
    if (role === 'TRIAGE') return [['/triage', 'បញ្ជីរង់ចាំទ្រីយ៉ា'], ['/queue-display?service=TRIAGE','បើកផ្ទាំងលេខរៀង'], ['/patient-list', 'បញ្ជីអ្នកជំងឺ']];
    // Ward nursing work starts from the department map: choose the waiting
    // admission, assign a bed, then open its Nursing Process from that bed.
    if (['NURSE','MIDWIFE'].includes(role)) return [
      ['/departments','គ្រប់គ្រងផ្នែក និងគ្រែ'], ['/ward-medicines','បញ្ជីឱសថប្រចាំថ្ងៃ'], ['/patient-list','បញ្ជីអ្នកជំងឺ'],
    ];
    const links = [];
    if(['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role))links.push(['/requests','ការស្នើរសុំ']);
    if (!['LAB','IMAGING','CLERK','ACCOUNTANT'].includes(role)) links.push(['/home', 'ទំព័រដើម']);
    const opdDoctor = role === 'DOCTOR' && user.activeWard?.code === 'opd';
    if (!opdDoctor && ['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR','NURSE','MIDWIFE'].includes(role)) links.push(['/emr','កំណត់ត្រាវេជ្ជសាស្ត្រ']);
    links.push(['/patient-list','បញ្ជីអ្នកជំងឺ']);
    if (!opdDoctor && ['ADMIN','VICE_DIRECTOR','DIRECTOR','DOCTOR','NURSE','MIDWIFE','WARD_HEAD','CHIEF_WARD'].includes(role)) links.push(['/departments','គ្រប់គ្រងផ្នែក និងគ្រែ']);
    if (!opdDoctor && ['ADMIN','VICE_DIRECTOR','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','PHARMACY','DIRECTOR'].includes(role)) links.push(['/ward-medicines','បញ្ជីឱសថប្រចាំថ្ងៃ']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role) || (role === 'DOCTOR' && user.activeWard?.code === 'opd')) links.push(['/opd-queue','បញ្ជីរង់ចាំ OPD']);
    if (role === 'DOCTOR' && user.activeWard?.code === 'opd') links.push(['/queue-display?service=OPD','បើកផ្ទាំងលេខរៀង']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY'].includes(role)) {links.push(['/pharmacy/opd','ចែកឱសថ']);links.push(['/pharmacy/medicines','បញ្ជីឱសថ']);}
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR','PHARMACY'].includes(role)) links.push(['/pharmacy/display','បើកផ្ទាំងលេខរៀង']);
    if (['LAB','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) links.push(['/lab','មន្ទីរពិសោធន៍']);
    if (['IMAGING','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) links.push(['/imaging','រូបភាពវេជ្ជសាស្ត្រ']);
    if (['ADMIN','DIRECTOR','VICE_DIRECTOR','ACCOUNTANT','CLERK'].includes(role)) links.push(['/billing','បេឡា']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR','ACCOUNTANT'].includes(role)) links.push(['/expenses','ចំណាយ']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) links.push(['/finance','លំហូរសាច់ប្រាក់']);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(role)) links.push(['/admin/users','គ្រប់គ្រងគណនី']);
    if (['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role)) links.push(['/admin/organization','ឈ្មោះ និងស្លាកសញ្ញា']);
    if (['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role)) links.push(['/admin/health-facility','ព័ត៌មានមូលដ្ឋានសុខាភិបាល']);
    if(['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(role))return links.filter(([href])=>href!=='/emr' && href!=='/pharmacy/display' && !href.startsWith('/queue-display'));
    return links;
  }

  function createPasswordDialog(user) {
    const overlay = document.createElement('div');
    overlay.className = 'session-password-overlay';
    overlay.hidden = true;
    overlay.innerHTML = `
      <form class="session-password-dialog">
        <header><strong>ប្តូរពាក្យសម្ងាត់</strong><button type="button" data-close>×</button></header>
        <p>${escapeHtml(user.displayName)} · @${escapeHtml(user.username)}</p>
        <label>ពាក្យសម្ងាត់បច្ចុប្បន្ន<input type="password" name="current" autocomplete="current-password" required minlength="4" maxlength="128"></label>
        <label>ពាក្យសម្ងាត់ថ្មី<input type="password" name="next" autocomplete="new-password" required minlength="4" maxlength="128"></label>
        <label>បញ្ជាក់ពាក្យសម្ងាត់ថ្មី<input type="password" name="confirm" autocomplete="new-password" required minlength="4" maxlength="128"></label>
        <div class="session-password-status" role="alert"></div>
        <button class="session-password-save" type="submit">ប្តូរពាក្យសម្ងាត់</button>
      </form>`;
    document.body.append(overlay);
    const form = overlay.querySelector('form');
    const status = overlay.querySelector('.session-password-status');
    const close = () => { overlay.hidden = true; form.reset(); status.textContent=''; };
    overlay.querySelector('[data-close]').addEventListener('click', close);
    overlay.addEventListener('click', event => { if (event.target === overlay) close(); });
    form.addEventListener('submit', async event => {
      event.preventDefault(); status.textContent='';
      const next = form.elements.next.value;
      if (next !== form.elements.confirm.value) { status.textContent='ពាក្យសម្ងាត់ថ្មីទាំងពីរមិនដូចគ្នាទេ។'; return; }
      const button = form.querySelector('[type=submit]'); button.disabled=true;
      try {
        const response = await fetch('/api/auth/change-password', {
          method:'POST', credentials:'same-origin', headers:{'Content-Type':'application/json','X-CSRF-Token':csrfToken},
          body:JSON.stringify({currentPassword:form.elements.current.value,newPassword:next,confirmation:form.elements.confirm.value}),
        });
        const result = await response.json().catch(()=>({}));
        if (!response.ok) throw new Error(result.error || 'មិនអាចប្តូរពាក្យសម្ងាត់បានទេ។');
        alert('បានប្តូរពាក្យសម្ងាត់រួចរាល់។ សូមចូលប្រើម្តងទៀត។');
        window.location.replace('/login');
      } catch (error) { status.textContent=error.message; button.disabled=false; }
    });
    return { open(){overlay.hidden=false;form.elements.current.focus();} };
  }

  // One account bell combines department messages and Cashier/approval notices.
  function createNotificationBell(actions) {
    const counts=new Map(),refreshers=new Map();
    const button=document.createElement('button');button.type='button';button.className='portal-account-button emr-notification-bell';button.dataset.languageExclude='';
    button.setAttribute('aria-haspopup','dialog');button.setAttribute('aria-controls','emr-notification-dialog');button.setAttribute('aria-expanded','false');
    button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Z"/><path d="M10 21h4M12 2V1"/></svg><strong data-notification-count hidden>0</strong>';
    actions.append(button);
    const panel=document.createElement('dialog');panel.id='emr-notification-dialog';panel.className='emr-notification-dialog';panel.setAttribute('aria-labelledby','emr-notification-title');
    panel.innerHTML='<header class="emr-notification-heading"><h2 id="emr-notification-title" data-language-exclude></h2><button type="button" data-notification-close data-language-exclude>×</button></header><div data-notification-panels></div>';
    document.body.append(panel);
    const updateLabels=()=>{
      const english=window.getBorkeoLanguage?.()==='en';
      const label=english?'Messages and notifications':'សារ និងការជូនដំណឹង';
      const total=[...counts.values()].reduce((sum,n)=>sum+n,0),badge=button.querySelector('[data-notification-count]');
      badge.textContent=String(total);badge.hidden=total===0;button.classList.toggle('has-notifications',total>0);
      button.title=label;button.setAttribute('aria-label',`${label}: ${total}`);
      panel.querySelector('h2').textContent=label;panel.querySelector('[data-notification-close]').setAttribute('aria-label',english?'Close':'បិទ');
    };
    const close=()=>panel.close();panel.querySelector('[data-notification-close]').onclick=close;
    panel.addEventListener('close',()=>button.setAttribute('aria-expanded','false'));
    panel.addEventListener('click',event=>{if(event.target!==panel)return;const r=panel.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();});
    button.onclick=()=>{if(!panel.open)panel.showModal();button.setAttribute('aria-expanded','true');for(const refresh of refreshers.values())void refresh();};
    window.emrNotifications={
      register(id,content,refresh){const prior=panel.querySelector(`[data-notification-source="${id}"]`);if(prior&&prior!==content)prior.remove();content.dataset.notificationSource=id;panel.querySelector('[data-notification-panels]').append(content);refreshers.set(id,refresh);if(!counts.has(id))counts.set(id,0);updateLabels();},
      setCount(id,count){counts.set(id,Math.max(0,Math.trunc(Number(count)||0)));updateLabels();},
      close,button,panel
    };
    updateLabels();window.addEventListener('borkeo-language-change',updateLabels);
  }

  function counterRole(user) {
    return ['REGISTRATION','TRIAGE'].includes(user.activeRole) || (user.activeRole === 'DOCTOR' && user.activeWard?.code === 'opd');
  }

  function setCounter(value) {
    if (!/^[1-5]$/.test(String(value))) return;
    window.sessionStorage.setItem('borkeo-counter-number', value);
    window.emrCounterNumber = String(value);
    window.dispatchEvent(new CustomEvent('emr-counter-changed', {detail:String(value)}));
  }

  function createCounterControl(user) {
    if (!counterRole(user)) return null;
    const saved = window.sessionStorage.getItem('borkeo-counter-number');
    const value = /^[1-5]$/.test(saved || '') ? saved : '1';
    window.sessionStorage.setItem('borkeo-counter-number', value);
    window.emrCounterNumber = value;
    const label = document.createElement('label');
    label.className = 'portal-counter-control';
    label.innerHTML = '<span>ជ្រើសរើសបញ្ជរ</span><select id="session-counter" aria-label="ជ្រើសរើស Counter របស់អ្នក">'+[1,2,3,4,5].map(n=>`<option value="${n}">${n}</option>`).join('')+'</select>';
    const select = label.querySelector('select');
    // v40.8: the counter is a screen setting, not patient data. Its arrival time
    // varies, so it must never take part in the record's field numbering.
    select.setAttribute('data-emr-transient', '');
    const updateLanguage=()=>{
      const english=window.getBorkeoLanguage?.()==='en';
      label.querySelector('span').textContent=english?'Choose Counter':'ជ្រើសរើសបញ្ជរ';
      select.setAttribute('aria-label',english?'Choose Your Counter':'ជ្រើសរើស Counter របស់អ្នក');
    };
    updateLanguage();
    window.addEventListener('borkeo-language-change',updateLanguage);
    select.value = value;
    select.addEventListener('change',()=>setCounter(select.value));
    window.addEventListener('emr-counter-changed', event=>{
      if (/^[1-5]$/.test(String(event.detail))) {
        window.sessionStorage.setItem('borkeo-counter-number',String(event.detail));
        select.value = String(event.detail);
        window.emrCounterNumber = select.value;
      }
    });
    return label;
  }

  try {
    const session = await loadSession(); if (!session) return;
    current = session; csrfToken = session.csrfToken;
    if (session.user.activeRole==='DIRECTOR') document.body.classList.add('emr-director-view');
    window.emrSession = { user: session.user, csrfToken };
    const invoiceStyle=document.createElement('link');invoiceStyle.rel='stylesheet';invoiceStyle.href='/public/staff-invoices.css?v=1840';document.head.append(invoiceStyle);
    const invoiceScript=document.createElement('script');invoiceScript.src='/public/staff-invoices.js?v=1880';invoiceScript.defer=true;document.head.append(invoiceScript);
    if (['ADMIN','VICE_DIRECTOR','DIRECTOR','REGISTRATION','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','CLERK','ACCOUNTANT','LAB','IMAGING','PHARMACY'].includes(session.user.activeRole)) {
      if (!document.querySelector('script[data-emr-messages-script]')) {
        const link = document.createElement('link'); link.rel='stylesheet'; link.href='/public/messages.css?v=1850'; link.dataset.emrMessages='1'; document.head.append(link);
        const script = document.createElement('script'); script.src='/public/messages.js?v=1970'; script.defer=true; script.dataset.emrMessagesScript='1'; document.head.append(script);
      }
    }

    if(['CLERK','ACCOUNTANT','ADMIN','VICE_DIRECTOR','DIRECTOR'].includes(session.user.activeRole)){
      const link=document.createElement('link');link.rel='stylesheet';link.href='/public/cashier-notifications.css?v=1850';document.head.append(link);
      const script=document.createElement('script');script.src='/public/cashier-notifications.js?v=1850';script.defer=true;document.head.append(script);
    }

    const policyStyle=document.createElement('link');policyStyle.rel='stylesheet';policyStyle.href='/public/payment-policy.css?v=1880';document.head.append(policyStyle);
    if(['CLERK','ACCOUNTANT'].includes(session.user.activeRole)){const script=document.createElement('script');script.src='/public/payment-approvals.js?v=1880';script.defer=true;document.head.append(script);}
    const control = document.createElement('div');
    control.id = 'emr-session-control';
    control.setAttribute('aria-label', 'ការរុករក និងគណនីអ្នកប្រើប្រាស់');
    const nav = document.createElement('nav');
    nav.setAttribute('aria-label', 'ការរុករកមេ');
    const clinicalView = window.location.pathname === '/emr' ? new URLSearchParams(window.location.search).get('view') : '';
    const currentUrl = window.location.pathname + window.location.search;
    const isManagement = ['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(session.user.activeRole);
    const menuGroups=[
      ...(isManagement ? [{label:'ទំព័រដើម',items:[['/home','របាយការណ៍'],['/finance','លំហូរសាច់ប្រាក់']]}] : []),
      {label:'ផ្នែកឱសថ',items:[['/ward-medicines','បញ្ជីឱសថប្រចាំថ្ងៃ'],['/pharmacy/opd','ចែកឱសថ'],['/pharmacy/medicines','បញ្ជីឱសថ']]},
      {label:'បេឡា',items:[['/billing','បេឡា'],['/expenses','ចំណាយ']]},
      {label:'គ្រប់គ្រងគណនី',items:[['/admin/health-facility','ព័ត៌មានមូលដ្ឋានសុខាភិបាល'],['/admin/users','គ្រប់គ្រងគណនី'],['/admin/organization','ឈ្មោះ និងស្លាកសញ្ញា'],['/admin/interface','រចនាគេហទំព័រ']]}
    ];
    let allowed=allowedLinks(session.user);
    if(['ADMIN','DIRECTOR','VICE_DIRECTOR'].includes(session.user.activeRole))allowed.push(['/admin/interface','រចនាគេហទំព័រ']);
    try{const response=await fetch('/api/navigation-settings',{cache:'no-store'});if(response.ok){const prefs=(await response.json()).settings?.[session.user.activeRole];if(prefs){allowed=allowed.filter(([href])=>href==='/admin/interface'||!prefs.hidden.includes(href));allowed.sort((a,b)=>{const rank=href=>{const i=prefs.order.indexOf(href);return i<0?prefs.order.length:i};return rank(a[0])-rank(b[0])});}}}catch{}
    const grouped=new Set(),menu=[];
    for(const entry of allowed){
      const group=menuGroups.find(g=>g.items.some(([href])=>href===entry[0]));
      if(!group){menu.push(entry);continue;}
      if(grouped.has(group.label))continue;grouped.add(group.label);
      const items=allowed.filter(([href])=>group.items.some(([url])=>url===href));
      menu.push([items[0][0],group.label]);
    }
    const activeGroup=menuGroups.find(g=>g.items.some(([href])=>href===window.location.pathname));
    const subnav=document.createElement('nav');subnav.id='emr-sub-nav';subnav.className='portal-main-nav emr-sub-nav no-print';subnav.setAttribute('aria-label','ផ្ទាំងរង');
    if(activeGroup)for(const [href,label] of allowed.filter(([href])=>activeGroup.items.some(([url])=>url===href))){const link=document.createElement('a');link.href=href;link.textContent=label;if(href===window.location.pathname){link.classList.add('active');link.setAttribute('aria-current','page');}subnav.append(link);}
    menu.forEach(([href,label]) => {
      const link=document.createElement('a');link.href=href;link.textContent=label;
      let isActive = Boolean(activeGroup && activeGroup.label===label);
      if (href.includes('?')) {
        isActive = isActive || currentUrl === href;
      } else {
        isActive = isActive || (href === '/lab' && (window.location.pathname === '/lab' || window.location.pathname === '/lab/materials')) || (window.location.pathname === href && !window.location.search.includes('view=') && !(href==='/emr'&&clinicalView));
      }
      if (isActive) {link.classList.add('active');link.setAttribute('aria-current','page');}
      nav.append(link);
    });

    const identity=document.createElement('div');identity.className='portal-identity';
    const copy=document.createElement('div');copy.className='portal-identity-copy';
    const name=document.createElement('strong');name.className='portal-user-name';name.textContent=session.user.displayName;
    copy.append(name);
    const actions=document.createElement('div');actions.className='portal-account-actions';
    new MutationObserver(()=>{actions.querySelectorAll('.emr-language-switch,[data-emr-language]').forEach(el=>el.remove());}).observe(actions,{childList:true,subtree:true});
    const counterControl=createCounterControl(session.user);
    if(counterControl)nav.append(counterControl);
    if ((session.user.contexts||[]).length>1) {
      const switcher=document.createElement('a');switcher.href='/context';switcher.className='portal-account-button';switcher.textContent='ប្តូរតួនាទី/ផ្នែក';actions.append(switcher);
    }
    if (!session.demoMode) {
      const passwordDialog=createPasswordDialog(session.user);
      const change=document.createElement('button');change.type='button';change.className='portal-account-button';change.textContent='ប្តូរពាក្យសម្ងាត់';change.addEventListener('click',()=>passwordDialog.open());actions.append(change);
    }
    const logout=document.createElement('button');logout.className='portal-logout';logout.type='button';logout.textContent='ចាកចេញ';logout.addEventListener('click',async()=>{logout.disabled=true;window.sessionStorage.removeItem('borkeo-counter-number');try{await fetch('/api/auth/logout',{method:'POST',credentials:'same-origin',headers:{'X-CSRF-Token':csrfToken}})}finally{location.replace('/login')}});actions.append(logout);
    createNotificationBell(actions);
    identity.append(copy,actions);control.append(identity);
    nav.id='emr-main-nav';nav.className='portal-main-nav';
    let banner=findBanner();
    if(!banner){banner=document.createElement('header');banner.className='session-host';document.body.prepend(banner);}
    if(banner){
      // Use only the shared banner classes: page-specific classes and inline
      // sizing must never change its appearance when users switch tabs.
      banner.className='session-host emr-unified-banner no-print';
      banner.id='emr-site-banner';
      banner.removeAttribute('style');
      banner.setAttribute('data-session-host','');
      for(const child of [...banner.children]) {
        if(child.querySelector('button,select,input,a') || child.matches('button,a'))nav.append(child);
        else child.classList.add('emr-legacy-banner-copy');
      }
      banner.querySelectorAll('h1,.clinical-brand,.cashier-brand,.topbar-title,.banner-copy').forEach(node=>node.classList.add('emr-legacy-banner-copy'));
      const brand=document.createElement('div');brand.className='emr-unified-brand no-print';brand.dataset.languageExclude='';
      brand.innerHTML='<span class="emr-brand-mark"><img src="/api/organization/logo" alt="Hospital logo"></span><div class="emr-brand-copy"><p class="emr-brand-eyebrow">ប្រព័ន្ធកំណត់ត្រាវេជ្ជសាស្ត្រអេឡិចត្រូនិក</p><h1>មន្ទីរពេទ្យបង្អែក បរកែវ</h1></div>';
      banner.prepend(brand);banner.append(control);banner.insertAdjacentElement('afterend',nav);if(subnav.children.length)nav.insertAdjacentElement('afterend',subnav);
    }else{
      control.classList.add('session-control-fallback');document.body.prepend(control);control.insertAdjacentElement('afterend',nav);
    }
    window.dispatchEvent(new CustomEvent('emr-session-ready',{detail:window.emrSession}));
  } catch (error) { console.error(error); }

  window.addEventListener('focus',()=>{loadSession().then(session=>{if(!session)return;current=session;csrfToken=session.csrfToken;window.emrSession={user:session.user,csrfToken}}).catch(()=>{})});

  const KHMER_DIGITS_MAP = {
    '០': '0', '១': '1', '២': '2', '៣': '3', '៤': '4',
    '៥': '5', '៦': '6', '៧': '7', '៨': '8', '៩': '9'
  };
  const KHMER_DIGITS_REGEX = /[០-៩]/g;

  function convertKhmerDigits(text) {
    if (!text || typeof text !== 'string') return text;
    return text.replace(KHMER_DIGITS_REGEX, ch => KHMER_DIGITS_MAP[ch] || ch);
  }

  window.convertKhmerDigits = convertKhmerDigits;

  document.addEventListener('beforeinput', event => {
    const target = event.target;
    if (!target || !target.matches || !target.matches('input, textarea')) return;
    if (target.dataset && target.dataset.preserveKhmerNumbers !== undefined) return;
    if (target.readOnly || target.disabled) return;

    if (event.data && KHMER_DIGITS_REGEX.test(event.data)) {
      const converted = convertKhmerDigits(event.data);
      if (document.queryCommandSupported && document.queryCommandSupported('insertText')) {
        event.preventDefault();
        document.execCommand('insertText', false, converted);
      }
    }
  });

  document.addEventListener('input', event => {
    const target = event.target;
    if (!target || !target.matches || !target.matches('input, textarea')) return;
    if (target.dataset && target.dataset.preserveKhmerNumbers !== undefined) return;
    if (target.readOnly || target.disabled) return;
    if (target.type === 'file' || target.type === 'checkbox' || target.type === 'radio' || target.type === 'button' || target.type === 'submit') return;

    const val = target.value;
    if (typeof val === 'string' && KHMER_DIGITS_REGEX.test(val)) {
      const start = target.selectionStart;
      const end = target.selectionEnd;
      target.value = convertKhmerDigits(val);
      if (typeof start === 'number' && typeof end === 'number') {
        try { target.setSelectionRange(start, end); } catch (_) {}
      }
    }
  });
})();
