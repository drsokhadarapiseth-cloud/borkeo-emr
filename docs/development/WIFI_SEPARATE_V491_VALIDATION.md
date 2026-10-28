# Independent local EMR launchers - v49.1.0

Owner approved the discussed two-address launcher update on 28 October 2026.
Original base: 6181c53050a46405cf381e3d632bf51a4b00d7ff (49.0.0).
Branch: fix/independent-wifi-launchers.
Both local launchers are installed and tested. After automatic approval review
requested separate master approval, the owner explicitly approved merging and
pushing the verified v49.1.0 update to master. Publish by fast-forward; both local
services already run the tested launcher code and need no restart for this merge.
Code-only baseline backup:
D:\EMR\Borkeo_EMR_Code_Backups\v49.0.0-6181c530-645d5490

## Installed local copies

- Original: D:\EMR\Borkeo_EMR_Git, v49.1.0,
  http://127.0.0.1:3001. Existing hospital database/settings retained.
- Second copy: D:\EMR\Borkeo_EMR_v48.9.0_Referral, now v49.0.0,
  http://localhost:3002. The folder name is retained to preserve existing paths.
  Its database, uploads and backups are under its own instance-data directory.
  This is an isolated local copy, not a completed Provincial transfer service.

Use the distinct hostnames above on this computer. Cookies do not isolate by
port alone; opening both through the same hostname would share the cookie name.
Wi-Fi LAN addresses are still printed, but simultaneous login isolation on other
devices requires distinct hostnames too. No public hosting or transfer connection
is configured here.

Each folder's Start-Borkeo-WiFi.bat runs its own Node launcher. The old taskkill
logic is removed. A TCP preflight refuses an occupied port before opening a
database; it does not stop another EMR or an unrelated process. The original
preserves configured data paths. The second copy's wifi-instance.local.json
selects localhost:3002 and overrides inherited data paths with instance-data.
The loader rejects invalid simulation settings and linked runtime directories.
NPCA connectivity/practice is disabled for the isolated copy.

The second copy's code was backed up before changing only the launcher/helper,
version labels and local configuration. Backup:
D:\EMR\Borkeo_EMR_Code_Backups\clone-before-wifi-1793160533933
No patient database, uploads, private .env, password export or staff credentials
were copied from Borkeo. The second database starts empty with the application's
normal initial accounts; customized staff-account synchronization is not part of
this launcher update. Existing Borkeo accounts and data are retained.

## Verification

Disposable source copy and synthetic fixtures:
D:\EMR\Borkeo_EMR_Validation\v49.1-wifi-20261028

- npm test: 1,069/1,069 passed (tests-final.log).
- npm run check:khmer passed.
- Browser regression: simultaneous in-memory EMRs on 127.0.0.1 and localhost
  retain independent sessions after opening both and returning to the first;
  screenshots are in .validation-wifi-evidence (browser.log).
- Storage isolation regression overrides inherited hospital paths, rejects a
  linked data directory and verifies that an occupied-port listener survives.
- Both actual batch files launched successfully by absolute path. Both health
  endpoints returned success simultaneously. Original patient count: 22;
  second copy: 0, SQLite integrity OK.
- Both batch files were launched again with occupied ports: each exited with a
  clear refusal and both existing health endpoints remained available.

No hospital patient content was used in tests. Live checks were health requests
and read-only patient counts/integrity. Original runtime was not killed by either
launcher. No firewall, credentials or unrelated clinical logic changed.

## Install and rollback

Use each folder's Start-Borkeo-WiFi.bat. A duplicate start leaves the existing
server running. To apply launcher changes to another code-only copy, back it up,
apply Start-Borkeo-WiFi.bat and both scripts, then copy
docs/development/wifi-simulation.example.json to wifi-instance.local.json ONLY in
the separate simulation folder. Never put simulation settings in original Borkeo.
No npm dependency installation is required by this project.

Preserve databases and uploads when restoring code into a separate folder. Never
restore a synthetic validation database over hospital data. The combined update
TXT contains the complete source and nonsecret settings example; local simulation
data/settings are not committed to the Borkeo repository. .gitignore is unchanged.
