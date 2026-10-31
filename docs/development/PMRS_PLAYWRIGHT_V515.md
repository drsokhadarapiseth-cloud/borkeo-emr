# PMRS browser transfer — v51.5.0

## Delivery status

This replaces the active PMRS2 copy/paste panel, MV3 extension, manual medicine-import page and JSON transfer-package download with a Playwright browser workflow at `/pmrs`. The legacy URLs return 404. Historical release bundles/documentation are retained as history; do not reapply them.

**Live transfer is not enabled or site-validated.** No authenticated PMRS page, current DOM, save endpoint, success receipt or automation authorization was supplied. The repository deliberately contains no invented production selectors. The profile loader blocks opening a live browser until the deployment operator supplies a verified, authorized profile outside the checkout. Both directions are implemented and exercised with synthetic fixtures, not real patients.

## Desktop deployment

The EMR Node process must run on a trusted hospital desktop with a visible browser. A Render/Vercel server cannot display this browser on the user's phone. This release does not include a remote desktop, cloud-to-local worker or unattended synchronization. Keep using the normal EMR login; credentials and authenticator codes for PMRS are entered directly into the separate Playwright browser.

1. Back up code with `npm run backup:code`; preserve databases, `.env`, uploads, backups and password exports. Stop only the identified EMR launcher. Disable/uninstall the old Borkeo PMRS2 Helper browser extension so it cannot continue injecting its old buttons.
2. Apply this release's combined update text, including its explicit code-only deletion list. Do not reapply old PMRS2 release files.
3. Run `npm ci`, then `npx playwright install chromium` on the desktop that runs Node. The project requires Node 24+. On Linux a ZIP-capable BSD tar is required by the existing code-backup restore tool; GNU tar cannot read its ZIP archives.
4. Run `npm test` and `npm run check:khmer`, restart the launcher and refresh the browser. `/pmrs` initially displays a Khmer disabled message. This is expected until the profile is verified.
5. Have an authorized operator/developer inspect the real PMRS forms using an approved test record. Confirm the operator's permission to automate PMRS; verify IDs, editable controls, exact choices, absence of autosave, all repeating rows, save request and success receipt. Record the authorization/reference in the profile.
6. Put the JSON profile **outside** the project, and set `PMRS_PLAYWRIGHT_PROFILE` to its absolute path in the local launch environment or existing `.env`. Do not commit the profile, credentials or browser state. Restart the launcher after configuration.

There is no persistent browser profile, screenshot, trace or storage-state export. The browser context expires after ten minutes; Close, logout, role/ward switch and server shutdown close it. API requests remain bound to the EMR session, active role and ward and use existing CSRF enforcement. Demo mode blocks browser APIs.

## Profile contract

See `server/pmrs/playwright.mjs` for validation. Required top-level values:

- `origin`: exactly `https://pmrs.digitalsp.gov.kh`.
- `automationAuthorized: true`, `selectorsVerified: true`, `verifiedAt` (YYYY-MM-DD), and a nonempty `verificationReference` describing the authorization and observed test evidence. These are deployment attestations, not a substitute for PMRS permission.
- `authenticated`, `patientId`, `encounterId`, `save`, `receipt`: each has a unique visible CSS `selector`. Identity/receipt default to rendered text; an ID in a form control uses `kind: "input"`. Configure `receipt` as a success-only element whose text changes after save and contains the exact encounter ID. Do not use a generic notification that can display an error.
- `submission: { "path": "/the-observed-save-path", "method": "POST" }`: the exact verified state-changing endpoint (PUT/PATCH also supported). No endpoint is supplied in the release. After authentication is confirmed, browser network writes are blocked except for one request to this endpoint during an explicitly confirmed submission. Reads and permitted login hosts remain allowed.
- Optional `loginOrigins`: exact HTTPS origins verified to be required for SSO/resources. The default allows only PMRS; no wildcard hosts.
- `read`: object mapping source paths to `{selector, kind}`. `kind` is `text` (default), `input`, `select` or `checkbox`. `values` may explicitly map observed strings to canonical EMR values; an unmapped value stops the operation. No fuzzy medicine/diagnosis matching.
- `write`: object mapping each clinical leaf path to `{selector, kind: "input" | "select" | "checkbox"}` and optional explicit `values`. All nonempty payload fields must be covered. Medicine names require an exact matching select option (or an explicitly mapped option ID); free-text medicine entry is blocked. Numeric array path segments may be replaced with `*`; selector placeholders `{{0}}`, `{{1}}`, etc. expand to the corresponding one-based array index. Example syntax for a synthetic table: `clinical.prescription.medications.*.name` and `.medicine-row:nth-of-type({{0}}) select.name`. These are syntax examples, **not live PMRS selectors**.

