# NPCA approval pack: sample JSON

For the NPCA integration team. These are the samples listed under "Related
documents" in the EMR Clinical Data Integration Specification v1.4. Each file
is the exact request body Borkeo EMR 48.0.0 would POST to the visit submission
endpoint. They were made by the EMR's own payload builder from **synthetic
visits** (no patient data) and passed the same validation that runs before
every real submission, using the real ICD-10 list, CMS medicine codes and NCDD
village list. The results are in [VALIDATION.md](VALIDATION.md).

| File | Related document | What it shows |
| --- | --- | --- |
| [opd-sample.json](opd-sample.json) | OPD Sample JSON | OPD consultation, triage and vital signs, history, examination, laboratory result, SOAP, home prescription with dispense, invoice, consultations, follow-up |
| [ipd-sample.json](ipd-sample.json) | IPD Sample JSON | Admission, two daily progress notes with vital signs and SOAP, admission medicine with times of day, discharge medicine with interval, In and Out diagnoses |
| [transfer-opd-to-ipd-sample.json](transfer-opd-to-ipd-sample.json) | Transfer OPD to IPD Sample JSON | One visit: the OPD consultation and the IPD admission as two encounters with their own codes |
| [referral-sample.json](referral-sample.json) | Referral Sample JSON | OPD visit referred out (discharge type Refer Out) with `referral.referred_to` |
| [form-anc-sample.json](form-anc-sample.json) | Form Sample JSON | OPD ANC visit with form ENTY-000H014 |

## Values to replace with NPCA values

- `FACILITY-CODE-FROM-NPCA`: the hospital's `health_facility_code`.
- `NPCA-SERVICE-CODE-TO-CONFIRM`: the NPCA service code of each billed
  service, entered by ADMIN at `/admin/npca` once NPCA confirms them.
- `SYNTHETIC-SPID-…` and `SYNTHETIC-CARD-…`: in a real visit these come from
  the beneficiary search.
- `RECEIVING-FACILITY-CODE-FROM-NPCA` and the `document_file` address in the
  referral: see questions 7 and 24 in [../OPEN-QUESTIONS.md](../OPEN-QUESTIONS.md).

## Making the pack again

```
node scripts/build-npca-approval-pack.mjs
```

It writes into this folder and exits with an error when a sample does not pass
the validation. The automated test `tests/v480-npca-pdf-alignment.test.mjs`
fails if these files are different from what the EMR builds today.
