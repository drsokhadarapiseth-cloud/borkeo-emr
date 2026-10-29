# Global patient search and original-style records - v50.1.0

Approved scope: move connected-facility patient lookup into the top search bar,
offer View and local registration, preserve the medical form's styling during
read-only review, and bundle Khmer OS Siemreap and Muol fonts in both EMRs.

The standalone search panels are removed from patient-list and connected-emrs.
The top bar searches local patients plus approved search-enabled peers after a
350 ms pause. Remote requests require three normalized characters, run at most
three concurrently, and display up to 15 results per source. Refine the query
for additional matches. The facility selector can restrict a search to this
hospital or one peer. Search failures remain visible; stale replies cannot
replace a later query. Results label the facility and this hospital's New/Old
Case classification. Register appears only for authorized registration staff;
server-side authorization and the existing single-use registration draft still
apply. Remote history and medication orders are never copied into the new visit.

View opens a protected record-review page with dated visits and document choices
for IPD, OPD, nursing and referral letters. It embeds only local application CSS,
uses the source facility's validated theme, and retains original form classes,
field identifiers and disabled controls. Textareas expand to show saved text.
Scripts and event handlers are stripped; the iframe allows same-origin access
without scripts, forms, navigation or editing. This reconstructs saved clinical
data using the current original form template; it is not a historical screenshot
of an older software release. Other page CSP policies remain unchanged.

Unmodified KhmerOS Siemreap, Muol and Muol Light TrueType fonts are served locally,
including alias names used by existing templates. No operating-system font
installation, browser extension or internet connection is required. Source:
https://github.com/KhmerSoftwareInitiative/khmer-unicode-fonts/tree/740d47dd65360e2e614a57a8ca10e2ec31cf6f61/fonts/v5.0
Attribution, embedded copyright notices, LGPL texts and SHA-256 values are in
public/fonts/KhmerOS-NOTICE.txt. Modern browsers support these local TrueType
fonts; Edge and Firefox are tested here. Safari was not available on Windows.

Clean primary baseline: 50.0.0, commit
1603850a9fdbf9a404a79fe2661ddd7f910c0cdd. Code-only backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.0.0-1603850a-55f33805.
Receiver baseline 49.9.0 code-only backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-topbar-fonts-20261029.
Restore code into a new folder only; do not overwrite live databases or secrets.

Disposable synthetic validation root:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-Wm3FA4.
Evidence: .validation-network-registration, .validation-emr-network and
.validation-khmer-fonts. The browser checks exercise actual new/old registration,
normal save/card preview, source-record preservation, dated read-only records,
no active controls/scripts, local font loading, connection controls and messages.
Desktop/mobile screenshots are synthetic. Existing Khmer baseline is preserved;
six reviewed strings are explicitly approved and listed for translation.

Pre-install online SQLite backups:
- Primary: C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v501-topbar-1793245908429.sqlite
- Receiver: D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v501-topbar-1793245908868.sqlite

No automatic peer pairing, API key reset, real registration or clinical import
is part of installation. API-page redesign/NPCA proposals remain separate work.

Delivery: Borkeo-EMR-v50.1.0-topbar-record-fonts-update.txt. It contains a manifest
and complete changed files; TrueType files are base64 with decoded-byte hashes.
The receiver keeps its independent version progression, 49.9.0 to 50.0.0.

Final results: npm test passes 1,080/1,080; npm run check:khmer passes. Edge
registration, returning Old Case, record review and doctor messaging pass.
The iframe loads KhmerOS directly and contains no enabled controls or scripts.
Firefox reports all three font faces loaded. Mobile search stays within the
390 px viewport; the initial clipped dropdown was corrected before installation.
A concurrent disposable test run caused one SQLite lock; the isolated final
full-suite run passes. No hospital database was used for those tests.

Installed primary 50.1.0 PID 25460 at http://127.0.0.1:3001 and receiver 50.0.0
PID 19708 at http://localhost:3002 using original hidden start-wifi commands.
Both health endpoints, login versions, font MIME types and search modules pass;
unauthenticated record-review navigation returns 401. All 97 pre-existing
non-audit/non-nonce tables compare equivalent to online backups. Existing
record-access log entries remain exact, with append-only new access events
allowed. Only existing Superuser startup rehash, metadata timestamps and session
last-seen are normalized. Workflow snapshots, patient rows, API keys and grants
remain exact. Patients remain 22 and 0; both integrity checks are OK.
