# Triage skip and admission-print button removal - v46.0.0

25 October 2026, Cambodia. Base: clean fetched master a8c666c.
Branch: feature/triage-skip-action. The minor release rolls 45.9 to 46.0.

Approved behavior:

- Bottom Skip moves an unfinished triage patient to the skipped list and returns
  to the patient list without saving unfinished clinical fields.
- The skipped list retains Complete Triage with view=triage&edit=1. Recall opens
  editable triage directly; no edit-approval request is introduced.
- Only the triage admission-print button is removed. The admission form and
  other print controls/functions remain unchanged.

Implementation uses the existing authenticated/CSRF-protected skip endpoint.
Controls disable during the request and recover on failure, with a safe Khmer
message next to Skip. Skip is hidden outside the TRIAGE role, in explicit view
mode, and after triage transfer. Clinical storage and edit permissions are unchanged.

Browser testing exposed two existing list defects: the skipped query required
NULL discharge dates although current records store empty strings, and the
triage waiting query did not exclude active skips. The shared skipped query now
accepts absent/blank discharge dates and triage waiting excludes active skips.
Actual discharged records remain excluded. No schema/data migration was needed.

Disposable root:
`C:\Users\Local-admin\AppData\Local\Temp\borkeo-triage-skip-PoeQ3r`

Tracked source/reference files and synthetic portraits only were copied; no
hospital databases, .env, uploads, backups or password exports. Only disposable
demo.sqlite and the browser in-memory database were seeded with 30 synthetic
patients. The live database was never seeded or replaced.

Final verification after corrections:

- npm test: 1008 passed, 0 failed (validation-tests.log).
- npm run check:khmer: passed (validation-khmer.log).
- Explicit Chromium triage-form-actions-browser.mjs: 1 passed. Covered desktop
  and phone layout, cancel without saving, removal of the print button with the
  admission form retained, simulated failed skip/retry, successful skip, absence
  from waiting, Complete Triage label/edit link, direct editable recall, and
  unchanged record_json after cancel and skip.
- Focused skipped-patient regression: passed. Blank discharge dates appear,
  discharged patients do not, recall clears the skip without altering the record.
- git diff --check: passed.

Earlier attempts exposed an encoding error in newly written approval metadata,
an absent shared status node in triage, and the skipped-list defects above.
These were corrected before final validation. A draft regression attempted NULL
against the current NOT NULL schema; the final test uses its actual blank-date
representation. No baseline was regenerated, test weakened, or live data changed.

Khmer approval scope: one exact baseline occurrence (protected/EMR.html:7316)
removed by owner's order, plus one safe retry-message translation registered
in approved-new-khmer.json and translations-needed.csv. Existing approvals stay.

Delivery: Borkeo-EMR-v46.0.0-triage-skip-update.txt contains the explicit manifest
and full UTF-8 source replacements. Merge with later customizations if present;
preserve .git, .env, patient databases, uploads, backups and .gitignore. No printer
acceptance or repair of the removed print action is claimed.
