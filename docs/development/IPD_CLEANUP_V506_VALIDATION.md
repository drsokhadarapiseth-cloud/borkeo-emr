# IPD display cleanup - v50.6.0

Owner approved the discussed changes with "yes": hide the inline unverified
allergy-history notice underneath medicine names, hide the special/protocol-add
control, simplify IPD ICD-10 rows and remove their Set as main control, and show
the new pregnancy-history panel only for females older than 13 completed years.

This is a presentation update. The medicine catalogue, dose/interaction/allergy
evaluation, actual safety alerts, stock, prescriptions and saved protocol rows
remain unchanged. Protocol creation helpers remain for restoring existing orders;
their user-facing add controls are hidden. The inline notice remains available
internally but is not displayed in the clinical form. No safety popup is hidden.

IPD ICD-10 selections use separate white rows with code, diagnosis and remove
icon. Main/secondary badges, the secondary heading and Set as main control are
hidden. Existing primary flags and order are retained by the canonical diagnosis
editor; its first entry remains primary and removing it promotes the remaining
first entry through existing logic. No stored diagnosis is rewritten by styling.
OPD, follow-up and discharge diagnosis editors retain their existing controls.

The pregnancy-history panel uses sex and date of birth, falling back to recorded
completed age when a usable birth date is absent. It appears for known females
aged 14 or older and is hidden for males, age 13 or younger, and unknown sex/age.
Khmer-digit ages and Khmer female sex values are supported. The unloaded-patient
state safely remains hidden. The same rule applies to script-free cross-hospital
record review and print styling. A persistent data attribute prevents the review
renderer from revealing the panel when it strips generic hidden attributes.

Saved pregnancy fields are never cleared by hiding. Automatic SOAP drafting
does not append fields from the hidden pregnancy panel; manually edited SOAP
notes remain unchanged. Other obstetric history/display rules remain unchanged.
UI state does not introduce or alter access permissions.

## Baseline and preservation

Primary clean baseline 50.5.0, master,
640fc1bf41dde8e3da281297d29efec6e04b19e5. Code-only backup before edits:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.5.0-640fc1bf-cff45fc1.
Receiver 50.4.0 code-only archive/manifest:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-ipd506-20261029.
Twelve affected existing receiver files matched the baseline with its independent
version difference. Code restore always creates a new folder.

Online database backups:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v506-ui-1793284874236.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v506-ui-1793284874526.sqlite

Disposable validation: borkeo-restored-code-omzjZa, restored from the code backup,
with only approved files overlaid. Synthetic in-memory browser fixtures only;
no real patient fixture or clinical-data migration. Preserve .vscode and
.gitignore, databases, uploads, passwords, API keys/grants and private settings.

## Verification and delivery

Boundary tests cover female 13/14, birthday boundaries, birth-date precedence,
male and unknown demographics, Khmer digits, null loading state and preservation
of saved history. Browser checks cover current sex/age visibility, print media,
script-free remote review, retained primary diagnosis, compact desktop/mobile
rows, hidden controls, and active actual allergy evaluation. Final outcomes and
installation checks follow after completion.

Combined delivery: Borkeo-EMR-v50.6.0-ipd-cleanup-update.txt, containing complete
UTF-8/LF decoded file payloads with byte counts and SHA-256. Browser print-media
checks do not establish physical-printer acceptance.

Final validation: 1,088/1,088 automated tests and Khmer check pass. The
synthetic browser workflow passes female age 13/14, male and unknown visibility,
retained hidden history, preserved primary diagnosis, hidden notice/protocol
controls, desktop/mobile rows, print-media hiding, script-free remote rendering
and active real allergy evaluation. Patient record JSON remains unchanged.
The new null loading-state boundary is covered by automated tests.

Installed primary 50.6.0 PID 26692 at http://127.0.0.1:3001 and receiver
50.5.0 PID 31804 at http://localhost:3002 with the original hidden launchers.
Health, visible versions and final assets pass on both. All 98 pre-existing
non-audit/non-nonce tables compare equivalent to the online backups, with
known startup metadata/session normalization only; no new snapshot provenance
change. Exact patient rows, clinical content, attachments and API keys/grants
are preserved. Patients remain 22 and 0; integrity OK. No automatic connection,
patient import or schema migration. Desktop/mobile diagnosis screenshots were
reviewed after dismissing the verified actual allergy warning in the synthetic
fixture; allergy evaluation and alerts remain active.
