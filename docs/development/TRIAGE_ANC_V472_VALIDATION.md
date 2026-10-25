# Triage ANC transfer v47.2.0

Approved correction: Save and Transfer for ANC must not redirect the triage
user into the restricted ANC clinical page. Base 061288a, version 47.1.0.

## Cause and fix

Care-path restoration changes the hidden OPD module selector. The general
maternal change listener treated that programmatic selection as a clinical
navigation request. It now checks the active role and workspace first, and
the legacy notice offers its ANC link only in the permitted clinical context.
The normal local selector handler still runs for ignored navigation changes.

The server's role/page/API guards are unchanged. Triage gains no permission to
edit the ANC clinical record. Saving, required vital signs, encounter history,
cashier fees and midwife routing retain their existing behavior. This release
does not implement the separately pending midwife list/colour synchronization.

## Backup and data preservation

Pre-update committed code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.1.0-061288a9-3a066948

Use `npm run restore:code -- "<backup-directory>"` to extract code into a NEW
folder. Never replace hospital data or .env with code or synthetic fixtures.
The .gitignore, hospital databases, uploads and password exports are unchanged.

Validation copy:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-anc-transfer-0YsSBJ

Only source/reference fixtures were copied. Browser and API checks use a
synthetic patient and an in-memory database; no hospital patient was edited.

## Verification

The navigation unit regression covers triage, registration, management in those
workspaces, authorized doctors/midwives and an uninitialized session. The
explicit browser regression fills the real triage form, selects ANC, triggers
the hidden selector synchronization, clicks the native Save and Transfer,
checks the return to /triage and the saved destination/vitals, follows the
existing cashier payment, and checks midwife queue/page access. Direct ANC
clinical-page access by TRIAGE must still return 403.

Final results: `npm test` passed 1,019/1,019; `npm run check:khmer` passed.
The native triage-to-ANC browser regression passed, including cashier payment,
midwife queue receipt and retained TRIAGE 403 on the clinical page. No browser
JavaScript errors occurred. The synthetic ANC selection screenshot was reviewed.
Logs are validation-tests.log, validation-khmer.log and validation-browser.log;
the screenshot is validation-evidence/triage-anc-selection.png in the disposable
copy. `git diff --check` passed. This is a navigation correction; no print
layout or clinical assessment rules changed.

## Delivery

One combined UTF-8 update TXT in the project root contains the changed files
for Antigravity. Apply to the matching 47.1 base while preserving unrelated
later customizations and all patient data. After verified commit/push, restart
only the identified project Wi-Fi launcher on port 3001. If the browser is
already on the old forbidden URL, return to Triage and reopen the patient;
refreshing that restricted URL alone will correctly continue to deny access.
