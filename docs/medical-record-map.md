# Medical record map (Phase 0 investigation)

Version 40.5.0 code, read on 2026-10-21. Field lists were taken from the live
page (headless Edge, ward doctor, synthetic test copy of the demo database), so
ids, storage keys and labels are exactly what the browser uses. Labels are
copied from the page, not typed.

## 1. How every field is saved and loaded

- **One record per encounter.** All fields of registration, triage, OPD, IPD,
  daily follow-up and nursing are saved together as one JSON object
  (`patient_records.record_json`) by `PUT /api/patient-record`.
- **Storage key per control** — `prepareStorageKeys()` in
  `public/emr-patient-record.js:204`:
  - Scope from position: inside `#page1` → `registration`, `#page2` →
    `triage`, `#sub_nursing` → `nursing`, rest of `#page3` (OPD, IPD, daily
    follow-up modal, discharge…) → `medical`.
  - Control **with an id** → `scope:<scope>:id:<id>`.
  - Control **without an id** → `scope:<scope>:auto:<N>`, where N is its
    **position** among all controls of that scope in document order.
  - Every control (with or without id) counts toward N, except controls with
    `data-emr-no-auto-index` or `data-emr-transient`.
  - Fallback keys for very old records: `id:<id>` or `auto:<global position>`.
  - `data-emr-migrate-auto-key`: a control that was given an id later still
    loads its old `scope:…:auto:N` value.
- **Values:** checkboxes and radios save `true`/`false`; inputs, selects and
  textareas save text; contenteditable saves its text
  (`collectRecordData`, `emr-patient-record.js:259`).
- **Loading:** `restoreRecordData()` (`emr-patient-record.js:353`) tries the new
  key, then the legacy key, then the previous (migrated) key.
- **Server checks:** the server stores whatever keys arrive but enforces who may
  write each scope. Doctors write `scope:medical:*`, nurses `scope:nursing:*`
  (server/access.mjs, encounter-access.mjs, routes/patients.mjs).
- **Structured values** saved alongside the fields:
  - `system:dailyMonitoringRecords`: the daily follow-up notes, a JSON array of
    each card's `_monitoringCopyData`.
  - `system:initialIpdMedications`, `system:opdMedications`.
  - `system:discharge`, `system:ipdDischargeSummary`.
  - `system:signature:medical`, written by the server.

### ⚠ Main risk for Phases 1–3: position keys

| record | controls | with id | position keys (`auto:N`) |
|---|---|---|---|
| IPD `#sub_ipd` | 219 | 67 | **47** |
| OPD `#sub_opd` | 166 | 23 | **38** |
| Daily follow-up `#mon_modal` | 120 | 14 | 1 |

The `medical` counter runs across the whole of `#page3` in document order (OPD
first, then IPD, then the follow-up modal and later forms). If any of these 86
controls is moved into a SOAP box, or a new control without
`data-emr-no-auto-index` is inserted before them, every later position key
shifts. Old records would then load text into the wrong boxes, with no error.

**Proposed rule for Phase 1** (not done yet):
1. Before moving anything, freeze every current `medical` position key on its
   element. For example, a new attribute `data-emr-fixed-storage-key` holds
   today's `scope:medical:auto:N` and legacy `auto:N`, and
   `prepareStorageKeys()` uses it in place of the counted position.
2. Every new control gets `data-emr-no-auto-index`.
3. A test loads an old synthetic record saved with today's keys and checks that
   every value lands in the same element after the move.

## 2. Who reads these fields besides save/load

| reader | file | what it reads |
|---|---|---|
| IPD print | `EMR.html` `printIpdRecord()` | prints the **live `#sub_ipd` DOM** plus `#print-rx-layout`; print CSS classes `print-forms print-ipd-record`. Moving fields changes the print order automatically. |
| OPD print | `EMR.html` `printTriageOpdRx()` | prints the live `#sub_opd` DOM (`print-opd-rx`) after `populateRxPrintData('opd')`, `populateOpdDoctorPrintSignature()` |
| Prescription sheet | `EMR.html` `printPrescription()` | `#print-rx-layout`, filled from the OPD/IPD medicine rows; signature from `system:signature:medical` |
| Daily follow-up print | `EMR.html` `printMonitoringRecords()` / `buildMonitoringPrintRow()` | `_monitoringCopyData` of each card (`soap`, `evol`, `conclusion`, `icd10`, `diagnoses`, vitals, `medications`), letterhead from `EmrLetterhead`, patient from `#dash_*` |
| Previous records panel | `public/emr-inpatient-workflow.js` `encounterSummaryFacts()` (~1137) via `/api/patient-history` | `pmrs_chief_complaint`, `emr_pmrs_opd_diagnosis`, `diag_input`, `opd_treatment`, `ipd_history_present_illness`, `emr_pmrs_ipd_diagnosis`, `inv_list`, `ipd_investigations`, `system:opdMedications`, `system:initialIpdMedications`, `system:dailyMonitoringRecords` (`evol`, `conclusion`, `medications`), `system:ipdDischargeSummary`, `system:discharge` |
| Editor history | `server/editor-history.mjs` `saveEditorHistory()`; panel `emr-patient-record.js` `editorHistoryPanel()` | every changed `scope:medical:*` string value, **labelled by its storage key**; Admin/Director also see per-field before/after (`patientRecordChangeNotes`) |
| PMRS2 mapping | `server/pmrs2-mapping.mjs` | `emr_pmrs_ipd_diagnosis`, `emr_pmrs_ipd_icd10`, `emr_pmrs_opd_diagnosis`, `diag_input`, `ipd_history_present_illness`, `web_rx_counsel_note`, `web_opd_followup`, `emr_pmrs_case_new/old`, triage vitals `p2_*`, `pmrs_chief_complaint`, `system:dailyMonitoringRecords`, `system:discharge` |
| PMRS2 normal exam text | `public/pmrs2-exam-normal.js` | 42 IPD examination field ids (the "mark all normal" KH/EN/FR control) |
| Discharge form | `public/emr-inpatient-workflow.js` `fillDischargeForm()` (~716) | `emr_pmrs_ipd_diagnosis`, `emr_pmrs_ipd_icd10`, registration date/time, last daily follow-up medicines (`fillDischargePrescription`) |
| Patient banner | `public/patient-banner.js` | `emr_pmrs_ipd_diagnosis`, `emr_pmrs_opd_diagnosis`, `emr_pmrs_ipd_icd10`, `emr_pmrs_opd_icd10`, `bed_id`, `emr_pmrs_ipd_allergy`, `emr_pmrs_opd_allergy` (**the two allergy keys do not exist on any field**, so the banner always shows "no allergy". See section 4.) |
| Ward medicines / approvals | `server/ward-medicines.mjs`, `server/ward-medicine-approvals.mjs` | `ipd_first_exam_date`, `emr_pmrs_ipd_icd10`, `emr_ipd_diagnoses`, `system:dailyMonitoringRecords` |
| Daily report | `server/daily-report.mjs` | `diag_input`, `emr_pmrs_opd_diagnosis`, `emr_opd_diagnoses`, `diag_output` |
| Server save hooks | `server/server.mjs` | `ipd_first_exam_date` (827), `inv_list` (1299), `system:dailyMonitoringRecords` validation (1420), summary fields (1498–1512) |
| Ward access | `server/access.mjs` | `opd-ipd-transfer-ward`, `emr_pmrs_opd_diagnosis` (who may open an OPD patient) |
| Permissions / read-only | `public/emr-permissions.js`, `public/emr-encounter-editor.js` | sub-tab ids `sub_ipd`, `sub_opd`, `#daily_monitoring_feed` buttons and inputs |
| Paraclinic append | `public/paraclinic.js`, `public/requests.js` | OPD/IPD investigation fields and diagnoses |

The "other code that reads it" column in the tables below lists, per field, every
file that mentions its id or storage key. `EMR.html(inline xN)` means N extra
mentions in EMR.html's own scripts. Test counts are in the last column.

## 3. Diagnoses: `public/emr-diagnoses.js`

- Three editors: `opd` (code `diag_input`, text `emr_pmrs_opd_diagnosis`, list
  `emr_opd_diagnoses`), `ipd` (`emr_pmrs_ipd_icd10`, `emr_pmrs_ipd_diagnosis`,
  `emr_ipd_diagnoses`) and `followup` (`mon_input_icd10`,
  `mon_input_conclusion`, no list field).
- **The FIRST code in the list is treated as the primary code.** `sync()` writes
  `items[0].icd10` into the code field (`diag_input` / `emr_pmrs_ipd_icd10`).
  PMRS2, discharge, ward medicines, the banner and the daily report read that
  field.
- The list field holds all codes as JSON `[{icd10, text}]`. There is no explicit
  "main" flag today.
- Old records without a list: `restore()` rebuilds a one-item list from the code
  and text fields.
- The daily follow-up shows `diagnoses.slice(1)` as "extra" diagnoses in its
  card and print, so the first is also treated as main there.

## 4. Things found that matter for later phases

1. **A SOAP daily follow-up already exists** (`public/soap-note.js` +
   `soap-note.css`, from v39.x):
   - `#mon_modal` has `mon_soap_s/o/a/p` textareas with letter boxes, status
     dots, collapse, "copy from previous note" and "pull latest results".
   - S and A are required on save.
   - It keeps the old `mon_input_evol` ("S: … / O: …") and
     `mon_input_conclusion` ("A: … / P: …") in sync. Cards and print show the
     four sections; old notes show a "legacy note" card.
   - Phase 3 should extend this component, not build a second one.
   - It also contains Khmer UI strings that are now in the baseline.
2. **IPD and OPD print the live form.** The SOAP layout will print as it looks
   on screen, so print CSS must be checked in Phase 1/2.
