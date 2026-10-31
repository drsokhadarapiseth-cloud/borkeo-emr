// Self-contained function: chrome.scripting serializes it into the PMRS tab.
// Reads visible registration text only. Never reads inputs, cookies or passwords.
export function capturePatient() {
  const clean = value => String(value ?? '').normalize('NFC').replace(/[\u200b-\u200d\ufeff]/g, '').replace(/\s+/g, ' ').trim();
  const visible = el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  const one = list => { const found = [...list].filter(visible); if (found.length !== 1) throw Error('PAGE_CHANGED'); return found[0]; };
  if (location.origin !== 'https://pmrs.digitalsp.gov.kh') throw Error('PMRS_PAGE_REQUIRED');
  const card = one([...document.querySelectorAll('div.rounded-xl')].filter(el =>
    [...el.children].some(header => [...header.children].some(label => label.tagName === 'SPAN' && clean(label.textContent) === 'លេខករណី'))));
  const header = [...card.children].find(el => [...el.children].some(label => clean(label.textContent) === 'លេខករណី'));
  const caseNumber = clean(one(header.querySelectorAll('span.font-mono')).textContent);
  const valueRow = (label, required = false) => {
    const labels = [...card.querySelectorAll('span')].filter(el => visible(el) && clean(el.textContent) === label);
    if (!labels.length && !required) return '';
    const row = one(labels).parentElement;
    const value = one([...row.children].filter(el => !el.contains(labels[0])));
    return clean(value.tagName === 'DIV' ? one(value.querySelectorAll('span.font-bold')).textContent : value.textContent);
  };
  const healthId = valueRow('លេខបណ្ណសុខភាព', true);
  if (!/^[A-Za-z0-9-]{3,80}$/.test(caseNumber) || !/^[A-Za-z0-9-]{3,80}$/.test(healthId)) throw Error('IDENTITY_REQUIRED');
  const section = one([...document.querySelectorAll('h2')].filter(el => clean(el.textContent) === 'ព័ត៌មានអ្នកជំងឺ')).parentElement;
  const field = (label, required = false) => {
    const labels = [...section.querySelectorAll('strong')].filter(el => visible(el) && clean(el.textContent) === label);
    if (!labels.length && !required) return '';
    const el = one(labels), parent = el.parentElement;
    // The name/sex/age value is a text node following <strong>. Phone/address
    // have a separate sibling span. No label text is included in the value.
    return clean([...parent.childNodes].filter(node => node !== el && !(node.nodeType === 1 && node.tagName === 'BUTTON')).map(node => node.textContent).join(' '));
  };
  const fullName = field('ឈ្មោះ៖', true), sex = field('ភេទ៖', true);
  if (!fullName || fullName.length > 160 || !['ស្រី', 'ប្រុស'].includes(sex)) throw Error('DEMOGRAPHICS_REQUIRED');
  const registration = { healthId, caseNumber, fullName, sex };
  const phone = field('លេខទូរសព្ទ៖');
  if (phone && /^[+\d\s()-]{5,40}$/.test(phone)) registration.phone = phone;
  const age = field('អាយុ៖').split(' ');
  if (age.length === 2 && age[1] === 'ឆ្នាំ' && /^\d{1,3}$/.test(age[0]) && Number(age[0]) <= 130) registration.age = age[0];
  // No DOB inference. Address order is the four labelled PMRS levels supplied
  // by the operator; other shapes are omitted rather than guessing codes.
  const address = field('អាសយដ្ឋាន៖').split(',').map(clean);
  if (address.length === 4 && address.every(Boolean)) [registration.province, registration.district, registration.commune, registration.village] = address;
  const equityLabels = [...card.querySelectorAll('span')].filter(el => visible(el) && clean(el.textContent) === 'បណ្ណសមធម៌គ្រួសារក្រីក្រ');
  if (equityLabels.length === 1) {
    const row = equityLabels[0].parentElement.parentElement;
    const values = [...row.querySelectorAll('span.font-bold')].filter(el => visible(el) && !el.contains(equityLabels[0]) && el !== equityLabels[0]);
    if (values.length === 1 && /^\d{4,40}$/.test(clean(values[0].textContent))) registration.equityCard = clean(values[0].textContent);
  }
  if (Object.values(registration).some(value => value.length > 200)) throw Error('FIELD_TOO_LARGE');
  return registration;
}
