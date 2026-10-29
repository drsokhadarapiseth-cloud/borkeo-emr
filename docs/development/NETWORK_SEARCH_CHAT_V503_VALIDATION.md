# Typed global search and private staff network - v50.3.0

Approved scope: remove the topbar hospital selector; automatically search the
local hospital and every enabled outgoing peer with search permission. Patient
ID is the default search type. Name, phone, other identity number and fingerprint
are separate choices. The sidebar/page name is Health facility network in Khmer.
The network page separates connection/status controls from staff/ward directory
and private messaging. Doctors, ward chiefs, nurses and midwives can send messages
and bounded files to eligible active staff at a mutually approved hospital.

## Patient search and registration

Patient ID matches Health ID, visit/case number and internal identifiers. Other
ID matches the existing registration other-card-number field, including National
ID, without exposing that number or clinical notes in result summaries. Name and
phone searches stay in their selected fields. Khmer digits, case and dash/space
normalization and literal SQL wildcard escaping apply to both local/API paths.
At least three normalized characters are required; each source contributes up
to 15 visible matches. Refine the query for additional matches. Three peers are
queried concurrently at most; stale results cannot overwrite a later search.
The selected type is reflected in the search input's placeholder.

Local identity lookup preserves the existing patient-directory role access;
record opening still uses existing ward/encounter permissions. API search still
requires REVIEW_ROLES and bilateral search grants. Typed queries require the
peer's signed typedSearch capability, preventing older peers from silently
performing unrestricted all-field matching. Existing untyped API callers retain
legacy matching. Remote results still offer View and role-restricted Register
at this hospital. Normal local New/Old registration/admission, original medical
record styles and source read-only history remain unchanged.

## Directory and private attachments

The directory lists up to 500 active chat-eligible healthcare staff and their
roles/assigned ward names, including custom wards. Registration/management users
may view the directory through the existing network page but do not gain chat
permissions. Existing API path /doctors remains for compatibility and now carries
the eligible staff directory. No passwords, signatures or API private seeds are
returned. Hospital messaging permission is required on both ends.

Up to three files, 512 KiB each and 1 MiB total, are accepted per message. PNG,
JPEG and PDF extensions/MIME/signatures must agree. Names cannot contain path or
control characters; malformed/noncanonical base64 is rejected. Files are stored
as BLOBs in a new indexed emr_network_attachments table, atomically with the
message, and transferred inside the existing signed/replay-protected protocol.
No public upload directory or raw path is used. This validates file format;
it is not a malware-scanning service.

List responses return metadata only. Downloads require an active authenticated
chat role, the original local sender/recipient, and an enabled matching peer,
direction and messaging grant. Management and other clinical accounts cannot
download another user's attachment. Responses force attachment/octet-stream,
no-store, nosniff and a restrictive CSP. Audit events record attachment IDs only.
Retries preserve message IDs/content/attachment hashes and do not duplicate rows;
changed retry payloads or reuse by a different sender fail. Revocation blocks
future delivery/download. No clinical record write permission is granted by chat.

The frontend uses a Khmer file chooser, escaped user/file/message text, bounded
staff table scrolling and mobile/desktop layouts. Sender and recipient can use
the hospital staff selector to write privately; messages remain in their own
private inbox. Existing doctor messages and pending retries remain compatible.

## Fingerprint boundary

No scanner/model/SDK was supplied. Fingerprint search therefore explicitly shows
device-not-configured and makes no biometric query. Registration contains a
disabled enrollment area with that same explanation; no image is falsely treated
as a fingerprint template. No biometric data is collected, stored or transmitted.
Actual enrollment, cross-ward attachment and cross-hospital matching remain
pending a compatible scanner/SDK and matching protocol. This release does not
claim working fingerprint enrollment or matching.

## Baseline, backups and validation

Primary baseline 50.2.0 commit 04c09a43b6ffdaa65e93f267c2c4c4dfee5d9ae4.
Clean code-only backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.2.0-04c09a43-da8f11d3.
Receiver baseline 50.1.0 code-only backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-network-search-chat-20261029.
Receiver source compared equal to primary baseline after version normalization.
Online SQLite backups:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v503-network-1793254173526.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v503-network-1793254173834.sqlite

Disposable synthetic root: borkeo-restored-code-ChkFe1. All 1,082 tests pass and
Khmer validation passes. Eleven reviewed Khmer strings have explicit approvals
and translation provenance; the baseline and .gitignore remain unchanged.
New API tests cover typed field isolation/local+remote matching, wildcard
escaping, nurse directory/wards, source preservation, private nurse attachments,
unauthorized/unauthenticated reads, file spoofing/path/size limits, exact retries,
ID reuse conflicts and revoked grants. Existing three-EMR isolation/rotation and
referral tests also pass with the approved nurse role changes.

Edge workflows pass for name/phone/other-ID search, default ID, no hospital
selector, unavailable fingerprint state, normal New/Old registration/save/card,
styled dated read-only history, nurse recipient directory, doctor-to-nurse file
delivery/download, escaped script text, private inbox and mobile layouts.
Screenshots in .validation-network-registration and .validation-emr-network were
reviewed; fixtures are synthetic and external requests were blocked.

Delivery: Borkeo-EMR-v50.3.0-network-search-chat-update.txt, complete UTF-8/LF
file payloads with byte counts and SHA-256. No patient data, .env, backups,
uploads, signing keys or password exports are included. Restore archived code
only into a new folder. Receiver advances independently to 50.2.0.

Installed primary 50.3.0 PID 3860 at http://127.0.0.1:3001 and receiver 50.2.0
PID 29752 at http://localhost:3002 with original hidden start-wifi launchers.
Health endpoints, login versions and network-label module serving pass on both;
unauthenticated attachment requests return 401. All 97 pre-existing non-audit/
non-nonce tables compare equivalent to online backups, including exact patient
rows, workflow snapshots, API keys and grants. Only existing startup metadata,
Superuser rehash/session timestamps and append-only access events are normalized.
Patient counts remain 22 and 0; integrity OK, new attachment tables empty. No
automatic pairing, synthetic live message/registration or clinical import occurred.
