# Search helper cleanup - v50.2.0

Owner approved removal of the gray helper message below the facility selector.
The selector remains. View and Register at this hospital remain available on
matched patients for authorized staff. Existing server-side role checks, local
New/Old Case classification and normal registration/admission are preserved.
No new registration permissions or clinical logic changes are introduced.

Clean baseline 50.1.0 commit 048a516b0a5fcdb212ef5b8c897fed0de8f8fc5e.
Primary code-only backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v50.1.0-048a516b-ef8675af.
Receiver code-only backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-search-cleanup-20261029.
Online SQLite backups:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v502-search-1793247154746.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v502-search-1793247155009.sqlite

Disposable synthetic validation: borkeo-restored-code-MTwIaZ. Browser verification
asserts the status is empty after successful remote search, the Register button
is visible, local registration prefills identity only, normal save/card preview
works, source records stay unchanged, and returning registration is Old Case.
Desktop/mobile screenshots are synthetic. Existing error/loading status remains.

Delivery: Borkeo-EMR-v50.2.0-search-cleanup-update.txt. JSON content strings are
UTF-8/LF, with byte counts and SHA-256 hashes. No live data or secrets included.
Primary advances to 50.2.0; receiver advances independently to 50.1.0.

Final results: 1,080/1,080 tests pass; Khmer check passes. The real synthetic
browser registration workflow passes with an empty helper status, visible
registration action, new/old classification, and source-record preservation.
Desktop/mobile evidence is in .validation-network-registration.

Installed primary 50.2.0 PID 17992 and receiver 50.1.0 PID 34776 using original
hidden start-wifi launchers. Health, login versions and served search code pass.
All 97 pre-existing non-audit/non-nonce tables compare equivalent after existing
startup metadata/Superuser rehash/session-time normalization and append-only
access events. Patient records, workflow snapshots, API keys/grants remain exact;
counts remain 22 and 0, both integrity checks OK. No pairing or data import.
