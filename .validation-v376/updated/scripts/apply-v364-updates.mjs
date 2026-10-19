import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve('.');

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function write(rel, content) {
  fs.writeFileSync(path.join(ROOT, rel), content, 'utf8');
}

console.log('--- Applying Borkeo EMR v36.4 Performance & Triage Workflow Updates ---');

// 1. Update public/request-badges.js
console.log('1. Updating public/request-badges.js');
const requestBadgesCode = `'use strict';
(()=>{
  let session = null;
  let inFlight = false;
  let initialized = false;

  async function refresh() {
    if (inFlight || !session?.user) return;
    const role = session.user.activeRole;
    if (!['ADMIN','DIRECTOR','VICE_DIRECTOR','TRIAGE','DOCTOR','NURSE','MIDWIFE','CHIEF_WARD','WARD_HEAD','PHARMACY','CLERK','ACCOUNTANT'].includes(role)) return;
    inFlight = true;
    try {
      const r = await fetch('/api/requests/counts', { credentials: 'same-origin', cache: 'no-store' });
      if (!r.ok) return;
      const { counts = {} } = await r.json();
      const total = Object.values(counts).reduce((a, b) => a + Number(b || 0), 0);
      for (const link of document.querySelectorAll('a[href]')) {
        const href = link.getAttribute('href')?.split('?')[0];
        if (!['/requests', '/ward-medicines'].includes(href)) continue;
        const count = href === '/requests' ? total : Number(counts.MEDICINE || 0);
        let badge = link.querySelector('[data-request-count]');
        if (!badge) {
          badge = document.createElement('span');
          badge.className = 'request-badge';
          badge.dataset.requestCount = '';
          link.append(badge);
        }
        const textStr = String(count);
        if (badge.textContent !== textStr) badge.textContent = textStr;
        const ariaStr = count + ' pending requests';
        if (badge.getAttribute('aria-label') !== ariaStr) badge.setAttribute('aria-label', ariaStr);
        const shouldHide = count === 0;
        if (badge.hidden !== shouldHide) badge.hidden = shouldHide;
      }
    } catch {} finally {
      inFlight = false;
    }
  }

  function init(s) {
    session = s;
    if (!initialized) {
      initialized = true;
      window.addEventListener('emr-requests-changed', () => void refresh());
      window.addEventListener('focus', () => void refresh());
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) void refresh();
      });
      setInterval(() => {
        if (!document.hidden) void refresh();
      }, 15000);
    }
    void refresh();
  }

  if (window.emrSession) init(window.emrSession);
  window.addEventListener('emr-session-ready', e => init(e.detail));
})();
`;
write('public/request-badges.js', requestBadgesCode);

// 2. Update public/emr-permissions.js
console.log('2. Updating public/emr-permissions.js');
let perms = read('public/emr-permissions.js');

// Make setReadonly idempotent
const oldSetReadonly = `  function setReadonly(root, readonly) {
    if (!root) return;
    root.classList.toggle('emr-permission-readonly', readonly);
    root.querySelectorAll('input, select, textarea').forEach(control => {
      if (control.closest('.no-print')?.classList.contains('emr-permission-nav')) return;
      if (control.closest('[data-permission-scope="paraclinic"]')) return;
      if (control.dataset.permissionKeepEnabled === 'true') return;
      control.disabled = readonly;
    });
    root.querySelectorAll('[contenteditable]').forEach(control => {
      if (readonly) {
        if (!control.hasAttribute('data-original-contenteditable')) {
          control.setAttribute('data-original-contenteditable', control.getAttribute('contenteditable') || 'true');
        }
        control.setAttribute('contenteditable', 'false');
      } else if (control.hasAttribute('data-original-contenteditable')) {
        control.setAttribute('contenteditable', control.getAttribute('data-original-contenteditable'));
        control.removeAttribute('data-original-contenteditable');
      }
    });
    root.querySelectorAll('button').forEach(button => {
      if (button.closest('[data-permission-scope="paraclinic"]')) return;
      const text = \`\${button.id || ''} \${button.className || ''} \${button.textContent || ''}\`.toLowerCase();
      const saveLike = /save|រក្សា|submit|បញ្ជូន|discharge|បញ្ចេញ|transfer|administer|given/.test(text);
      if (saveLike && !button.closest('.inner-tabs,.nursing-section-tabs,.midwife-workflow-nav')) button.disabled = readonly;
    });
  }`;