3. **Allergy safety bug** (found earlier, not yet fixed):
   - The banner reads `scope:medical:id:emr_pmrs_ipd_allergy` and `…opd_allergy`.
   - The IPD drug-allergy text box (ប្រតិកម្មនឹងថ្នាំ, in personal history)
     has no id. It saves as a position key, so the banner always says
     "no allergy".
   - Fix it in Phase 4, or earlier if you say so.
4. **Obstetric/gynaecological history rule conflict:**
   - Today the section shows for any female patient
     (`updateIpdObGynVisibility`, `emr-patient-record.js:502`).
   - On 2026-10-21 you asked for **female and 14 years or older**.
   - The Phase 5 plan says **female 10–54**, with a manual show toggle.
   - Please choose one.
5. **Pending request from 2026-10-21, not yet coded:**
   - Auto-growing text boxes in the medical record (option a: medical record
     only).
   - Separate drug and food allergy fields.
   - Allergy note in the banner from those fields.
   - Red drug-allergy box in the bed popup.
   - These overlap Phases 1, 4 and 5.
6. `#mon_modal` controls are in the `medical` scope, after OPD and IPD. Its SOAP
   textareas count toward the position counter but sit after every existing
   auto key, so they shift nothing today.

## 5. Field tables

### IPD admission record (#sub_ipd) — 219 controls, 47 with position keys

