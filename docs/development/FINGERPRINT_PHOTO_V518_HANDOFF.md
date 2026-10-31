# Fingerprint below registration photo - v51.8.0

Approved layout update on 2026-10-31. Baseline working code: v51.7.0; Git HEAD
was a830a8b52b44355e669f29de2a8358ccd0867943 with approved v51.5-v51.7 bundles
already applied but uncommitted. Unrelated root README/extension extraction and
.vscode files were preserved, excluded from this update and release staging.

Required pre-edit code-only backup of actual v51.7 working code:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v51.7.0-working-a830a8b5-306de27f
Restore into a NEW folder only; do not overwrite live databases or secrets.

Moved the existing fingerprint enrollment section from the patient-detail grid
into registration-identity-column directly below reg_patient_photo_avatar.
Preserved its Khmer text, transient/no-auto-index attributes, disabled scanner
button and existing photo action/IDs/hidden photo field. No clinical fields,
fingerprint data/storage/capture logic or patient records were changed.
The compact identity column is 170px on desktop and centered/stacked at narrow
widths. Fingerprint text/button wrap within the panel. Photo stylesheet cache
key is updated. Package/lockfile/login/server visible version: 51.8.0.

Verified in disposable restored code copy borkeo-restored-code-Bw2soR, with
synthetic in-memory records and existing dependencies linked by junction:
- npm test: 1113/1113 PASS.
- npm run check:khmer: PASS.
- Real Playwright layout checks at 1440px and 390px: PASS. Fingerprint appears
  once below the photo, outside the main grid, fits its column, keeps disabled
  hardware state, and leaves the photo's capture-patient-photo action intact.
- Synthetic screenshots inspected: synthetic-fingerprint-evidence/desktop.png
  and narrow.png inside disposable copy, excluded from Git.
No live EMR restart, Chrome-extension installation, PMRS interaction or external
profile/verification-flag change was performed for this layout update.

Delivery: Borkeo-EMR-v51.8.0-registration-fingerprint-layout-update.txt.
The combined file contains this layout/version update with beforeSha256 from
the archived v51.7 working baseline; it does not replace unrelated pending work.
The release commit also includes previously approved v51.5-v51.7 manifest files
needed for a coherent current baseline, while unrelated unfinished files remain
unstaged. No .env/.gitignore/data/uploads/backups/password export is staged.
Activation is separate: restart the identified updated EMR and refresh registration.
