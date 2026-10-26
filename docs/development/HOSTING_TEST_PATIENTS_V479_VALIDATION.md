# 30 complete test patients for a test hosting v47.9.0

Approved update (owner said "yes code it" on 26 October 2026). The EMR itself
is unchanged: a new script, tests and the Codespace guide (docs/DEPLOY.md).
Base master b839489 (47.8.0); branch feature/registration-hosting-test-patients.

## What it does

`node scripts/seed-hosting-test-patients.mjs <test database file>` (EMR stopped):

- 30 synthetic patients, IDs 160201-YYYYMMDD-001 ... 030 (case number = Health
  ID, today's date), the same 30 synthetic portraits.
- Registration completely filled (built on the v46.5 complete fixture, which
  passes the form's own required check): names, sex, birth date and age,
  phone, nationality, full Borkeo address and street address, coverage area,
  caregiver, father / mother, marital status, occupation, disability, entry
  type (all 3 types used). Payment mixed: cash, HEF (10-digit equity card),
  NSSF (10-digit number), another card (national ID, number, issuer) - the
  matching fields are filled. HEF / NSSF are not marked verified: that
  remains the real NPCA check.
- Triage measured: temperature, BP, pulse, breathing rate, SpO2, weight,
  height, chief complaint (from the existing synthetic profiles; 3 patients
  with abnormal values for the alerts). Stage TRIAGE_WAITING; no service
  chosen - the nurse chooses it.
- Refuses (and changes nothing) when the database holds any patient without a
  synthetic marker. Otherwise it removes the earlier test patients and
  everything linked to them (every table with patient_key / pregnancy_id /
  invoice_id; messages keep their non-patient rows) and inserts the 30.
- Makes the shared 1234 accounts usable: Superuser, nurse_triage and the
  doctor_ / nurse_ ward accounts (the old demo seed had disabled them).

## Backup and data preservation

Pre-update code-only backup (npm run backup:code on the clean baseline):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.8.0-b8394899-5e379cfb
(commit b83948994c637b5ebe93f56dcd0a7d18337a8e54)

No hospital database is used or changed. Never run the script on a hospital
database (it refuses one that contains real patients).

## Verification

- tests/v479-hosting-test-patients.test.mjs (temporary databases): IDs, photo,
  every registration and triage value, payment mix, abnormal values; a second
  run replaces (30, not 60); Superuser / nurse_triage / doctor_opd /
  nurse_obstetric accept 1234; a real patient makes it refuse with nothing
  changed.
- tests/hosting-test-patients-browser.mjs (explicit, headless Edge): all 30
  patients open in the real Registration form, pass its required check and
  have no visible empty field except the HEF / NSSF number of patients who do
  not use them; Triage shows the 8 measurements with no service chosen; the
  Triage list has 30. Triage save of one patient to OPD returned 200 and left
  29 waiting.
- Full `npm test` and `npm run check:khmer` results are in the update TXT.
