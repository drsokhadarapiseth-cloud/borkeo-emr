# Putting Borkeo EMR on an online server

Borkeo EMR is one Node.js server that runs all the time and keeps its data in
files (an SQLite database, patient uploads and backups). It needs a host that
keeps the server running and has a **permanent disk** (a "volume").
Railway is the first choice. Render and Fly.io also work (notes at the end).

The hospital computer does not change: `Start-Borkeo-WiFi.bat` keeps working
exactly as before.

> **Patient data.** Do not put the hospital's patient database online until the
> hospital has approved storing patient data outside the hospital. Until then,
> use the online server only with test (synthetic) patients.

---

## 1. Railway, one step at a time

**Step 1.** Go to https://railway.app and sign in with the GitHub account
`drsokhadarapiseth-cloud`.

**Step 2.** Click **New Project** → **Deploy from GitHub repo** → choose
`drsokhadarapiseth-cloud/borkeo-emr`. Railway may ask for permission to read
the private repository: allow it for this repository only.

**Step 3.** Choose the branch to deploy. For the first test use the branch
`hosting-42.4.0`; later use `master` once it is merged.
Railway finds the `Dockerfile` and builds the server from it.

**Step 4.** Add the permanent disk: open the service → **Volumes** (or right
click the service → **Attach Volume**) → mount path: **`/data`**.

**Step 5.** Give the server a public address: service → **Settings** →
**Networking** → **Generate Domain**. Copy the address, for example
`https://borkeo-emr-production.up.railway.app`.

**Step 6.** Set the variables: service → **Variables** → add each line:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `APP_ORIGIN` | `https://<your railway address>` (the address from step 5, no `/` at the end) |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `true` |
| `DATA_DIR` | `/data` |
| `SUPERUSER_PASSWORD` | a secret of **at least 12 characters** (write it down safely) |

Do not set `PORT` or `HOST`: Railway gives the port, and the image already
listens on `0.0.0.0`.

**Step 7.** Health check (optional but useful): service → **Settings** →
**Healthcheck Path** → `/api/health`.

**Step 8.** Click **Deploy** (Railway deploys again after each variable change).
Wait until the deployment is green. In **Deploy Logs** you should see
`Borkeo EMR v42.4 [PRODUCTION (password required)] listening ...` and
`Persistent EMR data (DATA_DIR): /data`.

**Step 9.** Open the address in the browser. The login page shows no account
list (this is correct online). Log in with **Superuser** and your
`SUPERUSER_PASSWORD`, choose a user type, and check that the pages open.

**Step 10.** Create the real staff accounts: switch to **អ្នកគ្រប់គ្រងប្រព័ន្ធ**
(Admin) → **គ្រប់គ្រងគណនី** (User accounts). The shared test accounts with
password 1234 are **not** created on an online server.

If the Superuser cannot log in: check that `SUPERUSER_PASSWORD` has at least
12 characters. The logs then show "Superuser login is disabled ..." (the
password itself is never printed).

---

## 2. Backups on the server, and how to download one

The server makes a backup copy of the database **when it starts and every 6
hours**, in `/data/backups` (the last 14 are kept).

To download the newest backup:

**Step 1.** Log in, and switch to **Admin**, **Director** or **Vice director**.

**Step 2.** In the same browser, open:
`https://<your railway address>/api/admin/backups/latest`
The browser downloads a file such as `borkeo-emr-backup-2026-10-23T....sqlite`.

**Step 3.** Keep the file safe: it contains patient data. Do not email it and do
not upload it to GitHub.

To see all backups, open `https://<your railway address>/api/admin/backups`,
then download one by name: `https://<your railway address>/api/admin/backups/<file name>`.
Every download is written to the audit log.

Railway can also take a snapshot of the whole volume: service → **Volumes** →
**Backups**.

---

## 3. Moving the hospital database to the server (only after approval)

Do this only after the hospital has approved storing patient data outside the
hospital.

**Step 1.** On the hospital computer, close the EMR server window.

**Step 2.** Make a copy of `C:\Users\<user>\Borkeo_EMR_Data\emr.sqlite`
(keep the original where it is).

**Step 3.** Before going online, give every staff account its own password:
online, nobody should still use the shared password 1234. (The server log
shows a warning with the number of accounts that still use it.)

**Step 4.** Put the copy into the volume as `/data/emr.sqlite`. With the
Railway CLI (`npm i -g @railway/cli`, then `railway login` and `railway link`
in the project folder), one simple way is:
- stop the service (set **Replicas** to 0, or remove the start command for a moment),
- open a shell on the service: `railway ssh`,
- copy the file into `/data/emr.sqlite` (for example download it from a
  private, temporary link), then start the service again.
If this is too technical, ask for help: the important rule is that the file
is named exactly `emr.sqlite` and is inside `/data`.

**Step 5.** Open the address, log in, and check a few patients.

Patient uploads (scanned documents) are in
`C:\Users\<user>\Borkeo_EMR_Data\uploads`; copy that folder to `/data/uploads`
the same way.

---

## 4. Render and Fly.io (short notes)

**Render:** create a **Web Service** from the GitHub repository (Docker).
A permanent disk needs a **paid** plan: add a **Disk** mounted at `/data`.
Set the same variables as for Railway (`APP_ORIGIN` = the `onrender.com`
address). Health check path: `/api/health`.

**Fly.io:** `fly launch` (it uses the `Dockerfile`), then
`fly volumes create borkeo_data --size 1` and mount it at `/data` in
`fly.toml` (`[mounts] source = "borkeo_data", destination = "/data"`).
Set the variables with `fly secrets set NAME=value`. Use one machine only
(SQLite is a single file on one volume).

---

## 5. Why Vercel does not work

Vercel only runs short functions that start and stop for each request, but
Borkeo EMR is a server that must keep running. Vercel also deletes saved files
after each request, so the SQLite database, uploads and backups would be lost.

---

## All settings

See `.env.example` for every setting with a short explanation.
