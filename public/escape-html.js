(function () {
  'use strict';

  function escapeHtml(value) {
    if (value === null || value === undefined) return '';
    return String(value).replace(/[&<>"']/g, function (match) {
      switch (match) {
        case '&': return '&amp;';
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        default: return match;
      }
    });
  }

  function rawHtml(value) {
    return { __borkeoRawHtml: true, value: String(value ?? '') };
  }

  function html(strings, ...values) {
    let result = '';
    for (let i = 0; i < strings.length; i++) {
      result += strings[i];
      if (i < values.length) {
        const val = values[i];
        if (val && typeof val === 'object' && val.__borkeoRawHtml === true) {
          result += val.value;
        } else if (Array.isArray(val)) {
          result += val.join('');
        } else {
          result += escapeHtml(val);
        }
      }
    }
    return result;
  }

  const target = typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this);
  if (target) {
    target.escapeHtml = escapeHtml;
    target.html = html;
    target.rawHtml = rawHtml;
  }
  if (typeof module !== 'undefined' && module && module.exports) {
    module.exports = { escapeHtml, html, rawHtml };
  }
})();
