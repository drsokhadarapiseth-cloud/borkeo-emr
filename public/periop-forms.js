// v41.3 - Consents, surgery, anaesthesia and transfusion forms on the medical
// v41.4 - Newborn record (linked to the delivery form and the mother) and
//         postnatal care record, in the same window.
// record page (a tab next to OPD / IPD / Nursing). One form per type and date
// (/api/periop-forms). Staff sign with their e-signature; the patient or the
// representative signs on screen, by a thumbprint photo, by a fingerprint
// scanner when one is connected (window.BorkeoFingerprintScanner, see
// docs/fingerprint-scanner.md), or on the printed paper.
// Every control here is data-emr-transient (never saved with the record).
'use strict';
(function () {
  const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const english = () => window.getBorkeoLanguage?.() === 'en' || window.currentLang === 'english';
  const label = (key, en, kh) => (english() ? escapeHtml(en) : kh ? escapeHtml(kh) : window.newTextHtml ? window.newTextHtml(key, en) : escapeHtml(en));
  const plain = (key, en, kh) => (english() ? en : kh || (window.newText ? window.newText(key, en) : en));
  const role = () => String(window.emrSession?.user?.activeRole || '').toUpperCase();
  const patient = () => window.getLoadedEmrPatient?.() || null;
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };

  async function api(path, body) {
    const response = await fetch(path, body ? {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': window.emrSession?.csrfToken || '' },
      body: JSON.stringify(body),
    } : { credentials: 'same-origin', cache: 'no-store' });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || String(response.status));
    return result;
  }

  // ---------------- Form definitions (labels are translation keys) ----------------
  const FIELD_EN = {
    procedureName: 'Procedure / operation', indication: 'Reason (indication)', doctorExplained: 'Doctor who explained',
    surgeon: 'Surgeon', assistant: 'Assistant', anaesthetist: 'Anaesthetist', scrubNurse: 'Scrub nurse',
    preopDiagnosis: 'Pre-operative diagnosis', postopDiagnosis: 'Post-operative diagnosis', findings: 'Findings',
    procedureDetails: 'Procedure details', specimens: 'Specimens', bloodLoss: 'Estimated blood loss (ml)', complications: 'Complications',
    drains: 'Drains', startTime: 'Start time', endTime: 'End time', asa: 'ASA class', anaesthesiaType: 'Type of anaesthesia', airway: 'Airway',
    anaesthesiaDrugs: 'Drugs and doses', fluids: 'Fluids given', intraopVitals: 'Vital signs during anaesthesia', events: 'Events',
    monitoring: 'Monitoring', position: 'Position', diet: 'Diet', ivFluids: 'IV fluids', analgesia: 'Pain relief', woundCare: 'Wound and drain care',
    callDoctorIf: 'Call the doctor if', bloodGroup: 'Blood group', product: 'Blood product', bagNumber: 'Bag number', expiry: 'Expiry date',
    volume: 'Volume (ml)', crossmatch: 'Compatibility check done by two staff', before: 'Before', after15: 'After 15 minutes', end: 'At the end',
    reaction: 'Reaction', reactionNone: 'No reaction', reactionAction: 'Action taken',
    // v41.4 newborn record (per baby) and postnatal care record
    babyCount: 'Number of babies', birthAt: 'Date and time of birth', outcome: 'Born', babySex: 'Sex of the baby',
    apgar1: '1 minute', apgar5: '5 minutes', apgar10: '10 minutes', birthWeight: 'Birth weight', babyLength: 'Length (cm)',
    babyHeadCircumference: 'Head circumference (cm)', resuscitation: 'Resuscitation (if needed)', vitaminKGiven: 'Vitamin K',
    vitaminKAt: 'Time given', babyCaseNumber: "Baby's case number (if registered)", babyNotes: 'Notes',
    dayAfterBirth: 'Day after birth', pncBp: 'Blood pressure (mmHg)', pncPulse: 'Pulse (/min)', pncTemp: 'Temperature (°C)',
    uterus: 'Uterus (height, contraction)', lochia: 'Lochia', perineumWound: 'Perineum / wound', breasts: 'Breasts and breastfeeding',
    urineStool: 'Urine and stool', pain: 'Pain', dangerSigns: 'Danger signs', familyPlanning: 'Family planning counselling',
    supplements: 'Iron, folic acid, vitamin A given', babyCheck: 'Baby check (feeding, cord, jaundice, danger signs)', nextVisit: 'Next visit', pncNotes: 'Notes',
  };
  // Labels with approved Khmer (RULE 2).
  const FIELD_KH = { birthWeight: 'ទម្ងន់ពេលកើត', vitaminKGiven: 'វីតាមីន K' };
  const UNITS = { birthWeight: ' (g)' };
  const f = (name, type = 'text', extra = {}) => ({ name, type, ...extra });
  const FORMS = {
    procedureConsent: { en: 'Procedure consent', kh: 'លិខិតយល់ព្រមធ្វើអន្តរាគមន៍', text: ['consent.procedure.text', 'procedure'],
      fields: [f('procedureName'), f('indication', 'textarea'), f('doctorExplained')] },
    anaesthesiaConsent: { en: 'Anaesthesia consent', kh: 'លិខិតយល់ព្រមប្រើថ្នាំស្ពឹក', text: ['consent.anaesthesia.text', 'anaesthesia'],
      fields: [f('procedureName'), f('anaesthesiaType'), f('doctorExplained')] },
    transfusionConsent: { en: 'Blood transfusion consent', kh: 'លិខិតយល់ព្រមបញ្ចូលឈាម', text: ['consent.transfusion.text', 'transfusion'],
      fields: [f('product'), f('indication', 'textarea'), f('doctorExplained')] },
    refusal: { en: 'Refusal of treatment form', kh: 'ទម្រង់បដិសេធការព្យាបាល', text: ['consent.refusal.text', 'refusal'],
      fields: [f('procedureName'), f('indication', 'textarea'), f('doctorExplained')] },
    preopChecklist: { en: 'Pre-operative checklist', kh: 'បញ្ជីត្រួតពិនិត្យមុនវះកាត់', checklist: true, fields: [f('procedureName')] },
    operativeNote: { en: 'Operative note', kh: 'កំណត់ត្រាវះកាត់', fields: [f('procedureName'), f('startTime', 'time'), f('endTime', 'time'),
      f('surgeon'), f('assistant'), f('anaesthetist'), f('scrubNurse'), f('preopDiagnosis', 'textarea'), f('postopDiagnosis', 'textarea'),
      f('findings', 'textarea'), f('procedureDetails', 'textarea'), f('specimens'), f('bloodLoss', 'number'), f('complications', 'textarea'), f('drains')] },
    anaesthesiaRecord: { en: 'Anaesthesia record', kh: 'កំណត់ត្រាការប្រើថ្នាំស្ពឹក', fields: [f('procedureName'),
      f('asa', 'select', { options: ['I', 'II', 'III', 'IV', 'V', 'VI', 'I E', 'II E', 'III E', 'IV E', 'V E'] }), f('anaesthesiaType'), f('airway'),
      f('startTime', 'time'), f('endTime', 'time'), f('anaesthesiaDrugs', 'textarea'), f('fluids', 'textarea'), f('intraopVitals', 'textarea'), f('events', 'textarea')] },
    postopOrders: { en: 'Post-operative orders', kh: 'បញ្ជាការព្យាបាលក្រោយវះកាត់', fields: [f('monitoring', 'textarea'), f('position'), f('diet'),
      f('ivFluids', 'textarea'), f('analgesia', 'textarea'), f('woundCare', 'textarea'), f('callDoctorIf', 'textarea')] },
    transfusionRecord: { en: 'Blood transfusion record', kh: 'កំណត់ត្រាការបញ្ចូលឈាម', fields: [f('bloodGroup'), f('product'), f('bagNumber'),
      f('expiry', 'date'), f('volume', 'number'), f('crossmatch', 'checkbox'), f('startTime', 'time'), f('endTime', 'time'),
      f('before', 'text', { vitals: true }), f('after15', 'text', { vitals: true }), f('end', 'text', { vitals: true }),
      f('reactionNone', 'checkbox'), f('reaction', 'textarea'), f('reactionAction', 'textarea')] },
    // v41.4: one form per date on the mother's record; one section per baby (twins, triplets).
    newbornRecord: { en: 'Newborn record', kh: 'កំណត់ត្រាទារកទើបនឹងកើត', maternity: true, babies: true,
      fields: [f('babyCount', 'select', { options: ['1', '2', '3'] })],
      babyFields: [f('birthAt', 'datetime-local'),
        f('outcome', 'select', { options: [{ value: 'live', key: 'newborn.live', en: 'Born alive' }, { value: 'stillborn', key: 'newborn.stillborn', en: 'Stillborn' }] }),
        f('babySex', 'select', { options: [{ value: 'male', key: 'newborn.male', en: 'Male' }, { value: 'female', key: 'newborn.female', en: 'Female' }, { value: 'undetermined', key: 'newborn.undetermined', en: 'Undetermined' }] }),
        f('apgar1', 'number', { apgar: true, max: 10 }), f('apgar5', 'number', { apgar: true, max: 10 }), f('apgar10', 'number', { apgar: true, max: 10 }),
        f('birthWeight', 'number', { max: 9000 }), f('babyLength', 'number', { max: 80 }), f('babyHeadCircumference', 'number', { max: 60 }),
        f('resuscitation', 'textarea'), f('vitaminKGiven', 'checkbox'), f('vitaminKAt', 'datetime-local'), f('babyCaseNumber'), f('babyNotes', 'textarea')] },
    postnatalCare: { en: 'Postnatal care record', kh: 'កំណត់ត្រាថែទាំក្រោយសម្រាល', maternity: true, fields: [f('dayAfterBirth', 'number', { max: 60 }),
      f('pncBp'), f('pncPulse', 'number', { max: 300 }), f('pncTemp', 'number', { max: 45 }), f('uterus'), f('lochia'), f('perineumWound'),
      f('breasts'), f('urineStool'), f('pain'), f('dangerSigns', 'textarea'), f('familyPlanning', 'textarea'), f('supplements'),
      f('babyCheck', 'textarea'), f('nextVisit', 'date'), f('pncNotes', 'textarea')] },
  };
  // English of the newborn care items and birth vaccines (keys in server/clinical-options.json).
  const NEWBORN_EN = {
    'newborn.drying': 'Dried thoroughly at birth', 'newborn.skinToSkin': 'Skin-to-skin contact with the mother',
    'newborn.delayedCordClamping': 'Cord clamped after 1 to 3 minutes', 'newborn.breastfeeding1h': 'Breastfeeding started within 1 hour',
    'newborn.eyeCare': 'Eye care given', 'newborn.cordCare': 'Clean cord care',
    'vaccine.bcg': 'BCG', 'vaccine.hepB0': 'Hepatitis B birth dose',
  };
  // English of the owner-approved consent texts (docs/phase7-consent-drafts.md).
  const CONSENT_EN = {
    procedure: "I, the undersigned, the patient or the legal representative of the patient named above, confirm that the doctor has explained to me, in a language I understand: the diagnosis, the proposed procedure, its expected benefits, its possible risks and complications, the other treatment options, and what may happen if the procedure is not done. I had the chance to ask questions and my questions were answered. I agree to the procedure named above, and to any additional procedure that becomes necessary during it to save life or prevent serious harm. I understand that no result can be guaranteed and that I may withdraw this consent before the procedure begins.",
    anaesthesia: "I confirm that the anaesthetist or the doctor has explained the type of anaesthesia planned (general, spinal, regional or local, with or without sedation), its benefits, and its possible risks and side effects, including nausea, sore throat, headache, allergic reaction, damage to teeth, and rare serious complications. I have told the team about my medical history, allergies, medicines, and when I last ate or drank. I agree to the anaesthesia planned, and to a change of anaesthesia method if it becomes necessary for my safety.",
    transfusion: "I confirm that the doctor has explained why a transfusion of blood or blood products is needed, its benefits, the other options, and its possible risks, including fever, allergic reaction, and, rarely, serious reactions or infection, even though the blood has been tested. I agree to receive the blood or blood products needed during this treatment.",
    refusal: "I, the undersigned, refuse the treatment or procedure named above, which the doctor has recommended. The doctor has explained to me, in a language I understand, the reasons for the recommendation and the risks of refusing, which may include worsening of the illness, disability or death. I take responsibility for this decision and do not hold the hospital and its staff responsible for the results of my refusal. I understand that I may change my mind and come back for treatment at any time.",
  };
  // English of the WHO Surgical Safety Checklist items (keys in server/clinical-options.json).
  const WHO_EN = {
    "who.signIn": "Sign in (before induction of anaesthesia)",
    "who.identity": "Patient has confirmed identity, site, procedure and consent",
    "who.siteMarked": "Site marked (or not applicable)",
    "who.anaesthesiaCheck": "Anaesthesia machine and medication check complete",
    "who.oximeter": "Pulse oximeter on the patient and working",
    "who.allergy": "Known allergy checked",
    "who.airway": "Difficult airway or aspiration risk checked (equipment and help available)",
    "who.bloodLoss": "Risk of more than 500 ml blood loss (7 ml/kg in children) checked; IV access and fluids planned",
    "who.timeOut": "Time out (before skin incision)",
    "who.teamIntroduced": "All team members introduced by name and role",
    "who.confirmed": "Patient name, procedure and incision site confirmed",
    "who.antibiotic": "Antibiotic prophylaxis given within the last 60 minutes (or not applicable)",
    "who.criticalEvents": "Anticipated critical events reviewed by surgeon, anaesthesia and nursing team",
    "who.sterility": "Sterility confirmed; equipment issues reviewed",
    "who.imaging": "Essential imaging displayed (or not applicable)",
    "who.signOut": "Sign out (before the patient leaves the operating room)",
    "who.procedureRecorded": "Name of the procedure recorded",
    "who.counts": "Instrument, sponge and needle counts correct",
    "who.specimen": "Specimen labelled (with patient name)",
    "who.equipmentProblems": "Equipment problems addressed",
    "who.recoveryConcerns": "Key concerns for recovery reviewed by surgeon, anaesthetist and nurse",
  };

  const SLOT = {
    doctor: () => label('slot.doctor', 'Doctor'), surgeon: () => label('form.surgeon', 'Surgeon'), anaesthetist: () => label('form.anaesthetist', 'Anaesthetist'),
    nurse: () => label('', 'Nurse signature', 'ហត្ថលេខាគិលានុបដ្ឋាក'), checker: () => label('slot.checker', 'Second checker'),
    midwife: () => label('slot.midwife', 'Midwife'),
  };
  const SLOTS = {
    procedureConsent: ['doctor'], anaesthesiaConsent: ['anaesthetist'], transfusionConsent: ['doctor'], refusal: ['doctor'],
    preopChecklist: ['surgeon', 'anaesthetist', 'nurse'], operativeNote: ['surgeon'], anaesthesiaRecord: ['anaesthetist'],
    postopOrders: ['doctor'], transfusionRecord: ['nurse', 'checker'], newbornRecord: ['midwife', 'doctor'], postnatalCare: ['midwife'],
  };
  const fieldLabel = (name) => `${label(`form.${name}`, FIELD_EN[name] || name, FIELD_KH[name])}${UNITS[name] || ''}`;
  const apgarLabel = () => label('', 'Apgar score', 'ពិន្ទុ Apgar');
  const title = (type) => label('', FORMS[type].en, FORMS[type].kh);
  const titlePlain = (type) => plain('', FORMS[type].en, FORMS[type].kh);

  // ---------------- State ----------------
  let forms = [];
  let whoChecklist = [];
  let newbornCare = [];
  let birthVaccines = [];
  let draftData = null; // unsaved values (baby count change, prefill from the delivery form)
  let current = { type: 'procedureConsent', date: today() };
  let draftSign = null; // patient signature captured in this editing session
  // Separate dated forms with their own history: not tied to the record's edit mode.
  const canWrite = () => ['DOCTOR', 'NURSE', 'MIDWIFE', 'CHIEF_WARD'].includes(role());
  const panel = () => document.getElementById('sub_periop');
  const entry = () => forms.find((form) => form.formType === current.type && form.formDate === current.date) || null;

  async function load() {
    const key = patient()?.patientKey;
    if (!key) return;
    try {
      const result = await api(`/api/periop-forms?patientKey=${encodeURIComponent(key)}`);
      forms = result.forms || [];
      whoChecklist = result.whoChecklist || [];
      newbornCare = result.newbornCare || [];
      birthVaccines = result.birthVaccines || [];
    } catch { forms = []; }
    render();
  }

  // ---------------- Launchers and window ----------------
  // The forms open in a large window, so they work in every view (from a ward
  // bed only the IPD, OPD or nursing record is shown, without the tab bar).
  const HOSTS = ['sub_opd', 'sub_ipd', 'sub_nursing'];
  function ensureLaunchers() {
    HOSTS.forEach((id) => {
      const host = document.getElementById(id);
      // Any depth: the nursing page moves its content into a sub-section after load.
      if (!host || host.querySelector('.periop-launcher')) return;
      const bar = document.createElement('div');
      bar.className = 'periop-launcher no-print';
      bar.innerHTML = `<button type="button" class="periop-button" data-periop-open><i class="fa-solid fa-file-signature" aria-hidden="true"></i> <span data-periop-tab-label></span></button>`;
      const card = host.querySelector(':scope > .opd-patient-banner, :scope > .ipd-patient-banner');
      if (card) card.insertAdjacentElement('afterend', bar); else host.prepend(bar);
    });
    if (!document.getElementById('sub_periop')) {
      const dialog = document.createElement('dialog');
      dialog.id = 'sub_periop';
      dialog.className = 'periop-dialog';
      dialog.addEventListener('close', () => { dialog.replaceChildren(); });
      document.body.appendChild(dialog);
    }
    labelTab();
  }
  // v41.4: "Newborn record" button next to the delivery form's print button.
  function ensureDeliveryLauncher() {
    const bar = document.querySelector('#sub_delivery > .action-bar');
    if (!bar || bar.querySelector('[data-periop-newborn]')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn-blue no-print';
    button.dataset.periopNewborn = '';
    button.addEventListener('click', () => window.EmrPeriopForms.open('newbornRecord'));
    bar.appendChild(button);
    labelTab();
  }
  function labelTab() {
    document.querySelectorAll('[data-periop-newborn]').forEach((button) => { button.innerHTML = `<i class="fa-solid fa-baby" aria-hidden="true"></i> ${title('newbornRecord')}`; });
    document.querySelectorAll('[data-periop-tab-label]').forEach((span) => { span.innerHTML = label('forms.tab', 'Consents, surgery and transfusion'); });
  }
  function openWindow() {
    const dialog = panel();
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    render();
    load();
  }
  document.addEventListener('click', (event) => { if (event.target.closest?.('[data-periop-open]')) openWindow(); });

  // ---------------- Editor ----------------
  // Label of a field: its own label, after a group label for vital signs and Apgar scores.
  function fieldText(field) {
    const base = fieldLabel(field.base || field.name);
    if (field.vitals) return `${label('form.vitalSigns', 'Vital signs (BP, pulse, temperature)')} · ${base}`;
    if (field.apgar) return `${apgarLabel()} · ${base}`;
    return base;
  }
  const optionValue = (option) => (typeof option === 'string' ? option : option.value);
  const optionText = (option) => (typeof option === 'string' ? escapeHtml(option) : escapeHtml(plain(option.key, option.en)));

  function fieldHtml(field, data, disabled) {
    const value = data[field.name];
    const id = `periop_${field.name.replace(/[^A-Za-z0-9_-]/g, '_')}`;
    const attrs = `id="${id}" data-periop-field="${field.name}" data-emr-transient${disabled ? ' disabled' : ''}`;
    const lab = fieldText(field);
    if (field.type === 'checkbox') return `<label class="periop-check"><input type="checkbox" ${attrs}${value === true ? ' checked' : ''}> ${lab}</label>`;
    if (field.type === 'textarea') return `<label class="periop-field wide"><span>${lab}</span><textarea ${attrs} maxlength="5000">${escapeHtml(value || '')}</textarea></label>`;
    if (field.type === 'select') return `<label class="periop-field"><span>${lab}</span><select ${attrs}><option value=""></option>${field.options.map((o) => `<option value="${escapeHtml(optionValue(o))}"${optionValue(o) === String(value ?? '') ? ' selected' : ''}>${optionText(o)}</option>`).join('')}</select></label>`;
    return `<label class="periop-field"><span>${lab}</span><input type="${field.type}" ${attrs} value="${escapeHtml(value ?? '')}"${field.type === 'number' ? ` min="0" step="any"${field.max ? ` max="${field.max}"` : ''}` : ' maxlength="500"'}></label>`;
  }

  function checklistHtml(data, disabled) {
    return whoChecklist.map((group) => `<fieldset class="periop-checklist"><legend>${label(group.section, WHO_EN[group.section] || group.section)}</legend>
      ${group.items.map((item) => `<label class="periop-check"><input type="checkbox" data-periop-field="${escapeHtml(item)}" data-emr-transient${data[item] === true ? ' checked' : ''}${disabled ? ' disabled' : ''}> ${label(item, WHO_EN[item] || item)}</label>`).join('')}
    </fieldset>`).join('') || `<p class="periop-empty">${label('forms.checklistEmpty', 'The checklist has no items. See docs/clinical-review.md.')}</p>`;
  }

  // v41.4: one section per baby; fields are saved as b1.apgar1, b2.apgar1, ...
  const babyCountOf = (data) => Math.min(3, Math.max(1, parseInt(data.babyCount, 10) || 1));
  const babyField = (n, field) => ({ ...field, name: `b${n}.${field.name}`, base: field.name });
  function babiesHtml(def, data, disabled) {
    let html = '';
    for (let n = 1; n <= babyCountOf(data); n++) {
      const box = (item) => `<label class="periop-check"><input type="checkbox" data-periop-field="b${n}.${escapeHtml(item)}" data-emr-transient${data[`b${n}.${item}`] === true ? ' checked' : ''}${disabled ? ' disabled' : ''}> ${label(item, NEWBORN_EN[item] || item)}</label>`;
      const vaccine = (item) => `<label class="periop-field"><span>${label(item, NEWBORN_EN[item] || item)}</span><input type="date" data-periop-field="b${n}.${escapeHtml(item)}" data-emr-transient value="${escapeHtml(data[`b${n}.${item}`] || '')}"${disabled ? ' disabled' : ''}></label>`;
      html += `<fieldset class="periop-baby"><legend>${label('newborn.baby', 'Baby')} ${n}</legend>
        <div class="periop-grid">${def.babyFields.map((field) => fieldHtml(babyField(n, field), data, disabled)).join('')}</div>
        <fieldset class="periop-checklist"><legend>${label('', 'Immediate newborn care', 'ការថែទាំភ្លាមៗក្រោយកើត')}</legend>${newbornCare.map(box).join('')}</fieldset>
        <fieldset class="periop-checklist"><legend>${label('', 'Birth vaccines', 'ថ្នាំបង្ការពេលកើត')}</legend><div class="periop-grid">${birthVaccines.map(vaccine).join('')}</div></fieldset>
      </fieldset>`;
    }
    return html;
  }

  // v41.4: a new newborn record starts from the delivery form of this record
  // (read only; the delivery form itself is not changed). Fields are found by
  // their place in the form: section 3 (delivery) and section 4 (baby #1).
  function fromDelivery() {
    const form = document.getElementById('sub_delivery');
    const sections = form ? form.querySelectorAll(':scope > .modern-section') : [];
    if (sections.length < 4) return null;
    const delivery = sections[2];
    const baby = sections[3];
    const birthAt = delivery.querySelector('input[type="datetime-local"]')?.value || '';
    const count = delivery.querySelectorAll('input[type="number"]')[1]?.value || '';
    const selects = baby.querySelectorAll('select');
    const outcome = { 'កើតរស់': 'live', 'កើតស្លាប់': 'stillborn' }[selects[0]?.value] || '';
    const sex = { 'ប្រុស': 'male', 'ស្រី': 'female' }[selects[1]?.value] || '';
    const weight = baby.querySelectorAll('input[type="number"]')[0]?.value || '';
    const data = {};
    if (count && Number(count) >= 1) data.babyCount = String(Math.min(3, Number(count)));
    if (birthAt) { data['b1.birthAt'] = birthAt; for (let n = 2; n <= 3; n++) data[`b${n}.birthAt`] = birthAt; }
    if (outcome) data['b1.outcome'] = outcome;
    if (sex) data['b1.babySex'] = sex;
    if (weight) data['b1.birthWeight'] = Number(weight);
    return Object.keys(data).length ? data : null;
  }
  let prefilled = false;

  function patientSignHtml(sign, disabled) {
    const s = sign || {};
    const scanner = window.BorkeoFingerprintScanner;
    const scannerReady = Boolean(scanner?.isAvailable?.());
    return `<section class="periop-patient-sign">
      <h4>${label('form.patientSignature', 'Patient or representative signature')}</h4>
      <div class="periop-sign-row">
        <label class="periop-check"><input type="radio" name="periop-signer" value="patient" data-emr-transient${s.signerType !== 'representative' ? ' checked' : ''}${disabled ? ' disabled' : ''}> ${label('form.signerPatient', 'Patient')}</label>
        <label class="periop-check"><input type="radio" name="periop-signer" value="representative" data-emr-transient${s.signerType === 'representative' ? ' checked' : ''}${disabled ? ' disabled' : ''}> ${label('form.signerRepresentative', 'Representative')}</label>
      </div>
      <div class="periop-grid">
        <label class="periop-field"><span>${label('form.signer', 'Signed by')}</span><input data-periop-sign="signerName" data-emr-transient maxlength="200" value="${escapeHtml(s.signerName || '')}"${disabled ? ' disabled' : ''}></label>
        <label class="periop-field"><span>${label('form.relationship', 'Relationship to the patient')}</span><input data-periop-sign="relationship" data-emr-transient maxlength="100" value="${escapeHtml(s.relationship || '')}"${disabled ? ' disabled' : ''}></label>
        <label class="periop-field"><span>${label('form.witness', 'Witness')}</span><input data-periop-sign="witnessName" data-emr-transient maxlength="200" value="${escapeHtml(s.witnessName || '')}"${disabled ? ' disabled' : ''}></label>
      </div>
      <div class="periop-sign-capture">
        ${s.image ? `<div class="periop-sign-preview"><img src="${escapeHtml(s.image)}" alt=""><span>${escapeHtml(signMethodText(s.method))}${s.signedAt ? ` · ${escapeHtml(new Date(s.signedAt).toLocaleString())}` : ''}</span></div>` : ''}
        ${disabled ? '' : `<div class="periop-sign-buttons">
          <button type="button" class="periop-button" data-periop-sign-draw>${label('forms.signOnScreen', 'Sign on screen')}</button>
          <button type="button" class="periop-button" data-periop-thumb>${label('forms.thumbprintPhoto', 'Thumbprint photo')}</button>
          <button type="button" class="periop-button" data-periop-scanner${scannerReady ? '' : ' disabled'} title="${escapeHtml(scannerReady ? '' : plain('forms.scannerMissing', 'No fingerprint scanner is connected'))}">${label('forms.scanner', 'Fingerprint scanner')}</button>
          <input type="file" accept="image/*" capture="environment" data-periop-thumb-file data-emr-transient hidden>
        </div>
        <div class="periop-pad" hidden><canvas width="600" height="200" data-periop-canvas></canvas>
          <div class="periop-sign-buttons"><button type="button" class="periop-button" data-periop-pad-clear>${label('forms.clear', 'Clear')}</button>
          <button type="button" class="periop-button" data-periop-pad-done>${label('forms.useSignature', 'Use this signature')}</button></div></div>`}
        <p class="periop-hint">${label('forms.paperHint', 'Or print the form and sign on paper.')}</p>
      </div>
    </section>`;
  }

  function signMethodText(method) {
    return { drawn: plain('forms.signOnScreen', 'Sign on screen'), thumbprint: plain('form.thumbprint', 'Thumbprint'), scanner: plain('forms.scanner', 'Fingerprint scanner') }[method] || '';
  }

  function staffSignHtml(form, type, disabled) {
    return `<section class="periop-staff-sign">${(SLOTS[type] || []).map((slot) => {
      const sig = form?.signatures?.[slot];
      const stale = sig && form && sig.revision && form.revision > sig.revision;
      return `<div class="periop-slot"><strong>${SLOT[slot]()}</strong>
        ${sig ? `<img src="${escapeHtml(sig.signatureDataUrl || '')}" alt=""><span>${escapeHtml(sig.signerName || '')} · ${escapeHtml(new Date(sig.signedAt).toLocaleString())}</span>${stale ? `<em class="periop-stale">${label('forms.changedAfterSigning', 'Changed after signing')}</em>` : ''}` : `<span class="periop-unsigned">—</span>`}
        ${form && !disabled ? `<button type="button" class="periop-button" data-periop-sign-slot="${slot}">${label('forms.signAsMe', 'Sign with my e-signature')}</button>` : ''}
      </div>`;
    }).join('')}</section>`;
  }

  function render() {
    const section = panel();
    if (!section || !section.open) return;
    labelTab();
    const type = current.type;
    const def = FORMS[type];
    const form = entry();
    const disabled = !canWrite();
    prefilled = false;
    let data = draftData || form?.data;
    if (!data) {
      const delivery = def.babies ? fromDelivery() : null;
      data = delivery || {};
      prefilled = Boolean(delivery);
    }
    const sign = draftSign || form?.patientSign || {};
    // Newborn and postnatal records are shown for women (and when sex is unknown).
    const types = Object.keys(FORMS).filter((key) => !FORMS[key].maternity || window.EmrDisplayRules?.sex?.() !== 'male');
    const dates = forms.filter((item) => item.formType === type).map((item) => item.formDate);
    section.innerHTML = `
      <div class="periop-layout">
        <nav class="periop-types" aria-label="${escapeHtml(plain('forms.tab', 'Consents, surgery and transfusion'))}">
          ${types.map((key) => `<button type="button" class="periop-type${key === type ? ' is-active' : ''}" data-periop-type="${key}">
            <span>${title(key)}</span><small>${forms.filter((item) => item.formType === key).length || ''}</small></button>`).join('')}
        </nav>
        <div class="periop-editor">
          <header class="periop-head">
            <h3>${title(type)}</h3>
            <button type="button" class="periop-button periop-close" data-periop-close aria-label="${escapeHtml(plain('forms.close', 'Close'))}">${label('forms.close', 'Close')}</button>
            <label class="periop-field"><span>${label('', 'Date', 'កាលបរិច្ឆេទ')}</span>
              <input type="date" data-periop-date data-emr-transient value="${escapeHtml(current.date)}" list="periop-dates"></label>
            <datalist id="periop-dates">${dates.map((d) => `<option value="${escapeHtml(d)}">`).join('')}</datalist>
            <span class="periop-status">${form ? `${label('forms.saved', 'Saved')} · ${escapeHtml(form.updatedBy)} · ${escapeHtml(new Date(form.updatedAt).toLocaleString())}` : label('form.newEntry', 'New form')}</span>
          </header>
          ${dates.length ? `<div class="periop-dates">${dates.map((d) => `<button type="button" class="periop-date${d === current.date ? ' is-active' : ''}" data-periop-pick-date="${escapeHtml(d)}">${escapeHtml(d)}</button>`).join('')}</div>` : ''}
          ${disabled ? `<p class="periop-hint">${label('forms.readOnly', 'Read only for your role.')}</p>` : ''}
          ${prefilled ? `<p class="periop-hint">${label('newborn.fromDelivery', 'Filled from the delivery form. Check and save.')}</p>` : ''}
          <div class="periop-grid">${def.fields.map((field) => fieldHtml(field, data, disabled)).join('')}</div>
          ${def.checklist ? checklistHtml(data, disabled) : ''}
          ${def.babies ? babiesHtml(def, data, disabled) : ''}
          ${def.text ? `<div class="periop-consent-text">${label(def.text[0], CONSENT_EN[def.text[1]])}</div>` : ''}
          ${def.text ? patientSignHtml(sign, disabled) : ''}
          ${staffSignHtml(form, type, disabled)}
          <p class="periop-message" role="status"></p>
          <div class="periop-actions">
            ${disabled ? '' : `<button type="button" class="periop-button primary" data-periop-save>${label('clinical.save', 'Save')}</button>`}
            <button type="button" class="periop-button" data-periop-print>${label('form.print', 'Print')}</button>
          </div>
        </div>
      </div>`;
    bind(section);
  }

  function collect(section) {
    const data = {};
    section.querySelectorAll('[data-periop-field]').forEach((control) => {
      if (control.type === 'checkbox') data[control.dataset.periopField] = control.checked;
      else if (control.type === 'number') { if (control.value !== '') data[control.dataset.periopField] = Number(control.value); }
      else if (control.value.trim()) data[control.dataset.periopField] = control.value.trim();
    });
    const sign = { ...(draftSign || entry()?.patientSign || {}) };
    const signer = section.querySelector('input[name="periop-signer"]:checked');
    if (signer) sign.signerType = signer.value;
    section.querySelectorAll('[data-periop-sign]').forEach((input) => { sign[input.dataset.periopSign] = input.value.trim(); });
    return { data, sign };
  }

  function message(text) { const box = panel()?.querySelector('.periop-message'); if (box) box.textContent = text || ''; }

  function bind(section) {
    section.querySelector('[data-periop-close]')?.addEventListener('click', () => section.close());
    section.querySelectorAll('[data-periop-type]').forEach((button) => button.addEventListener('click', () => {
      current = { type: button.dataset.periopType, date: today() };
      const latest = forms.find((item) => item.formType === current.type);
      if (latest) current.date = latest.formDate;
      draftSign = null;
      draftData = null;
      render();
    }));
    section.querySelectorAll('[data-periop-pick-date]').forEach((button) => button.addEventListener('click', () => { current.date = button.dataset.periopPickDate; draftSign = null; draftData = null; render(); }));
    section.querySelector('[data-periop-date]')?.addEventListener('change', (event) => { if (event.target.value) { current.date = event.target.value; draftSign = null; draftData = null; render(); } });
    // More babies: keep what was typed and draw the extra sections.
    section.querySelector('[data-periop-field="babyCount"]')?.addEventListener('change', () => { draftData = collect(section).data; render(); });
    section.querySelector('[data-periop-save]')?.addEventListener('click', async (event) => {
      const button = event.currentTarget;
      button.disabled = true;
      const { data, sign } = collect(section);
      try {
        const result = await api('/api/periop-forms', {
          patientKey: patient()?.patientKey, formType: current.type, formDate: current.date, data,
          patientSign: FORMS[current.type].text ? sign : undefined, revision: entry()?.revision,
        });
        forms = result.forms || forms;
        draftSign = null;
        draftData = null;
        render();
        message(plain('forms.savedMessage', 'Saved.'));
      } catch (error) { button.disabled = false; message(error.message); }
    });
    section.querySelectorAll('[data-periop-sign-slot]').forEach((button) => button.addEventListener('click', async () => {
      const form = entry();
      if (!form) return;
      try {
        const result = await api(`/api/periop-forms/${form.id}/sign`, { patientKey: patient()?.patientKey, slot: button.dataset.periopSignSlot });
        forms = result.forms || forms;
        render();
      } catch (error) { message(error.message); }
    }));
    section.querySelector('[data-periop-print]')?.addEventListener('click', () => printForm(collect(section)));
    bindSignature(section);
  }

  // ---------------- Patient signature capture ----------------
  function bindSignature(section) {
    const pad = section.querySelector('.periop-pad');
    const canvas = section.querySelector('[data-periop-canvas]');
    section.querySelector('[data-periop-sign-draw]')?.addEventListener('click', () => { pad.hidden = false; });
    if (canvas) {
      const context = canvas.getContext('2d');
      context.lineWidth = 2.5; context.lineCap = 'round'; context.strokeStyle = '#0b1f3a';
      let drawing = false;
      const point = (event) => { const rect = canvas.getBoundingClientRect(); return [(event.clientX - rect.left) * (canvas.width / rect.width), (event.clientY - rect.top) * (canvas.height / rect.height)]; };
      canvas.addEventListener('pointerdown', (event) => { drawing = true; canvas.setPointerCapture(event.pointerId); context.beginPath(); context.moveTo(...point(event)); canvas.dataset.drawn = '1'; });
      canvas.addEventListener('pointermove', (event) => { if (drawing) { context.lineTo(...point(event)); context.stroke(); } });
      canvas.addEventListener('pointerup', () => { drawing = false; });
      section.querySelector('[data-periop-pad-clear]').addEventListener('click', () => { context.clearRect(0, 0, canvas.width, canvas.height); delete canvas.dataset.drawn; });
      section.querySelector('[data-periop-pad-done]').addEventListener('click', () => {
        if (!canvas.dataset.drawn) return;
        useSign(section, { method: 'drawn', image: canvas.toDataURL('image/png'), signedAt: Date.now() });
      });
    }
    const file = section.querySelector('[data-periop-thumb-file]');
    section.querySelector('[data-periop-thumb]')?.addEventListener('click', () => file.click());
    file?.addEventListener('change', async () => {
      const picked = file.files?.[0];
      if (!picked) return;
      try { useSign(section, { method: 'thumbprint', image: await shrinkPhoto(picked), signedAt: Date.now() }); } catch (error) { message(error.message); }
    });
    section.querySelector('[data-periop-scanner]')?.addEventListener('click', async () => {
      try {
        const image = await window.BorkeoFingerprintScanner.capture();
        if (image) useSign(section, { method: 'scanner', image, signedAt: Date.now() });
      } catch (error) { message(error.message); }
    });
  }

  function useSign(section, captured) {
    const { sign } = collect(section);
    draftSign = { ...sign, ...captured };
    const { data } = collect(section);
    render();
    // Keep the fields typed before the signature was taken.
    Object.entries(data).forEach(([name, value]) => {
      const control = panel().querySelector(`[data-periop-field="${CSS.escape(name)}"]`);
      if (!control) return;
      if (control.type === 'checkbox') control.checked = value === true; else control.value = value;
    });
    message(plain('forms.signatureReady', 'Signature taken. Press Save to keep it.'));
  }

  // Thumbprint photo: resized to at most 800 px, JPEG (kept under the server limit).
  function shrinkPhoto(fileObject) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the photo.'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Could not read the photo.'));
        img.onload = () => {
          const scale = Math.min(1, 800 / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
          canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(fileObject);
    });
  }

  // ---------------- Print (letterhead, patient, form, signatures) ----------------
  function printForm({ data, sign }) {
    const type = current.type;
    const def = FORMS[type];
    const form = entry();
    const p = patient() || {};
    const lang = english() ? 'en' : 'km';
    const value = (field) => {
      const v = data[field.name];
      if (field.type === 'checkbox') return v === true ? '☑' : '☐';
      const option = field.type === 'select' && field.options.find((o) => typeof o !== 'string' && o.value === v);
      if (option) return optionText(option);
      return escapeHtml(String(v ?? '').replace('T', ' '));
    };
    const letterhead = window.EmrLetterhead?.renderLetterhead({ lang, title: titlePlain(type) }) || `<h2>${title(type)}</h2>`;
    const grid = window.EmrLetterhead?.renderPatientGrid({
      lang, caseId: p.caseNumber || p.healthId || '', department: p.departmentNameKh || p.departmentNameEn || p.departmentCode || '',
      fullName: p.fullName || '', sex: p.sex || '', age: p.age || '', diagnosis: document.getElementById('dash_diag')?.innerText || '—',
    }) || '';
    const signLine = (heading, image, name, extra = '') => `<div class="periop-print-sign"><div class="periop-print-sign-title">${heading}</div>
      <div class="periop-print-sign-box">${image ? `<img src="${escapeHtml(image)}" alt="">` : ''}</div><div>${escapeHtml(name || '')}${extra}</div></div>`;
    const patientBlock = def.text ? `<div class="periop-print-signatures">
      ${signLine(label('form.patientSignature', 'Patient or representative signature'), sign.image, sign.signerName,
        sign.relationship ? ` · ${escapeHtml(sign.relationship)}` : '')}
      ${signLine(label('form.witness', 'Witness'), '', sign.witnessName)}</div>` : '';
    const staffBlock = `<div class="periop-print-signatures">${(SLOTS[type] || []).map((slot) => {
      const sig = form?.signatures?.[slot];
      return signLine(SLOT[slot](), sig?.signatureDataUrl, sig?.signerName, sig ? ` · ${escapeHtml(new Date(sig.signedAt).toLocaleString())}` : '');
    }).join('')}</div>`;
    const layout = document.getElementById('periop-print-layout') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'periop-print-layout' }));
    layout.innerHTML = `<div class="periop-print-sheet">${letterhead}${grid}
      <p class="periop-print-date"><strong>${label('', 'Date', 'កាលបរិច្ឆេទ')}:</strong> ${escapeHtml(current.date)}</p>
      <table class="periop-print-table">${def.fields.map((field) => `<tr><th>${fieldText(field)}</th><td>${value(field)}</td></tr>`).join('')}</table>
      ${def.babies ? Array.from({ length: babyCountOf(data) }, (_, i) => i + 1).map((n) => `<h4>${label('newborn.baby', 'Baby')} ${n}</h4>
        <table class="periop-print-table">${def.babyFields.map((field) => babyField(n, field)).map((field) => `<tr><th>${fieldText(field)}</th><td>${value(field)}</td></tr>`).join('')}
        <tr><th>${label('', 'Immediate newborn care', 'ការថែទាំភ្លាមៗក្រោយកើត')}</th><td>${newbornCare.map((item) => `${data[`b${n}.${item}`] === true ? '☑' : '☐'} ${label(item, NEWBORN_EN[item] || item)}`).join('<br>')}</td></tr>
        <tr><th>${label('', 'Birth vaccines', 'ថ្នាំបង្ការពេលកើត')}</th><td>${birthVaccines.map((item) => `${label(item, NEWBORN_EN[item] || item)}: ${escapeHtml(data[`b${n}.${item}`] || '—')}`).join('<br>')}</td></tr></table>`).join('') : ''}
      ${def.checklist ? whoChecklist.map((group) => `<h4>${label(group.section, WHO_EN[group.section] || group.section)}</h4><ul class="periop-print-list">${group.items.map((item) => `<li>${data[item] === true ? '☑' : '☐'} ${label(item, WHO_EN[item] || item)}</li>`).join('')}</ul>`).join('') : ''}
      ${def.text ? `<p class="periop-print-consent">${label(def.text[0], CONSENT_EN[def.text[1]])}</p>` : ''}
      ${patientBlock}${staffBlock}</div>`;
    window.printEmrReport?.({ selectors: ['#periop-print-layout'], classes: ['print-periop'], title: titlePlain(type) });
  }

  // ---------------- Wiring ----------------
  document.addEventListener('emr:patient-loaded', () => window.setTimeout(() => { ensureLaunchers(); ensureDeliveryLauncher(); forms = []; draftData = null; if (panel()?.open) load(); }, 0));
  window.addEventListener('emr-session-ready', render);
  window.addEventListener('borkeo-language-change', () => { labelTab(); render(); });
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ensureLaunchers, { once: true }); else ensureLaunchers();
  window.EmrPeriopForms = { load, render, open: (type, date) => { current = { type, date: date || today() }; draftData = null; draftSign = null; openWindow(); }, forms: () => forms, fromDelivery };
})();
