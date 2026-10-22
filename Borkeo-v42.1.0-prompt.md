Read AGENTS.md first and follow it. This prompt is the approved update, so you may code it.
Base: the current project (v42.0.0). New version: 42.1.0.
Do not touch patient data or any file under data/. Test only in a disposable copy with synthetic patients.
UI text is Khmer only (English only when the interface is switched to EN). No "Khmer / English" slash text.

WORK MODE - AUTO NEXT
Work through the phases in this order:
Phase 1 = Part A, Phase 2 = Part B, Phase 3 = Part C, Phase 4 = Part D.
Do not stop to ask me between phases.
At the end of each phase:
  1. Run npm test and npm run check:khmer.
  2. If anything fails, fix it before moving on.
  3. Print one short line, for example:
     "Phase 1 done - tests 903/903 pass - starting Phase 2".
  4. Start the next phase immediately.
Stop and ask me only if:
  - a change would delete or overwrite patient data, or
  - a test still fails after 3 attempts to fix it, or
  - two rules in this prompt contradict each other.
In those cases, explain the problem in one short paragraph and wait.
After Phase 4, give the final report from Part D step 5.
This WORK MODE overrides the "discuss one at a time / wait for approval" rule in AGENTS.md, for this update only.

GOAL
The Superuser account becomes a "switch user type" account. It is always exactly ONE real staff user type at a time, chosen with a button. While switched, it behaves 100% like a real account of that type:
- the same side menu
- the same pages, buttons and data
- the same server refusals
- the same message bell
Real staff accounts must not change at all: their menus, links and permissions stay exactly as in v42.0.0 (docs/nav-roles.md).

PART A - Remove the old Superuser powers
1. Remove the "all buttons" Superuser mode.
   - The SUPERUSER role can no longer be an active role.
   - In server/superuser.mjs ensureSuperuser(), give the account every real role (USER_ROLES without 'SUPERUSER') and every ward, including the new infectious ward from Part C.
   - Remove the SUPERUSER row from user_roles for that account.
   - Keep the username, the password behaviour and the e-signature as they are.
2. Remove the v42.0 automatic role switch on page open:
   - superuserPageContext() and PAGE_RULES in server/superuser.mjs
   - the call to it in server/server.mjs (the "v42.0: the Superuser becomes the staff role..." block)
