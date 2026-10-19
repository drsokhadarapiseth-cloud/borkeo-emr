'use strict';

const form = document.getElementById('login-form');
const username = document.getElementById('username');
const password = document.getElementById('password');
const passwordGroup = document.getElementById('login-password-group');
const statusBox = document.getElementById('login-status');
const submitButton = document.getElementById('login-button');
const toggleButton = document.getElementById('toggle-password');
let demoMode = null;

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
  submitButton.disabled = false;
}).catch(() => setStatus('មិនអាចភ្ជាប់ទៅម៉ាស៊ីនមេបានទេ។ សូមផ្ទុកទំព័រឡើងវិញ។'));

fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }).then(async response => {
  if (!response.ok) return;
  const result = await response.json();
  window.location.replace(result.user?.needsContext ? '/context' : landingPath(result.user));
}).catch(() => {});
