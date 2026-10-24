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

Release 42.9.0 code committed as c858abe2b51bda86bc59738c1657f542dc9cac12 and pushed to origin/master. Patient data and all initial user-owned untracked files remain excluded. Next phase ACCESS-01; full master task remains incomplete. Handoff/publication records and combined-update snapshot refreshed after push; no runtime source edits.

2026-10-24 08:44:46 +07:00 resume baseline ba812ed, version42.9.0. No live data/.env touched. No background process started. Prior untracked files preserved. Planned scope: access matrix, focused paraclinic permission regression fix/tests, release/checkpoint records.

ACCESS-01: tests/access-audit.test.mjs added for cross-service direct reads/writes, no side effects on denial, own-service access and explicit multi-ward doctor context switch. server/routes/paraclinic.mjs aligns create/read/attachment permissions with existing patient and modality policies. No schema or data migration.

Added docs/access-audit.md and scripts/write-access-audit.mjs: reproducible source inventory of15 built-in roles,19 representative contexts,37protected pages and API-module counts, with explicit incomplete-action boundaries/findings. Added tests/access-audit-browser.mjs and tests/helpers/access-audit-contexts.mjs. Metadata advances42.9->43.0 per decimal minor-step rule; public/login.html/server header/package/version smoke agree. scripts/build-v430-update.mjs prepares one safe allowlisted update from ba812ed. No new UI strings/dependencies/data migrations. Headless Edge test completed and closed; synthetic test logs/profile/attachment fixtures remain in TEMP.

Updated tests/v309-release-catchup.test.mjs to order with Surgery context for its Surgery fixture, plus explicit cross-ward Medicine denial. No runtime-source changes after initial targeted/browser passes.
