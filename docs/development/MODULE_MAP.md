# Borkeo EMR module map

Inspected source: Borkeo_EMR_v45.5.0.zip. Its package.json declares 45.4.0; this is a development-tooling package, not an application release. The archive has no .git history.

This maps the current code; it does not claim that forms are physically separated. protected/EMR.html embeds registration, OPD, IPD, nursing and other forms. server/server.mjs mounts routes and explicitly lists public assets. server/routes/patients.mjs spans clinical, finance, pharmacy and admission workflows. Moving files requires updating those references.

A file can belong to several modules. Test suggestions are filename-based starting points, not proof of isolation. modules.json is the editable source for branch tooling.

## Current checkout additions (45.7.0)

The archive description above is historical. The current package version is the
release source of truth; modules.json records currentReleaseVersion separately.
The 23 IDs are choices for one task branch, not permanent department branches,
separate repositories or extracted forms.

- OPD/IPD/nursing/pharmacy share public/clinical-summary.js and .css, server/clinical-summary.mjs and server/routes/clinical-summary.mjs. The frontend file contains a nonvisual provider and existing SOAP editors; the patient banner stays removed. tests/clinical-summary-provider.test.mjs, clinical-summary-provider-browser.mjs and v410-clinical-summary-ui.test.mjs cover patient/revision isolation, errors, editor roles, allergy states and saved keys.
- Reports/permissions share public/record-access.js (print/export audit connection), public/record-viewer.js (selected encounter snapshot) and public/record-log.js (Khmer-default management log viewer). Check tests/record-access-provider.test.mjs, v417-record-log-documents.test.mjs and remaining-work-browser.mjs, including direct denied-role/ward requests.
- Recorded DNR and severe/life-threatening allergy warnings appear read-only in the IPD clinical summary. EWS retains its independent IPD Objective display and existing configured rules. tests/v431-compact-workspace.test.mjs covers the current displays; no DNR editor or new risk calculation was added.
- Development validation also covers scripts/khmer-lib.mjs, exact approvals in docs/khmer-approved-changes.md and docs/approved-new-khmer.json, and the evidence in KHMER_REVIEW.md. Never regenerate the baseline to silence failures.
- Shell navigation retains the historical patient-banner.js/.css filenames but renders chart tabs only. Orders/results now target the current encounter's live paraclinic section (results opens its existing details); medication targets the existing prescription/chart section. Preserve the same role filtering and page guards. Browser coverage must use actual sections rather than invented anchor IDs.

## Registration (`registration`)

Example branch: `feature/registration-describe-change`

**Primary files**

- `protected/patient-list.html`
- `public/appointment-list.js`
- `public/appointments.js`
- `public/cambodia-address.css`
- `public/cambodia-address.js`
- `public/cambodia-phone.js`
- `public/hef-lookup.css`
- `public/hef-lookup.js`
- `public/nationalities.css`
- `public/nationalities.js`
- `public/nssf-lookup.css`
- `public/nssf-lookup.js`
- `public/patient-card-print.css`
- `public/patient-card-print.js`
- `public/patient-list.css`
- `public/patient-list.js`
- `public/patient-photo.css`
- `public/patient-photo.js`
- `server/appointments.mjs`
- `server/cambodia-phone.mjs`
- `server/gazetteer.mjs`
- `server/hef-lookup.mjs`
- `server/nssf-lookup.mjs`
- `server/patient-photo.mjs`

**Shared dependencies**

- `protected/EMR.html`
- `public/emr-encounter-editor.js`
- `public/npca-registration.js`
- `server/database.mjs`
- `server/routes/patients.mjs`
- `server/server.mjs`

**Suggested tests**

- `tests/v191-registration-appointments.test.mjs`
- `tests/v192-registration-policy.test.mjs`
- `tests/v293-registration-direct-edit.test.mjs`
- `tests/v296-registration-layout.test.mjs`
- `tests/v297-registration-cards-position.test.mjs`
- `tests/v302-registration-sex-photo-and-patient-list.test.mjs`
- `tests/v303-triage-and-registration-photo-sync.test.mjs`
- `tests/v367-registration-caregiver-info.test.mjs`
- `tests/v427-registration-card.test.mjs`
- `tests/v435-registration-same-row-actions.test.mjs`
- `tests/v438-patient-list-dedup-and-actions.test.mjs`

**Workflow verification**

- Register and edit patient; duplicate prevention; patient card print; send to triage; HEF/NSSF link.

## Triage (`triage`)

Example branch: `feature/triage-describe-change`

**Primary files**

- `protected/triage.html`
- `public/triage.css`
- `public/triage.js`

**Shared dependencies**

