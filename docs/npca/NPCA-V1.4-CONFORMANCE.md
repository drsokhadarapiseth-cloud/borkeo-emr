# Borkeo EMR: conformance with the NPCA EMR Clinical Data Integration Specification v1.4

For the NPCA integration team (Department of Data Management and Information
Technology). Borkeo EMR version 48.0.0. This document maps every section of the
specification to the EMR implementation, so NPCA can review it before
connecting the EMR to the test environment.

Status of the work: the integration is built and tested locally with synthetic
patients and a local test server that copies the NPCA API. **It has not yet been
connected to the NPCA test environment**: credentials, the system code and the
health facility code are still needed (section 3). NPCA is turned off by
default and nothing is sent until an administrator turns it on.

The sample payloads requested in "Related documents" are in
[`approval-pack/`](approval-pack/README.md).

## Summary

| Spec | Topic | Status |
| --- | --- | --- |
| 1.4 | REST JSON over HTTPS, ICD-10, ISO-8601 `+07:00`, NCDD address | Done |
| 2.1 / 4.1 | OAuth 2.0 password grant, Bearer token, refresh | Done |
| 2.1 / 4.2 | Beneficiary search before submission, SPID | Done |
| 2.1 / 4.3 | Visit submission, `{"visits":[...]}` | Done |
| 2.1 / 4.4 / 4.5 | Processing result, polling every 8 hours, statuses 1/2/3/5 | Done |
| 4.4 | Date-range check (`discharged_at_from/to`, `admitted_at_from/to`) | Done in v48.0 |
| 2.2.1 / 2.2.2 | Incomplete case (status 3) and complete case (5 → 1 or 2) | Done |
| 4.3.2 | Local validation before sending, duplicate visit check | Done |
| 4.5.3 / 4.5.5 / 4.5.6 | Status and failure reason shown; correct and resubmit | Done |
| 4.6 | Success, 400, 401, 403, 422, 500 handling | Done |
| 5 / 6 / 7 | All base, core and encounter components | Done (see notes) |
| 8 | Clinical data forms, the 7 form codes | Done |
| 3 | NPCA credentials, system code, facility code | **Waiting for NPCA** |

## 1. Overview and standards (spec 1.4)

- Every call is HTTPS. The EMR refuses an address that is not HTTPS, has a
  user name or password in it, or has a path. Plain HTTP is accepted only by
  the automated tests, on the computer itself (127.0.0.1).
- Diagnoses use ICD-10 codes from the EMR ICD-10 list. A code not in the list
  blocks the submission; no code is guessed.
- All dates and times are sent as `YYYY-MM-DDTHH:mm:ss.sss+07:00` in Cambodia
  time, whatever the time zone of the computer. Birth dates are `YYYY-MM-DD`.
- Addresses use the NCDD codes and Khmer names of province, district, commune
  and village from the gazetteer in the EMR. An address that is not an exact
  NCDD match blocks the submission.
- Sex, marital status, nationality, admission type, visit type, discharge type,
  visit outcome, payment type, vital-sign names, medical-history sections,
  physical-examination systems and form values are sent only as codes or names
  from the NPCA v1.4 reference workbook (`external_standard_data_references_v1.4.xlsx`).
  A value outside the workbook blocks the submission.

## 2. Integration flow (spec 2)

| Spec step | In the EMR |
| --- | --- |
| Endpoint 1 Authentication | The token is requested once and kept in server memory until shortly before `expires_in`. It is refreshed with the refresh token, and after a 401 a new token is requested once before the call is repeated. Tokens and passwords are never written to disk, to the audit log or to the screen. |
| Endpoint 2 Beneficiary search | Registration: the clerk enters the card number, the EMR shows the household members found, the clerk chooses the patient. The SPID, NPCA patient code and benefit cards are saved with the patient. A dead patient, a patient without explicit eligibility or without SPID cannot be used for a claim. A later check that no longer finds the patient eligible removes the claim link. |
| Endpoint 3 Visit submission | Cashier, accountant or ADMIN opens the NPCA page, reviews the payload and the list of problems, and submits. A queue in the database sends the visits one at a time, keeps them through a power cut or internet loss, and tries again later. |
| Endpoint 4 Tracking | After status 5 or 3 the EMR asks for the result every 8 hours (configurable). It stops when the status is 1 Ready or 2 Failed. |
| Step 3.1 Submission initiation | OPD: after the treatment is finished (pharmacy dispensing or OPD discharge). IPD: after discharge. IPD HEF Poor: may be sent after admission (status 3) and updated after discharge with the same visit code. |
| Step 3.2 EMR portal validation | Required fields, data format, reference codes and the linking rules of 4.3.2 are checked before anything is sent; each problem is shown with a link to the screen where it is corrected. |

