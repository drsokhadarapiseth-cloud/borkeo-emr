// Reads patient fields off the current PMRS2 page. PMRS2 shows some pages as
// fillable forms and others (the patient summary) as plain text with a caption
// beside each value, so this reads BOTH: a form control next to a caption, or the
// text value shown next to it. Selectors are heuristic; if a field comes back
// empty on the real site, adjust the caption in pmrs2-fields.js. Pure reading only.

function pmrs2Norm(value) {
  return String(value == null ? '' : value).normalize('NFC').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
}

// Drop a trailing colon or Khmer colon (U+17C8) and asterisk from a caption.
function stripColon(text) {
  return pmrs2Norm(text).replace(/[\s*:\uff1a\u17c8]+$/g, '');
}

// Drop a leading colon/Khmer colon that sits between a caption and its value.
function stripLead(text) {
  return pmrs2Norm(text).replace(/^[\s:\uff1a\u17c8]+/g, '');
}

function controlValue(node) {
  if (!node) return '';
  if (node.tagName === 'SELECT') {
    const opt = node.options[node.selectedIndex];
    return pmrs2Norm(opt ? opt.textContent : node.value);
  }
  if (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA') {
    if (node.type === 'radio' || node.type === 'checkbox') return node.checked ? pmrs2Norm(node.value) : '';
    return pmrs2Norm(node.value);
  }
  return pmrs2Norm(node.textContent);
}

function checkedRadioText(container) {
  const checked = container.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
  if (!checked) return '';
  const label = checked.closest('label') || container.querySelector('label[for="' + checked.id + '"]');
  return pmrs2Norm(label ? label.textContent : checked.value);
}

// A form control that belongs to a caption element (editable PMRS2 pages).
function controlForLabel(doc, labelEl) {
  const forId = labelEl.getAttribute && labelEl.getAttribute('for');
  if (forId) {
    const byFor = doc.getElementById(forId);
    if (byFor) return byFor;
  }
  const group = labelEl.closest('.input-group, .form-group, .form-item, .col, .field');
  if (group) {
    if (group.querySelector('input[type="radio"], input[type="checkbox"]')) return { radioGroup: group };
    const control = group.querySelector('input:not([type="hidden"]), select, textarea');
    if (control) return control;
  }
  let sib = labelEl.nextElementSibling;
  for (let i = 0; sib && i < 3; i++) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(sib.tagName)) return sib;
    const nested = sib.querySelector && sib.querySelector('input:not([type="hidden"]), select, textarea');
    if (nested) return nested;
    sib = sib.nextElementSibling;
  }
  return null;
}

// Cut a value string at the start of the next caption, so a run-together line like
// "Name value NextCaption nextValue" keeps only "value".
function cutAtNextCaption(text, captions) {
  let cut = text.length;
  for (const cap of captions) {
    if (!cap) continue;
    const idx = text.indexOf(cap, 1);
    if (idx > 0 && idx < cut) cut = idx;
  }
  return pmrs2Norm(text.slice(0, cut)).replace(/[,:\uff1a\u17c8\s]+$/g, '');
}

// Read the text value shown next to a caption, for read-only summary pages.
function textValueNear(doc, labelEl, caption, captions) {
  // 0. Value inside the same element, right after the caption.
  const own = stripColon(labelEl.textContent);
  if (own.length > caption.length && own.startsWith(caption)) {
    const rest = cutAtNextCaption(stripLead(own.slice(caption.length)), captions);
    if (rest) return rest;
  }
  // a. Consecutive text nodes immediately after the caption element.
  let run = '';
  let sib = labelEl.nextSibling;
  while (sib && sib.nodeType === 3) { run += sib.textContent; sib = sib.nextSibling; }
  run = cutAtNextCaption(stripLead(run), captions);
  if (run) return run;
  // b. A table cell: caption cell -> next cell.
  const cell = labelEl.closest && labelEl.closest('td, th');
  if (cell && cell.nextElementSibling) {
    const v = stripLead(cell.nextElementSibling.textContent);
    if (v) return cutAtNextCaption(v, captions);
  }
  // c. The next element sibling holds the value.
  let el = labelEl.nextElementSibling;
  for (let i = 0; el && i < 2; i++) {
    if (!/^(INPUT|SELECT|TEXTAREA|BR)$/.test(el.tagName)) {
      const v = stripLead(el.textContent);
      const norm = stripColon(v);
      if (v && !captions.includes(norm)) return cutAtNextCaption(v, captions);
    }
    el = el.nextElementSibling;
  }
  // d. The parent holds "caption value" as its whole text.
  const parent = labelEl.parentElement;
  if (parent) {
    const pown = stripColon(parent.textContent);
    const lab = stripColon(labelEl.textContent);
    if (pown.startsWith(lab) && pown.length > lab.length) {
      const rest = cutAtNextCaption(stripLead(pown.slice(lab.length)), captions);
      if (rest) return rest;
    }
  }
  return '';
}

// Find a caption element whose text matches one of the given captions.
function findLabel(doc, captions) {
  const wanted = captions.map(stripColon);
  const nodes = doc.querySelectorAll('label, .form-label, .field-label, th, td, dt, b, strong, span, p, div');
  for (const el of nodes) {
    const text = stripColon(el.textContent);
    if (!text || text.length > 48) continue;
    if (wanted.some((w) => text === w || text.startsWith(w))) return el;
  }
  return null;
}

function scrapeField(doc, field, captions) {
  const labelEl = findLabel(doc, field.labels);
  if (!labelEl) return '';
  const control = controlForLabel(doc, labelEl);
  if (control) {
    if (control.radioGroup) return checkedRadioText(control.radioGroup);
    const v = controlValue(control);
    if (v) return v;
  }
  return textValueNear(doc, labelEl, stripColon(field.labels[0]), captions);
}

// Build the Borkeo payload from the live PMRS2 page.
function scrapePmrs2(doc, fields) {
  const list = fields || (typeof PMRS2_FIELDS !== 'undefined' ? PMRS2_FIELDS : []);
  const captions = [];
  for (const f of list) for (const l of f.labels) captions.push(stripColon(l));
  const payload = {};
  for (const field of list) {
    const value = scrapeField(doc, field, captions);
    if (value) payload[field.key] = value;
  }
  return payload;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrapePmrs2, pmrs2Norm, controlValue, stripColon };
}