const newSetReadonly = `  function setReadonly(root, readonly) {
    if (!root) return;
    if (root.classList.contains('emr-permission-readonly') !== readonly) {
      root.classList.toggle('emr-permission-readonly', readonly);
    }
    root.querySelectorAll('input, select, textarea').forEach(control => {
      if (control.closest('.no-print')?.classList.contains('emr-permission-nav')) return;
      if (control.closest('[data-permission-scope="paraclinic"]')) return;
      if (control.dataset.permissionKeepEnabled === 'true') return;
      if (control.disabled !== readonly) control.disabled = readonly;
    });
    root.querySelectorAll('[contenteditable]').forEach(control => {
      if (readonly) {
        if (!control.hasAttribute('data-original-contenteditable')) {
          control.setAttribute('data-original-contenteditable', control.getAttribute('contenteditable') || 'true');
        }
        if (control.getAttribute('contenteditable') !== 'false') control.setAttribute('contenteditable', 'false');
      } else if (control.hasAttribute('data-original-contenteditable')) {
        const orig = control.getAttribute('data-original-contenteditable');
        if (control.getAttribute('contenteditable') !== orig) control.setAttribute('contenteditable', orig);
        control.removeAttribute('data-original-contenteditable');
      }
    });
    root.querySelectorAll('button').forEach(button => {
      if (button.closest('[data-permission-scope="paraclinic"]')) return;
      const text = \`\${button.id || ''} \${button.className || ''} \${button.textContent || ''}\`.toLowerCase();
      const saveLike = /save|រក្សា|submit|បញ្ជូន|discharge|បញ្ចេញ|transfer|administer|given/.test(text);
      if (saveLike && !button.closest('.inner-tabs,.nursing-section-tabs,.midwife-workflow-nav')) {
        if (button.disabled !== readonly) button.disabled = readonly;
      }
    });
  }`;

if (perms.includes(oldSetReadonly)) {
  perms = perms.replace(oldSetReadonly, newSetReadonly);
} else {
  console.warn('Warning: setReadonly block could not be matched directly');
}

// Update applyReadPermissions triage section
const oldTriagePerm = `    if (role === 'TRIAGE') {
      const showSave = isEditMode || (!completedTriage && !isTriageView);
      document.querySelector('#page2 .emr-save-bar')?.toggleAttribute('hidden', !showSave);
      const triageSaveBtn = document.getElementById('triage_save_btn');
      if (triageSaveBtn) {
        triageSaveBtn.toggleAttribute('hidden', !showSave);
        if (isEditMode) {
          triageSaveBtn.dataset.userEditing = 'true';
          triageSaveBtn.dataset.mode = 'save';
          triageSaveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> <span data-key="save">រក្សាទុក</span>';
          triageSaveBtn.classList.remove('emr-edit-mode');
          triageSaveBtn.style.background = '';
          triageSaveBtn.style.color = '';
        }
      }
      const nextBtn = document.querySelector('#page2 .btn-next');
      if (nextBtn) nextBtn.toggleAttribute('hidden', !showSave);
    }`;

const newTriagePerm = `    if (role === 'TRIAGE') {
      const showSave = isEditMode || (!completedTriage && !isTriageView);
      document.querySelector('#page2 .emr-save-bar')?.toggleAttribute('hidden', !showSave);
      const triageSaveBtn = document.getElementById('triage_save_btn');
      if (triageSaveBtn) {
        triageSaveBtn.toggleAttribute('hidden', !showSave);
        if (typeof window.updateTriageSaveButtonState === 'function') {
          window.updateTriageSaveButtonState();
        }
      }
      const nextBtn = document.querySelector('#page2 .btn-next');
      if (nextBtn) hide(nextBtn, true);
    }`;

