// Stage 1 PMRS2 -> Borkeo import. Receives identity/address fields scraped from
// the PMRS2 patient page (by the Borkeo PMRS2 helper browser extension) and
// pre-fills the Borkeo registration form. It NEVER signs in to PMRS2, never
// saves the patient, and never stores PMRS2 credentials. Staff review the filled
// form, resolve any duplicate, and press Save themselves.

const PROVINCES_URLS = ['/data/gazetteer/provinces.json', '/public/data/gazetteer/provinces.json'];

// NFC-normalise, drop zero-width marks and collapse whitespace so a bare PMRS2
// province name matches the gazetteer entry (which carries a prefix) by containment.
export function normalizeKh(value) {
  return String(value ?? '').normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
}

// PMRS2 shows one full name; Borkeo splits family name (last) and given name
// (first). Khmer order is family name first. Staff can correct the split.
export function splitKhmerName(full) {
  const parts = normalizeKh(full).split(' ').filter(Boolean);
  if (!parts.length) return { lastName: '', firstName: '' };
  if (parts.length === 1) return { lastName: parts[0], firstName: '' };
  return { lastName: parts[0], firstName: parts.slice(1).join(' ') };
}

// Two-digit province code, left-padded, from a numeric or short gazetteer code.
export function padProvinceCode(code) {
  const digits = String(code ?? '').replace(/\D/g, '');
  return digits ? digits.padStart(2, '0').slice(-2) : '';
}

// Tolerant province match: either name contains the other after normalisation.
export function resolveProvince(name, provinces) {
  const target = normalizeKh(name);
  if (!target || !Array.isArray(provinces)) return null;
  return provinces.find((p) => {
    const local = normalizeKh(p.local || p.nameKh);
    return local && (local === target || local.includes(target) || target.includes(local));
  }) || null;
}

const REG = (id) => 'scope:registration:id:' + id;

// Build the recordData object that window.restorePatientAddress understands.
// Province is matched to a gazetteer code so the lower levels resolve by name.
export function buildAddressRecord(payload, provinceItem) {
  const record = {};
  if (provinceItem) {
    record[REG('web_province')] = provinceItem.local || provinceItem.nameKh || '';
    record[REG('web_province_code')] = padProvinceCode(provinceItem.code);
  } else if (payload.province) {
    record[REG('web_province')] = normalizeKh(payload.province);
  }
  if (payload.district) record[REG('web_district')] = normalizeKh(payload.district);
  if (payload.commune) record[REG('web_commune')] = normalizeKh(payload.commune);
  if (payload.village) record[REG('web_village')] = normalizeKh(payload.village);
  if (payload.street) record[REG('web_street_address')] = normalizeKh(payload.street);
  return record;
}

function setInput(doc, id, value) {
  const node = doc.getElementById(id);
  if (!node || value == null || value === '') return false;
  node.value = String(value);
  node.dispatchEvent(new Event('input', { bubbles: true }));
  node.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

// Set a radio by matching the PMRS2 text against each radio's own value, so no
// Khmer literal is hard-coded here.
function setRadioByValue(doc, name, value) {
  const target = normalizeKh(value);
  if (!target) return false;
  for (const radio of doc.querySelectorAll(`input[type="radio"][id="${name}"], input[type="radio"][name="${name}"]`)) {
    if (normalizeKh(radio.value) === target) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
      return true;
    }
  }
  return false;
}

// A read-only field (e.g. the PMRS2 case number) is set directly; it has no need
// to fire input/change handlers and staff cannot edit it.
function setReadOnly(doc, id, value) {
  const node = doc.getElementById(id);
  if (!node || value == null || value === '') return false;
  node.value = String(value);
  return true;
}

// Store the PMRS2 patient ID in the registration "other card" section: number,
// type "Other Card", issuer "PMRS2", and tick the "has other card" radio without
// opening its modal (we set .checked directly rather than firing its onchange).
function setOtherCard(doc, idNumber) {
  const number = normalizeKh(idNumber);
  if (!number) return false;
  const numberField = doc.getElementById('web_other_card_number');
  if (!numberField) return false;
  numberField.value = number;
  const typeField = doc.getElementById('web_other_card_type');
  if (typeField) typeField.value = '4. Other Card';
  const issuerField = doc.getElementById('web_other_card_issuer');
  if (issuerField) issuerField.value = 'PMRS2';
  const yes = doc.getElementById('other_id_yes');
  if (yes) yes.checked = true;
  const no = doc.getElementById('other_id_no');
  if (no) no.checked = false;
  if (typeof window !== 'undefined') { window.updateOtherIdPreview?.(); window.syncFields?.(); }
  return true;
}

