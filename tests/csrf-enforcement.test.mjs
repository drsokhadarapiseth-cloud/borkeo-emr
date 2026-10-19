import test from 'node:test';
import assert from 'node:assert/strict';
import { Router } from '../server/router.mjs';
import { mountAuthRoutes } from '../server/routes/auth.mjs';
import { mountAdminRoutes } from '../server/routes/admin.mjs';
import { mountQueueRoutes } from '../server/routes/queue.mjs';
import { mountMessagesRoutes } from '../server/routes/messages.mjs';
import { mountPharmacyRoutes } from '../server/routes/pharmacy.mjs';
import { mountParaclinicRoutes } from '../server/routes/paraclinic.mjs';
import { mountFinanceRoutes } from '../server/routes/finance.mjs';
import { mountPatientsRoutes } from '../server/routes/patients.mjs';
import { mountClinicalRoutes } from '../server/routes/clinical.mjs';
import { createEmrServer } from '../server/server.mjs';

test('Central CSRF enforcement: all modular routes register with router and enforce CSRF', () => {
  const router = new Router('test-emr');
  mountAuthRoutes(router);
  mountAdminRoutes(router);
  mountQueueRoutes(router);
  mountMessagesRoutes(router);
  mountPharmacyRoutes(router);
  mountParaclinicRoutes(router);
  mountFinanceRoutes(router);
  mountPatientsRoutes(router);
  mountClinicalRoutes(router);

  const stateChangingRoutes = router.routes.filter(r =>
    ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method)
  );

  assert.ok(stateChangingRoutes.length >= 35, `Expected at least 35 state-changing routes, found ${stateChangingRoutes.length}`);

  // Only login is permitted to skip CSRF (client doesn't have a session CSRF token yet)
  const allowedSkipCsrf = new Set(['/api/auth/login']);

  for (const route of stateChangingRoutes) {
    const patternStr = typeof route.pattern === 'string' ? route.pattern : route.pattern.toString();
    if (route.options?.skipCsrf) {
      assert.ok(
        allowedSkipCsrf.has(route.pattern),
        `Route ${route.method} ${patternStr} should not skip CSRF verification`
      );
    }
  }
});

test('Router.handle blocks state-changing requests when CSRF token is invalid or missing', async () => {
  const router = new Router('test-csrf');
  let handlerInvoked = false;
  router.post('/api/test-action', async () => {
    handlerInvoked = true;
  });

  const session = { user_id: 'user-1', csrf_token: 'secret-csrf-token-123' };
  const config = { appOrigin: 'http://127.0.0.1:3000', cookieSecure: false };

  let responseData = null;
  let responseStatus = null;
  const makeCtx = (headers = {}) => ({
    request: {
      method: 'POST',
      headers: {
        host: '127.0.0.1:3000',
        ...headers,
      },
    },
    response: {
      setHeader() {},
      writeHead(status) { responseStatus = status; },
      end() {},
    },
    pathname: '/api/test-action',
    session,
    config,
    sendJson: (res, status, data) => {
      responseStatus = status;
      responseData = data;
    },
  });

  // 1. Missing CSRF token
  handlerInvoked = false;
  const handledMissing = await router.handle(makeCtx({ origin: 'http://127.0.0.1:3000' }));
  assert.equal(handledMissing, true);
  assert.equal(responseStatus, 403);
  assert.equal(responseData?.error, 'Security token is invalid.');
  assert.equal(handlerInvoked, false);

  // 2. Mismatched CSRF token
  handlerInvoked = false;
  const handledWrong = await router.handle(makeCtx({
    origin: 'http://127.0.0.1:3000',
    'x-csrf-token': 'wrong-token',
  }));
  assert.equal(handledWrong, true);
  assert.equal(responseStatus, 403);
  assert.equal(responseData?.error, 'Security token is invalid.');
  assert.equal(handlerInvoked, false);

  // 3. Mismatched Origin
  handlerInvoked = false;
  const handledBadOrigin = await router.handle(makeCtx({
    origin: 'http://evil-attacker.example',
    'x-csrf-token': 'secret-csrf-token-123',
  }));
  assert.equal(handledBadOrigin, true);
  assert.equal(responseStatus, 403);
  assert.equal(responseData?.error, 'Security token is invalid.');
  assert.equal(handlerInvoked, false);

  // 4. Valid CSRF token and valid origin -> handler invoked
  handlerInvoked = false;
  const handledValid = await router.handle(makeCtx({
    origin: 'http://127.0.0.1:3000',
    'x-csrf-token': 'secret-csrf-token-123',
  }));
  assert.equal(handledValid, true);
  assert.equal(handlerInvoked, true);
});

test('HTTP integration: createEmrServer rejects POST/PUT/DELETE requests with invalid CSRF', async () => {
  const app = createEmrServer({
    demoMode: true,
    databasePath: ':memory:',
    port: 0,
    nodeEnv: 'test',
  });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const port = app.server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  app.config.appOrigin = origin;

  try {
    // Login to obtain valid session cookie
    const loginRes = await fetch(`${origin}/api/auth/login`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin' }),
    });
    assert.equal(loginRes.status, 200);
    const cookie = loginRes.headers.get('set-cookie').split(';')[0];

    // State-changing request with invalid CSRF token should return 403
    const badCsrfRes = await fetch(`${origin}/api/appointments`, {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: cookie,
        'Content-Type': 'application/json',
        'X-CSRF-Token': 'invalid-csrf-token',
      },
      body: JSON.stringify({ patientKey: 'case:test', appointmentDate: '2026-11-01' }),
    });
    assert.equal(badCsrfRes.status, 403);
    const badData = await badCsrfRes.json();
    assert.equal(badData.error, 'Security token is invalid.');

    // State-changing request with missing CSRF token should return 403
    const missingCsrfRes = await fetch(`${origin}/api/appointments`, {
      method: 'POST',
      headers: {
        Origin: origin,
        Cookie: cookie,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ patientKey: 'case:test', appointmentDate: '2026-11-01' }),
    });
    assert.equal(missingCsrfRes.status, 403);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
