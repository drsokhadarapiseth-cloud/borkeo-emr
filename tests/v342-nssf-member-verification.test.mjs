import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  normalizeNssfCard,
  decryptNssfPayload,
  parseDecryptedBeneficiary,
  evaluateNssfEligibility,
  createNssfLookup,
  NSSF_LOOKUP_ROLES,
  NSSF_SOURCE,
  NSSF_API_ENDPOINT
} from '../server/nssf-lookup.mjs';
import {createEmrServer} from '../server/server.mjs';

const rootDir = process.cwd();
const NSSF_KEY = Buffer.from('QE5zc2ZfZnJvbV8xMjM0QHRyYWNraW5nJDNAaWxvdmU=', 'base64');
const NSSF_IV = Buffer.from('QFNvcGhhdEBsZW5nXzE5Mg==', 'base64');

function encryptFixture(plainText) {
  const cipher = crypto.createCipheriv('aes-256-cbc', NSSF_KEY, NSSF_IV);
  let enc = cipher.update(plainText, 'utf8', 'base64');
  enc += cipher.final('base64');
  return enc;
}


test('normalizeNssfCard normalizes Khmer numerals and rejects non-numeric input', () => {
  assert.equal(normalizeNssfCard('12345678'), '12345678');
  assert.equal(normalizeNssfCard('  ១២៣៤៥៦៧៨  '), '12345678');
  assert.equal(normalizeNssfCard('១០៥០៩២៥៤៦២០៥១១'), '10509254620511');

  assert.throws(() => normalizeNssfCard(''), {message: /valid numeric NSSF Card/});
  assert.throws(() => normalizeNssfCard('12'), {message: /valid numeric NSSF Card/});
  assert.throws(() => normalizeNssfCard('ABC-12345'), {message: /valid numeric NSSF Card/});
});

test('decryptNssfPayload decrypts AES-256-CBC payload with verified official keys', () => {
  const sample = JSON.stringify({sta_eli_id: 1, end_eligible_date: '2028-12-31'});
  const b64 = Buffer.from(sample, 'utf8').toString('base64');
  const enc = encryptFixture(b64);

  const decrypted = decryptNssfPayload(enc);
  assert.equal(decrypted, b64);
  const parsed = parseDecryptedBeneficiary(decrypted);
  assert.deepEqual(parsed, {sta_eli_id: 1, end_eligible_date: '2028-12-31'});
});

test('evaluateNssfEligibility classifies active, expired, inactive and not-found records without demographic leakage', () => {
  const now = '2026-10-13T00:00:00.000Z';

  // 1. Valid and active beneficiary
  const activeBen = {
    sta_eli_id: 1,
    new_ben_code: '10509254620511',
    end_eligible_date: '2027-06-30',
    ben_full_name_kh: 'គីម យ៉ុងក្វាង',
    ben_full_name_en: 'KIM YONGKWANG'
  };
  const activeRes = evaluateNssfEligibility(activeBen, '10509254620511', now);
  assert.equal(activeRes.found, true);
  assert.equal(activeRes.card.valid, true);
  assert.equal(activeRes.card.status, 'VALID');
  assert.equal(activeRes.card.endEligibleDate, '2027-06-30');
  // Confirm personal demographics (names, photos) are NOT in the returned card object
  assert.equal(activeRes.card.ben_full_name_kh, undefined);
  assert.equal(activeRes.card.ben_full_name_en, undefined);

  // 2. Expired beneficiary
  const expiredBen = {
    sta_eli_id: 3,
    new_ben_code: '10509254620511',
    end_eligible_date: '2026-06-30'
  };
  const expiredRes = evaluateNssfEligibility(expiredBen, '10509254620511', now);
  assert.equal(expiredRes.found, true);
  assert.equal(expiredRes.card.valid, false);
  assert.equal(expiredRes.card.status, 'INACTIVE');

  // 3. Inactive / ineligible beneficiary
  const inactiveBen = {
    sta_eli_id: 3,
    new_ben_code: '10509254620511',
    end_eligible_date: '2027-06-30'
  };
  const inactiveRes = evaluateNssfEligibility(inactiveBen, '10509254620511', now);
  assert.equal(inactiveRes.found, true);
  assert.equal(inactiveRes.card.valid, false);
  assert.equal(inactiveRes.card.status, 'INACTIVE');

  // 4. Not found (null)
  const notFoundRes = evaluateNssfEligibility(null, '99999999', now);
  assert.equal(notFoundRes.found, false);
  assert.equal(notFoundRes.card.valid, false);
  assert.equal(notFoundRes.card.status, 'NOT_FOUND');
});

test('createNssfLookup handles network failure as 503 Unable to verify without marking as Invalid', async () => {
  const failingFetch = async () => {
    const err = new Error('502 Bad Gateway / Connection refused');
    throw err;
  };

  const lookup = createNssfLookup({fetchImpl: failingFetch});
  await assert.rejects(
    () => lookup('12345678', 'user-1'),
    err => {
      assert.equal(err.status, 503);
      assert.match(err.message, /Unable to verify with NSSF portal/);
      return true;
    }
  );
});

