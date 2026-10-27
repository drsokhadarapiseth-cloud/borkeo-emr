# NPCA practice mode and 30 fresh test patients v48.1.0

Approved update (owner said "yes" to the confirmed plan on 27 October 2026).
Base master 6f465b9 (48.0.0); branch feature/npca-practice-hosting.

## What changed

1. The test patient seed (scripts/seed-hosting-test-patients.mjs) no longer
   adds a photo.
   - Payment mix: 12 HEF and 12 NSSF patients (card number and the saved HEF /
     NSSF card check) and 6 cash patients (national ID card).
   - Patients 011 (HEF) and 012 (NSSF) have a card that is not eligible.
   - Registration stays complete; Triage stays measured, with no service chosen.
2. NPCA practice mode (server/npca/practice.mjs), started with NPCA_PRACTICE=true:
   - The HEF, NSSF and NPCA card checks answer from the test patients.
   - A practice NPCA (the fetch of the NPCA client) takes the token, card
     search, submission, and processing / date-range requests.
   - A visit goes Processing, then Ready after about one minute (polling
     every minute).
   - It fails with a 4.5.5-style reason for:
     - an unknown or not-eligible SPID;
     - a wrong facility code;
     - a missing referral reason;
     - a Ready visit sent again.
   - Billed services get a PRACTICE- service code automatically.
   - A banner shows on every page (not printed).
   - It refuses:
     - production and the username-only demo;
     - NPCA_ENABLED=true;
     - a database holding real patients before its first start (marker table
       npca_practice_state).
3. docs/DEPLOY.md Codespace section: start again from nothing, and practice
   mode.
4. Correction to the v48.0 test: the approval-pack comparison ignores CRLF / LF,
   so it passes in a Windows Git copy.

No clinical, pharmacy, laboratory or financial logic and no hospital data were
changed. The hospital computer is unaffected unless NPCA_PRACTICE=true is set,
and even then it refuses a database with real patients.

## Backup

Pre-update code-only backup (npm run backup:code on the clean baseline):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v48.0.0-6f465b9e-af0d6825
(commit 6f465b9eeb798fde23484d80a92dae6367d421f1)

## Verification

- tests/v481-npca-practice.test.mjs (4 tests):
  - the seed: no photo, 12/12/6, saved card checks, 2 not eligible, triage
    waiting;
  - the refusals;
  - over HTTP: the HEF / NSSF / NPCA card checks, and a Registration save that
    keeps the practice SPID and HEF scheme;
  - the practice NPCA: Processing → Ready, the date-range check, a
    not-eligible card refused with its reason, and the automatic service code.
- tests/v479-hosting-test-patients.test.mjs updated to the new mix and no photo.
- tests/hosting-test-patients-browser.mjs (explicit, headless Edge, practice
  mode on):
  - all 30 patients pass the Registration required check, with no visible
    empty field except the HEF / NSSF number of patients who do not use it;
  - Triage shows the measurements with no service chosen;
  - the Triage list has 30;
  - the practice banner shows in Khmer.
- npm test and npm run check:khmer: results in the update TXT.
