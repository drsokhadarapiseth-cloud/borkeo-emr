import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  validateCambodianPhone,
  normalizeKhmerDigits,
  NINE_DIGIT_PREFIXES,
  TEN_DIGIT_PREFIXES,
} from '../server/cambodia-phone.mjs';

const ROOT = path.resolve('.');

test('v37.1 - Version metadata consistency across package.json, login.html, server.mjs, and HTML templates', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(['37.1.0', '37.2.0', '37.3.0', '37.4.0', '37.5.0', '37.6.0', '37.7.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.ok(loginHtml.includes('v' + pkg.version.split('.').slice(0,2).join('.')), 'login.html must contain v37.1');

  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.ok(serverMjs.includes('Borkeo EMR v' + pkg.version.split('.').slice(0,2).join('.')), 'server.mjs must contain Borkeo EMR v37.1');

  const emrHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  assert.ok(emrHtml.includes('/public/cambodia-phone.js?v=3710'), 'EMR.html must load cambodia-phone.js');
  assert.ok(/\/public\/emr-patient-record\.js\?v=(3710|3730)/.test(emrHtml), 'EMR.html must cache-bust emr-patient-record.js to v3710');
  assert.ok(emrHtml.includes('/public/emr-permissions.js?v=3710'), 'EMR.html must cache-bust emr-permissions.js to v3710');
});

test('v37.1 - Prefix sets contains exactly 27 9-digit prefixes and 7 10-digit prefixes', () => {
  assert.equal(NINE_DIGIT_PREFIXES.size, 27);
  assert.equal(TEN_DIGIT_PREFIXES.size, 7);

  const expectedNine = [
    '010', '011', '012', '014', '015', '016', '017',
    '060', '061', '066', '067', '068', '069',
    '070', '077', '078',
    '081', '085', '086', '087', '089',
    '090', '092', '093', '095', '098', '099'
  ];
  for (const prefix of expectedNine) {
    assert.ok(NINE_DIGIT_PREFIXES.has(prefix), `Expected 9-digit prefix ${prefix} must exist`);
  }

  const expectedTen = ['018', '031', '071', '076', '088', '096', '097'];
  for (const prefix of expectedTen) {
    assert.ok(TEN_DIGIT_PREFIXES.has(prefix), `Expected 10-digit prefix ${prefix} must exist`);
  }
});

test('v37.1 - All 27 9-digit prefixes validate with 6 digits after prefix and reject 5 or 7 digits', () => {
  for (const prefix of NINE_DIGIT_PREFIXES) {
    // 9 digits total (6 after prefix)
    const validNum = `${prefix}123456`;
    const resValid = validateCambodianPhone(validNum);
    assert.equal(resValid.valid, true, `Prefix ${prefix} with 6 digits after should be valid`);
    assert.equal(resValid.normalized, validNum);

    // 8 digits total (5 after prefix) -> too short
    const shortNum = `${prefix}12345`;
    const resShort = validateCambodianPhone(shortNum);
    assert.equal(resShort.valid, false, `Prefix ${prefix} with 5 digits after should be invalid`);
    assert.ok(resShort.error.includes(prefix), `Error should mention prefix ${prefix}`);

    // 10 digits total (7 after prefix) -> too long
    const longNum = `${prefix}1234567`;
    const resLong = validateCambodianPhone(longNum);
    assert.equal(resLong.valid, false, `Prefix ${prefix} with 7 digits after should be invalid`);
    assert.ok(resLong.error.includes(prefix), `Error should mention prefix ${prefix}`);
  }
});

test('v37.1 - All 7 10-digit prefixes validate with 7 digits after prefix and reject 6 or 8 digits', () => {
  for (const prefix of TEN_DIGIT_PREFIXES) {
    // 10 digits total (7 after prefix)
    const validNum = `${prefix}1234567`;
    const resValid = validateCambodianPhone(validNum);
    assert.equal(resValid.valid, true, `Prefix ${prefix} with 7 digits after should be valid`);
    assert.equal(resValid.normalized, validNum);

    // 9 digits total (6 after prefix) -> too short
    const shortNum = `${prefix}123456`;
    const resShort = validateCambodianPhone(shortNum);
    assert.equal(resShort.valid, false, `Prefix ${prefix} with 6 digits after should be invalid`);
    assert.ok(resShort.error.includes(prefix), `Error should mention prefix ${prefix}`);

    // 11 digits total (8 after prefix) -> too long
    const longNum = `${prefix}12345678`;
    const resLong = validateCambodianPhone(longNum);
    assert.equal(resLong.valid, false, `Prefix ${prefix} with 8 digits after should be invalid`);
    assert.ok(resLong.error.includes(prefix), `Error should mention prefix ${prefix}`);
  }
});

test('v37.1 - Rejects unlisted prefixes and landlines', () => {
  const rejectedPrefixes = ['023', '024', '025', '045', '080', '091', '013', '019', '050'];
  for (const p of rejectedPrefixes) {
    const res = validateCambodianPhone(`${p}123456`);
    assert.equal(res.valid, false, `Prefix ${p} must be rejected`);
    assert.ok(res.error, 'Must provide an error message');
  }
});

test('v37.1 - International formatting (+855) normalization and invalid patterns', () => {
  // Valid +855 with 9-digit total mobile
  const r1 = validateCambodianPhone('+85512345678');
  assert.equal(r1.valid, true);
  assert.equal(r1.normalized, '012345678');

  // Valid +855 with spaces and hyphens
  const r2 = validateCambodianPhone('+855 12-345-678');
  assert.equal(r2.valid, true);
  assert.equal(r2.normalized, '012345678');

  // Valid +855 with 10-digit total mobile
  const r3 = validateCambodianPhone('+855 97 123 4567');
  assert.equal(r3.valid, true);
  assert.equal(r3.normalized, '0971234567');

  // Reject +855 followed by domestic leading 0
  const r4 = validateCambodianPhone('+855012345678');
  assert.equal(r4.valid, false);
  assert.ok(r4.error.includes('+855'));

  // Reject non-+855 foreign codes
  const r5 = validateCambodianPhone('+1234567890');
  assert.equal(r5.valid, false);
  const r6 = validateCambodianPhone('+84912345678');
  assert.equal(r6.valid, false);
});

test('v37.1 - Khmer digits conversion and validation', () => {
  assert.equal(normalizeKhmerDigits('០១២៣៤៥៦៧៨៩'), '0123456789');

  const khmerPhone = '០១២ ៣៤៥ ៦៧៨';
  const resKhmer = validateCambodianPhone(khmerPhone);
  assert.equal(resKhmer.valid, true);
  assert.equal(resKhmer.normalized, '012345678');

  const khmer10 = '០៩៧ ១២៣ ៤៥៦៧';
  const resKhmer10 = validateCambodianPhone(khmer10);
  assert.equal(resKhmer10.valid, true);
  assert.equal(resKhmer10.normalized, '0971234567');
});

test('v37.1 - Non-numeric characters and edge cases', () => {
  // Letters inside number
  const r1 = validateCambodianPhone('01234abc8');
  assert.equal(r1.valid, false);

  // Symbols inside number
  const r2 = validateCambodianPhone('012*345#67');
  assert.equal(r2.valid, false);

  // Whitespace only or empty
  const r3 = validateCambodianPhone('');
  assert.equal(r3.valid, true);
  assert.equal(r3.normalized, '');

  const r4 = validateCambodianPhone('   ');
  assert.equal(r4.valid, true);
  assert.equal(r4.normalized, '');

  const r5 = validateCambodianPhone(null);
  assert.equal(r5.valid, true);
});

test('v37.1 - Language-specific error messages (Khmer default vs English)', () => {
  const kmErr = validateCambodianPhone('01234abc', 'km');
  assert.equal(kmErr.valid, false);
  assert.ok(!kmErr.error.includes('/'), 'Khmer error must not contain bilingual slashes');
  assert.match(kmErr.error, /[\u1780-\u17FF]/, 'Khmer error must contain Khmer characters');

  const enErr = validateCambodianPhone('01234abc', 'en');
  assert.equal(enErr.valid, false);
  assert.ok(!enErr.error.includes('/'), 'English error must not contain bilingual slashes');
  assert.match(enErr.error, /^[A-Za-z0-9 .,!?()—\-]+$/, 'English error must be clean English');
});

test('v37.1 - UI error placeholders exist in protected and legacy EMR.html', () => {
  const protectedHtml = fs.readFileSync(path.join(ROOT, 'protected', 'EMR.html'), 'utf8');
  const legacyHtml = fs.readFileSync(path.join(ROOT, 'legacy-html', 'EMR.html'), 'utf8');

  for (const html of [protectedHtml, legacyHtml]) {
    assert.ok(html.includes('id="web_phone_error"'), 'Must have web_phone_error div');
    assert.ok(html.includes('id="web_caregiver_phone_error"'), 'Must have web_caregiver_phone_error div');
  }
});

test('v37.1 - Client cambodia-phone.js exports validateCambodianPhone to window and CommonJS', () => {
  const clientJs = fs.readFileSync(path.join(ROOT, 'public', 'cambodia-phone.js'), 'utf8');
  assert.ok(clientJs.includes('root.validateCambodianPhone = api.validateCambodianPhone'));
  assert.ok(clientJs.includes('root.normalizeKhmerDigits = api.normalizeKhmerDigits'));
  assert.ok(clientJs.includes('NINE_DIGIT_PREFIXES'));
  assert.ok(clientJs.includes('TEN_DIGIT_PREFIXES'));
});

test('v37.1 - Caregiver phone (web_caregiver_phone) validates according to Cambodian mobile policy', () => {
  // Screenshot number: 012993829 (Prefix 012 + 6 digits = 9 digits total)
  const screenshotNumber = '012993829';
  const resValid = validateCambodianPhone(screenshotNumber);
  assert.equal(resValid.valid, true, 'Screenshot number 012993829 must be valid');
  assert.equal(resValid.normalized, '012993829');

  // Caregiver phone with space: 012 993 829
  const resSpaced = validateCambodianPhone('012 993 829');
  assert.equal(resSpaced.valid, true);
  assert.equal(resSpaced.normalized, '012993829');

  // Caregiver phone with +855: +855 12 993 829
  const resIntl = validateCambodianPhone('+855 12 993 829');
  assert.equal(resIntl.valid, true);
  assert.equal(resIntl.normalized, '012993829');

  // Invalid length for caregiver phone: 01299382 (too short)
  const resShort = validateCambodianPhone('01299382');
  assert.equal(resShort.valid, false);
  assert.ok(resShort.error.includes('012'));

  // Invalid landline for caregiver phone: 023993829
  const resLandline = validateCambodianPhone('023993829');
  assert.equal(resLandline.valid, false);

  // Check emr-patient-record.js integrates validateCaregiverInfo with validateCambodianPhone
  const recordJs = fs.readFileSync(path.join(ROOT, 'public', 'emr-patient-record.js'), 'utf8');
  assert.ok(recordJs.includes('validateCambodianPhone(phoneVal'), 'validateCaregiverInfo must validate phoneVal with validateCambodianPhone');
  assert.ok(recordJs.includes('web_caregiver_phone_error'), 'Must bind to web_caregiver_phone_error');
});