| # | section (from page) | label (from page) | element | id | saved as | other code that reads it | tests |
|---|---|---|---|---|---|---|---|
| 1 | ១. សញ្ញាជីវិត | សម្ពាធឈាម: | input[text] | `ipd_bp_sys` | text → `scope:medical:id:ipd_bp_sys` | EMR.html(inline x1) |  |
| 2 | ១. សញ្ញាជីវិត | / | input[text] | `ipd_bp_dia` | text → `scope:medical:id:ipd_bp_dia` | EMR.html(inline x1) |  |
| 3 | ១. សញ្ញាជីវិត | ជីពចរ: | input[text] | `ipd_pulse` | text → `scope:medical:id:ipd_pulse` | EMR.html(inline x1) |  |
| 4 | ១. សញ្ញាជីវិត | ចង្វាក់ដង្ហើម: | input[text] | `ipd_resp` | text → `scope:medical:id:ipd_resp` | EMR.html(inline x4) |  |
| 5 | ១. សញ្ញាជីវិត | សីតុណ្ហភាព: | input[text] | `ipd_temp` | text → `scope:medical:id:ipd_temp` | EMR.html(inline x1) |  |
| 6 | ១. សញ្ញាជីវិត | អុកស៊ីសែនក្នុងឈាម: | input[text] | `ipd_spo2` | text → `scope:medical:id:ipd_spo2` | EMR.html(inline x4) |  |
| 7 | ១. សញ្ញាជីវិត | កម្ពស់: | input[text] | `ipd_height` | text → `scope:medical:id:ipd_height` | EMR.html(inline x4) |  |
| 8 | ១. សញ្ញាជីវិត | ទម្ងន់: | input[text] | `ipd_weight` | text → `scope:medical:id:ipd_weight` | EMR.html(inline x4) |  |
| 9 | ២. មូលហេតុចូល: | ២. មូលហេតុចូល: | textarea | — | text → `scope:medical:auto:67` **position key** | — |  |
| 10 | ៣. ប្រវត្តិជំងឺបច្ចុប្បន្ន: | ៣. ប្រវត្តិជំងឺបច្ចុប្បន្ន: | textarea | `ipd_history_present_illness` | text → `scope:medical:id:ipd_history_present_illness` (old: `scope:medical:auto:68`) | emr-inpatient-workflow.js, pmrs2-mapping.mjs | 3 |
| 11 | ៤. សញ្ញាតម្អូញផេ្សងទៀត: | ក្អក > ១៤ថ្ងៃ | input[checkbox] | — | true/false → `scope:medical:auto:69` **position key** | — |  |
| 12 | ៤. សញ្ញាតម្អូញផេ្សងទៀត: | ក្តៅខ្លួន > ១៤ថ្ងៃ | input[checkbox] | — | true/false → `scope:medical:auto:70` **position key** | — |  |
| 13 | ៤. សញ្ញាតម្អូញផេ្សងទៀត: | បែកញើសពេលយប់ > ១៤ថ្ងៃ | input[checkbox] | — | true/false → `scope:medical:auto:71` **position key** | — |  |
| 14 | ៤. សញ្ញាតម្អូញផេ្សងទៀត: | ស្រកទម្ងន់ > ១៤ថ្ងៃ | input[checkbox] | — | true/false → `scope:medical:auto:72` **position key** | — |  |
| 15 | ៤. សញ្ញាតម្អូញផេ្សងទៀត: | ក្អក > ១៤ថ្ងៃ ក្តៅខ្លួន > ១៤ថ្ងៃ បែកញើសពេលយប់ > ១៤ថ្ងៃ ស្រកទម្ងន់ > ១៤ថ្ងៃ | textarea | — | text → `scope:medical:auto:73` **position key** | — |  |
| 16 | ៥. ឱសថដែលកំពុងប្រើព្យាបាល: | ៥. ឱសថដែលកំពុងប្រើព្យាបាល: | textarea | — | text → `scope:medical:auto:74` **position key** | — |  |
| 17 | 1: សាវតារោគផ្ទាល់ខ្លួន | BCG / HepB0 | input[checkbox] | — | true/false → `scope:medical:auto:75` **position key** | — |  |
| 18 | 1: សាវតារោគផ្ទាល់ខ្លួន | OPV+DPT-HepB-Hib1 | input[checkbox] | — | true/false → `scope:medical:auto:76` **position key** | — |  |
| 19 | 1: សាវតារោគផ្ទាល់ខ្លួន | OPV-HepB-Hib2 | input[checkbox] | — | true/false → `scope:medical:auto:77` **position key** | — |  |
| 20 | 1: សាវតារោគផ្ទាល់ខ្លួន | OPV+DPT-HepB-Hib3 | input[checkbox] | — | true/false → `scope:medical:auto:78` **position key** | — |  |
| 21 | 1: សាវតារោគផ្ទាល់ខ្លួន | Measles+JE | input[checkbox] | — | true/false → `scope:medical:auto:79` **position key** | — |  |
| 22 | 1: សាវតារោគផ្ទាល់ខ្លួន | Tetanus | input[checkbox] | — | true/false → `scope:medical:auto:80` **position key** | — |  |
| 23 | 1: សាវតារោគផ្ទាល់ខ្លួន | None | input[checkbox] | — | true/false → `scope:medical:auto:81` **position key** | — |  |
| 24 | 1: សាវតារោគផ្ទាល់ខ្លួន | ប្រតិកម្មនឹងថ្នាំ: | input[checkbox] | — | true/false → `scope:medical:auto:82` **position key** | — |  |
| 25 | 1: សាវតារោគផ្ទាល់ខ្លួន | ប្រតិកម្មនឹងថ្នាំ: | input[text] | — | text → `scope:medical:auto:83` **position key** | — |  |
| 26 | 1: សាវតារោគផ្ទាល់ខ្លួន | លើសសម្ពាធឈាម | input[checkbox] | — | true/false → `scope:medical:auto:84` **position key** | — |  |
| 27 | 1: សាវតារោគផ្ទាល់ខ្លួន | ជំងឺទឹកនោមផ្អែម | input[checkbox] | — | true/false → `scope:medical:auto:85` **position key** | — |  |
| 28 | 1: សាវតារោគផ្ទាល់ខ្លួន | ជំងឺរបេង | input[checkbox] | — | true/false → `scope:medical:auto:86` **position key** | — |  |
| 29 | 1: សាវតារោគផ្ទាល់ខ្លួន | ជំងឺបេះដូង | input[checkbox] | — | true/false → `scope:medical:auto:87` **position key** | — |  |
| 30 | 1: សាវតារោគផ្ទាល់ខ្លួន | វះកាត់ | input[checkbox] | — | true/false → `scope:medical:auto:88` **position key** | — |  |
| 31 | 1: សាវតារោគផ្ទាល់ខ្លួន | វះកាត់ | input[text] | — | text → `scope:medical:auto:89` **position key** | — |  |
| 32 | 1: សាវតារោគផ្ទាល់ខ្លួន | ជក់បារី | input[checkbox] | — | true/false → `scope:medical:auto:90` **position key** | — |  |
| 33 | 1: សាវតារោគផ្ទាល់ខ្លួន | ផឹកស្រា | input[checkbox] | — | true/false → `scope:medical:auto:91` **position key** | — |  |
| 34 | 1: សាវតារោគផ្ទាល់ខ្លួន | ប្រើគ្រឿងញៀន | input[checkbox] | — | true/false → `scope:medical:auto:92` **position key** | — |  |
| 35 | 1: សាវតារោគផ្ទាល់ខ្លួន | បញ្ហាផ្លូវចិត្ត | input[checkbox] | — | true/false → `scope:medical:auto:93` **position key** | — |  |
| 36 | 1: សាវតារោគផ្ទាល់ខ្លួន | ផ្សេងៗ: | input[text] | — | text → `scope:medical:auto:94` **position key** | — |  |
| 37 | 1: សាវតារោគផ្ទាល់ខ្លួន | G: | input[text] | `ipd_obgyn_g` | text → `scope:medical:id:ipd_obgyn_g` | — | 1 |
| 38 | 1: សាវតារោគផ្ទាល់ខ្លួន | P: | input[text] | `ipd_obgyn_p` | text → `scope:medical:id:ipd_obgyn_p` | — | 1 |
| 39 | 1: សាវតារោគផ្ទាល់ខ្លួន | A: | input[text] | `ipd_obgyn_a` | text → `scope:medical:id:ipd_obgyn_a` | — | 1 |
| 40 | 1: សាវតារោគផ្ទាល់ខ្លួន | L (កូនរស់): | input[text] | `ipd_obgyn_l` | text → `scope:medical:id:ipd_obgyn_l` | — | 1 |
| 41 | 1: សាវតារោគផ្ទាល់ខ្លួន | កាលបរិច្ឆេទមករដូវចុងក្រោយ (LMP): | input[date] | `ipd_obgyn_lmp` | text → `scope:medical:id:ipd_obgyn_lmp` | EMR.html(inline x3) | 1 |
| 42 | 1: សាវតារោគផ្ទាល់ខ្លួន | ថ្ងៃរំពឹងសម្រាល (EDD): | input[date] | `ipd_obgyn_edd` | text → `scope:medical:id:ipd_obgyn_edd` | EMR.html(inline x3) | 1 |
| 43 | 1: សាវតារោគផ្ទាល់ខ្លួន | វិធីពន្យារកំណើត: | input[text] | `ipd_obgyn_contra` | text → `scope:medical:id:ipd_obgyn_contra` | EMR.html(inline x3) | 1 |
| 44 | 1: សាវតារោគផ្ទាល់ខ្លួន | កំណត់សម្គាល់/ផ្សេងៗ: | input[text] | `ipd_obgyn_notes` | text → `scope:medical:id:ipd_obgyn_notes` | EMR.html(inline x3) | 1 |
| 45 | 3: សាវតាក្នុងគ្រួសារ | 3: សាវតាក្នុងគ្រួសារ | textarea | — | text → `scope:medical:auto:95` **position key** | — |  |
| 46 | 4: សាវតារោគក្នុងសហគមន៍ | 4: សាវតារោគក្នុងសហគមន៍ | textarea | `ipd_community_history` | text → `scope:medical:id:ipd_community_history` | — | 1 |
| 47 | ៧. ការពិនិត្យរាង្គកាយ: | ភាសាអត្ថបទធម្មតា: | select | `ipd_exam_normal_language` | text → `scope:medical:id:ipd_exam_normal_language` | EMR.html(inline x1), pmrs2-exam-normal.js | 1 |
| 48 | · សភាពទូទៅ: | ល្អ | input[radio] | `ipd_exam_general_good` | true/false → `scope:medical:id:ipd_exam_general_good` (old: `scope:medical:auto:96`) | pmrs2-exam-normal.js |  |
| 49 | · សភាពទូទៅ: | មិនសូវល្អ | input[radio] | `ipd_exam_general_fair` | true/false → `scope:medical:id:ipd_exam_general_fair` (old: `scope:medical:auto:97`) | pmrs2-exam-normal.js |  |
| 50 | · សភាពទូទៅ: | ធ្ងន់ធ្ងរ | input[radio] | `ipd_exam_general_severe` | true/false → `scope:medical:id:ipd_exam_general_severe` (old: `scope:medical:auto:98`) | pmrs2-exam-normal.js |  |
| 51 | · សភាពទូទៅ: | ធ្ងន់ធ្ងរខ្លាំង | input[radio] | `ipd_exam_general_very_severe` | true/false → `scope:medical:id:ipd_exam_general_very_severe` (old: `scope:medical:auto:99`) | pmrs2-exam-normal.js |  |
| 52 | · សភាពទូទៅ: | សេ្លកស្លាំង | input[checkbox] | — | true/false → `scope:medical:auto:100` **position key** | — |  |
| 53 | · សភាពទូទៅ: | ទ្បើងស្វាយ | input[checkbox] | — | true/false → `scope:medical:auto:101` **position key** | — |  |
| 54 | · សភាពទូទៅ: | ខាន់លឿង | input[checkbox] | — | true/false → `scope:medical:auto:102` **position key** | — |  |
| 55 | · ប្រព័ន្ធសសៃប្រសាទ: | ដឹងខ្លួន | input[radio] | `ipd_exam_neuro_conscious` | true/false → `scope:medical:id:ipd_exam_neuro_conscious` (old: `scope:medical:auto:103`) | pmrs2-exam-normal.js | 1 |
| 56 | · ប្រព័ន្ធសសៃប្រសាទ: | រវើរវាយ | input[radio] | `ipd_exam_neuro_delirium` | true/false → `scope:medical:id:ipd_exam_neuro_delirium` (old: `scope:medical:auto:104`) | pmrs2-exam-normal.js |  |
| 57 | · ប្រព័ន្ធសសៃប្រសាទ: | សន្លប់ | input[radio] | `ipd_exam_neuro_coma` | true/false → `scope:medical:id:ipd_exam_neuro_coma` (old: `scope:medical:auto:105`) | pmrs2-exam-normal.js |  |
| 58 | · ប្រព័ន្ធសសៃប្រសាទ: | ប្រកាច់ | input[radio] | `ipd_exam_neuro_seizure` | true/false → `scope:medical:id:ipd_exam_neuro_seizure` (old: `scope:medical:auto:106`) | pmrs2-exam-normal.js |  |
| 59 | · ពិន្ទុកម្រិតស្មារតី (GCS): | ភែ្នកៈ | input[text] | `ipd_exam_gcs_eye` | text → `scope:medical:id:ipd_exam_gcs_eye` (old: `scope:medical:auto:107`) | pmrs2-exam-normal.js |  |
| 60 | · ពិន្ទុកម្រិតស្មារតី (GCS): | ការនិយាយៈ | input[text] | `ipd_exam_gcs_verbal` | text → `scope:medical:id:ipd_exam_gcs_verbal` (old: `scope:medical:auto:108`) | pmrs2-exam-normal.js |  |
| 61 | · ពិន្ទុកម្រិតស្មារតី (GCS): | ចលនាៈ | input[text] | `ipd_exam_gcs_motor` | text → `scope:medical:id:ipd_exam_gcs_motor` (old: `scope:medical:auto:109`) | pmrs2-exam-normal.js |  |
| 62 | · ពិន្ទុកម្រិតស្មារតី (GCS): | សរុបៈ | input[text] | `ipd_exam_gcs_total` | text → `scope:medical:id:ipd_exam_gcs_total` (old: `scope:medical:auto:110`) | pmrs2-exam-normal.js |  |
| 63 | · កម្រិតនៃការឈឺចាប់: | · កម្រិតនៃការឈឺចាប់: | input[text] | `ipd_exam_pain` | text → `scope:medical:id:ipd_exam_pain` (old: `scope:medical:auto:111`) | pmrs2-exam-normal.js |  |
| 64 | ផ្សេងៗ: | ផ្សេងៗ: | input[text] | `ipd_exam_neuro_other` | text → `scope:medical:id:ipd_exam_neuro_other` (old: `scope:medical:auto:112`) | pmrs2-exam-normal.js |  |
| 65 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | ក្បាល: | input[text] | `ipd_exam_head` | text → `scope:medical:id:ipd_exam_head` (old: `scope:medical:auto:113`) | pmrs2-exam-normal.js |  |
| 66 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | ឆ្វេង | input[text] | `ipd_exam_eye_left` | text → `scope:medical:id:ipd_exam_eye_left` (old: `scope:medical:auto:114`) | pmrs2-exam-normal.js |  |
| 67 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | ស្តាំ | input[text] | `ipd_exam_eye_right` | text → `scope:medical:id:ipd_exam_eye_right` (old: `scope:medical:auto:115`) | pmrs2-exam-normal.js |  |
| 68 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | បាតភ្នែក: | input[text] | `ipd_exam_fundus` | text → `scope:medical:id:ipd_exam_fundus` (old: `scope:medical:auto:116`) | pmrs2-exam-normal.js |  |
| 69 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | ឆ្វេង | input[text] | `ipd_exam_ear_left` | text → `scope:medical:id:ipd_exam_ear_left` (old: `scope:medical:auto:117`) | pmrs2-exam-normal.js |  |
| 70 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | ស្តាំ | input[text] | `ipd_exam_ear_right` | text → `scope:medical:id:ipd_exam_ear_right` (old: `scope:medical:auto:118`) | pmrs2-exam-normal.js |  |
| 71 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | ច្រមុះ: | input[text] | `ipd_exam_nose` | text → `scope:medical:id:ipd_exam_nose` (old: `scope:medical:auto:119`) | pmrs2-exam-normal.js |  |
| 72 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | បំពង់ក: | input[text] | `ipd_exam_throat` | text → `scope:medical:id:ipd_exam_throat` (old: `scope:medical:auto:120`) | pmrs2-exam-normal.js |  |
| 73 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | ក: | input[text] | `ipd_exam_neck` | text → `scope:medical:id:ipd_exam_neck` (old: `scope:medical:auto:121`) | pmrs2-exam-normal.js |  |
| 74 | · ក្បាល, ភ្នែក,ត្រចៀក, ច្រមុះ, បំពង់ក | ប្រព័ន្ធកូនកណ្តុល: | input[text] | `ipd_exam_lymph` | text → `scope:medical:id:ipd_exam_lymph` (old: `scope:medical:auto:122`) | pmrs2-exam-normal.js |  |
| 75 | · ប្រដាប់ដកដង្ហើម: | មើល: | input[text] | `ipd_exam_resp_inspection` | text → `scope:medical:id:ipd_exam_resp_inspection` (old: `scope:medical:auto:123`) | pmrs2-exam-normal.js |  |
| 76 | · ប្រដាប់ដកដង្ហើម: | ស្តាប់: | input[text] | `ipd_exam_resp_auscultation` | text → `scope:medical:id:ipd_exam_resp_auscultation` (old: `scope:medical:auto:124`) | pmrs2-exam-normal.js |  |
| 77 | · ប្រដាប់ដកដង្ហើម: | ស្ទាប: | input[text] | `ipd_exam_resp_palpation` | text → `scope:medical:id:ipd_exam_resp_palpation` (old: `scope:medical:auto:125`) | pmrs2-exam-normal.js |  |
| 78 | · ប្រដាប់ដកដង្ហើម: | គោះ: | input[text] | `ipd_exam_resp_percussion` | text → `scope:medical:id:ipd_exam_resp_percussion` (old: `scope:medical:auto:126`) | pmrs2-exam-normal.js |  |
| 79 | · ប្រដាប់បេះដូង និងឈាមរត់: | មើល: | input[text] | `ipd_exam_cvs_inspection` | text → `scope:medical:id:ipd_exam_cvs_inspection` (old: `scope:medical:auto:127`) | pmrs2-exam-normal.js |  |
| 80 | · ប្រដាប់បេះដូង និងឈាមរត់: | ស្តាប់: | input[text] | `ipd_exam_cvs_auscultation` | text → `scope:medical:id:ipd_exam_cvs_auscultation` (old: `scope:medical:auto:128`) | pmrs2-exam-normal.js | 2 |
| 81 | · ប្រដាប់បេះដូង និងឈាមរត់: | ស្ទាប: | input[text] | `ipd_exam_cvs_palpation` | text → `scope:medical:id:ipd_exam_cvs_palpation` (old: `scope:medical:auto:129`) | pmrs2-exam-normal.js |  |
| 82 | · ប្រដាប់បេះដូង និងឈាមរត់: | គោះ: | input[text] | `ipd_exam_cvs_percussion` | text → `scope:medical:id:ipd_exam_cvs_percussion` (old: `scope:medical:auto:130`) | pmrs2-exam-normal.js |  |
| 83 | · ពោះ: | មើល: | input[text] | `ipd_exam_abd_inspection` | text → `scope:medical:id:ipd_exam_abd_inspection` (old: `scope:medical:auto:131`) | pmrs2-exam-normal.js |  |
| 84 | · ពោះ: | ស្តាប់: | input[text] | `ipd_exam_abd_auscultation` | text → `scope:medical:id:ipd_exam_abd_auscultation` (old: `scope:medical:auto:132`) | pmrs2-exam-normal.js |  |
| 85 | · ពោះ: | ស្ទាប: | input[text] | `ipd_exam_abd_palpation` | text → `scope:medical:id:ipd_exam_abd_palpation` (old: `scope:medical:auto:133`) | pmrs2-exam-normal.js |  |
| 86 | · ពោះ: | គោះ: | input[text] | `ipd_exam_abd_percussion` | text → `scope:medical:id:ipd_exam_abd_percussion` (old: `scope:medical:auto:134`) | pmrs2-exam-normal.js |  |
| 87 | · ប្រដាប់បន្តពូជ និងទឹកនោម: | · ប្រដាប់បន្តពូជ និងទឹកនោម: | input[text] | `ipd_exam_gu` | text → `scope:medical:id:ipd_exam_gu` (old: `scope:medical:auto:135`) | pmrs2-exam-normal.js |  |
| 88 | · ចុងអវៈយវៈ: | · ចុងអវៈយវៈ: | input[text] | `ipd_exam_extremities` | text → `scope:medical:id:ipd_exam_extremities` (old: `scope:medical:auto:136`) | pmrs2-exam-normal.js |  |
| 89 | · ចុងអវៈយវៈ: | CRT: | input[text] | `ipd_exam_crt` | text → `scope:medical:id:ipd_exam_crt` (old: `scope:medical:auto:137`) | pmrs2-exam-normal.js |  |
| 90 | · ប្រព័ន្ធឆ្អឹង សាច់ដុំ សន្លាក់: | · ប្រព័ន្ធឆ្អឹង សាច់ដុំ សន្លាក់: | input[text] | `ipd_exam_msk` | text → `scope:medical:id:ipd_exam_msk` (old: `scope:medical:auto:138`) | pmrs2-exam-normal.js |  |
| 91 | · ប្រព័ន្ធផេ្សងទៀត: | · ប្រព័ន្ធផេ្សងទៀត: | input[text] | `ipd_exam_other` | text → `scope:medical:id:ipd_exam_other` (old: `scope:medical:auto:139`) | pmrs2-exam-normal.js |  |
| 92 | រោគវិនិច្ឆ័យបឋម: | រោគវិនិច្ឆ័យបឋម: | textarea | — | text → `scope:medical:auto:140` **position key** | — |  |
| 93 | រោគវិនិច្ឆ័យញែកជំងឺ: | រោគវិនិច្ឆ័យញែកជំងឺ: | textarea | — | text → `scope:medical:auto:141` **position key** | — |  |
| 94 | ពិនិត្យអមគ្លីនិក: | ពិនិត្យអមគ្លីនិក: | textarea | `ipd_investigations` | text → `scope:medical:id:ipd_investigations` (old: `scope:medical:auto:142`) | emr-inpatient-workflow.js, paraclinic.js | 2 |
| 95 | រោគវិនិច្ឆ័យ ICD-10 | រោគវិនិច្ឆ័យ ICD-10 | input[hidden] | `emr_pmrs_ipd_icd10` | text → `scope:medical:id:emr_pmrs_ipd_icd10` | EMR.html(inline x5), emr-diagnoses.js, emr-icd10.js, emr-inpatient-workflow.js, patient-banner.js, pmrs2-mapping.mjs, ward-medicines.mjs, EMR.html(inline x1) | 4 |
| 96 | រោគវិនិច្ឆ័យ ICD-10 | រោគវិនិច្ឆ័យ ICD-10 | input[hidden] | `emr_ipd_diagnoses` | text → `scope:medical:id:emr_ipd_diagnoses` | EMR.html(inline x3), emr-diagnoses.js, ward-medicines.mjs, EMR.html(inline x1) | 1 |
| 97 | រោគវិនិច្ឆ័យ ICD-10 | វាយលេខកូដ ICD-10 (ឧ. A90) ឬឈ្មោះជំងឺ... | input[text] | — | text → `scope:medical:auto:143` **position key** | — |  |
| 98 | រោគវិនិច្ឆ័យ ICD-10 | កំណត់សម្គាល់បន្ថែម ឬរោគវិនិច្ឆ័យពិស្ដារ... | textarea | `emr_pmrs_ipd_diagnosis` | text → `scope:medical:id:emr_pmrs_ipd_diagnosis` (old: `scope:medical:auto:144`) | EMR.html(inline x4), emr-diagnoses.js, emr-icd10.js, emr-inpatient-workflow.js, paraclinic.js, patient-banner.js, pmrs2-mapping.mjs, server.mjs, EMR.html(inline x1) | 4 |
| 99 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 100 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 101 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 102 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 103 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 104 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 105 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 106 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 107 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 108 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 109 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 110 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 111 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 112 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 113 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 114 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 6 | input[number] | — | not saved | — |  |
| 115 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 6 | select | — | not saved | — |  |
| 116 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 117 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 118 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 119 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 120 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 121 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 122 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 123 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 124 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 125 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 126 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 127 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 128 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 129 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 130 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 131 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 132 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 133 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 134 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 135 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 7 | input[number] | — | not saved | — |  |
| 136 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 7 | select | — | not saved | — |  |
| 137 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 138 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 139 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 140 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 141 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 142 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 143 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 144 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 145 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 146 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 147 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 148 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 149 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 150 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 151 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 152 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 153 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 154 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 155 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 156 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 8 | input[number] | — | not saved | — |  |
| 157 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 8 | select | — | not saved | — |  |
| 158 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 159 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 160 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 161 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 162 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 163 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 164 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 165 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 166 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 167 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 168 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 169 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 170 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 171 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 172 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 173 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 174 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 175 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 176 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 177 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 9 | input[number] | — | not saved | — |  |
| 178 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 9 | select | — | not saved | — |  |
| 179 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 180 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 181 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 182 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 183 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 184 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 185 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 186 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 187 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 188 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 189 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 190 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 191 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 192 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 193 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 194 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 195 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 196 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 197 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 198 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 10 | input[number] | — | not saved | — |  |
| 199 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 10 | select | — | not saved | — |  |
| 200 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 201 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 202 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 203 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 204 | ការព្យាបាលដោយអន្តរាគមន៍ផ្សេងៗ | ការព្យាបាលដោយអន្តរាគមន៍ផ្សេងៗ | textarea | `ipd_other_interventions` | text → `scope:medical:id:ipd_other_interventions` | — |  |
| 205 | ប៉ាន់ប្រម៉ាណការវិវត្តនៃជំងឺ: | ប៉ាន់ប្រម៉ាណការវិវត្តនៃជំងឺ: | textarea | — | text → `scope:medical:auto:146` **position key** | — |  |
| 206 | របបអាហារ: | ធម្មតា | input[checkbox] | — | true/false → `scope:medical:auto:147` **position key** | — |  |
| 207 | របបអាហារ: | តមប្រៃ | input[checkbox] | — | true/false → `scope:medical:auto:148` **position key** | — |  |
| 208 | របបអាហារ: | តមផ្អែម | input[checkbox] | — | true/false → `scope:medical:auto:149` **position key** | — |  |
| 209 | របបអាហារ: | ផ្សេងៗ: | input[text] | — | text → `scope:medical:auto:150` **position key** | — |  |
| 210 | តាមដាន: | សញ្ញាជីវិត រៀងរាល់ | input[checkbox] | — | true/false → `scope:medical:auto:151` **position key** | — |  |
| 211 | តាមដាន: | សញ្ញាជីវិត រៀងរាល់ | input[text] | — | text → `scope:medical:auto:152` **position key** | — |  |
| 212 | តាមដាន: | ទឹកនោម រៀងរាល់ | input[checkbox] | — | true/false → `scope:medical:auto:153` **position key** | — |  |
| 213 | តាមដាន: | ទឹកនោម រៀងរាល់ | input[text] | — | text → `scope:medical:auto:154` **position key** | — |  |
| 214 | តាមដាន: | ស្ថានភាពស្មារតី រៀងរាល់ | input[checkbox] | — | true/false → `scope:medical:auto:155` **position key** | — |  |
| 215 | តាមដាន: | ស្ថានភាពស្មារតី រៀងរាល់ | input[text] | — | text → `scope:medical:auto:156` **position key** | — |  |
| 216 | តាមដាន: | ផ្សេងៗ: | input[checkbox] | — | true/false → `scope:medical:auto:157` **position key** | — |  |
| 217 | តាមដាន: | ផ្សេងៗ: | input[text] | — | text → `scope:medical:auto:158` **position key** | — |  |
| 218 | ប៉ាន់ប្រម៉ាណការវិវត្តនៃជំងឺ: | ពេលវេលាពិនិត្យដំបូង: | input[time] | `ipd_first_exam_time` | text → `scope:medical:id:ipd_first_exam_time` (old: `scope:medical:auto:159`) | emr-patient-record.js | 1 |
| 219 | ប៉ាន់ប្រម៉ាណការវិវត្តនៃជំងឺ: | ថ្ងៃ ខែ ឆ្នាំ ពិនិត្យដំបូង: | input[date] | `ipd_first_exam_date` | text → `scope:medical:id:ipd_first_exam_date` (old: `scope:medical:auto:160`) | emr-patient-record.js, server.mjs, ward-medicine-approvals.mjs, ward-medicines.mjs | 4 |

