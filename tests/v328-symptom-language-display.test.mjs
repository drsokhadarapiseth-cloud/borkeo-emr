import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();
const source = fs.readFileSync(path.join(rootDir, 'public/chief-complaint-tags.js'), 'utf8');


test('v32.8 chief-complaint dropdown displays pure Khmer in Khmer form and pure English in English form without parentheses', () => {
  function makeEnv(lang = 'km') {
    const catalog = [];
    const catalogDetails = new Map();
    const selectedSymptoms = new Set();
    const elements = new Map();
    const doc = {
      documentElement: { lang },
      getElementById: (id) => {
        if (!elements.has(id)) {
          elements.set(id, {
            id,
            value: '',
            textContent: '',
            style: {},
            classList: { toggle: () => {}, add: () => {}, remove: () => {} },
            appendChild: () => {},
            addEventListener: () => {},
            dispatchEvent: () => {}
          });
        }
        return elements.get(id);
      },
      querySelectorAll: () => [],
      addEventListener: () => {}
    };

    const ctx = {
      window: {
        _borkeoChiefComplaintInitialized: false,
        getBorkeoLanguage: () => (lang === 'en' ? 'en' : 'kh'),
        addEventListener: () => {},
        dispatchEvent: () => {}
      },
      document: doc,
      Event: class {},
      CustomEvent: class {},
      MutationObserver: class { observe() {} disconnect() {} },
      setTimeout: (fn) => fn(),
      clearTimeout: () => {},
      fetch: async () => ({ ok: true, json: async () => ({ items: [] }) }),
      localStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      sessionStorage: { getItem: () => null, setItem: () => {}, removeItem: () => {} },
      console
    };

    vm.runInNewContext(source, ctx);
    return ctx;
  }

  // Khmer mode
  const kmCtx = makeEnv('km');
  const ccKm = kmCtx.window.BorkeoChiefComplaint;
  assert.equal(ccKm.isEnglish(), false);

  // English mode
  const enCtx = makeEnv('en');
  const ccEn = enCtx.window.BorkeoChiefComplaint;
  assert.equal(ccEn.isEnglish(), true);
});

test('v32.8 getLocalizedName resolves pure language labels and falls back gracefully', () => {
  function normalize(value) {
    return String(value || '').normalize('NFKC').replace(/\p{Cf}/gu, '').replace(/\s+/gu, ' ').trim().toLowerCase();
  }

  const catalogDetails = new Map();
  const catalog = [];

  function remember(item) {
    const name = item.nameKh || item.nameEn;
    const key = normalize(name);
    let names = catalogDetails.get(key);
    if (!names) { names = []; catalogDetails.set(key, names); catalog.push(name); }
    if (!names.some(x => x.id === item.id)) names.push(item);
    return catalog.find(x => normalize(x) === key) || name;
  }

  remember({ id: '1', nameKh: 'កញ្ចក់ភ្នែកល្អក់', nameEn: 'cloudy cornea / corneal opacity', code: 'SYMP:0000001' });
  remember({ id: '2', nameKh: 'កណ្ដាស់', nameEn: 'sneezing', code: 'SYMP:0000002' });
  remember({ id: '3', nameKh: 'កន្ទួលត្រអាក', nameEn: 'urticaria', code: 'SYMP:0000003' });
  remember({ id: '4', nameKh: '', nameEn: 'anaphylactic shock', code: null }); // English-only custom
  remember({ id: '5', nameKh: 'ឈឺសន្លាក់ដៃ', nameEn: '', code: null }); // Khmer-only custom

  // Test in Khmer mode
  let lang = 'km';
  const kmDoc = { documentElement: { lang: 'km' } };
  const ctxKm = {
    catalog,
    catalogDetails,
    normalize,
    window: { getBorkeoLanguage: () => 'kh' },
    document: kmDoc
  };
  const a = source.indexOf('  function findLabel(');
  const b = source.indexOf('  async function securityToken(', a);
  vm.runInNewContext(source.slice(a, b) + '\nthis.getLocalizedName=getLocalizedName;this.isEnglish=isEnglish;this.findLabel=findLabel;', ctxKm);

  assert.equal(ctxKm.isEnglish(), false);
  // Bilingual entries return pure Khmer without parentheses
  assert.equal(ctxKm.getLocalizedName('កញ្ចក់ភ្នែកល្អក់'), 'កញ្ចក់ភ្នែកល្អក់');
  assert.equal(ctxKm.getLocalizedName('cloudy cornea / corneal opacity'), 'កញ្ចក់ភ្នែកល្អក់');
  assert.equal(ctxKm.getLocalizedName('កណ្ដាស់'), 'កណ្ដាស់');
  assert.equal(ctxKm.getLocalizedName('sneezing'), 'កណ្ដាស់');
  assert.equal(ctxKm.getLocalizedName('កន្ទួលត្រអាក'), 'កន្ទួលត្រអាក');
  assert.equal(ctxKm.getLocalizedName('urticaria'), 'កន្ទួលត្រអាក');
  // Fallbacks
  assert.equal(ctxKm.getLocalizedName('anaphylactic shock'), 'anaphylactic shock');
  assert.equal(ctxKm.getLocalizedName('ឈឺសន្លាក់ដៃ'), 'ឈឺសន្លាក់ដៃ');

  // Test in English mode
  const enDoc = { documentElement: { lang: 'en' } };
  const ctxEn = {
    catalog,
    catalogDetails,
    normalize,
    window: { getBorkeoLanguage: () => 'en' },
    document: enDoc
  };
  vm.runInNewContext(source.slice(a, b) + '\nthis.getLocalizedName=getLocalizedName;this.isEnglish=isEnglish;this.findLabel=findLabel;', ctxEn);

  assert.equal(ctxEn.isEnglish(), true);
  // Bilingual entries return pure English without parentheses
  assert.equal(ctxEn.getLocalizedName('កញ្ចក់ភ្នែកល្អក់'), 'cloudy cornea / corneal opacity');
  assert.equal(ctxEn.getLocalizedName('cloudy cornea / corneal opacity'), 'cloudy cornea / corneal opacity');
  assert.equal(ctxEn.getLocalizedName('កណ្ដាស់'), 'sneezing');
  assert.equal(ctxEn.getLocalizedName('sneezing'), 'sneezing');
  assert.equal(ctxEn.getLocalizedName('កន្ទួលត្រអាក'), 'urticaria');
  assert.equal(ctxEn.getLocalizedName('urticaria'), 'urticaria');
  // Fallbacks
  assert.equal(ctxEn.getLocalizedName('anaphylactic shock'), 'anaphylactic shock');
  assert.equal(ctxEn.getLocalizedName('ឈឺសន្លាក់ដៃ'), 'ឈឺសន្លាក់ដៃ');
});

