# API copy icon and owner-controlled connection - v49.9.0

Owner requested that the Borkeo/provincial link first be disconnected, that the
owner perform the request/approval manually, and that the API display have a
copy icon. The copy action must transfer every character rather than the masked
hint shown on screen. This update adds the existing shared SVG copy symbol next
to the local installation's masked API identity, with its Khmer text label.
The existing explicit ADMIN clipboard handler is preserved.

The copied value is exactly `EMR1:<36-character UUID>:<64-character public key>`:
106 ASCII characters. The private Ed25519 signing seed never leaves the EMR.
Pasting the copied text into a plain-text message exposes the complete public
connection identity to the recipient; the masked UI hint is not the copied value.
The recipient should copy the entire value without extra text or inserted spaces.
Do not send or request the private signing seed or a database file.

## Manual workflow for the two existing installations

1. Provincial ADMIN opens `/admin/emr-connections` and clicks the copy icon
   beside the local key. Send the copied full text and EMR address to Borkeo.
2. Borkeo ADMIN edits the existing provincial connection row, pastes that full
   key into its API field and saves. Then click Request Connection.
3. Provincial ADMIN reviews and accepts or rejects the incoming request.
   Only that explicit approval can reopen sharing. Existing keys are retained;
   this release does not recreate or automatically approve the pair.
4. To disconnect manually, ADMIN edits the connection, clears incoming and
   outgoing permissions and saves; disabling the peer also blocks all requests.
   Keeping the API/peer enabled with sharing permissions off allows a later
   manual connection request. Remote patient-write access is never enabled.

The two installed identities were already configured in the previous release.
A new installation still requires both ADMINs to configure the other's public
identity before a signed connection request can be verified. This release adds
no unauthenticated/self-enrolling hospital endpoint.

## Baseline, backups and disconnection

Primary baseline master 8d4df4e4cfb68bdd4ab314f1d4f27ab615cfecb6, 49.8.0.
Clean code backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.8.0-8d4df4e4-4942e03c.
Receiver baseline code archive (49.7.0):
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-api-copy-20261029.
Primary advances to 49.9.0; independent receiver advances to 49.8.0.

On the owner's explicit instruction, both exact peer entries had incoming and
outgoing grants set to zero, revisions incremented, and pending requests marked
stale so background polling cannot reapply an old approval. Patients and signing
keys were verified unchanged. Backups before that configuration change:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-manual-disconnect-1793231681283.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-manual-disconnect-1793231681397.sqlite

Consistent backups of the disconnected state before code installation:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v499-copy-1793231807412.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v499-copy-1793231807615.sqlite

## Validation

Disposable synthetic root:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-R0fC5w.
All 1,079 tests and Khmer validation pass (copy-tests.log, copy-khmer.log).
The existing network browser workflow passes (copy-browser.log), including an
assertion that the icon is beside the masked key and the clipboard API receives
the complete 106-character API identity and no private seed. The synthetic
clipboard does not modify the user's desktop clipboard. Desktop/mobile
screenshots under .validation-emr-network were reviewed. No live patient was
created for validation; no physical-printer claim is made.

Activation and final disconnected-state preservation results are recorded in
AI_HANDOFF.md. Runtime databases, uploads, keys, .env, .gitignore and unrelated
editor files are excluded from the update. Recovery extracts code into a new
folder and never overwrites live data. Delivery:
Borkeo-EMR-v49.9.0-api-copy-update.txt.
