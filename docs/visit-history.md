# Patient directory and visit history

Release: 44.0.0, based on master 43.9.0 (`13ac56b`). The existing edit-choice
dialog, return navigation, restored tabs and consultation workspace are retained.

The directory displays one row per Health ID, using the latest entry date, then
visit creation time and encounter key to break ties. A later edit to an old visit
does not make it the latest visit. Grouping happens before search and date or
department filters, so an older encounter cannot replace the latest row. Blank
Health IDs remain separate; equal names with different Health IDs remain separate.
Every encounter stays in the database, and operational queues keep their existing
encounter-based API responses.

Registration View and Edit retain their current behavior. Triage View opens a new
window with a visit list, departments, entry and exit dates, and payment status.
Selecting a visit renders a static copy of only that visit's triage. An Edit link
is available for active visits. Discharged OPD and IPD visits are locked by the
server even if a client bypasses disabled controls.

OPD doctors and chief doctors in the OPD context can read the patient's OPD and
IPD records, laboratory results, imaging findings and imaging attachments. The
read-only history path does not expand write permissions or reopen closed visits.
Triage history responses omit medical data, orders and discharge summaries.

Treatment corrections require Director approval. The existing audited request
workflow binds the grant to requester, encounter, form and patient version. One
successful save consumes it. An OPD correction preserves its discharge marker and
workflow state; it does not restart consultation, request another payment or issue
a new prescription. Other management roles cannot approve treatment corrections,
including through bulk approval. Registration identity edits stay available.

## Synthetic verification

Validation uses a disposable project copy with no hospital environment file,
patient database, backups or uploads. Copy tracked source and reference assets,
including gazetteer, hospital defaults, ICD-10 catalogue, `.env.example` and the
existing generated demo portraits. Seed its disposable `data/demo.sqlite` using
the exported `resetAndSeedThirtyTriagePatients` function from
`scripts/seed-v301-thirty-triage-patients.mjs`; several historical tests explicitly
expect those synthetic demo fixtures. Never run that reset function on hospital
data. The initial unseeded-copy failures were missing fixture/reference files;
release assertions and the payment-lock source assertion were updated for this
release and the approved correction exception.

- `npm test`: full suite, including grouping, history isolation, read-only cross-
  department access, server discharge locks, results and attachment permissions,
  and Director-only single-use correction approval.
- `npm run check:khmer`: existing Khmer is preserved; new UI text is recorded in
  the translation CSV and approved Khmer entries.
- `node --test tests/v438-visit-history-browser.mjs`: actual headless Chromium
  verifies one latest directory row, visit selection, separate triage snapshots,
  closed-visit edit suppression, OPD/IPD medical viewing and unchanged records.
  Windows may require permission to launch browser subprocesses.

No live hospital record was used for validation. A server restart and browser
refresh are required to use the updated code; this work does not deploy a server.

Final verification on 24 October 2026: all 1,006 tests passed; the Khmer check
passed; the actual browser test passed, including the Director-approved OPD
correction unlock. The combined update builder verified forward application to
the 43.9 baseline and reverse application against the prepared source files.
