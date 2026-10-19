import crypto from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(crypto.scrypt);
const KEY_LENGTH = 64;
const PARAMETERS = { N: 32768, r: 8, p: 1, maxmem: 128 * 1024 * 1024 };

export function normalizeUsername(username) {
  return String(username ?? '').normalize('NFKC').trim().toLocaleLowerCase('en-US');
}

export function validateUsername(username) {
  const normalized = normalizeUsername(username);
  if (!/^[\p{L}\p{N}._-]{3,64}$/u.test(normalized)) {
    throw new Error('Username must be 3–64 letters, numbers, dots, underscores, or hyphens.');
  }
  return normalized;
}

export function validatePassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) {
    throw new Error('Password must contain 12–128 characters.');
  }
  return password;
}

export async function hashPassword(password) {
  validatePassword(password);
  const salt = crypto.randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, PARAMETERS);
  return [
    'scrypt', PARAMETERS.N, PARAMETERS.r, PARAMETERS.p,
    salt.toString('base64url'), Buffer.from(derived).toString('base64url'),
  ].join('$');
}

export async function verifyPassword(password, encoded) {
  try {
    const [algorithm, n, r, p, saltText, hashText] = String(encoded).split('$');
    if (algorithm !== 'scrypt') return false;
    const expected = Buffer.from(hashText, 'base64url');
    const actual = Buffer.from(await scrypt(password, Buffer.from(saltText, 'base64url'), expected.length, {
      N: Number(n), r: Number(r), p: Number(p), maxmem: 128 * 1024 * 1024,
    }));
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

export function randomToken() {
  return crypto.randomBytes(32).toString('base64url');
}

export function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

export function safeTokenEqual(left, right) {
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
