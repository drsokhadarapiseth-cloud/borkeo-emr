import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();
const read = f => fs.readFileSync(path.join(rootDir, f), 'utf8');


test('EMR.html static #web_nat select contains pure Khmer labels with zero mixed English suffixes', () => {
  const emrHtml = read('protected/EMR.html');
  const startIdx = emrHtml.indexOf('id="web_nat"');
  assert.ok(startIdx !== -1, 'id="web_nat" must exist in protected/EMR.html');
  const selectSnippet = emrHtml.slice(startIdx, emrHtml.indexOf('</select>', startIdx) + 9);

  // Group labels must be pure Khmer
  assert.match(selectSnippet, /<optgroup label="កម្ពុជា">/);
  assert.match(selectSnippet, /<optgroup label="ជនជាតិដើមភាគតិច និងជនជាតិភាគតិចកម្ពុជា">/);
  assert.match(selectSnippet, /<optgroup label="សញ្ជាតិអន្តរជាតិ">/);
  assert.match(selectSnippet, /<optgroup label="ផ្សេងៗ">/);

  // Must NOT contain bilingual optgroups
  assert.doesNotMatch(selectSnippet, /label="[^"]*\s*\/\s*(?:Cambodia|Cambodian|International|Other)/);

  // Key options must be pure Khmer
  assert.match(selectSnippet, />ខ្មែរ<\/option>/);
  assert.match(selectSnippet, />ចាម<\/option>/);
  assert.match(selectSnippet, />ព្នង<\/option>/);
  assert.match(selectSnippet, />ទំពួន<\/option>/);
  assert.match(selectSnippet, />កួយ<\/option>/);
  assert.match(selectSnippet, />ចារ៉ាយ<\/option>/);
  assert.match(selectSnippet, />អាហ្វហ្គានីស្ថាន<\/option>/);
  assert.match(selectSnippet, />បារាំង<\/option>/);
  assert.match(selectSnippet, />ផ្សេងៗ<\/option>/);
  assert.match(selectSnippet, />មិនបានបញ្ជាក់<\/option>/);

  // Must NOT contain mixed bilingual slash text in option contents
  assert.doesNotMatch(selectSnippet, />ខ្មែរ\s*\/\s*Khmer<\/option>/);
  assert.doesNotMatch(selectSnippet, />ព្នង\s*\/\s*Pnong<\/option>/);
  assert.doesNotMatch(selectSnippet, />ចាម\s*\/\s*Cham<\/option>/);
  assert.doesNotMatch(selectSnippet, />ផ្សេងៗ\s*\/\s*Other<\/option>/);

  // Accept the nationality label-only update cache version.
  assert.match(emrHtml, /nationalities\.js\?v=(3500|3740)/);
  assert.match(emrHtml, /nationalities\.css\?v=3500/);
});

