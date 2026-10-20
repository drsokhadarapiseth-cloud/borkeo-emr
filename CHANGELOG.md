# Borkeo EMR Changelog

## v40.0.0 (Short staff passwords: minimum 4 characters, hospital default 1234)
- Hospital decision: passwords need 4–128 characters (was 12–128). One rule in `server/password.mjs` (`MIN_PASSWORD_LENGTH`, `DEFAULT_STAFF_PASSWORD = '1234'`), the change-password schema, and every password box (sign-in, change-password screen, account menu, admin User accounts, console scripts).
- New default ward accounts start with `1234` (was `111111111111`); the sign-in account picker fills `1234`; the browser-import CSV generator uses `1234` and the current Wi-Fi address.
- New `npm run set-all-passwords` (`scripts/set-all-passwords.mjs`): refuses while the EMR is running, writes a full backup (`<data folder>/backups/emr-before-1234-<date-time>.sqlite`), then sets every account to `1234`, clears "must change password", signs everyone out and records `PASSWORD_SET_TO_HOSPITAL_DEFAULT` in the audit log. Patient records are not touched.
- Unchanged: sign-in lockout after repeated failures, two-factor codes for admin/director when enabled, admin password reset still asks the person to choose a new password.
- Security note: with 1234 for every account, anyone on the same Wi-Fi can sign in as any staff member. Use Wi-Fi mode only on a staff-only network.
- Tests: 824/824 (3 new in `tests/v400-short-passwords.test.mjs`; version checks in six older tests widened to accept v40.x).

## v39.9.0 (Fix "page isn't redirecting properly" for accounts that must change their password)
- Fixed: an account marked "must change password" (new accounts and admin resets) was sent between `/login?passwordChange=1` and its work page forever; Firefox showed "The page isn't redirecting properly" (Chrome: "too many redirects"). `/login` now stays on the sign-in page for such accounts.
- The sign-in page shows a Khmer "ប្តូរពាក្យសម្ងាត់" form (new password, confirm; current password only when not just typed). After saving, the person is signed in again with the new password and goes to their work page. "ចាកចេញ" signs out. Password rule unchanged (12–128 characters).
- Tests: 821/821 (2 new in `tests/v399-password-change-loop.test.mjs`; version test updated 39.8 → 39.9). Checked end-to-end in headless Firefox on a disposable database.

## v39.8.0 (Side navigation redesign, SOAP English titles, phone access)
- Professional side navigation: collapsed 68px icon rail that expands to 264px over the page on hover or keyboard focus (200ms collapse delay, no content reflow), optional per-user pin, drawer with backdrop and Esc on phones/tablets/touch screens, tooltips while collapsed, prefers-reduced-motion support, never printed.
- Grouped sections (Patient care, Clinical services, Pharmacy and stock, Finance, Administration), one consistent inline-SVG icon set (`public/icons.svg`), hospital brand at the top, user/role/ward, language and sign-out at the bottom, pending counters on the icons.
- One central navigation map `public/nav-config.js` based on the real server permissions; role/ward switch from the sidebar updates the menu without a page reload. Fixed links that led to 403/404 pages (IPD transfer for IPD doctors, Lab/Imaging for doctors, `/stock`, Expenses for cashiers, admin menu for chief ward/ward head). Requests stays management-only.
- SOAP section titles are always Subjective, Objective, Assessment, Plan (with S/O/A/P) in Khmer mode, EN mode and print; excluded from translation. Hints stay Khmer by default.
- Phones: `npm run start:wifi` / `Start-Borkeo-WiFi.bat` serve the password-protected EMR on the local Wi-Fi (plain http) and print the phone address; the topbar and drawer scale to finger size on phones in desktop viewport mode.
- Fixed: shell mounted twice (duplicate breadcrumb), topbar icons invisible under the global button theme, missing `os` import that hid the phone address, inline `onerror` on the logo.
- Tests: 819/819 (7 new in `tests/v398-side-navigation.test.mjs`). Screenshots in `docs/ui-screenshots/` (before-*/after-*).

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