if (perms.includes(oldTriagePerm)) {
  perms = perms.replace(oldTriagePerm, newTriagePerm);
} else {
  console.warn('Warning: oldTriagePerm block could not be matched directly');
}

// Update bootstrap() and remove self-triggering loop
const oldBootstrap = `  function bootstrap(session) {
    user = session?.user || null;
    apply();
    const observer = new MutationObserver(() => { applyReadPermissions(activeRole()); configureDailyVitalEntry(activeRole()); applyNursingRole(activeRole()); });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('emr:patient-loaded', () => { applyReadPermissions(activeRole()); applyNursingRole(activeRole()); });
  }`;

const newBootstrap = `  let bootstrapped = false;
  let observer = null;
  function bootstrap(session) {
    user = session?.user || null;
    apply();
    if (bootstrapped) return;
    bootstrapped = true;

    observer = new MutationObserver(mutations => {
      let shouldApply = false;
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (node.nodeType === 1) {
            if (node.closest?.('svg, .nursing-chart-overlay, .request-badge, .badge, .emr-daily-vital-chart') ||
                node.matches?.('svg, .nursing-chart-overlay, .request-badge, .badge, .emr-daily-vital-chart')) {
              continue;
            }
            if (node.matches?.('input, select, textarea, button, [contenteditable]') ||
                node.querySelector?.('input, select, textarea, button, [contenteditable]')) {
              shouldApply = true;
              break;
            }
          }
        }
        if (shouldApply) break;
      }
      if (!shouldApply) return;
      observer.disconnect();
      try {
        applyReadPermissions(activeRole());
        configureDailyVitalEntry(activeRole());
      } finally {
        observer.observe(document.body, { childList: true, subtree: true });
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.addEventListener('emr:patient-loaded', () => {
      applyReadPermissions(activeRole());
      applyNursingRole(activeRole());
    });
  }`;

if (perms.includes(oldBootstrap)) {
  perms = perms.replace(oldBootstrap, newBootstrap);
} else {
  console.warn('Warning: oldBootstrap block could not be matched directly');
}

// Also prevent apply() from overwriting .btn-next text with hardcoded string
perms = perms.replace(
  `    if (role === 'TRIAGE') {\n      const action = document.querySelector('#page2 .action-bar .btn-next');\n      if (action) action.textContent = 'រក្សាទុក និងបញ្ជូនទៅផ្នែក';\n    }`,
  `    if (role === 'TRIAGE') {\n      const action = document.querySelector('#page2 .action-bar .btn-next');\n      if (action) hide(action, true);\n    }`
);

write('public/emr-permissions.js', perms);

// 3. Update public/emr-patient-record.js
console.log('3. Updating public/emr-patient-record.js');
let patientRec = read('public/emr-patient-record.js');

const oldTriageControlsLocked = `  function setTriageControlsLocked(locked) {
    document.querySelectorAll('#page2 input, #page2 select, #page2 textarea').forEach(control => {
      if (control.id === 'triage_save_btn' || control.closest('.no-lock')) return;
      if (locked) {
        control.dataset.triageLocked = 'true';
        control.disabled = true;
      } else if (control.dataset.triageLocked === 'true') {
        delete control.dataset.triageLocked;
        control.disabled = false;
      }
    });

    const nextBtn = document.querySelector('#page2 .btn-next');
    if (nextBtn) {
      if (locked) {
        nextBtn.dataset.triageLocked = 'true';
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
      } else if (nextBtn.dataset.triageLocked === 'true') {
        delete nextBtn.dataset.triageLocked;
        nextBtn.disabled = false;
        nextBtn.style.opacity = '';
        nextBtn.style.cursor = '';
      }
    }
  }`;

