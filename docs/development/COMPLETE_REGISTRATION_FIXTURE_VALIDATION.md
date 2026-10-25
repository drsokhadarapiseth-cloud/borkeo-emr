# Complete synthetic registration fixture - v46.5.0

25 October 2026, Cambodia. Clean source base: 28f763a, supplied package 46.4.0.
Branch: feature/complete-synthetic-registration. Earlier 46.1 handoff notes were
stale; all later triage changes in 46.2-46.4 are preserved.

## Approved scope

Generate 30 synthetic patients in a disposable database, with every applicable
starred registration field filled, including sex, age and address. IDs follow
160201-YYYYMMDD-###, daily queue 001-030. Both synthetic Health ID and case number
use that pattern. This does not renumber real patients or change live registration
validation, Save/Transfer buttons, triage logic or the proposed backup tool.

## Usage and generated output

From the project folder, run:

```
node scripts/create-complete-registration-fixture.mjs
```

The command prints the location of a new temporary directory containing
registration-fixture.sqlite and FIXTURE.json. There is no destination option;
existing database paths cannot be targeted. The old destructive seed helper runs
only inside a newly created in-memory template database, never against the output
database or hospital data. Each invocation creates a separate fresh dataset.

Generated delivery dataset:
`C:\Users\Local-admin\AppData\Local\Temp\borkeo-synthetic-registration-fzuNEf\registration-fixture.sqlite`

30 IDs: 160201-20261025-001 through 160201-20261025-030. All records have explicit
synthetic markers. Do not copy this SQLite file over a hospital database.

The fixture uses existing synthetic portraits and profiles, the actual Borkeo
gazetteer hierarchy, required coverage/marital/occupation/disability/other-card
choices, and caregiver name/phone/relation/sex. Birth date and age agree; entry
dates use Asia/Phnom_Penh, including UTC date boundaries. Triage remains WAITING;
the new fixture contains no invented triage measurements.

## Verification

Disposable source root:
`C:\Users\Local-admin\AppData\Local\Temp\borkeo-registration-fixture-FQGVPC`

Only tracked source/reference catalogues, facility defaults and synthetic photos
were copied. Hospital databases, uploads, backups, password exports and .env were
excluded. Existing application tests used that copy's demo.sqlite with the usual
30 synthetic triage fixtures. New fixture tests used fresh memory/temp databases.

- npm test: 1012 passed, 0 failed (validation-tests.log).
- npm run check:khmer: passed (validation-khmer.log).
- Focused generator tests: 3 passed; cover Cambodia dates, daily ID reset, invalid
  dates/sequence limits, uniqueness, linked addresses, required stored values,
  no fabricated triage data, and separate output database creation.
- Explicit Chromium browser validation: 1 integration test passed, all 30
  patients loaded and passed the actual required-field validator; sex and age
  were populated and the displayed Health ID matched each expected ID.
- git diff --check: passed.

The existing record loader does not invoke restorePatientAddress. The fixture
browser harness explicitly hydrates linked selects with the existing address
manager, then runs the application's required-field validator for each record.
It does not claim a production address-loading repair. External HTTPS font/icon
requests are blocked in this local form/data check; local application scripts
and the actual gazetteer remain enabled. No printer acceptance is claimed.

## Source compatibility and review

The supplied package was 46.4 while visible login/server labels remained 46.1.
This release aligns all markers to 46.5. Four exact existing notification labels
from the supplied 29d9fca change were missing from Khmer approvals; those same
words are registered with matching provenance rows. No text, baseline or runtime
triage behavior was changed to resolve that metadata failure.

At the user's request, the specification was forwarded through Ollama Claude
using installed local qwen3.5:4b with no tools. Its incompatible date/address/age
proposals were not adopted. Actual project fields and catalogues govern fixtures.

Delivery: Borkeo-EMR-v46.5.0-complete-registration-fixture-update.txt. Contains an
explicit source manifest, replacement files and installation instructions only;
no generated SQLite, real patient records or credentials are included.
