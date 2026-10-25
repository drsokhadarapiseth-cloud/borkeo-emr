# Triage Summary button removal - v45.8.0

25 October 2026. Branch: feature/triage-remove-summary, based on fetched master
bff56ec. Implements only approved item 1: TRIAGE sees Vitals without Summary.
Other roles retain their tabs. No clinical, queue, pharmacy, laboratory,
financial, patient-data or ignore-rule changes.

Disposable validation root:
`C:\Users\Local-admin\AppData\Local\Temp\borkeo-triage-summary-k4SP13`

Tracked source and reference ICD-10/gazetteer/facility configuration/synthetic
portraits were copied; hospital databases, .env, uploads, backups and password
exports were excluded. Only the disposable demo.sqlite was seeded with
resetAndSeedThirtyTriagePatients (30 synthetic patients). The first validation
attempt lacked hospital-defaults.json and was stopped; that reference file was
added before the final full run.

Final results:

- npm test: 1007 tests passed, 0 failed (validation-tests.log).
- npm run check:khmer: passed, no issues (validation-khmer.log).
- Focused chart/navigation/version tests: 6 passed (validation-focused.log).
- git diff --check: passed.

Existing role/navigation tests now verify TRIAGE's single Vitals tab, other role
tab sets, clicks, selection refresh and fallback from a disallowed role/tab.
Package, both visible login labels and server header consistently use 45.8.
No dedicated browser or print check was run for this tab-only change; those
are not claimed by this report. Items 2-4 remain pending separate agreement.

Delivery: Borkeo-EMR-v45.8.0-triage-summary-update.txt contains an explicit
manifest, full UTF-8 replacement files and installation instructions. It
contains no runtime data or credentials.
