import { parsePmrs2Text, PMRS2_PASTE_FIELDS } from './pmrs2-paste.mjs?v=5130';
import { applyPmrs2Registration } from './pmrs2-import.mjs?v=5130';

function mount() {
  const host = document.getElementById('web-admission');
  if (!host || document.getElementById('pmrs2-paste-open')) return;
  const bar = document.createElement('div');
  bar.className = 'pmrs2-panel-bar no-print';
  const note = document.createElement('p');
  note.textContent = 'នាំចូលព័ត៌មានអ្នកជំងឺពី PMRS2 ដោយចម្លង និងបិទភ្ជាប់';
  const open = document.createElement('button');
  open.id = 'pmrs2-paste-open'; open.type = 'button'; open.textContent = 'នាំចូលពី PMRS2';
  bar.append(note, open); host.querySelector('h2')?.after(bar);
  const dialog = document.createElement('dialog');
  dialog.className = 'pmrs2-dialog'; dialog.id = 'pmrs2-paste-dialog';
  dialog.setAttribute('aria-labelledby', 'pmrs2-paste-title');
  // Static markup only; pasted text and patient values are assigned through .value/textContent.
  dialog.innerHTML = `<header><h2 id="pmrs2-paste-title">នាំចូលពី PMRS2</h2><button type="button" data-close>បិទ</button></header>
    <div class="pmrs2-body"><p>បើកទំព័រព័ត៌មានអ្នកជំងឺក្នុង PMRS2 ហើយចម្លងតែព័ត៌មានរបស់អ្នកជំងឺម្នាក់។ បិទភ្ជាប់នៅទីនេះ រួចពិនិត្យមុនបញ្ចូលទៅទម្រង់ចុះឈ្មោះ។</p>
    <p><a href="https://pmrs.digitalsp.gov.kh/" target="_blank" rel="noopener noreferrer">បើក PMRS2</a></p>
    <label for="pmrs2-paste-text">ព័ត៌មានដែលបានចម្លង</label><textarea id="pmrs2-paste-text" maxlength="30000" data-emr-no-auto-index data-emr-runtime-control autocomplete="off" spellcheck="false"></textarea>
    <p><button type="button" id="pmrs2-paste-preview">ពិនិត្យព័ត៌មាន</button></p>
    <p id="pmrs2-paste-status" class="pmrs2-status" role="status" aria-live="polite"></p>
    <div id="pmrs2-paste-fields" class="pmrs2-preview" hidden></div>
    <p>ព័ត៌មានដែលមានស្រាប់អាចត្រូវបានជំនួសដោយព័ត៌មានដែលអ្នកបានពិនិត្យ។ លេខសម្គាល់អ្នកជំងឺរបស់មន្ទីរពេទ្យមិនត្រូវបានជំនួសទេ។ ត្រូវចុចរក្សាទុកក្នុងទម្រង់ចុះឈ្មោះដោយខ្លួនឯង។</p></div>
    <footer><button type="button" data-close>បោះបង់</button><button type="button" class="pmrs2-primary" id="pmrs2-paste-apply" disabled>បញ្ចូលទៅទម្រង់ចុះឈ្មោះ</button></footer>`;
  document.body.append(dialog);
  const raw = dialog.querySelector('#pmrs2-paste-text');
  const preview = dialog.querySelector('#pmrs2-paste-fields');
  const status = dialog.querySelector('#pmrs2-paste-status');
  const apply = dialog.querySelector('#pmrs2-paste-apply');
  const parse = dialog.querySelector('#pmrs2-paste-preview');
  let busy = false;
  const reset = () => { raw.value = ''; preview.replaceChildren(); preview.hidden = true; apply.disabled = true; status.textContent = ''; };
  const close = () => { if (!busy) { dialog.close(); reset(); } };
  dialog.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', close));
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  open.addEventListener('click', () => { reset(); dialog.showModal(); raw.focus(); });
  raw.addEventListener('input', () => { preview.replaceChildren(); preview.hidden = true; apply.disabled = true; status.textContent = ''; });
  parse.addEventListener('click', () => {
    const { payload, warnings } = parsePmrs2Text(raw.value);
    preview.replaceChildren();
    if (!Object.keys(payload).length) {
      preview.hidden = true; apply.disabled = true;
      status.textContent = warnings.includes('conflict') ? 'មានព័ត៌មានមិនស្របគ្នា។ សូមចម្លងតែព័ត៌មានរបស់អ្នកជំងឺម្នាក់ រួចសាកល្បងម្ដងទៀត។' : 'មិនរកឃើញព័ត៌មានអ្នកជំងឺទេ។ សូមចម្លងស្លាកឈ្មោះ និងតម្លៃពីទំព័រព័ត៌មានអ្នកជំងឺ។';
      return;
    }
    for (const [key, label] of PMRS2_PASTE_FIELDS) {
      if (!payload[key]) continue;
      const wrap = document.createElement('label');
      if (key === 'street') wrap.className = 'pmrs2-wide';
      wrap.textContent = label;
      const input = document.createElement('input');
      input.type = key === 'dob' ? 'date' : 'text'; input.value = payload[key]; input.dataset.pmrs2Key = key;
      input.setAttribute('data-emr-no-auto-index', ''); input.setAttribute('data-emr-runtime-control', ''); input.autocomplete = 'off';
      wrap.append(input); preview.append(wrap);
    }
    preview.hidden = false; apply.disabled = false;
    status.textContent = warnings.length ? 'ព័ត៌មានខ្លះមិនអាចអានបានច្បាស់។ សូមពិនិត្យ និងកែតម្រូវ ហើយបំពេញព័ត៌មានដែលខ្វះក្នុងទម្រង់ចុះឈ្មោះ។' : 'សូមពិនិត្យ និងកែតម្រូវព័ត៌មានខាងក្រោមមុនបញ្ចូលទៅទម្រង់។';
  });
  apply.addEventListener('click', async () => {
    if (busy || apply.disabled) return;
    const payload = Object.fromEntries([...preview.querySelectorAll('[data-pmrs2-key]')].map(input => [input.dataset.pmrs2Key, input.value.trim()]).filter(([, value]) => value));
    if (!Object.keys(payload).length) return;
    // Protect an opened existing encounter from accidentally receiving another identity.
    const query = new URL(location.href).searchParams;
    if (query.has('patientKey') || query.has('patient') || window.getLoadedEmrPatient?.()?.patientKey) { status.textContent = 'សូមបើកទម្រង់ចុះឈ្មោះថ្មី មុននាំចូលព័ត៌មានអ្នកជំងឺ។'; return; }
    busy = true; apply.disabled = true; parse.disabled = true;
    try {
      const report = await applyPmrs2Registration(payload);
      const duplicates = report.duplicates.map(({ patient }) => [patient.fullName || [patient.lastName, patient.firstName].filter(Boolean).join(' '), patient.caseNumber || patient.healthId].filter(Boolean).join(' — '));
      status.textContent = report.filled.length ? 'បានបញ្ចូលព័ត៌មានទៅទម្រង់។ សូមពិនិត្យមុនចុចរក្សាទុក។' : 'មិនអាចបញ្ចូលព័ត៌មានបានទេ។ សូមពិនិត្យទម្រង់ចុះឈ្មោះ។';
      if (duplicates.length) status.textContent += '\nអាចមានអ្នកជំងឺដែលបានចុះឈ្មោះរួចហើយ។ សូមពិនិត្យមុនបង្កើតថ្មី៖\n' + duplicates.join('\n');
      raw.value = ''; preview.replaceChildren(); preview.hidden = true;
    } catch { status.textContent = 'មិនអាចបញ្ចូលព័ត៌មានបានពេញលេញទេ។ សូមពិនិត្យទម្រង់ ហើយសាកល្បងម្ដងទៀត។'; }
    finally { busy = false; parse.disabled = false; }
  });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
else mount();