function setSelectByValue(doc, id, value) {
  const node = doc.getElementById(id);
  const target = normalizeKh(value);
  if (!node || !target) return false;
  const option = [...node.options].find((o) => normalizeKh(o.value) === target || normalizeKh(o.textContent) === target);
  if (!option) return false;
  node.value = option.value;
  node.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

async function fetchProvinces() {
  for (const url of PROVINCES_URLS) {
    try {
      const res = await fetch(url, { cache: 'default' });
      if (res.ok) return await res.json();
    } catch { /* try next */ }
  }
  return [];
}

async function findDuplicates(payload) {
  // The PMRS2 ID lives in the other-card field, so match it with mode 'other'.
  const tries = [
    ['other', payload.healthId],
    ['phone', payload.phone],
    ['name', payload.fullName || [payload.lastName, payload.firstName].filter(Boolean).join(' ')],
  ];
  const seen = new Set();
  const matches = [];
  for (const [mode, raw] of tries) {
    const q = normalizeKh(raw);
    if (q.replace(/\s/g, '').length < 3) continue;
    try {
      const res = await fetch(`/api/emr-network/local-search?q=${encodeURIComponent(q)}&mode=${mode}`, { credentials: 'same-origin', cache: 'no-store' });
      if (!res.ok) continue;
      const data = await res.json();
      for (const patient of data.patients || []) {
        const key = patient.patientKey || patient.caseNumber || patient.healthId;
        if (key && !seen.has(key)) { seen.add(key); matches.push({ matchedBy: mode, patient }); }
      }
    } catch { /* ignore a failed lookup; staff still review */ }
  }
  return matches;
}

// Fill the registration form from a scraped PMRS2 payload. Returns a report of
// what was filled and any possible duplicates. Does not save.
export async function applyPmrs2Registration(payload, { doc = typeof document !== 'undefined' ? document : null } = {}) {
  if (!payload || !doc) return { filled: [], duplicates: [], addressResolved: false };
  const filled = [];
  const mark = (ok, field) => { if (ok) filled.push(field); };

  const name = (payload.firstName || payload.lastName)
    ? { lastName: normalizeKh(payload.lastName), firstName: normalizeKh(payload.firstName) }
    : splitKhmerName(payload.fullName);
  mark(setInput(doc, 'web_last_name', name.lastName), 'last_name');
  mark(setInput(doc, 'web_first_name', name.firstName), 'first_name');
  mark(setRadioByValue(doc, 'web_sex_male', payload.sex) || setRadioByValue(doc, 'web_sex_female', payload.sex), 'sex');
  mark(setInput(doc, 'web_dob', payload.dob), 'dob');
  if (!payload.dob) mark(setInput(doc, 'web_age', payload.age), 'age');
  mark(setInput(doc, 'web_phone', payload.phone), 'phone');
  mark(setInput(doc, 'web_equity', payload.equityCard), 'equity');
  // The PMRS2 patient ID goes into the "other card" slot (not the hospital's own
  // health-card field), so it can never collide with hospital numbering. The PMRS2
  // case number is kept separately in its own read-only field.
  mark(setOtherCard(doc, payload.healthId), 'pmrs2_id_card');
  mark(setReadOnly(doc, 'web_pmrs2_case_number', payload.caseNumber), 'pmrs2_case_number');
  mark(setSelectByValue(doc, 'web_entry_type', payload.entryType), 'entry_type');
  mark(setInput(doc, 'web_caregiver_name', payload.caregiverName), 'caregiver_name');
  mark(setInput(doc, 'web_caregiver_phone', payload.caregiverPhone), 'caregiver_phone');
  mark(setRadioByValue(doc, 'web_caregiver_sex_male', payload.caregiverSex) || setRadioByValue(doc, 'web_caregiver_sex_female', payload.caregiverSex), 'caregiver_sex');
  mark(setInput(doc, 'web_caregiver_relation', payload.caregiverRelation), 'caregiver_relation');

  let addressResolved = false;
  if (payload.province || payload.district || payload.commune || payload.village || payload.street) {
    const provinces = await fetchProvinces();
    const provinceItem = resolveProvince(payload.province, provinces);
    const record = buildAddressRecord(payload, provinceItem);
    if (typeof window !== 'undefined' && typeof window.restorePatientAddress === 'function') {
      try { await window.restorePatientAddress(record, () => true); addressResolved = true; } catch { /* staff pick manually */ }
    }
    mark(true, 'address');
  }

  const duplicates = await findDuplicates(payload);
  return { filled, duplicates, addressResolved };
}

if (typeof window !== 'undefined') {
  window.applyPmrs2Registration = applyPmrs2Registration;
  // The helper extension hands the scraped payload across page worlds by setting
  // this data attribute, then dispatches this event. We clear it after reading.
  document.addEventListener('borkeo:pmrs2-import', () => {
    const raw = document.documentElement.dataset.borkeoPmrs2Import || '';
    document.documentElement.removeAttribute('data-borkeo-pmrs2-import');
    if (!raw) return;
    const transferId = document.documentElement.getAttribute('data-borkeo-pmrs2-id');
    if (window.getLoadedEmrPatient?.()?.patientKey) {
      document.documentElement.setAttribute('data-borkeo-pmrs2-result', JSON.stringify({ id: transferId, ok: false, reason: 'record' }));
      return;
    }
    let payload;
    try { payload = JSON.parse(raw); } catch { return; }
    applyPmrs2Registration(payload).then((report) => {
      document.documentElement.setAttribute('data-borkeo-pmrs2-result', JSON.stringify({ id: transferId, ok: report.filled.length > 0, fields: report.filled.length, duplicates: report.duplicates.length, matches: report.duplicates.map(({patient}) => [patient.fullName || [patient.lastName, patient.firstName].filter(Boolean).join(' '), patient.caseNumber || patient.healthId].filter(Boolean).join(' - ')) }));
      document.dispatchEvent(new CustomEvent('borkeo:pmrs2-import-done', { detail: report }));
    }).catch(() => {
      document.documentElement.setAttribute('data-borkeo-pmrs2-result', JSON.stringify({ id: transferId, ok: false }));
    });
  });
  document.documentElement.setAttribute('data-borkeo-pmrs2-ready', '1');
}
