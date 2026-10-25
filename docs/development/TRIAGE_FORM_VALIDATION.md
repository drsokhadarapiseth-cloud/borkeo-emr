# Triage form actions and heading - v45.9.0

25 October 2026, Cambodia. Base: fetched master 8539292, initially clean.
Branch: feature/triage-form-actions.

Approved behavior: no duplicate three-button editor toolbar or Vitals tab in
triage; native cancel beside Save and Transfer returns to /triage without
saving; the Khmer heading remains fully inside the white form on desktop and
phone screens. Other roles retain their controls. Clinical, queue, financial,
laboratory and pharmacy rules and patient data remain unchanged.

Disposable root:
`C:\Users\Local-admin\AppData\Local\Temp\borkeo-triage-actions-bUc6UX`

Only tracked source/reference configuration and synthetic portraits were copied.
Hospital databases, .env, uploads, backups and password exports were excluded.
The disposable demo.sqlite and browser in-memory database were each seeded
with 30 synthetic patients. Existing node_modules was shared through a junction.

- npm test: 1007 passed, 0 failed (validation-tests.log).
- npm run check:khmer: passed (validation-khmer.log).
- Explicit tests/triage-form-actions-browser.mjs: 1 passed in Chromium. Verified
  1440px and 390px layouts, heading containment, hidden tab strip, absent editor
  toolbar, save/cancel on the same row, enabled cancel, return to /triage despite
  an empty required temperature field, and unchanged stored patient data.
- git diff --check: passed.

The restricted Chromium attempt stalled and was stopped; the successful browser
run used elevated browser/process access against only in-memory synthetic data.
No print stylesheet was modified; no printer acceptance is claimed.

Delivery: Borkeo-EMR-v45.9.0-triage-form-update.txt. Install from its explicit
manifest against the matching base, merging later customizations if present.
Never replace .git, .env, databases, uploads or backups. Restart one verified
EMR instance and refresh the browser after installation.
