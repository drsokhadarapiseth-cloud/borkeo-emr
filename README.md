## v18.3

Cashier now opens directly at the billing panel without a Home link. Ward payment alerts remain until the linked invoice is settled. The payment-status list opens a read-only invoice history grouped by latest payment date. Cashier can request a single invoice correction from Admin or Director; approved corrections preserve payments and audited before/after invoice details. The Cashier banner uses the configured Khmer hospital name in Moul, switches to English with EN, and omits the extra slogan.

## v18.2

Counter selection is now available directly in the page header for Registration, Triage and OPD doctors without a login popup. Cashier combined receipts group invoices by their Cambodia entry date and reuse the individual receipt details. Unpaid service rows have a delete icon; Cashier cannot remove paid or settled services. Existing records and unrelated workflows are preserved.

# Borkeo EMR v18.1 — daily completed Triage and shared patient search

- Completed Triage lists only assessments finished today from 00:00 in Asia/Phnom_Penh, including patients discharged later the same day. Previous records remain searchable in Patient List.
- Completed Triage uses the same 12 columns, filters, column controls and pagination as the Admin Patient List, with read-only Triage actions.
- Every signed-in staff role can open Patient List and search patient summaries across wards. Clinical form and write permissions keep their existing role and ward checks.
- Registration can choose New visit to prefill patient identity in a fresh registration with a new case number and today's date/time. Saving sends this new visit to Triage and preserves the original record.
- Local asset cache keys follow the release version so changed scripts load after updates. Previous OPD two-column history and IPD protocol fixes are retained.

# Borkeo EMR v17.9 — restored IPD protocol medicines

- Visible Add Protocol Medicine buttons in the IPD Medical Record and daily treatment; the original + menu remains available.
- Protocol doses, intervals, quantities and calculated administration times update as the doctor edits the order.
- Protocol treatment survives saving, reopening, copying and editing daily records, and appears in nursing orders and IPD prescriptions.
- Previous v17.8 changes are retained, including daily medication list patient names and ICD-10 diagnosis. The displayed version is v17.9.

# Borkeo EMR v17.8 — readable patient names and ICD-10 in the daily medication list

- Patient-name columns expand to the longest full name at the normal text size. Medicine columns continue on another sheet when needed; every row and quantity remains included.
- Diagnosis comes from the saved IPD Medical Record ICD-10 field. If that field is empty, Diagnosis is blank.
- The web version and Windows startup instructions show v17.8. All v17.7 features are retained.

# Borkeo EMR v17.7 — language controls, result acknowledgment and Patient List

- The login and department build labels use the package version, so the web displays v17.7.
- Printed Triage checkboxes have a consistent size and align across paired symptom rows, without changing the editable web checklist.
- New IPD and daily follow-up medicine rows default to 1 day. Doctors can change the duration; saved durations and OPD prescriptions retain their values.
- Physical Examination offers KH, EN and FR normal text. Select a language, then use Mark All Normal or a system's Normal button. Existing normal template text can be translated; edited findings remain untouched.
- All buttons follow the selected Khmer or English language, including buttons added while using a form. Laboratory and Imaging workspaces keep their existing English interface.
- Abnormal laboratory values appear in red without Low/High labels; reference ranges and critical-result acknowledgment are retained.
- The IPD Medical Record prints on two fitted A4 pages with larger text. Its editable web form stays together, and its prescription remains a separate print sheet.
- The first doctor explicitly confirms seeing a released Lab or Imaging result. Later doctors opening the result are automatically recorded with their name and time; the first acknowledgment is preserved.
- The Patient List uses admission/discharge dates, department and payment filters, column controls, pagination, DOB/age, contact and card details, and date/time columns.
- Pharmacy confirmation of receipt closes an OPD encounter and records its discharge date/time. Existing OPD receipts are reconciled on startup; IPD discharge remains controlled by its discharge form.
- Release versions advance through .7, .8, .9 and then the next major .0.

# Borkeo EMR v17.6 — native browser preview for the selected report

- Clicking a report's Print button opens the browser print preview directly. The extra in-app preview toolbar and second Print click have been removed.
- A separate print document contains only the report linked to that button. It excludes application menus, banners, footers, other clinical tabs and ward/payment panels, while keeping the report's own letterhead, entered values, tables and existing signatures.
- Printing never saves, signs, sends results, completes messages or changes payment status. Lab/Imaging reprinting and unpaid Triage-to-IPD pending admissions retain v17.4 behavior.
- The report stays available until the browser preview closes. Cancel and repeated printing are supported. Turn off the browser's Print headers and footers option to remove browser-generated dates, URLs and page numbers.
- Existing clinical records, invoices, payment history, service fees and the ten Triage-ready simulated patients are preserved.

# Borkeo EMR v17.4 — print-only previews and direct IPD admission

- Every print action opens a visible report preview with Print and Close. Printing does not save, sign, complete messages, release results, or change payment status. Existing saved signatures remain part of the report.
- The preview uses current form values, hides screen controls and previous-record panels, omits blank medication rows, and retains report headers and clinical tables. OPD form and prescription have separate previews.
- Lab and Imaging reports remain printable after saving, release to the ward, and ward review. New orders still respect Cashier and nursing handoff gates.
- Direct Triage-to-IPD referrals appear in Pending Admissions before payment. Legacy unpaid referrals also appear. Nurses can assign room/bed; later payment preserves their admission and bed.
- Existing records, service fees, invoices, payment history, shared message completion, and the ten Triage-ready demo patients are preserved.

# Borkeo EMR v17.3 — shared task completion and complete report printing

