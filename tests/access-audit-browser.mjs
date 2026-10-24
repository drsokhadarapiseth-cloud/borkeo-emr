// Explicit browser check: node --test tests/access-audit-browser.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmrServer } from '../server/server.mjs';
import { setUserAccess } from '../server/access.mjs';
import { openBrowser } from './helpers/context-browser.mjs';
import { accessContexts } from './helpers/access-audit-contexts.mjs';

test('all roles mount their authorized menus and landing pages in Chromium', { timeout: 240000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', port: 0, host: '127.0.0.1', appOrigin: 'http://127.0.0.1:0', nodeEnv: 'test', npca: { enabled: false } });
  let browser;
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    app.config.appOrigin = origin;
    browser = await openBrowser();
    for (const { id, role, ward, landing } of accessContexts) {
      app.database.createUser({ id, username: id, displayName: 'Synthetic role audit', role, passwordHash: 'synthetic-unused', createdAt: Date.now() });
      setUserAccess(app.database, id, [role], ward ? [ward] : []);
      const response = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: id }) });
      assert.equal(response.status, 200);
      const rawCookie = response.headers.get('set-cookie').split(';')[0];
      const equal = rawCookie.indexOf('=');
      await browser.send('Network.clearBrowserCookies');
      await browser.send('Network.setCookie', { name: rawCookie.slice(0, equal), value: rawCookie.slice(equal + 1), url: origin, httpOnly: true });
      await browser.send('Page.navigate', { url: origin + '/' });
      await browser.waitFor(`window.emrSession?.user?.username === ${JSON.stringify(id)} && document.querySelector('[data-nav-id]')`, `${role}@${ward} landing/menu`);
      assert.equal(await browser.evaluate('location.pathname+location.search'), landing, `${role}@${ward}`);
      const menu = await browser.evaluate(`({actual:Array.from(document.querySelectorAll('[data-nav-id]')).map(a=>a.dataset.navId),expected:EmrNavConfig.visibleItemIds(emrSession.user)})`);
      assert.deepEqual(menu.actual, menu.expected, `${role}@${ward} rendered menu`);
      const adminStatus = await browser.evaluate("fetch('/api/admin/users').then(r=>r.status)");
      assert.equal(adminStatus, ['ADMIN', 'DIRECTOR', 'VICE_DIRECTOR'].includes(role) ? 200 : 403);
    }
    assert.deepEqual(browser.state.errors, []);
  } finally {
    browser?.close();
    if (app.server.listening) await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