## 3. Security and authentication (spec 3)

| Header | Value |
| --- | --- |
| `Authorization` | `Bearer <access_token>` |
| `Content-Type` / `Accept` | `application/json` |
| `X-System-Code` | from the `NPCA_SYSTEM_CODE` setting, given by NPCA |
| `X-Health-Facility-Code` | from the `NPCA_FACILITY_CODE` setting, given by NPCA |

The client ID, client secret, user name and password are kept in the server
`.env` file of the hospital and are never shown, logged or sent anywhere other
than the NPCA token endpoint. Only ADMIN can test the connection. Redirects are
refused, every call has a time limit (15 s by default).

**Needed from NPCA:** test environment address, client ID and secret, user name
and password, system code, health facility code.

## 4. API endpoints (spec 4)

| Spec | Method and path used | Setting |
| --- | --- | --- |
| 4.1 | `POST /oauth/token` | `NPCA_TOKEN_PATH` |
| 4.2 | `GET /api/v1/external/beneficiary/search?card_number=` | `NPCA_SEARCH_PATH` |
| 4.3 | `POST /api/v1/external/visits` | `NPCA_SUBMIT_PATH` |
| 4.4 | `GET /api/v1/external/visits/processed` | `NPCA_PROCESSED_PATH` |

Section 4.3 writes the submission path as `/api/external/v1/visits` while 4.2
and 4.4 use `/api/v1/external/...`; the EMR uses `/api/v1/external/visits` (as in
the NPCA Postman collection) and the path can be changed in the settings
without a code change. **Please confirm the path.**

- **4.3 response:** `status`, `visit_ulid` (also `uuld` as written in 4.3) and
  `visit_code` are saved.
- **4.3.2 duplicate visit check:** every visit has one stable visit code. A visit
  that is Ready (1) or Processing (5), or already in the queue, cannot be sent
  again. A Failed (2) or Pending (3) visit is sent again with the same visit
  code, and only after its data has changed.
- **4.4 processing endpoint:**
  - Each submitted visit is checked with `visit_code`.
  - Since v48.0 the NPCA page also has a date-range check. It sends
    `discharged_at_from` / `discharged_at_to` (or `admitted_at_from` /
    `admitted_at_to`) with `per_page=100`, follows the pages (`last_page`), and
    updates every visit this EMR submitted.
  - The status is read as a number (5, 3, 2, 1) or as the name in 4.5.4
    (processing, pending, failed, ready).
- **4.5.3 to 4.5.6:**
  - The NPCA page shows Processing / Pending / Failed / Ready (in Khmer by
    default) and the failure reason returned by NPCA.
  - The visit has a Review button and a link to the screen to correct.
  - After correction it is submitted again.
- **4.6:** the HTTP status decides what happens; `success:false` is never taken
  as success.
  - 400, 403 and 422 stop the visit and show the reason for correction.
  - After a 401 the token is renewed once.
  - A 500 or no answer can mean NPCA received the visit, so the EMR first asks
    the processing endpoint and only then sends the same visit code again, with
    waiting times that grow up to 8 hours.

## 5–7. Components

