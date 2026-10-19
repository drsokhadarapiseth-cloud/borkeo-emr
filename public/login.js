'use strict';

const form = document.getElementById('login-form');
const username = document.getElementById('username');
const password = document.getElementById('password');
const passwordGroup = document.getElementById('login-password-group');
const statusBox = document.getElementById('login-status');
const submitButton = document.getElementById('login-button');
const toggleButton = document.getElementById('toggle-password');
const quickRoleSelect = document.getElementById('quick-role-select');
const userAccountsList = document.getElementById('user-accounts');
let demoMode = null;

const DEFAULT_ACCOUNTS = [
  { username: 'admin', displayName: 'អ្នកគ្រប់គ្រងសាកល្បង' },
  { username: 'doctor_opd', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែកពិគ្រោះក្រៅ' },
  { username: 'doctor_medicine', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែកជំងឺទូទៅ' },
  { username: 'doctor_emergency', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែកសង្គ្រោះបន្ទាន់' },
  { username: 'doctor_icu', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែកសង្គ្រោះបន្ទាន់កម្រិតធ្ងន់' },
  { username: 'doctor_pediatric', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែកជំងឺកុមារ' },
  { username: 'doctor_surgery', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែកវះកាត់' },
  { username: 'doctor_obstetric', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែកសម្ភព' },
  { username: 'doctor_gynecology', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែករោគស្ត្រី' },
  { username: 'doctor_tb', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែកជំងឺរបេង' },
  { username: 'doctor_ncu', displayName: 'វេជ្ជបណ្ឌិត - ផ្នែកទារកទើបកើត' },
  { username: 'nurse_opd', displayName: 'គិលានុបដ្ឋាក - ផ្នែកពិគ្រោះក្រៅ' },
  { username: 'nurse_medicine', displayName: 'គិលានុបដ្ឋាក - ផ្នែកជំងឺទូទៅ' },
  { username: 'nurse_emergency', displayName: 'គិលានុបដ្ឋាក - ផ្នែកសង្គ្រោះបន្ទាន់' },
  { username: 'nurse_icu', displayName: 'គិលានុបដ្ឋាក - ផ្នែកសង្គ្រោះបន្ទាន់កម្រិតធ្ងន់' },
  { username: 'nurse_pediatric', displayName: 'គិលានុបដ្ឋាក - ផ្នែកជំងឺកុមារ' },
  { username: 'nurse_surgery', displayName: 'គិលានុបដ្ឋាក - ផ្នែកវះកាត់' },
  { username: 'nurse_obstetric', displayName: 'គិលានុបដ្ឋាក/ឆ្មប - ផ្នែកសម្ភព' },
  { username: 'nurse_gynecology', displayName: 'គិលានុបដ្ឋាក - ផ្នែករោគស្ត្រី' },
  { username: 'nurse_tb', displayName: 'គិលានុបដ្ឋាក - ផ្នែកជំងឺរបេង' },
  { username: 'nurse_ncu', displayName: 'គិលានុបដ្ឋាក - ផ្នែកទារកទើបកើត' },
  { username: 'triage', displayName: 'បុគ្គលិកតម្រៀបអ្នកជំងឺសាកល្បង' },
  { username: 'nurse_triage', displayName: 'គិលានុបដ្ឋាក - ផ្នែកទ្រីយ៉ា' },
  { username: 'registration', displayName: 'បុគ្គលិកចុះឈ្មោះសាកល្បង' },
  { username: 'pharmacy', displayName: 'ឱសថស្ថានសាកល្បង' },
  { username: 'lab', displayName: 'មន្ទីរពិសោធន៍សាកល្បង' },
  { username: 'imaging', displayName: 'រូបភាពវេជ្ជសាស្ត្រសាកល្បង' },
  { username: 'clerk', displayName: 'បេឡាសាកល្បង' },
  { username: 'accountant', displayName: 'គណនេយ្យសាកល្បង' },
  { username: 'director', displayName: 'នាយកសាកល្បង' },
  { username: 'vice_director', displayName: 'អនុប្រធានមន្ទីរពេទ្យ' }
];

function populateAccounts(accounts) {
  const list = (accounts && accounts.length) ? accounts : DEFAULT_ACCOUNTS;
  if (userAccountsList) {
    userAccountsList.innerHTML = list.map(a => `<option value="${a.username}">${a.displayName || a.username}</option>`).join('');
  }
  if (quickRoleSelect) {
    quickRoleSelect.innerHTML = '<option value="">-- ចុចទីនេះដើម្បីជ្រើសរើសគណនី --</option>' +
      list.map(a => `<option value="${a.username}">${a.displayName ? `${a.displayName} (${a.username})` : a.username}</option>`).join('');
  }
}

if (quickRoleSelect) {
  quickRoleSelect.addEventListener('change', () => {
    if (quickRoleSelect.value) {
      username.value = quickRoleSelect.value;
      if (password) password.value = '111111111111';
      submitButton.disabled = false;
    }
  });
}

populateAccounts(DEFAULT_ACCOUNTS);

function setStatus(message) {
  statusBox.textContent = message || '';
  statusBox.hidden = !message;
}

function landingPath(user) {
  const role = String(user?.activeRole || '').toUpperCase();
  if (['CLERK','ACCOUNTANT'].includes(role)) return '/billing';
  if (role === 'LAB') return '/lab';
  if (role === 'IMAGING') return '/imaging';
  if (['WARD_HEAD','CHIEF_WARD'].includes(role)) return '/ward-medicines';
  if (role === 'TRIAGE') return '/triage';
  if (role === 'REGISTRATION') return '/emr?view=register';
  return '/home';
}

toggleButton.addEventListener('click', () => {
  const revealing = password.type === 'password';
  password.type = revealing ? 'text' : 'password';
  toggleButton.textContent = revealing ? 'លាក់' : 'បង្ហាញ';
  toggleButton.setAttribute('aria-label', revealing ? 'លាក់ពាក្យសម្ងាត់' : 'បង្ហាញពាក្យសម្ងាត់');
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  if (demoMode === null) return;
  setStatus('');
  if (!form.reportValidity()) return;
  submitButton.disabled = true;
  submitButton.textContent = 'កំពុងចូលប្រព័ន្ធ…';
  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demoMode
        ? { username: username.value }
        : { username: username.value, password: password.value }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'មិនអាចចូលប្រព័ន្ធបានទេ។');
    password.value = '';
    window.sessionStorage.removeItem('borkeo-counter-number');
    window.location.replace(result.needsContext ? '/context' : landingPath(result.user));
  } catch (error) {
    setStatus(error.message === 'Failed to fetch'
      ? 'មិនអាចភ្ជាប់ទៅម៉ាស៊ីនមេបានទេ។'
      : error.message);
    password.value = '';
    (demoMode ? username : password).focus();
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = 'ចូលប្រើប្រាស់ប្រព័ន្ធ';
  }
});

fetch('/api/auth/config', { cache: 'no-store' }).then(async response => {
  if (!response.ok) throw new Error('Login mode could not be loaded.');
  const data = await response.json();
  demoMode = data.demoMode === true;
  passwordGroup.hidden = demoMode;
  password.required = !demoMode;
  if (Array.isArray(data.accounts) && data.accounts.length) {
    populateAccounts(data.accounts);
  }
  submitButton.disabled = false;
}).catch(() => setStatus('មិនអាចភ្ជាប់ទៅម៉ាស៊ីនមេបានទេ។ សូមផ្ទុកទំព័រឡើងវិញ។'));

fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
  if (!response.ok) return;
  const result = await response.json();
  window.location.replace(result.user?.needsContext ? '/context' : landingPath(result.user));
}).catch(() => {});