### OPD record (#sub_opd) — 166 controls, 38 with position keys

| # | section (from page) | label (from page) | element | id | saved as | other code that reads it | tests |
|---|---|---|---|---|---|---|---|
| 1 | — | ជ្រើសរើសផ្នែកសម្រាក | select | `opd-ipd-transfer-ward` | text → `scope:medical:id:opd-ipd-transfer-ward` | emr-inpatient-workflow.js, access.mjs |  |
| 2 | — | រោគវិនិច្ឆ័យ និងមូលហេតុបញ្ជូន | textarea | `opd-referral-diagnosis` | text → `scope:medical:id:opd-referral-diagnosis` | emr-inpatient-workflow.js |  |
| 3 | — | ថ្ងៃ និងម៉ោងបញ្ជូន | input[datetime-local] | `opd-referral-datetime` | text → `scope:medical:id:opd-referral-datetime` | emr-inpatient-workflow.js |  |
| 4 | — | មធ្យោបាយបញ្ជូនមិនបានកំណត់រថយន្តសង្គ្រោះមធ្យោបាយផ្សេង | select | `opd-referral-transport` | text → `scope:medical:id:opd-referral-transport` | emr-inpatient-workflow.js |  |
| 5 | — | ទម្រង់ពិគ្រោះក្រៅ | select | `opd-module-select` | text → `scope:medical:id:opd-module-select` | EMR.html(inline x2), emr-patient-record.js, opd-clinical-storage.js, opd-specialty-theme.js |  |
| 6 | I. ប្រវត្តិជំងឺ | ក្អក > ១៤ថ្ងៃ | input[checkbox] | — | true/false → `scope:medical:auto:5` **position key** | — |  |
| 7 | I. ប្រវត្តិជំងឺ | ក្តៅខ្លួន > ១៤ថ្ងៃ | input[checkbox] | — | true/false → `scope:medical:auto:6` **position key** | — |  |
| 8 | I. ប្រវត្តិជំងឺ | បែកញើសពេលយប់ > ១៤ថ្ងៃ | input[checkbox] | — | true/false → `scope:medical:auto:7` **position key** | — |  |
| 9 | I. ប្រវត្តិជំងឺ | ស្រកទម្ងន់ > ១៤ថ្ងៃ | input[checkbox] | — | true/false → `scope:medical:auto:8` **position key** | — |  |
| 10 | I. ប្រវត្តិជំងឺ | ជិតស្និទ្ធជាមួយសមាជិកគ្រួសារ ឬអ្នកជិតខាងដែលមានជំងឺរបេង | input[checkbox] | — | true/false → `scope:medical:auto:9` **position key** | — |  |
| 11 | I. ប្រវត្តិជំងឺ | កំហាកមានឈាម | input[checkbox] | — | true/false → `scope:medical:auto:10` **position key** | — |  |
| 12 | I. ប្រវត្តិជំងឺ | HIV | input[checkbox] | — | true/false → `scope:medical:auto:11` **position key** | — |  |
| 13 | I. ប្រវត្តិជំងឺ | ខ្វះអាហារូបត្ថម្ភធ្ងន់ធ្ងរ | input[checkbox] | — | true/false → `scope:medical:auto:12` **position key** | — |  |
| 14 | I. ប្រវត្តិជំងឺ | ក្អក > ១៤ថ្ងៃ ក្តៅខ្លួន > ១៤ថ្ងៃ បែកញើសពេលយប់ > ១៤ថ្ងៃ ស្រកទម្ងន់ > ១៤ថ្ងៃ ជិតស្និទ្ធជាមួយ | textarea | — | text → `scope:medical:auto:13` **position key** | — |  |
| 15 | II. ពិនិត្យរាងកាយ | ទម្ងន់: | input[text] | `opd_weight` | text → `scope:medical:id:opd_weight` | EMR.html(inline x1), emr-patient-record.js |  |
| 16 | II. ពិនិត្យរាងកាយ | កម្ពស់: | input[text] | `opd_height` | text → `scope:medical:id:opd_height` | EMR.html(inline x1), emr-patient-record.js |  |
| 17 | II. ពិនិត្យរាងកាយ | BMI: | input[text] | `opd_bmi` | text → `scope:medical:id:opd_bmi` | EMR.html(inline x2) |  |
| 18 | II. ពិនិត្យរាងកាយ | សីតុណ្ហភាព: | input[text] | `opd_temp` | text → `scope:medical:id:opd_temp` | EMR.html(inline x1), emr-patient-record.js | 2 |
| 19 | II. ពិនិត្យរាងកាយ | សម្ពាធឈាម | input[text] | `opd_bp_sys` | text → `scope:medical:id:opd_bp_sys` | EMR.html(inline x1), emr-patient-record.js | 2 |
| 20 | II. ពិនិត្យរាងកាយ | / | input[text] | `opd_bp_dia` | text → `scope:medical:id:opd_bp_dia` | EMR.html(inline x1), emr-patient-record.js | 1 |
| 21 | II. ពិនិត្យរាងកាយ | ចង្វាក់បេះដូង: | input[text] | `opd_pulse` | text → `scope:medical:id:opd_pulse` | EMR.html(inline x1), emr-patient-record.js | 2 |
| 22 | II. ពិនិត្យរាងកាយ | ចង្វាក់ដង្ហើម: | input[text] | `opd_resp` | text → `scope:medical:id:opd_resp` | EMR.html(inline x1), emr-patient-record.js | 1 |
| 23 | II. ពិនិត្យរាងកាយ | ទម្ងន់: គ.ក (kg) កម្ពស់: ស.ម (cm) BMI: សញ្ញាជីវិត : សីតុណ្ហភាព: °C សម្ពាធឈាម / mmHg ចង្វាក | textarea | — | text → `scope:medical:auto:22` **position key** | — |  |
| 24 | III. ពិនិត្យអមគ្លីនិក | — | select | `inv_category` | text → `scope:medical:id:inv_category` | EMR.html(inline x5) |  |
| 25 | III. ពិនិត្យអមគ្លីនិក | -- ប្រភេទ -- អេកូ កាំរស្មីអ៊ិច ស៊ីទីស្កេន អឹមអអាយ ឈាម | select | `inv_sub` | text → `scope:medical:id:inv_sub` | EMR.html(inline x3) |  |
| 26 | III. ពិនិត្យអមគ្លីនិក | -- ប្រភេទ -- អេកូ កាំរស្មីអ៊ិច ស៊ីទីស្កេន អឹមអអាយ ឈាម -- អនុប្រភេទ -- Add + | textarea | `inv_list` | text → `scope:medical:id:inv_list` | EMR.html(inline x1), emr-inpatient-workflow.js, paraclinic.js, server.mjs | 3 |
| 27 | IV. រោគវិនិច្ឆ័យ ICD-10 | IV. រោគវិនិច្ឆ័យ ICD-10 | input[hidden] | `diag_input` | text → `scope:medical:id:diag_input` | EMR.html(inline x6), emr-diagnoses.js, emr-icd10.js, emr-inpatient-workflow.js, requests.js, daily-report.mjs, pmrs2-mapping.mjs, server.mjs, EMR.html(inline x1) | 8 |
| 28 | IV. រោគវិនិច្ឆ័យ ICD-10 | IV. រោគវិនិច្ឆ័យ ICD-10 | input[hidden] | `emr_opd_diagnoses` | text → `scope:medical:id:emr_opd_diagnoses` | EMR.html(inline x3), emr-diagnoses.js, requests.js, daily-report.mjs, EMR.html(inline x1) |  |
| 29 | IV. រោគវិនិច្ឆ័យ ICD-10 | វាយលេខកូដ ICD-10 (ឧ. A90) ឬឈ្មោះជំងឺ... | input[text] | — | text → `scope:medical:auto:26` **position key** | — |  |
| 30 | IV. រោគវិនិច្ឆ័យ ICD-10 | កំណត់សម្គាល់បន្ថែម ឬរោគវិនិច្ឆ័យពិស្ដារ... | textarea | `emr_pmrs_opd_diagnosis` | text → `scope:medical:id:emr_pmrs_opd_diagnosis` (old: `scope:medical:auto:27`) | EMR.html(inline x4), emr-diagnoses.js, emr-icd10.js, emr-inpatient-workflow.js, paraclinic.js, patient-banner.js, requests.js, access.mjs, daily-report.mjs, pmrs2-mapping.mjs, EMR.html(inline x1) | 5 |
| 31 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 32 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 33 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 34 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 35 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 36 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 37 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 38 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 39 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 40 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 41 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 42 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 43 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 44 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 45 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 46 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 1 | input[number] | — | not saved | — |  |
| 47 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 1 | select | — | not saved | — |  |
| 48 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 49 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 50 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 51 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 52 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 53 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 54 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 55 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 56 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 57 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 58 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 59 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 60 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 61 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 62 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 63 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 64 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 65 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 66 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 67 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 2 | input[number] | — | not saved | — |  |
| 68 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 2 | select | — | not saved | — |  |
| 69 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 70 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 71 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 72 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 73 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 74 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 75 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 76 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 77 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 78 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 79 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 80 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 81 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 82 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 83 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 84 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 85 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 86 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 87 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 88 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 3 | input[number] | — | not saved | — |  |
| 89 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 3 | select | — | not saved | — |  |
| 90 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 91 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 92 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 93 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 94 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 95 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 96 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 97 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 98 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 99 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 100 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 101 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 102 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 103 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 104 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 105 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 106 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 107 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 108 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 109 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 4 | input[number] | — | not saved | — |  |
| 110 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 4 | select | — | not saved | — |  |
| 111 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 112 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 113 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 114 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 115 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 116 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | 1 | input[number] | — | not saved | — |  |
| 117 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 118 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 119 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 120 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 121 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[hidden] | — | not saved | — |  |
| 122 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | select | — | not saved | — |  |
| 123 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | qh | select | — | not saved | — |  |
| 124 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | q | input[number] | — | not saved | — |  |
| 125 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 126 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[number] | — | not saved | — |  |
| 127 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | — | input[text] | — | not saved | — |  |
| 128 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សម្គាល់... | input[text] | — | not saved | — |  |
| 129 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 130 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 5 | input[number] | — | not saved | — |  |
| 131 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ក្រោយលើកទី 5 | select | — | not saved | — |  |
| 132 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 133 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 134 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 135 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 136 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ការប្រឹក្សាយោបល់ | input[checkbox] | `web_rx_counsel` | true/false → `scope:medical:id:web_rx_counsel` | EMR.html(inline x4) |  |
| 137 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | សូមសរសេរយោបល់របស់គ្រូពេទ្យ... | textarea | `web_rx_counsel_note` | text → `scope:medical:id:web_rx_counsel_note` | EMR.html(inline x3), pmrs2-mapping.mjs |  |
| 138 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | ថ្ងៃត្រឡប់មកវិញ ៖ | input[date] | `web_opd_followup` | text → `scope:medical:id:web_opd_followup` | EMR.html(inline x2), pmrs2-mapping.mjs |  |
| 139 | V. វេជ្ជបញ្ជា បោះពុម្ពវេជ្ជបញ្ជា | បញ្ជូនទៅសម្រាកពេទ្យផ្នែក៖ | select | `web_opd_transfer_ward` | text → `scope:medical:id:web_opd_transfer_ward` | EMR.html(inline x5), requests.js, access.mjs, EMR.html(inline x1) | 1 |
| 140 | ព័ត៌មានទូទៅ | ករណីថ្មី | input[radio] value=ថ្មី | — | true/false → `scope:medical:auto:32` **position key** | — |  |
| 141 | ព័ត៌មានទូទៅ | ករណីចាស់ | input[radio] value=ចាស់ | — | true/false → `scope:medical:auto:33` **position key** | — |  |
| 142 | ព័ត៌មានទូទៅ | មាន | input[radio] value=មាន | — | true/false → `scope:medical:auto:34` **position key** | — |  |
| 143 | ព័ត៌មានទូទៅ | មិនមាន | input[radio] value=មិនមាន | — | true/false → `scope:medical:auto:35` **position key** | — |  |
| 144 | ព័ត៌មានទូទៅ | រោគសញ្ញា * | input[text] | — | text → `scope:medical:auto:36` **position key** | — |  |
| 145 | ព័ត៌មានទូទៅ | រោគវិនិច្ឆ័យចូល ICD10 * | select | — | text → `scope:medical:auto:37` **position key** | — |  |
| 146 | ព័ត៌មានផ្ទៃពោះ | ចំនួនផ្ទៃពោះ * | input[number] | — | text → `scope:medical:auto:38` **position key** | — |  |
| 147 | ព័ត៌មានផ្ទៃពោះ | អាយុផ្ទៃពោះ * | input[number] | — | text → `scope:medical:auto:39` **position key** | — |  |
| 148 | ព័ត៌មានផ្ទៃពោះ | ថ្ងៃមករដូវចុងក្រោយ * | input[date] | — | text → `scope:medical:auto:40` **position key** | — |  |
| 149 | ព័ត៌មានផ្ទៃពោះ | ការពិនិត្យផ្ទៃពោះ * | select | — | text → `scope:medical:auto:41` **position key** | — |  |
| 150 | ការផ្តល់សេវា និងថ្នាំបង្ការ | បានទទួលគ្រាប់ថ្នាំសសៃឈាម (ជាតិដែក/អាស៊ីតហ្វូលិក) * | input[number] | — | text → `scope:medical:auto:42` **position key** | — |  |
| 151 | ការផ្តល់សេវា និងថ្នាំបង្ការ | បានទទួលគ្រាប់ថ្នាំទម្លាក់ព្រូន * | input[number] | — | text → `scope:medical:auto:43` **position key** | — |  |
| 152 | ការផ្តល់សេវា និងថ្នាំបង្ការ | ទទួលថ្នាំការពាររោគតេតាណូស * | select | — | text → `scope:medical:auto:44` **position key** | — |  |
| 153 | ការផ្តល់សេវា និងថ្នាំបង្ការ | បានទទួល | input[radio] value=បានទទួល | — | true/false → `scope:medical:auto:45` **position key** | — |  |
| 154 | ការផ្តល់សេវា និងថ្នាំបង្ការ | មិនបានទទួល | input[radio] value=មិនបានទទួល | — | true/false → `scope:medical:auto:46` **position key** | — |  |
| 155 | ការផ្តល់សេវា និងថ្នាំបង្ការ | បានទទួល | input[radio] value=បានទទួល | — | true/false → `scope:medical:auto:47` **position key** | — |  |
| 156 | ការផ្តល់សេវា និងថ្នាំបង្ការ | មិនបានទទួល | input[radio] value=មិនបានទទួល | — | true/false → `scope:medical:auto:48` **position key** | — |  |
| 157 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | រួចរាល់ | input[radio] value=រួចរាល់ | — | true/false → `scope:medical:auto:49` **position key** | — |  |
| 158 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | មិនធ្លាប់ | input[radio] value=មិនធ្លាប់ | — | true/false → `scope:medical:auto:50` **position key** | — |  |
| 159 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | ព័ត៌មានមុនពេលធ្វើតេស្ត * | input[text] | — | text → `scope:medical:auto:51` **position key** | — |  |
| 160 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | លេខកូដសំណាកឈាម * | input[text] | — | text → `scope:medical:auto:52` **position key** | — |  |
| 161 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | ថ្ងៃខែឆ្នាំកំណត់យកលទ្ធផលឈាម * | input[date] | — | text → `scope:medical:auto:53` **position key** | — |  |
| 162 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | ថ្ងៃខែឆ្នាំទទួលលទ្ធផល * | input[date] | — | text → `scope:medical:auto:54` **position key** | — |  |
| 163 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | វិជ្ជមាន | input[radio] value=វិជ្ជមាន | — | true/false → `scope:medical:auto:55` **position key** | — |  |
| 164 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | អវិជ្ជមាន | input[radio] value=អវិជ្ជមាន | — | true/false → `scope:medical:auto:56` **position key** | — |  |
| 165 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | វិជ្ជមាន | input[radio] value=វិជ្ជមាន | — | true/false → `scope:medical:auto:57` **position key** | — |  |
| 166 | ស្ថានភាពមេរោគអេដស៍ និងស្វាយ | អវិជ្ជមាន | input[radio] value=អវិជ្ជមាន | — | true/false → `scope:medical:auto:58` **position key** | — |  |

