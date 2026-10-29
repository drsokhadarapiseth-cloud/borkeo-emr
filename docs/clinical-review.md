# Clinical review - values a doctor must confirm

Clinical lists and rules used by the EMR that are not program logic. Change
them only after a doctor has confirmed them. Interaction and maximum-dose
tables (Phase 6) will start empty.

## v41.0 (Phase 4) - structured allergy record, problem list, resuscitation status

File: `server/clinical-options.json` (codes are stored; screen labels are
translated through `docs/translations-needed.csv`).

| List | Codes | Please confirm |
|---|---|---|
| Allergy type | `drug`, `food`, `other` | Are other types needed (e.g. latex, contrast)? |
| Allergy severity | `mild`, `moderate`, `severe`, `life-threatening`, `unknown` | Keep this scale? |
| Resuscitation status | `full`, `dnr` | Are other statuses needed (e.g. limited treatment)? |

Rules (in code, listed here so they can be checked):

- **Risk flags** in the patient banner show only what is already recorded:
  every allergy with severity `severe` or `life-threatening`, and a `dnr`
  resuscitation status. No other risk (falls, pressure sores, isolation...)
  is calculated. Tell us which risk flags you want and from which fields.
- **"No allergy" words** in the record's free-text drug-allergy box
  (ប្រតិកម្មនឹងថ្នាំ): the Khmer word the banner always used, `no`, `none`,
  `nil`, `NKA`, `NKDA`, `neg`, `negative`, `-`. Any other text counts as an
  allergy and is shown in red. An empty box (and no structured allergy) is
  shown as "Allergy not recorded", not as "no allergy".
- **Who may change** allergies, problems and resuscitation status: doctors
  only (`CLINICAL_SUMMARY_WRITE_ROLES` in `server/clinical-summary.mjs`).
  Everyone who can open the record can read them.
- **Allergies and problems follow the person** across visits (same Health
  ID); without a Health ID they stay with that visit. Resuscitation status
  belongs to the current visit only.
- **Nothing is deleted**: removing an allergy needs a reason and keeps the
  row (who, when, why); a resolved problem can be made active again.

## v41.1 (Phase 5) - display rules by age and sex

File: `server/clinical-options.json`, `displayRules` (ages in completed years,
limits included). Age comes from the date of birth, else the typed age (the
same reading as the triage child growth panel). When age or sex is unknown,
the section is shown. Hiding never clears a field, and a section that holds a
saved value is always shown.

| Rule | Setting | Value | Please confirm |
|---|---|---|---|
| Immunization list (ចាក់ថ្នាំបង្ការ) | `immunizationMaxAge` | shown 0-14, hidden from 15 | |
| Smoking / alcohol / drug questions | `substanceUseMinAge` | shown from 10 | |
| Paediatric section | `paediatricMaxAge` | 0-14 | |
| Head circumference (in Growth) | `headCircumferenceMaxAge` | 0-2 | Up to which age do you measure it? |
| Tetanus vaccine status | `tetanusFemaleMinAge` / `tetanusFemaleMaxAge` / `tetanusWhenPregnant` | females 15-49, and pregnant patients | |
| Ob/gyn history | `obgynFemaleMinAge` / `obgynYoungerWhenPregnant` | females 15 and over; under 15 only when pregnant or in the obstetric ward (owner, 2026-10-21); a "show" button for any other female; never for males | |
| Obstetric ward codes | `obstetricWardCodes` | `obstetric`, `gyneco-obstetric` | |

"Pregnant" means: the patient is in an obstetric ward, or an EDD is written in
the ob/gyn history. In v50.5, separate structured past-pregnancy, current-visit
pregnancy and breastfeeding fields were added. Past pregnancy does not imply
current pregnancy. These new documentation fields do not alter the existing
display-rule thresholds or medication tables; Medscape remains a manual reference.

Tetanus vaccine status options (in `protected/EMR.html`): TT1, TT2, TT3, TT4,
TT5, No dose, Unknown, plus the last dose date. Please confirm the list.

## v41.2 (Phase 6) - medication administration record and prescribing warnings

- **Who records doses**: nurses and midwives of the patient's ward (`MAR_WRITE_ROLES`, `server/medication-safety.mjs`). Doctors and others read.
- **Held / Refused** always need a reason. A time more than 5 minutes in the future is refused. A recorded dose cannot be recorded twice; a correction keeps the old entry (crossed out, with who and why).
- **Allergy warning**: from the structured allergy record only (Phase 4), all allergy types. A medicine matches when it contains the allergy substance, or its first word (4+ letters) appears in the substance. Example: "Penicillin V 500mg" matches "Penicillin"; "Amoxicillin" does NOT match "Penicillin" (no class rules). The old free-text drug-allergy box is not checked automatically. Please confirm, or ask for drug-class rules.
- **Duplicate warning**: same first word (4+ letters) as another medicine in the same prescription (admission, daily note or OPD). Medicines from earlier daily notes are not compared.
- **Interaction and maximum-dose tables** (`/admin/drug-safety`): EMPTY. Only an administrator can add rows. Enter only a list approved by a doctor. Maximum per day = morning + afternoon + evening + night amounts; checked only when the unit matches or no unit is set.
- **Override**: doctors only, reason required; stored with the warnings and audited (`PRESCRIBING_WARNING_OVERRIDDEN`).

