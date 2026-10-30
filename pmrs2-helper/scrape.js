// Reads patient fields off the current PMRS2 page by matching each label to the
// nearest form control. PMRS2 renders its form with JavaScript, so this runs on
// the live page. Selectors are heuristic; if a field comes back empty on the real
// site, adjust the label in pmrs2-fields.js or the lookup below. Pure DOM reading
// only — nothing is submitted.

function pmrs2Norm(value) {
  return String(value == null ? '' : value).normalize('NFC').replace(/[​-‍﻿]/g, '').replace(/\s+/g, ' ').trim();
}

// The value a control currently holds, whether input, select or a shown value.
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

// For a radio group, return the checked option's visible label text.
function checkedRadioText(container) {
  const checked = container.querySelector('input[type="radio"]:checked, input[type="checkbox"]:checked');
  if (!checked) return '';
  const label = checked.closest('label') || container.querySelector('label[for="' + checked.id + '"]');
  return pmrs2Norm(label ? label.textContent : checked.value);
}

// Find the control that belongs to a label element.
function controlForLabel(doc, labelEl) {
  const forId = labelEl.getAttribute && labelEl.getAttribute('for');
  if (forId) {
    const byFor = doc.getElementById(forId);
    if (byFor) return byFor;
  }
  // Search the label's own group container, then the label's following siblings.
  const group = labelEl.closest('.input-group, .form-group, .form-item, .col, .field, div');
  if (group) {
    if (group.querySelector('input[type="radio"], input[type="checkbox"]')) {
      return { radioGroup: group };
    }
    const control = group.querySelector('input:not([type="hidden"]), select, textarea');
    if (control) return control;
  }
  let sib = labelEl.nextElementSibling;
  while (sib) {
    if (/^(INPUT|SELECT|TEXTAREA)$/.test(sib.tagName)) return sib;
    const nested = sib.querySelector && sib.querySelector('input:not([type="hidden"]), select, textarea');
    if (nested) return nested;
    sib = sib.nextElementSibling;
  }
  return null;
}

// Locate a label element whose text matches one of the given captions.
function findLabel(doc, captions) {
  const wanted = captions.map(pmrs2Norm);
  const candidates = doc.querySelectorAll('label, .form-label, .field-label, th, dt, span, p');
  for (const el of candidates) {
    const text = pmrs2Norm(el.textContent).replace(/[*:：]\s*$/, '').trim();
    if (!text || text.length > 40) continue;
    if (wanted.some((w) => text === w || text.startsWith(w))) return el;
  }
  return null;
}

function scrapeField(doc, field) {
  const labelEl = findLabel(doc, field.labels);
  if (!labelEl) return '';
  const control = controlForLabel(doc, labelEl);
  if (!control) return '';
  if (control.radioGroup) return checkedRadioText(control.radioGroup);
  return controlValue(control);
}

// Build the Borkeo payload from the live PMRS2 page.
function scrapePmrs2(doc, fields) {
  const list = fields || (typeof PMRS2_FIELDS !== 'undefined' ? PMRS2_FIELDS : []);
  const payload = {};
  for (const field of list) {
    const value = scrapeField(doc, field);
    if (value) payload[field.key] = value;
  }
  return payload;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { scrapePmrs2, pmrs2Norm, controlValue };
}