### Daily follow-up form (#mon_modal) — 120 controls, 1 with position keys

| # | section (from page) | label (from page) | element | id | saved as | other code that reads it | tests |
|---|---|---|---|---|---|---|---|
| 1 | — | កាលបរិច្ឆេទ * | input[datetime-local] | `mon_input_date` | text → `scope:medical:id:mon_input_date` | EMR.html(inline x7), emr-inpatient-workflow.js, emr-permissions.js |  |
| 2 | — | សីតុណ្ហភាព * | input[text] | `mon_input_temp` | text → `scope:medical:id:mon_input_temp` | EMR.html(inline x5), emr-inpatient-workflow.js, emr-permissions.js |  |
| 3 | — | / | input[text] | `mon_input_bp_sys` | text → `scope:medical:id:mon_input_bp_sys` | EMR.html(inline x5), emr-inpatient-workflow.js, emr-permissions.js |  |
| 4 | — | / | input[text] | `mon_input_bp_dia` | text → `scope:medical:id:mon_input_bp_dia` | EMR.html(inline x5), emr-inpatient-workflow.js, emr-permissions.js |  |
| 5 | — | ចង្វាក់បេះដូង * | input[text] | `mon_input_pulse` | text → `scope:medical:id:mon_input_pulse` | EMR.html(inline x5), emr-inpatient-workflow.js, emr-permissions.js |  |
| 6 | — | ចង្វាក់ដង្ហើម * | input[text] | `mon_input_resp` | text → `scope:medical:id:mon_input_resp` | EMR.html(inline x5), emr-inpatient-workflow.js, emr-permissions.js |  |
| 7 | — | កំហាប់អុកស៊ីសែនក្នុងឈាម * | input[text] | `mon_input_spo2` | text → `scope:medical:id:mon_input_spo2` | EMR.html(inline x5), emr-inpatient-workflow.js, emr-permissions.js |  |
| 8 | — | សូមបញ្ចូលពាក្យបណ្តឹង និងប្រវត្តិអ្នកជំងឺ... | textarea | `mon_soap_s` | text → `scope:medical:id:mon_soap_s` | soap-note.js | 1 |
| 9 | — | ទាញលទ្ធផលចុងក្រោយ | textarea | `mon_soap_o` | text → `scope:medical:id:mon_soap_o` | soap-note.js | 1 |
| 10 | — | ICD-10 | input[text] | `mon_input_icd10` | text → `scope:medical:id:mon_input_icd10` | EMR.html(inline x5), emr-diagnoses.js, emr-icd10.js | 1 |
| 11 | — | វាយលេខកូដ ICD-10 (ឧ. A90) ឬឈ្មោះជំងឺ... | input[text] | — | text → `scope:medical:auto:170` **position key** | — |  |
| 12 | — | ICD-10 បញ្ចូលកូដ ឬជ្រើសកូដដែលបានកត់ត្រាសម្រាប់អ្នកជំងឺនេះ។ | textarea | `mon_soap_a` | text → `scope:medical:id:mon_soap_a` | soap-note.js | 1 |
| 13 | — | ចម្លងពីកំណត់ត្រាមុន | textarea | `mon_soap_p` | text → `scope:medical:id:mon_soap_p` | soap-note.js | 1 |
| 14 | — | Legacy fallback fields for backward compatibility and test assertions | textarea | `mon_input_evol` | text → `scope:medical:id:mon_input_evol` | EMR.html(inline x4), emr-inpatient-workflow.js, emr-permissions.js, soap-note.js | 2 |
| 15 | — | Legacy fallback fields for backward compatibility and test assertions | textarea | `mon_input_conclusion` | text → `scope:medical:id:mon_input_conclusion` | EMR.html(inline x4), emr-diagnoses.js, emr-icd10.js, emr-inpatient-workflow.js, emr-permissions.js, soap-note.js | 2 |
| 16 | — | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 17 | — | 1 | input[number] | — | not saved | — |  |
| 18 | — | — | select | — | not saved | — |  |
| 19 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 20 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 21 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 22 | — | — | input[hidden] | — | not saved | — |  |
| 23 | — | — | select | — | not saved | — |  |
| 24 | — | qh | select | — | not saved | — |  |
| 25 | — | q | input[number] | — | not saved | — |  |
| 26 | — | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 27 | — | — | input[number] | — | not saved | — |  |
| 28 | — | — | input[text] | — | not saved | — |  |
| 29 | — | សម្គាល់... | input[text] | — | not saved | — |  |
| 30 | — | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 31 | — | ក្រោយលើកទី 11 | input[number] | — | not saved | — |  |
| 32 | — | ក្រោយលើកទី 11 | select | — | not saved | — |  |
| 33 | — | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 34 | — | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 35 | — | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 36 | — | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 37 | — | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 38 | — | 1 | input[number] | — | not saved | — |  |
| 39 | — | — | select | — | not saved | — |  |
| 40 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 41 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 42 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 43 | — | — | input[hidden] | — | not saved | — |  |
| 44 | — | — | select | — | not saved | — |  |
| 45 | — | qh | select | — | not saved | — |  |
| 46 | — | q | input[number] | — | not saved | — |  |
| 47 | — | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 48 | — | — | input[number] | — | not saved | — |  |
| 49 | — | — | input[text] | — | not saved | — |  |
| 50 | — | សម្គាល់... | input[text] | — | not saved | — |  |
| 51 | — | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 52 | — | ក្រោយលើកទី 12 | input[number] | — | not saved | — |  |
| 53 | — | ក្រោយលើកទី 12 | select | — | not saved | — |  |
| 54 | — | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 55 | — | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 56 | — | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 57 | — | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 58 | — | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 59 | — | 1 | input[number] | — | not saved | — |  |
| 60 | — | — | select | — | not saved | — |  |
| 61 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 62 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 63 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 64 | — | — | input[hidden] | — | not saved | — |  |
| 65 | — | — | select | — | not saved | — |  |
| 66 | — | qh | select | — | not saved | — |  |
| 67 | — | q | input[number] | — | not saved | — |  |
| 68 | — | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 69 | — | — | input[number] | — | not saved | — |  |
| 70 | — | — | input[text] | — | not saved | — |  |
| 71 | — | សម្គាល់... | input[text] | — | not saved | — |  |
| 72 | — | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 73 | — | ក្រោយលើកទី 13 | input[number] | — | not saved | — |  |
| 74 | — | ក្រោយលើកទី 13 | select | — | not saved | — |  |
| 75 | — | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 76 | — | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 77 | — | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 78 | — | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 79 | — | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 80 | — | 1 | input[number] | — | not saved | — |  |
| 81 | — | — | select | — | not saved | — |  |
| 82 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 83 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 84 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 85 | — | — | input[hidden] | — | not saved | — |  |
| 86 | — | — | select | — | not saved | — |  |
| 87 | — | qh | select | — | not saved | — |  |
| 88 | — | q | input[number] | — | not saved | — |  |
| 89 | — | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 90 | — | — | input[number] | — | not saved | — |  |
| 91 | — | — | input[text] | — | not saved | — |  |
| 92 | — | សម្គាល់... | input[text] | — | not saved | — |  |
| 93 | — | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 94 | — | ក្រោយលើកទី 14 | input[number] | — | not saved | — |  |
| 95 | — | ក្រោយលើកទី 14 | select | — | not saved | — |  |
| 96 | — | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 97 | — | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 98 | — | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 99 | — | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |
| 100 | — | ជ្រើសរើស ឬបញ្ចូលឈ្មោះថ្នាំ... | input[text] | — | not saved | — |  |
| 101 | — | 1 | input[number] | — | not saved | — |  |
| 102 | — | — | select | — | not saved | — |  |
| 103 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 104 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 105 | — | ម.ក្រ (mg) ម.ល (ml) ក្រាម (g) ម៉ៃក្រូក្រាម (mcg/µg) លីត្រ (L) UI / IU mEq mmol គ្រាប់ កាប់ | input[hidden] | — | not saved | — |  |
| 106 | — | — | input[hidden] | — | not saved | — |  |
| 107 | — | — | select | — | not saved | — |  |
| 108 | — | qh | select | — | not saved | — |  |
| 109 | — | q | input[number] | — | not saved | — |  |
| 110 | — | កំណត់ពិធីសារ | input[datetime-local] | — | not saved | — |  |
| 111 | — | — | input[number] | — | not saved | — |  |
| 112 | — | — | input[text] | — | not saved | — |  |
| 113 | — | សម្គាល់... | input[text] | — | not saved | — |  |
| 114 | — | កម្រិតប្រើ | input[text] | — | not saved | — |  |
| 115 | — | ក្រោយលើកទី 15 | input[number] | — | not saved | — |  |
| 116 | — | ក្រោយលើកទី 15 | select | — | not saved | — |  |
| 117 | — | បន្ទាប់មករៀងរាល់ | input[number] | — | not saved | — |  |
| 118 | — | ឯកតាពេល ម៉ោងនាទី | select | — | not saved | — |  |
| 119 | — | ចំនួនសរុបនៃការផ្តល់ | input[number] | — | not saved | — |  |
| 120 | — | បញ្ឈប់នៅ | input[datetime-local] | — | not saved | — |  |