- `protected/EMR.html`
- `public/emr-encounter-editor.js`
- `public/emr-patient-record.js`
- `public/emr-permissions.js`
- `public/emr-session.js`
- `public/patient-photo.js`
- `public/soap-note.js`
- `server/database.mjs`
- `server/routes/clinical.mjs`
- `server/routes/patients.mjs`
- `server/server.mjs`

**Suggested tests**

- `tests/demo-triage-ready.test.mjs`
- `tests/triage-flow.test.mjs`
- `tests/triage-ui.test.mjs`
- `tests/v132-triage-print.test.mjs`
- `tests/v239-remove-triage-requests-tab.test.mjs`
- `tests/v270-remove-triage-skip-button.test.mjs`
- `tests/v299-triage-header-and-thirty-patients.test.mjs`
- `tests/v300-patient-sex-and-triage-photo.test.mjs`
- `tests/v303-triage-and-edit-photo-sync.test.mjs`
- `tests/v303-triage-and-registration-photo-sync.test.mjs`
- `tests/v317-triage-layout-spacing-and-save-button.test.mjs`
- `tests/v318-triage-id-generation-and-json.test.mjs`
- `tests/v323-triage-glucose-and-meal-timing.test.mjs`
- `tests/v324-triage-glucose-separate-cell.test.mjs`
- `tests/v325-triage-print-button-and-form.test.mjs`
- `tests/v326-triage-vertical-metadata-and-encounter-id.test.mjs`
- `tests/v332-triage-button-and-hef-dialog.test.mjs`
- `tests/v351-case-reg-triage-sync-and-button-style.test.mjs`
- `tests/v355-triage-dropdown-hef-and-coverage-area.test.mjs`
- `tests/v356-triage-contraception-and-hef-code.test.mjs`
- `tests/v357-triage-auto-plot-docking-and-edit-button.test.mjs`
- `tests/v359-triage-edit-button-state-and-locking.test.mjs`
- `tests/v362-triage-patient-list-actions.test.mjs`
- `tests/v364-performance-and-triage-workflow.test.mjs`
- `tests/v365-triage-free-edit.test.mjs`
- `tests/v366-triage-services-and-photo-workflow.test.mjs`
- `tests/v402-triage-direct-editing.test.mjs`

**Workflow verification**

- Save vital signs; reload encounter; send to correct OPD; print; verify registration photo.

## OPD consultation (`opd`)

Example branch: `feature/opd-describe-change`

**Primary files**

- `public/emr-consultation-workspace.css`
- `public/emr-consultation-workspace.js`
- `public/opd-clinical-storage.js`
- `public/opd-paraclinic-nurse.css`
- `public/opd-paraclinic-nurse.js`
- `public/opd-queue.css`
- `public/opd-queue.js`
- `public/opd-specialty-theme.js`

**Shared dependencies**

- `protected/EMR.html`
- `public/emr-diagnoses.js`
- `public/emr-encounter-editor.js`
- `public/emr-icd10.js`
- `public/emr-patient-record.js`
- `public/emr-permissions.js`
- `public/emr-session.js`
- `public/medicine-autocomplete.js`
- `public/paraclinic.js`
- `public/soap-note.js`
- `server/database.mjs`
- `server/finance.mjs`
- `server/opd-queue.mjs`
- `server/paraclinic.mjs`
- `server/pharmacy-prescriptions.mjs`
- `server/routes/clinical.mjs`
- `server/routes/patients.mjs`
- `server/server.mjs`

**Suggested tests**

- `tests/opd-consult-paraclinic-cashier.test.mjs`
- `tests/opd-paraclinic-prepayment.test.mjs`
- `tests/opd-prepayment-ui-v126.test.mjs`
- `tests/opd-queue-dispensing.test.mjs`
- `tests/v131-opd-lab-direct.test.mjs`
- `tests/v131-opd-lab-message.test.mjs`
- `tests/v155-opd-transfer-alerts.test.mjs`
- `tests/v158-opd-form-transfers.test.mjs`
- `tests/v177-opd-discharge.test.mjs`
- `tests/v249-imaging-dropdown-english-specialties.test.mjs`
- `tests/v251-imaging-group-dropdown-buttons.test.mjs`
- `tests/v252-uniform-group-buttons-and-dropdown-fix.test.mjs`
- `tests/v260-opd-refined-report.test.mjs`
- `tests/v262-no-duplicate-opd-report.test.mjs`
- `tests/v267-opd-payment-status-on-home.test.mjs`
- `tests/v268-opd-queue-button-and-rename.test.mjs`
- `tests/v315-opd-to-ipd-bed-assignment-fix.test.mjs`
- `tests/v347-ethnicity-nationality-dropdown.test.mjs`
- `tests/v355-triage-dropdown-hef-and-coverage-area.test.mjs`
- `tests/v408-opd-soap-record.test.mjs`
- `tests/v432-modern-consultation-workspace.test.mjs`