- Admin and Director share one message inbox. Completing a task clears it for both roles. Other permissions and clinical approvals keep their existing rules.
- Nurses and doctors share completion within their own role and department. Bed assignment completes the nursing admission alert; saved clinical interventions complete that team's patient messages. Paraclinic receipt and result review complete only messages for the corresponding accession. Later messages remain pending.
- Reading a message does not complete it. Staff can use Complete task for other messages and view Completed history with the staff member and completion time. Other accounts refresh within five seconds while the page is visible.
- OPD, IPD, Lab and Imaging print buttons use a dedicated report snapshot and open the browser print dialog. Text, selected options, checkbox states, results and saved signatures are included; screen controls, previous-record panels and empty medication rows are excluded.
- Report rendering waits briefly for fonts and images without blocking indefinitely. The snapshot remains until the print dialog closes, rather than being cleared after 500 milliseconds. Lab/Imaging keep the left hospital logo and national heading without the application banner.
- Existing patients, fees, invoices, payment history, cashier gates and ten Triage-ready simulated patients remain preserved.

# Borkeo EMR v17.2 — clean Lab and Imaging printing

- Lab and Imaging printing now isolates the report from the application banner, session controls, toolbar, patient worklist and workspace headings. Print styles override the shared screen layout so hidden UI cannot reappear.
- The hospital logo is on the left of both printed reports. Cambodian headings, Moul titles, Tacteing ornament, patient details, requesting doctor and shaded test categories remain in the report.
- All ten simulated patients are waiting in Triage with editable sample vital signs, weight and height prefilled. Demo restarts fill missing values without overwriting entered measurements or completed Triage assessments.

# Borkeo EMR v17.1 — OPD cashier gate and paraclinic print layouts

- EN and KH controls are available across the application and remember the selected language. The EMR's existing form translations and the Patient List/Departments language dictionaries are connected to the same controls; Paraclinic screens stay English-only. Patient names and entered clinical values are left as entered.
- Laboratory and Imaging printouts omit the application banner and use a Cambodian heading, the Tacteing ornament, a right-aligned hospital logo, and the requesting doctor's name in the shaded exam details.
- Cashier queue labels and notifications use “ផ្នែក”; legacy notifications also display with the updated wording.
- If a doctor orders another paid OPD test after the initial pre-consult tests return, the new order and fee go to Cashier first; Lab/Imaging receives it after that invoice is paid.
- Cashier invoice and receipt printouts use Moul for the Khmer hospital name and “វិក្កយបត្របង់ប្រាក់” title.
- Sending an OPD laboratory or imaging order to Cashier confirms with `បានបញ្ជូនទៅបញ្ជរបង់ប្រាក់`.
- The release retains the existing 10 fully completed, mixed-sex simulated registrations using cash payment.

- Triage adds the OPD consultation fee and sends its invoice to Cashier. Patients cannot enter the OPD doctor queue, be called on the TV board, or open a clinical form until the consultation invoice is paid or covered.
- After payment, every OPD doctor receives the payment alert and the patient becomes available in the OPD queue. Patients transferred to IPD retain their OPD queue history.
- The ward-sent Cashier queue, searchable payment register, separate invoice history, and OPD laboratory billing remain available.

# Borkeo EMR v16.3 — ward-to-cashier payment queue, patient payment register and OPD lab sync

- Cashier's actionable queue contains invoices explicitly handed off by the OPD doctor or IPD ward staff. Patients still waiting to see a clinician do not appear there.
- A separate patient payment register can be searched by Case ID or Health ID. It shows registration number, patient name, sex, age, entry and exit dates, current invoice payment date, and paid/pending status.
- Payment dates are tied to the current invoice, so a new unpaid invoice does not inherit an earlier payment date. Prior invoices and payment history remain preserved.
- Released OPD lab results are appended to the OPD investigation field. Paid laboratory requests create one cashier charge per doctor-selected test.
- Run `npm test` to verify the package.

# Borkeo EMR v16.2 — IPD ward fees, ambulance transfer tariffs and paraclinic workflow

- IPD doctors' lab and imaging orders begin free and route through the ward nurse. Lab orders follow receive → collect specimen → send to lab; imaging orders follow receive → send the patient to the ordered modality.
- Lab and Imaging staff can add an extra catalog fee to the active IPD invoice. Ward nurses are notified, can mark that the patient was told and agrees to pay, or request a free-charge approval from Admin/Director.
- Admin and Director can approve or decline free-charge requests from Home. An approved fee is voided with an audit record; earlier invoices and receipts are retained.
- Ward fee choices prioritize the current department and keep the full active catalog available. Medicine and Pediatric admission fees are 80,000៛; Emergency is 120,000៛ per 24 hours; ICU remains disabled until Admin sets and activates its price.
- Ambulance transfer-in and transfer-out use separate distance choices and the existing kilometer tariffs. Tariffs continue to follow Admin's current service-price settings.

- Ward transfer alerts open the correct waiting-admission card in Departments. After bed assignment, the occupied bed expands with Nursing Process selected as the next action.
- Nurse and Midwife accounts open the Department page as their home, then see only the Nursing Process form for their assigned ward and role.
- The ward head signs the daily IPD medicine list using the Nurse role outside Obstetrics or Midwife in Obstetrics. The six printed signature captions are Khmer and ordered as requested.
- Laboratory results print on A4 portrait sheets, split by laboratory category, with patient/specimen details and CBC reference-style headings. Hemoglobin uses g/dL, with compatible g/L entry for older results.

# Borkeo EMR v15.10 — IPD invoice separation and full ward fee catalog

