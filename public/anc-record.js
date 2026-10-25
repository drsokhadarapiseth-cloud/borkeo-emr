// v42.6 - The official ANC record page (/anc-record?patient=...).
// One record per pregnancy (linked to the Health ID), reused at every visit
// until delivery, referral to CPA3 or closing. Pages 2-5 of the Ministry of
// Health record, today's visit (Triage values imported, editable), the colour
// code with its history, the visit schedule and the "to do at this visit"
// panel, the referral to CPA3 and printing (A4 landscape).
import * as anc from '/public/anc-engine.mjs';
import { referralLetterHtml } from '/public/anc-referral-letter.mjs';

const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const english = () => window.getBorkeoLanguage?.() === 'en';
// New UI text: approved Khmer (public/new-text-data.js) or the English placeholder.
const t = (key, en) => (english() ? en : (window.newText ? window.newText(key, en) : en));
const patientKey = new URLSearchParams(window.location.search).get('patient') || '';
let cfg = null;          // GET /api/maternal/config
let data = null;         // GET /api/anc/record
let record = null;       // working copy of the record (pages 2-5)
let draft = {};          // today's visit
let prescription = [];   // today's prescription lines
let tasksShown = false;
let csrf = '';
let activeSection = 'visit';
const sections = () => [
  ['visit', t('anc.todayVisit', "Today's visit")], ['pregnancy', t('anc.sections.pregnancy', 'Pregnancy record')],
  ['tests', t('anc.sections.tests', 'Tests and ultrasound')], ['care', t('anc.sections.care', 'Care and treatment')],
  ['history', t('anc.sections.history', 'Visit history')], ['risk', t('anc.sections.risk', 'Risk assessment')],
  ['legacy', t('anc.sections.legacy', 'Previous ANC form')],
];
function selectSection(name, focus = false) {
  const available = [...document.querySelectorAll('[data-anc-section]')].map(node => node.dataset.ancSection);
  activeSection = available.includes(name) ? name : (available[0] || 'legacy');
  document.querySelectorAll('[data-anc-section]').forEach(node => { node.hidden = node.dataset.ancSection !== activeSection; });
  document.querySelectorAll('[data-anc-nav]').forEach(node => {
    const selected = node.dataset.ancNav === activeSection;
    node.setAttribute('aria-selected', String(selected)); node.tabIndex = selected ? 0 : -1;
    if (selected && focus) node.focus();
  });
}
function renderNavigation() {
  const host = $('anc-sections');
  host.setAttribute('aria-label', L().title);
  host.setAttribute('role', 'tablist');
  host.innerHTML = sections().filter(([name]) => document.querySelector(`[data-anc-section="${name}"]`)).map(([name, label]) =>
    `<button type="button" role="tab" id="anc-nav-${name}" data-anc-nav="${name}" aria-controls="anc-pane-${name}">${esc(label)}</button>`).join('');
  selectSection(activeSection);
}
const pane = (name, content) => `<div id="anc-pane-${name}" role="tabpanel" aria-labelledby="anc-nav-${name}" data-anc-section="${name}">${content}</div>`;
function legacySection() {
  const legacy = data.legacyAnc;
  return `<section class="anc-page anc-legacy"><h2>${esc(t('anc.sections.legacy', 'Previous ANC form'))}</h2>
    <p class="anc-hint">${esc(t('anc.legacyNotice', 'Saved values from this encounter are read only and are not copied into another pregnancy.'))}</p>
    <p>${esc(legacy?.caseNumber || '')} · ${esc(legacy?.date || '')}</p>
    ${legacy?.entries?.length ? `<dl class="anc-legacy-values">${legacy.entries.map(item => `<div><dt>${esc(item.label)}</dt><dd>${esc(item.value)}</dd></div>`).join('')}</dl>`
      : `<p>${esc(t('anc.legacyEmpty', 'No saved old ANC form for this encounter.'))}</p>`}</section>`;
}
function supplementalVisit() {
  const starts = [32, 34, 43, 44, 45, 47, 49, 51, 52, 53, 54];
  const fields = cfg.legacyFields || [];
  return `<section class="anc-page anc-supplemental"><h2>${esc(t('anc.extraVisit', 'Additional visit details'))}</h2><div class="anc-visit-grid">${starts.map(index => {
    const field = fields.find(item => item.key === `scope:medical:auto:${index}`);
    if (!field) return '';
    const value = draft.legacyDetails?.[index] || '';
    const options = field.type === 'radio' ? fields.filter(item => item.name === field.name).map(item => item.option) : field.options;
    const control = options ? `<select data-visit="legacyDetails.${index}"${canEdit() ? '' : ' disabled'}><option value=""></option>${options.map(option => `<option value="${esc(option)}"${value === option ? ' selected' : ''}>${esc(option)}</option>`).join('')}</select>`
      : vfield(`legacyDetails.${index}`, { type: field.type === 'date' ? 'date' : 'text' });
    return `<label>${esc(field.label)} ${control}</label>`;
  }).join('')}</div></section>`;
}

async function api(path, body) {
  if (body && !csrf) csrf = (await fetch('/api/auth/me', { credentials: 'same-origin', cache: 'no-store' }).then((r) => r.json())).csrfToken;
  const response = await fetch(path, body ? { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrf }, body: JSON.stringify(body) }
    : { credentials: 'same-origin', cache: 'no-store' });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const fallback = response.status === 409 ? t('anc.reloadConflict', 'The record changed or is closed. Reload it.')
      : response.status === 403 ? t('anc.accessDenied', 'You do not have permission for this action.') : t('anc.requestFailed', 'The request failed. Please try again.');
    throw Object.assign(new Error(english() ? result.error || fallback : fallback), { body: result, status: response.status });
  }
  return result;
}

const L = () => cfg.labels;
const setStatus = (text, error = false) => { const node = $('anc-status'); node.textContent = text || ''; node.dataset.state = error ? 'error' : 'ok'; };
const canEdit = () => Boolean(data?.canEdit && data?.pregnancy?.status === 'open');
const colourWord = (colour) => L().colours[colour] || colour;

