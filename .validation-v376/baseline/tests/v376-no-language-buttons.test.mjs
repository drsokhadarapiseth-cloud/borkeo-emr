import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createEmrServer } from '../server/server.mjs';

const read = file => fs.readFileSync(file, 'utf8');

test('every served page template receives the early language guard before workspace scripts', () => {
  const source = read('server/server.mjs');
  const start = source.indexOf('function getProcessedHtml(');
  const end = source.indexOf('\nfunction sendJson(', start);
  const context = vm.createContext({ fs, path, Buffer, htmlTemplateCache: new Map() });
  vm.runInContext(source.slice(start, end), context);
  const files = fs.readdirSync('protected').filter(name => name.endsWith('.html') && name !== 'print-preview.html')
    .map(name => path.resolve('protected', name));
  files.push(path.resolve('public/login.html'));
  for (const file of files) {
    const html = context.getProcessedHtml(file, 'text/html; charset=utf-8', {}, '37.6').toString();
    const guard = html.indexOf('/public/emr-language-lock.js?v=3760&build=37.6');
    assert.ok(guard >= 0, file);
    assert.ok(guard < html.indexOf('</head>'), file);
    const firstScript = html.match(/<script\b[^>]*src="([^"]+)"/i)?.[1];
    assert.equal(firstScript, '/public/emr-language-lock.js?v=3760&build=37.6', file);
    assert.ok(html.includes('/public/emr-language.js?v=3760&build=37.6'), file);
  }
  assert.doesNotMatch(read('legacy-html/EMR.html'), /<button[^>]*\bid="langBtn"/);
});

test('guard removes existing and late controls anywhere and inside a reloaded iframe without touching lab text', () => {
  const observers = [], frames = [];
  class Element {
    constructor(control = false, tagName = 'DIV', children = []) {
      Object.assign(this, { nodeType: 1, control, tagName, children, removed: false });
    }
    matches(selector) { return selector === 'iframe' ? this.tagName === 'IFRAME' : this.control; }
    querySelectorAll(selector) {
      return this.children.flatMap(child => [child, ...child.querySelectorAll('*')])
        .filter(child => !child.removed && (selector === '*' || child.matches(selector)));
    }
    remove() { this.removed = true; }
  }
  function doc(children) {
    const root = new Element(false, 'HTML', children);
    return { documentElement: root, addEventListener(type, handler) { frames.push(handler); } };
  }
  const original = new Element(true);
  const lab = new Element(); lab.textContent = 'Hemoglobin · Hematology';
  const document = doc([new Element(false, 'HEADER', [original]), lab]);
  const context = vm.createContext({ document, WeakSet, MutationObserver: class {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe(root, options) { this.root = root; this.options = options; }
  } });
  vm.runInContext(read('public/emr-language-lock.js'), context);
  assert.equal(original.removed, true);
  assert.equal(document.documentElement.lang, 'km');
  assert.equal(observers.length, 1);
  const outsideHeader = new Element(true), nested = new Element(true);
  observers[0].callback([{ addedNodes: [outsideHeader, new Element(false, 'MAIN', [nested]), { nodeType: 3 }] }]);
  assert.equal(outsideHeader.removed, true); assert.equal(nested.removed, true);
  const frameControl = new Element(true), frame = new Element(false, 'IFRAME');
  frame.contentDocument = doc([frameControl]);
  observers[0].callback([{ addedNodes: [frame] }]);
  assert.equal(frameControl.removed, true); assert.equal(observers.length, 2);
  frames[0]({ target: frame }); assert.equal(observers.length, 2, 'one observer per frame document');
  const reloadedControl = new Element(true); frame.contentDocument = doc([reloadedControl]);
  frames[0]({ target: frame }); assert.equal(reloadedControl.removed, true);
  for (const observer of observers) {
    assert.deepEqual(JSON.parse(JSON.stringify(observer.options)), { childList: true, subtree: true });
  }
  assert.equal(lab.removed, false); assert.equal(lab.textContent, 'Hemoglobin · Hematology');
});

test('HTTP pages for Pharmacy, Registration and other roles load the guard; old HTML cache tags are invalidated', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', port: 0, nodeEnv: 'test' });
  await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
  const origin = 'http://127.0.0.1:' + app.server.address().port;
  app.config.appOrigin = origin;
  try {
    for (const [username, url] of [
      ['registration', '/emr?view=register'], ['pharmacy', '/pharmacy/opd'],
      ['pharmacy', '/pharmacy/medicines'], ['triage', '/emr?view=triage'],
      ['doctor_opd', '/emr?view=opd'], ['admin', '/lab'], ['admin', '/billing'],
    ]) {
      const login = await fetch(origin + '/api/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin },
        body: JSON.stringify({ username }),
      });
      assert.equal(login.status, 200, username);
      const Cookie = login.headers.get('set-cookie').split(';')[0];
      const response = await fetch(origin + url, { headers: { Cookie }, redirect: 'manual' });
      assert.equal(response.status, 200, `${username} ${url}`);
      assert.match(await response.text(), /emr-language-lock\.js\?v=3760&build=37\.6/);
      assert.ok(response.headers.get('etag').includes('-37.6'), 'release-specific HTML cache tag');
      const oldTag = response.headers.get('etag').replace('-37.6', '');
      const reload = await fetch(origin + url, { headers: { Cookie, 'If-None-Match': oldTag } });
      assert.equal(reload.status, 200, 'a cached pre-update page must receive new HTML');
      await reload.arrayBuffer();
    }
    const asset = await fetch(origin + '/public/emr-language-lock.js?v=3760');
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('content-type'), /javascript/);
    assert.match(await asset.text(), /lockKhmerInterface/);
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
