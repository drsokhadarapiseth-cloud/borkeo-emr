/*! Borkeo medicine search (v42.5) - dependency-free, in-memory search of the
 *  Cambodia Essential Medicines List (704 lines, 339 medicine names).
 *  - the list is loaded once from GET /api/medicines/catalogue (login needed);
 *  - styles live in /public/medicine-autocomplete.css (no inline style element);
 *  - TWO STEPS: step 1 shows each matching medicine NAME once (name, other
 *    names, CMS code); step 2 shows the forms and strengths of that name
 *    ("CMS code · Form · Strength") allowed for the open patient, with any
 *    note as an orange line. A single allowed line is chosen automatically.
 *    A full CMS code (e.g. AA0410) goes straight to that line.
 *  - patient filter (age, sex, ward, service, pregnancy): see allowed();
 *    it never changes a saved prescription;
 *  - choosing fills "CMS code-Name-Form-Strength", clears the number of
 *    medicine, sets the unit and fires the existing row handlers;
 *  - the route is never filled; free text stays allowed.
 *  Works for rows added later (event delegation). */
(function (root) {
  'use strict';
  var DATA = [], NAMES = [], BY_NAME = {}, BY_LABEL = {}, READY = false, LOADING = false, queue = [], active = null;
  var DATA_URL = '/api/medicines/catalogue';
  var PAEDIATRIC_MAX_AGE = 14;      // server/clinical-options.json displayRules.paediatricMaxAge
  var FEMALE_MIN_AGE = 15;          // femaleOnly lines: women from 15 years
  var NEONATE_MAX_DAYS = 28;        // neonateOnly lines: babies under 28 days
  var CHILD_WARDS = ['pediatric', 'ncu'];
  var WOMEN_WARDS = ['obstetric', 'gynecology', 'gyneco-obstetric'];
  var WOMEN_SERVICES = ['anc', 'pnc', 'family-planning'];

  // Medicine name boxes of every prescription form (EMR.html rows and the
  // discharge medicines in emr-inpatient-workflow.js).
  var INPUT_SELECTOR = '.rx-name, .mrx-name, .orx-name, .prx-name, .mprx-name, #emr-discharge-rx-body [data-med="name"]';

  // Catalogue unit -> unit option value (owner's rules).
  var UNIT_OPTION = { 'mg': 'mg', 'mL': 'mL', 'mcg': 'mcg', 'g': 'g', 'IU': 'IU', 'mmol': 'mmol',
    'គ្រាប់': 'គ្រាប់', 'កញ្ចប់': 'កញ្ចប់', 'ដំណក់': 'ដំណក់', 'បាញ់': 'បាញ់', 'ដង': 'បាញ់', 'ក្រាម': 'g', 'ដុំ': 'ដុំ' };

  function optionUnit(item) {
    var unit = String(item && item.unit || '');
    return UNIT_OPTION[unit] || unit;
  }

  function english() {
    try { return typeof root.getBorkeoLanguage === 'function' && root.getBorkeoLanguage() === 'en'; } catch (e) { return false; }
  }

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function codesOf(item) { return String(item && item.code || '').split(/[,;\s]+/).map(function (c) { return c.trim().toLowerCase(); }).filter(Boolean); }

  function load(items) {
    DATA = items.map(function (m) {
      m._codes = codesOf(m);
      m._name = norm(m.name);
      return m;
    });
    BY_NAME = {}; BY_LABEL = {}; NAMES = [];
    DATA.forEach(function (m) {
      BY_LABEL[norm(m.label)] = m;
      var entry = BY_NAME[m._name];
      if (!entry) {
        entry = BY_NAME[m._name] = { name: m.name, key: m._name, items: [], synonyms: [], codes: [] };
        NAMES.push(entry);
      }
      entry.items.push(m);
      (m.synonyms || []).forEach(function (s) { if (entry.synonyms.indexOf(norm(s)) < 0) entry.synonyms.push(norm(s)); });
      m._codes.forEach(function (c) { if (entry.codes.indexOf(c) < 0) entry.codes.push(c); });
    });
    // Words of the name and other names; "co-trimoxazole" is also "cotrimoxazole".
    NAMES.forEach(function (entry) {
      var text = entry.key + ' ' + entry.synonyms.join(' ');
      entry.words = text.split(/[^a-z0-9µ.%]+/).concat(text.replace(/-/g, '').split(/[^a-z0-9µ.%]+/)).filter(Boolean);
    });
    READY = true; queue.splice(0).forEach(function (f) { f(); });
    // The nursing chart orders IV fluids and antibiotics by the list (EMR.html).
    if (typeof root.dispatchEvent === 'function' && typeof CustomEvent === 'function') root.dispatchEvent(new CustomEvent('borkeo-medicines-ready'));
  }

  function ensureData() {
    if (READY || LOADING) return;
    LOADING = true;
    // The app version in the address: a new list is fetched after an update.
    var meta = document.querySelector('meta[name="borkeo-version"]');
    fetch(DATA_URL + (meta && meta.content ? '?v=' + encodeURIComponent(meta.content) : ''), { credentials: 'same-origin', cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error('catalogue ' + r.status); return r.json(); })
      .then(function (body) { load(body.items || []); })
      .catch(function () { LOADING = false; queue.length = 0; });
    // Child age limit as set in server/clinical-options.json (displayRules.paediatricMaxAge).
    fetch('/api/clinical-options', { credentials: 'same-origin', cache: 'no-store' })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (body) {
        var max = body && body.displayRules && Number(body.displayRules.paediatricMaxAge);
        if (isFinite(max) && max > 0) PAEDIATRIC_MAX_AGE = max;
      })
      .catch(function () { /* keep 14 */ });
  }

  // ---------------------------------------------------------------- patient filter
  // ctx = { ageYears, ageDays, sex: 'female'|'male'|'', wards: [codes], services: [codes],
  //         pregnant: bool, allowedNames: [lower-case names] | null (midwife services) }
  function isChild(ctx) {
    if (!ctx) return null;
    if ((ctx.wards || []).some(function (w) { return CHILD_WARDS.indexOf(w) > -1; })) return true;
    if (ctx.ageYears === null || ctx.ageYears === undefined || !isFinite(ctx.ageYears)) return null;
    return ctx.ageYears <= (ctx.paediatricMaxAge !== undefined ? ctx.paediatricMaxAge : PAEDIATRIC_MAX_AGE);
  }

  function knownAge(ctx) { return ctx && ctx.ageYears !== null && ctx.ageYears !== undefined && isFinite(ctx.ageYears); }

  function femaleAllowed(ctx) {
    if (!ctx || ctx.sex === 'male') return !ctx;
    if (ctx.sex !== 'female') return true;                 // sex unknown: shown
    if (!knownAge(ctx) || ctx.ageYears >= FEMALE_MIN_AGE) return true;
    if (ctx.pregnant) return true;
    if ((ctx.wards || []).some(function (w) { return WOMEN_WARDS.indexOf(w) > -1; })) return true;
    return (ctx.services || []).some(function (s) { return WOMEN_SERVICES.indexOf(s) > -1; });
  }

  function neonateAllowed(ctx) {
    if (!ctx) return true;
    if ((ctx.wards || []).indexOf('ncu') > -1) return true;
    if (ctx.ageDays !== null && ctx.ageDays !== undefined && isFinite(ctx.ageDays)) return ctx.ageDays < NEONATE_MAX_DAYS;
    return !knownAge(ctx);                                  // age unknown: shown
  }

  // Lines with an age or weight limit (childLimit, adultLimit) are shown with
  // the orange note, never hidden.
  function allowed(item, ctx) {
    if (!ctx) return true;
    if (ctx.allowedNames && ctx.allowedNames.indexOf(norm(item.name)) < 0) return false;
    if (item.femaleOnly) return femaleAllowed(ctx);
    if (item.neonateOnly) return neonateAllowed(ctx);
    var child = isChild(ctx);
    if (child === null) return true;                        // age unknown: everything
    return child ? item.child !== false : item.adult !== false;
  }

  // ---------------------------------------------------------------- search
  function exactCode(query) {
    var q = norm(query);
    if (!/^[a-z]{2}\d{4}$/.test(q)) return [];
    return DATA.filter(function (m) { return m._codes.indexOf(q) > -1; })
      .sort(function (a, b) { return (a._codes.length - b._codes.length) || a.id - b.id; });
  }

  // Step 1: each matching medicine name once. Every typed word must be the
  // start of the name, of a word of it or of another name, or of a CMS code
  // ("para" finds Paracetamol, not Asparaginase); lower score = better.
  function searchNames(query, ctx, max) {
    var q = norm(query); if (q.length < 2) return [];
    var toks = q.split(' '), out = [];
    NAMES.forEach(function (entry) {
      var score = 0;
      for (var t = 0; t < toks.length; t++) {
        var tk = toks[t], s;
        if (entry.key.indexOf(tk) === 0) s = 0;
        else if (entry.codes.some(function (c) { return c.indexOf(tk) === 0; })) s = 0;
        else if (entry.synonyms.some(function (syn) { return syn.indexOf(tk) === 0; })) s = 1;
        else if (entry.words.some(function (w) { return w.indexOf(tk) === 0; })) s = 2;
        else return;
        score += s;
      }
      if (ctx && !entry.items.some(function (m) { return allowed(m, ctx); })) return;
      out.push([score, entry]);
    });
    out.sort(function (a, b) { return a[0] - b[0] || (a[1].key < b[1].key ? -1 : a[1].key > b[1].key ? 1 : 0); });
    return out.slice(0, max || 12).map(function (x) { return x[1]; });
  }

  // Step 2: the forms and strengths of one name allowed for this patient.
  function formsFor(name, ctx) {
    var entry = BY_NAME[norm(name)];
    if (!entry) return [];
    return entry.items.filter(function (m) { return allowed(m, ctx); });
  }

  // v42.3 compatibility: plain line search (name, code, form, strength).
  function search(query, max) {
    var q = norm(query); if (q.length < 2) return [];
    var toks = q.split(' '), out = [];
    DATA.forEach(function (m) {
      var key = norm(m.code + ' ' + m.name + ' ' + (m.synonyms || []).join(' ') + ' ' + m.form + ' ' + m.strength);
      var words = key.split(/[^a-z0-9µ.%+]+/).filter(Boolean), score = 0;
      for (var t = 0; t < toks.length; t++) {
        var tk = toks[t], s;
        if (m._codes.some(function (c) { return c.indexOf(tk) === 0; })) s = 0;
        else if (m._name.indexOf(tk) === 0) s = 1;
        else if (words.some(function (w) { return w.indexOf(tk) === 0; })) s = t === 0 ? 2 : 1;
        else if (tk.length >= 3 && key.indexOf(tk) > -1) s = 4;
        else return;
        score += s;
      }
      out.push([score, m]);
    });
    out.sort(function (a, b) { return a[0] - b[0] || (a[1]._name < b[1]._name ? -1 : a[1]._name > b[1]._name ? 1 : 0) || a[1].id - b[1].id; });
    return out.slice(0, max || 12).map(function (x) { return x[1]; });
  }

  // The list line chosen for a saved medicine name (label) or CMS code.
  function lookup(label, cmsCode) {
    var byLabel = BY_LABEL[norm(label)];
    if (byLabel) return byLabel;
    var code = norm(cmsCode);
    if (!code) return null;
    return DATA.find(function (m) { return norm(m.code) === code; }) || null;
  }

  // Orange notes of a line: notes, children limit, adult limit (no repeats).
  function notesFor(item) {
    var kh = !english();
    var out = [];
    var add = function (text) { text = String(text || '').trim(); if (text && out.indexOf(text) < 0) out.push(text); };
    var childPrefix = kh ? 'កុមារ៖ ' : 'Children: ';
    var adultPrefix = kh ? 'មនុស្សពេញវ័យ៖ ' : 'Adults: ';
    (item.notes || []).forEach(function (note) { add(String(note).replace(/^Children:\s*/i, childPrefix)); });
    var joined = out.join(' ').toLowerCase();
    if (item.childLimit && joined.indexOf(String(item.childLimit).toLowerCase()) < 0) add(childPrefix + item.childLimit);
    if (item.adultLimit && joined.indexOf(String(item.adultLimit).toLowerCase()) < 0) add(adultPrefix + item.adultLimit);
    return out;
  }

  function formLine(item) { return [item.code, item.form, item.strength].filter(Boolean).join(' · '); }

  // ---------------------------------------------------------------- open patient
  function sexOf(value) {
    var text = String(value || '').trim().toLowerCase();
    if (value === 'ស្រី' || ['f', 'female', 'girl'].indexOf(text) > -1) return 'female';
    if (value === 'ប្រុស' || ['m', 'male', 'boy'].indexOf(text) > -1) return 'male';
    return '';
  }

  function ageDaysFromDob(value) {
    var parts = String(value || '').split('-');
    if (parts.length !== 3) return null;
    var dob = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (isNaN(dob.getTime())) return null;
    var days = Math.floor((Date.now() - dob.getTime()) / 86400000);
    return days >= 0 ? days : null;
  }

  // Age, sex, ward, service and pregnancy of the patient open in the page.
  function patientContext() {
    if (typeof document === 'undefined') return null;
    if (typeof root.BorkeoMedicinePatientContext === 'function') return root.BorkeoMedicinePatientContext();
    var patient = (typeof root.getLoadedEmrPatient === 'function' && root.getLoadedEmrPatient()) || {};
    var age = typeof root.getExactAge === 'function' ? root.getExactAge() : null;
    var ageYears = age && isFinite(age.years) && age.years !== null ? age.years : (isFinite(parseFloat(patient.age)) ? Math.floor(parseFloat(patient.age)) : null);
    var dob = document.getElementById('web_dob');
    var ageDays = ageDaysFromDob(dob && dob.value);
    if (ageDays === null && age && isFinite(age.totalMonths) && age.totalMonths !== null) ageDays = Math.floor(age.totalMonths * 30.4375);
    var sexRadio = document.querySelector('input[name="sex_radio"]:checked');
    var path = typeof root.getEmrCarePath === 'function' ? (root.getEmrCarePath() || {}) : {};
    var codes = [patient.departmentCode, path.code].concat((path.selected || []).map(function (s) { return s && s.code; })).filter(Boolean);
    var edd = document.getElementById('ipd_obgyn_edd');
    var pregnant = Boolean(edd && edd.value) || (typeof root.BorkeoPatientIsPregnant === 'function' && Boolean(root.BorkeoPatientIsPregnant()));
    return {
      ageYears: ageYears, ageDays: ageDays,
      sex: sexOf(sexRadio ? sexRadio.value : patient.sex),
      wards: codes, services: codes, pregnant: pregnant,
      paediatricMaxAge: PAEDIATRIC_MAX_AGE,
      allowedNames: typeof root.BorkeoMedicineAllowedNames === 'function' ? root.BorkeoMedicineAllowedNames() : null
    };
  }

  // ---------------------------------------------------------------- list UI
  function highlight(text, query) {
    var toks = norm(query).split(' ').filter(Boolean), out = esc(text);
    toks.forEach(function (tk) {
      var re = new RegExp('(' + tk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig');
      out = out.replace(/(<[^>]+>)|([^<]+)/g, function (_, tag, txt) { return tag || txt.replace(re, '<mark>$1</mark>'); });
    });
    return out;
  }

  function closeList() { if (active && active.el.parentNode) active.el.parentNode.removeChild(active.el); active = null; }

  // The list sits under its name box; it follows the box when the page or a
  // table scrolls and closes only when the box leaves the screen.
  function place(el, input) {
    var r = input.getBoundingClientRect();
    el.style.left = Math.max(4, Math.min(r.left, window.innerWidth - 444)) + 'px';
    el.style.top = (r.bottom + 4) + 'px';
    el.style.width = Math.max(r.width, 420) + 'px';
    return r.bottom > 0 && r.top < window.innerHeight;
  }

  function shell(input) {
    closeList();
    var el = document.createElement('div'); el.className = 'bk-med-list no-print'; el.setAttribute('role', 'listbox');
    el.setAttribute('data-language-exclude', '');
    place(el, input);
    document.body.appendChild(el);
    el.addEventListener('mousedown', function (e) {
      var it = e.target.closest('.bk-med-item'); if (!it || !active) return;
      e.preventDefault(); pick(+it.dataset.i);
    });
    return el;
  }

  function emptyLine() { return '<div class="bk-med-empty">' + (english() ? 'No matching medicine' : 'រកមិនឃើញឱសថ') + '</div>'; }

  // Step 1: names.
  function openNames(input) {
    if (input.value.trim().length < 2) { closeList(); return; }
    var ctx = patientContext();
    var direct = exactCode(input.value).filter(function (m) { return allowed(m, ctx); });
    if (direct.length) { openForms(input, direct[0].name, direct, input.value); return; }
    var res = searchNames(input.value, ctx, 12);
    var el = shell(input);
    el.innerHTML = res.length ? res.map(function (entry, i) {
      var other = entry.synonyms.length ? '<span class="bk-med-syn">' + esc(entry.synonyms.join(', ')) + '</span>' : '';
      return '<div class="bk-med-item bk-med-name' + (i === 0 ? ' on' : '') + '" role="option" data-i="' + i + '">' +
        '<span class="bk-med-label">' + highlight(entry.name, input.value) + '</span>' + other + '</div>';
    }).join('') : emptyLine();
    active = { el: el, input: input, step: 1, res: res, idx: res.length ? 0 : -1, query: input.value };
  }

  // Step 2: forms and strengths of one name.
  function openForms(input, name, lines, query) {
    var ctx = patientContext();
    var res = lines || formsFor(name, ctx);
    if (res.length === 1 && !lines) { choose(res[0], input); return; }
    var el = shell(input);
    el.innerHTML = '<div class="bk-med-head">' + esc(name) + '</div>' + (res.length ? res.map(function (m, i) {
      var notes = notesFor(m).map(function (n) { return '<span class="bk-med-note">⚠ ' + esc(n) + '</span>'; }).join('');
      return '<div class="bk-med-item bk-med-form' + (i === 0 ? ' on' : '') + '" role="option" data-i="' + i + '">' +
        '<span class="bk-med-label">' + esc(formLine(m)) + notes + '</span>' +
        '<span class="bk-med-unit">' + esc(optionUnit(m)) + '</span></div>';
    }).join('') : emptyLine());
    active = { el: el, input: input, step: 2, res: res, idx: res.length ? 0 : -1, query: query !== undefined ? query : input.value, name: name };
  }

  function pick(index) {
    if (!active || index < 0 || !active.res[index]) return;
    if (active.step === 1) openForms(active.input, active.res[index].name, null, active.query);
    else choose(active.res[index], active.input);
  }

  function move(d) {
    if (!active || !active.res.length) return;
    var items = active.el.querySelectorAll('.bk-med-item');
    items[active.idx].classList.remove('on');
    active.idx = (active.idx + d + items.length) % items.length;
    items[active.idx].classList.add('on'); items[active.idx].scrollIntoView({ block: 'nearest' });
  }

  function fire(el, type) { if (el) el.dispatchEvent(new Event(type, { bubbles: true })); }

  function setUnit(control, unit) {
    if (!control || !unit) return;
    if (control.tagName === 'SELECT') {
      var found = Array.prototype.some.call(control.options, function (o) { return o.value === unit; });
      if (!found) control.add(new Option(unit, unit));
      control.value = unit;
    } else {
      control.value = unit;
    }
    fire(control, 'input');
    fire(control, 'change');
  }

  function rowParts(input) {
    var row = input.closest('tr') || input.parentElement;
    if (input.matches('[data-med="name"]')) {
      return { row: row, qty: row.querySelector('[data-med="doseAmount"]'), unit: row.querySelector('[data-med="unit"]') };
    }
    var prefix = (/\b(rx|mrx|orx|prx|mprx)-name\b/.exec(input.className) || [])[1] || 'rx';
    return { row: row, qty: row.querySelector('.' + prefix + '-dose'), unit: row.querySelector('.' + prefix + '-unit') };
  }

  function choose(m, input) {
    var parts = rowParts(input);
    input.value = m.label;
    input.dataset.cmsCode = m.code || '';
    input.dataset.medicineId = String(m.id);
    delete input.dataset.doseReason;
    if (parts.qty) parts.qty.value = '';            // number of medicine: blank by default
    setUnit(parts.unit, optionUnit(m));
    closeList();
    fire(input, 'change');
    if (parts.qty) fire(parts.qty, 'input');         // totals, legacy fields, nursing orders
    input.dispatchEvent(new CustomEvent('medicine:selected', { bubbles: true, detail: m }));
    if (parts.qty) parts.qty.focus();
  }

  function init() {
    document.addEventListener('emr:patient-loaded', ensureData);
    root.addEventListener('borkeo-medicines-ready', function () {
      if (typeof root.syncNursingMedicationOrders === 'function') { try { root.syncNursingMedicationOrders(); } catch (e) { /* chart not open */ } }
    });
    document.addEventListener('input', function (e) {
      var target = e.target;
      if (!target || !target.matches || !target.matches(INPUT_SELECTOR)) return;
      // Typed by hand: no longer the chosen list medicine (free text is allowed).
      delete target.dataset.cmsCode;
      delete target.dataset.medicineId;
      delete target.dataset.doseReason;
      ensureData();
      var go = function () { if (document.activeElement === target) openNames(target); };
      READY ? go() : queue.push(go);
    });
    document.addEventListener('keydown', function (e) {
      if (!active || !e.target.matches || !e.target.matches(INPUT_SELECTOR)) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && active.idx > -1) { e.preventDefault(); pick(active.idx); }
      else if (e.key === 'Escape') { e.preventDefault(); closeList(); }
      else if (e.key === 'Backspace' && active.step === 2) {
        // Back to the list of names for what was typed.
        e.preventDefault();
        var input = active.input;
        input.value = active.query;
        openNames(input);
      }
    });
    // Close only the list of the box that lost focus (moving to another name box
    // must not close the list just opened there).
    document.addEventListener('focusout', function (e) {
      var target = e.target;
      if (!target.matches || !target.matches(INPUT_SELECTOR)) return;
      setTimeout(function () { if (active && active.input === target && document.activeElement !== target) closeList(); }, 120);
    });
    window.addEventListener('scroll', function (e) {
      if (!active || active.el.contains(e.target)) return;
      if (!place(active.el, active.input)) closeList();
    }, true);
    window.addEventListener('resize', function () { if (active && !place(active.el, active.input)) closeList(); });
  }

  root.BorkeoMedicine = {
    search: search, searchNames: searchNames, formsFor: formsFor, exactCode: exactCode, allowed: allowed,
    isChild: isChild, notesFor: notesFor, formLine: formLine, lookup: lookup, load: load, ensureData: ensureData,
    ready: function () { return READY; }, optionUnit: optionUnit, choose: choose, patientContext: patientContext,
    INPUT_SELECTOR: INPUT_SELECTOR
  };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
