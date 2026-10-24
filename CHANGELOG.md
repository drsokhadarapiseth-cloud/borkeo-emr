## 43.6.0 - Patient list age display refinement (age only, no date of birth)

- Refine the patient list table so that the Age column displays only the age badge (e.g. `7 ឆ្នាំ`, `71 ឆ្នាំ`), omitting the date of birth (DOB) string.
- Provide a resilient fallback in `ageLabel()` to compute patient age from date of birth when `patient.age` is blank.
- Preserve 100% of data persistence, frozen storage keys, and Khmer-only interface text.

## 43.5.0 - Unified same-row registration action bar

- Unify the «រក្សាទុក» (Save) button and «បញ្ជូនទៅផ្នែកទ្រីយ៉ា» (Send to Triage) button in the same clean row at the bottom of the registration form (`#sub_reg`).
- Eliminate detached floating boxes below the card; encounter toolbar now mounts directly inside `#reg_action_bar` with coherent styling, status updates, and cancellation handling.
- Preserve 100% of data persistence, frozen storage keys, and authentic hospital paper printing templates.

## 43.4.0 - Clean registration interface (suppression of clinical top sections)

- Hide all clinical top sections (breadcrumbs, persistent patient banner, chart tabs, summary dashboard cards, consultation cards) for registration users (`REGISTRATION` role) and registration views (`/emr?view=register` / Page 1 `#sub_reg`).
- Registration staff see only the clean Patient Registration Form («ទម្រង់ចុះឈ្មោះអ្នកជំងឺ») right at the top of the screen without clinical distraction or layout clutter.
- Maintain complete data preservation, frozen storage keys, and authentic hospital paper print templates.

## 43.3.0 - Integrated clinical consultation and legacy form workspace

Seamlessly integrates the modern consultation workspace (vitals metric cards, HPI/PE, quick diagnosis & treatment plan, actions, tasks checklist) with the detailed clinical hospital forms:
- 3 View Modes with instant switching: «ទម្រង់រួមបញ្ចូលគ្នា» (Integrated Form - default), «ទម្រង់សង្ខេប» (Modern Compact View), and «ទម្រង់ពិស្ដារពេញលេញ» (Full Classic Form View).
- In Integrated View: Modern card displays at top, with TB Screening Matrix (ការពិនិត្យស្វែងរកជំងឺរបេង), ICD-10 multi-diagnosis picker, full medication prescription table (តារាងវេជ្ជបញ្ជាឱសថ), paraclinic investigation builder, and doctor e-signature embedded seamlessly below with unified rounded card styling.
- Two-way live synchronization across modern inputs and frozen legacy storage fields (`data-emr-transient` and `data-emr-no-save`).
- Dropdown action «បញ្ចូលវេជ្ជបញ្ជាទៅក្នុងផែនការ» formats prescribed medicines into the treatment plan notes.
- Quick return bar in classic view to switch back immediately.
- 100% preservation of authentic A4 paper printing templates and frozen patient data. See docs/ui-43.3.md.

## 43.2.0 - Modern patient record consultation workspace

Modern clinical consultation workspace matching requested UI design: 2-column consultation interface with chief complaint, vital signs metric cards, HPI, physical exam, diagnosis, treatment plan, NPCA certification toggle, and action buttons. Interactive tasks checklist widget tracking real-time documentation completion. Patient banner and 6 record navigation tabs. All existing clinical data, frozen storage keys, and paper printout templates preserved. See docs/ui-43.2.md for details.

## 43.1.0 - Compact clinical workspace

Shared navy/teal navigation, compact safety-aware patient header, expandable details and inline collapsible ANC tasks. Existing role permissions, clinical data and paper templates preserved. See docs/ui-43.1.md for validation and browser limitations.

## v43.0.0 - Scoped paraclinic access and role audit

- Enforce existing patient access for doctors creating or directly reading laboratory/imaging orders; keep Obstetric and Gynecology active contexts separate.
- Match direct specialist order and attachment reads to the modality restrictions already used by their worklists.
- Add synthetic cross-service, multi-ward selection, attachment and all-role menu/API regressions; inventory role contexts, 37 protected pages and API modules in docs/access-audit.md.
- Preserve existing emergency/transfer exceptions, permissions, clinical/financial logic and stored data. No migration. Broader master-task workflows and full action/print verification remain pending in docs/ai-handoff.

## v42.9.0 - Login and work-context recovery

- Disable work-context submission until the session is loaded; offer an explicit retry after network/server failures.
- Refresh cookie-bound CSRF before selection, recover expired sessions, and reject a selection if the browser account changed.
- Show safe Khmer errors for login/context failures without exposing backend exception text; retain backend authorization and CSRF enforcement.
- Make two legacy demo assertions seed isolated in-memory fixtures instead of opening a local demo database.
- Add synthetic behavior and explicit Chromium coverage. See docs/ai-handoff for verified scope and the remaining master requirements; this release does not complete the master task.

## v42.8.0 (NPCA v1.4 clinical payment-certification integration, disabled by default)
- Adds configurable NPCA endpoints, OAuth token cache/refresh, beneficiary selection and verified SPID links, official Excel reference mappings, local visit payload validation, durable authorized submission queue, retry/reconciliation, processing-status polling and review pages.
- Adds optional NPCA assessment/referral fields, record/Billing status badges, and small server-authenticated metadata on changed daily notes. Existing clinical, stock and financial calculations are preserved.
- No real patient data sent during development; synthetic mock tests cover authentication, eligibility, payloads, permissions, retries, polling and resubmission. External NPCA acceptance and documented source discrepancies remain pending: docs/npca/INTEGRATION.md and OPEN-QUESTIONS.md.
- Uses four workers for the regression suite's shared synthetic demo fixture. No new runtime packages.

## v42.7.0 (Automatic patient ID card preview after registration)
- Saving a new registration opens the existing patient card preview with a QR code containing the saved Patient ID. Printing remains manual. Closing the preview continues the normal registration navigation. Failed saves and existing patient edits do not trigger it.
- Preserves the existing card layout, patient numbering, clinical logic and stored patient data.

# Borkeo EMR Changelog

