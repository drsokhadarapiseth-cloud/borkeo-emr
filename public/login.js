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
const changeForm = document.getElementById('password-change-form');
const changeUser = document.getElementById('password-change-user');
const changeCurrentGroup = document.getElementById('password-change-current-group');
const changeCurrent = document.getElementById('password-change-current');
const changeNext = document.getElementById('password-change-next');
const changeConfirm = document.getElementById('password-change-confirm');
const changeStatus = document.getElementById('password-change-status');
const changeButton = document.getElementById('password-change-button');
const changeCancel = document.getElementById('password-change-cancel');
const MIN_PASSWORD_LENGTH = 4;
let demoMode = null;
// Accounts that must change their password stay on this page (v39.9).
let changeAccount = null;

const INFECTIOUS_WARD_KH = 'ផ្នែកជំងឺឆ្លង';
const DEFAULT_ACCOUNTS = [
  { username: 'Superuser', displayName: 'Superuser (មុខងារទាំងអស់)' },
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
  { username: 'doctor_infectious', displayName: `វេជ្ជបណ្ឌិត - ${INFECTIOUS_WARD_KH}` },
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
  { username: 'nurse_infectious', displayName: `${'គិលានុបដ្ឋាក'} - ${INFECTIOUS_WARD_KH}` },
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
  let list = (accounts && accounts.length) ? [...accounts] : DEFAULT_ACCOUNTS;
  const superIdx = list.findIndex(a => String(a.username || '').toLowerCase() === 'superuser');
  if (superIdx > 0) {
    const [superItem] = list.splice(superIdx, 1);
    list = [superItem, ...list];
  }
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
      if (password) password.value = '1234';
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

function setChangeStatus(message) {
  changeStatus.textContent = message || '';
  changeStatus.hidden = !message;
}

function showPasswordChange(user, currentPassword) {
  changeAccount = { username: user?.username || username.value, currentPassword: currentPassword || '' };
  changeUser.textContent = changeAccount.username;
  changeCurrentGroup.hidden = Boolean(changeAccount.currentPassword);
  changeCurrent.required = !changeAccount.currentPassword;
  form.hidden = true;
  document.querySelector('.section-intro').hidden = true;
  changeForm.hidden = false;
  setChangeStatus('');
  (changeAccount.currentPassword ? changeNext : changeCurrent).focus();
}

function changeErrorMessage(message) {
  const text = String(message || '');
  if (/incorrect/i.test(text)) return 'ពាក្យសម្ងាត់បច្ចុប្បន្នមិនត្រឹមត្រូវទេ។';
  if (/match/i.test(text)) return 'ពាក្យសម្ងាត់ថ្មីទាំងពីរមិនដូចគ្នាទេ។';
  if (/character|length|least/i.test(text)) return `ពាក្យសម្ងាត់ថ្មីត្រូវមានយ៉ាងតិច ${MIN_PASSWORD_LENGTH} តួអក្សរ។`;
  if (text === 'Failed to fetch') return 'មិនអាចភ្ជាប់ទៅម៉ាស៊ីនមេបានទេ។';
  return 'មិនអាចប្តូរពាក្យសម្ងាត់បានទេ។ សូមព្យាយាមម្តងទៀត។';
}

changeForm.addEventListener('submit', async event => {
  event.preventDefault();
  setChangeStatus('');
  const current = changeAccount?.currentPassword || changeCurrent.value;
  const next = changeNext.value;
  if (!current) { setChangeStatus('សូមបញ្ចូលពាក្យសម្ងាត់បច្ចុប្បន្ន។'); changeCurrent.focus(); return; }
  if (next.length < MIN_PASSWORD_LENGTH) { setChangeStatus(changeErrorMessage('length')); changeNext.focus(); return; }
  if (next !== changeConfirm.value) { setChangeStatus(changeErrorMessage('match')); changeConfirm.focus(); return; }
  if (next === current) { setChangeStatus('ពាក្យសម្ងាត់ថ្មីត្រូវខុសពីពាក្យសម្ងាត់បច្ចុប្បន្ន។'); changeNext.focus(); return; }
  changeButton.disabled = true;
  changeButton.textContent = 'កំពុងរក្សាទុក…';
  try {
    const me = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    const meResult = await me.json().catch(() => ({}));
    if (!me.ok) throw new Error('session');
    const response = await fetch('/api/auth/change-password', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': meResult.csrfToken || '' },
      body: JSON.stringify({ currentPassword: current, newPassword: next, confirmation: changeConfirm.value }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || '');
    // The server signs the account out after a change; sign straight back in.
    const login = await fetch('/api/auth/login', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: changeAccount.username, password: next }),
    });
    const loginResult = await login.json().catch(() => ({}));
    changeForm.reset();
    changeAccount = null;
    if (!login.ok) { window.location.replace('/login'); return; }
    window.sessionStorage.removeItem('borkeo-counter-number');
    window.location.replace(loginResult.needsContext ? '/context' : landingPath(loginResult.user));
  } catch (error) {
    if (error.message === 'session') { window.location.replace('/login'); return; }
    setChangeStatus(changeErrorMessage(error.message));
    if (/incorrect/i.test(error.message) && changeAccount) {
      changeAccount.currentPassword = '';
      changeCurrentGroup.hidden = false;
      changeCurrent.required = true;
      changeCurrent.focus();
    }
  } finally {
    changeButton.disabled = false;
    changeButton.textContent = 'រក្សាទុកពាក្យសម្ងាត់ថ្មី';
  }
});

changeCancel.addEventListener('click', async () => {
  try {
    const me = await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' });
    const meResult = await me.json().catch(() => ({}));
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'X-CSRF-Token': meResult.csrfToken || '' },
    });
  } catch {}
  window.location.replace('/login');
});

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
    if (result.mustChangePassword) {
      showPasswordChange(result.user, password.value);
      password.value = '';
      return;
    }
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
  if (result.user?.mustChangePassword) { showPasswordChange(result.user, ''); return; }
  window.location.replace(result.user?.needsContext ? '/context' : landingPath(result.user));
}).catch(() => {});
