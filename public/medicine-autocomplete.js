/*! Borkeo medicine search (v42.3) - dependency-free, in-memory search of the
 *  Cambodia Essential Medicines List (704 items, under 1 ms per keystroke).
 *  Based on the owner's medicine-autocomplete.js; adapted to the EMR:
 *  - the list is loaded once from GET /api/medicines/catalogue (login needed);
 *  - styles live in /public/medicine-autocomplete.css (no inline style element);
 *  - choosing a medicine fills "CMS code-Name-Form-Strength", clears the
 *    number of medicine, sets the unit and fires the existing row handlers;
 *  - the route is never filled; free text stays allowed.
 *  Works for rows added later (event delegation). */
(function (root) {
  'use strict';
  var DATA = [], READY = false, LOADING = false, queue = [], active = null;
  var DATA_URL = '/api/medicines/catalogue';

  // Medicine name boxes of every prescription form (EMR.html rows and the
  // discharge medicines in emr-inpatient-workflow.js).
  var INPUT_SELECTOR = '.rx-name, .mrx-name, .orx-name, .prx-name, .mprx-name, #emr-discharge-rx-body [data-med="name"]';

  // Catalogue unit -> unit option value (owner's rules, v42.3).
  var UNIT_OPTION = { 'mg': 'mg', 'mL': 'mL', 'mcg': 'mcg', 'g': 'g', 'IU': 'IU', 'mmol': 'mmol',
    'គ្រាប់': 'គ្រាប់', 'កញ្ចប់': 'កញ្ចប់', 'ដំណក់': 'ដំណក់', 'ដង': 'បាញ់', 'ក្រាម': 'g', 'ដុំ': 'ដុំ' };

  function optionUnit(item) {
    var unit = String(item && item.unit || '');
    return UNIT_OPTION[unit] || unit;
  }

  function english() {
    try { return typeof root.getBorkeoLanguage === 'function' && root.getBorkeoLanguage() === 'en'; } catch (e) { return false; }
  }

  function norm(s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); }
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

  function load(items) {
    DATA = items.map(function (m) {
      m._code = norm(m.code); m._name = norm(m.name);
      m._words = norm(m.name + ' ' + m.form + ' ' + m.strength).split(/[^a-z0-9µ.%+]+/).filter(Boolean);
      m._key = norm(m.code + ' ' + m.name + ' ' + m.form + ' ' + m.strength);
      return m;
    });
    READY = true; queue.splice(0).forEach(function (f) { f(); });
  }

  function ensureData() {
    if (READY || LOADING) return;
    LOADING = true;
    fetch(DATA_URL, { credentials: 'same-origin', cache: 'force-cache' })
      .then(function (r) { if (!r.ok) throw new Error('catalogue ' + r.status); return r.json(); })
      .then(function (body) { load(body.items || []); })
      .catch(function () { LOADING = false; queue.length = 0; });
  }

  // Score: lower = better. Every typed token must match; null = no match.
  function search(query, max) {
    var q = norm(query); if (q.length < 2) return [];
    var toks = q.split(' '), out = [];
    for (var i = 0; i < DATA.length; i++) {
      var m = DATA[i], score = 0, ok = true;
      for (var t = 0; t < toks.length; t++) {
        var tk = toks[t], s;
        if (m._code && m._code.indexOf(tk) === 0) s = 0;
        else if (m._name.indexOf(tk) === 0) s = 1;
        else if (m._words.some(function (w) { return w.indexOf(tk) === 0; })) s = t === 0 ? 2 : 1;
        else if (tk.length >= 3 && m._key.indexOf(tk) > -1) s = 4;
        else { ok = false; break; }
        score += s;
      }
      if (ok) out.push([score, m]);
    }
    out.sort(function (a, b) { return a[0] - b[0] || (a[1]._name < b[1]._name ? -1 : a[1]._name > b[1]._name ? 1 : 0) || a[1].id - b[1].id; });
    return out.slice(0, max || 12).map(function (x) { return x[1]; });
  }

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

  function openList(input) {
    var res = search(input.value, 12);
    closeList();
    if (input.value.trim().length < 2) return;
    var el = document.createElement('div'); el.className = 'bk-med-list no-print'; el.setAttribute('role', 'listbox');
    el.setAttribute('data-language-exclude', '');
    place(el, input);
    if (!res.length) el.innerHTML = '<div class="bk-med-empty">' + (english() ? 'No matching medicine' : 'រកមិនឃើញឱសថ') + '</div>';
    else el.innerHTML = res.map(function (m, i) {
      return '<div class="bk-med-item' + (i === 0 ? ' on' : '') + '" role="option" data-i="' + i + '">' +
        '<span class="bk-med-label">' + highlight(m.label, input.value) + '</span>' +
        '<span class="bk-med-unit">' + esc(optionUnit(m)) + '</span></div>';
    }).join('');
    document.body.appendChild(el);
    active = { el: el, input: input, res: res, idx: res.length ? 0 : -1 };
    el.addEventListener('mousedown', function (e) {
      var it = e.target.closest('.bk-med-item'); if (!it) return;
      e.preventDefault(); choose(res[+it.dataset.i], input);
    });
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
    if (parts.qty) parts.qty.value = '';            // number of medicine: blank by default
    setUnit(parts.unit, optionUnit(m));
    fire(input, 'change');
    if (parts.qty) fire(parts.qty, 'input');         // totals, legacy fields, nursing orders
    input.dispatchEvent(new CustomEvent('medicine:selected', { bubbles: true, detail: m }));
    closeList();
    if (parts.qty) parts.qty.focus();
  }

  function init() {
    document.addEventListener('input', function (e) {
      var target = e.target;
      if (!target || !target.matches || !target.matches(INPUT_SELECTOR)) return;
      // Typed by hand: no longer the chosen list medicine (free text is allowed).
      delete target.dataset.cmsCode;
      delete target.dataset.medicineId;
      ensureData();
      var go = function () { if (document.activeElement === target) openList(target); };
      READY ? go() : queue.push(go);
    });
    document.addEventListener('keydown', function (e) {
      if (!active || !e.target.matches || !e.target.matches(INPUT_SELECTOR)) return;
      if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter' && active.idx > -1) { e.preventDefault(); choose(active.res[active.idx], active.input); }
      else if (e.key === 'Escape') { e.preventDefault(); closeList(); }
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

  root.BorkeoMedicine = { search: search, load: load, optionUnit: optionUnit, choose: choose, INPUT_SELECTOR: INPUT_SELECTOR };
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();
  }
})(typeof window !== 'undefined' ? window : globalThis);