// ---------------------------------------------------------------- paths
function getPath(object, path) {
  return path.split('.').reduce((value, key) => (value == null ? undefined : value[key]), object);
}
function setPath(object, path, value) {
  const keys = path.split('.');
  let node = object;
  keys.slice(0, -1).forEach((key, index) => {
    if (node[key] == null || typeof node[key] !== 'object') node[key] = key !== 'legacyDetails' && /^\d+$/.test(keys[index + 1]) ? [] : {};
    node = node[key];
  });
  node[keys[keys.length - 1]] = value;
}
const field = (path, { type = 'text', size = '', placeholder = '' } = {}) => {
  const value = getPath(record, path);
  if (type === 'checkbox') return `<input type="checkbox" data-path="${esc(path)}"${value ? ' checked' : ''}${canEdit() ? '' : ' disabled'}>`;
  return `<input type="${type}" data-path="${esc(path)}" value="${esc(value ?? '')}" class="anc-field ${size}" placeholder="${esc(placeholder)}"${canEdit() ? '' : ' disabled'}>`;
};
const choice = (path, value, label) => `<label class="anc-choice"><input type="radio" name="${esc(path)}" data-path="${esc(path)}" value="${esc(value)}"${getPath(record, path) === value ? ' checked' : ''}${canEdit() ? '' : ' disabled'}> ${esc(label)}</label>`;
const vfield = (key, { type = 'text', size = '' } = {}) => `<input type="${type}" data-visit="${esc(key)}" value="${esc(getPath(draft, key) ?? '')}" class="anc-field ${size}"${canEdit() ? '' : ' disabled'}>`;

// ---------------------------------------------------------------- status
function visitsWithDraft() {
  const saved = (data?.visits || []).filter((visit) => !(visit.date === data.today && visit.patientKey === patientKey));
  return [...saved, { ...draft, date: data.today, patientKey }].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}
function currentStatus() {
  const labs = [...(data.released?.labs || []), ...(record.labs || [])];
  return anc.ancStatus({ chart: cfg.chart, schedule: cfg.schedule, record: { ...record, labs }, visits: visitsWithDraft(), today: data.today, options: cfg.options });
}

// ---------------------------------------------------------------- top and summary
function renderTop(status) {
  $('anc-title').textContent = L().title;
  document.title = L().title;
  const colour = status?.colour || '';
  $('anc-colour-boxes').innerHTML = ['green', 'yellow', 'red'].map((key) => `<span class="anc-colour-box anc-box-${key}${colour === key ? ' is-ticked' : ''}" data-colour="${key}"><span class="anc-box" aria-hidden="true">${colour === key ? '✓' : ''}</span>${esc(colourWord(key))}</span>`).join('');
}

function renderSummary(status) {
  const host = $('anc-summary');
  if (!data.pregnancy) { host.innerHTML = ''; return; }
  const ga = status.ga ? `${status.ga.label} ${t('anc.weeks', 'weeks')}` : '—';
  const source = status.dating.source === 'ultrasound' ? t('anc.sourceUltrasound', 'from the dating ultrasound') : status.dating.source === 'lmp' ? t('anc.sourceLmp', 'from the last menstrual period') : '';
  const colourNote = status.colour === 'yellow' ? t('anc.yellowNote', 'ANC continues at Borkeo Referral Hospital (CPA2) - 8 visits')
    : status.colour === 'red' ? t('anc.redNote', 'Refer to the provincial hospital (CPA3) with a referral form signed by a doctor') : t('anc.greenNote', 'ANC with the midwife - 4 visits');
  const pendingReferral = (data.visits || []).find((visit) => visit.referral?.requestedAt && !visit.referral?.signed);
  const signedReferral = [...(data.visits || [])].reverse().find((visit) => visit.referral?.signed);
  const closed = data.pregnancy.status !== 'open' ? `<span class="anc-closed">${esc(t(`anc.status.${data.pregnancy.status}`, data.pregnancy.status))}</span>` : '';
  host.innerHTML = `
    <div class="anc-summary-line"><strong>${esc(data.patient.fullName)}</strong> · ${esc(data.patient.healthId || data.patient.caseNumber || '')} ${closed}</div>
    <div class="anc-summary-line">${esc(L().identity.edd)} <strong>${esc(status.dating.edd || '—')}</strong> <small>${esc(source)}</small> · ${esc(t('anc.ga', 'Gestational age'))} <strong>${esc(ga)}</strong></div>
    <div class="anc-colour-note anc-note-${esc(status.colour)}">${esc(colourNote)}${status.flags.includes('height-check') ? ` · ${esc(t('anc.heightCheck', 'Height under 145 cm: check'))}` : ''}</div>
    ${status.reasons.length ? `<ul class="anc-reasons">${status.reasons.map((reason) => `<li class="anc-reason-${esc(reason.level)}">${esc(reason.kh)}</li>`).join('')}</ul>` : ''}
    <div class="anc-actions no-print">
      ${data.canEdit && data.pregnancy.status !== 'open' && data.pregnancy.patientKey !== patientKey && !(data.visits || []).some(visit => visit.patientKey === patientKey) ? `<button type="button" data-action="open">${esc(t('anc.open', 'Open the ANC record'))}</button>` : ''}
      ${canEdit() ? `<button type="button" data-action="save-visit">${esc(t('anc.saveVisit', 'Save the visit'))}</button>` : ''}
      <button type="button" class="secondary" data-action="print">${esc(t('form.print', 'Print'))}</button>
      ${canEdit() && status.colour === 'red' && !pendingReferral ? `<button type="button" class="danger" data-action="referral">${esc(t('anc.requestReferral', 'Refer to CPA3 (doctor signs)'))}</button>` : ''}
      ${pendingReferral && data.canSignReferral ? `<button type="button" class="danger" data-action="sign">${esc(t('anc.signReferral', 'Sign the referral'))}</button>` : ''}
      ${pendingReferral && !data.canSignReferral ? `<span class="anc-pending">${esc(t('anc.referralPending', 'Referral waiting for a doctor signature'))}</span>` : ''}
      ${signedReferral ? `<button type="button" class="secondary" data-action="print-referral">${esc(t('anc.printReferral', 'Print the referral letter'))}</button>` : ''}
      ${canEdit() ? `<button type="button" class="secondary" data-action="close">${esc(t('anc.closeRecord', 'Close the record'))}</button>` : ''}
    </div>`;
}

