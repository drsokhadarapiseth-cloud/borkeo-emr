# Submitted patient search, QR scanning and separate results - v50.4.0

Owner approved the last discussed search layout: main Patient ID input submitted
with Enter/Search, QR icon, fingerprint icon and card/advanced-search icon.
Advanced search opens a separate form for name, phone, Patient ID or other ID.
There is no hospital chooser. Each submitted search checks local identities and
all approved search-enabled peers, with at most three concurrent peer lookups.
Typing or focusing the main input sends no patient-search request.

Results open in a separate native dialog, identify the source hospital, patient
ID, name and visit date, and offer View and authorized Admit actions. Results
append as sources reply; empty results are shown only after searches finish.
Unavailable sources remain explicit errors. Closing the dialog cancels browser
requests and invalidates late responses. Native dialogs provide focus containment,
Escape/Close behavior and responsive desktop/mobile layouts. The mobile header
uses a second row to keep the input and all three icons visible.

Admit starts the existing normal local registration/admission workflow, including
New/Old Case classification; it does not immediately admit a patient or import
source medical notes. View retains existing local permissions and dated styled
read-only remote record review. Registration/admission role checks remain intact.

New submitted API searches use CSRF-protected POST with search terms in the body.
Patient ID, phone and other-ID modes use normalized exact matching; name mode
uses a normalized prefix. Normalization retains the existing Khmer-digit/case/
space/dash rules, without claiming country-code conversion or fuzzy matching.
Legacy GET/partial API search remains for cached clients. Submitted remote search
requires a signed exactSearch capability, so an older peer cannot silently return
broader matches. Result limits and source identity protections remain unchanged.

No search-index migration is included. A proposed custom-function expression
index failed compatibility checks with existing maintenance tools and was removed
before installation. This release is not a million-patient/30-server load-test
or remote-HTTPS deployment. Current network origins remain localhost-only.

## QR and fingerprint safety

The QR button explicitly requests video only, using the rear camera when
available. The locally bundled jsQR 1.4.0 decoder processes bounded canvas frames;
frames are not uploaded, recorded or persisted. A successful plain patient-card
Health ID scan stops the camera, submits exactly one ID search and opens results.
URLs, executable markup and malformed/oversized QR payloads are not navigation
instructions. An invalid QR opens a Khmer error without a patient query.
No scan automatically registers or admits anyone.

Streams/timers stop after detection, on Close/Escape, page hiding or navigation.
If a permission request resolves after closure, its returned tracks are stopped.
Permission denial, absent camera or insecure context produces Khmer feedback.
Camera permission is self-only on authenticated protected HTML pages that host
the search controls. Login/API/print-preview keep camera disabled; microphone,
USB and geolocation remain disabled. Existing script/style CSP settings are
preserved; camera-enabled pages add only the required media source policy.

Phone camera access requires HTTPS and browser permission. Current HTTP LAN
launchers are not converted to HTTPS by this release; localhost is suitable for
desktop testing. Actual S22 Ultra camera/browser hardware acceptance remains to
be checked on an approved HTTPS deployment. The fingerprint button explains the
existing unavailable scanner/SDK state; no biometric enrollment is added.

jsQR source/license/integrity and canonical SHA-256 are recorded in
public/vendor/jsQR-NOTICE.txt and jsQR-LICENSE.txt. The pinned registry archive's
SHA-512 was verified before extraction. Only line endings are normalized to LF;
the decoder uses no external runtime service. Apache-2.0 text is redistributed.

## Baseline and preservation

Primary clean baseline 50.3.0, commit
4337ce770697f4205a1f17b02221b99f3fa0ccb5. Code-only backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.3.0-4337ce77-4538c0d4.
Receiver baseline 50.2.0 code archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-search-popup-20261029.
Online SQLite backups:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v504-popup-1793261460376.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v504-popup-1793261460700.sqlite

Final disposable synthetic root: borkeo-restored-code-fjeWy3. Earlier disposable
9GtwCr held the rejected index experiment; it is not an installation source.
Validation also identified an existing SQLite startup lock race: busy_timeout
was applied after journal_mode. It now precedes that operation with the same
5000 ms timeout and all other database settings unchanged. A real child-process
exclusive-lock regression test verifies startup waits and then succeeds.

Browser evidence in .validation-search-popup, .validation-network-registration
and .validation-emr-network covers no typing requests, POST search body, native
results and advanced dialogs, new/old registration/save/card, remote history,
private nurse attachments and mobile controls. QR checks feed actual generated
patient-card pixels through the bundled decoder using a synthetic video stream;
they cover automatic results, no auto-admission, link rejection, camera close/
detection cleanup and permission denial. No real camera or patient data is used.
Ten reviewed Khmer strings have approvals/translation provenance; the Khmer
baseline and .gitignore remain unchanged.

Delivery: Borkeo-EMR-v50.4.0-search-popup-qr-update.txt. Complete UTF-8/LF JSON
file payloads include byte counts and SHA-256; no secrets, live databases, uploads
or password exports. Restore code into a new folder. Receiver keeps independent
version progression, 50.2.0 to 50.3.0.

Final results: all 1,085 npm tests and Khmer check pass. All three final browser
workflows pass: submitted popup/real QR decoding, New/Old local registration and
styled remote history/private nurse messaging. The standalone lock regression
passes. Existing global button padding initially collapsed the new icons; scoped
padding/flex rules and explicit SVG view boxes corrected this before installation.

Installed primary 50.4.0 PID 17632 at http://127.0.0.1:3001 and receiver 50.3.0
PID 16060 at http://localhost:3002, using original hidden start-wifi launchers.
Both health endpoints, login versions, decoder and styles pass; unauthenticated
submitted search returns 401. All 98 pre-existing non-audit/non-nonce tables
compare equivalent to online backups, including exact patient rows, workflow
snapshots, attachments and API keys/grants. Existing startup metadata/Superuser
rehash/session timestamp normalization and append-only access events are allowed.
Patients remain 22 and 0; integrity OK. Neither database contains the rejected
emr_search index migration. No pairing, clinical import, live synthetic patient,
real-camera recording or automatic admission occurred.
