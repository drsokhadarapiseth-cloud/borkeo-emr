# Fingerprint scanner - ready for a device (v41.3)

The consent and refusal forms already have a **Fingerprint scanner** button.
It stays greyed out until a scanner is connected. Today the patient can sign
on screen, by a thumbprint photo, or on the printed paper.

## Why a scanner needs extra software

A web browser cannot read a fingerprint scanner by itself. Every scanner
maker (for example SecuGen, DigitalPersona / HID, Futronic, ZKTeco) ships a
small program or driver ("SDK" or "web service") that runs on the computer
and lets a web page ask for a fingerprint image. Laptop and phone fingerprint
unlock (Windows Hello, Touch ID) cannot be used: it only proves the device
owner, it never gives a patient's fingerprint image.

## What to tell the supplier

Ask for a scanner whose software:
1. runs on Windows on the same computer as the browser,
2. gives the fingerprint **image** (PNG or JPEG, about 500 dpi) to a web page
   through a local web service (for example `https://localhost:...`),
3. works without internet.

## How it connects to the EMR

When the scanner is installed, one small script file is added (the developer
writes it with the maker's instructions). It must define:

```js
window.BorkeoFingerprintScanner = {
  isAvailable: () => true,             // scanner connected and ready
  capture: async () => 'data:image/png;base64,...', // one fingerprint image
};
```

The forms page then enables the button, calls `capture()`, shows the image
and saves it as the patient signature (method `scanner`), with the date and
time, exactly like the on-screen signature. The image must be a PNG or JPEG
data URL under 400,000 characters (`server/periop-forms.mjs`).

Nothing else in the EMR needs to change.
