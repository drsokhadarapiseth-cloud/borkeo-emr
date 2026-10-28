# Borkeo referral activation - v49.0.0

The owner approved coding the referral form for Borkeo_EMR_Git, including OPD
doctors and IPD doctors in every ward, on 28 October 2026. Automatic approval
review rejected merging/pushing master because it requires a separate explicit
production activation approval under the pasted instructions. The owner then
explicitly approved merging/pushing master and restarting the local Borkeo EMR.
Activation completed; master includes 0067c09e10574dd464528db96f424c7437435356.

Base master: 45bd18dc2b4fb383f27c487186370feaac5c6396 (48.8.0).
Includes the verified A4 referral feature 1ba52514a7caa2a89b7e69178f3c943eee437c2e.
Implementation branch: feature/referral-all-wards-activation.
Clean pre-activation code backup:
D:\EMR\Borkeo_EMR_Code_Backups\v48.8.0-45bd18dc-735d1e6c

## Behavior

The referral popup is included in the OPD and inpatient medical pages for active
DOCTOR and CHIEF_WARD users. Existing ward/encounter/payment restrictions remain.
The signed ANC doctor workflow also opens the same popup. Midwives retain their
existing maternal workflow; this update does not grant them doctor signing rights.
Management can review permitted saved referrals but cannot sign as a doctor.
Closed encounters can reprint an existing signed letter without reopening editing.

The popup prefills available demographics and observations, saves independent
immutable referral revisions and supports the current user's stored E-sign or
pointer drawing. Printing requires a signed revision and checks text and page
bounds before printing exactly one A4 portrait page. Referral editing does not
change the original clinical record. See REFERRAL_A4_V489_VALIDATION.md for details.

No cross-hospital electronic transfer is implemented or claimed in this release.
The Provincial receiving EMR and secure connection remain separate pending work.
All authenticated Provincial staff may accept incoming referrals per the owner's
latest answer; permission to reject is not specified. Printing a referral is not
confirmation of transmission.
No patient database, staff credentials, uploads or private settings are copied.

## Verification

Disposable source copy and synthetic fixtures only:
D:\EMR\Borkeo_EMR_Validation\v49.0-referral-activation-20261028

The API regression verifies DOCTOR and CHIEF_WARD can save and sign in each of the
ten configured inpatient wards: emergency, ICU, medicine, surgery, pediatric,
gynecology, obstetric, TB, infectious and NCU. Thirteen other roles are denied
signing in every ward. Existing unpaid, wrong-ward, closed-record, signature
ownership, CSRF and stale-revision cases remain covered.

The browser regression covers OPD entry, saved/drawn signatures, revision history,
readonly reprint, narrow viewport and a one-page populated A4 PDF. It additionally
opens the actual inpatient medical page as the surgery doctor, edits/signs through
the popup and checks the stored signer and new revision. Browser evidence does
not establish physical printer acceptance.

Results: npm test passed 1,066/1,066; npm run check:khmer passed; the OPD/IPD
browser workflow passed. Logs are tests.log and browser.log in the disposable
copy. The populated PDF has one A4 page. No hospital data was used for testing.

## Activation and rollback

Completed on 28 October 2026. A consistent SQLite backup was verified before
restart at C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v49-referral-2026-10-28T03-56-55-465Z.sqlite.
Only the verified Wi-Fi process on port 3001 was restarted from Borkeo_EMR_Git.
Health, served referral module and v49.0 login checks passed. The referral table
exists and database integrity is OK. All 22 patient records and 30 accounts remain;
patient rows, role/ward assignments and settings were compared against the backup.
Existing startup updates role timestamps and re-salts the unchanged Superuser
password; all other user rows and the actual Superuser password were verified
unchanged. Evidence: activation-baseline.json and activation-result.json in the
disposable validation folder (hashes/counts, no patient values or password hashes).

After all required checks pass, commit/push the feature. After explicit activation
approval, fast-forward master.
Back up the active database before restarting only the verified Borkeo listener
on port 3001 with the same Wi-Fi launcher and private configuration. Startup adds
the referral revision table without replacing patient records. Verify service
health, served module/version and unchanged patient/account content. Preserve
the separate v48.9.0 folder as delivered; it is not the Provincial simulation.

Rollback uses the code-only backup in a separate folder; keep the same hospital
data and the additive referral revisions. Never replace hospital data with the
synthetic validation database. The combined full-source update is
Borkeo-EMR-v49.0.0-all-ward-referral-update.txt.
