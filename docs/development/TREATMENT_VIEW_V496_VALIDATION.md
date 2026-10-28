# Stage 1: clean treatment review - v49.6.0

Owner approved both the treatment correction and the larger EMR API project in
stages. This release is the presentation-only treatment stage. Base master:
a3395f04c57b00be01c34936c43097fc7c5f22a4, 49.5.0.

Primary baseline code backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.5.0-a3395f04-1cf08b48
Receiving baseline code archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-treatment-20261028

Medication objects no longer render as generic nested metadata tables. The
read-only treatment view uses one row per medication with its recorded name/
strength, dose, unit, route, daily/protocol schedule, duration, quantity and notes.
Existing route definitions are reused. Missing details are explicitly marked;
recorded zeros and protocol intervals/repeats/stops remain visible. Row type and
irrelevant protocol defaults are hidden. No dose is calculated or inferred and
no source order or patient value is changed. Untrusted text is escaped.

The receiving copy advances independently from 49.4.0 to 49.5.0; primary is
49.6.0. Both verified Wi-Fi listeners were restarted with their original data and
configuration. Consistent pre-activation database backups and before/after
patient/account/role hashes are in the disposable validation evidence. Integrity
is OK; original 22 patients and receiving 0 local patient records remain intact.

Disposable synthetic validation root:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-YdrXoE
Full suite: 1,077/1,077 passed (treatment-tests.log). Khmer passed
(treatment-khmer.log). Real desktop/mobile transfer/dated-view browser workflow
passed (treatment-browser.log), including a real treatment row, preserved totals,
no exposed regularRow metadata, script isolation and existing decision controls.
The clean-ipd-treatment screenshot was visually reviewed. No printer acceptance
is claimed. Source .env, databases, uploads, keys and .gitignore are excluded.

Delivery: Borkeo-EMR-v49.6.0-clean-treatment-update.txt. Refresh both browser tabs
with Ctrl+F5. Code recovery must extract to a NEW folder and preserve live data.
The next approved stage is multi-peer API settings, reciprocal permissions,
doctor messaging and read-only cross-EMR patient search.
