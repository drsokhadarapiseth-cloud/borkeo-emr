# Role → navigation table (v39.8.0, implemented)

Source of truth: `public/nav-config.js`, the single map. Tested in `tests/v398-side-navigation.test.mjs`.

Rule: an item appears only if the server **already allows** that role and ward to open it (`roleCanPage` plus the ward checks). No permission was changed. Admin **Interface → navigation** settings can still hide or reorder items for a role, but can never add one.

Groups (Khmer UI): ការថែទាំអ្នកជំងឺ (Patient care) · សេវាគ្លីនិក (Clinical services) · ឱសថ និងស្តុក (Pharmacy and stock) · ហិរញ្ញវត្ថុ (Finance) · រដ្ឋបាល (Administration).

| Role (ward) | Patient care | Clinical services | Pharmacy and stock | Finance | Administration |
|---|---|---|---|---|---|
| REGISTRATION | Register patient · Patient list · Appointments | | | | |
| TRIAGE | Triage queue · Patient list | Queue display (TRIAGE) | | | |
| DOCTOR (OPD) | OPD queue · Patient list | IPD transfer · Queue display (OPD) | | | |
| DOCTOR (IPD ward) | Home and reports · Medical record · Wards and beds · Patient list | | Daily ward medicines | | |
| NURSE (OPD) | Patient list | Paraclinic handoffs | | | |
| NURSE / MIDWIFE (IPD ward) | Wards and beds · Patient list | | Daily ward medicines | | |
| CHIEF_WARD / WARD_HEAD | Wards and beds · Patient list | | Daily ward medicines | | |
| LAB | Patient list | Laboratory | Laboratory materials | | |
| IMAGING | Patient list | Medical imaging | Films and materials | | |
| PHARMACY | Patient list | | OPD dispensing · Daily ward medicines · Medicine list · Queue display | | |
| CLERK | Patient list | | | Billing | |
| ACCOUNTANT | Patient list | | | Billing · Expenses | |
| ADMIN / DIRECTOR / VICE_DIRECTOR | Home and reports · Wards and beds · Patient list | Laboratory · Medical imaging | OPD dispensing · Daily ward medicines · Medicine list | Billing · Expenses · Cash flow | Requests · User accounts · Name and logo · Health facility · Interface design · Styleguide |

## Decisions

- **Requests** stay management-only. Earlier releases removed this button for Triage (v23.9) and for all non-management roles (v24.7), and tests lock that in. The server still lets every role open `/requests`.
- **Lab / Imaging** removed for doctors: the server forbids those pages for DOCTOR.
- **Styleguide** kept for management.
- Not added to the menu although the server allows them, because they are per-patient or specialist tools reached from other screens: `/record-viewer`, `/pmrs-import`, `/opd-queue` for TRIAGE, `/emr` for nurses and CHIEF_WARD.

## Fixed links

| Before | After |
|---|---|
| IPD doctor → IPD transfer (403) | removed; OPD doctors keep it |
| Doctor → Lab / Imaging (403) | removed |
| Lab / Imaging / Pharmacy → `/stock` (404) | `/lab/materials`, `/imaging/films`, `/pharmacy/medicines` |
| Cashier → Expenses (403) | removed (Accountant keeps it) |
| Chief ward / Ward head → whole admin menu | their ward menu |
| OPD nurse had no link to their landing page | Paraclinic handoffs |
