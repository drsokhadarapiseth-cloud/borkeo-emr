# Borkeo PMRS Import v51.7.0

This is a NEW Manifest V3 extension. Disable the old Borkeo PMRS2 Helper before using it. Do not run Playwright for this workflow. Use your normal Chrome profile for both PMRS and EMR.

## Install the matching EMR update first

The receiver is in EMR **v51.7.0**. Apply `Borkeo-EMR-v51.7.0-chrome-import-update.txt` with your local coding assistant. Preserve local work, patient data, `.env`, `.gitignore` and external PMRS profiles. The extension alone cannot fill an older EMR. Only restart the updated instance on port 3001; leave the older instance on 3002 alone.

## Install the extension

1. Extract `Borkeo-PMRS-Chrome-Import-v51.7.0.zip` to a permanent folder on your computer.
2. Open `chrome://extensions`, enable **Developer mode**, choose **Load unpacked**, and select the extracted folder containing `manifest.json`.
3. Click the extension icon once to open settings (or right-click it and choose **Options**). Enter the exact EMR origin, for example `http://127.0.0.1:3001` locally or `https://your-emr.example.org` online. Do not include `/login`, `/emr`, a query string or credentials.
4. Click **Configure address** and accept access to that EMR host. The default UI is Khmer; click **EN** for English. Chrome host permissions span ports, but this extension checks the exact configured origin including the port before delivery.
5. Sign into EMR normally. Use Registration, Administrator, Vice Director, or an OPD Doctor context with registration access. Complete any password change or context selection normally.
6. In PMRS, sign in normally and open a single patient's details page. Click the extension icon once. There is no manual text selection or clipboard step.
7. The extension opens a new EMR tab. If login is needed, complete it IN THAT TAB. Pending delivery follows that tab through login and context redirects for up to ten minutes. **Resume transfer** retries waiting delivery if navigation did not trigger it; it never repeats a completed or uncertain delivery.
8. Review the filled registration form and click the existing EMR **Save**. Filled does not mean saved. If duplicate checks find the PMRS patient already registered, nothing is filled; review the existing EMR record. A check mark on the icon means the draft was filled, not saved. Right-click the icon and choose **Options** to see the result, resume waiting delivery, or cancel.

For online use the EMR server must run the matching v51.7 receiver on an HTTPS origin and provide its existing authenticated routes. PMRS does not need an API. There is no cloud Playwright process, remote browser session, credential sharing, open CORS endpoint or third-party relay.

## Scope and limits

- Registration ONLY: exact PMRS patient ID and case ID, full name, sex, age in years, phone, optional equity card and a four-part address when present. PMRS IDs go into separate PMRS/other-card fields, not hospital numbering.
- The page reader follows the operator-supplied patient card labels and structure. It refuses missing or ambiguous identity and name/sex. It preserves letters O versus digits 0. A changed PMRS layout may require a reader update. Synthetic tests are not live PMRS certification.
- No automatic patient creation, edits to existing encounters, clinical import, medication import, PMRS writes or EMR-to-PMRS export. No DOB is inferred from age. Unsupported/malformed optional fields are omitted. Staff must check name splitting, address, dates, payment category and required local fields before Save.
- Patient details remain in `chrome.storage.session` (trusted extension contexts only), not local/sync storage. The configured EMR origin alone persists. Pending data are removed after delivery, cancellation, destination-tab closure or expiry (within the next minute); browser restart/extension reload clears session storage. A delivered form still contains data until you save or close it.
- No PHI in URLs, logs, badges or diagnostics. No password, cookies, MFA code, clipboard, download or network-interception permissions. Sends data only to the configured EMR origin through its first-party page.
- If delivery becomes uncertain, inspect the EMR tab before starting again. If the destination form contains staff edits, filling is refused. Existing duplicate lookup and Save access controls remain intact.

## Verification

In a disposable code copy:

```text
npm test
npm run check:khmer
node --test tests/pmrs-extension-browser.mjs tests/pmrs-playwright-browser.mjs
```

The extension controller tests simulate Chrome events and cover login/context redirects, exact origins and ports, expiry, cancellation, untrusted messages and no replay after lost delivery results. Real headless browser tests use synthetic pages for capture and EMR form delivery, duplicate refusal, staff edits and denied sessions/roles.

An additional **installed extension** test requires full Chrome/Chromium and profile sockets. In PowerShell:

```powershell
$env:BORKEO_TEST_INSTALLED_EXTENSION = "1"
node --test tests/pmrs-extension-browser.mjs
Remove-Item Env:BORKEO_TEST_INSTALLED_EXTENSION
```

That test uses a temporary profile and grants two SYNTHETIC sites in its temporary manifest only. The production manifest retains optional EMR permissions and PMRS `activeTab` capture. It never connects to live PMRS. A separate, authorized live registration check is still needed after installation; do not use a real patient's Save action merely as a connectivity test.