- Ward nurses and midwives can add catalog service fees to the current invoice of an admitted IPD patient, see itemized current-invoice fees, and remove an unpaid fee with a required reason.
- The nursing fee selector includes the full configured service-fee catalog, starts with an empty choice, and displays the exact selected service code and price so the cashier charge matches the nurse's selection.
- Transferring a patient from OPD to an IPD ward opens a separate IPD invoice and resets that encounter's payment status to Not Yet Paid. OPD charges and receipts remain on the prior invoice.
- Removed charges stay in the audit and invoice history; previous paid invoices and receipts remain unchanged. Ward access checks restrict each nurse's fee actions to the active ward.

# Borkeo EMR v15.8 — OPD transfer and Provincial Hospital referral

- OPD doctors use a separate IPD transfer workspace to select a patient and any inpatient ward. The OPD waiting list no longer contains the transfer button; the receiving ward is notified for bed assignment.
- Settled OPD invoices notify all OPD doctors through their shared inbox. The OPD dashboard shows unread Cashier payment alerts.
- The OPD doctor home page hides Medical Records, Patient List, Departments, and Daily Ward Medicine List cards and navigation links.
- The ten complete simulated patients and their cash-payment profiles remain in the demo package without duplicate records.

# Borkeo EMR v15.4 — Clean clinical printing and cashier status sync

- OPD/IPD print sheets omit medication-entry rows without a medication name. Previous Records and its drawer are hidden from printed pages.
- Admin and Director patient lists request current payment status from Cashier and refresh it when the page returns to view, plus every 30 seconds while open.

# Borkeo EMR v15.3 — Clinical form usability

- The Previous Records side tab is now vertical and fixed to the page edge so it does not cover the clinical form.
- Clinical text areas wrap long entries and grow while typing, including the physical-examination notes.
- The Windows launcher retains the startup recovery and clearer incomplete-folder message from v15.2.

# Borkeo EMR v15.2 — Startup recovery

The Windows launcher now checks that it is running from the application folder. If `package.json` is missing but the server files are present, it starts the server directly; if the extraction is incomplete, it tells staff to extract the full ZIP. PowerShell users should run `npm start` in the folder containing `package.json`.

# Borkeo EMR v14.3 — Simplified Cashier Payment

This is a localhost, username-only **demo**. Extract this ZIP into `Borkeo_EMR_v14.3`, start it with `START_DEMO.cmd` or `npm start`, and open http://localhost:3000. Do not use real patient data or copy a `.env` into this demo.

**Changes in v14.3.** The Cashier dashboard now uses one compact service-and-payment workspace, removes the large KHR/USD summary, welcome, current-invoice, and manual partial-payment panels, and places the exchange rate in a small strip above the workspace. Fixed-amount discounts in KHR or USD and full payment exemption are available only for direct cash payment. NSSF and Health Equity Fund methods always keep the official full service fee with no discount. Existing receipt printing and payment history remain available.

**Changes in v14.2.** The Cashier service selector now includes the supplied hospital fee schedule for OPD, IPD, gynecology-obstetrics, anaesthesia, procedures, surgery, laboratory, imaging, dental care, and ambulance transport. The imported prices use the exact KHR amounts printed in the supplied list, including the 3,000៛ per-kilometre ambulance rate beyond 50 km. The schedule is applied once during upgrade so Admin/Director edits remain persistent afterward. CT remains US$115 and MRI remains US$150.

**Changes in v14.1.** Cashier payment rights now use six simple choices: direct payment, three separate NSSF methods, the poor Health Equity Fund, and the vulnerable-family fund. Direct payment opens only four sub-options: pay in full, discount, partial waiver, and full waiver. Discount and partial waiver accept a percentage; pay in full still requires a real receipt before the patient is marked paid. Existing OPD, paraclinic, IPD, invoice, partial-payment, exchange-rate, and historical billing records remain supported.

**Changes in v14.0.** The Cashier page has been rebuilt with a new application structure: dedicated hospital header, dark live patient queue, patient-focused bill header, clear KHR/USD summary, three-zone Add Service / Receive Payment / Current Bill workflow, compact exchange-rate and payment-rights settings, and a separate receipt history. The existing invoice and receipt generator is preserved.

**Changes in v13.4.** The public queue board always displays four waiting-list rows. Empty positions remain blank, and the previous “កំពុងរង់ចាំអ្នកជំងឺ” message is no longer shown.

**Changes in v13.3.** The inpatient order-delivery form now widens the patient-name column for the longest name on the report. When additional room is required, fewer medicine columns are printed on each page and remaining medicines continue on the next page. Patient names are clipped safely inside their table cell as a final safeguard and never overlap adjacent columns.

**Sex selection correction.** Opening an existing patient from the Patient List now reliably checks the saved male or female radio button after the Registration form and access controls finish loading. The patient-record browser asset has a new version URL so browsers cannot reuse the older cached script.

**Registration corrections.** Editing a patient now selects the saved male/female value in the Registration form. Staff no longer enter a queue number: the server automatically gives the first patient registered on a date number 1, the next number 2, and so on. Editing the same patient preserves that number.

**Demo Triage patients.** The ten included simulated patients are registered and ready in the Triage waiting list. Running `SEED_10_DEMO_PATIENTS.cmd` now resets those demo patients to a clean Triage-ready state and removes their earlier Triage, OPD queue and counter assignments.

**Counter and TV queue.** Triage nurses and OPD doctors select Counter 1–5 after sign-in. Opening a waiting patient automatically calls that patient to the selected counter and hides the patient from staff working at other counters. The visible left-hand list number is the TV calling number. Triage and OPD include a purple TV-display tab; the TV board shows number, patient name and counter and plays a two-tone alert after sound is enabled once.

**Paraclinic.** OPD and IPD now show the same order panel for laboratory tests, ultrasound, X-ray, CT, and MRI. Choose an order type, fill the subform, and submit. Once the paraclinic order succeeds, its selected tests or examination are appended to the corresponding **ពិនិត្យអមគ្លីនិក** field in the OPD or IPD record. That field stays editable; press **រក្សាទុក** on the medical form to keep its text in the patient record. The paraclinic order itself is saved separately when submitted. The earlier short OPD selector is hidden, and older recorded text remains readable.