const newTriageControlsLocked = `  function setTriageControlsLocked(locked) {
    document.querySelectorAll('#page2 input, #page2 select, #page2 textarea').forEach(control => {
      if (control.id === 'triage_save_btn' || control.closest('.no-lock') || control.type === 'hidden') return;
      if (locked) {
        if (!control.disabled) {
          control.dataset.triageLocked = 'true';
          control.disabled = true;
        }
      } else if (control.dataset.triageLocked === 'true') {
        delete control.dataset.triageLocked;
        control.disabled = false;
      }
    });

    const nextBtn = document.querySelector('#page2 .btn-next');
    if (nextBtn) {
      if (locked) {
        nextBtn.dataset.triageLocked = 'true';
        nextBtn.disabled = true;
        nextBtn.style.opacity = '0.5';
        nextBtn.style.cursor = 'not-allowed';
      } else if (nextBtn.dataset.triageLocked === 'true') {
        delete nextBtn.dataset.triageLocked;
        nextBtn.disabled = false;
        nextBtn.style.opacity = '';
        nextBtn.style.cursor = '';
      }
    }
  }`;

patientRec = patientRec.replace(oldTriageControlsLocked, newTriageControlsLocked);

const oldUpdateTriageSaveButtonState = `  function updateTriageSaveButtonState() {
    const btn = document.getElementById('triage_save_btn') || document.querySelector('#page2 .emr-save-button');
    if (!btn) return;
    const isEditParam = new URLSearchParams(window.location.search).get('edit') === '1';
    const isTriageView = new URLSearchParams(window.location.search).get('view') === 'triage' && !isEditParam;
    const currentRole = String(window.emrSession?.user?.activeRole || window.userRole || '').toUpperCase();
    if (currentRole === 'TRIAGE' && isTriageView) {
      btn.dataset.mode = 'view';
      btn.setAttribute('hidden', '');
      setTriageControlsLocked(true);
      return;
    }
    if (currentRole === 'TRIAGE' && isEditParam) {
      btn.dataset.userEditing = 'true';
      btn.dataset.mode = 'save';
      btn.removeAttribute('hidden');
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> <span data-key="save">រក្សាទុក</span>';
      btn.classList.remove('emr-edit-mode');
      btn.style.background = '';
      btn.style.color = '';
      setTriageControlsLocked(false);
      return;
    }
    const transferred = isTriageTransferred();
    if (transferred && !btn.dataset.userEditing) {
      btn.dataset.mode = 'edit';
      btn.innerHTML = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> <span>កែប្រែ</span>';
      btn.classList.add('emr-edit-mode');
      btn.style.background = '#0284c7';
      btn.style.color = '#ffffff';
      setTriageControlsLocked(true);
    } else {
      btn.dataset.mode = 'save';
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> <span data-key="save">រក្សាទុក</span>';
      btn.classList.remove('emr-edit-mode');
      btn.style.background = '';
      btn.style.color = '';
      setTriageControlsLocked(false);
    }
  }`;

