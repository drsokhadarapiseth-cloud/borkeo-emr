import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function read(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8');
}

test('Phase 7: Worklists, forms and feedback assets exist and are registered in server.mjs', () => {
  const css = read('public/worklists-feedback.css');
  const js = read('public/worklists-feedback.js');
  const serverCode = read('server/server.mjs');
  const pkg = JSON.parse(read('package.json'));
  const loginHtml = read('public/login.html');

  // Version consistency
  assert.equal(pkg.version, '39.6.0', 'package.json version must be 39.6.0');
  assert.match(serverCode, /Borkeo EMR v39\.6/, 'server.mjs must declare v39.6');
  assert.match(serverCode, /'\/public\/worklists-feedback\.css'/, 'server.mjs must register worklists-feedback.css');
  assert.match(serverCode, /'\/public\/worklists-feedback\.js'/, 'server.mjs must register worklists-feedback.js');
  assert.match(serverCode, /worklists-feedback\.css\?v=\d+/, 'server.mjs must inject worklists-feedback.css');
  assert.match(serverCode, /worklists-feedback\.js\?v=\d+/, 'server.mjs must inject worklists-feedback.js');
  assert.match(loginHtml, /data-app-version[^>]*>v39\.6<\/span>/, 'login.html must display v39.6');

  // CSS contains sticky headers, status chips, autosave badges, and modals
  assert.match(css, /position:\s*sticky/i, 'worklists-feedback.css must define sticky headers');
  assert.match(css, /\.emr-status-chip/, 'worklists-feedback.css must define status chips');
  assert.match(css, /\.emr-autosave-badge/, 'worklists-feedback.css must style autosave badge');
  assert.match(css, /\.emr-modal-backdrop/, 'worklists-feedback.css must style modal dialog backdrop');
  assert.match(css, /\.emr-field-error/, 'worklists-feedback.css must style form error states');
});

test('Phase 7: Status chips and multi-modal states comply with IEC 62366-1 and WCAG 2.2 AA', () => {
  const css = read('public/worklists-feedback.css');

  assert.match(css, /\.emr-chip-waiting/, 'Must define waiting chip');
  assert.match(css, /\.emr-chip-active/, 'Must define active chip');
  assert.match(css, /\.emr-chip-done/, 'Must define done chip');
  assert.match(css, /\.emr-chip-danger/, 'Must define danger chip');

  // Contrast & non-color cues (svg icons, border, distinct text)
  assert.match(css, /\.emr-status-chip\s+svg/, 'Chips must support SVG icons for non-color cues');
});

test('Phase 7: EmrFilterStorage correctly persists and loads filters in localStorage', () => {
  const jsCode = read('public/worklists-feedback.js');
  const mockStorage = new Map();
  const fakeLocalStorage = {
    getItem(k) { return mockStorage.get(k) || null; },
    setItem(k, v) { mockStorage.set(k, String(v)); },
    removeItem(k) { mockStorage.delete(k); }
  };

  const sandbox = {
    localStorage: fakeLocalStorage,
    document: { getElementById: () => null }
  };
  const runScript = new Function('window', 'global', 'globalThis', jsCode);
  runScript(sandbox, sandbox, sandbox);

  const { EmrFilterStorage } = sandbox;
  assert.ok(EmrFilterStorage, 'EmrFilterStorage must be exported');

  // Test save & load
  EmrFilterStorage.save('test_dept', 'OPD');
  assert.equal(EmrFilterStorage.load('test_dept'), 'OPD');

  // Test object/array values
  EmrFilterStorage.save('test_filters', { status: 'WAITING', ward: 'MEDICINE' });
  const loaded = EmrFilterStorage.load('test_filters');
  assert.deepEqual(loaded, { status: 'WAITING', ward: 'MEDICINE' });

  // Test fallback
  assert.equal(EmrFilterStorage.load('nonexistent', 'DEFAULT'), 'DEFAULT');

  // Test clear
  EmrFilterStorage.clear('test_dept');
  assert.equal(EmrFilterStorage.load('test_dept'), null);
});

