# OPD and IPD blank-form repair - v49.3.0

Approved by the owner with "yes" after confirming repair of both installed EMRs.
Base: 8ed42bb3632ec25419a4d3857bb4f915eebef1de, master, 49.2.0.
Unrelated untracked .vscode/ is preserved and excluded from the commit.

## Cause and repair

A cached borkeo-active-role=TRIAGE could execute early Triage restrictions before
/api/auth/me established the actual doctor session. Triage-only root CSS classes
persisted, hiding page3 and its OPD/IPD panels while the encounter toolbar remained.
The disposable browser reproduction showed both forms invisible, no JS errors,
and html classes bed-direct-view triage-restricted bed-direct-triage.

Early clinical routing now uses the authenticated session role. The encounter
editor reconciles first-paint routing classes with the authenticated selected view.
No server authorization, cashier gate, encounter lock, clinical field/storage key,
financial calculation or patient data schema changed. Existing Khmer text remains.
Updated script query versions prevent reuse of the previous clinical scripts.

## Backups and installations

Primary baseline code backup (verified archive restored into a new disposable folder):
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.2.0-8ed42bb3-d8cee14e
Commit: 8ed42bb3632ec25419a4d3857bb4f915eebef1de.

Separate copy code-only baseline archive, 49.1.0:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-form-opening-20261028
Its backup.json records source, allowed code files and archive SHA256.
Restore any code archive into a NEW folder; never overwrite runtime data/secrets.

Primary D:\EMR\Borkeo_EMR_Git: 49.2.0 -> 49.3.0.
Separate D:\EMR\Borkeo_EMR_v48.9.0_Referral: 49.1.0 -> 49.2.0.
Both retain their own launcher/configuration, ports 3001/3002 and hostnames.
Only these source paths are installed in the separate copy:
protected/EMR.html, public/emr-encounter-editor.js,
public/emr-inpatient-workflow.js, public/emr-patient-record.js,
package.json, public/login.html, server/server.mjs,
tests/clinical-form-opening-browser.mjs.
Its version files are incremented independently; its server file is patched in place.
No .env, database, uploads, password CSV, staff account or instance configuration is copied.

## Validation

Disposable code-only root:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-XuhFT3
All patient creation/payment/role tests use synthetic in-memory databases.

- npm test: 1,072/1,072 passed, validation-form-full.log.
- npm run check:khmer: passed, validation-form-khmer.log.
- New clinical-form-opening-browser.mjs: passed with stale cached TRIAGE role,
  authenticated OPD and surgery doctors, actual visible forms at 1440/390 widths,
  original URL view preservation, authenticated Triage isolation, zero JS errors.
- Existing referral browser test passed before changes, proving that ordinary
  fresh-session tests alone had missed this cached-role regression.
- Screenshots in .validation-form-opening show restored OPD and IPD records;
  desktop images visually reviewed. The repair changes visibility/routing only.
- Script cache tags were updated after the full suite; final browser recheck
  covers the final source. No physical printer acceptance is claimed.

## Use

1. In each affected browser tab, press Ctrl+F5 to reload the repaired scripts.
2. Reopen the patient OPD or IPD record. Sign in again if the session has expired.
No server process was stopped. Already-running processes keep their startup version
until the next normal restart; source/package/login labels are consistent on restart.
Keep http://127.0.0.1:3001 and http://localhost:3002 separate.

Combined source artifact: Borkeo-EMR-v49.3.0-form-opening-update.txt.
Apply only to the documented matching baseline, preserving later customizations.
For the separate copy use its independent version changes described above.
