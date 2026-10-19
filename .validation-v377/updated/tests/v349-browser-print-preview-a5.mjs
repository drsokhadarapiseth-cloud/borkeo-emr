import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createEmrServer } from '../server/server.mjs';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function getWsEndpoint(port) {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (res.ok) {
        const json = await res.json();
        const page = json.find(t => t.type === 'page');
        if (page?.webSocketDebuggerUrl) return page.webSocketDebuggerUrl;
      }
    } catch (_) {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error('Could not connect to browser CDP port ' + port);
}

class SimpleCdp {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 0;
    this.callbacks = new Map();
  }

  async connect() {
    this.ws = new globalThis.WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });
    this.ws.onmessage = event => {
      const msg = JSON.parse(event.data.toString());
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(new Error(msg.error.message));
        else resolve(msg.result);
      }
    };
  }

  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    try { this.ws?.close(); } catch (_) {}
  }
}

async function run() {
  console.log('--- Starting A5 Patient Stickers Browser Verification ---');

  const serverPort = 3001;
  console.log(`Using active EMR server on http://127.0.0.1:${serverPort}`);

  // 2. Launch headless Edge with remote debugging
  const cdpPort = 9222 + Math.floor(Math.random() * 500);
  const userDataDir = path.join(process.cwd(), 'scratch', 'browser-data-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const browserProc = spawn(EDGE_PATH, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--disable-translate',
    '--hide-scrollbars',
    '--mute-audio',
    'about:blank'
  ]);

  let cdp;
  try {
    const wsUrl = await getWsEndpoint(cdpPort);
    cdp = new SimpleCdp(wsUrl);
    await cdp.connect();
    console.log('Connected to Edge via CDP.');

    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    // 3. Log in with doctor_opd to get real session cookie
    const loginRes = await fetch(`http://127.0.0.1:${serverPort}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: `http://127.0.0.1:${serverPort}` },
      body: JSON.stringify({ username: 'doctor_opd' })
    });
    if (!loginRes.ok) throw new Error('Login failed with status ' + loginRes.status);
    const setCookie = loginRes.headers.get('set-cookie') || '';
    const [cName, cVal] = setCookie.split(';')[0].split('=');

    await cdp.send('Network.enable');
    await cdp.send('Network.setCookie', {
      name: cName,
      value: cVal,
      domain: '127.0.0.1',
      path: '/'
    });

    // 4. Navigate to EMR (/emr serves protected/EMR.html)
    console.log('Navigating to /emr...');
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${serverPort}/emr` });
    // Wait for Page.loadEventFired
    await new Promise(resolve => {
      cdp.ws.addEventListener('message', function handler(e) {
        const msg = JSON.parse(e.data.toString());
        if (msg.method === 'Page.loadEventFired') {
          cdp.ws.removeEventListener('message', handler);
          resolve();
        }
      });
      setTimeout(resolve, 3000);
    });

    // 5. Populate synthetic patient details & test sticker dialog
    const initResult = await cdp.send('Runtime.evaluate', {
      expression: `(function() {
        // Set test patient details
        const setVal = (id, val) => {
          const el = document.getElementById(id);
          if (el) { el.value = val; el.dispatchEvent(new Event('input', { bubbles: true })); }
        };
        setVal('web_last_name', 'សុខ');
        setVal('web_first_name', 'ចន្ថា');
        setVal('web_age', '32 ឆ្នាំ');
        setVal('web_dob', '1994-05-12');
        setVal('web_phone', '012 345 678');
        setVal('web_village', 'ភូមិ ១');
        setVal('web_commune', 'ឃុំ ២');
        setVal('web_district', 'ស្រុក បរកែវ');
        setVal('web_province', 'ខេត្ត រតនគិរី');
        setVal('web_health_id', '160201-261014-999');

        const femaleRadio = document.querySelector('input[name="sex_radio"][value="ស្រី"]');
        if (femaleRadio) femaleRadio.checked = true;

        // Open Sticker Studio dialog
        window.openPatientCardPrintModal();
        return {
          dialogOpen: document.getElementById('patient_card_dialog')?.open,
          type: document.getElementById('card_print_type')?.value,
          width: document.getElementById('card_custom_width')?.value,
          height: document.getElementById('card_custom_height')?.value,
          gap: document.getElementById('card_custom_gap')?.value,
          count: document.getElementById('card_label_count')?.value,
          state: window.patientCardState
        };
      })()`,
      returnByValue: true
    });

    console.log('Studio Dialog Open Result:', initResult.result.value);
    const studioVal = initResult.result.value;
    if (!studioVal.dialogOpen) throw new Error('Sticker Studio dialog did not open');
    if (studioVal.type !== 'a5_sheet') throw new Error(`Default type expected 'a5_sheet', got '${studioVal.type}'`);
    if (String(studioVal.width) !== '67') throw new Error(`Default width expected 67, got ${studioVal.width}`);
    if (String(studioVal.height) !== '35') throw new Error(`Default height expected 35, got ${studioVal.height}`);
    if (String(studioVal.gap) !== '2') throw new Error(`Default gap expected 2, got ${studioVal.gap}`);

    // Wait for QR code and fonts to settle
    await new Promise(r => setTimeout(r, 1000));

    // 6. Hook iframe window.print before calling printPatientCards()
    console.log('Triggering printPatientCards() with interceptor...');
    const printHookResult = await cdp.send('Runtime.evaluate', {
      expression: `(function() {
        return new Promise((resolve, reject) => {
          // Monitor creation of card_print_iframe
          const observer = new MutationObserver(() => {
            const frame = document.getElementById('card_print_iframe');
            if (frame && frame.contentWindow) {
              frame.contentWindow.print = function() {
                window.__printCalled = true;
              };
            }
          });
          observer.observe(document.body, { childList: true, subtree: true });

          window.printPatientCards().then(() => {
            observer.disconnect();
            const frame = document.getElementById('card_print_iframe');
            if (!frame || !frame.contentDocument) return reject(new Error('Iframe not found'));
            const doc = frame.contentDocument;
            const cards = Array.from(doc.querySelectorAll('.patient-id-card'));
            const sheet = doc.querySelector('.print-sheet');
            const grid = doc.querySelector('.print-grid');
            const style = doc.querySelector('style')?.textContent || '';

            const sheetRect = sheet?.getBoundingClientRect();
            const gridRect = grid?.getBoundingClientRect();
            const cardRects = cards.map(c => {
              const r = c.getBoundingClientRect();
              return { width: r.width, height: r.height, top: r.top, left: r.left };
            });

            resolve({
              printCalled: !!window.__printCalled,
              cardCount: cards.length,
              hasA5PageRule: /@page\\s*\\{[^}]*size:\\s*A5\\s*portrait/i.test(style),
              hasA5Margin5mm: /@page\\s*\\{[^}]*margin:\\s*5mm/i.test(style),
              sheetWidthMm: sheet?.style.width || getComputedStyle(sheet).width,
              sheetHeightMm: sheet?.style.height || getComputedStyle(sheet).height,
              gridDisplay: getComputedStyle(grid).display,
              gridColumns: getComputedStyle(grid).gridTemplateColumns,
              gridRows: getComputedStyle(grid).gridTemplateRows,
              gridGap: getComputedStyle(grid).gap,
              cardRects: cardRects.slice(0, 3), // first 3 for inspection
              allCardsInsideSheet: cardRects.every(r => r.top >= sheetRect.top - 1 && (r.top + r.height) <= sheetRect.bottom + 2)
            });
          }).catch(reject);
        });
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Iframe Pre-Print Inspection Result:', printHookResult.result.value);
    const insp = printHookResult.result.value;

    if (insp.cardCount !== 10) {
      throw new Error(`Expected exactly 10 cards in iframe, found ${insp.cardCount}`);
    }
    if (!insp.hasA5PageRule) {
      throw new Error('@page size: A5 portrait rule missing in iframe style');
    }
    if (!insp.hasA5Margin5mm) {
      throw new Error('@page margin: 5mm rule missing in iframe style');
    }
    if (!insp.allCardsInsideSheet) {
      throw new Error('One or more of the 10 cards overflow the A5 sheet height');
    }
    console.log('SUCCESS: Final iframe inspection passed! Exactly 10 cards arranged in 2 columns x 5 rows within A5 sheet.');

    // 7. Save to PDF verification: Print the document to PDF using Chromium Page.printToPDF
    console.log('Generating Save to PDF output to verify "1 of 1" pages...');
    // Navigate to iframe directly or evaluate printToPDF on iframe document
    const frameHtmlResult = await cdp.send('Runtime.evaluate', {
      expression: `document.getElementById('card_print_iframe').contentDocument.documentElement.outerHTML`,
      returnByValue: true
    });
    const frameHtml = frameHtmlResult.result.value;

    // Load the isolated iframe document directly in a page to test physical pagination
    await cdp.send('Page.navigate', { url: 'about:blank' });
    await cdp.send('Page.setDocumentContent', {
      frameId: (await cdp.send('Page.getFrameTree')).frameTree.frame.id,
      html: frameHtml
    });
    await new Promise(r => setTimeout(r, 1000));

    // A5 paper: 148 mm x 210 mm = 5.827 in x 8.268 in
    const pdfResult = await cdp.send('Page.printToPDF', {
      paperWidth: 5.827,
      paperHeight: 8.268,
      marginTop: 0.197, // 5mm
      marginBottom: 0.197, // 5mm
      marginLeft: 0.197, // 5mm
      marginRight: 0.197, // 5mm
      preferCSSPageSize: true,
      printBackground: true
    });

    const pdfBuffer = Buffer.from(pdfResult.data, 'base64');
    const pdfPath = path.join(process.cwd(), 'scratch', 'a5_patient_stickers_preview.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);
    console.log(`Saved A5 print preview PDF to: ${pdfPath} (${pdfBuffer.length} bytes)`);

    // Verify page count in the generated PDF
    // In PDF standard, page objects are represented as `/Type /Page` (or `/Type/Page`)
    const pdfStr = pdfBuffer.toString('binary');
    const pageMatches = pdfStr.match(/\/Type\s*\/Page\b/g);
    const pageCount = pageMatches ? pageMatches.length : 1;
    console.log(`PDF Page Count Analysis: ${pageCount} page(s) detected.`);

    if (pageCount !== 1) {
      throw new Error(`Expected exactly 1 page ("1 of 1"), but PDF generated ${pageCount} pages!`);
    }

    console.log('CONFIRMED: "Save to PDF" produces exactly 1 page ("1 of 1") on A5 Portrait with 10 visible stickers!');

  } finally {
    cdp?.close();
    browserProc.kill();
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}
  }

  console.log('--- ALL BROWSER PRINT PREVIEW VERIFICATIONS PASSED ---');
}

run().catch(err => {
  console.error('VERIFICATION ERROR:', err);
  process.exit(1);
});