// ---------------------------------------------------------------- page 2
function page2() {
  const l = L();
  const id = l.identity;
  const yesNo = (path) => `${choice(path, 'no', l.gyn.none)} ${choice(path, 'yes', l.gyn.yes)} ${field(`${path}Text`, { size: 'wide' })}`;
  const bmiValue = anc.bmi(record.prePregnancyWeightKg, record.heightCm);
  return `<section class="anc-page" data-page="2">
    <h2>${esc(l.title)}</h2>
    <div class="anc-box-panel anc-identity">
      <label>${esc(id.name)} ${field('identity.name', { size: 'wide' })}</label>
      <label>${esc(id.dateOfBirth)} ${field('identity.dateOfBirth', { type: 'date' })}</label>
      <label>${esc(id.age)} ${field('identity.age', { size: 'tiny' })}</label>
      <label>${esc(id.gravida)} ${field('identity.gravida', { size: 'tiny' })}</label>
      <label>${esc(id.births)} ${field('identity.births', { size: 'tiny' })}</label>
      <label>${esc(id.miscarriages)} ${field('identity.miscarriages', { size: 'tiny' })}</label>
      <label>${esc(id.abortions)} ${field('identity.abortions', { size: 'tiny' })}</label>
      <label>${esc(id.lmp)} ${field('lmp', { type: 'date' })}</label>
      <label>${esc(id.edd)} <output>${esc(anc.eddFromLmp(record.lmp) || '—')}</output></label>
      <label>${esc(id.eddUltrasound)} ${field('ultrasoundEdd', { type: 'date' })} <small>${esc(t('anc.scanDate', 'scan date'))}</small> ${field('ultrasoundDate', { type: 'date' })}</label>
      <label>${esc(id.height)} ${field('heightCm', { size: 'tiny' })} ${esc(id.heightUnit)}</label>
      <label>${esc(id.weightBefore)} ${field('prePregnancyWeightKg', { size: 'tiny' })} kg <small>${esc(record.prePregnancyWeightSource === 'triage' ? t('anc.fromTriage', 'from Triage') : '')}</small></label>
      <label>${esc(id.bmiBefore)} <output>${esc(bmiValue ?? '—')}</output> ${esc(id.bmiNormal)}</label>
    </div>
    <div class="anc-two">
      <div class="anc-box-panel">
        <p><strong>• ${esc(l.general.title)}</strong> ${Object.entries(l.general.items).map(([key, label]) => `<label class="anc-choice">${field(`history.general.${key}`, { type: 'checkbox' })} ${esc(label)}</label>`).join(' ')} ${field('history.general.other', { size: 'wide' })}</p>
        <p><strong>• ${esc(l.surgery.title)}</strong></p>
        ${l.surgery.numbers.map((number, index) => `<p class="anc-indent">${esc(number)} ${esc(l.surgery.diagnosis)} ${field(`history.surgery.${index}.diagnosis`, { size: 'wide' })} ${esc(l.surgery.year)} ${field(`history.surgery.${index}.year`, { size: 'tiny' })} ${esc(l.surgery.place)} ${field(`history.surgery.${index}.place`)}</p>`).join('')}
        <p><strong>• ${esc(l.allergy.title)}</strong></p>
        ${l.allergy.numbers.map((number, index) => `<p class="anc-indent">${esc(number)} ${esc(l.allergy.drug)} ${field(`history.allergy.${index}.drug`)} ${esc(l.allergy.symptom)} ${field(`history.allergy.${index}.symptom`, { size: 'wide' })}</p>`).join('')}
        <p class="anc-hint">${esc(t('anc.allergyLink', 'Drug allergies are also kept in the structured allergy record (patient banner).'))} ${(data.allergies || []).map((a) => esc(a)).join(', ')}</p>
        <p><strong>• ${esc(l.family.title)}</strong> ${Object.entries(l.family.items).map(([key, label]) => `<label class="anc-choice">${field(`history.family.${key}`, { type: 'checkbox' })} ${esc(label)}</label>`).join(' ')} ${field('history.family.otherText', { size: 'wide' })}</p>
        <p><strong>• ${esc(l.gyn.title)}</strong> ${esc(l.gyn.menses)} ${choice('history.gyn.menses', 'regular', l.gyn.regular)} ${choice('history.gyn.menses', 'irregular', l.gyn.irregular)}
          ${esc(l.gyn.cycle)} ${field('history.gyn.cycleDays', { size: 'tiny' })} ${esc(l.gyn.day)} ${esc(l.gyn.duration)} ${field('history.gyn.durationDays', { size: 'tiny' })}${esc(l.gyn.perMonth)}</p>
        <p class="anc-indent">${esc(l.gyn.contraception)} ${choice('history.gyn.contraception', 'no', l.gyn.none)} (${esc(l.gyn.reason)} ${field('history.gyn.contraceptionReason')}) ${choice('history.gyn.contraception', 'yes', l.gyn.yes)} ${field('history.gyn.contraceptionText')}</p>
        <p class="anc-indent">${esc(l.gyn.art)} ${choice('history.gyn.art', 'no', l.gyn.none)} ${choice('history.gyn.art', 'yes', l.gyn.yes)} ${esc(l.gyn.otherGyn)} ${field('history.gyn.otherGyn', { size: 'wide' })}</p>
      </div>
      <div>
        <div class="anc-box-panel">
          <p><strong>• ${esc(l.social.title)}</strong> ${['smoking', 'alcohol', 'drugs'].map((key) => `<label class="anc-choice">${field(`history.social.${key}`, { type: 'checkbox' })} ${esc(l.social[key])}</label>`).join(' ')} ${field('history.social.other')}</p>
          <p><strong>• ${esc(l.violence.title)}</strong> ${yesNo('history.violence')}</p>
        </div>
        <div class="anc-box-panel">
          <p><strong>• ${esc(l.mouth.title)}</strong></p>
          ${['stomatitis', 'caries', 'breast'].map((key) => `<p class="anc-indent">${esc(l.mouth[key])} ${yesNo(`history.mouth.${key}`)}</p>`).join('')}
          <p><strong>• ${esc(l.anaemia.title)}</strong></p>
          ${['eyelid', 'nails', 'palms'].map((key) => `<p class="anc-indent">${esc(l.anaemia[key])} ${yesNo(`history.anaemia.${key}`)}</p>`).join('')}
        </div>
      </div>
    </div>
    ${previousTable()}
  </section>`;
}