const newUpdateTriageSaveButtonState = `  function updateTriageSaveButtonState() {
    const btn = document.getElementById('triage_save_btn') || document.querySelector('#page2 .emr-save-button');
    if (!btn) return;
    const currentRole = String(window.emrSession?.user?.activeRole || window.userRole || '').toUpperCase();
    const canEditTriage = ['ADMIN', 'VICE_DIRECTOR', 'TRIAGE', 'DIRECTOR'].includes(currentRole);
    const isEditParam = new URLSearchParams(window.location.search).get('edit') === '1';
    const transferred = isTriageTransferred();

    const isClosed = Boolean(loadedPatient?.clinicalClosed || loadedPatient?.dischargeDate);
    if (isClosed || !canEditTriage) {
      if (transferred) {
        setTriageControlsLocked(true);
        btn.setAttribute('hidden', '');
        return;
      }
    }

    if (!transferred) {
      btn.dataset.mode = 'save_transfer';
      delete btn.dataset.userEditing;
      btn.removeAttribute('hidden');
      const targetHtml = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> <span data-key="save_and_transfer">រក្សាទុក និងបញ្ជូនទៅផ្នែក</span>';
      if (btn.innerHTML !== targetHtml) btn.innerHTML = targetHtml;
      btn.classList.remove('emr-edit-mode');
      btn.style.background = '';
      btn.style.color = '';
      setTriageControlsLocked(false);
      return;
    }

    if (btn.dataset.userEditing === 'true' || isEditParam) {
      btn.dataset.mode = 'save_transfer';
      btn.dataset.userEditing = 'true';
      btn.removeAttribute('hidden');
      const targetHtml = '<i class="fa-solid fa-paper-plane" aria-hidden="true"></i> <span data-key="save_and_transfer">រក្សាទុក និងបញ្ជូនទៅផ្នែក</span>';
      if (btn.innerHTML !== targetHtml) btn.innerHTML = targetHtml;
      btn.classList.remove('emr-edit-mode');
      btn.style.background = '';
      btn.style.color = '';
      setTriageControlsLocked(false);
    } else {
      btn.dataset.mode = 'edit';
      delete btn.dataset.userEditing;
      btn.removeAttribute('hidden');
      const targetHtml = '<i class="fa-solid fa-pen-to-square" aria-hidden="true"></i> <span data-key="edit">កែប្រែ</span>';
      if (btn.innerHTML !== targetHtml) btn.innerHTML = targetHtml;
      btn.classList.add('emr-edit-mode');
      btn.style.background = '#0284c7';
      btn.style.color = '#ffffff';
      setTriageControlsLocked(true);
    }
  }`;

patientRec = patientRec.replace(oldUpdateTriageSaveButtonState, newUpdateTriageSaveButtonState);

const oldHandleTriageSaveOrEdit = `  function handleTriageSaveOrEdit() {
    const btn = document.getElementById('triage_save_btn') || document.querySelector('#page2 .emr-save-button');
    if (btn && btn.dataset.mode === 'edit') {
      btn.dataset.userEditing = 'true';
      btn.dataset.mode = 'save';
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> <span data-key="save">រក្សាទុក</span>';
      btn.classList.remove('emr-edit-mode');
      btn.style.background = '';
      btn.style.color = '';
      window._initialTriageWard = getSelectedTriageWard();
      setTriageControlsLocked(false);
      setStatus('ok', 'បានបើកសោទម្រង់ទ្រីយ៉ាសម្រាប់ការកែប្រែ');
      return;
    }

    const currentWard = getSelectedTriageWard();
    const wardChanged = Boolean(window._initialTriageWard && window._initialTriageWard !== currentWard);
    savePatientRecord({ triageSave: true, triageEdit: true, triageWardChanged: wardChanged, previousWard: window._initialTriageWard }).then(saved => {
      if (saved) {
        if (btn && !new URLSearchParams(window.location.search).get('edit')) delete btn.dataset.userEditing;
        updateTriageSaveButtonState();
      }
    });
  }`;

const newHandleTriageSaveOrEdit = `  function handleTriageSaveOrEdit() {
    const btn = document.getElementById('triage_save_btn') || document.querySelector('#page2 .emr-save-button');
    if (!btn || btn.disabled) return;

    if (btn.dataset.mode === 'edit') {
      btn.dataset.userEditing = 'true';
      updateTriageSaveButtonState();
      window._initialTriageWard = getSelectedTriageWard();
      setTriageControlsLocked(false);
      setStatus('ok', 'បានបើកសោទម្រង់ទ្រីយ៉ាសម្រាប់ការកែប្រែ');
      return;
    }

    const isTransferred = isTriageTransferred();
    const currentWard = getSelectedTriageWard();
    const wardChanged = Boolean(window._initialTriageWard && window._initialTriageWard !== currentWard);
    const currentRole = String(window.emrSession?.user?.activeRole || window.userRole || '').toUpperCase();

    btn.disabled = true;
    savePatientRecord({
      triageSave: true,
      triageEdit: isTransferred,
      triageWardChanged: wardChanged,
      previousWard: window._initialTriageWard,
      continueTo: currentRole === 'TRIAGE' ? undefined : 3
    }).then(saved => {
      if (saved) {
        delete btn.dataset.userEditing;
        updateTriageSaveButtonState();
      } else {
        btn.dataset.userEditing = 'true';
      }
    }).catch(err => {
      btn.dataset.userEditing = 'true';
      setStatus('error', String(err?.message || err));
    }).finally(() => {
      btn.disabled = false;
    });
  }`;

