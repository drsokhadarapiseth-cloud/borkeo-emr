# Test results
2026-10-24 startup: Node v24.21.0, Windows PowerShell. Branch master 107ed3a, baseline package 42.8.0. git diff --stat empty. No tests yet in this run.
Browser and print verification: not performed. Full suite and Khmer checks pending.
No production database/server launched. No test background process started.

Before tests: AUTH-01 has partial implementation, unverified. Deployment network cause remains unresolved. New tests exercise UI script with synthetic DOM/fetch; this is not browser visual evidence.

2026-10-24 verification: baseline npm test: 964/966 pass, 2 pre-existing failures in tests/v1200-release.test.mjs expecting local data/demo.sqlite. Baseline check:khmer PASS. Targeted context/auth/CSRF: 15/15 PASS. Explicit headless Edge synthetic browser flow: PASS (login, context network failure/retry, rejected unassigned ward, rotated CSRF, authorized landing, expired session). Browser required approved escalation; initial sandbox attempt interrupted. Two legacy fixture tests now use seedDemoPatients(:memory:), targeted 6/6 PASS. No external NPCA calls or real patient records used.
Relevant later edits: login failures now hide raw backend error text; retry button styled/labeled; expired session disables submit. Added browser login network/401 assertions. These later edits need fresh tests.

2026-10-24 08:18:00 +07:00 : 42.9 full regression and final Chromium checks running in changed disposable copy; Khmer check PASS on final UI strings. Do not claim release verified until completion.

2026-10-24 final browser: node --test tests/context-recovery-browser.mjs PASS (1/1, 12.57 seconds), headless Edge, disposable 42.9 source copy, synthetic multi-ward doctor, in-memory DB, NPCA disabled. Covers failed login network/401 recovery, context bootstrap network retry, cookie persistence, rotated CSRF, rejected unassigned ward, authorized landing, expired session redirect; zero uncaught runtime errors.
First changed full run: 972/974 passed; translation entry inserted before required original 61 entries and missing CSV provenance, plus stale v399 login asset expectation. Corrected registry append and CSV; cache assertion updated. Targeted translation/password-change checks 7/7 PASS. Re-running full suite; not yet a passing full result.
Final npm run check:khmer PASS after registry/CSV corrections. No clinical source edits after Chromium test; only translation bookkeeping/cache assertion/docs/delivery changes.

2026-10-24 08:22 +07:00 FINAL: npm test PASS: 974 tests, 974 pass, 0 fail, 0 skipped (129.86 seconds). Disposable changed copy only; final runtime files version 42.9.0. npm run check:khmer PASS. Explicit Chromium test PASS 1/1. Combined update generated with 22-file manifest; reverse check against current files PASS and forward git apply --check against disposable 42.8 baseline PASS. No print/PDF output visually verified. No production NPCA or patient transmission.