function previousTable() {
  const p = L().previous;
  const rows = Array.from({ length: Math.max(5, (record.previous || []).length + 1) }, (_, index) => index);
  return `<div class="anc-box-panel"><h3>${esc(p.title)}</h3><div class="anc-table-wrap"><table class="anc-table">
    <thead><tr><th rowspan="2">${esc(p.number)}</th><th rowspan="2">${esc(p.date)}</th><th colspan="2">${esc(p.abortionGroup)}</th><th colspan="5">${esc(p.motherGroup)}</th><th colspan="4">${esc(p.babyGroup)}</th></tr>
    <tr><th>${esc(p.under12)}</th><th>${esc(p.over12)}</th><th>${esc(p.term)}</th><th>${esc(p.deliveryType)}</th><th>${esc(p.place)}</th><th>${esc(p.complications)}</th><th>${esc(p.healthProblems)}</th>
    <th>${esc(p.babyOutcome)}</th><th>${esc(p.sex)}</th><th>${esc(p.weight)}</th><th>${esc(p.babyProblems)}</th></tr></thead>
    <tbody>${rows.map((index) => `<tr><td>${index + 1}</td><td>${field(`previous.${index}.date`, { type: 'date' })}</td>
      <td>${field(`previous.${index}.under12`, { type: 'checkbox' })}</td><td>${field(`previous.${index}.over12`, { type: 'checkbox' })}</td>
      <td>${field(`previous.${index}.term`, { size: 'small' })}</td>
      <td><select data-path="previous.${index}.deliveryType"${canEdit() ? '' : ' disabled'}>${['', 'normal', 'caesarean', 'vacuum'].map((value) => `<option value="${value}"${getPath(record, `previous.${index}.deliveryType`) === value ? ' selected' : ''}>${esc(value ? t(`anc.delivery.${value}`, value) : '')}</option>`).join('')}</select></td>
      <td>${field(`previous.${index}.place`, { size: 'small' })}</td>
      <td>${field(`previous.${index}.complications`, { size: 'small', placeholder: '1-10' })}</td>
      <td>${field(`previous.${index}.healthProblems`, { size: 'small' })}</td>
      <td>${field(`previous.${index}.babyOutcome`, { size: 'small' })}</td><td>${field(`previous.${index}.sex`, { size: 'tiny' })}</td>
      <td>${field(`previous.${index}.weight`, { size: 'tiny' })}</td><td>${field(`previous.${index}.babyProblems`, { size: 'small' })}</td></tr>`).join('')}</tbody></table></div>
    <p class="anc-footnote">*${p.complicationList.map((item, index) => `${index + 1}.${esc(item)}`).join(' ')}</p></div>`;
}

// ---------------------------------------------------------------- page 3
function labTable() {
  const l = L().labs;
  const released = data.released?.labs || [];
  const rapid = (data.visits || []).filter((visit) => visit.rapid && Object.values(visit.rapid).some(Boolean)).map((visit) => ({ date: visit.date, source: 'rapid', ...visit.rapid }));
  const typed = Array.from({ length: Math.max(4, (record.labs || []).length) }, (_, index) => index);
  const rows = [['hiv', l.hiv], ['syphilis', l.syphilis], ['hbsag', l.hbsag], ['hcv', l.hcv], ['hb', `${l.redCells} ${l.hb}`], ['hct', l.hct], ['plt', l.plt], ['group', l.group]];
  const freeLabels = record.labFreeLabels || [];
  const readCell = (column, key) => `<td class="anc-readonly anc-src-${esc(column.source)}">${esc(column[key] || '')}</td>`;
  return `<div class="anc-box-panel"><h3>${esc(l.title)}</h3><div class="anc-table-wrap"><table class="anc-table anc-lab-table">
    <tbody>
      <tr><th>${esc(l.date)}</th>${released.map((c) => readCell(c, 'date')).join('')}${rapid.map((c) => readCell(c, 'date')).join('')}${typed.map((i) => `<td>${field(`labs.${i}.date`, { type: 'date' })}</td>`).join('')}</tr>
      ${rows.map(([key, label]) => `<tr><th>${esc(label)}</th>${released.map((c) => readCell(c, key)).join('')}${rapid.map((c) => readCell(c, key)).join('')}${typed.map((i) => `<td>${field(`labs.${i}.${key}`, { size: 'small' })}</td>`).join('')}</tr>`).join('')}
      ${[0, 1, 2].map((n) => `<tr><th>${field(`labFreeLabels.${n}`, { placeholder: '…' })}</th>${released.map(() => '<td></td>').join('')}${rapid.map(() => '<td></td>').join('')}${typed.map((i) => `<td>${field(`labs.${i}.free${n}`, { size: 'small' })}</td>`).join('')}</tr>`).join('')}
    </tbody></table></div>
    ${freeLabels.length ? '' : ''}<p class="anc-hint">${esc(t('anc.labsHint', 'Released Laboratory results and the midwife\'s rapid tests are filled in automatically.'))}</p></div>`;
}

function ultrasoundTable() {
  const u = L().ultrasound;
  const released = data.released?.ultrasounds || [];
  const typed = Array.from({ length: Math.max(3, (record.ultrasounds || []).length + 1) }, (_, index) => index);
  return `<div class="anc-box-panel"><h3>${esc(u.title)}</h3><div class="anc-table-wrap"><table class="anc-table">
    <thead><tr>${u.columns.map((c) => `<th>${esc(english() ? c.en : c.kh)}</th>`).join('')}</tr></thead>
    <tbody>${released.map((row) => `<tr class="anc-readonly">${u.columns.map((c) => `<td>${esc(row[c.key] || '')}</td>`).join('')}</tr>`).join('')}
    ${typed.map((i) => `<tr>${u.columns.map((c) => `<td>${field(`ultrasounds.${i}.${c.key}`, { type: ['date', 'edd'].includes(c.key) ? 'date' : 'text', size: 'small' })}</td>`).join('')}</tr>`).join('')}</tbody></table></div></div>`;
}

function visitValue(visit, key, status) {
  if (key === 'date') return visit.date;
  if (key === 'ga') return visit.gaWeeks != null ? `${Math.floor(visit.gaWeeks)}+${Math.round((visit.gaWeeks % 1) * 7)}` : '';
  if (key === 'bp') return [visit.bp, visit.pulse].filter(Boolean).join(' - ');
  if (key === 'name') return visit.staffName || visit.createdBy || '';
  if (key === 'vaccination') return (data.vaccinations || []).filter((v) => v.givenDate === visit.date).map((v) => `TT${v.doseNumber}`).join(', ');
  if (key === 'wp') return visit.wp || weightGain(visit.weight);
  return visit[key] ?? '';
}
function weightGain(weight) {
  const before = Number(record.prePregnancyWeightKg), now = Number(weight);
  return before > 0 && now > 0 ? String(Math.round((now - before) * 10) / 10) : '';
}

function visitTable() {
  const columns = L().visits.columns;
  return `<div class="anc-box-panel"><div class="anc-table-wrap"><table class="anc-table anc-visit-table">
    <thead><tr>${columns.map((c) => `<th>${esc(english() ? c.en : c.kh)}</th>`).join('')}</tr></thead>
    <tbody>${(data.visits || []).map((visit) => `<tr class="${visit.referred ? 'anc-referred' : ''}">${columns.map((c) => `<td>${esc(visitValue(visit, c.key))}</td>`).join('')}</tr>`).join('')
      || `<tr><td colspan="${columns.length}">—</td></tr>`}</tbody></table></div></div>`;
}

