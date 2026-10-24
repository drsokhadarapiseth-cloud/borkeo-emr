import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../public/context.js', import.meta.url), 'utf8');
const identity = { id: 'synthetic-user', username: 'synthetic-user', roles: ['DOCTOR'], wards: [{code: 'medicine', nameEn: 'Medicine'}] };
const session = (token = 'synthetic-token') => ({ user: identity, csrfToken: token });
const response = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

async function page(replies) {
  const nodes = new Map();
  for (const id of ['context-role', 'context-ward', 'ward-label', 'context-status', 'context-form', 'context-retry', 'submit']) {
    nodes.set(id, { value: '', hidden: false, disabled: false, handlers: {}, textContent: '',
      addEventListener(name, handler) { this.handlers[name] = handler; },
      querySelector() { return nodes.get('submit'); }, reportValidity() { return true; },
    });
  }
  const requests = [], redirects = [];
  const context = vm.createContext({ document: { getElementById: id => nodes.get(id) }, window: {},
    location: { replace: path => redirects.push(path) },
    fetch: async (url, options) => {
      requests.push({ url, options });
      const next = replies.shift();
      assert.notEqual(next, undefined, `unexpected request ${url}`);
      if (next instanceof Error) throw next;
      return next;
    },
  });
  await vm.runInContext(source, context);
  return { nodes, requests, redirects, submit: () => nodes.get('context-form').handlers.submit({ preventDefault() {} }),
    retry: () => nodes.get('context-retry').handlers.click() };
}

test('context bootstrap network failure disables unsafe submit and can recover without reloading', async () => {
  const p = await page([new TypeError('Failed to fetch'), response(200, session())]);
  assert.equal(p.nodes.get('submit').disabled, true);
  assert.equal(p.nodes.get('context-retry').hidden, false);
  assert.doesNotMatch(p.nodes.get('context-status').textContent, /Failed to fetch/);
  await p.submit();
  assert.equal(p.requests.length, 1);
  await p.retry();
  assert.equal(p.nodes.get('submit').disabled, false);
  assert.equal(p.nodes.get('context-retry').hidden, true);
  assert.equal(p.nodes.get('context-status').textContent, '');
});

test('context write refreshes CSRF with same-origin cookie and keeps chosen context', async () => {
  const p = await page([response(200, session('old')), response(200, session('fresh')), response(200, { user: identity, landingPath: '/home' })]);
  p.nodes.get('context-role').value = 'DOCTOR';
  p.nodes.get('context-role').handlers.change();
  p.nodes.get('context-ward').value = 'medicine';
  await p.submit();
  const post = p.requests[2];
  assert.equal(post.options.headers['X-CSRF-Token'], 'fresh');
  assert.equal(post.options.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(post.options.body), { role: 'DOCTOR', wardCode: 'medicine' });
  assert.deepEqual(p.redirects, ['/home']);
});

test('expired context session redirects before attempting a context write', async () => {
  const p = await page([response(200, session()), response(401, {})]);
  await p.submit();
  assert.deepEqual(p.redirects, ['/login']);
  assert.equal(p.requests.length, 2);
});

test('changed browser account cannot submit the old account selection', async () => {
  const p = await page([response(200, session()), response(200, { ...session(), user: { ...identity, id: 'another', username: 'another' } })]);
  await p.submit();
  assert.deepEqual(p.redirects, ['/login']);
  assert.equal(p.requests.length, 2);
  assert.equal(p.nodes.get('submit').disabled, true);
});

for (const failure of [new TypeError('Failed to fetch'), response(403, { error: 'private exception' }), response(502, {})]) {
  test(`context write failure ${failure.status || 'network'} stays visible without automatic mutation retry`, async () => {
    const p = await page([response(200, session()), response(200, session()), failure]);
    await p.submit();
    assert.equal(p.requests.length, 3);
    assert.deepEqual(p.redirects, []);
    assert.ok(p.nodes.get('context-status').textContent);
    assert.doesNotMatch(p.nodes.get('context-status').textContent, /Failed to fetch|private exception/);
    assert.equal(p.nodes.get('context-retry').hidden, false);
  });
}

test('bootstrap server failure remains on context page rather than logging user out', async () => {
  const p = await page([response(503, {})]);
  assert.deepEqual(p.redirects, []);
  assert.equal(p.nodes.get('submit').disabled, true);
});
