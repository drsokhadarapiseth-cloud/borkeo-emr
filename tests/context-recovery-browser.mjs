// Explicit Chromium test. Synthetic account and in-memory database only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmrServer } from '../server/server.mjs';
import { setUserAccess } from '../server/access.mjs';
import { openBrowser } from './helpers/context-browser.mjs';

test('context network recovery, fresh CSRF, scoped selection and session expiry in Chromium', { timeout: 90000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', host: '127.0.0.1', port: 0, appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test', npca: { enabled: false } });
  let browser;
  try {
    app.database.createUser({ id: 'synthetic-context', username: 'synthetic_context', displayName: 'Synthetic Context', role: 'DOCTOR', passwordHash: 'synthetic-unused', createdAt: Date.now() });
    setUserAccess(app.database, 'synthetic-context', ['DOCTOR'], ['medicine', 'obstetric']);
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    app.config.appOrigin = origin;
    browser = await openBrowser();
    await browser.send('Page.addScriptToEvaluateOnNewDocument', { source: `
      const originalFetch = window.fetch.bind(window);
      window.failSession = location.pathname === '/context';
      window.failLogin = 'network';
      window.fetch = function(url, options) {
        if (window.failSession && url === '/api/auth/me') return Promise.reject(new TypeError('Failed to fetch'));
        if (url === '/api/auth/login' && window.failLogin === 'network') return Promise.reject(new TypeError('Failed to fetch'));
        if (url === '/api/auth/login' && window.failLogin === 'denied') return Promise.resolve(new Response(JSON.stringify({error:'private backend diagnostic'}),{status:401}));
        return originalFetch(url, options);
      };
    ` });
    await browser.send('Page.navigate', { url: origin + '/login' });
    await browser.waitFor("document.getElementById('login-button') && !document.getElementById('login-button').disabled", 'login config');
    await browser.evaluate("document.getElementById('username').value='synthetic_context'; document.getElementById('login-form').requestSubmit()");
    await browser.waitFor("document.getElementById('login-status').textContent && !document.getElementById('login-button').disabled", 'login network error');
    assert.doesNotMatch(await browser.evaluate("document.getElementById('login-status').textContent"), /Failed to fetch/);
    await browser.evaluate("window.failLogin='denied'; document.getElementById('login-form').requestSubmit()");
    await browser.waitFor("document.getElementById('login-status').textContent && !document.getElementById('login-button').disabled", 'login rejection');
    assert.doesNotMatch(await browser.evaluate("document.getElementById('login-status').textContent"), /private backend diagnostic/);
    await browser.evaluate("window.failLogin=false; document.getElementById('login-form').requestSubmit()");
    await browser.waitFor("location.pathname==='/context' && document.getElementById('context-retry') && !document.getElementById('context-retry').hidden", 'network failure');
    assert.equal(await browser.evaluate("document.querySelector('button[type=submit]').disabled"), true);
    assert.doesNotMatch(await browser.evaluate("document.getElementById('context-status').textContent"), /Failed to fetch/);
    await browser.evaluate("window.failSession=false; document.getElementById('context-retry').click()");
    await browser.waitFor("!document.querySelector('button[type=submit]').disabled", 'retry recovered');
    assert.deepEqual(await browser.evaluate("Array.from(document.getElementById('context-ward').options).map(o=>o.value)"), ['', 'medicine', 'obstetric']);
    const denied = await browser.evaluate(`(async()=>{
      const me=await(await fetch('/api/auth/me')).json();
      const r=await fetch('/api/auth/context',{method:'POST',headers:{'Content-Type':'application/json','X-CSRF-Token':me.csrfToken},body:JSON.stringify({role:'DOCTOR',wardCode:'gynecology'})});return r.status;
    })()`);
    assert.equal(denied, 400);
    // Simulate a same-account session/token refresh while the picker is open.
    app.database.sqlite.prepare('UPDATE sessions SET csrf_token=? WHERE user_id=?').run('synthetic-refreshed-token', 'synthetic-context');
    await browser.evaluate("document.getElementById('context-ward').value='medicine'; document.getElementById('context-form').requestSubmit()");
    await browser.waitFor("location.pathname==='/home'", 'authorized landing');
    assert.equal(await browser.evaluate("fetch('/api/auth/me').then(r=>r.json()).then(m=>m.user.activeWard.code)"), 'medicine');
    await browser.send('Page.navigate', { url: origin + '/context' });
    await browser.waitFor("document.getElementById('context-retry') && !document.getElementById('context-retry').hidden", 'second context bootstrap');
    await browser.evaluate("window.failSession=false; document.getElementById('context-retry').click()");
    await browser.waitFor("!document.querySelector('button[type=submit]').disabled", 'second picker');
    app.database.sqlite.prepare('DELETE FROM sessions WHERE user_id=?').run('synthetic-context');
    await browser.evaluate("document.getElementById('context-form').requestSubmit()");
    await browser.waitFor("location.pathname==='/login'", 'expired session recovery');
    assert.deepEqual(browser.state.errors, []);
  } finally {
    browser?.close();
    if (app.server.listening) await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
