'use strict';

(function connectGynecologyFormsToPatientRecords() {
  const selector = document.getElementById('opd-module-select');
  const toolbar = selector?.closest('.opd-module-toolbar');
  const panels = document.getElementById('opd-specialty-panels');
  const ancPanel = document.getElementById('sub_anc');
  if (!selector || !toolbar || !panels || !ancPanel) return;

  const formOrder = ['anc', 'pnc', 'spacing', 'abortion', 'safe', 'cervix'];
  const formLabels = {
    anc: 'ពិនិត្យផ្ទៃពោះ (ANC)',
    pnc: 'ការថែទាំក្រោយសម្រាល (PNC)',
    spacing: 'ផែនការគ្រួសារ',
    abortion: 'រលូត រំលូតកូន និងមរណភាពមាតា',
    safe: 'សេវារំលូតដោយសុវត្ថិភាព',
    cervix: 'ពិនិត្យមហារីកមាត់ស្បូន',
  };
  const patientFieldIds = [
    'web_adm_no', 'web_health_id', 'web_first_name', 'web_last_name',
    'web_age', 'web_gender', 'web_sex', 'web_dob',
  ];
  const preparedRoots = new WeakSet();
  const initialValues = new WeakMap();
  const dirtyForms = new Set();
  const loadedPatientKeys = new Map();
  let csrfToken = '';
  let activeType = formOrder.includes(selector.value) ? selector.value : null;
  let requestSequence = 0;
  let patientReloadTimer = 0;

  function fieldValue(id) {
    const element = document.getElementById(id);
    if (!element) return '';
    return String(element.value ?? element.textContent ?? '').trim();
  }

  function patientContext() {
    const caseNumber = fieldValue('web_adm_no');
    const healthId = fieldValue('web_health_id');
    return {
      key: caseNumber ? `case:${caseNumber}` : (healthId ? `health:${healthId}` : ''),
      patient: {
        caseNumber,
        healthId,
        firstName: fieldValue('web_first_name'),
        lastName: fieldValue('web_last_name'),
        age: fieldValue('web_age'),
        sex: fieldValue('web_gender') || fieldValue('web_sex'),
        dateOfBirth: fieldValue('web_dob'),
      },
    };
  }

  const status = document.createElement('div');
  status.id = 'opd-record-status';
  status.className = 'opd-record-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  toolbar.append(status);

  function setStatus(state, message) {
    status.dataset.state = state;
    status.textContent = message;
  }

  function updateSaveAvailability(root) {
    const disabled = !patientContext().key;
    root?.querySelectorAll('[data-opd-storage-action="save"], [data-opd-storage-action="continue"]')
      .forEach(button => { button.disabled = disabled; });
  }

  function updatePatientStatus() {
    const context = patientContext();
    document.querySelectorAll('[data-opd-clinical-root]').forEach(updateSaveAvailability);
    panels.querySelectorAll('iframe.opd-specialty-frame').forEach(frame => {
      try { updateSaveAvailability(frame.contentDocument?.body); } catch { /* Same-origin frame may still load. */ }
    });
    if (!context.key) {
      setStatus('missing', 'សូមបញ្ចូលលេខករណី ឬលេខបណ្ណសុខភាព មុនពេលរក្សាទុក');
      return;
    }
    const name = [context.patient.lastName, context.patient.firstName].filter(Boolean).join(' ');
    setStatus('ready', `${name || 'អ្នកជំងឺ'} · ${context.patient.caseNumber || context.patient.healthId}`);
  }

  function ensureFormOptions() {
    const group = selector.querySelector('optgroup') || selector;
    formOrder.forEach(type => {
      let option = selector.querySelector(`option[value="${type}"]`);
      if (!option) {
        option = document.createElement('option');
        option.value = type;
        option.textContent = formLabels[type];
      }
      group.append(option);
    });
  }

  function formControls(root) {
    return Array.from(root.querySelectorAll(
      'input:not([type="button"]):not([type="submit"]):not([type="reset"]), select, textarea, [contenteditable="true"]',
    ));
  }

  function fieldKey(control, index) {
    if (control.tagName === 'INPUT' && control.type === 'radio' && control.name) {
      return `radio:${control.name}`;
    }
    if (control.id) return `id:${control.id}`;
    return `field:${index}`;
  }

  function radioValue(control) {
    if (control.value && control.value !== 'on') return control.value;
    const directLabel = control.closest('label');
    const linkedLabel = control.id
      ? control.ownerDocument.querySelector(`label[for="${CSS.escape(control.id)}"]`)
      : null;
    return String((directLabel || linkedLabel)?.textContent || 'checked').trim();
  }

  function readForm(root) {
    const data = {};
    formControls(root).forEach((control, index) => {
      const key = fieldKey(control, index);
      if (control.tagName === 'INPUT' && control.type === 'radio') {
        if (!(key in data)) data[key] = '';
        if (control.checked) data[key] = radioValue(control);
      } else if (control.tagName === 'INPUT' && control.type === 'checkbox') {
        data[key] = control.checked;
      } else if (control.tagName === 'SELECT' && control.multiple) {
        data[key] = Array.from(control.selectedOptions, option => option.value);
      } else if (control.hasAttribute('contenteditable')) {
        data[key] = control.textContent || '';
      } else {
        data[key] = control.value || '';
      }
    });
    return data;
  }

  function writeForm(root, data) {
    root.dataset.opdRestoring = 'true';
    formControls(root).forEach((control, index) => {
      const key = fieldKey(control, index);
      const value = Object.prototype.hasOwnProperty.call(data, key) ? data[key] : '';
      if (control.tagName === 'INPUT' && control.type === 'radio') {
        control.checked = value !== '' && radioValue(control) === value;
      } else if (control.tagName === 'INPUT' && control.type === 'checkbox') {
        control.checked = value === true;
      } else if (control.tagName === 'SELECT' && control.multiple) {
        const selected = Array.isArray(value) ? new Set(value) : new Set();
        Array.from(control.options).forEach(option => { option.selected = selected.has(option.value); });
      } else if (control.hasAttribute('contenteditable')) {
        control.textContent = typeof value === 'string' ? value : '';
      } else {
        control.value = typeof value === 'string' || typeof value === 'number' ? String(value) : '';
      }
    });
    root.dataset.opdRestoring = 'false';
  }

  function typeForRoot(root) {
    return root.dataset.opdClinicalRoot || null;
  }

  function markDirty(root) {
    if (root.dataset.opdRestoring === 'true') return;
    const type = typeForRoot(root);
    if (!type) return;
    dirtyForms.add(type);
    if (type === selector.value) setStatus('dirty', 'មានការកែប្រែមិនទាន់រក្សាទុក');
  }

  function previousForm(type) {
    const index = formOrder.indexOf(type);
    return index > 0 ? formOrder[index - 1] : 'general';
  }

  function nextForm(type) {
    const index = formOrder.indexOf(type);
    return index >= 0 && index < formOrder.length - 1 ? formOrder[index + 1] : 'general';
  }

  function selectForm(type) {
    selector.value = type;
    selector.dispatchEvent(new Event('change', { bubbles: true }));
    selector.focus();
  }

  async function getCsrfToken() {
    if (csrfToken) return csrfToken;
    const response = await fetch('/api/auth/me', { credentials: 'same-origin' });
    if (!response.ok) throw new Error('Authentication required.');
    csrfToken = (await response.json()).csrfToken;
    return csrfToken;
  }

  function rootForType(type) {
    if (type === 'anc') return ancPanel;
    const frame = Array.from(panels.querySelectorAll('iframe.opd-specialty-frame'))
      .find(candidate => candidate.dataset.clinicalFormType === type);
    try { return frame?.contentDocument?.body || null; } catch { return null; }
  }

  async function saveForm(type, options = {}) {
    const root = options.root || rootForType(type);
    const context = patientContext();
    if (!root || !formOrder.includes(type)) return false;
    if (!context.key) {
      updatePatientStatus();
      root.querySelector('[data-opd-storage-action="save"]')?.focus();
      return false;
    }
    setStatus('saving', 'កំពុងរក្សាទុក…');
    try {
      const token = await getCsrfToken();
      const response = await fetch(`/api/clinical-forms/${encodeURIComponent(type)}`, {
        method: 'PUT',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
        body: JSON.stringify({ patientKey: context.key, patient: context.patient, data: readForm(root) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to save this form.');
      dirtyForms.delete(type);
      loadedPatientKeys.set(type, context.key);
      setStatus('saved', `បានរក្សាទុក ${formLabels[type]} · ជំនាន់ទី ${result.record.version}`);
      return true;
    } catch (error) {
      setStatus('error', `រក្សាទុកមិនបាន៖ ${error.message}`);
      return false;
    }
  }

  async function loadForm(type, root) {
    const context = patientContext();
    if (!context.key || !root || !formOrder.includes(type)) {
      updatePatientStatus();
      return;
    }
    const requestId = ++requestSequence;
    setStatus('loading', `កំពុងបើក ${formLabels[type]}…`);
    try {
      const response = await fetch(
        `/api/clinical-forms/${encodeURIComponent(type)}?patientKey=${encodeURIComponent(context.key)}`,
        { credentials: 'same-origin' },
      );
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Unable to load this form.');
      if (requestId !== requestSequence || patientContext().key !== context.key) return;
      writeForm(root, result.record?.data || initialValues.get(root) || {});
      dirtyForms.delete(type);
      loadedPatientKeys.set(type, context.key);
      if (result.record) {
        setStatus('saved', `បានបើកទិន្នន័យដែលបានរក្សាទុក · ជំនាន់ទី ${result.record.version}`);
      } else {
        setStatus('ready', `ទម្រង់ថ្មីសម្រាប់ ${context.patient.caseNumber || context.patient.healthId}`);
      }
    } catch (error) {
      setStatus('error', `បើកទិន្នន័យមិនបាន៖ ${error.message}`);
    }
  }

  function actionForButton(button) {
    const label = String(button.textContent || '').replace(/\s+/g, ' ').trim();
    if (label.includes('រក្សាទុក') && label.includes('បន្ត')) return 'continue';
    if (label.includes('រក្សាទុក')) return 'save';
    if (label.includes('ត្រឡប់')) return 'back';
    return '';
  }

  function bindActionButton(button, type, action) {
    if (button.dataset.opdStorageBound === 'true') return;
    button.dataset.opdStorageBound = 'true';
    button.dataset.opdStorageAction = action;
    button.addEventListener('click', async event => {
      event.preventDefault();
      if (action === 'back') {
        selectForm(previousForm(type));
      } else if (action === 'save') {
        await saveForm(type);
      } else if (action === 'continue' && await saveForm(type)) {
        selectForm(nextForm(type));
      }
    });
  }

  function addActionButton(documentForRoot, container, label, action, type) {
    const button = documentForRoot.createElement('button');
    button.type = 'button';
    button.className = 'btn-blue';
    button.textContent = label;
    container.append(button);
    bindActionButton(button, type, action);
  }

  function prepareRoot(root, type) {
    if (!root || preparedRoots.has(root)) return;
    preparedRoots.add(root);
    root.dataset.opdClinicalRoot = type;
    root.dataset.opdRestoring = 'false';

    const actionButtons = Array.from(root.querySelectorAll('button'));
    const actionsFound = new Set();
    actionButtons.forEach(button => {
      const action = actionForButton(button);
      if (action) {
        actionsFound.add(action);
        bindActionButton(button, type, action);
      }
    });

    if (!actionsFound.has('save') || !actionsFound.has('continue') || !actionsFound.has('back')) {
      const actions = root.ownerDocument.createElement('div');
      actions.className = 'opd-native-save-actions no-print';
      if (!actionsFound.has('back')) addActionButton(root.ownerDocument, actions, 'ត្រឡប់ក្រោយ', 'back', type);
      if (!actionsFound.has('save')) addActionButton(root.ownerDocument, actions, 'រក្សាទុក', 'save', type);
      if (!actionsFound.has('continue')) addActionButton(root.ownerDocument, actions, 'រក្សាទុក និងបន្ត', 'continue', type);
      root.append(actions);
    }

    initialValues.set(root, readForm(root));
    root.addEventListener('input', () => markDirty(root));
    root.addEventListener('change', () => markDirty(root));
    updateSaveAvailability(root);
  }

  function resizeFrame(frame) {
    try {
      const height = Math.max(650, frame.contentDocument.documentElement.scrollHeight,
        frame.contentDocument.body.scrollHeight);
      frame.style.height = `${Math.min(height + 30, 6000)}px`;
    } catch { /* The next load or resize will try again. */ }
  }

  function prepareFrame(frame, type) {
    if (!frame || !formOrder.includes(type)) return;
    frame.dataset.clinicalFormType = type;
    const afterLoad = () => {
      const root = frame.contentDocument?.body;
      if (!root) return;
      prepareRoot(root, type);
      resizeFrame(frame);
      if (selector.value === type && loadedPatientKeys.get(type) !== patientContext().key) {
        loadForm(type, root);
      }
    };
    if (frame.dataset.opdStorageFrameBound !== 'true') {
      frame.dataset.opdStorageFrameBound = 'true';
      frame.addEventListener('load', afterLoad);
    }
    [0, 60, 250].forEach(delay => window.setTimeout(afterLoad, delay));
  }

  function prepareVisibleForm(type) {
    if (type === 'anc') {
      prepareRoot(ancPanel, type);
      if (loadedPatientKeys.get(type) !== patientContext().key) loadForm(type, ancPanel);
      return;
    }
    const frame = Array.from(panels.querySelectorAll('iframe.opd-specialty-frame'))
      .find(candidate => !candidate.hidden) || panels.querySelector('iframe.opd-specialty-frame:last-of-type');
    if (frame) prepareFrame(frame, type);
  }

  ensureFormOptions();
  prepareRoot(ancPanel, 'anc');
  updatePatientStatus();

  selector.addEventListener('change', () => {
    const previousType = activeType;
    const nextType = formOrder.includes(selector.value) ? selector.value : null;
    activeType = nextType;
    if (previousType && previousType !== nextType && dirtyForms.has(previousType)) {
      void saveForm(previousType);
    }
    if (nextType) [0, 30, 120, 350].forEach(delay => {
      window.setTimeout(() => prepareVisibleForm(nextType), delay);
    });
    else updatePatientStatus();
  });

  new MutationObserver(() => {
    const type = formOrder.includes(selector.value) ? selector.value : null;
    if (type && type !== 'anc') prepareVisibleForm(type);
  }).observe(panels, { childList: true });

  patientFieldIds.forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      updatePatientStatus();
      window.clearTimeout(patientReloadTimer);
      patientReloadTimer = window.setTimeout(() => {
        if (!activeType) return;
        const root = rootForType(activeType);
        const currentKey = patientContext().key;
        if (dirtyForms.has(activeType)) {
          setStatus('dirty', 'មានការកែប្រែមិនទាន់រក្សាទុក សូមរក្សាទុកមុនប្ដូរអ្នកជំងឺ');
          return;
        }
        if (root && currentKey && loadedPatientKeys.get(activeType) !== currentKey) {
          loadForm(activeType, root);
        }
      }, 500);
    });
  });
})();
