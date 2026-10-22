// New UI text that has no approved Khmer yet.
// newText('key', 'English placeholder') returns the approved Khmer from
// new-text-data.js when the owner has translated it; otherwise the English
// placeholder, shown with a yellow dashed highlight (.needs-translation)
// while SHOW_UNTRANSLATED is on (default). Every key must be listed in
// docs/translations-needed.csv.
(function () {
  const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const translated = (key) => (window.BORKEO_NEW_TEXT_KH || {})[key] || '';
  const highlight = () => document.querySelector('meta[name="borkeo-show-untranslated"]')?.content !== '0';

  function newText(key, english) {
    return translated(key) || english;
  }

  function newTextHtml(key, english) {
    const khmer = translated(key);
    if (khmer) return escapeHtml(khmer);
    if (!highlight()) return escapeHtml(english);
    return `<span class="needs-translation" data-new-text="${escapeHtml(key)}" title="${escapeHtml(key)}">${escapeHtml(english)}</span>`;
  }

  // Static markup: <span data-new-text="key">English placeholder</span>
  function applyNewText(root = document) {
    root.querySelectorAll('[data-new-text]').forEach((element) => {
      const khmer = translated(element.dataset.newText);
      if (khmer) {
        if (element.textContent !== khmer) element.textContent = khmer;
        element.classList.remove('needs-translation');
      } else if (highlight()) {
        element.classList.add('needs-translation');
        element.title = element.dataset.newText;
      }
    });
  }

  window.newText = newText;
  window.newTextHtml = newTextHtml;
  window.applyNewText = applyNewText;
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => applyNewText(), { once: true });
  else applyNewText();
})();
