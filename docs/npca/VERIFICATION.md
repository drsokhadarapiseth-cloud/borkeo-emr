# v42.8.0 verification — 2026-10-24

- `npm test`: **966 passed, 0 failed**, 53.1 seconds on the final run.
- `npm run check:khmer`: **passed**.
- Node.js v24.21.0; tests ran in an isolated disposable project copy without
  `.env`, hospital databases, patient uploads, or backups. Thirty synthetic
  demo patients supplied the older regression fixtures.
- The 18 NPCA checks use in-memory SQLite and a loopback mock. They cover
  official code lists/forms, OPD/IPD payloads, ANC, transfers, progress notes,
  emergency/surgery/referral links, CMS/dispense validation, Cambodia times,
  cached/refreshed tokens, credential-safe audit/settings, beneficiary SPID
  selection, disabled/no-network behavior, offline retries, Ready/Failed
  polling, Pending admission updates, stable-code resubmission, HTTP error
  handling, role/CSRF restrictions, Registration save, Billing badge access,
  eligibility recheck invalidation, and saved qH prescriptions.
- Earlier authentication, follow-up ICD-10, PMRS2, pharmacy, stock, maternal,
  financial, navigation, and patient-card regression tests remain passing.
- `git diff --check` passed. The combined update diff is reverse-checked
  against the updated files and built from a reconstructed v42.7.0 baseline.

No real patient data was sent to any external server. NPCA remains disabled
by default. No live NPCA certification or browser acceptance against NPCA was
performed. External acceptance items are listed in `OPEN-QUESTIONS.md` and
the integration guide. The separate ANC chart/to-do redesign is not part of
this NPCA update.