3. isSuperuser(session) in server/access.mjs must only identify the account (username 'superuser'). It must never grant a permission.
   - Remove every permission bypass that uses isSuperuser(), identity.isSuperuser, user.isSuperuser, or a username === 'superuser' check, on the server and in public/*.js.
   - Remove 'SUPERUSER' from every role list that grants access.
   - Search the whole project: grep -rn -i superuser server public protected
   - Known places include: access.mjs (canAccessPatient, roleCanPage, roleRequiresWard, roleWardAllowed, validContexts, defaultContext, buildIdentity), encounter-access.mjs, messages.mjs, requests.mjs, ward-medicine-approvals.mjs, ward-medicines.mjs, invoice-edits.mjs, medication-safety.mjs, record-access.mjs, clinical-summary.mjs, periop-forms.mjs, payment-policy.mjs, hef-lookup.mjs, nssf-lookup.mjs, symptoms.mjs, health-facility.mjs, routes/*.mjs, server.mjs (role sets, landingPathForRole, the /ipd-transfer and /opd-paraclinic-nurse checks), public/nav-config.js (itemVisible), emr-permissions.js (including the SUPERUSER switchPage block), patient-list.js, opd-queue.js, paraclinic.js, billing.js, expenses.js, finance.js, admin-users.js, emr-patient-record.js.
   - Only keep the checks needed for the new switch button (Part B) and for audit.
   - ONE exception to keep: if a rule stops a user from reviewing or approving a request that the same account submitted, allow it only for the Superuser account. One person must still be able to take a patient through every step. Report where you made this exception.
4. messages.mjs: the bell, the message list and "complete" use the active role and ward, exactly as for real staff.
   - No aggregated inbox.
   - A task completed while switched to LAB is recorded for the LAB group.
5. Old sessions whose active_role is 'SUPERUSER' must be treated as "no role chosen", so they go to the picker.

PART B - The switch user type button and picker
1. After login, the Superuser always goes to the user type picker first (/context), never to /home.
   - Use the needsContext flow: the Superuser starts every login with no active role.
2. Picker (/context page and the button window), Khmer labels:
   - Pick the role first. All 15 roles are listed: ADMIN, DIRECTOR, VICE_DIRECTOR, REGISTRATION, TRIAGE, DOCTOR, NURSE, MIDWIFE, CHIEF_WARD, WARD_HEAD, LAB, IMAGING, PHARMACY, CLERK (បេឡា), ACCOUNTANT.
   - Then pick the ward, only for roles that need one. Use the existing rules: Midwife = obstetric only; Nurse = not obstetric; Chief ward and Ward head = not OPD; Doctor = any ward including OPD.
   - Add the missing labels in public/context.js (VICE_DIRECTOR, and any other missing role).
3. A "switch user type" button (Khmer label: ប្តូរប្រភេទអ្នកប្រើ) is always visible in the top bar of every page, ONLY for the Superuser account.
   - It opens a small window with the same role and ward selects and calls POST /api/auth/context.
   - Real staff do not see this button; their existing role switch stays as it is.
4. After a switch, go to the landing page of that user type, the same as a real login.
   - Make /api/auth/context return the landing path from landingPathForRole() in server.mjs, and use it in both context.js and the new window, so there is one source of truth.
   - The OPD nurse lands on /opd-paraclinic-nurse; ward nurses and midwives land on /departments.
5. The role never changes by itself. Only the switch button or the picker changes it.
6. Audit every switch: WORK_CONTEXT_CHANGED with { role, wardCode, switchedBy: 'Superuser' }.
7. Signatures saved while switched show "Superuser · <Khmer role label>" (for example: Superuser · ចុះឈ្មោះ).
   - Check signatureSnapshot / esign.mjs and do this without changing how real staff signatures look.

PART C - New Infectious diseases ward (from Triage)
Triage already has "ផ្នែកជំងឺឆ្លង" (code 'infectious', mode ipd, hefCode RH-IPDGen) in the "Other" list of public/emr-patient-record.js. The server does not know this ward, so a patient sent there belongs to no ward and nobody can open them.
1. Add { code: 'infectious', nameKh: 'ផ្នែកជំងឺឆ្លង', nameEn: 'Infectious Diseases' } to WARDS in server/access.mjs.
2. Find every other ward or department list and add it where the other IPD wards (for example TB) appear, with the same structure:
   - bed-management / departments and rooms
   - finance.mjs FINANCE_DEPARTMENTS
   - daily-report.mjs
   - ward-medicine-matrix / ward-medicines
   - default-ward-users.mjs
   - public/departments.js
   - nav and message destinations
   - anything else found by grep for 'tb' / 'surgery' ward lists
   If beds or rooms must be created, use the same layout as the TB ward, and report how many you created.
3. Result: Triage sends a patient to Infectious diseases. A Doctor, Nurse, Chief ward or Ward head of that ward (real or Superuser switched) sees the patient in Wards and beds and can open the record. Ward medicines and the daily report include the ward.

PART D - Tests, version, delivery
1. Replace tests/v420-superuser-page-roles.test.mjs and update tests/v418-superuser.test.mjs so they test the NEW behaviour:
   - After login the Superuser must pick a user type (needsContext).
   - After switching to REGISTRATION, the side menu items are exactly: register, patient-list, appointments.
   - The same exact-menu check for TRIAGE, DOCTOR@opd, DOCTOR@medicine, NURSE@opd, NURSE@medicine, MIDWIFE@obstetric, LAB, IMAGING, PHARMACY, CLERK, ACCOUNTANT, DIRECTOR, ADMIN. Each menu must equal the menu of a real account of that type.
   - As REGISTRATION, /lab, /billing and /finance are refused (403), the same as for a real Registration account.
   - As NURSE in Medicine, a Surgery patient is refused, the same as for a real nurse.
   - The bell shows only the active team's messages; completing as LAB completes it for real LAB staff.
   - Opening pages never changes the role.
   - The switch button exists only for the Superuser.
   - Triage to Infectious diseases: an infectious ward doctor and nurse can open the patient.
   - Real staff menus are unchanged (tests/v398-side-navigation.test.mjs must still pass unchanged).
2. Run npm test (all must pass) and npm run check:khmer.
3. Click-test in a browser with synthetic patients. Log in as Superuser, switch user type for each step, and confirm every side menu button opens:
   - register -> triage to OPD -> cashier -> OPD doctor -> lab -> pharmacy
   - register -> triage to Infectious diseases -> ward doctor -> ward nurse -> daily ward medicines -> director
4. Version 42.1.0 in package.json, public/login.html (v42.1), CHANGELOG.md and the accessibility test expectation.
5. Write ONE file, Borkeo-EMR-v42.1.0-update.txt, in the same format as Borkeo-EMR-v42.0.0-update.txt:
   - what was wrong
   - what changed
   - the list of files
   - installation steps, one at a time
   - the full unified diff against v42.0.0
6. At the end, give me a short report:
   - the files changed
   - where the self-approval exception was kept
   - how many infectious ward beds or rooms were created
   - anything you could not do
