# Validation of the sample JSON

Built by `node scripts/build-npca-approval-pack.mjs` from synthetic visits (no patient data).
Each file is the exact body the EMR would POST to the visit submission endpoint, checked by the EMR validation that runs before every real submission.

| File | Sample | Builder issues | Validation errors |
| --- | --- | --- | --- |
| opd-sample.json | OPD Sample JSON | 0 | 0 |
| ipd-sample.json | IPD Sample JSON | 0 | 0 |
| transfer-opd-to-ipd-sample.json | Transfer OPD to IPD Sample JSON | 0 | 0 |
| referral-sample.json | Referral Sample JSON | 0 | 0 |
| form-anc-sample.json | Form Sample JSON (OPD ANC, ENTY-000H014) | 0 | 0 |

Placeholders to replace with NPCA values: `FACILITY-CODE-FROM-NPCA` (health_facility_code), `NPCA-SERVICE-CODE-TO-CONFIRM` (service_code, entered by ADMIN at /admin/npca after NPCA confirms the service codes), the SPID / card numbers (returned by the beneficiary search) and the receiving facility code of the referral.
