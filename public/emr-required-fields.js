'use strict';

(function requiredFieldsForEveryWorkspace() {
  const installed = new WeakSet();
  const controls = 'input:not([type="button"]):not([type="submit"]):not([type="reset"]),select,textarea,[contenteditable="true"]';
  const star = /[*＊✱∗]/u;
  const message = 'សូមបំពេញព័ត៌មានដែលមានសញ្ញា * ឱ្យបានគ្រប់ មុនបន្ត។';
  const marked = new WeakMap();

  function visible(element) {
    if (!element || element.closest('[hidden],[inert],dialog:not([open])')) return false;
    const frame = element.ownerDocument.defaultView.frameElement;
    if (frame && !visible(frame)) return false;
    const style = element.ownerDocument.defaultView.getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse' && element.getClientRects().length > 0;
  }

  function visualControl(field) {
    const selector = field.getAttribute('data-required-proxy');
    if (selector) { try { return field.ownerDocument.querySelector(selector); } catch { return null; } }
    if (field.tagName === 'SELECT' && field.closest('.emr-nat-wrapper')) {
      return field.closest('.emr-nat-wrapper').querySelector('.emr-nat-btn');
    }
    return field.type === 'hidden' ? null : field;
  }

  function applicable(field) {
    return !field.matches(':disabled') && !field.closest('[inert]') && visible(visualControl(field));
  }

  function fieldList(root) {
    if (root.tagName === 'FORM') return Array.from(root.elements).filter(field => field.matches(controls));
    return [ ...(root.matches?.(controls) ? [root] : []), ...root.querySelectorAll(controls) ].filter(field => {
      const island = field.closest('[data-required-island]');
      return !island || island === root || island.contains(root);
    });
  }

  // Resolve visual asterisks at action time, so dynamic and conditional forms
  // need no document-wide mutation observer or persistent required rewrites.
  function fieldsForLabel(label) {
    const ids = label.getAttribute('data-required-for');
    if (ids) return ids.split(/\s+/).map(id => label.ownerDocument.getElementById(id)).filter(Boolean);
    if (label.control) return [label.control];
    const nested = fieldList(label);
    if (nested.length) return nested;
    const group = label.closest('.input-group,.form-group,.form-field,.field,td');
    if (group) return fieldList(group);
    // A sibling container may hold a radio group or a custom select. Stop at
    // the next label instead of marking unrelated fields in the same row.
    let sibling = label.nextElementSibling;
    while (sibling && !sibling.matches('label,legend,.field-label,.required-star')) {
      const fields = fieldList(sibling);
      if (fields.length) return fields;
      sibling = sibling.nextElementSibling;
    }
    return [];
  }

  function requiredGroups(scope) {
    const groups = [];
    const scopedFields = fieldList(scope);
    const within = new Set(scopedFields);
    for (const field of scopedFields.filter(field => field.matches('[required],[aria-required="true"],[data-emr-required]'))) {
      if (field.matches(controls) && applicable(field)) groups.push([field]);
    }
    const labels = new Set([...scope.querySelectorAll('label,legend,.field-label,.required-star,[data-required-for],span,sup'),
      ...scopedFields.flatMap(field => Array.from(field.labels || []))]);
    for (const label of labels) {
      if (!visible(label) || !star.test(label.textContent)) continue;
      const caption = label.cloneNode(true);
      caption.querySelectorAll('input,select,textarea,button,[contenteditable="true"],.emr-nat-popover').forEach(value => value.remove());
      if (!star.test(caption.textContent)) continue;
      // Plain spans qualify only as a standalone star. This excludes clinical
      // footnotes, risk legends and headings that happen to contain an asterisk.
      if (!label.matches('label,legend,.field-label,.required-star,[data-required-for]') && !/^[*＊✱∗]$/u.test(label.textContent.trim())) continue;
      if (label.closest('label,.field-label,[data-required-for]') !== label && label.closest('label,.field-label,[data-required-for]')) continue;
      const fields = fieldsForLabel(label).filter(field => within.has(field) && applicable(field));
      if (fields.length) groups.push(fields);
    }
    return groups;
  }

  function filled(field) {
    if (field.type === 'checkbox' || field.type === 'radio') return field.checked;
    if (field.type === 'file') return Boolean(field.files?.length);
    if (field.tagName === 'SELECT' && field.multiple) return Array.from(field.selectedOptions).some(option => option.value.trim());
    const value = field.isContentEditable ? field.textContent : field.value;
    return String(value ?? '').replace(/[\u200B-\u200D\uFEFF]/g, '').trim().length > 0;
  }

  function clearField(field) {
    const visual = visualControl(field);
    if (!visual || !marked.has(visual)) return;
    const previous = marked.get(visual);
    if (previous === null) visual.removeAttribute('aria-invalid');
    else visual.setAttribute('aria-invalid', previous);
    visual.classList.remove('emr-required-missing');
    marked.delete(visual);
  }

  function validate(scope) {
    if (!scope) return true;
    fieldList(scope).forEach(clearField);
    const missing = new Set();
    for (const fields of requiredGroups(scope)) {
      const choices = fields.every(field => field.type === 'radio' || field.type === 'checkbox');
      if (choices && fields.length > 1) {
        if (!fields.some(filled)) missing.add(fields[0]);
        continue;
      }
      for (const field of fields) {
        if (field.type === 'radio' && field.name) {
          const peers = fieldList(scope).filter(peer => peer.type === 'radio' && peer.name === field.name && peer.form === field.form && applicable(peer));
          if (!peers.some(filled)) missing.add(field);
        } else if (!filled(field)) missing.add(field);
      }
    }
    const existing = scope.querySelector(':scope > [data-emr-required-message]');
    if (!missing.size) {
      existing?.remove();
      for (const frame of scope.querySelectorAll('iframe')) {
        if (!visible(frame)) continue;
        let frameDoc;
        try { frameDoc = frame.contentDocument; } catch { continue; }
        if (frameDoc?.body && !validate(frameDoc.body)) return false;
      }
      return true;
    }
    for (const field of missing) {
      const visual = visualControl(field);
      if (!marked.has(visual)) marked.set(visual, visual.getAttribute('aria-invalid'));
      visual.setAttribute('aria-invalid', 'true');
      visual.classList.add('emr-required-missing');
    }
    const banner = existing || scope.ownerDocument.createElement('p');
    banner.setAttribute('data-emr-required-message', '');
    banner.setAttribute('data-emr-transient', '');
    banner.setAttribute('data-emr-no-auto-index', '');
    banner.setAttribute('role', 'alert');
    banner.textContent = message;
    if (!existing) scope.prepend(banner);
    const firstField = Array.from(missing).sort((a, b) => a === b ? 0 : (a.compareDocumentPosition(b) & 4 ? -1 : 1))[0];
    const first = visualControl(firstField);
    first.scrollIntoView?.({ block: 'center', behavior: 'auto' });
    first.focus?.({ preventScroll: true });
    return false;
  }

  function scopeFor(action) {
    const doc = action.ownerDocument;
    const explicit = action.getAttribute('data-required-scope');
    if (explicit) { try { const scope = doc.querySelector(explicit); if (scope) return scope; } catch {} }
    return action.form || action.closest('[data-required-island]') || action.closest('form,dialog,[role="dialog"],.modal-content') ||
      action.closest('.sub-tab,.page') || action.closest('section,.panel,.card,main') || doc.body;
  }

  function bypass(action) {
    if (!action) return false;
    const label = (action.innerText || action.value || '').trim();
    return action.matches('[formnovalidate],[data-required-bypass],[type="reset"],[data-close],[data-cancel],.dialog-close,.modal-close,.btn-close') || /^[×✕✖]$/u.test(label) ||
      /^(?:បោះបង់|បិទ|ត្រឡប់|ថយក្រោយ|កែប្រែ|កែសម្រួល|បោះពុម្ព|មើល|ស្វែងរក|ផ្ទុកឡើងវិញ|cancel\b|close\b|back\b|discard\b|edit\b|print\b|preview\b|search\b|refresh\b|open\b)/iu.test(label);
  }

  function commits(action) {
    if (bypass(action)) return false;
    if (action.matches('[data-required-action],[data-save],[data-release],[data-submit],[data-send],[data-approve],[data-transfer],[data-confirm],.emr-save-button')) return true;
    if (action.form && (action.type === 'submit' || (action.tagName === 'BUTTON' && !action.hasAttribute('type')))) return true;
    const signal = [action.getAttribute('onclick'), action.id, action.getAttribute('data-action'), action.innerText, action.value].filter(Boolean).join(' ');
    return /(?:រក្សាទុក|បញ្ជូន|ផ្ញើ|អនុម័ត|យល់ព្រម|បញ្ជាក់|ស្នើសុំ|\b(?:save|submit|send|approve|transfer|confirm)\b)/iu.test(signal) ||
      /\b(?:save|submit|send|approve|transfer)[A-Z_]/u.test(signal);
  }

  function block(event) { event.preventDefault(); event.stopImmediatePropagation(); }

  function install(doc) {
    if (!doc?.defaultView || installed.has(doc)) return;
    installed.add(doc);
    const win = doc.defaultView;
    if (win.BorkeoRequiredFields?.version === '37.7') return;
    win.BorkeoRequiredFields = { validate, scopeFor, version: '37.7' };
    if (doc !== document && doc.head) {
      const style = doc.createElement('link');
      style.rel = 'stylesheet'; style.href = '/public/emr-required-fields.css?v=3770';
      doc.head.append(style);
    }
    // Window capture runs before inline handlers and document-delegated saves.
    win.addEventListener('click', event => {
      const action = event.target.closest?.('button,input[type="submit"],input[type="button"],[role="button"],a[data-required-action],a[onclick]');
      if (action && bypass(action) && action.form && action.type === 'submit' && !action.formNoValidate) {
        action.formNoValidate = true;
        win.setTimeout(() => { action.formNoValidate = false; }, 0);
      }
      if (action && commits(action) && !validate(scopeFor(action))) block(event);
    }, true);
    win.addEventListener('submit', event => {
      if (!bypass(event.submitter) && !validate(event.target)) block(event);
    }, true);
    doc.addEventListener('invalid', event => {
      if (applicable(event.target) && (event.target.validity.valueMissing || !filled(event.target))) {
        event.preventDefault(); validate(scopeFor(event.target));
      }
    }, true);
    doc.addEventListener('input', event => clearField(event.target), true);
    doc.addEventListener('change', event => clearField(event.target), true);
    const proto = win.HTMLFormElement.prototype;
    const nativeSubmit = proto.submit;
    proto.submit = function guardedSubmit() {
      if (validate(this)) return nativeSubmit.call(this);
    };
    function frameLoaded(frame) { try { install(frame.contentDocument); } catch {} }
    doc.addEventListener('load', event => { if (event.target?.tagName === 'IFRAME') frameLoaded(event.target); }, true);
    const scanFrames = () => doc.querySelectorAll('iframe').forEach(frameLoaded);
    if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', scanFrames, { once: true });
    else scanFrames();
  }

  install(document);
})();