**Workflow verification**

- Queue to consultation; save/reopen SOAP; diagnosis/prescription; lab/imaging request; cashier release; admission or discharge; print.

## IPD admission and medical record (`ipd`)

Example branch: `feature/ipd-describe-change`

**Primary files**

- `protected/ipd-transfer.html`
- `public/emr-inpatient-workflow.css`
- `public/emr-inpatient-workflow.js`
- `public/ipd-transfer.css`
- `public/ipd-transfer.js`
- `server/admission-approvals.mjs`
- `server/patient-transfers.mjs`

**Shared dependencies**

- `protected/EMR.html`
- `public/emr-encounter-editor.js`
- `public/emr-patient-record.js`
- `public/emr-permissions.js`
- `public/emr-session.js`
- `public/soap-note.js`
- `server/bed-management.mjs`
- `server/daily-report.mjs`
- `server/database.mjs`
- `server/finance.mjs`
- `server/requests.mjs`
- `server/routes/clinical.mjs`
- `server/routes/patients.mjs`
- `server/server.mjs`

**Suggested tests**

- `tests/v162-ipd-paraclinic-workflow.test.mjs`
- `tests/v245-ipd-discharge-top-diagnoses.test.mjs`
- `tests/v287-restore-ipd-access-and-director-approval-view.test.mjs`
- `tests/v288-ipd-medical-record-access.test.mjs`
- `tests/v289-ipd-panel-structure.test.mjs`
- `tests/v315-opd-to-ipd-bed-assignment-fix.test.mjs`
- `tests/v3211-ipd-form-and-obgyn-history.test.mjs`
- `tests/v3212-ipd-clean-header-and-photo.test.mjs`
- `tests/v3213-rename-ipd-title.test.mjs`
- `tests/v407-ipd-soap-record.test.mjs`

**Workflow verification**

- Admit and approve; retain OPD history; medical record and daily notes; ward transfer; discharge and print.

## Nursing care (`nursing`)

Example branch: `feature/nursing-describe-change`

**Primary files**

- `public/early-warning.js`
- `public/fluid-balance.js`

**Shared dependencies**

- `protected/EMR.html`
- `public/emr-encounter-editor.js`
- `public/emr-inpatient-workflow.js`
- `public/emr-patient-record.js`
- `public/emr-permissions.js`
- `public/emr-session.js`
- `public/soap-note.js`
- `server/clinical-summary.mjs`
- `server/database.mjs`
- `server/routes/clinical.mjs`
- `server/routes/patients.mjs`
- `server/server.mjs`

**Suggested tests**

- `tests/v354-nursing-khmer-and-remove-ambulance.test.mjs`
- `tests/v410-clinical-summary-ui.test.mjs`
- `tests/v410-clinical-summary.test.mjs`

**Workflow verification**

- Open #sub_nursing; save/reopen notes and observations; fluid balance; ward permissions; print. Nursing form is embedded in protected/EMR.html.

## Midwife, ANC, PNC and maternal care (`maternity`)

Example branch: `feature/maternity-describe-change`

**Primary files**

- `protected/anc-record.html`
- `protected/maternal.html`
- `public/anc-engine.mjs`
- `public/anc-record.css`
- `public/anc-record.js`
- `public/anc-referral-letter.mjs`
- `public/maternal-emr.js`
- `public/maternal.css`
- `public/maternal.js`
- `server/catalogues/anc-color-chart.json`
- `server/catalogues/anc-record-labels.json`
- `server/catalogues/anc-visit-schedule.json`
- `server/maternal.mjs`
- `server/routes/maternal.mjs`

**Shared dependencies**

- `protected/EMR.html`
- `public/emr-encounter-editor.js`
- `public/emr-patient-record.js`
- `public/emr-permissions.js`
- `public/emr-session.js`
- `public/soap-note.js`
- `server/database.mjs`
- `server/finance.mjs`
- `server/payment-policy.mjs`
- `server/routes/clinical.mjs`
- `server/routes/patients.mjs`
- `server/server.mjs`

**Suggested tests**

- `tests/v426-midwife-anc.test.mjs`

**Workflow verification**

- Midwife queue; ANC record and visit schedule; risk classification; linked maternal encounter; fee exemptions; print. Other maternal forms remain embedded in shared EMR/legacy files.

## Vaccination (`vaccination`)

Example branch: `feature/vaccination-describe-change`

**Primary files**

- `protected/vaccination.html`
- `public/vaccination.js`

