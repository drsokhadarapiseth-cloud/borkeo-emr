Read AGENTS.md first and follow it. This prompt is the approved update, so you may code it.
Base: the current project in this folder. Read the version in package.json and raise it by one minor step.
Do not touch patient data. Never delete, move or upload a real patient database, a backup or a patient upload. Test only in a disposable copy with synthetic patients.
UI text is Khmer only (English only when the interface is switched to EN). No "Khmer / English" slash text.

WORK MODE - AUTO NEXT
Work through Phase 1, Phase 2, Phase 3, Phase 4 in this order.
Do not stop to ask me between phases.
At the end of each phase:
  1. Run npm test and npm run check:khmer.
  2. If anything fails, fix it before moving on.
  3. Print one short line, for example:
     "Phase 1 done - tests pass - starting Phase 2".
  4. Start the next phase immediately.
Stop and ask me only if:
  - a change would delete or overwrite patient data, or
  - you find real patient data in the GitHub history (Phase 1 step 4), or
  - a test still fails after 3 attempts to fix it, or
  - two rules in this prompt contradict each other.
In those cases, explain the problem in one short paragraph and wait.
This WORK MODE overrides the "discuss one at a time / wait for approval" rule in AGENTS.md, for this update only.

BACKGROUND
I tried to host Borkeo EMR on Vercel and got "404 NOT_FOUND". Vercel cannot run this project as it is:
- server/server.mjs is a web server that must run all the time; Vercel only runs short functions.
- The SQLite database (node:sqlite), patient uploads and backups are files; Vercel deletes saved files after each request.
Do NOT convert the project to Vercel serverless functions and do NOT replace the database. Instead, prepare it for a Node.js host that keeps a server running and has a permanent disk (Railway, Render or Fly.io). Railway is my first choice.

PHASE 1 - GitHub safety
1. Run "git remote -v" and "git status". Print the GitHub repository name (owner/name) and the current branch.
2. If the GitHub CLI is installed, run "gh repo view --json visibility,nameWithOwner" and confirm the repository is PRIVATE. If it is public, stop and tell me.
3. Create or update .gitignore so these are never uploaded:
     node_modules/
     .env and .env.*        (keep .env.example if it exists)
     data/uploads/
     any backups folder used by server/backup.mjs and scripts/backup-database.mjs
     *.sqlite, *.sqlite-wal, *.sqlite-shm, *.db, except data/demo.sqlite (test data only, it stays)
     logs and *.log
     Borkeo_EMR_Data/
   Check server/config.mjs, server/backup.mjs, server/patient-photo.mjs and server/record-access.mjs for every folder where patient data, photos, scanned documents or backups are written, and add each one.
4. Check the full Git history for patient data:
     git log --all --name-only --pretty=format: | sort -u
   Look for any .sqlite or .db file other than data/demo.sqlite, anything in data/uploads, any backup file, any .env file.
   - If none: continue.
   - If any is found: STOP. Show me the list. Do not rewrite history yourself; I will decide.
5. For files that are tracked now but are covered by the new .gitignore: run "git rm --cached <file>" so they leave GitHub but stay on my computer. Never delete them from disk.

PHASE 2 - Security for an online server (production mode only)
Local use on the hospital Wi-Fi (npm start, Start-Borkeo-WiFi.bat, demo mode) must keep working exactly as today, including Superuser / 1234 for local testing.
1. In production (NODE_ENV=production or EMR_MODE=production), server/superuser.mjs must not use the password 1234 and must not reset it at every start:
   - Read the password from the SUPERUSER_PASSWORD environment variable.
   - If SUPERUSER_PASSWORD is missing or shorter than 12 characters, the Superuser account cannot log in in production (inactive), and the server logs one clear warning. The server still starts.
   - Never print the password in logs.
2. In production, the login page must not list accounts or show quick demo logins (check /api/auth/config and public/login.js).
3. Check the server works behind the host's HTTPS proxy:
   - APP_ORIGIN = the public https address, used by the CSRF / origin checks
   - COOKIE_SECURE=true
   - HOST=0.0.0.0 and PORT from the host
   - if the server checks https or the client IP, it must read X-Forwarded-Proto / X-Forwarded-For only when a TRUST_PROXY=true setting is on.
   Check that login lockout and the record view log still record the real client IP behind the proxy.
4. Add tests for: production refuses Superuser without SUPERUSER_PASSWORD; production accepts it with a 12+ character password; local demo mode still accepts Superuser / 1234; production login page lists no accounts.

PHASE 3 - Ready for hosting (Railway first)
1. Add one setting, DATA_DIR. When it is set, everything that must survive a restart is stored inside it:
     the database (DATA_DIR/emr.sqlite, unless DATABASE_PATH is set)
     patient uploads, photos and scanned documents
     backups
   When DATA_DIR is not set, keep today's locations exactly (the database in ~/Borkeo_EMR_Data/emr.sqlite, uploads in data/uploads, and so on), so the hospital computer does not change.
2. Add a Dockerfile:
   - FROM node:24-slim (node:sqlite needs Node 24)
   - copy the project without node_modules, .git, data/uploads, backups, .env
   - npm ci --omit=dev only if the project has dependencies (it has no runtime npm packages)
   - ENV NODE_ENV=production HOST=0.0.0.0 DATA_DIR=/data
   - start with: node server/server.mjs
   Add a matching .dockerignore.
3. If the server has a health check route, use it; if not, add GET /api/health that returns {"ok":true} with no patient data and no login needed.
4. Add .env.example listing every setting with a short comment and no real secrets: NODE_ENV, PORT, HOST, APP_ORIGIN, COOKIE_SECURE, TRUST_PROXY, DATA_DIR, DATABASE_PATH, SUPERUSER_PASSWORD, SESSION_TTL_MINUTES, LOGIN_MAX_ATTEMPTS, LOG_LEVEL.
5. Remove vercel.json if it exists.
6. Write docs/DEPLOY.md in simple English, one step at a time:
   - Railway: create a project from the private GitHub repository, add a Volume mounted at /data, set the variables (NODE_ENV=production, APP_ORIGIN=https://<railway address>, COOKIE_SECURE=true, TRUST_PROXY=true, DATA_DIR=/data, SUPERUSER_PASSWORD=<12+ characters>), deploy, open the address, log in.
   - How to make a backup from the server and how to download it.
   - How to move the existing hospital database to the server (copy emr.sqlite into the volume) only after the hospital approves storing patient data outside the hospital.
   - Short notes for Render (needs a paid plan with a persistent disk) and Fly.io (volume).
   - Why Vercel does not work (two sentences).
7. Test in a disposable copy: build and run the Docker image if Docker is installed (otherwise run with the same environment variables on Node 24). Register a synthetic patient, restart, and check the patient is still there.

PHASE 4 - Version, delivery, push
1. Version in package.json, public/login.html and CHANGELOG.md; update any test that checks the version. Run npm test and npm run check:khmer: all must pass.
2. Write ONE file, Borkeo-EMR-<new version>-update.txt, in the same format as the latest update file: what was wrong, what changed, the files, installation steps one at a time, the full unified diff.
3. Commit on a NEW branch named hosting-<new version> (do not commit to main), with a clear message. Push the branch to GitHub.
   Before pushing, run "git status" and "git diff --cached --name-only" and check that no .sqlite (except data/demo.sqlite), .env, upload or backup file is in the commit.
4. Final report:
   - the repository name (owner/name) and the branch name
   - the files changed
   - the result of the GitHub history check (Phase 1 step 4)
   - the exact Railway variables I must set
   - anything you could not do.