// ---------------------------------------------------------------- today's visit
function visitForm(status) {
  const cols = Object.fromEntries(L().visits.columns.map((c) => [c.key, c]));
  const label = (key) => esc(english() ? cols[key].en : cols[key].kh);
  const imported = data.imported || {};
  const visitName = status.scheduled ? `${t('anc.visitOf', 'Visit')} ${status.visit.visit}/${status.visitsPlanned} · ${status.visit.label}` : t('anc.notScheduled', 'Not a scheduled visit');
  const ironOptions = (cfg.midwifeMedicines || []).map((item) => `<option value="${esc(item.id)}">${esc(item.label)}</option>`).join('');
  return `<section class="anc-page anc-visit" id="anc-visit-form">
    <h2>${esc(t('anc.todayVisit', "Today's visit"))} · ${esc(data.today)} · <span class="anc-visit-name">${esc(visitName)}</span></h2>
    <p class="anc-hint">${esc(t('anc.importedHint', 'Values from Registration and from Triage of this visit; the midwife can correct them (the Triage value stays saved).'))}
      ${esc([imported.weightKg && `${imported.weightKg} kg`, imported.bp && `${imported.bp} mmHg`, imported.pulse && `${imported.pulse}/min`, imported.temperature && `${imported.temperature} °C`, imported.spo2 && `SpO2 ${imported.spo2}%`].filter(Boolean).join(' · '))}</p>
    <div class="anc-visit-grid">
      <label>${label('weight')} ${vfield('weight', { size: 'small' })} kg</label>
      <label>${label('wp')} <output>${esc(weightGain(draft.weight) || '—')}</output></label>
      <label>${label('bp')} ${vfield('bp', { size: 'small' })} - ${vfield('pulse', { size: 'tiny' })}</label>
      <label>${esc(t('anc.temperature', 'Temperature'))} ${vfield('temperature', { size: 'tiny' })} °C</label>
      <label>SpO2 ${vfield('spo2', { size: 'tiny' })} %</label>
      <label>${label('uh')} ${vfield('uh', { size: 'tiny' })}</label>
      <label>${label('fp')} ${vfield('fp', { size: 'small' })}</label>
      <label>${label('fhr')} ${vfield('fhr', { size: 'tiny' })}</label>
      <label>${label('proteinuria')} ${vfield('proteinuria', { size: 'tiny' })}</label>
      <label>${label('glucosuria')} ${vfield('glucosuria', { size: 'tiny' })}</label>
      <label>${label('varices')} ${vfield('varices', { size: 'small' })}</label>
      <label>${label('fer')} ${vfield('fer', { size: 'tiny' })}</label>
    </div>
    <fieldset class="anc-rapid"><legend>${esc(t('anc.rapidTests', 'Rapid tests done by the midwife'))}</legend>
      <label>HIV ${rapidSelect('hiv')}</label><label>Syphilis ${rapidSelect('syphilis')}</label><label>Hb ${vfield('rapid.hb', { size: 'tiny' })} g/dL</label>
    </fieldset>
    <div class="anc-visit-grid wide">
      <label>${label('complaint')} ${vfield('complaint', { size: 'wide' })}</label>
      <label>${label('diagnosis')} ${vfield('diagnosis', { size: 'wide' })}</label>
      <label>${label('appointment')} ${vfield('appointment', { type: 'date' })} <small>${esc(t('anc.suggested', 'suggested'))}: ${esc(status.appointment || '—')}</small></label>
      <label>${label('name')} <output>${esc(window.emrSession?.user?.displayName || '')}</output></label>
    </div>
    <fieldset class="anc-rx"><legend>${esc(t('anc.prescription', 'Prescription (maternal services medicines)'))}</legend>
      <table class="anc-table"><tbody>${prescription.map((line, index) => `<tr><td>${esc(line.name)}</td><td><input class="anc-field tiny" data-rx="${index}" data-rx-key="doseAmount" value="${esc(line.doseAmount)}"> ${esc(line.unit)}</td>
        <td><select data-rx="${index}" data-rx-key="scheduleType">${['qd_m', 'bid', 'tid'].map((value) => `<option value="${value}"${line.scheduleType === value ? ' selected' : ''}>${value.toUpperCase().replace('_M', '')}</option>`).join('')}</select></td>
        <td><input class="anc-field tiny" data-rx="${index}" data-rx-key="d" value="${esc(line.d)}"> ${esc(t('anc.days', 'days'))}</td><td>${esc(rxTotal(line))}</td>
        <td><button type="button" class="link" data-rx-remove="${index}">✕</button></td></tr>`).join('')}</tbody></table>
      ${canEdit() ? `<select id="anc-rx-pick"><option value=""></option>${ironOptions}</select> <button type="button" class="secondary" data-action="rx-add">+</button>
        <button type="button" data-action="rx-send"${prescription.length ? '' : ' disabled'}>${esc(t('anc.sendPharmacy', 'Send to Pharmacy'))}</button>` : ''}
    </fieldset>
    ${canEdit() ? `<div class="anc-actions">
      <a class="secondary-link" href="/vaccination?patient=${encodeURIComponent(patientKey)}">${esc(t('anc.giveVaccine', 'Open the vaccination'))}</a></div>` : ''}
  </section>`;
}
function rapidSelect(key) {
  const value = getPath(draft, `rapid.${key}`) || '';
  return `<select data-visit="rapid.${key}"${canEdit() ? '' : ' disabled'}>${[['', ''], ['Negative', t('anc.negative', 'Negative')], ['Positive', t('anc.positive', 'Positive')]].map(([v, text]) => `<option value="${v}"${value === v ? ' selected' : ''}>${esc(text)}</option>`).join('')}</select>`;
}
const PER_DAY = { qd_m: 1, bid: 2, tid: 3 };
const rxTotal = (line) => { const total = Number(line.doseAmount) * (PER_DAY[line.scheduleType] || 1) * Number(line.d); return total > 0 ? String(total) : ''; };

// ---------------------------------------------------------------- colour chart and history
function chartSection(status) {
  const applied = new Set(status.reasons.map((reason) => reason.key));
  return `<section class="anc-page anc-chart"><h2>${esc(cfg.chart.title)}</h2>
    <div class="anc-chart-grid">${cfg.chart.sections.map((section) => `<div class="anc-box-panel"><h3>${esc(section.kh)}</h3>
      ${['green', 'yellow', 'red'].map((level) => `<div class="anc-chart-level anc-level-${level}"><strong>${esc(cfg.chart.levels[level])}</strong>
        ${section.items.filter((item) => item.level === level).map((item) => `<label class="anc-choice${applied.has(item.key) ? ' is-applied' : ''}">
          <input type="checkbox" data-path="ticks.${esc(item.key)}"${record.ticks?.[item.key] ? ' checked' : ''}${canEdit() ? '' : ' disabled'}> ${esc(item.kh)}${item.auto ? ` <small class="anc-auto">${esc(t('anc.auto', 'automatic'))}</small>` : ''}</label>`).join('')}</div>`).join('')}
    </div>`).join('')}</div></section>`;
}