**Shared dependencies**

- `server/access.mjs`
- `server/maternal.mjs`
- `server/routes/maternal.mjs`

**Suggested tests**

- `tests/v426-midwife-anc.test.mjs`

**Workflow verification**

- Save vaccination and reopen correct patient; verify maternal linkage and role access.

## Beds and wards (`beds`)

Example branch: `feature/beds-describe-change`

**Primary files**

- `protected/departments.html`
- `public/departments.css`
- `public/departments.js`
- `server/bed-management.mjs`

**Shared dependencies**

- `protected/EMR.html`
- `public/emr-inpatient-workflow.js`
- `server/daily-report.mjs`
- `server/database.mjs`
- `server/patient-transfers.mjs`
- `server/routes/patients.mjs`
- `server/server.mjs`

**Suggested tests**

- `tests/v208-bed-transfer.test.mjs`
- `tests/v209-bed-modal.test.mjs`
- `tests/v315-opd-to-ipd-bed-assignment-fix.test.mjs`
- `tests/v404-ward-bed-patient-photo.test.mjs`

**Workflow verification**

- Assign vacant bed; block double occupancy; transfer ward/bed; open correct encounter; discharge releases bed.

## Laboratory (`lab`)

Example branch: `feature/lab-describe-change`

**Primary files**

- `protected/lab.html`
- `public/lab.css`
- `public/lab.js`
- `server/lab-reference-defaults.mjs`

**Shared dependencies**

- `public/paraclinic-print.css`
- `public/paraclinic-workspace.css`
- `public/paraclinic.css`
- `public/paraclinic.js`
- `public/request-badges.js`
- `server/access.mjs`
- `server/critical-escalation.mjs`
- `server/finance.mjs`
- `server/paraclinic.mjs`
- `server/routes/paraclinic.mjs`
- `server/stock.mjs`

**Suggested tests**

- `tests/access-paraclinic.test.mjs`
- `tests/opd-consult-paraclinic-cashier.test.mjs`
- `tests/opd-paraclinic-prepayment.test.mjs`
- `tests/paraclinic-ui.test.mjs`
- `tests/v127-queue-paraclinic.test.mjs`
- `tests/v128-queue-paraclinic.test.mjs`
- `tests/v131-opd-lab-direct.test.mjs`
- `tests/v131-opd-lab-message.test.mjs`
- `tests/v162-ipd-paraclinic-workflow.test.mjs`
- `tests/v168-language-lab-print.test.mjs`
- `tests/v203-lab-reference.test.mjs`
- `tests/v216-lab-material-catalog.test.mjs`
- `tests/v257-professional-paraclinic-buttons.test.mjs`
- `tests/v258-home-report-box-labels.test.mjs`
- `tests/v259-home-report-box-unbracketed-labels.test.mjs`
- `tests/v290-photo-and-paraclinic.test.mjs`
- `tests/v304-lab-imaging-master-detail-and-activation.test.mjs`
- `tests/v305-paper-style-lab-form-and-clean-imaging.test.mjs`
- `tests/v306-refined-lab-form-and-khmer-ui.test.mjs`
- `tests/v334-card-label-ruler-and-multi-print.test.mjs`
- `tests/v346-disability-label-rename.test.mjs`

**Workflow verification**

- Order, pay/release, enter result, critical alert, clinician review, print and lab material stock.

## Imaging (`imaging`)

Example branch: `feature/imaging-describe-change`

**Primary files**

- `protected/imaging.html`
- `public/imaging.css`
- `public/imaging.js`

**Shared dependencies**

- `public/paraclinic-print.css`
- `public/paraclinic-workspace.css`
- `public/paraclinic.css`
- `public/paraclinic.js`
- `server/access.mjs`
- `server/finance.mjs`
- `server/paraclinic.mjs`
- `server/routes/paraclinic.mjs`
- `server/stock.mjs`

**Suggested tests**

- `tests/access-paraclinic.test.mjs`
- `tests/opd-consult-paraclinic-cashier.test.mjs`
- `tests/opd-paraclinic-prepayment.test.mjs`
- `tests/paraclinic-ui.test.mjs`
- `tests/v127-queue-paraclinic.test.mjs`
- `tests/v128-queue-paraclinic.test.mjs`
- `tests/v162-ipd-paraclinic-workflow.test.mjs`
- `tests/v205-imaging-signatures.test.mjs`
- `tests/v217-imaging-film-stock.test.mjs`
- `tests/v218-imaging-navigation-tabs.test.mjs`
- `tests/v219-imaging-status-subtabs.test.mjs`
- `tests/v220-imaging-two-tier-toolbar.test.mjs`
- `tests/v248-specialist-imaging-subtypes-and-signatures.test.mjs`
- `tests/v249-imaging-dropdown-english-specialties.test.mjs`
- `tests/v251-imaging-group-dropdown-buttons.test.mjs`
- `tests/v255-imaging-films-unified-toolbar.test.mjs`
- `tests/v257-professional-paraclinic-buttons.test.mjs`
- `tests/v276-nested-imaging-role-subtypes.test.mjs`
- `tests/v277-direct-imaging-modality-selection.test.mjs`
- `tests/v290-photo-and-paraclinic.test.mjs`
- `tests/v304-lab-imaging-master-detail-and-activation.test.mjs`
- `tests/v305-paper-style-lab-form-and-clean-imaging.test.mjs`

