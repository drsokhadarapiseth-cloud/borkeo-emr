# Older-record triage skip correction - v46.1.0

25 October 2026, Cambodia. Base: clean fetched master 838f069.
Branch: fix/triage-skip-active-queue-number. User authorized the correction after
the reported skip failure was diagnosed as a missing saved registration queue
number despite a valid active queue call.

Change: preserve existing supplied/saved number precedence. If that result is
invalid, read the latest active call for exactly the same patient and service.
Validate and reuse its queue number in the existing skip operation. No queue
number is allocated, no registration/clinical JSON is rewritten, and inactive
calls, another patient and another service cannot supply a fallback. A record
with neither a valid saved number nor an active call still fails safely.

Existing role, ward, CSRF and edit permissions, skipped-list direct editing,
admission form, print controls and Khmer wording are unchanged. Package/login/
server version markers advance together from 46.0 to 46.1.

Disposable validation root:
`C:\Users\Local-admin\AppData\Local\Temp\borkeo-skip-active-number-m9EOf5`

Copied tracked source and reference ICD-10/gazetteer/facility files plus synthetic
portraits. Excluded hospital databases, .env, uploads, backups and password
exports. Only disposable demo.sqlite and browser in-memory fixtures were seeded
with 30 synthetic patients. Hospital records were not changed during validation.

Results:

- npm test: 1009 passed, 0 failed (validation-tests.log).
- npm run check:khmer: passed (validation-khmer.log); baseline untouched.
- Focused skipped-patient tests: 2 passed. Cover blank discharge dates, recall,
  the older-record fallback, unchanged patient JSON, and rejection of inactive,
  different-patient and different-service calls.
- Explicit Chromium triage-form-actions-browser.mjs: 1 passed. Both saved
  registration-number keys are removed from the synthetic fixture. The actual
  waiting-list action establishes an active call; bottom Skip reuses that exact
  number, moves the patient out of waiting into skipped, and Complete Triage
  reopens editable triage without an edit request. Failure/retry, cancel without
  saving, unchanged record_json and desktop/phone layout remain covered.
- git diff --check: passed.

The older v46.0 browser fixture always retained its registration number and
missed this real older-record case. The expanded fixture now reproduces it.

Delivery: Borkeo-EMR-v46.1.0-triage-skip-fix-update.txt, explicit manifest and
UTF-8 replacements for the matching base. Merge targeted changes if later
customizations exist. Preserve .git, .env, hospital data and .gitignore. Restart
one verified EMR instance and refresh the browser after applying the update.
