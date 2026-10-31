# v51.5 application handoff - checks deferred by user

Applied on 2026-10-30 from Borkeo-EMR-v51.5.0-pmrs-playwright-update.txt.
Baseline: v51.4.0, master a830a8b52b44355e669f29de2a8358ccd0867943.
Code-only baseline backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v51.4.0-a830a8b5-56001be1
Restore into a NEW folder only; do not overwrite live data or secrets.

Parsed the standalone BEGIN_JSON_FILES/END_JSON_FILES section with a script.
Applied exactly 45 write and 24 exact-file delete actions. Every write matched
its supplied UTF-8/LF byte count and SHA-256 before and after application; every
delete target is absent. No path outside the explicit code allowlist was used.
Bundle SHA-256: 01f0b75d893734d850b25c0cf15cc33285a67cf28e1b7a026e70672a706ba592.
Resulting package version: 51.5.0.

Initial Git status contained only .vscode/ and the supplied bundle as untracked.
Both were preserved. The bundle's AI_HANDOFF.md was written exactly as supplied;
this separate application receipt records the actual Windows backup without
changing any supplied payload hash. .gitignore and existing .env contents were
verified unchanged. No hospital database, uploads, backups or passwords targeted.

No PMRS profile setting was found in the applying process or local .env files.
The new workflow remains disabled without verified authorized external mappings.
No live site, browser login or PMRS transfer was invoked. Staff should disable
any already-loaded legacy Borkeo PMRS2 Helper extension in their browser; deleting
its code does not guarantee that existing browser tabs unload its old scripts.

Per the user's instruction, no npm ci, browser installation, tests, Khmer checks,
EMR start, commit or push was performed. No existing service was restarted.
Next: install dependencies/browser, run checks in a disposable synthetic copy,
review real authorized mappings before any live activation.