Read paths start with `registration.` or `clinical.`. Identity comes from the separate verified identity selectors and overrides registration healthId/caseNumber. Registration supports fullName or firstName/lastName, sex (exact EMR radio values), dob (ISO date), age, phone, equityCard, address hierarchy, street, entryType and caregiver details. For repeating source rows, enumerate each exact path/index in the verified profile. This release does not infer row counts, add target rows, click navigation controls, change tabs automatically, or follow a multi-page wizard. Missing/ambiguous/hidden controls stop the transfer. All target controls must already be available on the selected encounter form.

Export paths come from `clinicalPayload()` in `server/pmrs/records.mjs`: triage, caseType, chiefComplaint, diagnosisText/diagnosisIcd10, ancillaryService, followUps, prescription and discharge. The existing clinical mapper and warning checks remain in use (now under `server/pmrs/`). Hospital IDs, technical flags and warning metadata are never entered as clinical form values. Discharge clinical values remain reviewable; no unrelated admission, financial, pharmacy or NPCA action is invoked.

## Workflow and limits

Open the connection; staff log in and complete the authenticator step themselves, then open the intended patient/encounter.

**Import:** Capture shows PMRS source data. Registration staff can preview/fill a new registration, including duplicate warnings and address resolution; they must review and use the existing EMR Save action. PMRS patient ID remains in the other-card field and encounter ID in the existing PMRS case-number field; hospital numbering is preserved. Existing records require a verified patient/encounter link. If none exists, a doctor/administrator must compare demographics and retype the PMRS patient ID, PMRS encounter ID and EMR case number to link them. Links cannot silently replace an existing different identity or duplicate another linked encounter.

Clinical import supports diagnosis/ICD-10, OPD prescription medicines, counselling/follow-up date, and medicines on an exact existing dated IPD daily follow-up. It uses captured server-held data, a separate preview, explicit approval, record-version checks, encounter write/correction policy and the previous medicine idempotency ledger. The existing HEF-only restriction for medicine imports remains. Triage changes, discharge imports, unsupported schedules/routes/units, new daily follow-up creation and unsupported fields require review in the existing EMR forms and are blocked rather than guessed. Registration import is form preparation, not automatic patient creation or merge.

**Export:** Select the saved EMR encounter, preview differences, explicitly approve filling, review the PMRS form, then approve submission separately. The linked PMRS patient AND encounter must match at preview/fill/submit. Clinical warnings, unmapped nonempty fields, unknown choices, local version changes or edited target fields block the operation. Fill does not click Save. Network writes are blocked during review/fill. A changed encounter-specific success receipt is required after submission. A persistent hash ledger records an attempt as unknown before clicking Save and confirms it only after receipt verification. An uncertain/duplicate attempt cannot be retried automatically; reconcile it manually in PMRS with the administrator. No background/batch/bidirectional autosync, arbitrary URL navigation or automatic overwrite is included.

The runtime cannot verify a third-party site's permission or DOM without the actual authorized session. Site acceptance testing with an approved test record remains required before staff use. Future PMRS UI changes require re-verification of the external profile. Do not label this release as live-tested.

## Validation

- New API tests use disposable synthetic SQLite databases: CSRF, role/ward access, session ownership, explicit ID linking, preview requirements, stale versions, HEF restriction, medicine idempotency and preserved hospital IDs.
- Browser acceptance uses actual Playwright Chromium with intercepted synthetic PMRS pages; no live PMRS request or patient data. Run `node --test tests/pmrs-playwright-browser.mjs` after installing Chromium.
- Unit tests cover profile rejection, expiry/logout/context cleanup, overlapping jobs and retained clinical mapping safeguards.
- Original baseline `a830a8b52b44355e669f29de2a8358ccd0867943` had six failing tests in this Linux environment: ZIP restore under GNU tar, three CRLF-specific IPD test extractions, and two malformed paraclinic helper extractions. Install BSD tar for ZIP support. The two test files now extract their existing functions correctly; no medical form or paraclinic behavior was changed for those harness repairs.

## Backup and rollback

Clean baseline: v51.4.0, commit `a830a8b52b44355e669f29de2a8358ccd0867943`.
Code-only backup: `/root/Borkeo_EMR_Code_Backups/v51.4.0-a830a8b5-066e220e`.
Restore code only into a **new** folder. Do not overwrite hospital data, secrets or uploads. The new `pmrs_browser_exports` table records only hashes, state, actor ID and timestamps; existing patient/import history is preserved. Removing the new UI does not require deleting patient records or this ledger.

Final release validation: applied all 69 code actions from the combined update
text to a disposable baseline checkout, verifying every write's UTF-8 byte count
and SHA-256 and applying the deletion list. In that disposable copy:
`npm test` passed **1,103/1,103**, `npm run check:khmer` passed, and the explicit
Playwright acceptance suite passed **2/2** (actual Chromium; synthetic source
page and authenticated Khmer UI at 1440px/390px). The Linux test PATH used
bsdtar 3.7.2 for the existing ZIP restore test. No live PMRS transfers ran.
