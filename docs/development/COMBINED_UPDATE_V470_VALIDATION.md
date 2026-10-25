# Combined update v47.0.0

Approved scope: all pending registration, OPD routing/shared fields, ANC and
code backup changes discussed with the user. Clean base cd41efd, 46.5.0.
The five minor increments end at 47.0.0. Existing triage Skip, direct Complete
Triage action, discard-to-list, assessment heading containment, admission form
and synthetic registration/Patient ID generator are retained from the base.

## Data and access

All validation uses in-memory databases or the disposable source copy
C:\Users\Local-admin\AppData\Local\Temp\borkeo-unified-anc-KQPi7G.
Tracked gazetteer, ICD, facility and demo-photo fixtures are included. No live
database, uploads, hospital backups, .env or password CSV is copied or seeded.
No patient record migration runs on installation. The .gitignore is unchanged.

Shared editing covers chief complaint and weight, height, temperature, systolic
and diastolic BP, pulse, respiratory rate and SpO2. Doctor changes write the
same encounter's canonical triage values, including empty values. Demographic
identity, history and unrelated clinical fields retain existing permissions.
API tests cover stale edits, wrong roles/wards, unknown shared keys, prior-visit
preservation, registration-only scope and both OPD routing choices.

ANC retains the existing clinical risk/schedule engine, prescribing, test
ordering, payment and referral rules. No new clinical thresholds are introduced.
Legacy encounter details stay attached to their selected encounter. Current
pregnancy and visit are saved in one transaction; invalid supplemental data
rolls back both. Cross-patient pregnancy IDs are rejected. Opening a later
pregnancy does not change the pregnancy shown for an earlier linked encounter.

## Backup and recovery

Verified pre-update snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v46.5.0-cd41efdd-72a766bc

1. Before each future code update, run `npm run backup:code` on the clean
   committed baseline. Keep the returned directory outside the project.
2. To inspect/recover an older version, run `npm run restore:code -- "<backup-directory>"`.
   This verifies SHA256 and safe archive paths, then returns a NEW code folder.
3. Review that folder before changing the running app. Keep the existing
   hospital database/configuration separate; never replace patient data with
   a code snapshot or a synthetic test database.

Actual restore of the pre-update snapshot succeeded into a disposable folder;
tests also reject tracked dirty source, patient/secret paths and altered archives.

## Verification

Final results: `npm test` passed 1,017/1,017; `npm run check:khmer` passed.
The two explicit browser checks passed (combined update and retained maternal
services). The latter covers green/yellow/red pregnancy risk, task close reasons,
referral request/sign/print, later visits in the same pregnancy, vaccination,
cervical screening and Gynecology safe-abortion access. Its former duplicate
header assertion was updated to check the retained canonical patient identity.
Desktop/mobile and print screenshots were visually reviewed. ANC has no page
overflow at 390px. The generated PDF is nonblank and the two official print
blocks are present. `git diff --check` passed.

Evidence remains in the disposable copy: validation-tests-final.log,
validation-khmer-final.log, validation-browser-final.log, validation-evidence/
(registration/OPD/ANC desktop/mobile, ANC print screenshot and anc.pdf), plus
the retained maternal test's verification-v431/ synthetic artifacts.
Browser fixtures exercise real registration/triage/payment paths, registration
Save isolation, doctor vital changes and complaint removal, ANC entry, unsaved
tab preservation, supplemental fields, atomic save, escaped legacy text,
desktop/mobile layouts and the official print blocks.

Browser PDF validation does not constitute physical-printer acceptance. The
official ANC print layout retains its existing pages; supplemental and legacy
review panels are screen records rather than added official paper fields.

## Installation

The Git checkout is the installation target. After verified merge/push, restart
only its verified Wi-Fi launcher and refresh the browser. The combined update
TXT in the project root contains a manifest and complete UTF-8 replacement
files for Antigravity; apply to the matching 46.5.0 base while preserving later
unrelated customizations. It contains no hospital data or credentials.
