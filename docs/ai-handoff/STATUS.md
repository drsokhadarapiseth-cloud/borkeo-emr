# Status
Updated: 2026-10-24, Asia/Phnom_Penh. One active writer.
Objective: BORKEO_EMR_MASTER_TASK.txt, incremental implementation with preserved data/work.
Actual baseline: 42.8.0; branch master; startup commit 107ed3a. Current prepared version: 42.9.0. Folder label 42.3.0 is stale.
Repository: startup tracked tree clean; user-owned untracked files preserved (CHANGES.md). Release changes limited to login/context recovery, synthetic test isolation, metadata, delivery and handoff. No migrations.
Completed: read complete master prompt/AGENTS; created five checkpoints; reconciled Git/source. Fixed context null-session bootstrap, explicit retry, expired/account-changed sessions, refreshed CSRF and safe Khmer failures. Chromium synthetic login/context/recovery/denied ward/landing verified; targeted auth/CSRF passed. Existing demo assertions now seed in memory.
Verified 42.9 increment: full npm test 974/974 PASS; Khmer PASS; explicit Chromium PASS; forward and reverse combined-patch checks PASS. Git publication is the remaining release action.
Limitations: deployment screenshot and origin/network evidence unavailable; no claim that the reported deployment fault is resolved. No print/PDF visual check in this increment. Remaining clinical/routing/ANC/QD/print/NPCA requirements are TODO, not assumed covered by old releases.
Next EXACT action: inspect safe staged diff, commit and push verified 42.9 recovery release, record its commit and remote result, then continue ACCESS-01.
After this increment: ACCESS-01 role/action audit using public/nav-config.js, server/access.mjs and modular route guards; then ROLE-01. Known mismatch: roleWardAllowed and context.js currently restrict MIDWIFE to Obstetric only. Do not grant unassigned wards or combine doctor contexts.
No application/test processes intentionally left running; prior headless Edge instances closed. Synthetic browser profiles and logs remain in TEMP only.
Resume instruction: Read master, AGENTS and all five handoff files; reconcile git status/diff and latest commit, then resume the exact next action above. Preserve all existing changes. User already authorized routine implementation/testing.