function historySection() {
  const history = data.colourHistory || [];
  return `<section class="anc-page anc-history"><h2>${esc(t('anc.colourHistory', 'Colour changes'))}</h2>
    <ul>${history.map((entry) => `<li><span class="anc-dot anc-${esc(entry.colour)}"></span> ${esc(new Date(entry.changedAt).toLocaleString())} · <strong>${esc(colourWord(entry.colour))}</strong> · ${esc(entry.changedBy)}
      ${entry.reasons.length ? `<br><small>${entry.reasons.map((reason) => esc(reason.kh)).join(' · ')}</small>` : ''}</li>`).join('') || '<li>—</li>'}</ul></section>`;
}

// ---------------------------------------------------------------- tasks
function taskButton(task) {
  if (!canEdit() || task.state || task.autoDone) return '';
  const action = task.action;
  if (action.startsWith('order:')) {
    const code = action.slice(6);
    const allowed = code === 'ULTRASOUND' ? cfg.options.midwifeImaging.includes('ULTRASOUND') : cfg.options.midwifeLabTests.includes(code);
    return allowed ? `<button type="button" class="link" data-order="${esc(code)}">${esc(code === 'ULTRASOUND' ? t('anc.orderUltrasound', 'Send to Imaging (pay at the Cashier)') : t('anc.orderLab', 'Send to the Laboratory (pay at the Cashier)'))}</button>`
      : `<button type="button" class="link" data-ask-doctor="${esc(code)}">${esc(t('anc.askDoctor', 'Ask a doctor to order'))}</button>`;
  }
  if (action.startsWith('own:')) return `<button type="button" class="link" data-focus="${esc(action.slice(4))}">${esc(t('anc.enterResult', 'Enter the result'))}</button>`;
  if (action === 'rx:iron') return `<button type="button" class="link" data-action="rx-iron">${esc(t('anc.addIron', 'Add to the prescription'))}</button>`;
  if (action === 'vaccine:tt') return `<a class="link" href="/vaccination?patient=${encodeURIComponent(patientKey)}&vaccine=tt">${esc(t('anc.giveVaccine', 'Open the vaccination'))}</a>`;
  return '';
}
function taskItem(task, overdue = false) {
  const state = task.state;
  const done = Boolean(state?.status === 'done' || task.autoDone);
  const closed = state?.status === 'closed';
  return `<li class="anc-task${done ? ' is-done' : ''}${closed ? ' is-closed' : ''}${overdue ? ' is-overdue' : ''}" data-task="${esc(task.key)}">
    <label><input type="checkbox" data-task-done="${esc(task.key)}"${done ? ' checked' : ''}${canEdit() && !task.autoDone ? '' : ' disabled'}> ${esc(task.text)}</label>
    ${closed ? `<small>${esc(state.reason)}${state.reasonText ? ` · ${esc(state.reasonText)}` : ''}</small>` : ''}
    <span class="anc-task-actions">${taskButton(task)}${canEdit() && !done && !closed ? `<button type="button" class="link" data-task-close="${esc(task.key)}">${esc(t('anc.closeUndone', 'Close without doing'))}</button>` : ''}
      ${canEdit() && (closed || state?.status === 'done') ? `<button type="button" class="link" data-task-reopen="${esc(task.key)}">${esc(t('anc.reopen', 'Reopen'))}</button>` : ''}</span></li>`;
}
function renderTasks(status) {
  const host = $('anc-tasks');
  if (!data.pregnancy) { host.innerHTML = ''; return; }
  const header = status.scheduled ? `${t('anc.visitOf', 'Visit')} ${status.visit.visit}/${status.visitsPlanned} · ${status.visit.label}` : t('anc.notScheduled', 'Not a scheduled visit');
  const next = status.next ? `${t('anc.nextVisit', 'Next scheduled visit')}: ${status.next.label} · ${status.appointment}` : '';
  const stateOf = (task) => ({ ...task, state: record.tasks?.[task.key] || null });
  const html = `
    <p class="anc-task-visit">${esc(header)}</p>${next ? `<p class="anc-task-next">${esc(next)}</p>` : ''}
    ${status.tasks.length ? `<ul class="anc-task-list">${status.tasks.map((task) => taskItem(stateOf(task))).join('')}</ul>` : ''}
    ${status.overdue.length ? `<h3 class="anc-overdue-title">${esc(t('anc.overdue', 'Overdue from earlier visits'))}</h3><ul class="anc-task-list">${status.overdue.map((task) => taskItem(stateOf(task), true)).join('')}</ul>` : ''}`;
  const wasClosed = host.querySelector('details')?.open === false;
  host.innerHTML = `<details class="anc-task-disclosure"${wasClosed ? '' : ' open'}><summary id="anc-tasks-title">${esc(t('anc.todo', 'To do at this visit'))} <span class="anc-task-count">${status.tasks.filter(task => task.autoDone || record.tasks?.[task.key]?.status === 'done').length}/${status.tasks.length}</span></summary><div>${html}</div></details>`;
  // v43.1: tasks stay inline; opening a patient never launches a blocking modal.
  tasksShown = true;
}

// ---------------------------------------------------------------- render all
function renderMain() {
  const main = $('anc-main');
  if (!data.pregnancy) {
    main.innerHTML = pane('pregnancy', `<section class="anc-page"><p>${esc(t('anc.noRecord', 'No ANC record for this pregnancy yet.'))}</p>
      ${data.canEdit ? `<button type="button" data-action="open">${esc(t('anc.open', 'Open the ANC record'))}</button>` : ''}</section>`) + pane('legacy', legacySection());
    renderNavigation();
    return;
  }
  const status = currentStatus();
  main.innerHTML = `${data.pregnancy.status === 'open' ? pane('visit', visitForm(status)) : ''}${pane('pregnancy', page2())}
    ${pane('tests', `<section class="anc-page" data-page="3">${labTable()}${ultrasoundTable()}</section>`)}
    ${pane('care', supplementalVisit())}${pane('history', `<section class="anc-page" id="anc-visit-history">${visitTable()}</section>${historySection()}`)}
    ${pane('risk', chartSection(status))}${pane('legacy', legacySection())}`;
  const rapid = main.querySelector('.anc-rapid'), rx = main.querySelector('.anc-rx');
  if (rapid) main.querySelector('#anc-pane-tests > section').prepend(rapid);
  if (rx) main.querySelector('#anc-pane-care > section').append(rx);
  renderNavigation();
}
function refreshLive() {
  if (!data?.pregnancy) { renderTop(null); return; }
  const status = currentStatus();
  renderTop(status);
  renderSummary(status);
  renderTasks(status);
  document.querySelectorAll('.anc-visit-name').forEach((node) => { node.textContent = status.scheduled ? `${t('anc.visitOf', 'Visit')} ${status.visit.visit}/${status.visitsPlanned} · ${status.visit.label}` : t('anc.notScheduled', 'Not a scheduled visit'); });
}
function renderAll() { renderMain(); refreshLive(); }

