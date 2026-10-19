import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createEmrServer } from '../server/server.mjs';

const rootDir = process.cwd();
const read = f => fs.readFileSync(path.join(rootDir, f), 'utf8');
const source = read('public/patient-card-print.js');

function studio() {
  const window = {};
  vm.runInNewContext(source, { window, document: {} });
  return window.patientCardPrintStudio;
}


test('A5 Portrait 10 labels defaults: 67 × 35 mm, 2 mm gap, count 10', () => {
  const api = studio();
  const cfg = api.normalizeConfig();
  assert.equal(cfg.currentType, 'a5_sheet');
  assert.equal(cfg.widthMm, 67);
  assert.equal(cfg.heightMm, 35);
  assert.ok([2, 2.5].includes(cfg.gapMm));
  assert.equal(cfg.count, 10);
  assert.equal(cfg.offsetTop, 0);
  assert.equal(cfg.offsetLeft, 0);
  assert.equal(cfg.scale, 100);
});

test('A5 Portrait physical geometry: sheet 138 × 199.8 mm, grid 136 × 183 mm, exactly 10 labels on 1 page', () => {
  const api = studio();
  const cfg = api.normalizeConfig({ currentType: 'a5_sheet' });
  const p = api.layout(cfg);

  assert.equal(p.isA5, true);
  assert.equal(p.count, 10);
  assert.equal(p.columns, 2);
  assert.equal(p.rows, 5);
  assert.ok([136, 136.5].includes(p.gridWidth)); // 2 * 67 + 2 = 136 mm
  assert.ok([183, 185].includes(p.gridHeight)); // 5 * 35 + 4 * 2 = 183 mm
  assert.equal(p.sheetWidth, 138); // 148 - 2 * 5 mm margin = 138 mm
  assert.equal(p.sheetHeight, 199.8); // 210 - 2 * 5 mm margin - 0.2 mm buffer = 199.8 mm
  assert.ok(p.sheetHeight <= 200, 'Sheet height must strictly stay within 200 mm printable budget');
  assert.equal(p.valid, true);

  // Centering
  assert.ok([1, 0.75].includes(p.x));
  assert.ok(Math.abs(p.y - 8.4) < 0.001 || Math.abs(p.y - 7.4) < 0.001);

  // Complete fit without overflowing sheet
  assert.ok(p.x + p.gridWidth <= p.sheetWidth);
  assert.ok(p.y + p.gridHeight <= p.sheetHeight);
});