## 6. Phase 1 (v40.7) changes to this map

- `#sub_ipd` sections now sit inside `#ipd_soap_record` (S/O/A/P boxes). Ids, data-keys and storage keys are unchanged.
- 92 IPD fields carry `data-emr-key-index` / `data-emr-legacy-index` (their pre-move positions); `prepareStorageKeys()` uses them. `tests/fixtures/ipd-storage-keys.json` pins all 113 saved IPD keys.
- ICD-10 search boxes (`.diag-search-input`, all three editors) are `data-emr-no-save`: still counted for positions, never saved. Previously they saved search text under `scope:medical:auto:26` (OPD), `:143` (IPD) and `:170` (follow-up).
- New field `ipd_plan_notes` → `scope:medical:id:ipd_plan_notes` (no position key).
- `emr_ipd_diagnoses` rows now have `main: true|false`; the main row is always first.
- Print: `public/report-print.js` splits the SOAP record over two A4 pages.
- Found, not changed: nursing (`#sub_nursing`) position keys differ between two loads of the same page, because nursing rows are built at varying times. Worth a separate review before any nursing change (Phase 4).

## 7. Phase 2 (v40.8) changes to this map

- `#sub_opd` sections now sit inside `#opd_soap_record`. The return date row (`web_opd_followup`) and the admit-to-ward row (`web_opd_transfer_ward`) moved into P; the signature (`opd-doctor-esign`) stays in the footer.
- 11 OPD fields carry `data-emr-key-index` / `data-emr-legacy-index`; `tests/fixtures/opd-storage-keys.json` pins all 28 OPD form keys.
- Fields created by scripts elsewhere in the OPD tab (transfer/referral dialogs, `opd-module-select`, specialty form fields `scope:medical:auto:32`-`58` after the action bar) did not move and keep their keys (checked in the browser against the previous commit: every key on the page identical).
- New field `opd_plan_notes` → `scope:medical:id:opd_plan_notes`.
- `emr_opd_diagnoses` rows now have `main: true|false`; the main row is always first, so `diag_input` follows it.
- `#session-counter` is now `data-emr-transient`: never numbered or saved.