**OPD handoff.** Clicking the automatic OPD message from Triage marks it read and opens that patient’s OPD form immediately. The extra subtitle above the OPD waiting list has been removed.

Run `npm test` to verify the packaged code. This demo has no PMRS2 transfer.

# Previous v11.05 features

# Borkeo EMR v11.05 — OPD form routing, editable prescriptions and separate messages

This is a localhost, username-only **demo**. Stop v11.04, extract this ZIP to `Borkeo_EMR_v11.05` beside v11.04, then run `COPY_PREVIOUS_DEMO_DATA.cmd` while both servers are stopped if you want to keep demonstration patients. Start with `START_DEMO.cmd` or `npm start` and open http://localhost:3000. Do not use a real patient database or copy a `.env` into this demo.

**Fixed OPD opening.** Clicking **បើកទម្រង់ OPD** on the queue or opening an OPD doctor's alert now opens only the OPD form. An OPD visit no longer opens the inpatient medical form.

**Prescription changes.** A signed-in doctor can save, revise and resend an OPD prescription as many times as needed before Pharmacy checks **បានទទួលឱសថ**. Each resend replaces the pending prescription in Pharmacy; the older snapshot remains available as superseded. A drawn PNG signature is optional: the authenticated doctor's name and time identify the prescription when no signature image is configured. Once Pharmacy confirms receipt, this visit's medication order and resubmission are locked; other unchanged record fields can still be saved. This confirmation represents dispensing, not administration or ingestion.

**Admin and Director.** Their notification panel shows two separate sections: direct messages addressed to that role, and patient handoffs from Triage or recorded ward transfers. Other staff can choose Administrator or Director when sending a direct message. The banner displays the username and account controls without the extra role/version text or the yellow demo ribbon. The ward medicine page now uses the same ocean colors as the other modules; its printed white request grid remains unchanged.

Run `npm test` to verify the packaged code. This demo has no real patient data and no PMRS2 transfer.

# Previous v11.04 features

This is a localhost, username-only **demo**. Stop v11.03, extract this ZIP into a new `Borkeo_EMR_v11.04` folder beside v11.03, and double-click `START_DEMO.cmd` or run `npm start`. Open http://localhost:3000. To keep demonstration patients, first run `COPY_PREVIOUS_DEMO_DATA.cmd` while the old server is stopped. It copies `data/demo.sqlite` from the neighboring v11.03 folder. Do not copy a real patient database or `.env` into this demo.

**OPD referral and queue.** When Triage saves an OPD referral, the OPD doctor's inbox receives a patient alert and a daily queue number is assigned. The Home card **បញ្ជីរង់ចាំ OPD** opens the dated waiting list. Click the patient to open their OPD form; the queue progresses from waiting to consultation to prescription sent. Saving the same referral again does not create a second number or notification. Previously triaged demo OPD patients are listed after the update, without retroactive alerts.

**Pharmacy OPD list.** After the doctor saves and submits a signed OPD prescription, Pharmacy's Home card **ចែកឱសថ OPD** shows the patient in a waiting list. Click their name to review the medicine, doses, route, notes and doctor's signature. Once the medicine has been handed over, check **បានទទួលឱសថ**. The last column turns green with the confirming staff member and time; pending patients remain red. A revised prescription becomes pending again and an outdated prescription cannot be confirmed. Receipt records dispensing confirmation, not the patient's actual ingestion.

**Editor names.** The OPD/IPD edit panel shows each authenticated doctor save and administrator medical-form save, with time. An earlier v11.03 administrator save can also appear as an explicitly unclassified older edit; its original section was not recorded. The form and printed prescription continue to show the most recently saved medical signature and the signed prescription requires a configured doctor signature. Keep separate staff usernames if the edit history must identify each person.

Run `npm test` to verify the packaged code. The ZIP excludes credentials and patient data. PMRS2 transfer remains disabled in this local demo.

# Previous v11.03 features

This is a localhost, username-only **demo**. Stop v11.02, extract this ZIP into a new `Borkeo_EMR_v11.03` folder, and double-click `START_DEMO.cmd` or run `npm start`. Open http://localhost:3000. To keep demonstration patients, use `COPY_PREVIOUS_DEMO_DATA.cmd` while the old server is stopped, before starting v11.03. It copies only `data/demo.sqlite` from the neighboring v11.02 demo folder. Do not put an actual patient database or `.env` here.

**Changes in v11.03.** The patient status label shows the name without the internal record version. Ward drug sheets reserve more room for the longest patient name on the sheet and keep the 25 medicine columns. The demo admin account has every role and ward; use **ប្តូរតួនាទី/ផ្នែក** to switch without signing out. Director can open the administrator's modules and read patient records and account activity; writing clinical notes and managing accounts remain assigned to clinical or administrator roles. Doctor saves append authenticated editor names and times in the OPD/IPD panel, while printed signatures show only the last saving doctor. Nursing saves retain timestamped earlier text as expandable daily revision notes and show the last editor on each day's table row. A stale clinical form save is rejected if the record changed since it opened.

# Previous v11.02 features

**Doctor signatures.** Before OPD prescriptions can be sent to Pharmacy or printed, an administrator must configure that doctor's PNG electronic signature in User Management → Electronic Signatures. The doctor must then sign in under their own username. The print buttons first save the current OPD form under the logged-in doctor, then print with that doctor's name and configured signature. Pharmacy messages keep an immutable copy of the authoring doctor's signature and signing time. Earlier messages that lack a signature are marked as such.