test('EMR.html includes NSSF verification button and transient guards', () => {
  const emrHtml = fs.readFileSync(path.join(rootDir, 'protected/EMR.html'), 'utf8');

  // Stylesheet and script tags
  assert.match(emrHtml, /<link rel="stylesheet" href="\/public\/nssf-lookup\.css\?v=\d+">/);
  assert.match(emrHtml, /<script src="\/public\/nssf-lookup\.js\?v=\d+"><\/script>/);

  // Button and status elements with transient attributes
  assert.match(emrHtml, /id="nssf_verify_button"[^>]*data-emr-transient/);
  assert.match(emrHtml, /id="nssf_verify_button"[^>]*data-emr-no-auto-index/);
  assert.match(emrHtml, /id="nssf_verify_status"[^>]*data-emr-transient/);
  assert.match(emrHtml, /id="web_nssf_verification"[^>]*data-emr-transient/);
});

test('Server serves nssf-lookup.js and nssf-lookup.css via whitelisted static routes', async () => {
  const app = createEmrServer({
    port: 0,
    databasePath: ':memory:',
    autoDatabase: false,
    demoMode: false
  });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const resJs = await fetch(`${baseUrl}/public/nssf-lookup.js`);
    assert.equal(resJs.status, 200);
    assert.match(resJs.headers.get('content-type'), /javascript/);
    const textJs = await resJs.text();
    assert.match(textJs, /nssf_verify_button/);

    const resCss = await fetch(`${baseUrl}/public/nssf-lookup.css`);
    assert.equal(resCss.status, 200);
    assert.match(resCss.headers.get('content-type'), /css/);
    const textCss = await resCss.text();
    assert.match(textCss, /nssf-dialog/);
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

test('Server /api/nssf/verify verifies registration role access, CSRF and returns sanitized data', async () => {
  // Synthetic provider fetch
  const syntheticFetch = async (url) => {
    const id = new URL(url).searchParams.get('ben_code');
    if (id === '10509254620511') {
      const payload = Buffer.from(JSON.stringify({
        sta_eli_id: 1,
        new_ben_code: '10509254620511',
        end_eligible_date: '2028-12-31'
      })).toString('base64');
      return new Response(JSON.stringify({
        success: true,
        data: encryptFixture(payload)
      }), {headers: {'content-type': 'application/json'}});
    } else {
      // Empty string payload denotes not found
      return new Response(JSON.stringify({
        success: true,
        data: encryptFixture('')
      }), {headers: {'content-type': 'application/json'}});
    }
  };

  const app = createEmrServer({
    port: 0,
    databasePath: ':memory:',
    autoDatabase: false,
    demoMode: true,
    nssfFetch: syntheticFetch
  });
  await new Promise(r => app.server.listen(0, '127.0.0.1', r));
  const port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  app.config.appOrigin = baseUrl;

  try {
    // 1. Unauthenticated request -> 401
    const unauth = await fetch(`${baseUrl}/api/nssf/verify`, {
      method: 'POST',
      headers: {'content-type': 'application/json', Origin: baseUrl},
      body: JSON.stringify({cardNumber: '10509254620511'})
    });
    assert.equal(unauth.status, 401);

    // 2. Log in as registration user
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {'content-type': 'application/json', Origin: baseUrl},
      body: JSON.stringify({username: 'registration'})
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: {Cookie: cookie}
    });
    const {csrfToken} = await meRes.json();

    // 3. Authenticated valid NSSF search
    const verifyRes = await fetch(`${baseUrl}/api/nssf/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-CSRF-Token': csrfToken,
        Origin: baseUrl,
        Cookie: cookie
      },
      body: JSON.stringify({cardNumber: '10509254620511'})
    });
    assert.equal(verifyRes.status, 200);
    assert.equal(verifyRes.headers.get('cache-control'), 'no-store');
    const verifyData = await verifyRes.json();
    assert.equal(verifyData.found, true);
    assert.equal(verifyData.card.valid, true);
    assert.equal(verifyData.card.status, 'VALID');
    assert.equal(verifyData.card.endEligibleDate, '2028-12-31');

    // 4. Authenticated not-found search
    const notFoundRes = await fetch(`${baseUrl}/api/nssf/verify`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-CSRF-Token': csrfToken,
        Origin: baseUrl,
        Cookie: cookie
      },
      body: JSON.stringify({cardNumber: '9999999999'})
    });
    assert.equal(notFoundRes.status, 200);
    const notFoundData = await notFoundRes.json();
    assert.equal(notFoundData.found, false);
    assert.equal(notFoundData.card.valid, false);
    assert.equal(notFoundData.card.status, 'NOT_FOUND');
  } finally {
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});

test('public/nssf-lookup.js implements debounced auto-verify on typing pause and button verification', () => {
  const js = fs.readFileSync(path.join(rootDir, 'public/nssf-lookup.js'), 'utf8');

  // Debounced auto-verify on typing pause
  assert.match(js, /setTimeout\s*\(\s*\(\)\s*=>\s*\{\s*void verify\(\{\s*openModal:\s*true\s*\}\)/);
  assert.match(js, /clearTimeout\(timer\)/);

  // Button verification with modal dialog
  assert.match(js, /byId\('nssf_verify_button'\)\.addEventListener\('click'/);
  assert.match(js, /verify\(\{\s*openModal:\s*true\s*\}\)/);

  // Connection errors are never classified as invalid (sets unknown/amber status)
  assert.match(js, /status:\s*'ERROR'/);
  assert.match(js, /status-/);

  // Transient protection
  assert.match(js, /dataset\.emrTransient\s*=\s*'true'/);
});

