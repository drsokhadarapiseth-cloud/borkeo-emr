# Borkeo EMR NPCA integration — v42.8.0

NPCA is disabled by default. No real patient data was sent during development.
The integration was tested with synthetic patients and a loopback HTTP mock.
Passing those tests is not NPCA certification.

## What is ready

- ADMIN connection settings and token test at `/admin/npca`. Director can read settings but cannot test, map, submit, or resubmit.
- Registration's additional NPCA beneficiary search. Existing HEF and NSSF lookups remain available. Select the household member, check identity, then save registration. The server validates the search selection and saves SPID, NPCA patient code, cards, and payment scheme additively. An expired, ineligible, mismatched, or ambiguous selection cannot become a claim. Identity/card edits invalidate the previous claim link until verification is repeated.
- A local reference snapshot extracted from all three original v1.4 Excel workbooks. `server/npca/standards.json` records source SHA-256 hashes. `scripts/import-npca-standards.py` rebuilds it using the Python standard library; Python is not needed to run the EMR.
- A visit builder, local validation, durable SQLite queue, retries, reconciliation, polling, correction links, payload review, and record/Billing status badges.
- Supplemental clinical fields for maternal and child forms use the official Excel labels and values. They are optional for normal EMR work and required only when the NPCA validation rules require them. The existing clinical forms and their saved fields are preserved.
- A synthetic mock and tests in `tests/helpers/npca-mock.mjs` and `tests/v428-npca.test.mjs`.

## What is sent

A single `{"visits":[...]}` payload contains the patient identity, verified SPID,
NCDD-coded address, visit, encounters, one initial triage, vital signs, saved
clinical histories/examinations, released lab/imaging results, ICD-10 diagnoses,
SOAP notes, prescriptions with CMS and explicit dispense, invoices, referrals,
and applicable structured forms. Unreleased results are excluded. Patient photos,
signature images, local file paths, and private attachment URLs are not exported.
Imaging reports use text unless a reachable image URL is explicitly available.

Patient code remains the Borkeo Health ID, falling back to the patient key. The
NPCA-assigned patient code is retained locally for reconciliation; ask NPCA to
confirm that relationship. Visit and encounter codes are deterministic and stay
the same through correction and OPD-to-IPD transfer. Times use `+07:00`.

Payloads are stored in `npca_submissions` for authorized local review. They are
not written into the audit log. Audit entries record actions, actor, visit, and
status, without passwords, tokens, card numbers, or full payloads. Tokens remain
in server memory. Credentials are read from `.env` and are never displayed.

## When a visit may be submitted

1. Verify the beneficiary in Registration and save the correct member.
2. Finish the clinical work. OPD requires completion/discharge (normally the
   pharmacy receipt); IPD requires discharge. A doctor-signed ANC referral is a
   completed referral. HEF Poor IPD may first be submitted after admission and
   then updated after discharge with the same visit code.
3. A Cashier (`CLERK`), Accountant, or ADMIN opens `/npca`, reviews the payload,
   fixes every listed problem, and selects Submit. Clinical staff completing a
   note do not independently authorize an external claim.
4. The background worker processes authorized queued visits one at a time. It
   scans every 30 seconds. The queue survives a server restart or internet loss.
5. Status 5 is Processing, 3 Pending, 2 Failed, and 1 Ready. Status 5/3 records
   are polled every eight hours by default. Ready/Failed records stop polling.
6. Correct Failed records, or finish Pending admissions, and submit again.
   The payload must change; its visit code does not. Ready and Processing
   records cannot be resubmitted from the local interface.

After an ambiguous timeout or HTTP 500, the worker checks the processed endpoint
before retrying the stable visit code. Network retries use exponential backoff,
capped at eight hours. HTTP 400/401-after-refresh/403/422 stop for correction.

## Credentials and configuration — one step at a time

1. Ask the NPCA integration team for a test environment, OAuth password-grant
   client ID and secret, service username/password, system code, and official
   health-facility code. Ask them to answer `OPEN-QUESTIONS.md`.
2. Back up the hospital database through the existing EMR backup procedure.
3. Copy `.env.example` to `.env` only if `.env` does not already exist. Otherwise
   add the NPCA settings to the existing file. Never replace unrelated settings.
