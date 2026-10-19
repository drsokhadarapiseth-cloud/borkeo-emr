# Test Baseline (Phase 0: Safety Net)

Baseline test run recorded: 2026-10-19T05:36:01.488Z

- **Total Tests Run**: 900+ (approx 1,100 runner steps)
- **Total Failing Tests**: 198
- **Total Passing Tests**: approx 703

*(Note: The user review noted 209 failing tests; this baseline run measured exactly 198 failing tests)*

## Primary Categories of Test Failures

1. **Version consistency checks (`vXX.X - Version metadata consistency...`)**: Tests hardcoded to check specific older version strings (e.g. `12.0`, `19.4`, `37.0.0` vs current `38.0.0`).
2. **Windows Path Asserts**: Tests asserting paths like `d:/EMR/Borkeo_EMR_v20.3/...`.
3. **Hardcoded HTML/CSS strings**: Regular expressions and exact string matching against older markup.
4. **Authentication & Demo mode**: Tests expecting username-only authentication or specific legacy session behaviors.

## Detailed Failing Tests (198 tests)

### tests/auth.test.mjs (1 failing)
- **authenticated session opens the dashboard and protected clinical pages** (line 66)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /if \(!isDirectBedView\) \{[\s\S]*?switchPage\(1\);[\s\S]*?switchSubTab\('reg'\);`

### tests/demo-login.test.mjs (1 failing)
- **the local demo uses username-only accounts and cannot access the patient database** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v2[0-9]\./. Input:`

### tests/opd-paraclinic-prepayment.test.mjs (1 failing)
- **Triage-marked OPD paraclinic orders combine consultation and test fees, then unlock the doctor after results** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly deep-equal:`

### tests/opd-prepayment-ui-v126.test.mjs (1 failing)
- **v12.6 OPD pre-payment review keeps the OPD form visible but locks clinical input** (line 7)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /setReadonly\(outpatient, !\['ADMIN','VICE_DIRECTOR','DOCTOR'\]\.includes\(role\)`

### tests/opd-queue-dispensing.test.mjs (1 failing)
- **triage numbers OPD referrals once, doctors see the alert, and Pharmacy confirms only the latest prescription** (line 7)
  - Error: `AssertionError [ERR_ASSERTION]: name attribution works without a drawn signature`

### tests/triage-ui.test.mjs (1 failing)
- **v12.0 keeps case selection in Registration and splits Triage waiting/completed UI** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /role === 'TRIAGE' && \[1,2\]\.includes/. Input:`

### tests/v1200-release.test.mjs (4 failing)
- **v12.0 Patient List exposes eye, edit and delete actions with contact, payment and discharge details** (line 10)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /patient-list\.js\?v=3090/. Input:`
- **v12.0 Registration captures queue number and OPD/Triage surfaces it** (line 27)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /emr-patient-record\.js\?v=2900/. Input:`
- **v19.4 keeps cashier-first OPD handoffs and the bilingual support and print updates** (line 71)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`
- **v13.0 demo patients contain complete registration data and real names** (line 166)
  - Error: `AssertionError [ERR_ASSERTION]: Missing scope:registration:id:web_diag_in`

### tests/v127-queue-paraclinic.test.mjs (1 failing)
- **v12.7 paraclinic UI has duplicate locks and delete controls** (line 29)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /data-remove-test/. Input:`

### tests/v130-responsive.test.mjs (1 failing)
- **v13.2 includes the responsive layout layer on all application pages** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /responsive-layout\.css\?v=1310/. Input:`

### tests/v136-fees-appointments.test.mjs (1 failing)
- **v13.6 manages appointments, department fees, and approved exchange rates** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: cashiers only see services in the replacement fee schedule`

### tests/v140-cashier-ui.test.mjs (1 failing)
- **v14.4 Cashier shows itemized charges, unpaid removal, and invoice print actions** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: print-bill`

### tests/v142-official-fees.test.mjs (1 failing)
- **v14.6 installs the workbook fee schedule and confirmed eye-care fees once** (line 7)
  - Error: `AssertionError [ERR_ASSERTION]: ECG`

### tests/v155-opd-transfer-alerts.test.mjs (1 failing)
- **OPD can transfer to every IPD ward and settled OPD payment alerts the shared doctor inbox** (line 10)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v168-language-lab-print.test.mjs (2 failing)
- **v19.7 shows stable KH and EN controls throughout the app while Paraclinic defaults to Khmer** (line 10)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`
- **v19.4 uses an English laboratory print header and shaded category band** (line 34)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /imaging\.js\?v=1970/. Input:`

### tests/v170-invoice-moul.test.mjs (1 failing)
- **v19.4 uses Moul for the Khmer hospital and payment-invoice headings** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v182-cashier-delete.test.mjs (1 failing)
- **cashier removes only an unpaid service, preserves its audit history and other invoices, and can add a replacement** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v187-followup-icd10.test.mjs (1 failing)
- **doctor JSON follow-ups persist their ICD-10 source and nursing cannot overwrite it** (line 37)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v190-service-list-assets.test.mjs (1 failing)
- **Director service list loads its aligned styling from the actual served billing page** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /build=2[0-9]\./. Input:`

### tests/v191-registration-appointments.test.mjs (2 failing)
- **registration form has the new screen/print titles and retains save and continue after removing its redundant tab** (line 28)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`
- **Registration appointment page serves its linked script through the actual server** (line 41)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /build=2[0-9]\./. Input:`

### tests/v195-language-stock.test.mjs (1 failing)
- **language defaults to Khmer and stays independent across lab, imaging and EMR views** (line 15)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v203-lab-reference.test.mjs (1 failing)
- **v20.3 lab staff can edit ranges with CSRF but cannot rename, create or delete tests; management editing remains available** (line 106)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /lab\.js\?v=2030&build=2[0-9]\./. Input:`

### tests/v205-imaging-signatures.test.mjs (1 failing)
- **v20.5 imaging hierarchy presents status filters as sub-buttons of specific procedures and shares identical unified styles** (line 24)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /data-modality=""/. Input:`

### tests/v206-requests-language.test.mjs (1 failing)
- **v20.6 requests page uses pure Khmer defaults, supports dynamic bilingual translation, and standardizes toolbar buttons** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\.[0-9]\.\d+/. Input:`

### tests/v207-ui-cleanups.test.mjs (1 failing)
- **v20.7 version step consistency across package.json, login.html, and server.mjs** (line 48)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\.[0-9]\.\d+/. Input:`

### tests/v208-bed-transfer.test.mjs (1 failing)
- **v20.8 version step consistency across package.json, login.html, and server.mjs** (line 26)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\.[0-9]\.\d+/. Input:`

### tests/v209-bed-modal.test.mjs (1 failing)
- **v20.9 version step consistency across package.json, login.html, and server.mjs** (line 22)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\.[0-9]\.\d+/. Input:`

### tests/v210-banner-patient-list.test.mjs (1 failing)
- **v21.0 version step consistency across package.json, login.html, and server.mjs** (line 30)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v211-patient-list-noborder.test.mjs (2 failing)
- **v21.1 patient list ID button has explicit inline style reset and cache-busted assets** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /src="\/public\/patient-list\.js\?v=3090"/. Input:`
- **v21.1 version step consistency across package.json, login.html, and server.mjs** (line 18)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v212-department-buttons.test.mjs (1 failing)
- **v21.2 version step consistency across package.json, login.html, and server.mjs** (line 16)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v213-requests-toolbar-signatures.test.mjs (1 failing)
- **v21.3 version step consistency across package.json, login.html, and server.mjs** (line 33)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v214-queue-toolbar.test.mjs (1 failing)
- **v21.4 version step consistency across package.json, login.html, and server.mjs** (line 24)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v215-pharmacy-stock-catalog.test.mjs (1 failing)
- **v21.5 version step consistency across package.json, login.html, and server.mjs** (line 80)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v216-lab-material-catalog.test.mjs (1 failing)
- **v21.6 version step consistency across package.json, login.html, and server.mjs** (line 99)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v217-imaging-film-stock.test.mjs (1 failing)
- **v21.7 version step consistency across package.json, login.html, and server.mjs** (line 112)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v218-imaging-navigation-tabs.test.mjs (3 failing)
- **v21.8 imaging toolbar in stock.html renders all modality tabs with active highlight on film tab** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: stock.html has Ultrasound link`
- **v21.8 imaging.html toolbar tabs and imaging.js query param support** (line 17)
  - Error: `AssertionError [ERR_ASSERTION]: imaging.html has tab-materials class`
- **v21.8 version step consistency across package.json, login.html, and server.mjs** (line 29)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v219-imaging-status-subtabs.test.mjs (2 failing)
- **v21.9 imaging.html has 6 main procedure tabs and 5 status sub-tabs without PERFORMED** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: has All modality tab`
- **v21.9 version step consistency across package.json, login.html, and server.mjs** (line 29)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v220-imaging-two-tier-toolbar.test.mjs (1 failing)
- **v22.0 version step consistency across package.json, login.html, and server.mjs** (line 23)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v221-banner-logo-blue.test.mjs (1 failing)
- **v22.1 version step consistency across package.json, login.html, and server.mjs** (line 16)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v222-mobile-lan-access.test.mjs (1 failing)
- **v22.2 version step consistency across package.json, login.html, and server.mjs** (line 21)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v223-mobile-screen-fit.test.mjs (1 failing)
- **v22.3 version step consistency across package.json, login.html, and server.mjs** (line 20)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v224-auto-desktop-mode.test.mjs (1 failing)
- **v22.4 version step consistency across package.json, login.html, and server.mjs** (line 23)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v225-indigo-modern-queue.test.mjs (1 failing)
- **v22.5 version step consistency across package.json, login.html, and server.mjs** (line 36)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v226-queue-speech-chime.test.mjs (1 failing)
- **v22.6 version step consistency across package.json, login.html, and server.mjs** (line 15)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v227-khmer-voice-standard.test.mjs (1 failing)
- **v22.7 version step consistency across package.json, login.html, and server.mjs** (line 17)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v228-queue-clean-screen.test.mjs (2 failing)
- **v22.8 queue display completely suppresses language switcher and stray headers** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: emr-language.js suppresses switcher on queue display`
- **v22.8 version step consistency across package.json, login.html, and server.mjs** (line 18)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v229-khmer-voice-online.test.mjs (1 failing)
- **v22.9 version step consistency across package.json, login.html, and server.mjs** (line 16)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(22\.9|2[3-9]\.)/. Input:`

### tests/v230-queue-tts-proxy.test.mjs (1 failing)
- **v23.0 version step consistency across package.json, login.html, and server.mjs** (line 19)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[3-9]\./. Input:`

### tests/v231-khmer-patient-names.test.mjs (1 failing)
- **v23.1 version step consistency across package.json, login.html, and server.mjs** (line 17)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v232-khmer-number-pronunciation.test.mjs (1 failing)
- **v23.2 version step consistency across package.json, login.html, and server.mjs** (line 15)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v233-khmer-exact-number-reading.test.mjs (1 failing)
- **v23.3 version step consistency across package.json, login.html, and server.mjs** (line 85)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v234-queue-bell-recall-and-chimes.test.mjs (1 failing)
- **v23.4 version step consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v235-gentle-welcome-bell-and-controls.test.mjs (1 failing)
- **v23.5 version step consistency across package.json, login.html, and server.mjs** (line 35)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v236-violet-theme-5row-queue.test.mjs (1 failing)
- **v23.6 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v237-hide-reg-clinic-and-header.test.mjs (1 failing)
- **v23.7 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v238-queue-flow-refinement.test.mjs (1 failing)
- **v23.8 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v239-remove-triage-requests-tab.test.mjs (1 failing)
- **v23.9 version step consistency across package.json, login.html, and server.mjs** (line 7)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[0-9]\./. Input:`

### tests/v240-chief-complaint-spacing.test.mjs (2 failing)
- **v24.0 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^24\./. Input:`
- **v24.0 EMR.html includes vertical spacing for chief complaint above department table** (line 17)
  - Error: `AssertionError [ERR_ASSERTION]: has spacing wrapper around chief complaint`

### tests/v241-login-simulation-accounts.test.mjs (1 failing)
- **v24.1 version step consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^24\./. Input:`

### tests/v242-context-page-clean.test.mjs (2 failing)
- **v24.2 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^24\./. Input:`
- **v24.2 context.html removes logout button and suppresses language switcher** (line 17)
  - Error: `AssertionError [ERR_ASSERTION]: emr-language.js suppresses switcher on context page`

### tests/v243-home-dashboard-reports.test.mjs (2 failing)
- **v24.3 version step consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^24\./. Input:`
- **v24.3 protected/home.html contains 7 metric cards container, report panels, and removes old module-grid** (line 20)
  - Error: `AssertionError [ERR_ASSERTION]: Home JS has admissions card`

### tests/v244-custom-roles-wards-clean-home.test.mjs (1 failing)
- **v24.4 version step consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^24\./. Input:`

### tests/v245-ipd-discharge-top-diagnoses.test.mjs (1 failing)
- **v24.5 version step consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^24\./. Input:`

### tests/v246-single-row-metrics.test.mjs (1 failing)
- **v24.6 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^24\./. Input:`

### tests/v247-clean-reports-ward-scope-requests.test.mjs (1 failing)
- **v24.7 version step consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^24\./. Input:`

### tests/v248-specialist-imaging-subtypes-and-signatures.test.mjs (1 failing)
- **v24.8 version step consistency across package.json and login.html** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[4-8]\./. Input:`

### tests/v249-imaging-dropdown-english-specialties.test.mjs (1 failing)
- **v24.9 version step consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^2[4-8]\./. Input:`

### tests/v250-signature-above-line.test.mjs (1 failing)
- **v25.0 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^25\./. Input:`

### tests/v251-imaging-group-dropdown-buttons.test.mjs (1 failing)
- **v25.1 version step consistency across package.json, login.html, and server.mjs** (line 7)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^25\./. Input:`

### tests/v252-uniform-group-buttons-and-dropdown-fix.test.mjs (1 failing)
- **v25.2 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^25\./. Input:`

### tests/v253-top-nav-tab-style-modality-buttons.test.mjs (1 failing)
- **v25.3 version step consistency across package.json, login.html, and server.mjs** (line 7)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^25\./. Input:`

### tests/v254-single-row-toolbar-resizing.test.mjs (1 failing)
- **v25.4 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^25\./. Input:`

### tests/v255-imaging-films-unified-toolbar.test.mjs (1 failing)
- **v25.5 version step consistency across package.json, login.html, and server.mjs** (line 7)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^25\./. Input:`

### tests/v256-khmer-default-invoice-and-en-print.test.mjs (2 failing)
- **v25.6 billing.html contains default Khmer invoice and dedicated Print EN Invoice buttons** (line 20)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /<button id="print-bill"[^>]*>បោះពុម្ពវិក្កយបត្រ<\/button>/. Input:`
- **v25.6 billing.js implements bilingual invoice generation with Khmer default and English print** (line 35)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /data-history-print-en=/. Input:`

### tests/v257-professional-paraclinic-buttons.test.mjs (2 failing)
- **v25.7 version step consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^25\./. Input:`
- **Paraclinic request modal retains grouped Imaging procedures with a full-width trigger** (line 20)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v258-home-report-box-labels.test.mjs (1 failing)
- **v25.8 version step consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^25\./. Input:`

### tests/v259-home-report-box-unbracketed-labels.test.mjs (1 failing)
- **v25.9 version step consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^25\./. Input:`

### tests/v261-department-report-styles.test.mjs (3 failing)
- **v26.1 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`
- **v26.1 protected/home.html provides department view tabs and separate OPD/IPD styles** (line 17)
  - Error: `AssertionError [ERR_ASSERTION]: Overview tab present`
- **v26.1 public/home.js implements department switching and separate OPD/IPD rendering** (line 28)
  - Error: `AssertionError [ERR_ASSERTION]: department tab handling present in home.js`

### tests/v262-no-duplicate-opd-report.test.mjs (1 failing)
- **v26.2 version step consistency across package.json, login.html, and server.mjs** (line 6)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^26\./. Input:`

### tests/v263-professional-button-styles.test.mjs (1 failing)
- **v26.3 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v264-sub-button-capsule-style.test.mjs (1 failing)
- **v26.4 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v265-combined-home-reports-no-tabs.test.mjs (1 failing)
- **v26.5 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v266-move-cashflow-to-management-home.test.mjs (1 failing)
- **v26.6 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v267-opd-payment-status-on-home.test.mjs (1 failing)
- **v26.7 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v268-opd-queue-button-and-rename.test.mjs (1 failing)
- **v26.8 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v2[6-8]\./. Input:`

### tests/v269-pharmacy-queue-button-and-display.test.mjs (1 failing)
- **v26.9 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v2[6-8]\./. Input:`

### tests/v270-remove-triage-skip-button.test.mjs (1 failing)
- **v27.0 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v(?:27\.|28\.|32\.|33\.|34\.|35\.)/. Input:`

### tests/v271-professional-cashflow-report.test.mjs (1 failing)
- **v27.1 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v(?:27\.|28\.)/. Input:`

### tests/v272-single-unified-finance-table.test.mjs (1 failing)
- **v27.2 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(?:27\.|28\.)/. Input:`

### tests/v273-finance-period-range-reports.test.mjs (1 failing)
- **v27.3 version step consistency across package.json, login.html, and server.mjs** (line 7)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(?:27\.|28\.)/. Input:`

### tests/v274-sleek-segmented-period-selector.test.mjs (1 failing)
- **v27.4 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(?:27\.|28\.)/. Input:`

### tests/v275-rename-interface-button.test.mjs (1 failing)
- **v27.5 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(?:27\.[5-9]|28\.)/. Input:`

### tests/v276-nested-imaging-role-subtypes.test.mjs (1 failing)
- **v27.6 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(?:27\.[6-9]|28\.)/. Input:`

### tests/v277-direct-imaging-modality-selection.test.mjs (1 failing)
- **v27.7 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(?:27\.[7-9]|28\.)/. Input:`

### tests/v280-admission-form-updates.test.mjs (1 failing)
- **v28.0 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v28\./. Input:`

### tests/v281-doctor-print-signatures.test.mjs (1 failing)
- **v28.1 version step consistency across package.json, login.html, and server.mjs** (line 5)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v28\./. Input:`

### tests/v282-khmer-invoice-service.test.mjs (1 failing)
- **v28.2 version step consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v283-admission-routing-diagnosis.test.mjs (1 failing)
- **v28.3 version step consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v284-khmer-messages-admission-structured-view.test.mjs (1 failing)
- **v28.4 version step consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v285-bulk-approve-executive-requests.test.mjs (2 failing)
- **v28.5 version step consistency across package.json, login.html, and server.mjs** (line 13)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`
- **v28.5 requests schema supports PATIENT_EDIT, PATIENT_DELETE, and bulk approval workflow** (line 24)
  - Error: `Error: no such table: pharmacy_prescriptions`

### tests/v286-patient-photo-and-smart-navigation.test.mjs (3 failing)
- **v28.6 version step consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`
- **v28.6 EMR.html includes photo assets, registration avatar trigger, and OPD/IPD banners** (line 26)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`
- **v28.6 patient-list routes OPD to opd view and IPD appropriately by clinical role** (line 36)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v288-ipd-medical-record-access.test.mjs (2 failing)
- **current release version consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`
- **v28.8 access.mjs allows doctor cross-ward access and enforces nurse ward scope** (line 20)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v293-registration-direct-edit.test.mjs (1 failing)
- **v29.3 patient-list.js: registration account edits directly without management approval** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /const editTitle =/. Input:`

### tests/v296-registration-layout.test.mjs (1 failing)
- **v29.6 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v297-registration-cards-position.test.mjs (1 failing)
- **v29.7 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(29\.[789]|30\.\d+)\./. Input:`

### tests/v298-remove-admission-approval-panel.test.mjs (1 failing)
- **v29.8 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(29\.[89]|30\.\d+)\./. Input:`

### tests/v299-triage-header-and-thirty-patients.test.mjs (1 failing)
- **v29.9 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /^(29\.9|30\.\d+)\./. Input:`

### tests/v302-registration-sex-photo-and-patient-list.test.mjs (1 failing)
- **v30.2 thirty patients in demo.sqlite have full age, sex, and photo data** (line 55)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v303-triage-and-edit-photo-sync.test.mjs (1 failing)
- **v30.3 thirty patients in demo.sqlite have full age, sex, and valid Base64 JPEG photo data** (line 46)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v304-lab-imaging-master-detail-and-activation.test.mjs (1 failing)
- **v30.4 thirty patients in demo.sqlite preserve demographic and photo integrity** (line 102)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v307-cashier-history-discharge-and-photo-auto-apply.test.mjs (3 failing)
- **v30.7 version consistency in package.json and login.html** (line 21)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`
- **v30.7 cashier invoice direct edit vs discharge lock logic in disposable database** (line 41)
  - Error: `Error: ការកែវិក្កយបត្រត្រូវការសំណើអនុម័ត។ មិនអាចកែដោយផ្ទាល់បានទេ។`
- **v30.7 UI files contain auto-apply photo and cashier invoice history requirements** (line 178)
  - Error: `AssertionError [ERR_ASSERTION]: billing.js must support direct editing when not discharged`

### tests/v308-cashier-header-icd10-and-mgmt-history.test.mjs (2 failing)
- **current release version consistency in package.json, login.html, and server.mjs** (line 14)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`
- **v30.8 cashier eye icon redirects to billing history and server route redirect** (line 49)
  - Error: `AssertionError [ERR_ASSERTION]: patient-list.js must detect cashier roles`

### tests/v309-release-catchup.test.mjs (1 failing)
- **fixed paper checklist excludes inactive codes and disables already ordered tests** (line 44)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /alert\(err.message/. Input:`

### tests/v310-merge-payment-category-button.test.mjs (1 failing)
- **v31.0 release version consistency across package.json, login.html, and server.mjs** (line 14)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v311-photo-camera-badge-on-frame.test.mjs (1 failing)
- **v31.1 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v312-compact-photo-modal-no-scroll.test.mjs (1 failing)
- **v31.2 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v313-rename-flip-camera-button.test.mjs (1 failing)
- **v31.3 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v314-remove-patient-context-summary-boxes.test.mjs (1 failing)
- **v31.4 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v315-opd-to-ipd-bed-assignment-fix.test.mjs (1 failing)
- **v31.5 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v316-rename-patient-code-and-autofill.test.mjs (1 failing)
- **v31.6 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v317-triage-layout-spacing-and-save-button.test.mjs (1 failing)
- **v31.7 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v318-triage-id-generation-and-json.test.mjs (1 failing)
- **v31.8 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v319-chief-complaint-tags-and-emergency-import.test.mjs (1 failing)
- **v31.9 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v320-chief-complaint-inline-input-and-separate-tags.test.mjs (1 failing)
- **v32.0 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v321-chief-complaint-same-row-layout.test.mjs (1 failing)
- **v32.1 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v3210-chief-complaint-fast-selection.test.mjs (1 failing)
- **v32.10 release version consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v(?:3[2-6]\.)/. Input:`

### tests/v3211-ipd-form-and-obgyn-history.test.mjs (1 failing)
- **v32.11 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v(?:3[2-6]\.)/. Input:`

### tests/v3212-ipd-clean-header-and-photo.test.mjs (1 failing)
- **v32.12 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v(?:3[2-6]\.)/. Input:`

### tests/v3213-rename-ipd-title.test.mjs (1 failing)
- **v32.13 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v(?:3[2-6]\.)/. Input:`

### tests/v322-chief-complaint-full-width-and-add-button.test.mjs (1 failing)
- **v32.2 release version consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v323-triage-glucose-and-meal-timing.test.mjs (1 failing)
- **v32.3 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v324-triage-glucose-separate-cell.test.mjs (1 failing)
- **v32.4 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v325-triage-print-button-and-form.test.mjs (1 failing)
- **v32.6 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: login.html must visibly display current version`

### tests/v326-triage-vertical-metadata-and-encounter-id.test.mjs (1 failing)
- **v32.6 version bump in package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v(?:3[2-6]\.)/. Input:`

### tests/v328-symptom-language-display.test.mjs (1 failing)
- **v32.8 release version consistency across package.json, login.html, and server.mjs** (line 10)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v(?:3[2-6]\.)/. Input:`

### tests/v329-chief-complaint-blue-styling.test.mjs (1 failing)
- **v32.9 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v(?:3[2-6]\.)/. Input:`

### tests/v332-triage-button-and-hef-dialog.test.mjs (1 failing)
- **v33.2 release version consistency across package.json, login.html, and server.mjs** (line 10)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v333-patient-card-and-id-formats.test.mjs (1 failing)
- **v33.3 version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v334-card-label-ruler-and-multi-print.test.mjs (1 failing)
- **v33.4 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v335-configurable-sticker-size-and-single-page.test.mjs (1 failing)
- **v33.5 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v336-isolated-print-frame.test.mjs (1 failing)
- **v33.6 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v337-auto-case-and-health-id-generation.test.mjs (1 failing)
- **v33.7 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v338-restore-patient-card-print-modal.test.mjs (1 failing)
- **v33.8 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v339-scale-persistence-and-sticker-text-fit.test.mjs (1 failing)
- **v33.9 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v340-single-page-a4-ten-stickers.test.mjs (1 failing)
- **v34.0 release version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v342-nssf-member-verification.test.mjs (1 failing)
- **v34.2 release version consistency across package.json, login.html, and server.mjs** (line 29)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v344-nssf-member-name-popup.test.mjs (1 failing)
- **v34.4 release version consistency across package.json, login.html, server.mjs, and EMR.html** (line 36)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v345-patient-photo-modal-fix.test.mjs (1 failing)
- **v34.5 release version consistency across package.json, login.html, server.mjs, and EMR.html** (line 10)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v346-disability-label-rename.test.mjs (1 failing)
- **v34.6 release version consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v347-ethnicity-nationality-dropdown.test.mjs (1 failing)
- **v34.7 release version consistency across package.json, login.html, and server.mjs** (line 10)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v348-a5-patient-stickers.test.mjs (1 failing)
- **v34.8/v34.9 release version consistency across package.json, login.html, and server.mjs** (line 18)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v350-nationality-single-language.test.mjs (1 failing)
- **v35.0 release version consistency across package.json, login.html, and server.mjs** (line 10)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v351-case-reg-triage-sync-and-button-style.test.mjs (1 failing)
- **v35.1 version consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v352-sticker-gap-customization.test.mjs (1 failing)
- **v35.2 version consistency across package.json, login.html, and server.mjs** (line 17)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v353-editable-sticker-count.test.mjs (1 failing)
- **v35.3 version consistency across package.json, login.html, and server.mjs** (line 17)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v354-nursing-khmer-and-remove-ambulance.test.mjs (1 failing)
- **v35.4 version consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v355-triage-dropdown-hef-and-coverage-area.test.mjs (1 failing)
- **v35.5 version consistency in package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v356-triage-contraception-and-hef-code.test.mjs (1 failing)
- **v35.6 - Version metadata consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v357-triage-auto-plot-docking-and-edit-button.test.mjs (1 failing)
- **v35.7 - Version metadata consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v358-remove-docked-badge-notifications.test.mjs (1 failing)
- **v35.8 - Version metadata consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v359-triage-edit-button-state-and-locking.test.mjs (1 failing)
- **v35.9 - Version metadata consistency across package.json, login.html, and server.mjs** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v360-http-compression-and-performance-caching.test.mjs (2 failing)
- **v36.0 - Version metadata consistency across package.json, login.html, and server.mjs** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`
- **v36.0 - HTTP Gzip compression, ETag conditional 304, and static asset caching** (line 44)
  - Error: `AssertionError [ERR_ASSERTION]: The input did not match the regular expression /v36\.[0-9]/. Input:`

### tests/v361-smart-polling-and-batch-query-performance.test.mjs (1 failing)
- **v36.1 - Version metadata consistency across package.json, login.html, and server.mjs** (line 10)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v362-triage-patient-list-actions.test.mjs (2 failing)
- **v36.2 - Version metadata consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`
- **v36.2 - public/patient-list.js customizes View, Edit, and Delete for TRIAGE role** (line 20)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v363-speed-and-patient-summaries.test.mjs (2 failing)
- **v36.3 - Version metadata consistency across package.json, login.html, and server.mjs** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`
- **v36.3 - Script cache buster tags across templates use ?v=3630 or ?v=3640** (line 87)
  - Error: `AssertionError [ERR_ASSERTION]: patient-list.html must cache-bust`

### tests/v364-performance-and-triage-workflow.test.mjs (1 failing)
- **v36.4 - Version metadata consistency across package.json, login.html, server.mjs and templates** (line 11)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v365-triage-free-edit.test.mjs (2 failing)
- **v36.5 - Version metadata consistency across package.json, login.html, server.mjs and templates** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`
- **v36.5 - server/server.mjs merges triage data across clinical roles when saving triage** (line 58)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v366-triage-services-and-photo-workflow.test.mjs (1 failing)
- **v36.6 - Version metadata consistency across package.json, login.html, server.mjs and templates** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v367-registration-caregiver-info.test.mjs (1 failing)
- **v36.7 - Version metadata consistency across package.json, login.html, server.mjs and templates** (line 9)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

### tests/v369-hef-msg-and-od-khmer.test.mjs (1 failing)
- **v36.9 - Version metadata consistency across package.json, login.html, server.mjs and templates** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: The expression evaluated to a falsy value:`

### tests/v370-bank-table-action-alignment.test.mjs (1 failing)
- **v37.0 - Version metadata consistency across package.json, login.html, server.mjs and templates** (line 8)
  - Error: `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal:`