| Spec | Component | Source in the EMR | Notes |
| --- | --- | --- | --- |
| 5.1 | Encounter | OPD consultation, IPD admission, emergency, surgery, daily progress note | Stable codes; `class` "OPD" / "IPD" / "EMERGENCY" is sent (v48.0); surgery takes the visit class, progress notes IPD. |
| 5.2 | Observations | vital signs, history, examination | `value_type` and `value_unit` as in 5.2.2. |
| 6.1 | Patient | Registration | Health ID as `code`, SPID from the beneficiary search, NCDD address, identifications from the benefit cards. `occupation` and `disabilities` are sent when Registration has them (v48.0). Photos are not sent (no public URL). |
| 6.2 | Visit | Registration, triage, discharge | `health_facility_code` from the settings; admission, discharge, outcome and visit type as workbook codes; `followup_at` when an appointment exists. |
| 6.3 | Triage | Triage screen | Exactly one triage, recorded before the first consultation, with height and weight. |
| 6.4 | Vital signs | Triage and IPD daily monitoring | All six required signs at triage; random glucose when measured. Linked to the triage or progress note code. |
| 6.5 | Medical histories | IPD / OPD history fields and the allergy list | The nine section names of the workbook; empty sections are not sent (6.5.4 note). |
| 6.6 | Physical examinations | IPD examination | The eleven system names of the workbook. |
| 6.7 | Laboratories | Laboratory results released by the laboratory | Results not yet released are never sent. Reference range, interpretation, verified and recorded by / at. |
| 6.8 | Imageries | Imaging reports released by imaging | Report text and conclusion. Images are sent only when they have a public HTTPS address; patient images are never made public for this. |
| 6.9 | Diagnosis | ICD-10 admission and discharge diagnoses | `In` at admission, `Out` at discharge. Sent as `diagnosis_type` (PDF) and `diagnosis_type_name` (workbook) since v48.0. |
| 6.10 | SOAPs | OPD note, IPD daily notes | Linked to the OPD encounter or the progress note. |
| 6.11 | Prescriptions | OPD, IPD admission, daily notes, discharge medicines | CMS code as `code` (workbook) and `medicine_code` (PDF), `form` (v48.0); morning / afternoon / evening / night or `interval`; `days`; dispensed quantity and unit. Home medicines have `encounter_code` null (6.11.2 note). A medicine without a CMS code, or without dispensed quantity, blocks the submission. |
| 6.12 | Referral | IPD discharge "referred", ANC doctor-signed referral | Receiving facility name and code, reference number, transport, reason, caretaker, doctor and phone, medicines. |
| 6.13 | Consultations | Advice given to the patient | Array of strings. |
| 6.14 | Invoices | Billing | Payment type from the verified benefit card; services with NPCA service codes confirmed by the administrator; medicines with CMS codes. |
| 7.1–7.5 | Inpatient, outpatient, emergency, surgery, progress notes | As above | Surgery from the operative note and anaesthesia record. |

## 8. Clinical data forms

The seven forms of 8.1 are supported, with their fields and value sets taken
from `clinical_data_form_v1.4.xlsx`:

| Code | Form | Filled from |
| --- | --- | --- |
| ENTY-000H014 | OPD ANC | ANC record: gravida, gestational age, fundal height, fetal heart rate, LMP |
| ENTY-000001B2 | OPD PNC | PNC service and the NPCA assessment panel |
| ENTY-000016Z | Birth control | Family planning service and the NPCA assessment panel |
| ENTY-0000K1B | Abortion | Safe abortion service and the NPCA assessment panel |
| ENTY-0000K15 | Delivery | Obstetric ward, newborn record and the NPCA assessment panel |
| ENTY-00000A8C | Child examination 0–28 days | Newborn / paediatric (age ≤ 28 days) |
| ENTY-00000A9M | Child examination 1 month–5 years | Paediatric (age ≤ 5 years); see question 8 in OPEN-QUESTIONS.md, the PDF writes ENTY-000001E9 |

Each form has `visit_code`, `encounter_code` (the OPD or IPD encounter),
`form_code`, `form_name` and `form_data`, as in 8.2.

## Privacy

- No patient photo, signature image or private file address is sent.
- The payloads are kept in the hospital database so authorised staff can review
  them; the audit log records who did what, without card numbers, payloads,
  tokens or passwords.
- Only cashier, accountant and ADMIN can submit; the director can only read.
  Doctors and nurses cannot submit claims.

## What NPCA is asked to do

1. Provide the test environment and the credentials of section 3.
2. Review the sample payloads in `approval-pack/` and the questions in
   [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) (in particular 1, 4, 5, 6, 8, 11 and
   22 to 27).
3. Provide the NPCA service codes for the hospital's services (6.14.2), and the
   receiving facility codes for referrals.
4. Accept test submissions of synthetic OPD, IPD, transfer, referral and form
   cases on the test server before production credentials are issued.
