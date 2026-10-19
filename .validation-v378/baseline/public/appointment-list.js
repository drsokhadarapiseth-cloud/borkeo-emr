'use strict';
(async function() {
  const session = window.emrSession || await fetch('/api/auth/me', {credentials: 'same-origin'}).then(r => r.json());
  const role = session?.user?.activeRole;
  if (!['REGISTRATION', 'ADMIN','VICE_DIRECTOR', 'DIRECTOR'].includes(role)) return;

  const panelPatient = document.querySelector('.patient-panel:not(#appointment-panel)');
  const panelAppt = document.getElementById('appointment-panel');
  if (!panelPatient || !panelAppt) return;

  const isApptView = new URLSearchParams(window.location.search).get('view') === 'appointments';
  if (isApptView) {
    panelPatient.hidden = true;
    panelAppt.hidden = false;
  } else {
    panelPatient.hidden = false;
    panelAppt.hidden = true;
  }

  const startFilter = document.getElementById('appt-start-filter');
  const endFilter = document.getElementById('appt-end-filter');
  const searchFilter = document.getElementById('appt-search');
  const tbody = document.getElementById('appointment-table-body');
  const total = document.getElementById('appt-total');
  const statusEl = document.getElementById('appt-list-status');
  
  // Default window: one calendar month back through today (Cambodia time).
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
  let now = new Date(Number(parts.year),Number(parts.month)-1,Number(parts.day));
  const lastPreviousDay=new Date(now.getFullYear(),now.getMonth(),0).getDate();
  let firstDay = new Date(now.getFullYear(),now.getMonth()-1,Math.min(now.getDate(),lastPreviousDay));
  let lastDay = now;
  
  const pad = n => String(n).padStart(2, '0');
  const formatDate = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  
  startFilter.value = formatDate(firstDay);
  endFilter.value = formatDate(lastDay);

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(url, opt = {}) {
    opt.credentials = 'same-origin';
    opt.headers = { ...(opt.headers || {}), ...(opt.method ? { 'X-CSRF-Token': session.csrfToken || '' } : {}) };
    const r = await fetch(url, opt);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.error || 'Request failed');
    return d;
  }

  let allAppointments = [];

  function updateAppointmentHeading() {
    if (!isApptView) return;
    const title = window.getBorkeoLanguage?.() === 'en' ? 'Patient Appointment List' : 'បញ្ជីអ្នកជំងឺណាត់ជួប';
    const banner = document.querySelector('.patient-page-banner h1');
    if (banner) {
      banner.removeAttribute('data-i18n');
      banner.dataset.languageExclude = '';
      if(!banner.closest('.emr-unified-brand'))banner.textContent = title;
    }
    document.title = title + ' — Borkeo EMR';
  }
  updateAppointmentHeading();
  window.addEventListener('borkeo-language-change', updateAppointmentHeading);


  function refreshDateWindow() {
    const oldStart=formatDate(firstDay),oldEnd=formatDate(lastDay);
    const current=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Phnom_Penh',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(new Date()).map(p=>[p.type,p.value]));
    now=new Date(Number(current.year),Number(current.month)-1,Number(current.day));
    firstDay=new Date(now.getFullYear(),now.getMonth()-1,Math.min(now.getDate(),new Date(now.getFullYear(),now.getMonth(),0).getDate()));
    lastDay=now;
    if(startFilter.value===oldStart)startFilter.value=formatDate(firstDay);
    if(endFilter.value===oldEnd)endFilter.value=formatDate(lastDay);
  }
  async function loadAppointments() {
    refreshDateWindow();
    statusEl.textContent = 'កំពុងទាញទិន្នន័យ...';
    try {
      const qs = new URLSearchParams({rolling:'1'});
      if (startFilter.value) qs.set('startDate', startFilter.value);
      if (endFilter.value) qs.set('endDate', endFilter.value);
      
      const d = await api(`/api/appointments?${qs.toString()}`);
      allAppointments = d.appointments || [];
      renderAppointments();
      statusEl.textContent = '';
    } catch (e) {
      statusEl.textContent = e.message;
    }
  }

  function renderAppointments() {
    const q = searchFilter.value.trim().toLowerCase();
    
    // Retain outstanding appointments within the rolling calendar-month window.
    const todayStr = formatDate(now);
    
    let filtered = allAppointments.filter(a => {
      // Hide expired appointments from this list; never delete stored history.
      if(a.appointmentDate < formatDate(firstDay))return false;
      // search filter
      if (q) {
        const haystack = [a.patientName, a.phone].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      
      // Completed or cancelled appointments from earlier days leave this work list.
      if (a.appointmentDate < todayStr && !['SCHEDULED', 'CALLED'].includes(a.status)) {
         return false; // hide past arrived/cancelled
      }
      
      return true;
    });

    tbody.innerHTML = filtered.map((a, i) => {
      const isCalled = a.status === 'CALLED';
      const phoneColor = isCalled ? '#14a800' : '#d93025'; // Green if called, Red if not
      
      // Phone icon SVG
      const phoneIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="${phoneColor}" style="vertical-align: middle; cursor: pointer;">
        <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/>
      </svg>`;

      return `<tr data-appointment-id="${esc(a.id)}">
        <td>${i + 1}</td>
        <td><strong>${esc(a.patientName)}</strong></td>
        <td>—</td>
        <td>—</td>
        <td>${esc(a.phone || '—')}</td>
        <td>—</td>
        <td>—</td>
        <td>—</td>
        <td>${esc(a.departmentCode || 'OPD')}</td>
        <td data-column="dischargeDate">—</td>
        <td class="date-cell" data-column="appointmentDate"><span data-patient-value>${esc(a.appointmentDate)}</span> <span class="entry-time">${esc(a.appointmentTime || '')}</span></td>
        <td style="text-align:center;" title="${isCalled ? 'Called' : 'Not Called'}">
          <button type="button" data-call-btn="${esc(a.id)}" style="background:none; border:none; padding:4px;">
            ${phoneIcon}
          </button>
        </td>
        <td>
          <button type="button" class="secondary-button" style="padding:4px 8px; font-size:12px;" data-register="${esc(a.patientKey)}" data-name="${esc(a.patientName)}" data-phone="${esc(a.phone)}">
            ចុះឈ្មោះ (Register)
          </button>
        </td>
      </tr>`;
    }).join('') || '<tr><td colspan="13" style="text-align:center; padding:20px;">មិនមានទិន្នន័យ (No appointments found)</td></tr>';
    
    total.textContent = `សរុប ${filtered.length}`;
  }

  startFilter.addEventListener('change', loadAppointments);
  endFilter.addEventListener('change', loadAppointments);
  searchFilter.addEventListener('input', renderAppointments);
  document.getElementById('appt-reset-filters').addEventListener('click', () => {
    startFilter.value = formatDate(firstDay);
    endFilter.value = formatDate(lastDay);
    searchFilter.value = '';
    loadAppointments();
  });

  tbody.addEventListener('click', async e => {
    const callBtn = e.target.closest('[data-call-btn]');
    if (callBtn) {
      const id = callBtn.dataset.callBtn;
      const appt = allAppointments.find(a => a.id === id);
      if (appt && appt.status !== 'CALLED') {
        try {
          statusEl.textContent = 'កំពុងកែប្រែ...';
          await api(`/api/appointments/${id}/status`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: 'CALLED' }) });
          appt.status = 'CALLED';
          renderAppointments();
          statusEl.textContent = '';
        } catch (error) {
          statusEl.textContent = error.message;
        }
      }
      return;
    }

    const regBtn = e.target.closest('[data-register]');
    if (regBtn) {
      if (regBtn.dataset.register) {
        location.assign(`/emr?newVisitFrom=${encodeURIComponent(regBtn.dataset.register)}&view=register`);
      } else {
        const url = new URL('/emr', location.origin);
        if (regBtn.dataset.name) url.searchParams.set('name', regBtn.dataset.name);
        if (regBtn.dataset.phone) url.searchParams.set('phone', regBtn.dataset.phone);
        location.assign(url.toString());
      }
    }
  });

  // Controls and appointment state must exist before the initial fetch.
  if (isApptView) {void loadAppointments();window.addEventListener('focus',loadAppointments);}
})();