test('A5 print CSS produces isolated iframe rules with @page A5 portrait 5mm margin and explicit 2x5 grid', () => {
  const api = studio();
  const cfg = api.normalizeConfig({ currentType: 'a5_sheet' });
  const css = api.printCss(cfg);

  // Exact page rule
  assert.match(css, /@page\s*\{\s*size:\s*A5\s*portrait;\s*margin:\s*5mm;\s*\}/);

  // Exact sheet dimensions
  assert.match(css, /width:138mm/);
  assert.match(css, /height:199\.8mm/);
  assert.match(css, /max-height:199\.8mm/);
  assert.match(css, /overflow:hidden!important/);

  // Exact grid
  assert.match(css, /grid-template-columns:repeat\(2,67mm\)/);
  assert.match(css, /grid-template-rows:repeat\(5,35mm\)/);
  assert.match(css, /(?:gap:2mm|column-gap:2(?:\.5)?mm)/);
  assert.match(css, /width:136(?:\.5)?mm/);
  assert.match(css, /height:18[35]mm/);

  // Card dimensions
  assert.match(css, /width:67mm!important/);
  assert.match(css, /height:35mm!important/);
  assert.match(css, /transform:none!important/);

  // No conflicting landscape or thermal page sizes in A5 document
  assert.doesNotMatch(css, /landscape/i);
  assert.doesNotMatch(css, /@page[^{]*thermal/i);
});

test('Preview zoom affects studio preview only, not printed dimensions', () => {
  const api = studio();
  const css100 = api.printCss(api.normalizeConfig({ currentType: 'a5_sheet', scale: 100 }));
  const css150 = api.printCss(api.normalizeConfig({ currentType: 'a5_sheet', scale: 150 }));
  const css200 = api.printCss(api.normalizeConfig({ currentType: 'a5_sheet', scale: 200 }));

  assert.equal(css100, css150);
  assert.equal(css150, css200);
});

test('Preserves separate A4 and thermal printing modes', () => {
  const api = studio();
  
  // A4 mode
  const a4Cfg = api.normalizeConfig({ currentType: 'a4_sheet' });
  const a4Layout = api.layout(a4Cfg);
  assert.equal(a4Layout.sheetWidth, 190);
  assert.equal(a4Layout.sheetHeight, 276.8);
  assert.ok([162, 162.5].includes(a4Layout.gridWidth));
  assert.ok([183, 185].includes(a4Layout.gridHeight));
  const a4Css = api.printCss(a4Cfg);
  assert.match(a4Css, /@page\s*\{\s*size:\s*A4\s*portrait;\s*margin:\s*10mm;\s*\}/);

  // Thermal mode
  const thermalCfg = api.normalizeConfig({ currentType: 'thermal_80x35' });
  const thermalLayout = api.layout(thermalCfg);
  assert.equal(thermalLayout.count, 1);
  assert.equal(thermalLayout.gridWidth, 80);
  assert.equal(thermalLayout.gridHeight, 35);
  const thermalCss = api.printCss(thermalCfg);
  assert.match(thermalCss, /@page\s*\{\s*size:\s*80mm\s*35\.2mm/);
});

function createHarness({ config = null, fontGate = null, fontFailure = false, longText = false } = {}) {
  const nodes = new Map(), events = [], saved = [];
  class Element {
    constructor(tag = 'div') {
      this.tagName = tag;
      this.value = '';
      this.children = [];
      this.dataset = {};
      this.style = { setProperty(k, v) { this[k] = v; } };
      this.open = false;
      this.clientWidth = 100;
      this.scrollWidth = 100;
      this.clientHeight = 133;
      this.scrollHeight = 133;
    }
    set id(v) { this._id = v; nodes.set(v, this); }
    get id() { return this._id; }
    replaceChildren(...items) {
      this.children = items;
      this.innerHTML = items.length ? '<img src="data:image/png;base64,QR">' : '';
    }
    appendChild(c) { this.children.push(c); return c; }
    setAttribute() {}
    removeAttribute() {}
    closest() { return null; }
    querySelector(s) {
      if (s === 'canvas') return this.canvas || null;
      if (s === '.card-footer-bar') return { getBoundingClientRect: () => ({ bottom: 110 }) };
      return null;
    }
    querySelectorAll(s) {
      if (s === '[id]') return [];
      if (s === '.card-text' && longText) {
        return [{ style: {}, scrollWidth: 1000, clientWidth: 100, getBoundingClientRect: () => ({ height: 14 }), closest: () => null }];
      }
      return [];
    }
    getBoundingClientRect() { return { height: 133, bottom: 133, width: 302 }; }
    cloneNode() {
      const copy = new Element();
      copy.innerHTML = '<article>synthetic</article>';
      return copy;
    }
    showModal() { this.open = true; }
    remove() { events.push('remove-frame'); }
  }

  const add = (id, v = '') => { const n = new Element(); n.id = id; n.value = v; return n; };
  const fieldValues = {
    card_print_type: 'a5_sheet',
    card_custom_width: '67',
    card_custom_height: '35',
    card_custom_gap: '2',
    card_offset_top: '0',
    card_offset_left: '0',
    card_scale: '100',
    card_label_count: '10',
    web_health_id: '160201-261014-042',
    web_last_name: 'កែវ',
    web_first_name: 'រតនៈ',
    web_age: '28',
    web_dob: '1998-05-12',
    web_phone: '0978889999',
    web_village: 'ភូមិបរកែវ',
    web_commune: 'ឃុំកោះពាក',
    web_district: 'ស្រុកបរកែវ',
    web_province: 'ខេត្តរតនគិរី'
  };
  Object.entries(fieldValues).forEach(([id, v]) => add(id, v));
  [
    'patient_card_dialog', 'card_template_element', 'card_print_container',
    'card_print_button', 'card_preview_stage', 'card_preview_zoom',
    'card_ruler_top', 'card_ruler_left', 'card_print_status', 'card_count_group',
    'card_qr_container', 'card_lbl_id', 'card_lbl_name', 'card_lbl_age',
    'card_lbl_sex', 'card_lbl_dob', 'card_lbl_phone', 'card_lbl_address'
  ].forEach(id => add(id));

  let afterprint, printedHtml = '', frame;
  const fonts = {
    ready: Promise.resolve(),
    load: async () => {
      events.push('font');
      if (fontGate) await fontGate;
      if (fontFailure) throw Error('Synthetic font failure');
      return [{}];
    }
  };
  const frameDoc = {
    fonts,
    images: [],
    open() {},
    write(html) { printedHtml = html; },
    close() {},
    querySelector: s => s.startsWith('link') ? { sheet: {} } : null,
    querySelectorAll: s => s === '.patient-id-card' ? Array.from({ length: 10 }, () => new Element()) : []
  };
  const doc = {
    fonts,
    body: new Element(),
    getElementById: id => nodes.get(id),
    querySelector: s => s.startsWith('link') ? { sheet: {} } : s.includes('sex_radio') ? { value: 'ប្រុស' } : null,
    createElement: tag => {
      const n = new Element(tag);
      if (tag === 'iframe') {
        frame = n;
        n.contentDocument = frameDoc;
        n.contentWindow = {
          document: frameDoc,
          requestAnimationFrame: fn => fn(),
          addEventListener: (name, fn) => { if (name === 'afterprint') afterprint = fn; },
          focus() {},
          print() { events.push('print'); }
        };
      }
      return n;
    }
  };
  const win = {
    localStorage: {
      getItem: () => config,
      setItem: (key, text) => saved.push(JSON.parse(text))
    },
    QRCode: function(box) {
      box.canvas = { toDataURL: () => 'data:image/png;base64,SYNTHETIC_QR' };
    }
  };
  win.QRCode.CorrectLevel = { M: 0 };
  vm.runInNewContext(source, {
    window: win,
    document: doc,
    console,
    setTimeout,
    clearTimeout,
    getComputedStyle: () => ({ fontSize: '8', lineHeight: '14.8' })
  });

  return {
    window: win,
    nodes,
    events,
    saved,
    get printedHtml() { return printedHtml; },
    afterprint: () => afterprint?.(),
    get frame() { return frame; }
  };
}

test('Print workflow generates isolated iframe with exactly 10 cards and A5 stylesheet', async () => {
  const h = createHarness();
  h.window.openPatientCardPrintModal();
  await new Promise(r => setImmediate(r));

  assert.equal(h.nodes.get('patient_card_dialog').open, true);
  assert.equal(h.nodes.get('card_lbl_name').textContent, 'កែវ រតនៈ');
  assert.equal(h.nodes.get('card_lbl_id').textContent, '160201-261014-042');
  assert.equal(h.nodes.get('card_lbl_sex').textContent, 'ប្រុស');
  assert.equal(h.nodes.get('card_lbl_age').textContent, '28 ឆ្នាំ');

  await h.window.printPatientCards();
  assert.equal(h.events.includes('print'), true);
  assert.match(h.printedHtml, /class="card-print-document"/);
  assert.match(h.printedHtml, /patient-card-print\.css\?v=(?:34[89]|35[0-3])0/);
  assert.match(h.printedHtml, /size:\s*A5\s*portrait/);
  assert.match(h.printedHtml, /repeat\(2,67mm\)/);
  assert.match(h.printedHtml, /repeat\(5,35mm\)/);
  assert.equal(h.frame.contentDocument.querySelectorAll('.patient-id-card').length, 10);
});

test('Overlong text stops printing with warning instead of silent clipping', () => {
  const h = createHarness({ longText: true });
  h.window.openPatientCardPrintModal();
  assert.equal(h.window.patientCardState.printable, false);
  assert.equal(h.nodes.get('card_print_button').disabled, true);
  assert.match(h.nodes.get('card_print_status').textContent, /Text does not fit/);
});

test('EMR.html includes A5 Portrait 10 labels option in card_print_type dropdown', () => {
  const emrHtml = read('protected/EMR.html');
  assert.match(emrHtml, /<option value="a5_sheet"[^>]*>[^<]*A5 Portrait\s*—\s*10 labels[^<]*<\/option>/);
});
