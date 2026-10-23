Read AGENTS.md first and follow it. This prompt is the approved update, so you may code it.
Base: the current project in this folder. Read the version in package.json and raise it by one minor step.
Do not touch patient data. Never delete, move or upload a real patient database, a backup or a patient upload. Test only in a disposable copy.
UI text is Khmer only (English only when the interface is switched to EN).

WORK MODE - AUTO NEXT
Work through Phase 1 to Phase 4 in order. Do not stop to ask me between phases.
At the end of each phase: run npm test and npm run check:khmer, fix any failure, print one short line, start the next phase.
Stop and ask me only if a change would delete or overwrite patient data, you find real patient data in the GitHub history,
a test still fails after 3 attempts, or two rules contradict each other. Explain in one short paragraph and wait.
This WORK MODE overrides the "discuss one at a time / wait for approval" rule in AGENTS.md, for this update only.

BACKGROUND
Vercel cannot run this project (it needs a server that runs all the time and an SQLite file that is kept). Railway did not work for me.
Decision: the EMR stays on the hospital computer (patient data never leaves the hospital). Staff on the hospital Wi-Fi keep using it as today.
Doctors outside the hospital reach the same server through Cloudflare Tunnel, protected by Cloudflare Access (email one-time code, only
allowed staff emails, free plan up to 50 users), at an address like https://emr.<our-domain>. A domain name is needed (about US$10 per year).
If a "Borkeo-hosting-github-prompt.md" (Railway) update was already applied, keep its .gitignore, history check, DATA_DIR and security work;
do not redo it, and remove only Railway-specific files that are no longer used.

PHASE 1 - GitHub safety (skip steps already done)
1. Print the repository name (git remote -v) and branch; with the GitHub CLI confirm the repository is PRIVATE (stop if public).
2. .gitignore: node_modules/, .env*, data/uploads/, backup folders, *.sqlite / *.sqlite-wal / *.sqlite-shm / *.db except data/demo.sqlite,
   logs, Borkeo_EMR_Data/, cloudflared credentials (*.json in the cloudflared folder, cert.pem).
3. Check the full history (git log --all --name-only) for real databases, uploads, backups, .env or tunnel credentials. If found: STOP and show me.
4. git rm --cached files that are tracked but now ignored (never delete them from disk).

PHASE 2 - One server, two doors (hospital Wi-Fi and the tunnel)
1. Add settings (in .env, documented in .env.example): PUBLIC_ORIGIN (the https tunnel address), TRUST_PROXY=true.
2. A request is "from the tunnel" when it arrives through cloudflared (from 127.0.0.1 with Cf-Connecting-Ip / X-Forwarded-Proto https headers,
   only when TRUST_PROXY=true). Requests from the hospital network keep working exactly as today (http://192.168.x.x).
3. Cookies: Secure flag on for tunnel requests; unchanged for hospital Wi-Fi requests. CSRF / origin checks accept both the local origin and
   PUBLIC_ORIGIN, nothing else.
4. Through the tunnel the server must refuse: username-only demo login, the Superuser with the password 1234 (allowed only if SUPERUSER_PASSWORD
   of 12+ characters is set), the login page account list. Inside the hospital nothing changes.
5. Login lockout, audit and the record view log record the real client IP (Cf-Connecting-Ip) for tunnel requests.
6. Tests: tunnel request refused for demo login and Superuser/1234; allowed with a strong SUPERUSER_PASSWORD; hospital Wi-Fi request unchanged;
   foreign Origin refused; secure cookie only on tunnel requests.

PHASE 3 - Tunnel setup files and guide
1. scripts/tunnel/README and Windows helper scripts to: install cloudflared, log in, create the tunnel "borkeo-emr", route emr.<domain> to
   http://127.0.0.1:<PORT>, and install it as a Windows service that starts with the computer. Credentials stay outside the project folder.
2. docs/REMOTE-ACCESS.md in simple English, one step at a time:
   - buy or move a domain to Cloudflare (free plan)
   - Cloudflare Zero Trust: create an Access application for emr.<domain>, policy "Emails" = the list of allowed staff emails, session 8 hours
   - run the helper scripts on the hospital EMR computer; set PUBLIC_ORIGIN and SUPERUSER_PASSWORD in .env; restart with Start-Borkeo-WiFi.bat
   - test from a phone on mobile data: Cloudflare email code -> Borkeo login
   - how to remove a staff member (delete the email in the Access policy) and how to switch remote access off (stop the service)
   - the computer must stay on, with internet; keep the daily backup to a second disk or USB
   - delete the old Vercel project (vercel.com -> project -> Settings -> Delete Project)
3. Update Start-Borkeo-WiFi.bat / scripts/start-wifi.mjs so the server prints both addresses (Wi-Fi and PUBLIC_ORIGIN when set).

PHASE 4 - Version, delivery, push
1. Version in package.json, public/login.html, CHANGELOG.md; update version tests; npm test and npm run check:khmer pass.
2. One update file Borkeo-EMR-<new version>-update.txt (same format, full diff, installation one step at a time).
3. Commit on a new branch hosting-<new version> (not main) and push. Before pushing, check that no database, .env, upload, backup or
   tunnel credential is in the commit.
4. Final report: repository and branch name, files changed, the history check result, the exact .env lines I must set, anything not done.
