# OPD direct editing and legacy notice removal v48.3.0

Approved behavior: remove the yellow old-ANC notice from general OPD and ANC;
open the doctor's eligible OPD form ready for typing without pressing Edit.
Base 5f47771 (48.2.0); branch fix/opd-direct-edit.

## Implementation

The legacy ANC form still initializes inert and preserves its stored history,
but no longer creates the old-form notice. Existing old notice nodes are removed.
Official ANC risk colours, clinical alerts and required-field guidance are not
changed, and no new note replaces the removed notice.

The encounter editor enables ordinary OPD consultations only after server access
allows editing and the doctor workflow is DOCTOR_READY or IN_CONSULTATION.
Management uses its existing access. The normal View link now enters this same
eligible OPD editing state. recordPage historical reports remain readonly.
Existing ward, role, payment, discharge/correction, prescribing and API guards
are unchanged. Save stays explicit, and eligible OPD remains editable after Save.
No patient data migration or automatic clinical save is introduced.

## Backup and verification

Code snapshot before edits:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v48.2.0-5f47771b-d756d774

Disposable source copy:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-opd-direct-kbIY1R

No hospital database, .env, uploads, backups or passwords were copied into it.
Tests/browser use synthetic in-memory databases and tracked reference fixtures.
The .gitignore is unchanged; no patient data belongs in the release commit.

- npm test: 1,065/1,065 passed.
- npm run check:khmer: passed; no new Khmer strings or changed baseline.
- New unit cases: default/View-link editing, pending access, denied access,
  unpaid/paraclinic ordering, historical report and other readonly view semantics.
- Existing API regressions retain payment, ward and discharged-record guards.
- Combined browser: ordinary OPD and mode=view are editable without Edit;
  native input was typed into Subjective and saved to its actual stored key;
  shared vitals/complaints still save; editing remains enabled after Save;
  no old notice in OPD or ANC; desktop/mobile and ANC print/PDF passed.
- Retained maternal browser: risk categories, task reasons, referral request/sign,
  later visits, vaccination, cervical screening and Gynecology access passed.
- git diff --check: passed. OPD screenshot visually reviewed.

Evidence: validation-tests.log, validation-khmer.log, validation-browser.log,
validation-evidence/ and verification-v431/ in the disposable copy. Browser PDF
verification does not constitute physical-printer acceptance.

## Delivery

The combined update TXT in the project root contains complete UTF-8 changed
files for Antigravity on the matching 48.2 base. Preserve later unrelated work
and hospital data. After verified commit/push, restart only the identified project
Wi-Fi launcher with the existing explicit database path and refresh the browser.