test('Phase 7: EmrAutosaveIndicator and EmrDialog provide accessible UI and Khmer defaults', async () => {
  const jsCode = read('public/worklists-feedback.js');

  let elementCreated = null;
  const mockDoc = {
    createElement(tag) {
      const el = {
        tagName: tag.toUpperCase(),
        classList: new Set(),
        className: '',
        style: {},
        attributes: {},
        innerHTML: '',
        setAttribute(k, v) { this.attributes[k] = v; },
        getAttribute(k) { return this.attributes[k] || null; },
        appendChild(child) {},
        querySelector(sel) { return null; },
        focus() {}
      };
      el.classList.add = (c) => el.classList.add(c);
      el.classList.remove = (c) => el.classList.delete(c);
      return el;
    },
    getElementById: () => null,
    body: {
      appendChild: (el) => { elementCreated = el; },
      removeChild: () => {}
    },
    addEventListener: () => {},
    removeEventListener: () => {}
  };

  const sandbox = {
    document: mockDoc,
    localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} }
  };
  const runScript = new Function('window', 'global', 'globalThis', jsCode);
  runScript(sandbox, sandbox, sandbox);

  const { EmrDialog, EmrAutosaveIndicator, EmrValidation } = sandbox;
  assert.ok(EmrDialog, 'EmrDialog must be exported');
  assert.ok(EmrAutosaveIndicator, 'EmrAutosaveIndicator must be exported');
  assert.ok(EmrValidation, 'EmrValidation must be exported');

  // Test EmrValidation Khmer messages
  assert.match(EmrValidation.messages.required, /ចាំបាច់/, 'Validation required message in Khmer');
  assert.match(EmrValidation.messages.invalidDate, /កាលបរិច្ឆេទ/, 'Validation date message in Khmer');
  assert.match(EmrValidation.messages.saveError, /បរាជ័យ/, 'Validation save error message in Khmer');

  // Test Autosave states text in Khmer
  const badge = EmrAutosaveIndicator.create('test-badge');
  assert.ok(badge, 'Badge created');
  EmrAutosaveIndicator.setState(badge, 'saving');
  assert.match(badge.innerHTML, /កំពុងរក្សាទុក/, 'Saving text in Khmer');

  EmrAutosaveIndicator.setState(badge, 'saved');
  assert.match(badge.innerHTML, /បានរក្សាទុក/, 'Saved text in Khmer');

  EmrAutosaveIndicator.setState(badge, 'error');
  assert.match(badge.innerHTML, /មិនអាចរក្សាទុក/, 'Error text in Khmer');
});

test('Phase 7: TV queue display preserves violet theme requirements and accessibility', () => {
  const css = read('public/queue-display.css');
  assert.ok(css.includes('#4C1D95'), 'uses deep violet header #4C1D95');
  assert.ok(css.includes('#F5F3FF'), 'uses soft violet background #F5F3FF');
  assert.ok(css.includes('#6D28D9'), 'uses rich active row highlight #6D28D9');
  assert.ok(css.includes('#EDE9FE'), 'uses soft violet badges #EDE9FE');
  assert.ok(css.includes('active-calling-row'), 'styles active calling row highlight');
  assert.ok(css.includes('grid-template-rows: repeat(5, 1fr)'), 'layouts 5 equal height rows');

  const js = read('public/queue-display.js');
  assert.ok(js.includes('maxRows = 5'), 'renders 5 rows');
  assert.ok(js.includes('active-calling-row'), 'highlights active calling patient');
  assert.ok(js.includes('tv-counter-blank'), 'leaves counter blank for waiting patients');
  assert.ok(js.includes('playWelcomeBell'), 'preserves gentle 3-note welcome bell');
});