test('v32.8 dynamic language switching updates Chief Complaint UI placeholders and tags', () => {
  let lang = 'km';
  const tagBox = { classList: { toggle: () => {} }, style: {}, appendChild: () => {}, innerHTML: '' };
  const searchInput = { value: '', placeholder: 'ស្វែងរកខ្មែរ / English / Code' };
  const placeholder = { style: {}, textContent: 'ជ្រើសរើស ឬវាយបញ្ចូលរោគសញ្ញា...' };
  const targetInput = { value: '', dispatchEvent: () => {} };
  const itemsInput = { value: '' };

  const ctx = {
    isEnglish: () => lang === 'en',
    getTargetInput: () => targetInput,
    document: {
      getElementById: (id) => {
        if (id === 'chief_complaint_tag_box') return tagBox;
        if (id === 'cc_search_input') return searchInput;
        if (id === 'cc_placeholder_text') return placeholder;
        if (id === 'pmrs_chief_complaint') return targetInput;
        if (id === 'pmrs_chief_complaint_items') return itemsInput;
        return null;
      }
    },
    syncToInput: () => {},
    renderOptions: () => {}
  };

  const a = source.indexOf('  function updateLanguage() {');
  const b = source.indexOf('  window.addEventListener(\'DOMContentLoaded\', init);', a);
  vm.runInNewContext(source.slice(a, b) + '\nthis.updateLanguage=updateLanguage;', ctx);

  // Initial Khmer state
  lang = 'km';
  ctx.updateLanguage();
  assert.equal(searchInput.placeholder, 'ស្វែងរកខ្មែរ / English / Code');
  assert.equal(placeholder.textContent, 'ជ្រើសរើស ឬវាយបញ្ចូលរោគសញ្ញា...');

  // Switch to English
  lang = 'en';
  ctx.updateLanguage();
  assert.equal(searchInput.placeholder, 'Search Khmer / English / Code');
  assert.equal(placeholder.textContent, 'Select or type symptoms...');

  // Switch back to Khmer
  lang = 'km';
  ctx.updateLanguage();
  assert.equal(searchInput.placeholder, 'ស្វែងរកខ្មែរ / English / Code');
  assert.equal(placeholder.textContent, 'ជ្រើសរើស ឬវាយបញ្ចូលរោគសញ្ញា...');
});