**Workflow verification**

- Order modality; payment release; specialist access; result/report signature; review; film stock and print.

## Pharmacy and medication dispensing (`pharmacy`)

Example branch: `feature/pharmacy-describe-change`

**Primary files**

- `protected/pharmacy-display.html`
- `protected/pharmacy-opd.html`
- `public/pharmacy-display.css`
- `public/pharmacy-display.js`
- `public/pharmacy-opd.css`
- `public/pharmacy-opd.js`
- `server/pharmacy-discharge.mjs`
- `server/pharmacy-prescriptions.mjs`
- `server/routes/pharmacy.mjs`

**Shared dependencies**

- `public/medicine-autocomplete.css`
- `public/medicine-autocomplete.js`
- `public/medicine-dose-check.js`
- `public/medicine-units.js`
- `server/finance.mjs`
- `server/medication-safety.mjs`
- `server/medicine-catalogue.mjs`
- `server/stock.mjs`
- `server/ward-medicines.mjs`

**Suggested tests**

- `tests/opd-queue-dispensing.test.mjs`
- `tests/pharmacy-prescriptions.test.mjs`
- `tests/v150-pharmacy-queue.test.mjs`
- `tests/v215-pharmacy-stock-catalog.test.mjs`
- `tests/v269-pharmacy-queue-button-and-display.test.mjs`

**Workflow verification**

- OPD prescription receipt; correct patient/dose; dispensing; stock deduction; discharge medicines and return flow.

## Medicine and material inventory (`stock`)

Example branch: `feature/stock-describe-change`

**Primary files**

- `protected/pmrs-import.html`
- `protected/stock.html`
- `public/pmrs-import.js`
- `public/stock.css`
- `public/stock.js`
- `server/catalogues/medicines-eml-2024.json`
- `server/medicine-catalogue.mjs`
- `server/pmrs2-medicine-import.mjs`
- `server/stock.mjs`

**Shared dependencies**

- `server/paraclinic.mjs`
- `server/pharmacy-prescriptions.mjs`
- `server/ward-medicines.mjs`

**Suggested tests**

- `tests/pmrs2-medicine-import.test.mjs`
- `tests/v195-language-stock.test.mjs`
- `tests/v215-pharmacy-stock-catalog.test.mjs`
- `tests/v216-lab-material-catalog.test.mjs`
- `tests/v217-imaging-film-stock.test.mjs`

**Workflow verification**

- Catalogue import preview; medicine units; stock receive/use; lab materials; imaging films; stock history.

## Cashier, invoices and billing (`cashier`)

Example branch: `feature/cashier-describe-change`

**Primary files**

- `protected/billing.html`
- `public/billing.css`
- `public/billing.js`
- `public/cashier-notifications.css`
- `public/cashier-notifications.js`
- `public/payment-approvals.js`
- `public/payment-policy.css`
- `public/payment-prices.js`
- `public/receipt.css`
- `public/staff-invoices.css`
- `public/staff-invoices.js`
- `server/hef-tariffs.mjs`
- `server/invoice-edits.mjs`
- `server/payment-policy.mjs`

**Shared dependencies**

- `server/finance.mjs`
- `server/paraclinic.mjs`
- `server/requests.mjs`
- `server/routes/finance.mjs`
- `server/routes/patients.mjs`

**Suggested tests**

- `tests/finance.test.mjs`
- `tests/opd-consult-paraclinic-cashier.test.mjs`
- `tests/opd-paraclinic-prepayment.test.mjs`
- `tests/opd-prepayment-ui-v126.test.mjs`
- `tests/v140-cashier-ui.test.mjs`
- `tests/v182-cashier-delete.test.mjs`
- `tests/v183-cashier-workflow.test.mjs`
- `tests/v307-cashier-history-discharge-and-photo-auto-apply.test.mjs`
- `tests/v308-cashier-header-icd10-and-mgmt-history.test.mjs`
- `tests/v309-cashier-and-management.test.mjs`

**Workflow verification**

