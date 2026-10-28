# Provincial referral between the two local EMRs - v49.4.0

Owner approved with "yes" after confirming localhost:3002 as the receiving EMR.
Primary baseline: master e6142a63bc9c300960691ca8bf092d31c14eaa8b, 49.3.0.
Primary release: 49.4.0. Separate receiving copy: 49.2.0 -> 49.3.0.

## Workflow

The OPD ward-transfer control is replaced on screen by
**បញ្ជូនទៅមន្ទីរពេទ្យបង្អែកខេត្ត**. Its original internal control and stored keys
remain hidden and intact to preserve existing records and internal admission logic.
The same referral entry remains available to authorized inpatient doctors.

The referral popup has a single scrollable responsive workspace and a compact
toolbar. The signature pad opens only when the referral signature area is tapped
or activated by keyboard. Stored and drawn signatures remain supported. The
separate print document retains its official single A4 page.

**បញ្ជូន** saves the signed referral revision and sends its immutable snapshot,
patient name/ID, sex, age/date of birth, phone, department and service mode to the
second EMR. Available address, observations and other referral information are
contained in the signed form. This is not an export of every chart attachment,
account, financial record or local hospital database.

The sender shows pending receipt and later accepted status, polling every ten
seconds while the popup is open. The receiving EMR exposes **បញ្ជីបញ្ជូនចូល**
and /referrals to authenticated staff, who may inspect the letter and accept it.
Acceptance is attributed and audited. Per the previously recorded owner policy,
every authenticated staff role with an active context may accept. No rejection
permission or workflow was introduced. Acceptance acknowledges the incoming
referral; it does not automatically create an admission, clinical encounter,
invoice, discharge or overwrite a matching local patient.

## Connection and safeguards

Only the approved local pair is configured: sender http://127.0.0.1:3001 and
receiver http://localhost:3002. The setup script creates a random shared key in
C:\Users\Local-admin\Borkeo_EMR_Referral_Link\link.json outside both projects.
The key is never printed, placed in an update artifact, returned to browsers or
committed. Existing pairing files are validated and preserved without replacement.
No .env or .gitignore change is required. This local pairing is separate from NPCA.

Server-to-server requests have timestamped HMAC authentication, unique replay
nonces and signed replies tied to the request nonce. Configured peers must be
loopback HTTP origins; redirects are disabled and timeouts are bounded. Browser
send/accept operations retain session and CSRF enforcement. Sender authorization
uses existing doctor/ward/payment/discharge/referral-signing rules.

Additive tables store immutable outbox snapshots, incoming referrals and replay
nonces. Retries reuse the same transfer ID and snapshot, including lost replies.
A different payload with the same ID is rejected. A subsequent revision cannot
silently create a second referral for the same encounter. Acceptance is idempotent
and preserves its first timestamp and accepting staff identity. Offline errors
never display a false acceptance. Patient and clinical tables are not rewritten.

## Backups and installation

Primary code baseline backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.3.0-e6142a63-6e8e3d56
Commit e6142a63bc9c300960691ca8bf092d31c14eaa8b.

Separate copy code-only baseline archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-referral-20261028
Its manifest records the actual source file list, 49.2.0 and archive SHA256.

Consistent pre-activation online database safety backups:
C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v494-referral-1793185398875.sqlite
D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v494-referral-1793185399219.sqlite
These runtime backups are kept out of the code delivery and Git.

Scoped source installation preserves each copy's own launcher, instance-data,
private configuration and independent version. Existing separate-copy browser
test customizations are preserved; the two new transfer regressions are additive.
Only the verified Wi-Fi listeners on ports 3001 and 3002 were restarted. The
servers now show 49.4 and 49.3 respectively. Both health checks pass; anonymous
capability/inbox requests return 401. A live signed probe for a nonexistent
transfer returned 404, verifying the pairing without transferring a patient.

After restart, complete patient-row hashes, account identity/role hashes and
user-role membership hashes match their pre-activation snapshots. Primary has
22 patients and the receiving copy has 0; integrity checks are OK in both.
No synthetic patient was inserted into either installed runtime database.

## Synthetic validation

Disposable code-only root:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-fTC9oL
All registration, payment, transfer and acceptance tests use in-memory synthetic
databases. Hospital databases, uploads, .env and password exports are excluded.

- Full suite: 1,074/1,074 passed (referral-full-final.log).
- Khmer check passed; twenty exact reviewed translation pairs were appended with
  CSV provenance. Baseline and existing approvals remain intact.
- API coverage: unpaid/wrong-role/stale-revision refusal, offline retry, stable
  transfer IDs, duplicate delivery, anonymous/forged/replayed/expired requests,
  CSRF, unsigned replies, external peer refusal, audited idempotent acceptance,
  accepted-state synchronization and source/receiving patient preservation.
- Two browser regressions passed (referral-browser-final.log): clean popup at
  1440/390 widths, hidden signature pad, tap-to-sign, stored signature, send,
  receiving staff review/acceptance, source acceptance and zero JS errors; plus
  drawn signature, closed-record reprint, IPD signing and a single populated A4 PDF.
- After the final queue error-display review, the affected transfer browser test
  passed again (referral-browser-after-review.log).
- Screenshots and PDF are in .validation-referral-transfer and
  .validation-referral-evidence. Popup/mobile/signature screenshots were reviewed.
  Browser PDF verification is not physical-printer acceptance.

The first full run found a missing responsive stylesheet on the new page and a
missing approval for the destination label. Both were resolved before the final
passing suite. The existing A4 print regression now opens/closes the signature
pad explicitly, matching the requested interaction.

## Use and recovery

1. Refresh the sending EMR tab with Ctrl+F5, open a patient and select
   **បញ្ជូនទៅមន្ទីរពេទ្យបង្អែកខេត្ត**.
2. Review the form, tap its signature area, sign and select **រួចរាល់**.
3. Select **បញ្ជូន**. In the second EMR, open **បញ្ជីបញ្ជូនចូល**, review and
   select **ទទួលអ្នកជំងឺ**. The sender updates to accepted.

Combined code artifact: Borkeo-EMR-v49.4.0-provincial-referral-update.txt.
Apply only to the matching baseline while preserving newer customizations.
On the receiving copy retain its independent version and private launcher files.
For recovery, extract code backups into a NEW folder. Never restore a synthetic
database over runtime data or replace private settings with code payloads.