## 8. Phase 3 (v40.9) changes to this map

- `saveDailyMonitoring(restoreRecord)`: when `restoreDailyMonitoringRecords()` replays saved notes on load, the card's `_monitoringCopyData` is an exact copy of the saved note (no SOAP conversion, no S/A check). Before v40.9 an old note without a conclusion was dropped and old notes were rewritten.
- `#mon_modal`: `.monitoring-vitals-grid` moved into O; the treatment block (`#mon_rx_tbody`, `#mon_rx_protocol_tbody`) moved into P. Ids unchanged; storage keys checked in the browser (only the known nursing variation differs).
- Daily note `diagnoses` rows now have `main: true|false`, main first; `icd10` is the main code.
- `soap-note.js` `enforceDoctorOnly()` sets `readOnly` and `disabled` for non-doctors and repeats after load.

## 9. Phase 4 (v41.0) changes to this map

- Allergy safety bug (section 4, item 3) fixed: the banner now reads the IPD drug-allergy fields `scope:medical:auto:82` (tick) and `scope:medical:auto:83` (text) plus the structured allergy record. An empty record shows "Allergy not recorded" instead of "no allergy".
- New tables (additive, `server/clinical-summary.mjs`): `patient_allergies`, `patient_problems`, `patient_resuscitation_status`. Keyed by `health:<Health ID>` (or `key:<patientKey>`), nothing deleted. API `/api/clinical-summary` (read: clinical roles; write: doctors). `/api/patients` rows carry `allergyAlert` for the bed popup.
- Slots filled: `structured-allergy` (IPD S), `problem-list` (IPD A and OPD A) by `public/clinical-summary.js`. All its controls are `data-emr-transient`: never saved with the record and never counted in the position keys. Browser check: the 1086 field keys of a record page are identical to v40.9.
- Banner (`public/patient-banner.js`): clinical row (resuscitation status, risk flags, active problems, current medications) and a details panel; `window.EmrClinicalSummary` shares the summary with the editors.
- Nursing forms: `setAutofillTarget` (`public/emr-inpatient-workflow.js`) fills empty identity fields from the patient but no longer overwrites a saved typed value; it keeps it and shows the banner value next to it. Before v41.0 every saved typed name / age / sex / code (and ward / room / bed) was replaced on each opening and lost on the next save.
- Letterheads on screen: `emr-print-letterhead` (hidden on screen) on the triage page header, agreement header and midwife labour-exam header; `emr-print-letterhead-space` keeps the triage title centred; nursing MOH logos hidden on screen by CSS. Print and the print frame (`body.emr-report-print`) are unchanged.
- Still open from section 4, item 5: auto-growing text boxes (not in Phase 4).

