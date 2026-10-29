# Patient-list API search and local registration - v50.0.0

Owner reported no result while searching from http://localhost:3002/patient-list
and requested admission using a patient already registered at the other hospital.
Read-only diagnosis confirmed both peers and search permissions enabled. Borkeo
had 22 local records; the provincial installation had 0. The normal patient list
searched only local records. The API lookup also omitted case/visit numbers.

## Behavior

The normal patient-list page now has a separate connected-hospital search panel.
Enter a Patient ID, case/visit number, name or telephone in the existing search
box, choose the connected facility, and click the API search button. No local
search term is silently broadcast to every peer. Results support pagination and
show the selected facility's patient, Health ID, case number, visit date and this
hospital's New Case/Old Case classification. Permission-denied and disconnected
responses remain errors; they are not silently represented as an empty result.

The API searches Health ID and case/visit numbers with Khmer-digit, whitespace,
case and dash normalization. Exact identifiers sort first. SQL wildcard
characters are escaped, queries remain parameterized, minimum length and paging
limits remain in force, and no remote write API is added.

REGISTRATION and authorized management contexts can choose Register At This
Hospital from either this panel or the connected-hospital search page. It opens
the established editable Registration view, not a medical-record viewer. The
handoff prefills identity, address and card identifiers only. Staff review and
complete locally required details, save a separate local visit, and continue
through normal triage/cashier/admission/ward rules. It never automatically admits
the patient. Source prescriptions, clinical notes, signatures, payment/eligibility
verification, discharge and bed state are not imported into the editable visit.

No previous local Patient ID match means New Case. An existing local identity
means Old Case with a new visit number; the existing local identity is preferred
and its previous visit is not overwritten. Original remote medical history stays
available through the existing read-only viewer. The source database is unchanged.

## Security and compatibility

Registration drafts are random, user-bound, expire after 30 minutes and are
consumed atomically with the local patient save. Another user, a changed patient
identity, wrong case classification, consumed/expired token or revoked/changed
peer cannot use the draft. Only a new local encounter is allowed. Source peer
and source patient references are recorded by the server; clients cannot forge
that provenance. Identity snapshots are cleared after consumption. Existing
session/CSRF, scope, financial, admission and discharge protections still apply.

The major version advances from 49.9.0 to 50.0.0 according to the owner's minor
step convention. Old tests that incorrectly capped versions at 49.x now support
future major versions and retain minimum-version/consistency checks. The saved
card-preview harness includes the additional draft state. No normal local
registration behavior is intentionally changed.

## Backups and validation

Primary baseline: 26ca41891aa0c17629ea79d4d8778eefcef1de5d, version 49.9.0.
Clean code backup:
C:\Users\Local-admin\Borkeo_EMR_Code_Backups\v49.9.0-26ca4189-3a61d45e.
Receiver baseline 49.8.0 archive:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-network-registration-20261029.
Primary target 50.0.0; independent receiver target 49.9.0.

Consistent pre-installation online backups:
- C:\Users\Local-admin\Borkeo_EMR_Data\backups\before-v500-network-registration-1793234695356.sqlite
- D:\EMR\Borkeo_EMR_v48.9.0_Referral\instance-data\backups\before-v500-network-registration-1793234695673.sqlite

Disposable synthetic root:
C:\Users\Local-admin\AppData\Local\Temp\borkeo-restored-code-jBgRZS.
All 1,080 tests and Khmer validation pass (search-registration-tests.log,
search-registration-khmer.log). Focused security cases cover identifier formats,
New/Old Case, identity-only copy, token reuse/expiry, user isolation, permissions,
CSRF, revocation and unchanged source/local previous records.

search-registration-browser.log proves the real normal-list API search, new
Registration prefill, required local questions, standard save and Patient ID
card preview, followed by an Old Case prefill for a later local visit. Desktop
and mobile screenshots under .validation-network-registration were reviewed.
search-registration-existing-browser.log confirms existing connection controls,
copy-key, read-only history and private messaging still work. No real patient
was created for testing and no physical-printer acceptance is claimed.

The owner's manually established connection grants and keys are preserved;
this release never runs pairing setup or changes their permissions. Activation
evidence is recorded in AI_HANDOFF.md. Database files, uploads, keys, .env,
.gitignore and unrelated editor files are excluded. Recovery extracts code into
a new directory without replacing live data. Delivery:
Borkeo-EMR-v50.0.0-patient-search-registration-update.txt.