## v41.3 (Phase 7) - consents, surgery, anaesthesia and transfusion forms

- **Consent and refusal wording**: the owner's approved text (docs/phase7-consent-drafts.md, applied 2026-10-21). A lawyer or the director should keep it under review.
- **WHO Surgical Safety Checklist** (`server/clinical-options.json`, `whoChecklist`): Sign in 7 items, Time out 6, Sign out 5 (WHO 2009). Add, remove or reorder items there; labels need a row in docs/translations-needed.csv.
- **One form per type and date** (owner's rule). Every save keeps the previous version; nothing is deleted.
- **Who fills the forms**: doctors, nurses, midwives and ward chiefs (`PERIOP_WRITE_ROLES`). Staff sign each slot with their own e-signature; a later change shows "changed after signing" on that signature.
- **Patient signature**: on screen, by a thumbprint photo, by a fingerprint scanner (when one is connected, docs/fingerprint-scanner.md), or on the printed paper. A given patient signature is never removed by a later save.
- **ASA class options** (anaesthesia record): I-VI and I E-V E. Please confirm.

## v41.4 (Phase 8) - newborn and postnatal care records

- **Immediate newborn care items** (`newbornCare` in `server/clinical-options.json`, WHO Essential Newborn Care): dried thoroughly, skin-to-skin, cord clamped after 1-3 minutes, breastfeeding within 1 hour, eye care, clean cord care. Please confirm.
- **Birth vaccines** (`birthVaccines`): BCG, Hepatitis B birth dose. Add OPV-0 or others if your schedule uses them.
- **Apgar**: three totals (1, 5, 10 minutes), 0-10. No automatic interpretation is shown.
- **Newborn record**: on the mother's record, one form per date with up to three babies (twins, triplets). A new form is prefilled from the delivery form (birth date and time, number of babies, baby #1 born alive/stillborn, sex, weight); the midwife checks and saves. The delivery form itself is not changed.
- **Postnatal care record** fields: day after birth, BP, pulse, temperature, uterus, lochia, perineum/wound, breasts and breastfeeding, urine and stool, pain, danger signs, family planning, iron/folic acid/vitamin A, baby check, next visit. Please confirm the list.
- Newborn and postnatal forms are shown only for women (or when sex is unknown).

## v41.6 (Phase 9) - NEWS2, critical result escalation, discharge, intake / output

**Early Warning Score: NEWS2 (owner's choice, 2026-10-21)** - `earlyWarning` in `server/clinical-options.json`. Values entered from the Royal College of Physicians NEWS2 chart (2017); a doctor must check them:

| Parameter | 3 | 2 | 1 | 0 | 1 | 2 | 3 |
|---|---|---|---|---|---|---|---|
| Respiration rate (/min) | ≤8 | | 9-11 | 12-20 | | 21-24 | ≥25 |
| SpO2 scale 1 (%) | ≤91 | 92-93 | 94-95 | ≥96 | | | |
| Air or oxygen | | Oxygen | | Air | | | |
| Systolic BP (mmHg) | ≤90 | 91-100 | 101-110 | 111-219 | | | ≥220 |
| Pulse (/min) | ≤40 | | 41-50 | 51-90 | 91-110 | 111-130 | ≥131 |
| Consciousness | | | | Alert | | | New confusion, V, P or U = 3 |
| Temperature (°C) | ≤35.0 | | 35.1-36.0 | 36.1-38.0 | 38.1-39.0 | ≥39.1 | |

Risk: 0-4 low; any single parameter 3 = low-medium; 5-6 medium; 7 or more high. Only SpO2 scale 1 is used (scale 2 for hypercapnic respiratory failure is not set up). Not shown under 16 years or for pregnant women (obstetric ward or EDD written), as agreed. Vital signs: the latest daily note, otherwise the IPD admission vital signs; oxygen and consciousness are two new fields in the IPD Objective box. When a value is missing the score is shown as "≥ n, incomplete". The EMR shows the score only; it gives no automatic orders.

**Critical result escalation** - `criticalEscalation`: 30 minutes (owner's choice), to the ward's DOCTOR, CHIEF_WARD and WARD_HEAD inboxes, once per released result. The existing acknowledgement is unchanged.

**Discharge**: main / secondary ICD-10 (main first, its code also fills the existing discharge ICD-10 field), patient instructions; the printable discharge summary uses only the saved discharge.

**Intake / output**: Daily balance = total fluid in minus total fluid out, per column of the nursing chart (ml as entered).