// Today's visit starts from the saved visit of today, or from Triage.
function startDraft() {
  const saved = (data.visits || []).find((visit) => visit.date === data.today && visit.patientKey === patientKey);
  const imported = data.imported || {};
  draft = saved ? { ...saved } : { weight: imported.weightKg, bp: imported.bp, pulse: imported.pulse, temperature: imported.temperature, spo2: imported.spo2, rapid: {}, imported };
  if (!draft.rapid) draft.rapid = {};
  // Weight before pregnancy: from Triage at a first visit before 12 weeks.
  const status = data.status;
  if (record && !record.prePregnancyWeightKg && imported.weightKg && status?.ga && status.ga.weeks < (cfg.options.prePregnancyWeightFromTriageMaxWeeks || 12) && !(data.visits || []).length) {
    record.prePregnancyWeightKg = imported.weightKg;
    record.prePregnancyWeightSource = 'triage';
  }
  if (record && !record.heightCm && imported.heightCm) record.heightCm = imported.heightCm;
  if (!draft.appointment && status?.appointment) draft.appointment = status.appointment;
}

async function load() {
  try {
    if (!cfg) cfg = await api('/api/maternal/config');
    data = await api(`/api/anc/record?patientKey=${encodeURIComponent(patientKey)}`);
    record = data.pregnancy ? JSON.parse(JSON.stringify(data.pregnancy.record || {})) : null;
    if (record) startDraft();
    renderAll();
    setStatus('');
  } catch (error) { setStatus(error.message, true); }
}

// ---------------------------------------------------------------- events
document.addEventListener('input', (event) => {
  const target = event.target;
  if (target.dataset.path && record) {
    setPath(record, target.dataset.path, target.type === 'checkbox' ? target.checked : target.value);
    if (target.dataset.path === 'prePregnancyWeightKg') record.prePregnancyWeightSource = 'typed';
    refreshLive();
  } else if (target.dataset.visit) {
    setPath(draft, target.dataset.visit, target.value);
    refreshLive();
  } else if (target.dataset.rx !== undefined) {
    prescription[Number(target.dataset.rx)][target.dataset.rxKey] = target.value;
  }
});
document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.type === 'radio' && target.dataset.path && record) { setPath(record, target.dataset.path, target.value); refreshLive(); }
  if (target.tagName === 'SELECT' && target.dataset.path && record) { setPath(record, target.dataset.path, target.value); refreshLive(); }
  if (target.tagName === 'SELECT' && target.dataset.visit) { setPath(draft, target.dataset.visit, target.value); refreshLive(); }
  if (target.tagName === 'SELECT' && target.dataset.rx !== undefined) { prescription[Number(target.dataset.rx)][target.dataset.rxKey] = target.value; renderMain(); }
});

const body = (extra = {}) => ({ patientKey, ...extra });
let busy = false;
async function run(action) {
  if (busy) return;
  busy = true;
  const buttons = [...document.querySelectorAll('.anc-actions button:not(:disabled)')];
  buttons.forEach(button => { button.disabled = true; });
  setStatus('…');
  try { await action(); setStatus(t('anc.saved', 'Saved.')); } catch (error) { setStatus(error.message, true); }
  finally { busy = false; buttons.forEach(button => { button.disabled = false; }); }
}

function addLine(item) {
  if (!item) return;
  const unit = window.BorkeoMedicine?.optionUnit?.(item) || item.unit;
  prescription.push({ name: item.label, cmsCode: item.code || '', unit, route: 'po', doseAmount: '1', scheduleType: 'qd_m', d: '30', m: '', a: '', e: '', n: '', note: '' });
  renderMain();
}

function closeDialog(event) {
  const dialog = event.target.closest('dialog');
  dialog?.close();
}

