# v51.6 application handoff - runtime checks deferred

Applied on 2026-10-31 from Borkeo-EMR-v51.6.0-pmrs-import-readiness-update.txt.
Confirmed current package version 51.5.0 before applying; resulting version 51.6.0.
Git HEAD remains a830a8b52b44355e669f29de2a8358ccd0867943. The preceding v51.5
application was uncommitted; no reset, commit or history replacement was used.

Verified the existing v51.4 code-backup archive and its manifest SHA-256.
Additional snapshot of the actual unfinished v51.5 code, without live data:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v51.5.0-working-a830a8b5-f0b8c8c9
Its backup.json records version 51.5.0, Git baseline, workingTree=true and hash.
Restore only into a NEW folder using the code restore tool.

Parsed standalone BEGIN_JSON_FILES/END_JSON_FILES using a script.
All 19 actions were writes. Every LF-normalized beforeSha256 matched before any
replacement and was checked again immediately before its write. All resulting
UTF-8/LF byte counts and SHA-256 hashes match the supplied payload. No skips,
deletes, checksum conflicts or application errors occurred.
Bundle SHA-256: 41b39f18c143c8f3611bdb48be49a800f27323ebcb71f93577850f88ad1e2bdb.

Preserved all unrelated tracked/untracked work, .vscode/, supplied bundles,
previous application receipt, diagnostic files and external PMRS profiles.
Protected .env/.gitignore/profile/diagnostic files were verified unchanged.
No patient-data path was targeted. No verification flags or profile settings
were changed, no live transfer enabled, no Save clicked and no request replayed.

No EMR process was started/restarted, dependencies installed, runtime checks run,
commit made or push performed. The supplied files remain exact; this separate
receipt records the actual local backup without changing their checksums.
Next: run the requested checks in a disposable synthetic copy before activation.

Service state: found existing Borkeo listeners on 127.0.0.1/0.0.0.0:3001.
After identifying their Node server/launcher commands and the project launcher
ancestry, stopped only PIDs 26320 and 35380 as requested. Port 3001 has no listener.
The distinct older EMR on port 3002 (PID 22588, visible version v50.6) was left
untouched; it is not the updated checkout. No PMRS/browser controller was stopped.
