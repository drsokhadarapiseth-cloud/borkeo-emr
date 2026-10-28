# Connection table and ADMIN approval - v49.8.0

Owner approved updating both EMRs with five connection-table columns and a
request/accept/reject flow. Later clarifications: the provincial hospital shares
its own API identity with Borkeo; both can search and transfer under the approved
permissions. Original remote records are read-only. Registration/admission starts
a separate local encounter. Case type depends on this hospital's own visits:
no local Patient ID match means New Case; an existing local Patient ID means Old
Case. A source-hospital visit alone never makes a patient an Old Case here.

## Baselines and preservation

Primary baseline: master 3b94d8eaed6fdf9b6936718fbef74845712f319f, version 49.7.0.
Clean code backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.7.0-3b94d8ea-8300fb6d.
Receiver baseline 49.6.0 code backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-connections-20261029.
The receiver advances independently to 49.7.0; primary advances to 49.8.0.

Consistent pre-activation SQLite online backups:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v498-connections-1793230714170.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v498-connections-1793230714538.sqlite

Existing keys, grants, clinical records, finance, uploads, environment settings
and the legacy private link file are preserved. New requests have a separate
metadata table. This update does not automatically import, admit or overwrite a
patient, nor does it add a remote write API. Normal local registration, triage,
cashier, admission, ward and discharge permissions remain in force. Staff must
verify identity during registration; the search case-type hint uses Patient ID.

## Use

1. Refresh both browser tabs with Ctrl+F5. Open the connected-facilities sidebar
   page `/connected-emrs`. Its table lists number, facility, masked API key,
   checked connection status/time and the connection-request action. ADMIN has
   additional edit/test controls on `/admin/emr-connections`.
2. For a new hospital, each ADMIN copies their installation's API identity and
   enters the other hospital's identity and loopback address in their peer form.
   Enable the local API and that peer. Keep incoming/outgoing off until approval
   and choose whether patient search and doctor messaging may be shared.
3. Click Request Connection. The receiving ADMIN sees the incoming request and
   accepts or rejects it. Acceptance enables incoming/outgoing on the receiver;
   the requester's next signed status check applies the confirmed approval.
   Search and messaging permissions are preserved separately. Existing mutually
   approved connections stay connected without new requests.
4. Green means the current signed check confirmed both identities and both
   directions' connection permissions. Red means disconnected. Checks refresh
   every 30 seconds on visible pages, when returning to the page, or immediately
   with the refresh button. Three parallel probes bound work for many peers.
5. Search results show the receiving hospital's New Case/Old Case classification.
   Viewing records or accepting a referral does not create a local visit. Use
   the normal local registration/admission flow for the separate local medical
   record. The source hospital's visit and notes remain read-only.

Only an active ADMIN context may send or decide connection requests. Other
eligible staff see the table/status and permitted patient workflows, with no
request/decision controls. Both installations must first trust each other's
verification identity; unknown hospitals cannot self-enrol. Disabled API/peer,
changed settings or rotated identity invalidate pending approvals rather than
silently reopening access. Rejection is terminal for that request. A fresh
request supersedes an older pending one for the same peer. Requests contain no
patient information. Signed identity preflight, nonce/expiry/response checks,
CSRF, masked keys and private Ed25519 seeds remain in force. Audits record request
IDs, peer IDs and decisions, not keys or patient payloads.

## Validation

Disposable synthetic copy:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-d4qND7.
Full suite: 1,079 tests; see connection-tests.log. Khmer:
connection-khmer.log. Browser: connection-browser.log and
.validation-connections/ (desktop/mobile connected/disconnected tables,
incoming decisions, masked keys and staff restrictions). The existing network
search, read-only record and private-message browser workflow also runs.

Focused tests cover CSRF/ADMIN boundaries, request retries, two-sided approval,
preserved service scopes, rejection, stale/revoked approvals, a disable during
an in-flight identity check, cross-peer request isolation and no patient writes.
Search tests prove that prior local visits show Old Case and a source-only
patient shows New Case. Existing clinical/new-visit/admission tests remain part
of the full regression suite. Synthetic browser screenshots are reviewed;
no physical-printer acceptance is claimed.

Activation evidence and final listener IDs are recorded in AI_HANDOFF.md.
Deliverable: Borkeo-EMR-v49.8.0-connection-table-update.txt, with complete changed
files and SHA256 payload manifest. Recovery extracts code into a NEW folder and
never overwrites live databases, uploads, signing keys or secrets.
