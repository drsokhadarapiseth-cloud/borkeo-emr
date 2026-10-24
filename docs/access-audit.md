# Role and action access audit

Audit baseline: 42.9.0, ba812ed. First fixes prepared as 43.0.0.
Reproduce the source inventory with: node scripts/write-access-audit.mjs.
Source inventory is not proof that every action works. Test evidence is in
docs/ai-handoff/TEST_RESULTS.md; unfinished work stays in TASKS.md.

## Policy and service boundaries

- Sources: AGENTS.md, master sections 3/3A/7/8, server/access.mjs,
  public/nav-config.js, server/server.mjs, and the modular API guards below.
- Combined Obstetric/Gynecology doctor access was CANCELLED. Assignment to
  multiple wards requires an explicit active context. No account/role grants
  or clinical thresholds changed in this increment.
- Existing patient-access emergency and transfer exceptions are retained.
- The following table lists eligible contexts, not grants to every staff member.
  Actual selectable contexts are intersected with assigned roles and wards.
- Inventory covers built-in roles. Hospital-specific custom role definitions
  and live assignments were not read; do not infer their authorization.

| Role | Eligible ward contexts |
|---|---|
| ADMIN | No ward context |
| REGISTRATION | No ward context |
| TRIAGE | No ward context |
| DOCTOR | emergency, icu, medicine, surgery, pediatric, gynecology, obstetric, tb, infectious, ncu, opd |
| NURSE | emergency, icu, medicine, surgery, pediatric, gynecology, tb, infectious, ncu, opd |
| MIDWIFE | obstetric |
| LAB | No ward context |
| IMAGING | No ward context |
| PHARMACY | No ward context |
| ACCOUNTANT | No ward context |
| CLERK | No ward context |
| DIRECTOR | No ward context |
| VICE_DIRECTOR | No ward context |
| CHIEF_WARD | emergency, icu, medicine, surgery, pediatric, gynecology, obstetric, tb, infectious, ncu |
| WARD_HEAD | emergency, icu, medicine, surgery, pediatric, gynecology, obstetric, tb, infectious, ncu |

## Representative landing and menu matrix

Synthetic coverage: all 15 built-in roles in 19 representative contexts.
API tests check each visible menu destination and allow/deny results for user
administration, accounting expenses and NPCA mapping reads. Chromium checks
rendered menus and landing pages separately. This is not a save/reopen audit of
every button on these pages. Query-specific specialist workflows remain below.

