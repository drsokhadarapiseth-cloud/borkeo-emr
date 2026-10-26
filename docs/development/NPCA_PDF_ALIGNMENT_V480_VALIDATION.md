# NPCA v1.4 PDF alignment and approval pack v48.0.0

Approved update (owner said "yes code for all" on 26 October 2026, after the
comparison of the EMR with the NPCA "EMR Clinical Data Integration
Specification v1.4" PDF). Base master a5f9245 (47.9.0); branch
feature/npca-v14-pdf-alignment. NPCA stays turned off by default.

## What changed

1. Registration data for NPCA
   - Marital status, occupation and disability are read from the positions
     the current Registration form saves (marital 32-35, occupation 37,
     disability 38/39; server/npca/registration-fields.mjs).
   - Before, the marital status was read from old positions (22-25), so every
     current patient was blocked with "marital status unmapped".
   - "Other" occupation sends the typed occupation.
   - `occupation` and `disabilities` are sent only when there is a value.
2. Encounter `class` ("OPD", "IPD", "EMERGENCY") is sent, as in PDF 5.1.
3. PDF names are sent next to the workbook names:
   - `diagnosis_type` next to `diagnosis_type_name`;
   - `medicine_code` next to `code`, and `form`, in prescription medicines.
4. Only single CMS codes (2 letters and 3-4 digits) pass the local check. 9
   catalogue rows have a note or two codes in the code column (OPEN-QUESTIONS
   27); the catalogue itself is unchanged.
5. Date-range status check (PDF 4.4):
   - POST /api/npca/check-processed, for cashier, accountant and ADMIN, with
     CSRF.
   - The NPCA page has a "check status by date" section (Khmer by default, 7
     approved strings).
   - Pages are followed, and statuses are read as numbers or as their names.
6. Approval pack for NPCA:
   - scripts/build-npca-approval-pack.mjs;
   - docs/npca/approval-pack/, with the OPD, IPD, transfer, referral and ANC
     form samples, all built from synthetic visits and passing the validation;
   - docs/npca/NPCA-V1.4-CONFORMANCE.md, mapping every PDF section;
   - OPEN-QUESTIONS 22-27.

No clinical, pharmacy, laboratory or financial logic and no patient data were
changed. The 3-digit / note codes in the medicine catalogue were not edited.

## Backup

Pre-update code-only backup (npm run backup:code on the clean baseline):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v47.9.0-a5f92450-1a4c4d24
(commit a5f92450088f86a03ed281898efffe832aeea040)

## Verification

- `tests/v480-npca-pdf-alignment.test.mjs` (8 tests):
  - registration positions;
  - a complete hosting test patient now gives Married and its occupation;
  - class and the PDF / workbook names;
  - single CMS codes;
  - the date-range check with paging, text statuses, bad dates, disabled mode
    and audit;
  - roles and CSRF on the route, and the page section;
  - the approval pack passes and matches the committed files.
- `tests/npca-registration-fields-browser.mjs` (explicit, headless Edge):
  - the real Registration form saves marital, occupation and disability at
    the positions above;
  - the NPCA page shows the range check in Khmer;
  - no browser errors.
- npm test 1060/1060 and npm run check:khmer passed, in the project folder and
  in a disposable copy without hospital databases, uploads or .env.
- No live NPCA connection was made: credentials and the test environment are
  still to come from NPCA.