patientRec = patientRec.replace(oldHandleTriageSaveOrEdit, newHandleTriageSaveOrEdit);

write('public/emr-patient-record.js', patientRec);

// 4. Update public/patient-list.js
console.log('4. Updating public/patient-list.js');
let patientList = read('public/patient-list.js');

const oldRefreshPaymentStatuses = `  async function refreshPaymentStatuses() {
    if(document.visibilityState==='hidden' || document.activeElement?.matches('[data-date-field]'))return;
    try {
      const response=await fetch(patientsUrl,{credentials:'same-origin',cache:'no-store'});
      if(!response.ok)return;
      const result=await response.json();
      patients=(triageToday ? result.completed : result.patients) || [];
      renderDepartmentFilter();renderPaymentFilter();renderTable();
    } catch(error){console.warn('Unable to refresh patient list.',error);}
  }`;

const newRefreshPaymentStatuses = `  let isListRefreshing = false;
  async function refreshPaymentStatuses() {
    if (isListRefreshing || document.visibilityState === 'hidden') return;
    if (document.activeElement?.matches('input, select, textarea, [data-date-field], #patient-search')) return;
    isListRefreshing = true;
    try {
      const response = await fetch(patientsUrl, { credentials: 'same-origin', cache: 'no-store' });
      if (!response.ok) return;
      const result = await response.json();
      const fresh = (triageToday ? result.completed : result.patients) || [];
      const changed = fresh.length !== patients.length || fresh.some((p, i) => p.patientKey !== patients[i]?.patientKey || p.updatedAt !== patients[i]?.updatedAt || p.paymentStatus?.code !== patients[i]?.paymentStatus?.code);
      if (changed) {
        patients = fresh;
        renderDepartmentFilter();
        renderPaymentFilter();
        renderTable();
      }
    } catch(error){
      console.warn('Unable to refresh patient list.', error);
    } finally {
      isListRefreshing = false;
    }
  }`;

patientList = patientList.replace(oldRefreshPaymentStatuses, newRefreshPaymentStatuses);
write('public/patient-list.js', patientList);

// 5. Update HTML cache busters in protected/EMR.html, protected/patient-list.html, protected/triage.html
console.log('5. Updating cache busters to v=3640');
let emrHtml = read('protected/EMR.html');
emrHtml = emrHtml.replace(/\/public\/emr-inpatient-workflow\.js\?v=\d+/g, '/public/emr-inpatient-workflow.js?v=3640');
emrHtml = emrHtml.replace(/\/public\/emr-patient-record\.js\?v=\d+/g, '/public/emr-patient-record.js?v=3640');
emrHtml = emrHtml.replace(/\/public\/emr-permissions\.js\?v=\d+/g, '/public/emr-permissions.js?v=3640');
emrHtml = emrHtml.replace(/\/public\/request-badges\.js\?v=\d+/g, '/public/request-badges.js?v=3640');

// Also update switchNursingForm in protected/EMR.html
const oldEmrSwitchNursing = `        function switchNursingForm(formName) {
            var formMap = {
                general: { pane: 'nursing_general' },
                maternity: { pane: 'nursing_maternity' }
            };
            var selected = formMap[formName] || formMap.general;

            Object.keys(formMap).forEach(function (key) {
                var item = formMap[key];
                var pane = document.getElementById(item.pane);
                if (pane) {
                    var isActive = item.pane === selected.pane;
                    pane.classList.toggle('active', isActive);
                    pane.style.display = isActive ? 'block' : 'none';
                }
            });

            var selector = document.getElementById('nursing_process_selector');
            if (selector) selector.value = selected.pane === 'nursing_maternity' ? 'maternity' : 'general';
            scheduleNursingChartRender();
        }`;

