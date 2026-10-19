import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { Logger, redactSensitive } from '../server/logger.mjs';
import { createEmrServer } from '../server/server.mjs';

test('Sensitive data redaction: masks passwords, tokens, secrets, and authorization headers', () => {
  const sensitivePayload = {
    username: 'doctor_borkeo',
    password: 'SuperSecretPassword123!',
    currentPassword: 'OldPassword123!',
    newPassword: 'NewPassword123!',
    csrfToken: 'csrf-token-abc-123',
    tokenHash: 'hash-abc-123',
    totpCode: '123456',
    secret: 'JBSWY3DPEHPK3PXP',
    equityCard: '0102030405',
    cardNumber: '9988776655',
    authorization: 'Bearer secret_bearer_token',
    user: {
      displayName: 'Dr. Chann',
      password_hash: 'scrypt$32768$8$1$...',
      role: 'DOCTOR',
    },
    items: [
      { id: 1, note: 'Normal checkup' },
      { id: 2, secret: 'top_secret' },
    ],
  };

  const redacted = redactSensitive(sensitivePayload);

  // Redacted fields
  assert.equal(redacted.password, '[REDACTED]');
  assert.equal(redacted.currentPassword, '[REDACTED]');
  assert.equal(redacted.newPassword, '[REDACTED]');
  assert.equal(redacted.csrfToken, '[REDACTED]');
  assert.equal(redacted.tokenHash, '[REDACTED]');
  assert.equal(redacted.totpCode, '[REDACTED]');
  assert.equal(redacted.secret, '[REDACTED]');
  assert.equal(redacted.equityCard, '[REDACTED]');
  assert.equal(redacted.cardNumber, '[REDACTED]');
  assert.equal(redacted.authorization, '[REDACTED]');
  assert.equal(redacted.user.password_hash, '[REDACTED]');
  assert.equal(redacted.items[1].secret, '[REDACTED]');

  // Preserved safe fields
  assert.equal(redacted.username, 'doctor_borkeo');
  assert.equal(redacted.user.displayName, 'Dr. Chann');
  assert.equal(redacted.user.role, 'DOCTOR');
  assert.equal(redacted.items[0].note, 'Normal checkup');
});

test('Sensitive data redaction: masks Bearer token patterns in strings', () => {
  const logStr = 'Request failed with header: Bearer mySecretToken123456 in session';
  const cleanStr = redactSensitive(logStr);
  assert.ok(!cleanStr.includes('mySecretToken123456'));
  assert.match(cleanStr, /Bearer \[REDACTED\]/);
});

test('Logger: handles log levels, structured JSON format, and child bindings', () => {
  const lines = [];
  const mockOutput = {
    log(line) { lines.push({ type: 'log', line }); },
    warn(line) { lines.push({ type: 'warn', line }); },
    error(line) { lines.push({ type: 'error', line }); },
  };

  const logger = new Logger({
    name: 'test-logger',
    level: 'INFO',
    format: 'json',
    output: mockOutput,
  });

  // DEBUG should be ignored when level is INFO
  logger.debug('This debug message should not appear');
  assert.equal(lines.length, 0);

  // INFO should be logged
  logger.info('Server started', { port: 3000 });
  assert.equal(lines.length, 1);
  const infoEntry = JSON.parse(lines[0].line);
  assert.equal(infoEntry.level, 'INFO');
  assert.equal(infoEntry.message, 'Server started');
  assert.equal(infoEntry.port, 3000);
  assert.ok(infoEntry.timestamp);

  // Child logger inherits bindings and redacts sensitive data
  const child = logger.child({ requestId: 'req-12345', component: 'AUTH' });
  child.warn('Login attempt failed', { username: 'admin', password: 'secretPassword!' });

  assert.equal(lines.length, 2);
  const childEntry = JSON.parse(lines[1].line);
  assert.equal(childEntry.level, 'WARN');
  assert.equal(childEntry.requestId, 'req-12345');
  assert.equal(childEntry.component, 'AUTH');
  assert.equal(childEntry.username, 'admin');
  assert.equal(childEntry.password, '[REDACTED]');

  // ERROR with Error object captures error details
  child.error('Database connection failed', { error: new Error('Connection timeout') });
  assert.equal(lines.length, 3);
  const errEntry = JSON.parse(lines[2].line);
  assert.equal(errEntry.level, 'ERROR');
  assert.equal(errEntry.err.name, 'Error');
  assert.equal(errEntry.err.message, 'Connection timeout');
  assert.ok(errEntry.err.stack);
});

test('HTTP Server: responses include X-Request-ID header and propagate correlation', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-obs-test-'));
  const dbPath = path.join(tempDir, 'obs-test.sqlite');

  const app = createEmrServer({
    demoMode: false,
    host: '127.0.0.1',
    port: 33871,
    appOrigin: 'http://127.0.0.1:33871',
    databasePath: dbPath,
    nodeEnv: 'test',
  });

  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(33871, '127.0.0.1', resolve);
  });

  try {
    // 1. Valid request receives X-Request-ID
    const res = await fetch('http://127.0.0.1:33871/api/auth/config');
    assert.equal(res.status, 200);
    const reqId = res.headers.get('x-request-id');
    assert.ok(reqId, 'X-Request-ID header must be present on HTTP response');
    assert.match(reqId, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'X-Request-ID must be valid UUID');

    // 2. 404 response also includes X-Request-ID
    const notFoundRes = await fetch('http://127.0.0.1:33871/api/nonexistent-endpoint');
    assert.equal(notFoundRes.status, 404);
    assert.ok(notFoundRes.headers.get('x-request-id'));

    // 3. Each request receives a distinct X-Request-ID
    const res2 = await fetch('http://127.0.0.1:33871/api/auth/config');
    const reqId2 = res2.headers.get('x-request-id');
    assert.notEqual(reqId, reqId2, 'Subsequent requests must receive unique request IDs');
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    if (app.database?.close) app.database.close();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
});