## v42.6.0 (Midwife maternal services and the official ANC record)
- Routing: ANC (anc), PNC (pnc), family planning (family-planning) and cervical screening (cervix-screening) go Registration -> Triage -> Cashier -> midwife; vaccination (vaccination) goes Triage -> midwife directly and is free (no Cashier); safe abortion (safe-abortion) goes to the Gynecology ward queue instead of the OPD doctor. All of them stay counted as OPD services in reports.
- New page "បញ្ជីអ្នកជំងឺសេវាមាតា" for the MIDWIFE of the Obstetric ward (public/nav-config.js group care, server/access.mjs roleCanPage): today's paid ANC / PNC / family planning / cervical screening patients and vaccination patients, with a call button like the OPD queue. Opening a patient opens the right form. Real midwife accounts and the Superuser switched to Midwife both see it.
- Official ANC record (/anc-record, protected/anc-record.html): one record per pregnancy, linked to the Health ID, opened at the first ANC visit and reused at every visit until delivery, referral to CPA3 or closing. Pages 2-5 of the 2026 record (identity, LMP, EDD, height, weight and BMI before pregnancy; general, surgical, drug allergy, family, gynaecological and social history; risk factors; mouth and teeth; anaemia; previous pregnancies with the 10 complications of the page-2 footnote; lab table by date; ultrasound table; visit table) print in the official A4 landscape layout with the colour box ticked. The Khmer labels are read from server/catalogues/anc-record-labels.json. Old ANC forms (#sub_anc) stay readable, read-only, with a link to the new record; saved values are never rewritten.
- Auto-fill, always editable and never overwriting what the midwife typed: name, date of birth and age from Registration; weight, height, BP, pulse, temperature and SpO2 from the Triage of the same visit; BMI, weight gain, GA and EDD calculated; midwife name from the login; tetanus vaccination from the vaccination page. Released Laboratory results fill the lab table and released Imaging reports the ultrasound table; the midwife's own rapid tests (HIV, syphilis, Hb) are typed in the visit and appear in the lab table too.
- GA and EDD: from the LMP (EDD = LMP + 280 days); a dating ultrasound before 14 weeks whose EDD differs by more than 7 days is used instead, and the source is always shown.
- Colour code from server/catalogues/anc-color-chart.json (copied unchanged, 69 items in 4 sections): the "auto" items decide from the data, the others are tick boxes, the highest level wins, re-checked at every visit and every save. The official boxes បៃតង / លឿង / ក្រហម show at the top of the record and as a badge in the patient banner on every page; every colour change is kept with its date, reasons and author.
- Visit schedule from server/catalogues/anc-visit-schedule.json (green 4 visits, page 7; yellow and red 8 visits, page 8): which visit this is, its tasks as check items, overdue tasks from earlier visits in red, and "not a scheduled visit" between visits. A task acts: the midwife's own tests open the result field, HBsAg / OGTT / CBC / ultrasound create the order (paid at the Cashier), iron and folic acid add the prescription, tetanus opens the vaccination entry. The to-do list is a side panel always visible and also opens once when the record opens; closing a task undone needs a reason (មិនមានតេស្ត / អ្នកជំងឺបដិសេធ / ធ្វើរួចនៅកន្លែងផ្សេង / ផ្សេងៗ). The next appointment is suggested from the schedule for the colour and can be changed.
- Yellow shows "ANC continues at Borkeo Referral Hospital (CPA2), 8 visits". Red shows the referral button: a DOCTOR or CHIEF_WARD of Obstetric or Gynecology signs it with the existing e-signature, the referral letter prints (letterhead, patient, GA, colour and red reasons, vital signs, test results, treatment given, signature line) and the visit is marked referred to CPA3 for reports. The layout (public/anc-referral-letter.mjs) is kept easy to replace by the official form.
- Midwife permissions: she opens and saves the forms of these patients (server/encounter-access.mjs), orders HBsAg from the Laboratory and ultrasound from Imaging and nothing else (server/routes/paraclinic.mjs), and may prescribe only ferrous salt, ferrous salt + folic acid, folic acid, mebendazole, calcium and the vaccines of the vaccination service (the medicine search is filtered for her in these services).
- Vaccination page (/vaccination): all ages, free, the vaccine chosen from the medicine list lines marked vaccine, with dose number, date, batch number, injection site, next appointment and reaction. Each dose is deducted from stock (reference = the vaccination id); the same vaccine and dose number twice gives a warning; tetanus given to a pregnant woman also appears in the visit table of her ANC record. History per Health ID with the next appointment and a printable vaccination card section.
- Cervical screening: the midwife sends the result to the Gynecology ward doctors' inbox (existing staff messages, with the patient link) and the doctor's acknowledgement completes the message. The send button no longer needs the required fields of the whole OPD consultation to be filled first: it saves nothing into the record (data-required-bypass in public/maternal-emr.js), it checks its own result field, and the server checks the role.
- Safe abortion is billed under Gynecology; old safe abortion records stay readable.
- Defaults the owner may change later are kept together in server/clinical-options.json (chart gaps for age 18-19 and 35, height under 145 cm, BMI, BP, number of births, twins as red; the visit window of +/- 1 week for the single-week visits 26, 36, 38 and 40; the paid and free service codes; the midwife's medicines).
- Khmer: the record, chart and schedule text is copied from borkeo-update-files/anc/ and never retyped from memory; the words that could not be read with certainty on the page images are listed for the owner in docs/anc-khmer-to-confirm.md. Other new texts are in docs/translations-needed.csv marked "draft Khmer, owner to review".
- Tests: tests/v426-midwife-anc.test.mjs (new, 10 checks: queues, midwife orders and medicines, one record per pregnancy across visits, EDD and the ultrasound EDD, the colour cases, the schedule, the task reason, the signed referral, the cervical message, the vaccination stock and the Gynecology queue); tests/v426-midwife-anc-browser.mjs (explicit browser check with synthetic green, yellow and red pregnancies across visits, a vaccination, a cervical screening and a safe abortion); tests/accessibility-quality-smoke.test.mjs expects 42.6.0.

## v42.5.0 (Medicine list in two steps, filtered for the patient; maximum dose check for adults and children)
- Medicine list: server/catalogues/medicines-eml-2024.json is now the owner's new file (704 lines, 339 medicine names, with other names, route, adult / child / women-only / newborn-only marks, age limits and notes). Names no longer carry the other name in brackets ("Paracetamol", other name "acetaminophen").
- Two-step search in every prescription form (OPD, IPD admission and protocol rows, daily note, discharge): step 1 shows each medicine name once (name, other names, CMS code; "para" shows only Paracetamol, "acetam" also finds it, "cotrim" finds Sulfamethoxazole + trimethoprim); step 2 shows its forms and strengths as "CMS code · Form · Strength" with any note as an orange line (⚠ កុមារ៖ ..., ⚠ មនុស្សពេញវ័យ៖ ...). A single allowed line is chosen automatically; a full CMS code (e.g. AA0410) goes straight to its line. Arrows and Enter in both steps, Backspace from step 2 back to the names, Esc closes. The chosen line fills CMS-Name-Form-Strength, clears and focuses the number of medicine and sets the unit; the route is never filled; free text stays allowed.
- Filter by the open patient (age, sex, ward, service, pregnancy): a child (0-14 years, paediatricMaxAge, or Pediatric ward / NCU) sees the child lines, an adult the adult lines; unknown age shows everything. Women-only lines (e.g. oxytocin): women from 15 years, or any girl who is pregnant (EDD), in the Obstetric / Gynecology ward or seen for ANC, PNC or family planning; never for a male. Newborn-only lines (e.g. caffeine citrate): under 28 days or NCU. Lines with an age or weight limit are shown with the orange note, never hidden. The filter never changes a saved prescription.
- Routes: a new line offers ចាក់សរសៃ (IV), ចាក់សាច់ដុំ (IM), ចាក់ក្រោមស្បែក (SC), លេប (PO), លាប, បន្តក់, ស្រូប, តាមទ្វារមាស, តាមទ្វារធំ (PR), ក្រោមអណ្តាត (SL). The old values iv_fluid, antibiotic_iv, antibiotic_im and injection_unspecified stay valid (saved records, Pharmacy, messages, nursing chart, PMRS2 import), open unchanged and are shown as IV / IM. One route table for every page (public/medication-routes.js: prescription forms, discharge, Pharmacy, staff messages, printing). Nursing chart order: old IV fluid and antibiotic lines keep their place; new IV lines from list group 25 (fluids and electrolytes) sort first and ATC J01 antibacterials next.
- Totals stay empty (not 0, never NaN) until the number of medicine is typed.
- Maximum dose check: the draft table (server/catalogues/dose-limits-draft.json, 395 dose keys) is loaded once into the drug-safety table (drug_max_doses, additive columns: dose key, type, component, adult per-kg limits, child per-kg limits and caps, status, approved by / at). A line already in the table is never overwritten; list lines are rejected, not deleted. /admin/drug-safety lists the table with filters; the administrator edits values (the line goes back to draft); the Head of Pharmacy (PHARMACY) or the Director approves or rejects each line with one click (name and time saved, audited). Only approved lines are used. The pharmacist opens the page from the Pharmacy dispensing page; the side menu is unchanged.
- The check runs when a doctor or midwife adds or changes a line and again on save: dose = number x strength in the unit of the limit (tablets x mg per tablet, mL x mg per mL, mg as typed; combinations by component), per day = per dose x doses per day (QD/BID/TID/QID/qH). Adults: lower of the maximum and the per-kg limit x Triage weight. Children: per-kg limit x weight, never above the child caps; without a weight an orange note "បញ្ចូលទម្ងន់ ដើម្បីពិនិត្យកម្រិតថ្នាំ" and no red alert. Protocol lines show the note as guidance. Above a maximum: red alert in the existing warning window with the calculated dose and the maximum; the prescriber continues only with a written reason, saved with the line (doseOverrideReason, additive) and in prescribing_overrides (audited). A dose that cannot be converted gives no alert and is listed for the pharmacist on the drug-safety page. Discharge medicines are checked too (allergy, duplicate, maximum dose).
- Khmer: new texts are approved in docs/approved-new-khmer.json through docs/translations-needed.csv (marked "draft Khmer, owner to review" where the owner did not give the text); the drug-safety page and the prescribing warning window now show Khmer. The route label changes ordered by the owner are listed in docs/khmer-approved-changes.md; scripts/khmer-lib.mjs accepts rows under an "(owner's order)" heading and skips the borkeo-update-files/ input folder.
- Tests: tests/v425-medicine-list-dose-check.test.mjs (new); tests/v425-medicine-list-browser.mjs (the v42.3 browser check, updated: adult, 5-year-old and pregnant woman in OPD, IPD admission, daily note, discharge, nursing chart; search, choose, "+", dose, red alert and reason, save, reopen, print); tests/v423-medicine-list.test.mjs, tests/v1200-regression.test.mjs and tests/v412-medication-safety.test.mjs follow the new list, the empty total, the midwife prescriber and the drafts; tests/accessibility-quality-smoke.test.mjs expects 42.5.0.

## v42.4.0 (Ready for an online Node.js host: Railway first; GitHub safety)
- Why: Vercel returned 404 NOT_FOUND. Vercel only runs short functions and deletes saved files, but Borkeo EMR is a server that must keep running with an SQLite database, uploads and backups on disk. The project now runs on a host with a permanent volume (Railway, Render, Fly.io); it was not converted to serverless and the database was not replaced.
- GitHub safety: .gitignore now keeps every database (*.sqlite, *.db and their WAL/SHM files), backups, patient uploads, .env files, logs and Borkeo_EMR_Data/ off GitHub. The ICD-10 reference catalogue (data/icd10/catalogue.sqlite, no patient data) stays. data/demo.sqlite stays on the computer and is not uploaded. History check: the only databases ever committed (data/emr.db and two .validation-v380 demo.sqlite copies, all removed earlier) are empty (0 patients, 0 users).
- Production security (NODE_ENV=production or EMR_MODE=production only; local use unchanged, including Superuser / 1234): the Superuser password comes from SUPERUSER_PASSWORD (12+ characters) and is not reset at every start; without it the account cannot log in and the server logs one warning (never the password). No shared-password (1234) ward accounts are created online, and the log warns if active accounts still use 1234. The login page lists no accounts and offers no quick login.
- Behind the host's proxy: TRUST_PROXY=true reads the client address from X-Forwarded-For (last entry) for login lockout, the audit log and the record view log; without it the header is ignored.
- DATA_DIR: when set, the database (DATA_DIR/emr.sqlite unless DATABASE_PATH is set), patient uploads (DATA_DIR/uploads) and every backup (DATA_DIR/backups) are kept there. Without it the hospital computer keeps today's locations. An empty DATABASE_PATH counts as not set.
- GET /api/health ({"ok":true}, no login, no patient data). Management can list and download server backups: GET /api/admin/backups and /api/admin/backups/latest (audited).
- New files: Dockerfile (node:24-slim, NODE_ENV=production, HOST=0.0.0.0, DATA_DIR=/data, node server/server.mjs), .dockerignore, .env.example, docs/DEPLOY.md (Railway step by step, backups, moving the hospital database after approval, Render and Fly.io notes, why Vercel does not work).
- Tests: 924/924 (new tests/v424-hosting.test.mjs; tests/accessibility-quality-smoke.test.mjs expects 42.4.0). npm run check:khmer passes. Checked by running the server like the Docker image (production variables, temporary volume): a synthetic patient survives a restart.

## v42.3.0 (Medicine names from the Cambodia Essential Medicines List)
- Every medicine name box in the prescription forms (OPD, IPD admission, IPD protocol rows, daily note, discharge medicines) searches the Cambodia Essential Medicines List, 10th edition (2023-2024, 704 medicines) after 2 letters. The search matches the name, the CMS code, the form and the strength; arrow keys, Enter and Esc work; the "no match" text is Khmer. A choice is filled as "CMS code-Name-Form-Strength" (without the code when the list has none). Free text is still allowed. The old short meds_list type-ahead was removed.
- The list is served to logged-in staff (GET /api/medicines/catalogue, from server/catalogues/medicines-eml-2024.json) and searched in the browser (public/medicine-autocomplete.js and .css; no npm package, no server search while typing).
- After choosing, the number of medicine is cleared and gets the focus, and the unit is set from the medicine (tablets, capsules, suppositories: គ្រាប់; oral liquids and infusions: mL; injections: mg, mcg, IU, g or mmol from the strength; sachets and powders: កញ្ចប់; drops: ដំណក់; inhalers: បាញ់; creams, ointments and gels: g; patches, IUDs and implants: the new unit ដុំ). The doctor can still change it.
- Units: mg, mL, mcg, g and IU are written in the original international units, not translated (owner's order). Records saved with the old labels open as the new units; saved data is changed only when a user saves the record again. Old and new forms count as the same unit in stock deduction, the ward medicine report, the maximum-dose warning, the patient banner, the nursing chart and printing (public/medicine-units.js, server/medicine-units.mjs). The Khmer check allows exactly these five replacements.
- The number of medicine and the route are blank in every new row (no default PO). A line with a medicine but no route cannot be saved ("សូមជ្រើសរើសផ្លូវប្រើថ្នាំ" next to the row); empty rows are ignored. Old lines keep their saved route.
- Each prescription table starts with 3 rows (5 before). Saved records still show every line. Two hidden placeholder rows keep the record storage positions of the old daily-note rows 4 and 5, so no saved field key changes.
- The CMS code of a chosen medicine is saved with the line (cmsCode, additive; old lines are unchanged). Discharge medicine names can be up to 600 characters (some list names are up to 515).
- Tests: tests/v423-medicine-list.test.mjs (new); tests/v423-medicine-list-browser.mjs (new, explicit browser check); tests/v1200-regression.test.mjs checks the new list instead of the removed datalist; tests/accessibility-quality-smoke.test.mjs expects 42.3.0. npm run check:khmer passes.

## v42.2.0 (Start-Borkeo-WiFi.bat no longer closes at once)
- Start-Borkeo-WiFi.bat called npm without "call", so when the server could not start, the window closed before the error could be read. It now starts Node directly (Node is also found in C:\Program Files\nodejs when it is not on the PATH), and first checks the usual problems with a clear message: the EMR files are not next to the file (ZIP not extracted), Node.js is not installed, or port 3001 is already in use (the EMR is already running). On any error the window stays open.
- Tests: 903/903 (tests/accessibility-quality-smoke.test.mjs expects 42.2.0). npm run check:khmer passes.

## v42.1.0 (Superuser becomes a "switch user type" account; new Infectious diseases ward)
- Superuser: the "all buttons" mode, the SUPERUSER active role and the v42.0 automatic role switch on page open are removed. The account now holds every real staff role (15) and every ward, and is always exactly one real user type at a time. While switched it is checked exactly like a real account of that type: the same side menu, pages, buttons, data, server refusals and message bell. isSuperuser() only identifies the account (switch button and audit); every permission bypass for the Superuser was removed from the server and the page scripts. Old sessions saved with the SUPERUSER role go to the picker.
- After login the Superuser always starts on the user type picker (/context): pick the role, then the ward for roles that need one (Midwife = obstetric only; Nurse = not obstetric; Chief of ward and Ward head = not OPD; Doctor = any ward). The picker lists the 15 user types (VICE_DIRECTOR label added).
- A "switch user type" button (ប្តូរប្រភេទអ្នកប្រើ) is in the top bar of every page for the Superuser account only; it opens a small window with the same role and ward selects. After a switch the account goes to the landing page of that user type. /api/auth/context now returns this landing page (landingPathForRole), used by both the picker and the window. The role never changes by itself. Every switch is audited (WORK_CONTEXT_CHANGED with switchedBy: 'Superuser'). Real staff do not see the button; their own role switch is unchanged.
- Messages: the bell, the message list and "complete" follow the active role and ward (no aggregated inbox). A task completed while switched to Laboratory is completed for the Laboratory team.
- Signatures saved while switched show "Superuser · <Khmer role label>". Real staff signatures are unchanged.
- New ward: Infectious diseases (ផ្នែកជំងឺឆ្លង, code infectious, IPD). Triage already offered it, but the server did not know the ward, so a patient sent there belonged to no ward. It is now in the server ward list (messages, ward medicines, daily report, OPD to IPD transfer, default ward accounts doctor_infectious / nurse_infectious), the finance department list, the bed map (one room with four beds, the same layout as TB), the ward name lists, the encounter prefix (MED) and the service code (RH-IPDGen). Triage's "ward changed" check now knows the ward.
- /context: after choosing a role, the landing page now comes from the server, the same as a real login (for example a Vice director goes to Billing, an OPD nurse to the paraclinic handoff list).
- Tests: 903/903. tests/v420-superuser-page-roles.test.mjs replaced (picker after login, exact menus and landing pages for 14 user types compared with real accounts, Registration refusals, Medicine nurse refusal of a Surgery patient, bell and completion, Triage to Infectious diseases, signature label); tests/v418-superuser.test.mjs rewritten for the new account rules; tests/v155-opd-transfer-alerts.test.mjs expects 10 IPD wards; tests/v181-patient-directory.test.mjs no longer treats SUPERUSER as a role; tests/accessibility-quality-smoke.test.mjs expects 42.1.0. tests/v398-side-navigation.test.mjs is unchanged and passes. npm run check:khmer passes (one new approved label, applied with npm run translations:apply).

## v42.0.0 (Superuser works as each staff role; side menu click fix; IPD transfer page fix)
- Side menu: clicking an item in the collapsed menu opened the item above it (Register opened Home, Triage opened Register). The section headings grew by 28 px when the menu expanded under the pointer and pushed every item down. Headings now keep the same height in both states (the collapsed menu still shows a thin divider), so items never move. Affects every account.
- Superuser: opening a page now switches the Superuser to the staff role that owns it (Register = Registration, Triage = Triage, OPD queue = OPD doctor, Lab = Laboratory, Billing = Cashier, Expenses = Accountant, Cash flow = Director, Administration pages = Admin, Home = Superuser). Pages that need a ward use the patient's ward, or the current ward, or Medicine. A role that already fits the page is kept. Every existing role check, menu and save rule then works exactly as for that staff member, so one person can take a patient through every step (register, triage, cashier, OPD, lab, pharmacy, ward) and approve their own requests. Each automatic switch is audited (WORK_CONTEXT_CHANGED, automatic: true). Background requests never switch the role, so a manual switch from the user menu stays until the next page is opened.
- Fixed for the Superuser: the Triage queue and the OPD queue were refused (403).
- IPD transfer page (/ipd-transfer): its script and stylesheet were never served (404), so the page did not work for any OPD doctor. Both files are now served.
- Tests: 903/903 (new tests/v420-superuser-page-roles.test.mjs; tests/accessibility-quality-smoke.test.mjs expects 42.0.0). npm run check:khmer passes.

## v41.9.0 (Superuser Multi-Role Launch & Registration/Triage Execution Fix)
- Fix Superuser workspace launch: Superuser now possesses full capabilities to launch and operate as all hospital staff roles directly from the interface, without bouncing or redirecting back to `/home`.
- Registration operations: When launching Registration (`/emr?view=register`), Superuser operates with full Registration authority: demographics entry, new/old PMRS2 case selection, saving records, and dispatching to triage or inpatient departments.
- Triage operations: When launching Triage (`/triage` or `/emr?view=triage`), Superuser operates with full Triage authority: entering vital signs, determining triage severity levels, assigning beds/wards, and completing triage assessments.
- Clinical & specialty operations: Unlocks all pages including Outpatient, Inpatient SOAP, Nursing charts, Billing, Finance, Expenses, and User Administration for the `SUPERUSER` role.
- Navigation tab auto-selection: Opening `/emr` with specific view parameters (`?view=register`, `?view=triage`, or clinical views) automatically routes and activates the corresponding tab without manual page switching or restriction barriers.
- Tests & Validation: Verified with end-to-end multi-role save and navigation tests in `tests/v418-superuser.test.mjs`. All 900 test assertions pass and `npm run check:khmer` passes without violation.

## v41.8.0 (Universal Superuser Account & Full System Access)
- Universal account: Single account `Superuser` (password `1234`) configured with access to all hospital functions from registration to director, without requiring role or ward switching.
- Permissions and routing: `SUPERUSER` active role with `isSuperuser` identity flag, bypassing context selection and enabling all side navigation menu items across care, clinical, pharmacy, finance, and administrative departments.
- Universal alert inbox: Aggregates staff messages, notifications, and alerts across all roles and departments so that all patient and department alerts display in the single Superuser notification bell and message list.
- Cross-department operations: Authorized for registration, triage, OPD consultations and queue calling, IPD admissions/transfers/discharges, paraclinic ordering (Lab & Imaging), specimen processing, critical result acknowledgments, pharmacy dispensing, ward medicine report approvals, and financial operations (Cashier, Billing, Accounting, and Director financial reports).
- Database compatibility: Backward-compatible account initialization via `ensureSuperuser` without overwriting existing patient records or schema constraints.
- Tests: All tests pass including new `tests/v418-superuser.test.mjs`. `npm run check:khmer` passes.

## v41.7.0 (Medical record restructure - Phase 10: record view log and scanned documents)
- Record view log: every opening of a patient record (record page, patient history, PMRS2 review), every print (any print from the record page) and every export (PMRS2 transfer package), and every opening of a scanned document is kept: who, role, ward, when, what, IP address. Repeat openings of the same record by the same person within 2 minutes are one entry. Logging never blocks the record.
- New page /admin/record-log (Admin, Director, Vice director only; sidebar item "Record view log"): filter by patient, staff, action and dates.
- Scanned documents: a button next to the forms button in the OPD, IPD and nursing records opens the list. PDF, JPG or PNG up to 10 MB; the server checks the real file type (a renamed file is refused). Files are stored in data/uploads/patients (folder name is a hash, no patient name), never in the record; data/uploads/ is in .gitignore. Clinical staff and Registration can attach; removing needs a reason and keeps the file. Upload, view and removal are audited.
- Saved record fields are unchanged (browser check: same 1514 keys before and after).
- Tests: 893/893 (new `tests/v417-record-log-documents.test.mjs`; `tests/v410-clinical-summary-ui.test.mjs` expects the new banner script version). `npm run check:khmer` passes.

## v41.6.0 (Medical record restructure - Phase 9: discharge, intake/output, early warning score, critical results)
- Discharge form: main / secondary ICD-10 (the main code still fills the existing field), patient instructions, and a printable discharge summary built only from the saved discharge (letterhead, diagnoses, outcome, status, follow-up, discharge medications, instructions, signature line). All existing discharge fields and outcomes unchanged.
- Intake and output: a Daily balance row (fluid in minus fluid out) in the nursing chart; calculated, never editable, never saved as a field.
- Early Warning Score: NEWS2 (owner's choice) from the latest vital signs, in the IPD Objective box (with new oxygen and consciousness fields) and in the patient banner; adults 16+, not for pregnant women; incomplete scores are marked. Table in `server/clinical-options.json` for a doctor to check (docs/clinical-review.md).
- Critical result escalation: a critical lab / imaging result not acknowledged within 30 minutes (owner's choice) is sent once to the ward doctors, ward chief and ward head inboxes. The existing acknowledgement is unchanged.
- Tests: 890/890 (new `tests/v416-discharge-io-ews-escalation.test.mjs`; `tests/v407-ipd-soap-record.test.mjs` expects the EWS panel in O and lists its two new fields; `tests/v413-periop-forms.test.mjs` accepts any script version). `npm run check:khmer` passes.

## v41.5.0 (Fix: nursing, midwife and delivery form fields depending on page-load speed)
- FIXED: the nurse/midwife record fields were numbered from what was on the page at the moment of loading. On some loads (slow first load, or the chart drawn a moment later) the nurse assessment boxes (41), the nursing chart cells (416) or the ward billing panel (2) were counted differently, and every later nursing field - including the midwife and delivery forms - got another key. Values could open in the wrong field, chart and assessment entries were not saved on such loads, and a save could write values under a neighbouring key.
- Now the chart cells are prepared first, locked boxes still count, and the billing panel and search box are never counted. Every load gives the same keys, equal to the normal numbering nurses used. Browser round trip: saved on a slow load, reopened on a fast load, same fields.
- Tests: 887/887 (new `tests/v415-storage-key-timing.test.mjs`; `tests/v327-symptom-catalogue.test.mjs` sandbox gets `window` and `matches`/`closest`, the assertion is unchanged). `npm run check:khmer` passes.

## v41.4.0 (Medical record restructure - Phase 8: newborn and postnatal care)
- Newborn record (on the mother's record): Apgar 1/5/10 minutes, birth weight, length, head circumference, resuscitation, immediate newborn care checklist, vitamin K, birth vaccines (BCG, HepB birth dose), baby's case number; one section per baby (up to three); one form per date; midwife and doctor e-signatures; print.
- Linked to the delivery form: a "Newborn record" button in the delivery form, and a new newborn record is prefilled from it (birth time, number of babies, baby #1 outcome, sex, weight). The ANC, delivery and labour chart forms are not changed.
- Postnatal care record for the mother (with a baby check line); one form per date.
- Newborn care items and birth vaccines are configurable (`server/clinical-options.json`). Draft Khmer for the new labels is in docs/phase8-newborn-drafts.md for the owner to approve.
- Tests: 884/884 (new `tests/v414-newborn-postnatal.test.mjs`). `npm run check:khmer` passes.

## v41.3.0 (Medical record restructure - Phase 7: consents, surgery, anaesthesia and transfusion)
- Nine forms: Procedure consent, Anaesthesia consent, Blood transfusion consent, Refusal of treatment form, Pre-operative checklist (WHO, configurable), Operative note, Anaesthesia record, Post-operative orders, Blood transfusion record. Opened from a button at the top of the OPD, IPD and nursing records (works from a ward bed too).
- One form per type and date (same date = same form, another date = a new form); every save keeps the previous version; audited; nothing deleted.
- Signatures: staff e-signatures per slot ("changed after signing" when edited later); patient / representative signs on screen, by thumbprint photo, or on paper; a Fingerprint scanner button is ready for a device (docs/fingerprint-scanner.md).
- Print button on every form: letterhead, patient details, the form, the consent text, signature lines.
- The owner's approved Khmer for the consent texts, checklist and field labels (docs/phase7-consent-drafts.md) was applied with `npm run translations:apply` (77 texts).
- The existing កិច្ចសន្យាទទួលការព្យាបាល is unchanged.
- Tests: 881/881 (new `tests/v413-periop-forms.test.mjs`; `tests/translation-tools.test.mjs` now allows owner-applied translations after the 61 RULE 2 entries and checks each against the CSV). `npm run check:khmer` passes.

## v41.2.0 (Medical record restructure - Phase 6: medication administration record and prescribing warnings)
- FIXED: a nurse's "given" tick in the nursing medicine chart was kept only in the open page and lost when the record was reopened (browser test). Doses are now saved on the server.
- Medication Administration Record: clicking a dose in the existing nursing chart opens a form - Given / Held / Refused, time, reason or note (required for held / refused), nurse signature (e-signature snapshot). The chart shows the status; a full list (with corrections crossed out) is under the chart and prints with the form. Linked to the existing treatment orders (admission prescription and daily notes). Nurses and midwives of the ward record; corrections void the old entry with a reason; nothing is deleted; audited.
- Prescribing warnings for doctors (admission, daily note and OPD prescriptions): allergy (structured allergy record), duplicate medicine in the same prescription, interaction and maximum dose (admin tables, empty). Continuing requires an override reason, saved and audited; "Do not prescribe" clears the medicine.
- New admin page `/admin/drug-safety` (menu: administration) for the interaction and maximum-dose tables; administrators edit, management views.
- Tests: 879/879 (new `tests/v412-medication-safety.test.mjs`; `tests/v398-side-navigation.test.mjs` lists the new menu item and accepts a translation key as the label of an item without approved Khmer). `npm run check:khmer` passes.

## v41.1.0 (Medical record restructure - Phase 5: display rules by age and sex, paediatric section)
- Configurable display rules (`server/clinical-options.json`, `GET /api/clinical-options`, `docs/clinical-review.md`): immunization list 0-14; smoking / alcohol / drug questions from 10; paediatric section 0-14; head circumference 0-2; tetanus vaccine status for females 15-49 and pregnant patients. Unknown age or sex shows everything; hiding never clears a field; a section with saved values is always shown.
- Ob/gyn history (owner's rule): females 15 and over; under 15 only when pregnant (EDD written) or in the obstetric ward; a "show" button for any other female; never for males.
- New paediatric section in the IPD Subjective box: birth history, feeding, growth (weight and height from the vital signs, head circumference, notes), developmental milestones.
- New tetanus vaccine status (TT1-TT5, no dose, unknown, last dose date).
- TB screening is one shared block in OPD and IPD; IPD gains the "TB contact" item.
- New fields are id-keyed; no existing storage key changed (browser check).
- Tests: 876/876 (new `tests/v411-display-rules.test.mjs`; `tests/v407-ipd-soap-record.test.mjs` now expects the two filled Phase 5 slots and lists the 8 new fields, while still pinning all 113 old IPD keys). `npm run check:khmer` passes.

## v41.0.0 (Medical record restructure - Phase 4: patient banner, structured allergy, problem list)
- FIXED an allergy safety bug: the patient banner read two allergy fields that never existed, so it showed "no allergy history" for every patient, even when the doctor had written a drug allergy. It now reads the record's drug-allergy tick and text and the new structured allergy record. An empty record shows "Allergy not recorded".
- FIXED nursing forms losing typed values: each time a record opened, the patient name, age, sex, code, ward, room and bed typed in the nursing forms were replaced by the registration values (and lost on the next save). Empty fields are still filled; a saved value that differs is kept and the banner value is shown next to it.
- Structured allergy record (type, substance, reaction, severity, date, recorded by) in the IPD Subjective box; doctors add and remove (with a reason, nothing deleted); it follows the patient across visits (Health ID).
- Active problem list (long-term, across visits) in the OPD and IPD Assessment boxes; doctors add, resolve and reactivate. It never replaces the encounter diagnoses.
- Patient banner: new row with resuscitation status, risk flags (severe allergies, DNR), active problems and current medications; a details panel opens from the banner (allergy record, problems, medications; doctors set the resuscitation status).
- Ward map bed popup: red drug-allergy box (or "Allergy not recorded").
- Letterheads (ministry, kingdom, Tacteing ornament) print only; on screen the banner replaces them.
- New text without approved Khmer is shown as highlighted English and listed in `docs/translations-needed.csv` (32 rows). Clinical lists to confirm: `docs/clinical-review.md`.
- Tests: 870/870 (new `tests/v410-clinical-summary.test.mjs`, `tests/v410-clinical-summary-ui.test.mjs`). `npm run check:khmer` passes.

## v40.9.0 (Medical record restructure - Phase 3: daily follow-up note in SOAP order)
- FIXED a data-loss bug from the first SOAP version: when a record opened, every saved daily note was replayed through the new SOAP form. An old note without a conclusion failed the S/A check and disappeared from the screen (with a warning on every opening); the next save then deleted it. Old notes were also rewritten as "S: ..." / "A: ..." SOAP notes. Now each saved note is rebuilt from its saved data exactly as it was: old notes keep their original evolution text and show in the labelled old-note card.
- Daily follow-up popup: the vital-sign inputs (with their abnormal-value colours) are in O, with an "Examination findings" label on the examination text; A has the existing conclusion label and ICD-10 with main / secondary diagnoses; P has the treatment and protocol medicine tables, then "Plan notes". Boxes are full width.
- Main / secondary ICD-10 in daily notes: the main code is stored first with a `main` flag and fills the ICD-10 field; cards and the daily print show "Secondary diagnoses"; the card shows the main code.
- Required boxes unchanged: S and A. The old hidden evolution (S + O) and conclusion (A + P) fields are still kept in sync for printing and PMRS2.
- Doctor-only editing: the daily SOAP boxes are now really read-only for nurses (the role check ran before the signed-in role was known and was undone by the page permissions).
- Tests: 860/860 (6 new in `tests/v409-daily-followup-soap.test.mjs`). `npm run check:khmer` passes.

## v40.8.0 (Medical record restructure - Phase 2: OPD record in SOAP order)
- The OPD record (`#sub_opd`) is shown in four boxes: S Subjective (history with the TB screening checkboxes), O Objective (weight, height, BMI, vital signs, examination text; investigations, where paraclinic orders still append), A Assessment (ICD-10 with main/secondary diagnoses), P Plan (prescription table with its print button, counselling, return date, admit-to-ward, NEW Plan notes). Title and doctor signature are unchanged.
- Existing elements were moved unchanged. The only Khmer label change is the removal of the Roman numbers I.-V. from five titles (`docs/khmer-approved-changes.md`).
- Saved data is safe: the 11 position-keyed OPD form fields keep their old positions; all 28 OPD form keys are pinned in `tests/fixtures/opd-storage-keys.json`. Browser round trip with synthetic records in the current and the oldest key formats: 39/39 OPD fields load and save.
- OPD main / secondary ICD-10 (OPD stays separate from IPD); the main code stays first, so `diag_input` (PMRS2, daily report) follows it.
- Fixed a timing race: the counter selector (`#session-counter`) is a screen setting and no longer takes part in record field numbering or saving. Depending on load timing it could shift the oldest (pre-v0.8) record keys by one.
- Unchanged and checked: OPD cashier pre-payment lock (a doctor save is refused until the consultation fee is confirmed), prescription print sheet, OPD form print (one A4 page).
- Tests: 854/854 (6 new in `tests/v408-opd-soap-record.test.mjs`; `tests/v3211-ipd-form-and-obgyn-history.test.mjs` keeps its numbered-title checks for the legacy copy). `npm run check:khmer` passes.

## v40.7.0 (Medical record restructure - Phase 1: IPD admission record in SOAP order)
- The IPD admission record (`#sub_ipd`) is shown in four boxes: S Subjective (reason for admission, present illness, other complaints, current medicines, past history incl. immunization, drug allergy, obstetric/gynaecological, family and community history), O Objective (vital signs, physical examination with the "mark all normal" KH/EN/FR control, investigations), A Assessment (provisional and differential diagnosis, ICD-10, prognosis), P Plan (drug treatment, other interventions, diet, monitoring, NEW Plan notes). Header and footer are unchanged.
- Existing fields were moved, not rebuilt: ids, classes, data-keys and handlers are unchanged. The only Khmer label change is the removal of the leading section numbers of seven titles (listed in `docs/khmer-approved-changes.md`).
- Saved data is safe: the 92 IPD fields whose saved key depended on their position now carry their old position (`data-emr-key-index` / `data-emr-legacy-index`), so old records load into the same fields. Checked in the browser with synthetic records in the current and the oldest key formats (103/103 fields load and save). The ICD-10 search boxes are no longer saved (`data-emr-no-save`); they only ever held search text.
- Main / secondary ICD-10 (IPD): the first code is the main diagnosis (badge); the others are listed as secondary diagnoses, each with "Set as main". The main code is kept first, so the PMRS2, discharge and report primary-code field follows it. A `main` flag is also stored. Old records keep their first code as main.
- One reusable SOAP component (`soap-note.css` / `soap-note.js`) now serves both the daily follow-up and record forms: letter badge, English title, icon, colour stripe, tinted body, collapse, empty/filled dot, dark mode, black-and-white print.
- Print: the IPD record still prints on two A4 pages at the same size (page 1: S and O up to the respiratory examination; page 2: rest of O, A, P, signature).
- Empty, hidden slots are reserved for Phase 4 (structured allergy, problem list), Phase 5 (paediatric section, tetanus status), Phase 6 (prescribing warnings) and Phase 9 (Early Warning Score).
- Tests: 848/848 (8 new in `tests/v407-ipd-soap-record.test.mjs`; `tests/v398-side-navigation.test.mjs` selector updated). `npm run check:khmer` passes.

## v40.6.0 (Medical record restructure - Phase 0: safety net)
- No change to any screen, clinical logic or patient data.
- Khmer text safety net: `scripts/extract-khmer.mjs` wrote `docs/khmer-baseline.json` (16,231 Khmer strings in 317 files). `npm run check:khmer` (also run inside `npm test`) fails if any of them is changed or removed, or if Khmer not in `docs/approved-new-khmer.json` is added. `npm run khmer:accept` updates the baseline and is for the owner only.
- `docs/approved-new-khmer.json`: the 61 approved new Khmer terms, copied from the owner's plan.
- Translation tools for new text: `newText()` / `newTextHtml()` / `data-new-text` in `public/new-text.js` show an English placeholder with a yellow dashed highlight until the owner fills the Khmer in `docs/translations-needed.csv`. `npm run translations:apply` writes it in. `SHOW_UNTRANSLATED=0` in .env turns the highlight off.
- `docs/medical-record-map.md`: every field of the IPD, OPD and daily follow-up records, with id, storage key and readers.
- `.gitignore` adds `data/*.db`, `data/demo-photos/`, `.validation-*/` and `_backup_*/`.
- Tests: 840/840 (10 new).

## v40.5.0 (Check of the v40.1–v40.4 ward editing update)
- Fixed: `/public/nationalities.js` and `/public/nationalities.css` were never served (404), so the nationality picker in the record did not load. Both are now registered.
- Fixed: once loaded, the nationality picker crashed on every record ("Cannot read properties of undefined (reading 'querySelector')") because it updated its button before creating it. It now waits for the button.
- Fixed: the address data (`data/gazetteer`) was looked up from the folder the server was started in. Started from any other folder, every record save failed with error 500 "Gazetteer provinces.json not found". It is now found from the program folder.
- Checked in headless Edge on a test copy: the ward doctor (medical record) and ward nurse (nursing documents) open their own patient ready to edit, every field can be typed in, and saving succeeds.
- Tests: new `tests/v405-nationalities-and-gazetteer.test.mjs`.

## v40.4.0 (Patient photo in ward bed popup dialog)
- When clicking on an occupied bed in the ward map (`/departments`), the patient details dialog (`openBedModal`) and bed transfer dialog (`openBedTransferDialog`) now prominently display the patient's photo (`.bed-patient-avatar`) next to their identity information.
- If the patient has a registered photo (`patient.photo`), it is displayed with clear dimensions (92×92px) and a subtle frame so medical and nursing staff can clearly recognize the patient.
- If no photo has been registered yet, an accessible, neutral avatar placeholder with the Khmer title «គ្មានរូបថត» is shown.
- Full responsive styling ensures clear appearance across desktop, tablet, and mobile screens.
- Tests: 828/828 (1 new in `tests/v404-ward-bed-patient-photo.test.mjs`; version consistency verified across `package.json`, `server/server.mjs`, `public/login.html`).



## v40.3.0 (Instant ward editing for nurses and doctors without manual unlock)
- In the ward management view (`/departments`), selecting "ដំណើរការថែទាំ" (Nursing Documents), "កំណត់ត្រាវេជ្ជសាស្ត្រ" (Medical Record), or "ការតាមដានប្រចាំថ្ងៃ" (Daily Follow-up) automatically launches the encounter editor in edit mode (`edit=1`).
- `public/emr-encounter-editor.js` automatically enables direct editing (`isDirectEditAllowed()`) for nurses and midwives on nursing care sheets, and for doctors on medical records and daily progress sheets, removing the need to click "កែប្រែព័ត៌មាន" first.
- View-only access remains preserved when explicit `mode=view` is supplied.
- Tests: 827/827 (1 new in `tests/v403-ward-direct-editing.test.mjs`; version consistency verified across `package.json`, `server/server.mjs`, `public/login.html`).


## v40.2.0 (Instant triage editing without manual unlock)
- When clicking "បំពេញទ្រីយ៉ា" (Enter Triage) from the triage queue or opening triage view as triage staff, the triage assessment form opens directly in edit mode (`editing = true`).
- Triage staff can enter vital signs, triage categories, and ward transfer immediately without clicking "កែប្រែព័ត៌មាន" / "កែតម្រូវ" first.
- Completed triage records remain view-only via "មើលទ្រីយ៉ា" with `mode=view`.
- Tests: 826/826 (1 new in `tests/v402-triage-direct-editing.test.mjs`; version consistency verified across `package.json`, `server/server.mjs`, `public/login.html`).

## v40.1.0 (Role-based chart tabs visibility in patient banner)
- Chart tabs (`public/patient-banner.js`) are filtered by active staff role so staff only see the tabs needed for their duties.
  - Management (Admin, Director, Vice Director): all 7 tabs (`សង្ខេប`, `សញ្ញាជីវិត`, `បញ្ជា`, `លទ្ធផល`, `ឱសថ`, `កំណត់ត្រា`, `បេឡា`).
  - Clinical (Doctor, Ward Head, Chief Ward): clinical tabs (`សង្ខេប`, `សញ្ញាជីវិត`, `បញ្ជា`, `លទ្ធផល`, `ឱសថ`, `កំណត់ត្រា`), excluding billing (`បេឡា`).
  - Nursing (Nurse, Midwife): clinical tabs (`សង្ខេប`, `សញ្ញាជីវិត`, `បញ្ជា`, `លទ្ធផល`, `ឱសថ`, `កំណត់ត្រា`), excluding billing (`បេឡា`).
  - Triage & Registration: `សង្ខេប` and `សញ្ញាជីវិត`.
  - Billing / Cashier (Clerk, Accountant): `សង្ខេប` and `បេឡា`.
  - Pharmacy: `សង្ខេប` and `ឱសថ`.
  - Paraclinic (Lab, Imaging): `សង្ខេប`, `បញ្ជា`, and `លទ្ធផល`.
- Default active tab falls back to the first allowed tab if the previously selected tab is not permitted for the user's role.
- Tests: 825/825 (1 new in `tests/v401-chart-tabs-by-role.test.mjs`; version consistency verified across `package.json`, `server/server.mjs`, `public/login.html`).

## v40.0.0 (Short staff passwords: minimum 4 characters, hospital default 1234)
- Hospital decision: passwords need 4–128 characters (was 12–128). One rule in `server/password.mjs` (`MIN_PASSWORD_LENGTH`, `DEFAULT_STAFF_PASSWORD = '1234'`), the change-password schema, and every password box (sign-in, change-password screen, account menu, admin User accounts, console scripts).
- New default ward accounts start with `1234` (was `111111111111`); the sign-in account picker fills `1234`; the browser-import CSV generator uses `1234` and the current Wi-Fi address.
- New `npm run set-all-passwords` (`scripts/set-all-passwords.mjs`): refuses while the EMR is running, writes a full backup (`<data folder>/backups/emr-before-1234-<date-time>.sqlite`), then sets every account to `1234`, clears "must change password", signs everyone out and records `PASSWORD_SET_TO_HOSPITAL_DEFAULT` in the audit log. Patient records are not touched.
- Unchanged: sign-in lockout after repeated failures, two-factor codes for admin/director when enabled, admin password reset still asks the person to choose a new password.
- Security note: with 1234 for every account, anyone on the same Wi-Fi can sign in as any staff member. Use Wi-Fi mode only on a staff-only network.
- Tests: 824/824 (3 new in `tests/v400-short-passwords.test.mjs`; version checks in six older tests widened to accept v40.x).

## v39.9.0 (Fix "page isn't redirecting properly" for accounts that must change their password)
- Fixed: an account marked "must change password" (new accounts and admin resets) was sent between `/login?passwordChange=1` and its work page forever; Firefox showed "The page isn't redirecting properly" (Chrome: "too many redirects"). `/login` now stays on the sign-in page for such accounts.
- The sign-in page shows a Khmer "ប្តូរពាក្យសម្ងាត់" form (new password, confirm; current password only when not just typed). After saving, the person is signed in again with the new password and goes to their work page. "ចាកចេញ" signs out. Password rule unchanged (12–128 characters).
- Tests: 821/821 (2 new in `tests/v399-password-change-loop.test.mjs`; version test updated 39.8 → 39.9). Checked end-to-end in headless Firefox on a disposable database.

## v39.8.0 (Side navigation redesign, SOAP English titles, phone access)
- Professional side navigation: collapsed 68px icon rail that expands to 264px over the page on hover or keyboard focus (200ms collapse delay, no content reflow), optional per-user pin, drawer with backdrop and Esc on phones/tablets/touch screens, tooltips while collapsed, prefers-reduced-motion support, never printed.
- Grouped sections (Patient care, Clinical services, Pharmacy and stock, Finance, Administration), one consistent inline-SVG icon set (`public/icons.svg`), hospital brand at the top, user/role/ward, language and sign-out at the bottom, pending counters on the icons.
- One central navigation map `public/nav-config.js` based on the real server permissions; role/ward switch from the sidebar updates the menu without a page reload. Fixed links that led to 403/404 pages (IPD transfer for IPD doctors, Lab/Imaging for doctors, `/stock`, Expenses for cashiers, admin menu for chief ward/ward head). Requests stays management-only.
- SOAP section titles are always Subjective, Objective, Assessment, Plan (with S/O/A/P) in Khmer mode, EN mode and print; excluded from translation. Hints stay Khmer by default.
- Phones: `npm run start:wifi` / `Start-Borkeo-WiFi.bat` serve the password-protected EMR on the local Wi-Fi (plain http) and print the phone address; the topbar and drawer scale to finger size on phones in desktop viewport mode.
- Fixed: shell mounted twice (duplicate breadcrumb), topbar icons invisible under the global button theme, missing `os` import that hid the phone address, inline `onerror` on the logo.
- Tests: 819/819 (7 new in `tests/v398-side-navigation.test.mjs`). Screenshots in `docs/ui-screenshots/` (before-*/after-*).

## v38.3 (Phase 3: Repository Cleanup)
- Repository cleanup: archived superseded update scripts, patches, and scratch files to `../Borkeo_EMR_archive/`.
- Restructured `README.md` with quickstart instructions for running, testing, and deploying.
- Added comprehensive `docs/test-changes.md` and `CHANGELOG.md`.

## v38.2 (Phase 2: Trustworthy Test Suite)
- Test suite fully green: 756/756 passing tests with zero failures.
- Fixed financial void handler bug for payments with SQLite snake_case fields.
- Fixed nurse daily monitoring records merge preserving vital sign inputs alongside doctor treatment orders.
- Scoped doctor cross-ward access specifically for emergency admissions while maintaining strict isolation between regular wards.
- Modernized legacy test cache busters and dynamic build versions across all test suites.
- Consolidated version checking into `tests/version-consistency.test.mjs`.

## v38.1 (Phase 1: Authentication & Network Exposure Hardening)
- Network binding: defaults to `127.0.0.1` instead of `0.0.0.0`; requires explicit `--host` or `HOST` environment variable.
- Demo mode security: demo mode is opt-in; production mode requires valid user passwords and enforces account lockout after repeated failures.
- Added administrative user management scripts: `scripts/create-user.mjs` and `scripts/reset-password.mjs`.
- Implemented optional TOTP two-factor authentication for Admin and Director roles.

## v37.0 - v38.0
- Cambodian mobile phone number validation policy according to national telco prefix allocation.
- Patient caregiver identity and phone validation on admission and registration.
- Health Equity Fund (HEF) member verification and bilingual label refinements.
- Khmer default interface enforcement with English strictly reserved for explicit EN mode and standard laboratory test names.
- Performance caching and HTTP compression enhancements for provincial hospital network links.

## v19.0 - v36.0 (Historical Summary)
- Multi-ward inpatient workflows and IPD medication administration tracking.
- Paraclinic workflows: laboratory requisition forms, specimen tracking, unit conversions, and imaging worklists.
- Financial management: cashier billing, service concessions, itemized receipts, and cashflow reports.
- Patient identity cards, barcode/sticker printing, and Cambodia gazetteer address integration.
- PMRS2 provincial reporting exports and clinical audit trails.