const newEmrSwitchNursing = `        var activeNursingFormKey = null;
        function switchNursingForm(formName) {
            var formMap = {
                general: { pane: 'nursing_general' },
                maternity: { pane: 'nursing_maternity' }
            };
            var selectedKey = formMap[formName] ? formName : 'general';
            if (activeNursingFormKey === selectedKey) return;
            activeNursingFormKey = selectedKey;
            var selected = formMap[selectedKey];

            Object.keys(formMap).forEach(function (key) {
                var item = formMap[key];
                var pane = document.getElementById(item.pane);
                if (pane) {
                    var isActive = item.pane === selected.pane;
                    pane.classList.toggle('active', isActive);
                    pane.style.display = isActive ? 'block' : 'none';
                }
            });

            var selector = document.getElementById('nursing_process_selector');
            if (selector && selector.value !== (selected.pane === 'nursing_maternity' ? 'maternity' : 'general')) {
                selector.value = selected.pane === 'nursing_maternity' ? 'maternity' : 'general';
            }
            scheduleNursingChartRender();
        }`;

emrHtml = emrHtml.replace(oldEmrSwitchNursing.replace(/\n/g, '\r\n'), newEmrSwitchNursing.replace(/\n/g, '\r\n'));

// Update scheduleNursingChartRender in protected/EMR.html
const oldEmrScheduleChart = `        function scheduleNursingChartRender() {
            if (nursingChartRenderTimer) clearTimeout(nursingChartRenderTimer);
            nursingChartRenderTimer = setTimeout(function () {
                nursingChartRenderTimer = null;
                renderNursingVitalCharts();
            }, 0);
        }`;

const newEmrScheduleChart = `        function scheduleNursingChartRender() {
            var subNursing = document.getElementById('sub_nursing');
            if (subNursing && (subNursing.hidden || subNursing.style.display === 'none' || subNursing.offsetParent === null)) {
                return;
            }
            if (nursingChartRenderTimer) clearTimeout(nursingChartRenderTimer);
            nursingChartRenderTimer = setTimeout(function () {
                nursingChartRenderTimer = null;
                renderNursingVitalCharts();
            }, 50);
        }`;

emrHtml = emrHtml.replace(oldEmrScheduleChart.replace(/\n/g, '\r\n'), newEmrScheduleChart.replace(/\n/g, '\r\n'));
write('protected/EMR.html', emrHtml);

// Update legacy-html/EMR.html
console.log('5b. Updating legacy-html/EMR.html');
let legacyHtml = read('legacy-html/EMR.html');
legacyHtml = legacyHtml.replace(
  '<button type="button" class="btn-blue emr-save-button no-print" id="triage_save_btn" onclick="handleTriageSaveOrEdit()"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> <span data-key="save">រក្សាទុក</span></button>',
  '<button type="button" class="btn-blue emr-save-button no-print" id="triage_save_btn" onclick="handleTriageSaveOrEdit()"><i class="fa-solid fa-paper-plane" aria-hidden="true"></i> <span data-key="save_and_transfer">រក្សាទុក និងបញ្ជូនទៅផ្នែក</span></button>'
);
write('legacy-html/EMR.html', legacyHtml);

// Update protected/patient-list.html
let pListHtml = read('protected/patient-list.html');
pListHtml = pListHtml.replace(/\/public\/patient-list\.js\?v=\d+/g, '/public/patient-list.js?v=3640');
write('protected/patient-list.html', pListHtml);

// Update protected/triage.html
let triageHtml = read('protected/triage.html');
triageHtml = triageHtml.replace(/\/public\/patient-list\.js\?v=\d+/g, '/public/patient-list.js?v=3640');
write('protected/triage.html', triageHtml);

console.log('All client assets updated successfully.');
