// Disposable synthetic browser fixtures only. Never used by application code.
export async function completeAncRequired(browser) {
  await browser.evaluate(`(() => {
    const values = { 'identity.gravida':'1', lmp:'2026-08-01', heightCm:'160', weight:'55', bp:'110/70', pulse:'80', temperature:'37', spo2:'98', complaint:'Synthetic complaint', fer:'0', 'legacyDetails.37':'Z36.4.0', 'legacyDetails.43':'0', 'legacyDetails.44':'TT2', 'legacyDetails.51':'Synthetic counselling' };
    document.querySelectorAll('#anc-main [required]').forEach(input => {
      if (String(input.value).trim()) return;
      const key = input.dataset.path || input.dataset.visit;
      input.value = input.tagName === 'SELECT' ? [...input.options].find(option => option.value)?.value || '' : values[key] || 'Synthetic';
      input.dispatchEvent(new Event('input', {bubbles:true}));
      input.dispatchEvent(new Event('change', {bubbles:true}));
    });
  })()`);
}
