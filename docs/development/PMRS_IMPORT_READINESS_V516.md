# v51.6.0 — independent PMRS import/export readiness

## What changed

The previous shared profile validator blocked read-only PMRS → EMR imports unless export Save/receipt selectors, write mappings and submission endpoint were also configured. This correction validates each direction separately.

- Import requires authorized origin, explicit automation authorization, verified reading selectors/evidence, authenticated-page selector, patient ID, encounter ID and nonempty valid read mappings. No Save selector, receipt, write mapping or submission endpoint is required.
- Export additionally requires its own `exportVerified: true`, `exportVerifiedAt` (YYYY-MM-DD), `exportVerificationReference`, and valid Save/receipt selectors, write mappings and submission endpoint. Existing full profiles without independent export evidence become import-only, not automatically export-enabled.
- Export gates are enforced by the server routes, bridge and Playwright adapter. Client button state cannot bypass them. Unverified export requests do not consume a pending import job, click Save, or create an attempted-export ledger entry.
- The Khmer page displays import readiness independently and keeps export controls disabled until verified. Missing configuration, unreadable configuration, missing authorization, unverified reading mappings, missing identities and missing read fields have separate configuration messages. These do not disclose filesystem paths, selectors, credentials or patient data.
- Patient matching, encounter matching, access control, duplicate review, record versions, correction policy, medicine safety/HEF restrictions, and explicit review remain unchanged. No PMRS records were written during this development.

## What this patch does not establish

The user's diagnostics recorded zero requests passing a guard, no successful response and no receipt. They did NOT record rejected requests or rejection reasons. That evidence establishes an unconfirmed save, not an identity mismatch. Do not replay the request or click Save to diagnose it. Any remote change needs manual reconciliation in PMRS.

The supplied local draft reportedly has both existing verification flags false, no identity/read mappings and no configured profile path. Those are independent import blockers. This patch does NOT set flags true, invent site selectors, create a fake success receipt, choose a submission endpoint, or certify a live mapping. Actual production transfer remains blocked until the deployment operator supplies and verifies the remaining import settings.

## Import-only profile

Keep the profile outside the repository and point `PMRS_PLAYWRIGHT_PROFILE` at its absolute path in the same launch environment used to start Node (or the existing local .env). Restart the identified launcher after changing the profile or environment. Do not disclose the entire .env file, browser state, passwords, authenticator codes or patient values.

An intentionally unverified draft may start as:

```json
{
  "origin": "https://pmrs.digitalsp.gov.kh",
  "automationAuthorized": false,
  "selectorsVerified": false,
  "verifiedAt": "",
  "verificationReference": "",
  "authenticated": { "selector": "" },
  "patientId": { "selector": "" },
  "encounterId": { "selector": "" },
  "read": {}
}
```

The draft is expected to remain disabled. Populate actual selectors only from the authorized real page; verify exact one-match identity selection and supported field values. Only an authorized operator may attest automation authorization. Only set `selectorsVerified` after a read-only validation with evidence. No PMRS Save test is necessary for import readiness. A synthetic test passing cannot establish live site verification.

The v51.5 read-mapping syntax is preserved. It reads the selected element's rendered text or control value; it does not automatically strip arbitrary labels or unit suffixes from mixed label/value spans. Choose verified value-only elements, or implement separately reviewed extraction for such fields before enabling them. Do not map a full labelled span directly into a patient's name, infer DOB from age, or guess hierarchical address codes.

## Safe readiness check

While signed in with an allowed EMR role, inspect the response from `GET /api/pmrs/status` (the page fetches it automatically). It contains booleans and blocker codes only:

- `importReady` controls opening/capturing/importing.
- `exportReady` controls export preview/fill/submit.
- `configured` is a compatibility alias for import readiness.
- `profilePathConfigured` reports whether a source was configured, not its private path.
- `importBlockers` and `exportBlockers` state the missing prerequisites.

Examples: `PROFILE_PATH_REQUIRED`, `PROFILE_UNREADABLE`, `AUTOMATION_AUTHORIZATION_REQUIRED`, `IMPORT_VERIFICATION_REQUIRED`, `IMPORT_EVIDENCE_REQUIRED`, `IDENTITY_MAPPING_REQUIRED`, `READ_MAPPING_REQUIRED`. Export blockers additionally include export verification/evidence, write mappings, Save/receipt mappings and submission endpoint.

Stop claiming a connection is configured merely because dependencies and synthetic tests pass. Never bypass validators by passing dummy selectors or changing false flags without verification.

## Installation and validation

1. Confirm version 51.5.0, inspect unfinished work and run `npm run backup:code` on a clean code baseline. Preserve the user's local mapping/diagnostic work and profile outside the repository.
2. Apply the combined v51.6 update text. Stop on an unexpected current-file checksum and merge/review local customizations instead of overwriting them. Never change patient data, .env, .gitignore, credentials, uploads or existing databases.
3. Dependencies are unchanged. Run `npm test`, `npm run check:khmer`, and `node --test tests/pmrs-playwright-browser.mjs` in a disposable copy with synthetic fixtures. The province-count test now writes a raw string, preventing the previously reproduced console-color false failure without changing address data. Existing Linux ZIP restore tests require BSD tar.
4. Restart the identified EMR launcher, refresh the PMRS page and inspect readiness. Correct the reported import prerequisites; keep export disabled while its verification is incomplete.

Clean baseline is v51.5.0 at `8c7382471488af8c13d2949aaf380d05c5254d8f`.
Code-only backup created before editing:
`/root/Borkeo_EMR_Code_Backups/v51.5.0-8c738247-8453ac76`.
Restore code into a NEW folder; do not overwrite live data or secrets.

Release validation: the actual combined update was applied to a disposable
v51.5 checkout with pre-update and target SHA-256/byte verification (19 code
actions). `npm test` passed 1,107/1,107; `npm run check:khmer` passed; explicit
Playwright browser/UI acceptance passed 4/4. All records/pages were synthetic.
The original province-count test also passed with FORCE_COLOR=1 after its raw
string-output correction. No PMRS Save was clicked or live request replayed.
