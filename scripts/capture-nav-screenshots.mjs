// Captures sidebar screenshots (collapsed, expanded on hover, mobile drawer)
// using headless Microsoft Edge over the DevTools protocol. Runs against an
// in-memory demo server, so no patient database is touched.
// Usage: node scripts/capture-nav-screenshots.mjs before|after
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createEmrServer } from '../server/server.mjs';

const prefix = process.argv[2] || 'after';
const outputDir = path.resolve('docs/ui-screenshots');
fs.mkdirSync(outputDir, { recursive: true });
const edgePath = process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const port = 32999, debugPort = 9333;
const origin = `http://127.0.0.1:${port}`;
const sleep = ms => new Promise(r => setTimeout(r, ms));

const shots = [
  { user: 'doctor_medicine', page: '/departments' },
  { user: 'admin', page: '/home' },
  { user: 'pharmacy', page: '/pharmacy/opd' },
];

const app = createEmrServer({ demoMode: true, host: '127.0.0.1', port, appOrigin: origin, databasePath: ':memory:', autoDatabase: false, nodeEnv: 'test' });
await new Promise(r => app.server.listen(port, '127.0.0.1', r));
const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-edge-'));
const edge = spawn(edgePath, ['--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });

async function connect() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json();
      const page = list.find(t => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(200);
  }
  throw new Error('Edge DevTools endpoint did not start.');
}

const ws = new WebSocket(await connect());
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let seq = 0;
const pending = new Map();
ws.addEventListener('message', event => {
  const msg = JSON.parse(event.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const id = ++seq;
  pending.set(id, msg => msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result));
  ws.send(JSON.stringify({ id, method, params }));
});

async function login(username) {
  const res = await fetch(`${origin}/api/auth/login`, { method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username }) });
  if (res.status !== 200) throw new Error(`Login failed for ${username}`);
  const [name, value] = res.headers.get('set-cookie').split(';')[0].split('=');
  await send('Network.clearBrowserCookies');
  await send('Network.setCookie', { name, value, url: origin });
}

async function capture(file, { width, height, mobile = false, before } = {}) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
  if (before) await before();
  await sleep(500);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(outputDir, file), Buffer.from(data, 'base64'));
  console.log('Captured', file);
}

const evaluate = expression => send('Runtime.evaluate', { expression, awaitPromise: true });

// Optional: EVAL="js expression" prints a value from the first page instead of capturing.
const debugExpression = process.env.EVAL;

try {
  await send('Page.enable');
  if (debugExpression) {
    await login(process.env.EVAL_USER || shots[0].user);
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: origin + (process.env.EVAL_PAGE || shots[0].page) });
    await sleep(2500);
    const { result } = await evaluate(`JSON.stringify(${debugExpression})`);
    console.log(result.value ?? result.description);
    shots.length = 0;
  }
  await send('Network.enable');
  for (const shot of shots) {
    await login(shot.user);
    const name = `${prefix}-${shot.user}`;
    await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Page.navigate', { url: origin + shot.page });
    await sleep(2500);
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1200, y: 500 });
    await sleep(600);
    await capture(`${name}-collapsed-1440.png`, { width: 1440, height: 900 });
    await capture(`${name}-expanded-1440.png`, {
      width: 1440, height: 900,
      before: async () => { await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 30, y: 320 }); },
    });
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: 1200, y: 500 });
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
    await send('Page.reload');
    await sleep(2500);
    await capture(`${name}-mobile-390.png`, { width: 390, height: 844, mobile: true });
    await capture(`${name}-mobile-drawer-390.png`, {
      width: 390, height: 844, mobile: true,
      before: () => evaluate(`(document.getElementById('emr-sidebar-toggle-btn')||document.getElementById('emr-mobile-menu-btn'))?.click()`),
    });
  }
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  ws.close();
  edge.kill();
  await new Promise(r => app.server.close(r));
  app.database.close?.();
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
  process.exit(process.exitCode || 0);
}