test('nationalities.js formatLabel returns pure Khmer in Khmer mode and pure English in English mode', () => {
  const code = read('public/nationalities.js');
  const context = { window: {}, document: { addEventListener: () => {} } };
  vm.createContext(context);
  vm.runInContext(code, context);

  const nat = context.window.EMRNationalities;
  assert.ok(nat, 'window.EMRNationalities must exist');

  // Khmer mode (default) - pure Khmer word, not mixed with English
  assert.equal(nat.formatLabel('ខ្មែរ'), 'ខ្មែរ');
  assert.equal(nat.formatLabel('ព្នង'), 'ព្នង');
  assert.equal(nat.formatLabel('ចាម'), 'ចាម');
  assert.equal(nat.formatLabel('ទំពួន'), 'ទំពួន');
  assert.equal(nat.formatLabel('ចារ៉ាយ'), 'ចារ៉ាយ');
  assert.equal(nat.formatLabel('បារាំង / France'), 'បារាំង');
  assert.equal(nat.formatLabel('France'), 'បារាំង');
  assert.equal(nat.formatLabel('វៀតណាម / Vietnam'), 'វៀតណាម');
  assert.equal(nat.formatLabel('ផ្សេងៗ'), 'ផ្សេងៗ');
  assert.equal(nat.formatLabel('មិនបានបញ្ជាក់'), 'មិនបានបញ្ជាក់');
  assert.equal(nat.formatLabel('ទួន'), 'ទួន', 'Historical value ទួន must be preserved');

  // English mode - pure English word
  assert.equal(nat.formatLabel('ខ្មែរ', 'en'), 'Khmer');
  assert.equal(nat.formatLabel('ព្នង', 'en'), 'Pnong');
  assert.equal(nat.formatLabel('ចាម', 'en'), 'Cham');
  assert.equal(nat.formatLabel('ទំពួន', 'en'), 'Tampuan');
  assert.equal(nat.formatLabel('ចារ៉ាយ', 'en'), 'Jarai');
  assert.equal(nat.formatLabel('បារាំង / France', 'en'), 'France');
  assert.equal(nat.formatLabel('France', 'en'), 'France');
  assert.equal(nat.formatLabel('វៀតណាម / Vietnam', 'en'), 'Vietnam');
  assert.equal(nat.formatLabel('ផ្សេងៗ', 'en'), 'Other');
  assert.equal(nat.formatLabel('មិនបានបញ្ជាក់', 'en'), 'Not specified');
  assert.equal(nat.formatLabel('ទួន', 'en'), 'Tuon (Historical record)');
});

test('dual-language search with aliases resolves accurately', () => {
  const code = read('public/nationalities.js');
  const context = { window: {}, document: { addEventListener: () => {} } };
  vm.createContext(context);
  vm.runInContext(code, context);

  const nat = context.window.EMRNationalities;

  // Bunong / ពូនង -> Pnong
  const byBunong = nat.findEntry('Bunong');
  assert.ok(byBunong && byBunong.kh === 'ព្នង');

  const byPoonong = nat.findEntry('ពូនង');
  assert.ok(byPoonong && byPoonong.kh === 'ព្នង');

  const byPnongEn = nat.findEntry('Pnong');
  assert.ok(byPnongEn && byPnongEn.kh === 'ព្នង');

  // Jarai / ចារាយ -> Jarai
  const byJarai = nat.findEntry('Jarai');
  assert.ok(byJarai && byJarai.kh === 'ចារ៉ាយ');

  const byCharay = nat.findEntry('Charay');
  assert.ok(byCharay && byCharay.kh === 'ចារ៉ាយ');

  const byOldJarai = nat.findEntry('ចារាយ');
  assert.ok(byOldJarai && byOldJarai.kh === 'ចារ៉ាយ');

  // France / បារាំង
  const byFrance = nat.findEntry('France');
  assert.ok(byFrance && byFrance.kh === 'បារាំង');

  const byBarang = nat.findEntry('បារាំង');
  assert.ok(byBarang && byBarang.en === 'France');
});

