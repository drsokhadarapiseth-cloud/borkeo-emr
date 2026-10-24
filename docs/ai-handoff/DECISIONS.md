# Decisions
2026-10-24: User explicitly authorized implementation/testing and routine technical decisions. Follow master task execution order; one active writer.
Combined Obstetric/Gynecology doctor access was CANCELLED. Preserve separate access and individual attribution.
Preserve all patient data, user untracked files, unrelated logic and .gitignore. No production deployment or real patient transmission authorized.
Use disposable source copy without .env/data/uploads/backups; synthetic/in-memory databases only. Never infer clinical thresholds, NPCA mappings or submission permissions.
Baseline package 42.8.0 is authoritative over directory label. Defer release bump until cohesive update is ready.
Observed context.js: bootstrap catch displays raw error; form stays usable with null/stale session; submission reads cached CSRF. Network failure's deployment cause remains unknown.

2026-10-24: Fixed pre-existing release-test dependence on ignored data/demo.sqlite by invoking existing synthetic seedDemoPatients with an in-memory database inside each affected test. Assertions retained. This is a permanent test-isolation fix, not injecting fixtures to mask a production failure.

Task scope for this increment: AUTH-01 local recovery and isolated regression infrastructure. A deployment-specific failed fetch can originate outside this source and remains unconfirmed without deployment network/origin evidence; do not label that root cause fixed. Existing backend roles/CSRF rules remain authoritative and unchanged.
