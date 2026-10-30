# Borkeo PMRS2 Helper v51.4

One-click Stage 1 import: open a PMRS2 patient summary, click Send to Borkeo,
review the EMR registration, resolve any duplicate, then save manually.
No copy/paste is required. No PMRS2 clinical export is implemented.

## Activate

1. Restart the identified EMR launcher to load v51.4.0 and refresh its tabs.
2. In chrome://extensions or edge://extensions, reload this unpacked helper.
   If necessary use Load unpacked and select this pmrs2-helper folder.
3. Refresh the PMRS2 patient tab. The status above its transfer button must show
   51.4.0. An already-open tab keeps its old content script until refreshed.
4. In the helper popup, save the receiving loopback origin INCLUDING its port:
   http://127.0.0.1:3001 or http://localhost:3002. The selected EMR must also have
   the new registration importer; updating one checkout does not update another.
5. Open one patient summary in PMRS2 and click its transfer button once.
6. If EMR opens its login page, sign in normally IN THAT SAME TAB. The pending
   transfer follows the receiving tab into registration. Never enter PMRS2
   passwords or authenticator codes into EMR or this helper.
7. Wait for confirmation on both pages, review registration and any duplicate
   warning, then save manually. Nothing saves automatically.

## Transfer architecture

The Manifest V3 worker validates the source, payload and receiving origin and
opens one canonical /emr?view=register tab. It binds pending details to that tab
and origin, so other open EMR tabs cannot consume them. Repeated clicks reuse
an identical pending transfer; changing patient during a pending transfer is
rejected. Navigation into registration is attempted at most once after login.

The EMR module announces readiness and the receiver dispatches a DOM event.
There is NO extension script tag injected into the EMR page, and NO named
cross-origin popup navigation. The old page-fill.js file is unused.
Successful registration acknowledgement includes field and duplicate counts;
only then are patient details removed from extension session storage. Pending
records expire after ten minutes when accessed and all session storage clears
when the browser session ends. No patient payload is stored in persistent
chrome.storage.local; upgrading removes legacy payload keys. Only the selected
EMR address is persisted. The source gets stage/status metadata, not other tabs'
patient data. Timeout leaves a visible retry instruction and performs no reload.

This is not a PMRS2 API integration. Staff log in manually, including their own
authenticator code. No password, OTP secret, login cookie or recovery code is
captured. The helper reads the currently visible patient page only.

## Validation and remaining live check

An actual unpacked extension was tested in a fresh disposable Edge profile,
with the supplied nested strong/span page structure using synthetic values.
HTTPS requests for the PMRS2 test page were intercepted before network access;
no live PMRS2 account/site/patient was used. The test exercised source button,
worker messages, real extension session storage, configured origin, login
redirect, registration readiness, prefill, acknowledgement, one receiving tab,
no injected script, and no automatic patient-record save.

Staff must still retry on the real PMRS2 page. Report the exact stage shown
above its button or on the EMR banner if it fails. Do not share passwords,
authenticator secrets or full patient pages.
