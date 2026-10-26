# ANC age and BMI correction v47.4.0

Approved correction (owner said "yes" on 26 October 2026) after v47.3: a
13-year-old patient did not tick "<18 / >35 years", and the BMI stayed empty.
Only the ANC record page changes. Base master f24410b (47.3.0); branch
feature/maternity-anc-age-bmi-fix.

## Cause and fix

1. Age. Registration saves the age as text ("13 <year word>", "13 Yrs", Khmer
   digits). The v47.3 rules expected a plain number, so the age was unknown and
   neither age box was ticked. `ageYears()` in public/anc-engine.mjs now reads
   these texts (months or days only = 0 years) and uses a valid date of birth
   first (completed years on the check date).
2. BMI. An empty "weight before pregnancy" now takes the Triage weight at any
   GA (owner decision; owner setting `prePregnancyWeightFromTriageMaxWeeks` is
   `null` in server/clinical-options.json and the engine default; a number
   restores the old rule: first visit before that GA only). The weight keeps
   the "from Triage" note and stays editable; BMI and its chart box follow.
   Clinical note given to the owner: after about 12 weeks the visit weight is
   higher than the weight before pregnancy, so the BMI can be overestimated.

No database migration. Existing records get the weight when opened next if
the field is still empty.

## Backup and data preservation

Pre-update code-only backup (npm run backup:code on the clean baseline):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.3.0-f24410b4-d61951c7
(commit f24410b44f00d80b03f8520e72d90a35c4890d9a)

Restore with `npm run restore:code -- "<backup-directory>"` into a NEW folder.
Hospital databases, uploads, backups, password exports and .env are untouched.

## Verification

- tests/v474-anc-age-bmi.test.mjs: Registration age texts, Khmer digits,
  date of birth first, unknown age, months only, the null setting and BMI.
- Explicit browser check (headless Edge, in-memory database, synthetic
  patient registered with age "13 <year word>", Triage 52 kg / 158 cm): age
  13 ticks the yellow age box (locked), weight 52 is filled from Triage, BMI
  20.8 is shown and ticks the green BMI box; the v47.3 checks still pass; no
  JavaScript errors.
- Full `npm test` and `npm run check:khmer` results are in the update TXT.
