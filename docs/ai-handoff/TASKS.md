# Tasks
Source requirements: BORKEO_EMR_MASTER_TASK.txt sections 1-10 and acceptance lists. Existing release functionality requires revalidation; no prior claims are assumed verified.
- CONT-01 VERIFIED: create five checkpoints and reconcile baseline.
- AUTH-01 VERIFIED: local login/context network recovery, cookie persistence, fresh CSRF, session expiry/account change and safe Khmer errors; synthetic Chromium/API coverage with NPCA disabled. Deployment fault is separate AUTH-02.
- AUTH-02 TODO: obtain actual deployment request URL/status/origin/proxy/browser evidence for the reported screenshot; do not equate local reproduction with production resolution. Continue ACCESS-01 independently.
- ACCESS-01 TODO: inventory all roles, contexts, navigation/actions and authorized/denied direct API matrix; audit findings with reproductions.
- ROLE-01 TODO: separate Obstetric/Gynecology doctors; explicit authorized midwife contexts; clinical routing and distinct miscarriage diagnoses.
- GYN-01 TODO: nursing assessment then valid bed placement; durable doctor task, explicit acknowledgement and service scoping.
- GYN-02 TODO: retries/restarts/unassigned doctors/transfers/audit and urgent escalation before bed; reconcile later placement.
- ANC-01 TODO: remove automatic popup; responsive inline linked checklist preserving unsaved work.
- ANC-02 TODO: saved evidence/manual author-time; preserve exception states; server/UI closure gates; visit distinct from pregnancy.
- ANC-03 TODO: field-by-field old/new form comparison, unified form, provenance/conflicts, additive repeatable transactional migration.
- RISK-01 TODO: approved shared rule configuration; age/date/BMI weight provenance, reasons/colors/history and unknown missing input.
- RX-01 TODO: explicit four QD times and actual quantity throughout save/reopen/review/dispense/print; historical ambiguity; other frequencies preserved.
- PRINT-01 TODO: inventory every print action/template/route, diagnose blank causes; visually inspect synthetic PDF including long records.
- NPCA-01 TODO: verify official docs/workbooks, contract differences and unresolved clinical/catalog/currency mappings; disable affected transmission.
- NPCA-02 TODO: selected visit role-authorized review/correction links/explicit confirmation, offline preview, stable IDs, stage-specific validated source mappings.
- NPCA-03 TODO: secure backend token/beneficiary confirmation, durable attempts/status/queue, reconciliation/retry/backoff and correction; mocked/demo evidence; local care independent.
- RELEASE-01 TODO: full npm test and check:khmer in disposable synthetic copy; inspect browser/print evidence and outstanding limitations.
- RELEASE-02 TODO: bump visible/package version once for completed approved update; combined Antigravity update with manifest; safe staged review, verified commit/push; installation guidance.

- REL429-01 VERIFIED: 42.8.0 -> 42.9.0 local recovery increment; full 974/974 tests, Khmer and Chromium pass; combined patch reverse/forward checks pass. Code commit c858abe2b51bda86bc59738c1657f542dc9cac12 pushed to origin/master; publication VERIFIED. RELEASE-01/02 above refer to full master acceptance, still TODO.
