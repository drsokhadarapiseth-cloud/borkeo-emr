# ANC required entries v47.1.0

Approved first change only: required asterisks, completion checking and missing
fields from the old ANC form/screenshots. The other requested navigation and
colour synchronization changes remain pending. Base b21d28d (47.0.0).

## Behavior

- Required pregnancy entries: gravida, LMP and height. Gestational age is a
  derived display using the existing dating engine, not another manually stored
  number. Current measurements: weight, BP, pulse, temperature and SpO2.
- Required visit entries: complaint, iron quantity, new/old ANC case choice,
  ancillary-service choice, entry ICD10, visit number, deworming quantity,
  tetanus status, prior HIV-test status and pre-test counselling information.
- Entry ICD10 and visit number are added to Care; tetanus accepts recorded text
  such as TT2. Existing clinical narrative diagnosis remains separate. All
  fields reuse existing Khmer labels. Nothing is automatically assumed negative,
  normal, given or completed. Staff may explicitly enter zero quantities.
- All required entries have native required/ARIA attributes and red stars.
  The unified Save visit checks every section, reveals the first missing entry,
  uses the existing Khmer validation message and creates no visit on failure.
  The same check runs before the server's atomic record/visit transaction.
- Pending blood samples/result dates, tests not yet performed and non-applicable
  fields are not mandatory for every visit. Independent prescribing/referral,
  draft opening and historical partial-record endpoints retain their behavior.
  Required stars are omitted from the official paper printout.

No patient migration, fabricated values, new clinical thresholds or billing,
pharmacy, laboratory or authorization changes are included. Old records stay
readable and acquire no new values until an authorized staff member edits them.

## Backup and validation

Pre-update committed code backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.0.0-b21d28da-288d8800

Restore to a NEW folder with `npm run restore:code -- "<backup-directory>"`.
Never replace the hospital database or .env with code or synthetic fixtures.

Disposable validation root:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-anc-required-eHj4Dg

Only source/reference fixtures were copied; tests use synthetic in-memory data.
No hospital database, uploads, backups, passwords or .env was copied or seeded.
The .gitignore remains unchanged. Validation logs and synthetic screenshots/PDF
remain in that temporary copy. Final results: `npm test` passed 1,018/1,018 and
`npm run check:khmer` passed. The combined browser check passed on final source;
the retained maternal browser check also passed with completed synthetic forms.
Desktop Care/pregnancy, mobile and print evidence is in validation-evidence/.
Care and mobile screenshots were visually reviewed. `git diff --check` passed.
Incomplete API saves return 400 before writes; the valid-save/rollback tests
also pass. Zero iron, ICD10, visit number and TT2 values survive saving/reload.

The browser checks cover blocked incomplete saves, opening the missing section,
stars, complete saving, persisted ICD10/visit/tetanus/zero quantities, legacy
record preservation, desktop/mobile layout and official ANC print/PDF. The
retained maternal check covers risk categories, referrals, vaccination, cervical
screening and Gynecology access. PDF checks are not physical-printer acceptance.

## Delivery

One combined UTF-8 update TXT in the project root contains the complete changed
files for Antigravity. Apply to 47.0.0, preserving unrelated later changes and
all patient data. The verified release is committed/pushed before restarting
only the identified project Wi-Fi launcher on port 3001. Refresh the browser
after the restart; no database replacement or patient regeneration is needed.
