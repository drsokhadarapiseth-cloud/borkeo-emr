# Changes
2026-10-24: Created docs/ai-handoff/{STATUS,TASKS,DECISIONS,TEST_RESULTS,CHANGES}. No schema migration or clinical data edits.
Initial tracked tree clean. User-owned untracked paths: .claude/, BORKEO_EMR_MASTER_TASK.txt, HOW-TO-RUN-NPCA.txt, PROMPT-4-NPCA-integration.md, borkeo-update-files/, public/HOW-TO-RUN.txt, public/PROMPT-1-medicine-list-and-dose-check.md, public/PROMPT-2-midwife-services-and-ANC.md, public/PROMPT-3-hosting-cloudflare.md, public/borkeo-update-files/. Preserve; do not include blindly in commits/delivery.
No background processes launched by this session. No .env, patient databases, backups or uploads read/copied/modified.
Rollback: checkpoint documents only so far; preserve useful history.

Changed public/context.js and protected/context.html for safe session bootstrap/retry and cookie-bound token refresh. Added tests/context-recovery.test.mjs for network, expiration, account change, 403/502 and successful fresh-token writes. No schema/data changes. Tests not yet run.

2026-10-24: public/login.js now shows safe Khmer failure text instead of raw backend diagnostics. public/context.css styles the retry action; docs/approved-new-khmer.json registers its Khmer label under the authorized UI requirement. tests/v1200-release.test.mjs now creates isolated synthetic fixtures rather than opening data/demo.sqlite.
Disposable paths recorded by temporary pointer files borkeo-master-validation-path.txt and borkeo-context-changed-path.txt in the session TEMP directory. Baseline test process completed. Browser test process completed and its headless Edge closed; synthetic browser profile remains in TEMP. No application processes intentionally left running.

Release metadata updated consistently to 42.9.0 (package/login/server header and version assertion). Cache-busted changed login/context assets. scripts/build-v429-update.mjs uses explicit safe file allowlist and baseline 107ed3a, SHA-256 manifest and reverse patch verification. No changes to .gitignore.

Additional release files: CHANGELOG.md, package.json, public/login.html, server/server.mjs, tests/accessibility-quality-smoke.test.mjs and tests/v399-password-change-loop.test.mjs (release metadata/cache expectation), docs/translations-needed.csv (new retry-label provenance). Fixes to translation insertion order/CSV are recorded in TEST_RESULTS. No unrelated source edits.