| Active context | Server landing | Default visible navigation |
|---|---|---|
| ADMIN@- | /home | [Home and reports](/home); [Wards and beds](/departments); [Patient list](/patient-list); [Laboratory](/lab); [Medical imaging](/imaging); [OPD dispensing](/pharmacy/opd); [Daily ward medicines](/ward-medicines); [Medicine list](/pharmacy/medicines); [Billing](/billing); [Expenses](/expenses); [Cash flow](/finance); [Requests](/requests); [User accounts](/admin/users); [Name and logo](/admin/organization); [Health facility](/admin/health-facility); [Record view log](/admin/record-log); [Drug safety tables](/admin/drug-safety); [Interface design](/admin/interface); [Styleguide](/styleguide) |
| DIRECTOR@- | /home | [Home and reports](/home); [Wards and beds](/departments); [Patient list](/patient-list); [Laboratory](/lab); [Medical imaging](/imaging); [OPD dispensing](/pharmacy/opd); [Daily ward medicines](/ward-medicines); [Medicine list](/pharmacy/medicines); [Billing](/billing); [Expenses](/expenses); [Cash flow](/finance); [Requests](/requests); [User accounts](/admin/users); [Name and logo](/admin/organization); [Health facility](/admin/health-facility); [Record view log](/admin/record-log); [Drug safety tables](/admin/drug-safety); [Interface design](/admin/interface); [Styleguide](/styleguide) |
| VICE_DIRECTOR@- | /billing | [Home and reports](/home); [Wards and beds](/departments); [Patient list](/patient-list); [Laboratory](/lab); [Medical imaging](/imaging); [OPD dispensing](/pharmacy/opd); [Daily ward medicines](/ward-medicines); [Medicine list](/pharmacy/medicines); [Billing](/billing); [Expenses](/expenses); [Cash flow](/finance); [Requests](/requests); [User accounts](/admin/users); [Name and logo](/admin/organization); [Health facility](/admin/health-facility); [Record view log](/admin/record-log); [Drug safety tables](/admin/drug-safety); [Interface design](/admin/interface); [Styleguide](/styleguide) |
| REGISTRATION@- | /emr?view=register | [Register patient](/emr?view=register); [Patient list](/patient-list); [Appointments](/patient-list?view=appointments) |
| TRIAGE@- | /triage | [Triage queue](/triage); [Patient list](/patient-list); [Open queue display](/queue-display?service=TRIAGE) |
| DOCTOR@opd | /home | [OPD queue](/opd-queue); [Patient list](/patient-list); [Transfer and discharge](/ipd-transfer); [Open queue display](/queue-display?service=OPD) |
| DOCTOR@medicine | /home | [Home and reports](/home); [Medical record](/emr); [Wards and beds](/departments); [Patient list](/patient-list); [Daily ward medicines](/ward-medicines) |
| DOCTOR@obstetric | /home | [Home and reports](/home); [Medical record](/emr); [Wards and beds](/departments); [Patient list](/patient-list); [Daily ward medicines](/ward-medicines) |
| DOCTOR@gynecology | /home | [Home and reports](/home); [Safe abortion](/maternal?kind=gynecology); [Medical record](/emr); [Wards and beds](/departments); [Patient list](/patient-list); [Daily ward medicines](/ward-medicines) |
| NURSE@opd | /opd-paraclinic-nurse | [Patient list](/patient-list); [Paraclinic handoffs](/opd-paraclinic-nurse) |
| NURSE@medicine | /departments | [Wards and beds](/departments); [Patient list](/patient-list); [Daily ward medicines](/ward-medicines) |
| MIDWIFE@obstetric | /departments | [Maternal services queue](/maternal); [Wards and beds](/departments); [Patient list](/patient-list); [Daily ward medicines](/ward-medicines) |
| CHIEF_WARD@medicine | /ward-medicines | [Wards and beds](/departments); [Patient list](/patient-list); [Daily ward medicines](/ward-medicines) |
| WARD_HEAD@medicine | /ward-medicines | [Wards and beds](/departments); [Patient list](/patient-list); [Daily ward medicines](/ward-medicines) |
| LAB@- | /lab | [Patient list](/patient-list); [Laboratory](/lab); [Laboratory materials](/lab/materials) |
| IMAGING@- | /imaging | [Patient list](/patient-list); [Medical imaging](/imaging); [Films and materials](/imaging/films) |
| PHARMACY@- | /home | [Patient list](/patient-list); [OPD dispensing](/pharmacy/opd); [Daily ward medicines](/ward-medicines); [Medicine list](/pharmacy/medicines); [Open queue display](/pharmacy/display) |
| ACCOUNTANT@- | /billing | [Patient list](/patient-list); [Billing](/billing); [Expenses](/expenses) |
| CLERK@- | /billing | [Patient list](/patient-list); [Billing](/billing) |

## Protected-page inventory

Role-only source policy below; additional patient/ward guards still apply.
Server special cases: IPD transfer is OPD-doctor only; paraclinic handoff is
OPD-nurse only. Home redirects some roles to their landing. Cashier/accountant
EMR requests redirect to Billing; Triage EMR requests select its triage view.
Patient-linked EMR access additionally uses encounterAccess. Navigation settings
can hide/reorder entries; they cannot grant access. Specialist routes such as
NPCA/ANC/vaccination may be reached from patient actions instead of the sidebar.

