# Referred-patient table, sidebar and visit review - v49.5.0

Approved scope: move incoming referrals into the sidebar; present a normal-style
patient table; review medical/OPD/referral/nursing records by entry/discharge visit.
The owner explicitly selected doctors and management only for rejection.
Base master: f6ecd80872a45d08b64b6e9dcb71be46b2d856a7, 49.4.0.
Primary release 49.5.0; separate receiving installation 49.3.0 -> 49.4.0.

## Result

The receiving EMR sidebar now contains **អ្នកជំងឺពីមូលដ្ឋានសុខាភិបាលផ្សេង**
beside the normal patient-list entry. The floating shortcut is removed. A bounded
authenticated capability lookup gates this item by instance, independently of
role/ward switching; ordinary sidebar active state, language and mobile rendering
are reused. All standard authenticated receiving staff retain access.

The table includes patient name, sex, age, phone, Health ID, equity card, payment
category, department, entry/discharge dates, transfer status and actions. Search
matches name, ID and phone. Horizontal scrolling is confined to the table, with
the actions kept visible. Each row remains tied to its particular transfer.

View defaults to the referred encounter even if a newer source visit exists. It
offers an entry/discharge visit selector and four document choices: medical
record, OPD form, referral letter and nursing chart. Inapplicable OPD/IPD choices
and missing historic referral letters are explained explicitly. Long-term recorded
problems/allergies accompany the visit review, following the source identity-based
clinical-summary policy rather than inventing historic clinical assessments.

New deliveries include a read-only visit snapshot; old deliveries can request
the referred patient's history through the authenticated pairing. The source
authorizes the referred encounter through existing referral policy, then matches
visits by nonblank normalized Health ID (or only that encounter for a blank ID),
consistent with the existing source patient-history workflow. An unknown transfer
ID cannot request a different patient. Other identities are excluded. Signed
history requests/replies retain nonce, timestamp, HMAC, timeout and loopback checks.
Clinical history is bounded to 8 MiB; excessive payloads fail without truncation.

History sharing is audited on both ends. Registration/clinical/nursing fields and
selected clinical system records are shared; photos, secret-like fields, hospital
accounts, financial ledgers and uploads are excluded. This is not a database copy.
The original signed delivered letter remains immutable even if newer visits exist.
If the source is offline, available delivered visits are shown with an explicit
offline notice. Old transfers without a delivered history snapshot cannot invent
unavailable records while offline.

The viewer restores saved field keys into a detached original form template and
converts controls to static text. Nursing editable-cell initialization and frozen
scope/legacy keys are respected. Saved nursing entries, medication and monitoring
data are also shown as read-only supplemental values; no new clinical thresholds
or calculations run. Scripts, handlers, active links, forms and embedded frames
are removed. The resulting iframe allows same-origin inspection but no scripts,
forms or navigation; its own CSP blocks network/script execution. Only /referrals
receives the review CSP allowing its inline document styling and same-origin
embedding. Parent inline scripts remain forbidden; other pages keep their CSP.

Accept remains available to all authenticated receiving staff. Reject is limited
server-side to DOCTOR, CHIEF_WARD, ADMIN, DIRECTOR and VICE_DIRECTOR. It requires a
nonblank bounded reason, records the first rejecting actor/time, and synchronizes
the reason and rejected state to the sender. Nurses, midwives, registration,
technical and finance roles cannot reject. Duplicate decisions are idempotent;
accepted and rejected states cannot be changed into each other. Receipt/rejection
does not automatically admit, discharge, charge or overwrite a local patient.

## Backups and installation

Primary clean code snapshot:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.4.0-f6ecd808-13b341b5
Commit f6ecd80872a45d08b64b6e9dcb71be46b2d856a7.

Receiving copy code-only archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-sidebar-20261028
Its manifest records the independent 49.3.0 baseline and SHA256.

Consistent online pre-activation safety backups:
C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v495-visits-1793199954092.sqlite
D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v495-visits-1793199954494.sqlite
These runtime backups and the external pairing key are excluded from Git/delivery.

Both verified Wi-Fi listeners were restarted with their existing roots and ports.
Primary http://127.0.0.1:3001 now shows 49.5; receiver http://localhost:3002 shows
49.4. Both health checks pass. Anonymous history/template reads return 401.
A signed live history probe for an unknown transfer returned 404 without reading
or sending a patient. Existing private settings, launcher files and key remain.

After activation, complete patient-row hashes and account/role identity hashes
match their before snapshots. Ward/imaging assignments and existing referral
payloads/status/acceptance timestamps also match the safety backups. Both database
integrity checks are OK. Counts remain 22 primary patients and 0 receiving local
patient records. No synthetic patient or referral was inserted into live data.
Only additive rejection metadata columns were introduced.

## Validation

Disposable code-only workspace:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-1PSUEt
All scenario registration, history, chart, acceptance and rejection fixtures use
in-memory synthetic databases; hospital data/configuration are not copied there.

- Full npm suite: 1,075/1,075 passed (referral-visits-full-final.log).
- Khmer passed (referral-visits-khmer-final.log and final source check). Exact
  reviewed labels have additive approval and CSV provenance; baseline unchanged.
- API checks include history identity isolation, dated discharge selection,
  authenticated/unknown-ID gates, offline snapshots, source preservation,
  rejection role matrix, required reason, CSRF, idempotency, decision locks and
  source rejected-state/reason synchronization.
- Browser checks passed: receiver-only sidebar/no floating button, active state,
  desktop/mobile table, source send, multiple dated visits, actual rendered historical
  medical and nursing values, OPD and referral views, nurse rejection exclusion,
  doctor reason dialog, acceptance and rejection.
- The final viewer review added structured nursing entries and a malicious-text
  fixture; the affected browser regression passed again
  (referral-visits-review-browser.log), proving data cannot execute scripts.
- The final default-visit browser regression adds a newer visit and confirms
  the original referred encounter remains selected (referral-visits-default-browser.log).
- Desktop table and rendered medical/nursing/mobile screenshots were reviewed in
  .validation-referral-transfer. No new printer/PDF acceptance is claimed.
- Early checks exposed stale cache-version assertions and preview CSP blocking;
  these were corrected before the passing final results. Load-order assertions
  still verify the navigation map precedes the shell.

## Use and recovery

Refresh both browser tabs with Ctrl+F5. In the receiving EMR, open the new sidebar
entry, select View, then choose the visit and document. Authorized users may accept
or reject; rejection asks for a reason and the sending EMR updates its status.

Combined artifact: Borkeo-EMR-v49.5.0-referred-patient-list-update.txt.
Apply only to the matching baseline and preserve later unrelated customizations.
The receiving copy retains its own version/configuration; existing customized
tests receive only the relevant cache-version adjustments. Restore code archives
into a NEW folder, never over live data, uploads, backups, .env or pairing secrets.