4. Leave `NPCA_ENABLED=false` while entering the credentials. Keep `.env` local;
   never add it to GitHub or the update text file.
5. Set `NPCA_BASE_URL` to the HTTPS origin NPCA supplies. There is no default
   external destination. Do not use the example domains from Postman as a
   production address without NPCA's approval.
6. Fill `NPCA_CLIENT_ID`, `NPCA_CLIENT_SECRET`, `NPCA_USERNAME`, `NPCA_PASSWORD`,
   `NPCA_SYSTEM_CODE`, and `NPCA_FACILITY_CODE` with NPCA's values.
7. Set the endpoint path/method pairs to the values NPCA confirms. Defaults are
   from the supplied Postman collection: token POST `/oauth/token`, search GET
   `/api/v1/external/beneficiary/search`, submit POST `/api/v1/external/visits`,
   processed GET `/api/v1/external/visits/processed`.
8. Keep `NPCA_POLL_HOURS=8` and `NPCA_TIMEOUT_MS=15000` unless NPCA recommends a
   change. `NPCA_SEND_FORMS=true` is the default; set false if NPCA confirms its
   production v1.3 endpoint cannot yet accept the v1.4 forms.
9. Only after NPCA confirms the test environment and authorizes synthetic test
   submissions, set `NPCA_ENABLED=true` and restart the EMR.
10. Log in as ADMIN, open `/admin/npca`, and use Test connection. It shows the
    last successful token time and never shows credentials or tokens.
11. Enter only NPCA-confirmed service-code mappings. Other code overrides must
    target a value in the official workbook. A missing mapping blocks the claim.
12. Run synthetic OPD, IPD, transfer, referral, ANC/PNC, delivery, contraception,
    abortion, and child cases in a separate test database. Obtain NPCA's
    acceptance of the actual payloads before changing to production credentials.
13. Enable production only after NPCA/hospital approval. No hospital database,
    uploads, or backups need to be moved to another host for this integration.

To stop outbound integration, set `NPCA_ENABLED=false` and restart. Local EMR
work continues, and queued/submitted records remain in the local database.

## Correcting validation problems

Open Review on the NPCA page. Each local problem names the field and links to
Registration, Triage, the clinical record, ANC, or Billing. Fill missing data on
that screen, save, and review again. The review dialog also contains a collapsed
technical payload view. It does not send anything.

- A free-text medicine without a CMS code, an unknown ICD-10 code, or a missing
  dispense quantity blocks submission. No code or clinical normal value is guessed.
- Required clinician/provider metadata must be present. New/changed daily notes
  get a small server-authenticated authorship snapshot; unchanged older notes
  are not reassigned to today's doctor. Older notes without authorship may need
  clinical review and correction before export.
- The last saved triage must precede consultation/admission. If a later edit
  replaced the historical triage and the earlier measurements are unavailable,
  the integration blocks instead of inventing the original observations.
- NPCA service codes, mixed-currency rules, and invoice-level discount allocation
  require confirmation. Unconfirmed mappings/allocations block submission; existing
  billing calculations are not changed.
- Referral facility code, reference number, transport, doctor phone, and public
  document URL may need the additional referral fields on the clinical record.
  The integration never publishes a private attachment to create a URL.
- Form fields not stored structurally in older forms can be entered in the
  additional NPCA assessment panel. Unknown value sets, including the missing
  Positivity list, still block until NPCA resolves them.

## Local verification

Run tests in a disposable project copy, without `.env`, patient databases,
backups, or patient uploads. Use synthetic fixtures only. The mock's insecure
HTTP exception is programmatic and limited to 127.0.0.1/::1; no `.env` switch
allows insecure remote HTTP.

Run `npm test`, then `npm run check:khmer`. The suite uses four test workers
because older regression tests share a synthetic demo fixture. New NPCA tests
use in-memory SQLite and the local mock.

## Remaining external acceptance work

Credentials, endpoint/encoding confirmation, actual beneficiary eligibility
shape, service mappings, missing value sets, referral document policy, invoice
currency/discount rules, and NPCA's test-server approval remain external work.
No live NPCA connection, production certification, external upload, or browser
acceptance test against NPCA was performed. See `OPEN-QUESTIONS.md` for the
precise source inconsistencies and choices.