| Page | roleCanPage allows |
|---|---|
| /admin/npca | ADMIN, DIRECTOR |
| /npca | ADMIN, ACCOUNTANT, CLERK, DIRECTOR |
| /admin/health-facility | ADMIN, DIRECTOR, VICE_DIRECTOR |
| /admin/drug-safety | ADMIN, PHARMACY, DIRECTOR, VICE_DIRECTOR |
| /maternal | ADMIN, DOCTOR, MIDWIFE, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD |
| /anc-record | ADMIN, DOCTOR, NURSE, MIDWIFE, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD |
| /vaccination | ADMIN, DOCTOR, NURSE, MIDWIFE, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD |
| /admin/record-log | ADMIN, DIRECTOR, VICE_DIRECTOR |
| /admin/interface | ADMIN, DIRECTOR, VICE_DIRECTOR |
| /styleguide | ADMIN, DIRECTOR, VICE_DIRECTOR |
| /home | ADMIN, REGISTRATION, TRIAGE, DOCTOR, NURSE, MIDWIFE, LAB, IMAGING, PHARMACY, ACCOUNTANT, CLERK, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD, WARD_HEAD |
| /emr | ADMIN, REGISTRATION, TRIAGE, DOCTOR, NURSE, MIDWIFE, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD |
| /print-preview | ADMIN, REGISTRATION, TRIAGE, DOCTOR, NURSE, MIDWIFE, LAB, IMAGING, PHARMACY, ACCOUNTANT, CLERK, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD, WARD_HEAD |
| /pmrs-import | ADMIN, DOCTOR, DIRECTOR, VICE_DIRECTOR |
| /ward-medicines | ADMIN, DOCTOR, NURSE, MIDWIFE, PHARMACY, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD, WARD_HEAD |
| /requests | ADMIN, REGISTRATION, TRIAGE, DOCTOR, NURSE, MIDWIFE, LAB, IMAGING, PHARMACY, ACCOUNTANT, CLERK, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD, WARD_HEAD |
| /opd-queue | ADMIN, TRIAGE, DOCTOR, DIRECTOR, VICE_DIRECTOR |
| /opd-paraclinic-nurse | ADMIN, NURSE, DIRECTOR, VICE_DIRECTOR |
| /ipd-transfer | ADMIN, DOCTOR, DIRECTOR, VICE_DIRECTOR |
| /pharmacy/opd | ADMIN, PHARMACY, DIRECTOR, VICE_DIRECTOR |
| /pharmacy/display | ADMIN, PHARMACY, DIRECTOR, VICE_DIRECTOR |
| /pharmacy/medicines | ADMIN, PHARMACY, DIRECTOR, VICE_DIRECTOR |
| /lab/materials | ADMIN, LAB, DIRECTOR, VICE_DIRECTOR |
| /queue-display | ADMIN, TRIAGE, DOCTOR, NURSE, MIDWIFE, DIRECTOR, VICE_DIRECTOR |
| /patient-list | ADMIN, REGISTRATION, TRIAGE, DOCTOR, NURSE, MIDWIFE, LAB, IMAGING, PHARMACY, ACCOUNTANT, CLERK, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD, WARD_HEAD |
| /record-viewer | ADMIN, DIRECTOR, VICE_DIRECTOR |
| /departments | ADMIN, DOCTOR, NURSE, MIDWIFE, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD, WARD_HEAD |
| /triage | ADMIN, TRIAGE, DIRECTOR, VICE_DIRECTOR |
| /context | ADMIN, REGISTRATION, TRIAGE, DOCTOR, NURSE, MIDWIFE, LAB, IMAGING, PHARMACY, ACCOUNTANT, CLERK, DIRECTOR, VICE_DIRECTOR, CHIEF_WARD, WARD_HEAD |
| /admin/users | ADMIN, DIRECTOR, VICE_DIRECTOR |
| /admin/organization | ADMIN, DIRECTOR, VICE_DIRECTOR |
| /lab | ADMIN, LAB, DIRECTOR, VICE_DIRECTOR |
| /imaging | ADMIN, IMAGING, DIRECTOR, VICE_DIRECTOR |
| /imaging/films | ADMIN, IMAGING, DIRECTOR, VICE_DIRECTOR |
| /billing | ADMIN, ACCOUNTANT, CLERK, DIRECTOR, VICE_DIRECTOR |
| /expenses | ADMIN, ACCOUNTANT, DIRECTOR, VICE_DIRECTOR |
| /finance | ADMIN, DIRECTOR, VICE_DIRECTOR |

## Important action checks and evidence

