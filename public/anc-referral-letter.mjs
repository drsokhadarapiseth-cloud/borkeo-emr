// v42.6 - Referral letter to the provincial hospital (CPA3) for a red ANC
// pregnancy. A simple letter until the owner uploads the official referral
// form: replace this one function (same arguments) to print the official layout.
// Arguments: data (GET /api/anc/record), record (ANC record), visit (the visit
// with the signed referral), status (colour, GA ...), labels, t (text), esc.
export function referralLetterHtml({ data, record, visit, status, labels, t, esc }) {
  const referral = visit.referral || {};
  const signed = referral.signed || {};
  const labs = [...(data.released?.labs || []), ...(record.labs || [])].filter((column) => column && Object.values(column).some(Boolean));
  const last = labs[labs.length - 1] || {};
  const rapid = visit.rapid || {};
  const row = (label, value) => `<tr><th>${esc(label)}</th><td>${esc(value || '—')}</td></tr>`;
  return `<div class="anc-print-page anc-letter">
    <header class="anc-print-head"><img src="/public/logo-hospital.jpg" alt=""><h1>${esc(t('anc.letterTitle', 'Referral letter'))}</h1>
      <div class="anc-colour-boxes"><span class="anc-colour-box anc-box-red"><span class="anc-box">✓</span>${esc(labels.colours.red)}</span></div></header>
    <p>${esc(t('anc.letterTo', 'To: the provincial referral hospital (CPA3)'))}</p>
    <table class="anc-letter-table">
      ${row(labels.identity.name, data.patient.fullName)}
      ${row(labels.identity.age, record.identity?.age || data.patient.age)}
      ${row('Health ID', data.patient.healthId || data.patient.caseNumber)}
      ${row(labels.identity.edd, status.dating.edd)}
      ${row('GA', status.ga ? status.ga.label : '')}
      ${row(t('anc.letterReasons', 'Reasons (red)'), (referral.reasons || []).join(' · '))}
      ${row(t('anc.letterVitals', 'Vital signs'), [visit.bp && `${visit.bp} mmHg`, visit.pulse && `${visit.pulse}/min`, visit.temperature && `${visit.temperature} °C`, visit.spo2 && `SpO2 ${visit.spo2}%`, visit.weight && `${visit.weight} kg`].filter(Boolean).join(' · '))}
      ${row(t('anc.letterResults', 'Test results'), [last.hiv && `HIV ${last.hiv}`, last.syphilis && `Syphilis ${last.syphilis}`, last.hbsag && `HBsAg ${last.hbsag}`, (last.hb || rapid.hb) && `Hb ${last.hb || rapid.hb}`, last.group && `Group ${last.group}`, rapid.hiv && `HIV ${rapid.hiv}`, rapid.syphilis && `Syphilis ${rapid.syphilis}`].filter(Boolean).join(' · '))}
      ${row(t('anc.letterTreatment', 'Treatment given'), referral.treatment)}
    </table>
    <div class="anc-letter-sign">
      <p>${esc(new Date(signed.signedAt || Date.now()).toLocaleDateString())}</p>
      <p>${esc(t('anc.letterDoctor', 'Referring doctor'))}</p>
      ${/^data:image\/png;base64,/.test(signed.signatureDataUrl || '') ? `<img src="${esc(signed.signatureDataUrl)}" alt="">` : '<div class="anc-sign-line"></div>'}
      <p><strong>${esc(signed.signerName || signed.displayName || '')}</strong></p>
    </div>
  </div>`;
}