test('dropdown simulation: switching language translates labels without losing selected patient value', () => {
  const code = read('public/nationalities.js');

  // Minimal simulated DOM environment
  let currentLangState = 'kh';
  class HTMLSelectElement {}
  Object.defineProperty(HTMLSelectElement.prototype, 'value', {
    get() { return this._val || ''; },
    set(v) { this._val = v; },
    configurable: true
  });

  class MockElement extends HTMLSelectElement {
    constructor(tagName) {
      super();
      this.tagName = String(tagName).toUpperCase();
      this.children = [];
      this.parentElement = null;
      this.dataset = {};
      this.style = {};
      this.attributes = {};
      this.textContent = '';
      this.innerHTML = '';
      this._val = '';
      this.hidden = false;
      this._listeners = {};
      const classes = new Set();
      this.classList = {
        add: c => classes.add(c),
        remove: c => classes.delete(c),
        contains: c => classes.has(c)
      };
    }
    get options() {
      const list = [];
      const walk = el => {
        (el.children || []).forEach(c => {
          if (c.tagName === 'OPTION') list.push(c);
          else walk(c);
        });
      };
      walk(this);
      return list;
    }
    get selectedIndex() {
      const opts = this.options;
      const idx = opts.findIndex(o => o.value === this.value);
      return idx >= 0 ? idx : (opts.length > 0 ? 0 : -1);
    }
    appendChild(child) {
      child.parentElement = this;
      this.children.push(child);
      return child;
    }
    insertBefore(newChild, refChild) {
      newChild.parentElement = this;
      const idx = this.children.indexOf(refChild);
      if (idx !== -1) this.children.splice(idx, 0, newChild);
      else this.children.push(newChild);
      return newChild;
    }
    setAttribute(k, v) { this.attributes[k] = String(v); }
    getAttribute(k) { return this.attributes[k]; }
    addEventListener(evt, fn) {
      (this._listeners[evt] = this._listeners[evt] || []).push(fn);
    }
    dispatchEvent(e) {
      const fns = this._listeners[e.type] || [];
      fns.forEach(fn => fn(e));
    }
    querySelector(sel) {
      if (sel === '.btn-text') {
        return this._btnText || (this._btnText = new MockElement('span'));
      }
      if (sel === '.btn-chevron') return new MockElement('span');
      return null;
    }
    querySelectorAll(sel) { return []; }
    contains() { return false; }
    focus() {}
  }

  const listeners = {};
  const mockDoc = {
    readyState: 'complete',
    createElement: tag => new MockElement(tag),
    getElementById: id => (id === 'web_nat' ? selectElem : null),
    addEventListener: (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); },
    documentElement: { lang: 'km' }
  };

  const selectElem = new MockElement('select');
  selectElem.id = 'web_nat';
  const parent = new MockElement('div');
  parent.appendChild(selectElem);

  const context = {
    window: {
      getBorkeoLanguage: () => currentLangState,
      addEventListener: (evt, fn) => { (listeners[evt] = listeners[evt] || []).push(fn); },
      dispatchEvent: (e) => { (listeners[e.type] || []).forEach(fn => fn(e)); }
    },
    document: mockDoc,
    HTMLSelectElement: HTMLSelectElement,
    Option: function(text, val) {
      const opt = new MockElement('option');
      opt.textContent = text;
      opt.value = val;
      return opt;
    },
    Event: function(type) { this.type = type; }
  };

  vm.createContext(context);
  vm.runInContext(code, context);

  // Initialize
  context.window.EMRNationalities.init();
  const instance = context.window.EMRNationalities.getInstance();
  assert.ok(instance, 'Dropdown instance must be created');

  // Initial state in Khmer
  assert.equal(selectElem.value, 'ខ្មែរ');
  const btnTextElem = instance.btn.querySelector('.btn-text');
  assert.equal(btnTextElem.textContent, 'ខ្មែរ', 'Button text must be pure Khmer initially');
  assert.equal(instance.searchInput.placeholder, 'ស្វែងរកជនជាតិ/សញ្ជាតិ...');

  // User selects Pnong
  instance.setValue('ព្នង');
  assert.equal(selectElem.value, 'ព្នង');
  assert.equal(btnTextElem.textContent, 'ព្នង', 'Button text must be pure Khmer ព្នង');

  // Switch to English language
  currentLangState = 'en';
  context.window.EMRNationalities.syncLanguage('en');

  // Value must remain unchanged!
  assert.equal(selectElem.value, 'ព្នង', 'select.value must remain preserved across language toggle');
  // Visible label updates to pure English
  assert.equal(btnTextElem.textContent, 'Pnong', 'Button text must update to pure English Pnong');
  assert.equal(instance.searchInput.placeholder, 'Search nationality/ethnicity...');

  // Switch back to Khmer language
  currentLangState = 'kh';
  context.window.EMRNationalities.syncLanguage('kh');

  assert.equal(selectElem.value, 'ព្នង', 'select.value must remain preserved returning to Khmer');
  assert.equal(btnTextElem.textContent, 'ព្នង', 'Button text must return to pure Khmer ព្នង');
  assert.equal(instance.searchInput.placeholder, 'ស្វែងរកជនជាតិ/សញ្ជាតិ...');
});