**Ward medicines and Pharmacy.** The IPD first-examination time and date start at the current local time and remain editable; older saved values are preserved. Medicines entered in the first IPD medical record appear on the sending ward's request grid for that examination date. Saved follow-ups appear on their own dates. Pharmacy receives one new-patient notification with a direct link to the ward/date grid when the first saved order adds the patient to that grid. Saving the same record again does not send a duplicate.

**Director review.** The director's Home card and drug-list review panel show pending ward lists. Only a director can approve a ward/date after reviewing it. Approval freezes the exact list and quantities for printing, with the director’s name and approval time on the printed report. The interface opens a separate pending list dated for the next day; new orders entered after approval appear there and cannot be approved until that day arrives. Pharmacy's new-patient alert links to the pending date if the prior list was already approved. The grid reports ordered supply quantities, not administration of medicines.

Run `npm test` to verify the packaged code. The ZIP excludes credentials and patient data. PMRS2 transfer remains disabled in this local demo. The v11.01 release notes follow for reference.

# Borkeo EMR v11.01 — localhost demo with username-only sign-in

This release is for **demonstration only**. Stop the previous EMR server, extract this ZIP to a new `Borkeo_EMR_v11.01` folder, open PowerShell in that folder and run `npm start`. Then open **http://localhost:3000** on the same computer. Enter `admin`, `doctor_medicine`, `pharmacy`, `registration`, or `triage` as the username; there is no password field. Other seeded ward accounts include `nurse_medicine` and `doctor_opd`. Admin can create further demo accounts without passwords. Use Sign out to switch accounts.

The demo runs on **127.0.0.1 only** and uses only `data/demo.sqlite` inside this new folder. It ignores `HOST`, `APP_ORIGIN` and `DATABASE_PATH` from an existing `.env`, so it cannot load the usual `%USERPROFILE%\Borkeo_EMR_Data\emr.sqlite`. Do not copy the previous `.env` or patient database into this demo folder. Nothing is migrated from v11.0; old usernames you created are not automatically present. Do not enter real patient information. PMRS2 transfer endpoints are disabled. Keep v11.0 for actual clinical records and password sign-in.

The OPD prescription notification and Pharmacy inbox from v11.0 are present for testing: sign in as `doctor_opd`, submit a demo OPD prescription to Pharmacy, sign out, then sign in as `pharmacy` and open the notification.

Run `npm test` to verify the packaged code. Requires Node.js 24 or later. This release ZIP contains no `.env`, password, or patient database.

# Borkeo EMR v11.0 — ward drug grid and OPD prescriptions to Pharmacy

The ward medicine request now matches the supplied Drug List.xlsx structure: 3 patient columns, 25 vertical medicine columns, 16 patient rows, a total row and six signature positions. The report has no logo. The sending ward and number of patients with medicine orders are filled automatically. The same named medicine, strength and unit shares one column across patients. The quantity in each patient's cell is the saved order total (including its prescribed duration), not just one dose. Matching medicine rows for one patient are summed. Different strengths and incompatible units stay separate. Missing quantities appear as `?`, including in the column total, rather than as zero.

Open **បណ្ណស្នើរសុំឱសថ** from Home, select the ward and date, check the quantities, and print in A4 landscape. The entire grid fits the screen width. More than 25 medicines or 16 patients continue in additional complete grids, with repeated patient headings and page numbers. Each grid has page subtotals; the last patient page in each medicine block also has the ward totals. The header's patient count is the unique number of patients in this ward's request, not the number of repeated printed rows. Only saved orders for the selected day are included, using that day's latest follow-up or admission orders on the admission date; the ward census follows recorded movements through the selected day's end.

**OPD to Pharmacy:** In the OPD form, a doctor or administrator presses **រក្សាទុក និងផ្ញើវេជ្ជបញ្ជាទៅឱសថស្ថាន**. This saves the OPD record and sends a Pharmacy notification together. The ordinary Save button remains available for drafts. Pharmacy signs in, opens its message panel, and clicks the prescription message to see the patient's submitted drugs, routes, schedules, duration, total quantity and notes. The panel refreshes every 30 seconds and also has a Refresh button. An identical submission does not create a duplicate notification. A changed submission creates a new one, and older prescription messages are visibly marked as superseded. Viewing a prescription marks its message read; it does not record dispensing or administration.

Prescription notifications store the submitted snapshot so later edits cannot silently change an earlier message. Pharmacy can access Pharmacy messages, while other wards cannot open those prescription snapshots unless they sent the message. The patient save, prescription snapshot and notification use one database transaction. Existing databases receive the new table automatically at startup.

Install into a new `Borkeo_EMR_v11.0` folder, copy your working `.env` from v10.4.7 (or the version you currently use), and run `npm test` then `npm start` there. Keep the existing database at `%USERPROFILE%\Borkeo_EMR_Data\emr.sqlite`. The release excludes `.env` and patient data. The existing PMRS2 Firefox add-on v0.2.1 is compatible and does not need reinstalling solely for this update.

# Borkeo EMR v10.4.7 — daily ward medicine request

The uploaded **Drug List.xlsx** is a blank inpatient medicine delivery request template; it contains headings, patient rows and signature boxes, but no medicine catalog. Open **បណ្ណស្នើសុំឱសថប្រចាំថ្ងៃ** from the EMR home page, choose a date and inpatient ward, check each patient's bed, name, diagnosis and saved medicines, then print the Borkeo Referral Hospital request form. The report reads admission-day medication orders and the latest saved follow-up on each chosen day. Saved PMRS2 medicine imports appear in the matching daily follow-up. If no follow-up medicine order was saved for a later day, the report leaves that day's medicines blank. Medical staff see only their active ward; pharmacy and administrators can choose any inpatient ward. The patient's list is based on recorded ward movements and bed assignments through the end of the chosen day.

