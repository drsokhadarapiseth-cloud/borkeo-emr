# v51.7 application handoff

Applied on 2026-10-31 from Borkeo-EMR-v51.7.0-chrome-import-update.txt.
Confirmed package v51.6.0 and inspected all tracked/untracked changes first.
Earlier approved v51.5/v51.6 applications remain unfinished/uncommitted; no reset,
merge or commit of unrelated work was used to apply this incremental bundle.

Code-only snapshot of the actual current v51.6 working code:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v51.6.0-working-a830a8b5-6d818e79
Manifest records version 51.6.0, workingTree=true, Git baseline and archive hash.
Successfully restored that snapshot into a NEW disposable folder for checks.
No live database, upload, secret or external profile was included.

Parsed standalone BEGIN_JSON_FILES/END_JSON_FILES using a script. All 19
LF-normalized beforeSha256 values matched before any file was replaced, and
were rechecked immediately before writing. All 19 writes matched their supplied
UTF-8/LF byte counts and SHA-256 afterward. No delete, skip, mismatch or merge.
Bundle SHA-256: 02fc9f185b287c93b7ceb5aa1f1f9591d28aed2a2b3648e316b616a33134d720.
Package and lockfile versions are now 51.7.0.

Patient data, .env/.gitignore, existing external profiles, diagnostics, .vscode,
previous bundles and application receipts were preserved. Protected-file hashes
were checked unchanged. No profile verification flags or live-transfer settings
were altered, PMRS Save clicked, or request replayed during this application.

Found Borkeo v51.6 Node server PID 28040 on 127.0.0.1:3001 and stopped only that
identified server before applying. Port 3002 PID 22588 was left untouched.
No updated live EMR was started. No dependency installation was needed.
Chrome extension files were written as code only: NOT installed in any browser.
The installed-extension acceptance opt-in was explicitly disabled for checks.

Validation in C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-jrwnQY,
a disposable restored snapshot plus the verified v51.7 payload; existing installed
dependencies linked by junction, with no live data or .env copied:
- npm test: 1113/1113 PASS.
- npm run check:khmer: PASS.
- node --test tests/pmrs-extension-browser.mjs tests/pmrs-playwright-browser.mjs:
  8 PASS, 0 FAIL, 1 installed-extension test intentionally SKIPPED.
- All browser sites/records were synthetic; no live PMRS acceptance is claimed.
Logs: v517-suite.log and v517-browser.log in the disposable directory.
Application errors: none. Source changes remain uncommitted to preserve the
existing unfinished application work; no push was performed.
Next: review the application, then separately install/configure the new Chrome
extension when requested. The updated port-3001 EMR remains stopped.