function askCloseReason(key) {
  const dialog = $('anc-close-dialog');
  const reasons = cfg.options.taskCloseReasons;
  dialog.innerHTML = `<form method="dialog" class="anc-dialog-body"><h3>${esc(t('anc.closeUndone', 'Close without doing'))}</h3>
    ${reasons.map((reason, index) => `<label class="anc-choice"><input type="radio" name="anc-close-reason" value="${esc(reason)}"${index === 0 ? ' checked' : ''}> ${esc(reason)}</label>`).join('<br>')}
    <p><input type="text" class="anc-field wide" name="anc-close-text" maxlength="500" placeholder="${esc(t('anc.reason', 'Reason'))}"></p>
    <p class="anc-error" role="status"></p>
    <div class="anc-actions"><button type="button" class="secondary" data-dialog-close>${esc(t('drugSafety.cancel', 'Cancel'))}</button><button type="submit">${esc(t('drugSafety.save', 'Save'))}</button></div></form>`;
  dialog.querySelector('form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const reason = dialog.querySelector('input[name="anc-close-reason"]:checked')?.value || '';
    const reasonText = dialog.querySelector('input[name="anc-close-text"]').value.trim();
    try {
      const result = await api(`/api/anc/record/${data.pregnancy.id}/task`, body({ key, action: 'close', reason, reasonText }));
      record.tasks = result.pregnancy.record.tasks;
      data.pregnancy = result.pregnancy;
      dialog.close();
      refreshLive();
    } catch (error) { dialog.querySelector('.anc-error').textContent = error.message; }
  });
  dialog.showModal();
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('button, a.link');
  if (!button) return;
  if (button.dataset.ancNav) { selectSection(button.dataset.ancNav); return; }
  if (button.hasAttribute('data-dialog-close')) { closeDialog(event); return; }
  const action = button.dataset.action;
  const id = data?.pregnancy?.id;
  if (action === 'open') return run(async () => { await api('/api/anc/record/open', body()); await load(); });
  if (action === 'save-record') return run(async () => {
    const result = await api(`/api/anc/record/${id}/save`, body({ record, expectedVersion: data.pregnancy.version }));
    data.pregnancy = result.pregnancy; data.colourHistory = result.colourHistory; data.status = result.status;
    record = JSON.parse(JSON.stringify(result.pregnancy.record)); renderAll();
  });
  if (action === 'save-visit') return run(async () => {
    const status = currentStatus();
    const visit = { ...draft, wp: weightGain(draft.weight), notScheduled: !status.scheduled };
    delete visit.id;
    await api(`/api/anc/record/${id}/save-all`, body({ record, visit, expectedVersion: data.pregnancy.version }));
    await load();
  });
  if (action === 'print') { printRecord(); return; }
  if (action === 'print-referral') { printReferral(); return; }
  if (action === 'referral') return run(async () => {
    const treatment = window.prompt(t('anc.treatmentGiven', 'Treatment given before the referral')) ?? '';
    await api(`/api/anc/record/${id}/referral`, body({ treatment }));
    await load();
  });
  if (action === 'sign') return run(async () => { await api(`/api/anc/record/${id}/sign`, body()); await load(); });
  if (action === 'close') return run(async () => {
    const delivered = window.confirm(t('anc.closeDelivered', 'Has the woman delivered? OK = delivered, Cancel = close for another reason'));
    const reason = delivered ? '' : (window.prompt(t('anc.reason', 'Reason')) || '');
    if (!delivered && !reason) return;
    await api(`/api/anc/record/${id}/close`, body({ status: delivered ? 'delivered' : 'closed', reason }));
    await load();
  });
  if (action === 'rx-add') { addLine((cfg.midwifeMedicines || []).find((item) => String(item.id) === $('anc-rx-pick').value)); return; }
  if (action === 'rx-iron') {
    const name = cfg.options.ironPrescriptionMedicine;
    addLine((cfg.midwifeMedicines || []).find((item) => item.name === name && /tablet/i.test(item.form)) || (cfg.midwifeMedicines || []).find((item) => item.name === name));
    document.getElementById('anc-visit-form')?.scrollIntoView({ block: 'end' });
    return;
  }
  if (button.dataset.rxRemove !== undefined) { prescription.splice(Number(button.dataset.rxRemove), 1); renderMain(); return; }
  if (action === 'rx-send') return run(async () => {
    const medications = prescription.map((line) => ({ ...line, total: rxTotal(line) }));
    await api(`/api/anc/record/${id}/prescription`, body({ medications }));
    const tablets = medications.filter((line) => /ferrous|folic/i.test(line.name)).reduce((sum, line) => sum + Number(line.total || 0), 0);
    if (tablets) draft.fer = String(tablets);
    prescription = [];
    renderMain(); refreshLive();
  });
  if (button.dataset.order) return run(async () => {
    const code = button.dataset.order;
    const request = code === 'ULTRASOUND' ? { clinicalInfo: 'ANC', diagnosis: 'ANC' } : { items: [{ code }], clinicalInfo: 'ANC' };
    await api('/api/paraclinic/orders', body({ modality: code === 'ULTRASOUND' ? 'ULTRASOUND' : 'LAB', request, chargeMode: 'PAID', handoffMode: 'DIRECT' }));
    setStatus(t('anc.ordered', 'Sent. The patient pays at the Cashier.'));
  });
  if (button.dataset.askDoctor) return run(async () => { await api('/api/maternal/ask-doctor', body({ test: button.dataset.askDoctor })); });
  if (button.dataset.focus) {
    const map = { hiv: 'rapid.hiv', syphilis: 'rapid.syphilis', hb: 'rapid.hb', urine: 'proteinuria' };
    const input = document.querySelector(`[data-visit="${map[button.dataset.focus]}"]`);
    const section = input?.closest('[data-anc-section]')?.dataset.ancSection;
    if (section) selectSection(section);
    input?.scrollIntoView({ block: 'center' }); input?.focus();
    $('anc-tasks-dialog').close?.();
    return;
  }
  if (button.dataset.taskClose) { askCloseReason(button.dataset.taskClose); return; }
  if (button.dataset.taskReopen) return run(async () => {
    const result = await api(`/api/anc/record/${id}/task`, body({ key: button.dataset.taskReopen, action: 'reopen' }));
    record.tasks = result.pregnancy.record.tasks; refreshLive();
  });
});
document.addEventListener('change', async (event) => {
  const key = event.target.dataset.taskDone;
  if (!key) return;
  try {
    const result = await api(`/api/anc/record/${data.pregnancy.id}/task`, body({ key, action: event.target.checked ? 'done' : 'reopen' }));
    record.tasks = result.pregnancy.record.tasks;
    refreshLive();
  } catch (error) { setStatus(error.message, true); }
});

// ---------------------------------------------------------------- print
function printRecord() {
  const status = currentStatus();
  const header = `<header class="anc-print-head"><img src="/public/logo-hospital.jpg" alt=""><h1>${esc(L().title)}</h1>
    <div class="anc-colour-boxes">${['green', 'yellow', 'red'].map((key) => `<span class="anc-colour-box anc-box-${key}"><span class="anc-box">${status.colour === key ? '✓' : ''}</span>${esc(colourWord(key))}</span>`).join('')}</div></header>`;
  const footer = `<footer class="anc-print-foot">${esc(L().footer)}</footer>`;
  const snapshot = $('anc-main').cloneNode(true);
  snapshot.querySelectorAll('.anc-visit, .anc-chart, .anc-history, .anc-hint, .anc-rapid').forEach((node) => node.remove());
  const visitHistory = snapshot.querySelector('#anc-visit-history .anc-box-panel');
  if (visitHistory) snapshot.querySelector('[data-page="3"]')?.append(visitHistory);
  snapshot.querySelectorAll('input').forEach((input) => {
    const span = document.createElement('span');
    span.className = 'anc-print-value';
    span.textContent = input.type === 'checkbox' || input.type === 'radio' ? (input.checked ? '☑' : '☐') : input.value;
    input.replaceWith(span);
  });
  snapshot.querySelectorAll('select').forEach((select) => { const span = document.createElement('span'); span.textContent = select.selectedOptions[0]?.textContent || ''; select.replaceWith(span); });
  const pages = Array.from(snapshot.querySelectorAll('.anc-page[data-page]')).map((page) => `<div class="anc-print-page">${header}${page.innerHTML}${footer}</div>`).join('');
  $('anc-print').innerHTML = pages;
  document.body.classList.add('anc-printing');
  window.addEventListener('afterprint', () => document.body.classList.remove('anc-printing'), { once: true });
  window.print();
}

function printReferral() {
  const visit = [...(data.visits || [])].reverse().find((item) => item.referral?.signed);
  if (!visit) return;
  const status = currentStatus();
  $('anc-print').innerHTML = referralLetterHtml({ data, record, visit, status, labels: L(), t, esc });
  document.body.classList.add('anc-printing', 'anc-printing-letter');
  window.addEventListener('afterprint', () => document.body.classList.remove('anc-printing', 'anc-printing-letter'), { once: true });
  window.print();
}

window.addEventListener('borkeo-language-change', () => data && renderAll());
document.addEventListener('keydown', event => {
  if (!event.target.matches('[data-anc-nav]') || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  const tabs = [...document.querySelectorAll('[data-anc-nav]')], index = tabs.indexOf(event.target);
  const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length;
  selectSection(tabs[next].dataset.ancNav, true);
});
load();
