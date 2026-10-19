# Borkeo EMR Changelog

## v38.3 (Phase 3: Repository Cleanup)
- Repository cleanup: archived superseded update scripts, patches, and scratch files to `../Borkeo_EMR_archive/`.
- Restructured `README.md` with quickstart instructions for running, testing, and deploying.
- Added comprehensive `docs/test-changes.md` and `CHANGELOG.md`.

## v38.2 (Phase 2: Trustworthy Test Suite)
- Test suite fully green: 756/756 passing tests with zero failures.
- Fixed financial void handler bug for payments with SQLite snake_case fields.
- Fixed nurse daily monitoring records merge preserving vital sign inputs alongside doctor treatment orders.
- Scoped doctor cross-ward access specifically for emergency admissions while maintaining strict isolation between regular wards.
- Modernized legacy test cache busters and dynamic build versions across all test suites.
- Consolidated version checking into `tests/version-consistency.test.mjs`.

## v38.1 (Phase 1: Authentication & Network Exposure Hardening)
- Network binding: defaults to `127.0.0.1` instead of `0.0.0.0`; requires explicit `--host` or `HOST` environment variable.
- Demo mode security: demo mode is opt-in; production mode requires valid user passwords and enforces account lockout after repeated failures.
- Added administrative user management scripts: `scripts/create-user.mjs` and `scripts/reset-password.mjs`.
- Implemented optional TOTP two-factor authentication for Admin and Director roles.

## v37.0 - v38.0
- Cambodian mobile phone number validation policy according to national telco prefix allocation.
- Patient caregiver identity and phone validation on admission and registration.
- Health Equity Fund (HEF) member verification and bilingual label refinements.
- Khmer default interface enforcement with English strictly reserved for explicit EN mode and standard laboratory test names.
- Performance caching and HTTP compression enhancements for provincial hospital network links.

## v19.0 - v36.0 (Historical Summary)
- Multi-ward inpatient workflows and IPD medication administration tracking.
- Paraclinic workflows: laboratory requisition forms, specimen tracking, unit conversions, and imaging worklists.
- Financial management: cashier billing, service concessions, itemized receipts, and cashflow reports.
- Patient identity cards, barcode/sticker printing, and Cambodia gazetteer address integration.
- PMRS2 provincial reporting exports and clinical audit trails.