- Charges and payer rules; payment receipt; concessions/approval; paid order release; invoice history; discharge settlement.

## Finance and expenses (`finance`)

Example branch: `feature/finance-describe-change`

**Primary files**

- `protected/expenses.html`
- `protected/finance.html`
- `public/expenses.css`
- `public/expenses.js`
- `public/finance.css`
- `public/finance.js`
- `server/finance.mjs`
- `server/routes/finance.mjs`

**Shared dependencies**

- `server/invoice-edits.mjs`
- `server/payment-policy.mjs`

**Suggested tests**

- `tests/finance.test.mjs`
- `tests/v272-single-unified-finance-table.test.mjs`
- `tests/v273-finance-period-range-reports.test.mjs`

**Workflow verification**

- Cashflow; expenses; exchange rate approvals; day/month totals and receipts.

## Reports and printing (`reports`)

Example branch: `feature/reports-describe-change`

**Primary files**

- `protected/print-preview.html`
- `protected/ward-medicines.html`
- `public/report-print.css`
- `public/report-print.js`
- `public/ward-medicine-table.js`
- `public/ward-medicines.css`
- `public/ward-medicines.js`
- `server/daily-report.mjs`
- `server/ward-medicine-approvals.mjs`
- `server/ward-medicine-matrix.mjs`
- `server/ward-medicines.mjs`

**Shared dependencies**

- `protected/EMR.html`
- `server/finance.mjs`
- `server/routes/clinical.mjs`

**Suggested tests**

- `tests/default-ward-users.test.mjs`
- `tests/report-print.test.mjs`
- `tests/v1510-ward-service-fees.test.mjs`
- `tests/v243-home-dashboard-reports.test.mjs`
- `tests/v244-custom-roles-wards-clean-home.test.mjs`
- `tests/v247-clean-reports-ward-scope-requests.test.mjs`
- `tests/v258-home-report-box-labels.test.mjs`
- `tests/v259-home-report-box-unbracketed-labels.test.mjs`
- `tests/v260-opd-refined-report.test.mjs`
- `tests/v261-department-report-styles.test.mjs`
- `tests/v262-no-duplicate-opd-report.test.mjs`
- `tests/v265-combined-home-reports-no-tabs.test.mjs`
- `tests/v271-professional-cashflow-report.test.mjs`
- `tests/v273-finance-period-range-reports.test.mjs`
- `tests/v403-ward-direct-editing.test.mjs`
- `tests/v404-ward-bed-patient-photo.test.mjs`
- `tests/ward-medicine-approval.test.mjs`
- `tests/ward-medicine-matrix.test.mjs`
- `tests/ward-medicine-notification.test.mjs`
- `tests/ward-medicines.test.mjs`

**Workflow verification**

- Patient/encounter filters; daily movements; ward medicine totals; print page breaks and signatures.

## Users, roles and authentication (`permissions`)

Example branch: `feature/permissions-describe-change`

**Primary files**

- `protected/admin-users.html`
- `public/admin-users.css`
- `public/admin-users.js`
- `public/emr-permissions.js`
- `public/login.css`
- `public/login.html`
- `public/login.js`
- `server/access.mjs`
- `server/encounter-access.mjs`
- `server/password.mjs`
- `server/record-access.mjs`
- `server/routes/admin.mjs`
- `server/routes/auth.mjs`
- `server/routes/record-access.mjs`
- `server/security.mjs`
- `server/superuser.mjs`
- `server/totp.mjs`

**Shared dependencies**

- `public/emr-session.js`
- `server/server.mjs`

**Suggested tests**

- `tests/access-audit.test.mjs`
- `tests/access-paraclinic.test.mjs`
- `tests/accessibility-quality-smoke.test.mjs`
- `tests/auth.test.mjs`
- `tests/v222-mobile-lan-access.test.mjs`
- `tests/v287-restore-ipd-access-and-director-approval-view.test.mjs`
- `tests/v288-ipd-medical-record-access.test.mjs`
- `tests/v378-encounter-access.test.mjs`
- `tests/v381-auth-production-security.test.mjs`

**Workflow verification**

- Positive and negative role access; ward boundaries; locked encounter corrections; login/session and audit trail.

## NPCA and PMRS integration (`npca`)

Example branch: `feature/npca-describe-change`

**Primary files**