**Clinical meaning:** These are recorded medicine *orders*, not verified administrations, dispensing totals or stock usage. The form and total count must not be treated as proof that any amount was supplied or given. Recheck the report before printing. For actual ward consumption, record pharmacy issues or medication administration separately.

The companion Firefox add-on **Borkeo_PMRS2_Real_Import_v0.2.1.zip** now offers `http://192.168.1.4:3000` as the first EMR address; the prior `.6`, localhost and 127.0.0.1 addresses remain available. Extract the updated add-on and reload its `manifest.json` via Firefox `about:debugging` after changing your server address. The add-on's ability to read an authenticated PMRS2 page still depends on the site's current table layout, which was not available to validate live.

# Borkeo EMR v10.4.6 — read medicines from your real PMRS2 session

This release includes a separate **Borkeo_PMRS2_Real_Import_v0.2.zip** Firefox add-on. After you sign in to [PMRS2](https://pmrs.digitalsp.gov.kh/login) yourself and open a visit's populated medicine table, the add-on reads its visible medicines. It sends the captured medicine list to a protected review page in this EMR. A doctor or administrator confirms the HEF patient, date, route, doses and unit before saving medicines to that patient's OPD prescription, IPD admission orders, or dated IPD follow-up. Existing notes and existing medicines remain in place.

**Quick setup (Firefox on the same computer as the EMR):**

1. Extract this new EMR release into a new folder. Keep the persistent patient database at `%USERPROFILE%\Borkeo_EMR_Data\emr.sqlite`. Copy your own `.env` from the old EMR folder if you configured phone access; the release does not include `.env`. In the new folder run `npm test` and `npm start`.
2. Extract **Borkeo_PMRS2_Real_Import_v0.2.zip**. In Firefox open `about:debugging`, select **This Firefox**, select **Load Temporary Add-on**, and choose the extracted add-on's `manifest.json`. Repeat after each Firefox restart; temporary add-ons do not remain installed.
3. Log in to PMRS2 in that same Firefox browser, refresh the PMRS2 page after loading the add-on, and open a specific patient's **វេជ្ជបញ្ជា** or IPD follow-up with its medicines visible. Click the Borkeo add-on icon, then **១. អានថ្នាំពីទំព័រ PMRS2**. Review the captured list, choose the EMR address matching your `.env` `APP_ORIGIN`, and click **២. បើក EMR ដើម្បីពិនិត្យ និងរក្សាទុក**.
4. Sign in to the EMR as a doctor or administrator if prompted. On the import page, confirm the matched EMR Health ID, HEF status, name and visit; choose the right OPD/IPD destination and date/time; verify medicine names, routes, units and morning/afternoon/evening/night doses. Check the review box, then click **រក្សាទុកថ្នាំក្នុង EMR**. Reopen the patient's EMR record to verify.

The current add-on works with `http://192.168.1.6:3000`, `http://localhost:3000`, and `http://127.0.0.1:3000`. If your server IP or `APP_ORIGIN` changes, its permitted address needs an update. Patient matching requires the PMRS2 URL's `pid` to equal the patient's saved EMR Health ID (ignoring spaces and hyphens). A different PMRS2 identifier cannot be guessed safely. Import requires the EMR payment profile **HEF_EQUITY** or **HEF_VULNERABLE**; other patients continue using the normal EMR workflow. Equal doses in the common QD/BID/TID/QID patterns are imported; unequal amounts or unusual patterns must be entered manually. Captured data is held in browser memory for at most ten minutes. It is discarded after a successful import and never includes your PMRS2 password.

This direction is **PMRS2 → EMR medicines** only. The v10.4.5 EMR → PMRS2 checked export is still a separate manual review workflow. The medicine reader was tested against a PMRS2 screenshot-style table and the EMR save was tested through its API; it could not be validated against a signed-in live PMRS2 medicine table from this build environment. If the real site changes its table structure, the add-on may need an adjustment. Importing medicine orders does not itself record actual medicine administration or generate the ward usage report.

# Borkeo EMR v10.4.5 — checked PMRS2 review package

- In the **ពិនិត្យទិន្នន័យ PMRS2** window, a doctor or administrator can confirm the patient's Health ID or case number, acknowledge that they checked the record and warnings, and download one JSON file. This contains mapped patient identity, triage, treatment, all saved IPD follow-ups, the OPD or discharge prescription, and the IPD discharge form.
- The server checks the saved patient's version before preparing the file. If someone edits the patient after the review was opened, the export is rejected until the review is refreshed. The action is recorded in the hospital audit log. The file records a checksum and itemized review warnings; it never includes PMRS2 credentials.
- **PMRS2 does not receive this file automatically.** We could not verify an authorized PMRS2 import/API endpoint or the authenticated form controls. An official integration specification or accessible test environment is needed before adding a button that actually submits patient data. Continue entering checked values manually in PMRS2. Keep the downloaded JSON file in a protected location; it contains patient information.

# Borkeo EMR v10.4.4 — OPD prescription and IPD discharge review for PMRS2

- The saved OPD treatment appears directly as the PMRS2 **វេជ្ជបញ្ជា** preview, without IPD follow-up or discharge sections. The OPD review button appears alongside the IPD review button.
- Each saved IPD follow-up shows a **បញ្ចេញអ្នកជំងឺ** button. A doctor or administrator can save the record, open the discharge page, and edit a prescription initially filled from the most recent dated follow-up. Saving discharge stores those edited medicines with the discharge form.
- For IPD, the PMRS2 review lists admission and every saved daily follow-up, a distinct discharge prescription, and the discharge form. BID, TID and QID use the EMR's recorded number per administration in the four morning/afternoon/evening/night columns. It preserves recorded exceptions and flags mismatched amounts.
- The route preview translates supported oral, topical, drops, inhaled, IV, IM, and subcutaneous EMR routes to the corresponding PMRS2 choices. Unspecified injections or routes without a confirmed choice remain flagged for manual selection. Strengths in mg/ml and protocol/hourly schedules also require manual review.
- This release prepares saved data for **review and manual entry**. It does not authenticate to PMRS2 or transmit patient data automatically: the target site's drug catalog, patient matching, route selection and submission have not been verified. Before discharge, a clinician must check that the final inpatient orders are appropriate as take-home medicines.
- Extract this version into a new folder; keep the existing persistent patient database at `%USERPROFILE%\Borkeo_EMR_Data\emr.sqlite`. Your `.env` is omitted; copy your own settings from your old folder if you access the EMR from a phone.

# Borkeo EMR v10.4.3 — IPD follow-up preparation for PMRS2

- On the IPD clinical examination, a clinician can press **បំពេញធម្មតាទាំងអស់** or **ធម្មតា** beside a system. Suggested normal findings fill only empty, editable fields; recorded abnormal findings remain untouched. On the PMRS2 review, a complete unchanged normal system appears as e.g. **Cardiovascular system: normal**; edited findings are shown in detail.
- Added named examination/history fields that recover values from existing anonymous EMR fields when older patient records are opened and saved.
- The IPD save now keeps all initial medication orders, including dynamically added rows, so the admission day can be reviewed after reopening a patient record.
- The authenticated **ពិនិត្យទិន្នន័យ PMRS2** button in the IPD view shows the saved admission date/time, triage vitals, history plus examination, diagnosis, initial medication orders, and subsequent saved daily follow-ups in time order. Dates and patient identifiers remain visible for verification.
- For a BID order in **គ្រាប់ / អំពូល / កាប់ស៊ុល**, the recorded *per-dose amount* fills morning and evening; afternoon and night are zero. Strength units such as mg/ml, hourly orders, protocols, missing information, and conflicting dose values are flagged for manual review instead of converted to tablet counts.
- This is a read-only preparation screen. It does not yet log into or save anything on PMRS2; staff must verify the matching PMRS2 patient, fields and medicines before entry. Save EMR edits first, then reopen the review to see the latest values.
- Run `npm test` after extracting. The release ZIP excludes your `.env` and database. Keep your existing `%USERPROFILE%\Borkeo_EMR_Data\emr.sqlite` and copy your own `.env` from the prior version if you set phone access.

# Borkeo EMR v10.4.2 — PMRS2 treatment data preparation

- Added **ករណីថ្មី / ករណីចាស់** to the shared treatment page for OPD and IPD. The selected value is saved with each patient encounter; older visits remain unselected until staff choose one.
- Kept the triage chief complaint and the doctor's OPD/IPD diagnosis under named keys. Opening and saving an older record copies its existing values from the former anonymous fields.
- Added an optional ICD-10 code field beside the doctor's IPD diagnosis. A free-text diagnosis without a code is flagged for review, never automatically assigned a code.
- Added an authenticated read-only `GET /api/pmrs2/preview?patientKey=...` endpoint. It prepares the receiving ward, OPD/IPD choice, case type, chief complaint to add with `+`, diagnosis text and ICD-10 code; **សេវាអមវេជ្ជសាស្ត្រ** defaults to **មិនមាន**. Missing required fields appear in `warnings`.
- This release prepares and previews data. It does not yet enter data into PMRS2; the target site's patient verification, symptom `+` interaction, ICD-10 selection and save behavior still need to be confirmed before live transfers.
- PMRS2 credentials and one-time codes are never stored in the EMR.

Run `npm test` and `npm start` after extracting this update. The existing patient database stays at `%USERPROFILE%\Borkeo_EMR_Data\emr.sqlite` on Windows.
The download omits local `.env` settings and any development SQLite database; copy your own `.env` from the previous installation if needed for phone access.

# Borkeo EMR v10.4.1 — invoice print fix

- Fixed the missing server route for receipt.css, which caused the invoice to print without its table layout.
- Matched the supplied invoice HTML: hospital header, seven-column bordered table (at least three rows), three totals, note and two signature areas.
- Uses the supplied original Borkeo Referral Hospital logo, without cropping.
- A4 portrait printing; table headings repeat on longer invoices and individual rows stay together.
- Bundled a Khmer font for printing without a Google Fonts connection. Printing waits for the page, font and logo.
- Uses the actual receipt number; preserves fractional service quantities.

Validation: 38 existing tests plus the invoice asset regression test passed. Rendered A4 samples fit one page (3 rows) and two pages (35 rows). Browser automation was unavailable in the build environment; final print output may vary with browser and printer settings.

Start with `npm start`, open Billing, select a patient, and use the receipt Print button.
Restart the server after installing this update, then reload the Billing page.

# Borkeo EMR v0.9.18

## Persistent patient database

Starting with v0.9.17, the default `DATABASE_PATH=auto` stores live patient data outside the release folder at `Borkeo_EMR_Data/emr.sqlite` under the Windows user profile. This prevents patient data from disappearing when a new version folder is extracted.

On first startup, the server scans older Borkeo EMR folders on the Desktop, chooses the newest prior database as the base, and merges previous patient/clinical-form records that are not already present. A daily database backup is kept in `Borkeo_EMR_Data/backups`.

Manual recovery: `npm run data:recover`

# Borkeo EMR v0.9.10

This build keeps the existing clinical, account, finance, Laboratory, Imaging, billing, ward messaging and history workflows, and standardizes the active application interface to Khmer-only presentation.

## v0.9.10 updates

- Khmer-only interface across the active pages and banners.
- Removed the visible English language switch from the clinical EMR; Khmer is the active interface language.
- Payment-status, Laboratory, Imaging, messaging, finance and account controls now use Khmer UI labels.

- Unified Admin/User Management visual theme.
- Round hospital logos across the application.
- Cleaner Lab and Imaging toolbars.
- Removed old Worklist/catalog/build/tagline text requested by the hospital.
- Ward-to-ward, ward-to-Lab and ward-to-Imaging messaging with PDF/image/text/Word attachments.
- New/unread messages are shown above staff work areas.
- Automatic messages are generated for Laboratory specimen dispatch/rejection/result return and Imaging requests/results.
- Patient history popup groups previous OPD and IPD encounters by date and Health ID.

Run `npm test` before deployment.


IMPORTANT DATA SAFETY (v0.9.17+)
Patient data is no longer stored inside the version folder by default.
It is stored in: %USERPROFILE%\Borkeo_EMR_Data\emr.sqlite on Windows.
When v0.9.17 starts for the first time, it scans older Borkeo_EMR folders on the Desktop and imports previous patient records automatically.
Daily database backups are kept in: %USERPROFILE%\Borkeo_EMR_Data\backups
Do NOT delete your older EMR folders until v0.9.17 has started once and your full patient list has been checked.
For a manual recovery scan, stop the server and run: npm run data:recover


## v12.0 Patient Summary
OPD and IPD direct views include a right-edge Patient Summary drawer. It uses deterministic, structured extraction from saved Registration, Triage, clinical, prescription, nursing and discharge fields; it does not use AI.

## v13.2 OPD Paraclinic workflow

- Triage includes a **Paraclinic** checkbox. Triage never unlocks the full OPD consultation.
- All OPD patients go to **Cashier** after Triage. Patients without Paraclinic wait in the OPD queue but remain locked for the doctor until Cashier confirms payment/eligible coverage.
- When Triage checks **Paraclinic**, the OPD doctor receives a limited review view. The doctor can select laboratory/imaging tests only and must **Send to Cashier**.
- After Cashier confirms payment or an eligible coverage type (NSSF/HEF/Exempt), the paraclinic orders are released to the Lab/Imaging worklists and the full OPD form becomes editable.
- The OPD doctor then reviews results and completes the consultation.
- IPD paraclinic workflow remains unchanged: nursing dispatch is still required before laboratory processing.



## v13.2 OPD pre-payment doctor review

When Triage marks **Paraclinic**, the OPD doctor receives a limited pre-payment review screen. The doctor can see the full OPD form for reference, but all OPD clinical input is read-only/locked. The doctor can select any available Laboratory or Imaging service from the Paraclinic panel and then send the selected requests to Cashier. Cashier confirmation is still required before the patient reaches the normal OPD consultation workflow.

The OPD form automatically displays the saved Triage vital signs (temperature, blood pressure, pulse, respiratory rate, SpO2, weight, and height) as read-only values; the doctor does not re-enter them.

## v13.2 Queue and paraclinic controls

- The public queue display is service-specific: `?service=TRIAGE` for `ផ្នែកបែងចែកជំងឺ` and `?service=OPD` for `បន្ទប់ពិគ្រោះ`.
- The public queue table is exactly three columns: `ល.រ`, `ឈ្មោះ`, and `កន្លែងបែងចែកជំងឺ` / `បន្ទប់ពិគ្រោះ`, with four waiting rows. The currently called patient is shown separately above it.
- Skipping a patient removes that patient from the four-row waiting table without deleting the original queue number. Calling another patient pulls the next queue number up. A skipped/late patient remains in a separate staff list until called and completed.
- Triage staff are restricted to the Triage queue; OPD queue API access is restricted to OPD doctors, Admin, and Director.
- A laboratory test or imaging examination cannot be ordered twice in the same visit while an active order exists. A pending order can be deleted before department processing starts.

## Simulated registration records in every release
Every local demo release includes 10 clearly marked simulated patients with fully populated Registration fields, an even 5 male / 5 female mix, and the direct cash payment profile. The demo database is refreshed from the same 10 profiles at each local-demo startup without creating duplicates. These are not real cash receipts: cashier payments are not fabricated. This seeder is restricted to the isolated localhost demo database and never runs in real-data hosting mode.


## v13.2 Responsive layout
The web interface now uses a shared responsive layout layer across the protected pages and login screen. Live clinical forms, dashboards, tables, queues, banners, grids, and navigation adapt to large monitors, standard office laptops, tablets, and small screens. Data tables remain horizontally scrollable where their clinical columns require a wider layout, while A4/print layouts are not changed by the responsive screen rules.


## v13.2 OPD direct laboratory workflow

For OPD patients, a paid laboratory order is sent directly to the Laboratory. The patient goes to the laboratory, where the laboratory technician receives the patient and collects the specimen at the laboratory. There is no separate ward sample-collection or ward-dispatch step for OPD laboratory orders. The laboratory technician can enter the results directly and release them to the OPD doctor. The OPD doctor receives a direct laboratory-result message and can review the returned result. IPD laboratory requests continue to use the ward collection and dispatch workflow.

## v13.2 Triage print behavior
The Triage screen keeps the Paraclinic routing checkbox for the workflow that lets the OPD doctor review laboratory/imaging needs first, but the Paraclinic routing control is excluded from the printed Triage form. The printed form therefore contains the clinical Triage information without the internal routing checkbox.
- Admins can set a facility name in Khmer and English and upload or remove a facility logo. Saved branding appears across the EMR and on printed invoices.
- OPD doctors can start a ward transfer or Provincial Hospital referral directly from the OPD clinical form. Provincial referrals save a discharge/referral record with diagnosis, time, and transport.
