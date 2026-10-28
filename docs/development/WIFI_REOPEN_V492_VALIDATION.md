# Reopen running EMRs from their batch files - v49.2.0

Owner approved with "yes code it make sure port is different from each other".
Base c212c6083bec2c977f86fe22ac5abc284b282690 (49.1.0).
Branch fix/reopen-wifi-instances. Clean baseline backup:
D:\EMR\Borkeo_EMR_Code_Backups\v49.1.0-c212c608-a90d4db7
Separate-copy changed-file backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-reopen-1793162573999

## Cause and behavior

Both EMRs were already healthy. Previously each batch file deliberately exited
with EADDRINUSE, making a normal duplicate click look like a startup failure.

Original Borkeo is pinned to http://127.0.0.1:3001; the separate copy is pinned to
http://localhost:3002. The original launcher overrides an inherited PORT/APP_ORIGIN
from the other copy while preserving its database and private configuration.
The separate copy retains its own instance-data directory and NPCA-disabled
simulation settings. Different hostnames preserve browser-cookie separation.

When a port is occupied, the launcher checks health and the EMR login-page marker
with bounded timeouts. A healthy identified EMR opens in the default browser and
the batch exits successfully, without database initialization or process restart.
An unrelated or unhealthy listener still produces an error; no process is killed.
For a free port, the normal server starts and then opens its own address.
Windows uses explorer.exe with one fixed approved URL argument, without shell
interpolation. Browser-launch failure after a new server starts leaves the server
running and prints the link for manual use. Successful reuse closes the batch
without the old misleading stopped/error message or pause; actual errors still
remain visible with a pause.

Only launcher/helper, version labels, tests and documentation change. No clinical,
financial or referral logic changes. Neither database, uploads, staff accounts
nor private settings are copied, replaced or edited by this repair.

## Validation and installation

Disposable code copy with synthetic fixtures:
D:\EMR\Borkeo_EMR_Validation\v49.2-wifi-reopen-20261028

Focused tests cover healthy reuse, non-EMR listener refusal, free-port selection,
unrelated bind errors, exact browser destinations, distinct pinned ports,
inherited storage isolation and preserving occupied listeners.

Full suite: 1,072/1,072 passed; Khmer check passed. Both actual batch files were
run against their already-running EMRs, each exited 0 and invoked the browser
with its correct URL. Both health endpoints remained healthy. Read-only before/
after patient-row comparisons were identical (original 22 patients, second copy
0). Evidence: tests.log and actual-batch-results.json in the disposable folder.
The synthetic browser test also passed: opening both hostnames retains separate
logins when returning to the first (browser.log, .validation-wifi-evidence).

The separate copy is updated in place at D:\EMR\Borkeo_EMR_v48.9.0_Referral,
from 49.0.0 to 49.1.0, preserving its existing runtime data/configuration. The
original source is 49.2.0. Folder names remain unchanged. Existing running server
processes do not need to be stopped for the launcher fix; the next click reuses
them. A later normal server restart loads the new startup version label.

Use Start-Borkeo-WiFi.bat in each respective folder. Keep the two different
hostnames above. Restore changed code from the backups if necessary; never
restore synthetic test data over either runtime database.

Master publication requires the separate explicit approval specified by the
owner's pasted instructions. Keep the tested feature checked out while the
installed local fix is in use until that approval. The full-source artifact is
Borkeo-EMR-v49.2.0-reopen-wifi-update.txt.
