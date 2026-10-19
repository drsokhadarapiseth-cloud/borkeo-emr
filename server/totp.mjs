import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = '';
  for (let i = 0; i < buffer.length; i++) {
    value = (value << 8) | buffer[i];
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

export function base32Decode(input) {
  const clean = String(input ?? '').toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const output = [];
  for (let i = 0; i < clean.length; i++) {
    const idx = BASE32_ALPHABET.indexOf(clean[i]);
    if (idx === -1) {
      throw new Error(`Invalid base32 character: ${clean[i]}`);
    }
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      output.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(output);
}

export function generateTotpSecret(byteLength = 20) {
  return base32Encode(crypto.randomBytes(byteLength));
}

export function generateTotpCode(secret, timestamp = Date.now(), stepSeconds = 30, digits = 6) {
  const key = typeof secret === 'string' ? base32Decode(secret) : secret;
  const counter = Math.floor(timestamp / (stepSeconds * 1000));
  const timeBuf = Buffer.alloc(8);
  timeBuf.writeBigUInt64BE(BigInt(counter));
  const hmac = crypto.createHmac('sha1', key).update(timeBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
  const otp = binary % (10 ** digits);
  return String(otp).padStart(digits, '0');
}

export function verifyTotpCode(code, secret, window = 1, timestamp = Date.now(), stepSeconds = 30, digits = 6) {
  if (!code || !secret) return false;
  const normalizedCode = String(code).trim();
  if (normalizedCode.length !== digits || !/^\d+$/.test(normalizedCode)) return false;

  for (let offset = -window; offset <= window; offset++) {
    const t = timestamp + offset * (stepSeconds * 1000);
    const expected = generateTotpCode(secret, t, stepSeconds, digits);
    const expectedBuf = Buffer.from(expected);
    const codeBuf = Buffer.from(normalizedCode);
    if (expectedBuf.length === codeBuf.length && crypto.timingSafeEqual(expectedBuf, codeBuf)) {
      return true;
    }
  }
  return false;
}

export function generateTotpUri(username, secret, issuer = 'Borkeo EMR') {
  const cleanIssuer = encodeURIComponent(issuer);
  const cleanUser = encodeURIComponent(username);
  return `otpauth://totp/${cleanIssuer}:${cleanUser}?secret=${secret}&issuer=${cleanIssuer}&algorithm=SHA1&digits=6&period=30`;
}