## 10. Phase 5 (v41.1) changes to this map

- Existing paediatric rule found: the triage child growth panel (`updatePediatricDisplay`, ages 0-5, WHO z-scores) using `getExactAge()` (date of birth, else typed age). `public/display-rules.js` reuses `getExactAge()`.
- Blocks with `data-display-rule`: `immunization` (the vaccine row), `substance-use` (smoking, alcohol, drugs labels), `paediatric`, `head-circumference`, `tetanus-status`. Hidden blocks keep their fields in the page, so their values are still saved. A block with a saved value is always shown.
- Ob/gyn: `updateIpdObGynVisibility()` asks `EmrDisplayRules.obgynVisible()` (null = keep the old female rule) and always shows a section that has values; button `#ipd_obgyn_show_button`.
- New id-keyed fields (`data-emr-no-auto-index`, no position key moves): `ipd_paed_birth_history`, `ipd_paed_feeding`, `ipd_paed_head_circumference`, `ipd_paed_growth_notes`, `ipd_paed_milestones`, `ipd_tetanus_status`, `ipd_tetanus_last_dose`, `ipd_tb_contact`. Browser: all other record field keys identical to v41.0.
- TB screening: `.emr-tb-screening` on the OPD history grid and the IPD grid, same layout; IPD gains the TB contact item (label copied from OPD, `data-key="hist_tb_contact"`).
- OBSERVED, not changed (exists in v41.0 and earlier): the midwife delivery form (`#sub_delivery`) is moved into the nursing tab by `clinical-form-layout.js`. In some page loads its 41 fields get no storage key (browser runs of the same version gave 1045 or 1086 keys). In such a session those fields do not load their saved values and new typing in them is not saved. The server keeps the old values (it merges), so nothing is deleted. Proposed as a separate fix.

## 11. Phase 6 (v41.2) changes to this map

- Nursing medicine chart (`EMR.html`, `syncNursingMedicationTable`, `renderNursingMedicationDoseCell`): before v41.2 the "given" state (`data-actual-at`) lived only in the page and was never saved. `public/medication-safety.js` wraps `syncNursingMedicationTable` and `refreshNursingMedicationScheduleLanguage` to show saved doses, and captures the tick-box click and double-click to open the form.
- New tables: `medication_administrations` (order key = the chart's `data-medication-key`, scheduled time = `data-scheduled-at`), `prescribing_overrides`, `drug_interactions`, `drug_max_doses`. APIs: `/api/medication-administrations`, `/api/prescribing-overrides`, `/api/drug-safety`.
- Prescription name / dose fields (`.rx-*`, `.prx-*`, `.mrx-*`, `.mprx-*`, `.orx-*`) get a change listener for doctors; no field, key or saved value changed. Browser: record field keys identical to v41.1.

## 12. Phase 7 (v41.3) changes to this map

- New button "Consents, surgery and transfusion" at the top of `#sub_opd`, `#sub_ipd` and the nursing care section (`.periop-launcher`), opening `<dialog id="sub_periop">` (outside `#page3`, so no record field or key is involved; browser: record keys identical to v41.2).
- New tables `perioperative_forms` (UNIQUE patient, form type, date) and `perioperative_form_revisions`; API `/api/periop-forms`. Forms are not part of the record's edit mode: they have their own history and audit.
- Print: `#periop-print-layout` through `printEmrReport` with `EmrLetterhead` (letterhead, patient grid), the form, the consent text and signature lines.
- `docs/translations-needed.csv`: the owner's Khmer for 77 Phase 7 texts was applied with `npm run translations:apply`.

## 13. Phase 8 (v41.4) changes to this map

- `periop-forms` gains `newbornRecord` (fields `babyCount`, then `b1.*`, `b2.*`, `b3.*` per baby, including `bN.newborn.*` care items and `bN.vaccine.*` dates) and `postnatalCare`, stored on the mother's patient key.
- Prefill reads `#sub_delivery` by position (section 3: first datetime-local = birth time, second number = number of newborns; section 4: selects = outcome, sex; first number = weight). `protected/EMR.html` is unchanged in v41.4 (ANC, delivery and labour chart forms untouched); a "Newborn record" button is added to the delivery form's action bar by script.
- If the delivery form fields did not load (the timing problem noted in section 10), the newborn record simply starts empty.

## 14. v41.5 - field keys no longer depend on page-load timing (fixes section 10)

Position keys were counted once at start-up from the controls that were editable at that moment. Three things changed with load timing:
1. The nursing chart cells that nurses type in (416 `td.nursing-editable-cell` in `.vital-tbl`, made editable by `initializeNursingEditableTables`) - counted only if the chart script had already run.
2. The 41 text boxes of the nurse assessment pages 1-2 - skipped when a read-only lock (`emr-permissions.js`, `emr-encounter-editor.js`) had already set `contenteditable="false"`.
3. The ward billing panel (`ward-services.js`, prepended to `#sub_nursing` after a network call) - its select and quantity input took nursing positions 0 and 1 when it arrived early.
When any of these changed, every later nursing key moved (midwife forms, delivery form), so values could load into another field, and on save be written under another key.

`prepareStorageKeys` now: runs `initializeNursingEditableTables` first; counts locked boxes through the original value the locks keep; ignores the Ctrl K search box and the ward billing panel. Browser (fresh copies = slow first load, and repeated loads): doctor, nurse and midwife views give identical key lists on every load, equal to the normal-load numbering nurses saved with (nurse/midwife 1510 keys); a value saved on a slow load reopens in the same field. In the doctor view all non-nursing keys (and legacy keys) are unchanged; its nursing layout now equals the nurse layout.

Not detectable afterwards: a nursing save made on an affected load before v41.5 may have put some values under a neighbouring key. Nothing was deleted (the server keeps keys that are not sent).

## 15. Phase 9 (v41.6) changes to this map

- IPD O box slot `early-warning-score`: panel with new id-keyed fields `ipd_ews_oxygen`, `ipd_ews_acvpu` (`data-emr-no-auto-index`); score drawn by `public/early-warning.js`; banner item `[data-banner-ews]`. The OPD O-box slot stays empty.
- Discharge view (`emr-inpatient-workflow.js`): `emr_discharge_diagnoses` (hidden, main/secondary list, emr-diagnoses.js kind `discharge`) and `emr_discharge_instructions`; saved in `system:discharge` as `dischargeDiagnoses` and `patientInstructions`. The summary print button id has no "discharge" so it works in view mode.
- Nursing chart: a calculated `tr[data-fluid-balance]` row after the fluid-out total (`public/fluid-balance.js`, wraps `calculateNursingFluidTotals`); never editable, never keyed.
- Server: `critical_result_escalations` table and a one-minute job (`server/critical-escalation.mjs`).
- Browser: nurse and doctor views have exactly the v41.5 keys (new and old format) plus the four new id fields.

## 16. Phase 10 (v41.7) changes to this map

- No record fields added or changed. Scanned documents are stored outside the record (`patient_documents` table, files in `data/uploads/patients/<hash>/`); the dialog controls are `data-emr-transient`.
- `record_access_log` table (`server/record-access.mjs`): written by GET /api/patient-record, /api/patient-history, PMRS2 preview / export, document file view, and POST /api/record-access-log (print from `window.logRecordAccess`, called by `printEmrReport` and `beforeprint`).
- Viewer `/admin/record-log` (`protected/record-log.html`, `public/record-log.js`).
- Browser: doctor view has exactly the v41.6 keys (1514), also after reload.
