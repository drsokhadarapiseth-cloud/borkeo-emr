# Stage 2: multiple EMR API connections - v49.7.0

Approved scope: both treatment cleanup and multi-EMR connection, messaging and
search, implemented in stages. Stage 1 is published as caa15cf6b7b69412536b7d054378b326328a2350
(49.6.0); this is the stage 2 baseline. Primary baseline backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.6.0-caa15cf6-ba188c24.
Receiving installation code backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-network-20261028 (49.5.0).

## Administration and daily use

1. Sign in with the ADMIN context and open the API connections sidebar item,
   `/admin/emr-connections`. Set the facility name and enable its API.
2. Copy its key using the explicit copy button. Keys have the format
   `EMR1:<instance UUID>:<64 hexadecimal characters>`. This document contains no
   usable key. Paste each facility's key into the other facility's connection
   form and enter the other EMR's loopback address. Multiple peers are supported.
3. Enable that connection and choose incoming, outgoing, patient-search and
   doctor-message permissions. Save and test the connection on both sides.
   Both facilities must approve the relationship. A successful identity test can
   still report that incoming requests are not approved.
4. Doctors open a patient referral, choose the receiving facility when there are
   multiple choices, complete and sign the letter, then send. The receiving
   sidebar's transferred-patient list retains its accept/reject workflow and
   dated visit/document review. An already-created transfer cannot change peer.
5. Eligible clinical staff open `/connected-emrs` to search an approved peer and
   review dated OPD, medical, nursing and referral documents. Doctors can choose
   a remote doctor and send a message; each doctor sees only their own messages.
6. Disable the whole API or a specific connection/permission using its checkbox
   and Save. Rotating a local key invalidates its peers' stored copy; update that
   facility's key in each peer before resuming. Existing received referrals and
   messages remain available locally when connectivity is disabled.

Primary and receiver are configured for reciprocal access at
http://127.0.0.1:3001 and http://localhost:3002. Keep these separate hostnames to
avoid sharing browser session cookies. The primary advances to 49.7.0 and the
independent receiving installation to 49.6.0. Refresh both tabs with Ctrl+F5.

## Boundaries and safeguards

- This release supports installations on this computer only: HTTP loopback with
  an explicit port. It does not enable Internet/LAN federation or claim TLS.
- Each installation has an independent Ed25519 signing seed that never leaves
  its database. The copied API token contains the instance ID and public
  verification key, not the private signing seed. Requests bind both instance
  IDs; responses bind the original nonce. Knowing other facilities' public
  pairing tokens cannot impersonate their private signatures. Existing
  direction-specific MAC and timestamp/nonce checks also reject tampering,
  expiry and replay. Rotating generates a new signing identity for the same ID.
- A signed identity/permission preflight precedes every data-bearing request.
  Redirects are refused; timeouts and request/response limits bound transport.
- Local and remote enabled flags, reciprocal incoming/outgoing approval and
  operation permissions are enforced server-side. Browser menus alone are not
  authorization. Once managed mode is selected, the legacy shared-key endpoint
  stays unavailable, including when the new API is disabled.
- Keys are masked in settings lists. Only an authenticated ADMIN can explicitly
  copy or rotate a key; mutations require CSRF tokens and settings use revisions.
  Private seeds are stored in runtime SQLite, never source control, copy-key
  responses or browser storage. This is not encryption at rest; protect runtime
  database/backups. Previously exchanged bootstrap secrets are not used for
  private signing; migration creates fresh, unshared signing seeds.
- Transfers, history requests and messages are bound to a particular peer.
  Idempotent retries preserve the original payload, recipient and terminal state.
  Unbound old transfers use their saved snapshot rather than an arbitrary peer.
- Remote source records always remain read-only. Acceptance records a decision;
  it does not automatically admit, import or overwrite a local patient. Local
  admitted encounters remain subject to existing clinical/ward/discharge rules.
  There is no remote patient-write RPC.
- Search is restricted to clinical/management/registration/triage roles, requires
  three characters, escapes SQL wildcard characters and returns 25 summaries per
  API page. Dated history is fetched explicitly; unrelated identities, photos,
  credentials and financial ledgers are excluded from clinical history sharing.
- Doctor messaging is restricted to active DOCTOR/CHIEF_WARD users. Source staff
  identity is asserted by the trusted sending EMR, not an individual certificate.
  Recipient validation, user-specific inboxes, size limits and escaped text apply.
- Review iframes are script-disabled, records and messages are escaped, and no
  patient writes are exposed by the review UI. Audit events record operations
  and identifiers, not keys, message bodies or search terms.

## Validation and activation evidence

Disposable synthetic root:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-p8ELKC.
`npm test`: 1,078/1,078 passed (`network-tests.log`). Khmer passed
(`network-khmer.log`). Three-EMR tests cover separate keys, multiple peers,
reciprocal delivery, cross-peer isolation, disabled controls, rotation, missing
CSRF/roles, private message retries, read-only histories and unchanged records.
An explicit third-peer impersonation attempt fails even with a valid public-key
MAC; a genuine private signature succeeds and its replay is rejected.
The wrong-destination test confirms no clinical query is sent before a signed
identity succeeds. Existing replay/expiry/unsigned-response tests also pass.

Browser evidence: `network-browser-elevated.log`, `network-transfer-browser.log`,
`network-signed-browser.log`, `.validation-emr-network/` and
`.validation-referral-transfer/`. Desktop/mobile
settings, search, dated static medical views, private messages and the signed
referral/accept/reject workflow were exercised with synthetic data. Screenshots
were reviewed. No live patient was created for testing; no printer claim is made.

Before activation, SQLite online backups were created:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v497-network-1793205330857.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v497-network-1793205331157.sqlite

Activation preservation results and listener checks are recorded in the handoff.
The bootstrap script is for the two explicitly named local installation roots;
it verifies distinct databases, preserves other connections by refusing to
replace them, and binds legacy transfers only after validating the old pair.
Do not distribute runtime SQLite files, private keys, `.env`, uploads or backups.
Code recovery always extracts the baseline archive into a NEW folder.

Delivery artifact: Borkeo-EMR-v49.7.0-multi-emr-network-update.txt. It contains
the complete changed code files and a normalized UTF-8 SHA256 manifest.
