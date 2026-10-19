import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve('.');
const read = file => fs.readFileSync(path.join(ROOT, file), 'utf8');

test('v37.5 - CSS completely hides the language switch', () => {
  const css = read('public/emr-language.css');
  assert.match(css, /\.emr-language-switch\{display:none!important/);
});

test('v37.5 - Pure Khmer runtime suppresses language switch mounting and DOM observer overhead', () => {
  const source = read('public/emr-language.js');
  assert.match(source, /const englishDisabled = true;/);

  let observerCreated = 0;
  class MockMutationObserver {
    constructor() { observerCreated++; }
    observe() {}
    disconnect() {}
    takeRecords() { return []; }
  }

  const doc = {
    documentElement: { lang: '' },
    body: {
      prepend() { throw Error('Switcher should not be mounted'); },
      append() { throw Error('Switcher should not be mounted'); },
    },
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener: () => {},
    createElement: () => {
      const el = { textContent: '', setAttribute() {}, addEventListener() {} };
      Object.defineProperty(el, 'innerHTML', { set(v) { this.textContent = v; }, get() { return this.textContent; } });
      return el;
    },
  };

  const sandbox = {
    URLSearchParams: class { get() { return ''; } },
    location: { search: '', pathname: '/emr' },
    sessionStorage: { getItem: () => 'en', setItem: () => {} },
    document: doc,
    window: {
      location: { search: '', pathname: '/emr' },
      addEventListener: () => {},
      dispatchEvent: () => {},
      alert: () => {},
      confirm: () => {},
    },
    Node: { TEXT_NODE: 3, ELEMENT_NODE: 1 },
    NodeFilter: { SHOW_TEXT: 4 },
    MutationObserver: MockMutationObserver,
    WeakMap,
    Map,
    Set,
    performance: { now: () => 0 },
    clearTimeout: () => {},
    setTimeout: () => {},
  };

  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);

  // Verifications
  assert.equal(sandbox.document.documentElement.lang, 'km', 'Document language must be km');
  assert.equal(sandbox.window.getBorkeoLanguage(), 'kh', 'getBorkeoLanguage must return kh');
  assert.equal(observerCreated, 0, 'No DOM MutationObserver should be created when running in pure Khmer mode');
});

test('v37.5 - Lab and Paraclinic test names and groups remain in standard English', () => {
  const paraclinic = read('server/paraclinic.mjs');
  assert.match(paraclinic, /'Complete Blood Count \/ FBC','Hematology'/);
  assert.match(paraclinic, /'Hemoglobin','Hematology'/);
  assert.match(paraclinic, /'Clinical Chemistry'/);

  const lab = read('public/lab.js');
  assert.match(lab, /category === 'Hematology'/);
  assert.match(lab, /COMPLETE BLOOD COUNT/);
});