- `docs/npca/INTEGRATION.md`
- `docs/npca/OPEN-QUESTIONS.md`
- `docs/npca/VERIFICATION.md`
- `protected/npca.html`
- `public/npca-forms.js`
- `public/npca-registration.js`
- `public/npca-widget.js`
- `public/npca.css`
- `public/npca.js`
- `server/npca/address.mjs`
- `server/npca/beneficiaries.mjs`
- `server/npca/client.mjs`
- `server/npca/codes.mjs`
- `server/npca/integration.mjs`
- `server/npca/settings.mjs`
- `server/npca/source.mjs`
- `server/npca/standards.json`
- `server/npca/storage.mjs`
- `server/npca/validation.mjs`
- `server/npca/visit-builder.mjs`
- `server/pmrs2-mapping.mjs`
- `server/pmrs2-transfer.mjs`
- `server/routes/npca.mjs`

**Shared dependencies**

- `server/config.mjs`
- `server/finance.mjs`
- `server/routes/patients.mjs`

**Suggested tests**

- `tests/pmrs2-mapping.test.mjs`
- `tests/v428-npca.test.mjs`

**Workflow verification**

- Use mocks; validate beneficiary and visit mappings; submission status; retry/idempotency; no real patient submissions in tests.

## Admission/discharge/fee approvals (`requests`)

Example branch: `feature/requests-describe-change`

**Primary files**

- `protected/requests.html`
- `public/requests.css`
- `public/requests.js`
- `server/admission-approvals.mjs`
- `server/requests.mjs`

**Shared dependencies**

- `server/invoice-edits.mjs`
- `server/messages.mjs`
- `server/routes/clinical.mjs`
- `server/ward-medicine-approvals.mjs`

**Suggested tests**

- `tests/admission-approval.test.mjs`
- `tests/v196-requests.test.mjs`
- `tests/v206-requests-language.test.mjs`
- `tests/v213-requests-toolbar-signatures.test.mjs`
- `tests/v239-remove-triage-requests-tab.test.mjs`
- `tests/v247-clean-reports-ward-scope-requests.test.mjs`
- `tests/v285-bulk-approve-executive-requests.test.mjs`
- `tests/v287-restore-ipd-access-and-director-approval-view.test.mjs`
- `tests/v298-remove-admission-approval-panel.test.mjs`
- `tests/ward-medicine-approval.test.mjs`

**Workflow verification**

- Submit, approve, reject; role restrictions; no duplicate processing; reflect status in original encounter.

## Staff messages and alerts (`messages`)

Example branch: `feature/messages-describe-change`

**Primary files**

- `public/messages.css`
- `public/messages.js`
- `server/messages.mjs`
- `server/routes/messages.mjs`

**Shared dependencies**

- `server/critical-escalation.mjs`
- `server/record-access.mjs`
- `server/requests.mjs`

**Suggested tests**

- `tests/admin-messages-transfers.test.mjs`
- `tests/shared-messages.test.mjs`
- `tests/v131-opd-lab-message.test.mjs`
- `tests/v284-khmer-messages-admission-structured-view.test.mjs`

**Workflow verification**

- Recipient access; unread state; attachments; critical result alerts and completion.

## Surgery and perioperative forms (`surgery`)

Example branch: `feature/surgery-describe-change`

**Primary files**

- `public/periop-forms.css`
- `public/periop-forms.js`
- `server/periop-forms.mjs`
- `server/routes/periop-forms.mjs`

**Shared dependencies**

- `protected/EMR.html`
- `public/emr-encounter-editor.js`
- `public/emr-patient-record.js`
- `public/emr-permissions.js`
- `public/emr-session.js`
- `public/soap-note.js`
- `server/database.mjs`
- `server/routes/clinical.mjs`
- `server/routes/patients.mjs`
- `server/server.mjs`

**Suggested tests**

- `tests/v413-periop-forms.test.mjs`

**Workflow verification**

- Correct patient and encounter; consent and perioperative form persistence; signatures and print.

## Navigation, design and language (`shell`)

Example branch: `feature/shell-describe-change`

**Primary files**

- `public/app-shell.css`
- `public/app-shell.js`
- `public/components.css`
- `public/components.js`
- `public/design-system.css`
- `public/emr-language-data.js`
- `public/emr-language-lock.js`
- `public/emr-language.css`
- `public/emr-language.js`
- `public/interface-theme.css`
- `public/interface-theme.js`
- `public/nav-config.js`
- `public/new-text-data.js`
- `public/new-text.css`
- `public/new-text.js`
- `public/responsive-layout.css`
- `public/shared-controls.css`
- `server/interface-theme.mjs`
- `server/navigation-settings.mjs`

**Shared dependencies**