| Area | Existing authorization and verification |
|---|---|
| Login/context | Prior 42.9 recovery tests; this audit exercises synthetic login/cookies/context/landing with NPCA disabled. |
| User accounts | GET /api/admin/users: ADMIN, DIRECTOR, VICE_DIRECTOR; all other built-in roles denied. |
| Accounting | GET /api/finance/expenses: management and ACCOUNTANT; other roles denied. No calculations changed. |
| NPCA configuration | GET /api/npca/mappings: ADMIN, DIRECTOR; other roles denied; no remote calls/transmissions. |
| Patient/clinical forms | Existing canAccessPatient and encounterAccess; full forms/save/reopen audit remains unfinished. |
| Lab/imaging orders | Ward doctors create/read only accessible patients; nurses do not gain ordering rights. Specialist reads respect modality. |
| Lab/imaging attachments | Same-service ward readers retained; specialist direct downloads respect modality; synthetic file tests verify contents. |
| Prescribing/dispensing | Existing maternal and IPD regression tests retained. Comprehensive QD task remains unfinished. |
| Beds and doctor alerts | Existing workflows inventoried; required new durable Gynecology workflow remains GYN-01/02. |
| Print/download | Synthetic attachment downloads tested. No print/PDF action visually verified by this increment. |
| Other actions | Search/filter/save/reopen, notifications, queue transitions, all-role workflow and print inventory still require audit. |

## Findings

| ID | Reproduction, cause and fix |
|---|---|
| ACCESS-F01 | Obstetric doctor list hides Gynecology order, but GET order/id returned200. Cause: unconditional DOCTOR bypass. Removed it; direct reads use existing patient access. |
| ACCESS-F02 | Obstetric doctor POST order for Gynecology patient returned201. Cause: DOCTOR exempted from patient check. Removed exemption; denied requests have no order side effects. |
| ACCESS-F03 | LAB/IMAGING worklists restrict modality; direct order/attachment fallback used their global patient access. Specialist direct reads now use orderActorAllowed; matched modality retained. |
| ACCESS-O01 | MIDWIFE currently restricted to Obstetric in backend/context UI. Approved Gynecology context still requires ROLE-01 implementation; no silent grants. |
| ACCESS-O02 | Maternal patientFor/referral signer shortcuts need focused service/recipient review under ROLE-01. Do not remove legitimate referred-care access or claim separation complete. |
| ACCESS-O03 | Full page/action save/reopen, per-ward customizations, all prints and remaining API endpoints not yet exhaustively exercised. |

Tests: tests/access-audit.test.mjs, tests/access-audit-browser.mjs and existing
v162/v426 regressions. Current results and revision are recorded in checkpoints.

## API module inventory

Counts are source declarations, not a claim of endpoint-by-endpoint verification.
Main server legacy handlers, generated regex actions and middleware require
additional review. Presence of a guard name alone is not proof of enforcement.

| Module | Route declarations | Guard references to inspect |
|---|---|---|
| server/routes/admin.mjs | 28 | requireContext, sessionRole |
| server/routes/auth.mjs | 9 | sessionRole |
| server/routes/clinical-summary.mjs | 3 | requireContext, canAccessPatient |
| server/routes/clinical.mjs | 28 | requireContext, canAccessPatient, sessionRole |
| server/routes/finance.mjs | 46 | requireContext, canAccessPatient, sessionRole |
| server/routes/maternal.mjs | 10 | requireContext, canAccessPatient, canUseMaternalPatient |
| server/routes/medication-safety.mjs | 7 | requireContext, canAccessPatient |
| server/routes/messages.mjs | 9 | requireContext, sessionRole |
| server/routes/npca.mjs | 12 | canAccessPatient, requireSession, sessionRole |
| server/routes/paraclinic.mjs | 24 | requireContext, canAccessPatient, sessionRole, orderActorAllowed, canUseMaternalPatient, encounterAccess |
| server/routes/patients.mjs | 16 | requireContext, canAccessPatient, sessionRole, encounterAccess |
| server/routes/periop-forms.mjs | 2 | requireContext, canAccessPatient |
| server/routes/pharmacy.mjs | 13 | requireContext, sessionRole |
| server/routes/queue.mjs | 7 | requireContext, canAccessPatient, canUseMaternalPatient, encounterAccess |
| server/routes/record-access.mjs | 6 | requireContext, canAccessPatient |