- `protected/EMR.html`
- `protected/admin-users.html`
- `protected/anc-record.html`
- `protected/billing.html`
- `protected/context.html`
- `protected/departments.html`
- `protected/drug-safety.html`
- `protected/expenses.html`
- `protected/finance.html`
- `protected/health-facility.html`
- `protected/home.html`
- `protected/imaging.html`
- `protected/interface-theme.html`
- `protected/ipd-transfer.html`
- `protected/lab.html`
- `protected/maternal.html`
- `protected/npca.html`
- `protected/opd-paraclinic-nurse.html`
- `protected/opd-queue.html`
- `protected/organization-branding.html`
- `protected/patient-list.html`
- `protected/pharmacy-display.html`
- `protected/pharmacy-opd.html`
- `protected/pmrs-import.html`
- `protected/print-preview.html`
- `protected/queue-display.html`
- `protected/record-log.html`
- `protected/record-viewer.html`
- `protected/requests.html`
- `protected/stock.html`
- `protected/styleguide.html`
- `protected/triage.html`
- `protected/vaccination.html`
- `protected/ward-medicines.html`
- `server/access.mjs`
- `server/server.mjs`

**Suggested tests**

- `tests/app-shell-and-navigation.test.mjs`
- `tests/khmer-safety-net.test.mjs`
- `tests/v168-language-lab-print.test.mjs`
- `tests/v195-language-stock.test.mjs`
- `tests/v206-requests-language.test.mjs`
- `tests/v218-imaging-navigation-tabs.test.mjs`
- `tests/v227-khmer-voice-standard.test.mjs`
- `tests/v229-khmer-voice-online.test.mjs`
- `tests/v231-khmer-patient-names.test.mjs`
- `tests/v232-khmer-number-pronunciation.test.mjs`
- `tests/v233-khmer-exact-number-reading.test.mjs`
- `tests/v253-top-nav-tab-style-modality-buttons.test.mjs`
- `tests/v256-khmer-default-invoice-and-en-print.test.mjs`
- `tests/v282-khmer-invoice-service.test.mjs`
- `tests/v284-khmer-messages-admission-structured-view.test.mjs`
- `tests/v286-patient-photo-and-smart-navigation.test.mjs`
- `tests/v294-khmer-numbers-convert.test.mjs`
- `tests/v306-refined-lab-form-and-khmer-ui.test.mjs`
- `tests/v328-symptom-language-display.test.mjs`
- `tests/v350-nationality-single-language.test.mjs`
- `tests/v354-nursing-khmer-and-remove-ambulance.test.mjs`
- `tests/v369-hef-msg-and-od-khmer.test.mjs`
- `tests/v372-navigation-performance.test.mjs`
- `tests/v373-language-performance.test.mjs`
- `tests/v374-language-observer.test.mjs`
- `tests/v375-khmer-pure-performance.test.mjs`
- `tests/v376-no-language-buttons.test.mjs`
- `tests/v398-side-navigation.test.mjs`

**Workflow verification**

- All role menus; desktop/mobile; KH/EN; form save and print; no accidental cross-module CSS changes.

## Database, configuration and hosting (`platform`)

Example branch: `feature/platform-describe-change`

**Primary files**

- `.dockerignore`
- `.env.example`
- `Dockerfile`
- `server/backup.mjs`
- `server/config.mjs`
- `server/database.mjs`
- `server/persistent-data.mjs`
- `server/router.mjs`
- `server/server.mjs`

**Shared dependencies**

- `server/routes/admin.mjs`
- `server/routes/auth.mjs`
- `server/routes/clinical-summary.mjs`
- `server/routes/clinical.mjs`
- `server/routes/finance.mjs`
- `server/routes/maternal.mjs`
- `server/routes/medication-safety.mjs`
- `server/routes/messages.mjs`
- `server/routes/npca.mjs`
- `server/routes/paraclinic.mjs`
- `server/routes/patients.mjs`
- `server/routes/periop-forms.mjs`
- `server/routes/pharmacy.mjs`
- `server/routes/queue.mjs`
- `server/routes/record-access.mjs`

**Suggested tests**

- `tests/v381-auth-production-security.test.mjs`
- `tests/v424-hosting.test.mjs`

**Workflow verification**

- Backup/restore in disposable data; startup and migrations; static asset routes; persistent volume; existing tests.

## Git workflow and developer documentation (`development`)

Example branch: `feature/development-describe-change`

**Primary files**

- `docs/development/BRANCHING_GUIDE.md`
- `docs/development/MODULE_MAP.md`
- `docs/development/modules.json`
- `scripts/emr-branch-lib.mjs`
- `scripts/emr-branch.mjs`
- `tests/emr-branch.test.mjs`

**Shared dependencies**

- `AGENTS.md`
- `CHANGELOG.md`
- `package.json`

**Suggested tests**

- `tests/emr-branch.test.mjs`

**Workflow verification**

- Create branch in disposable Git repository; reject dirty/stale checkout; review committed/staged/untracked changes; verify runtime files unchanged.

