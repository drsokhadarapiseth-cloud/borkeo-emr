import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

export async function openBrowser({ extensionPath } = {}) {
  const executable = [process.env.EMR_TEST_BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe']
    .find(file => file && fs.existsSync(file));
  assert.ok(executable, 'Set EMR_TEST_BROWSER to run this explicit Chromium test.');
  const debugPort = 9400 + Math.floor(Math.random() * 400);
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'borkeo-context-browser-'));
  const child = spawn(executable, [...(extensionPath ? ['--disable-extensions-except='+extensionPath,'--load-extension='+extensionPath] : []), '--headless=new', '--disable-gpu', '--no-first-run', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let launchError;
  child.on('error', error => { launchError = error; });
  let url;
  for (let i = 0; i < 80 && !url; i++) {
    if (launchError) throw launchError;
    try { url = (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(item => item.type === 'page')?.webSocketDebuggerUrl; } catch {}
    if (!url) await sleep(250);
  }
  if (!url) { child.kill(); throw new Error('Headless Chromium debugger did not become available.'); }
  const ws = new WebSocket(url);
  await new Promise(resolve => ws.addEventListener('open', resolve, { once: true }));
  let seq = 0;
  const pending = new Map();
  const listeners = new Map();
  const state = { loads: 0, errors: [] };
  ws.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) { pending.get(message.id)(message); pending.delete(message.id); return; }
    for (const listener of listeners.get(message.method) || []) listener(message.params);
    if (message.method === 'Page.loadEventFired') state.loads++;
    if (message.method === 'Runtime.exceptionThrown') state.errors.push(message.params.exceptionDetails?.exception?.description || message.params.exceptionDetails?.text);
    if (message.method === 'Page.javascriptDialogOpening') send('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, message => message.error ? reject(new Error(`${method}: ${message.error.message}`)) : resolve(message.result));
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const evaluate = async expression => {
    const result = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description || result.exceptionDetails.text);
    return result.result.value;
  };
  const waitFor = async (expression, label, timeout = 20000) => {
    const until = Date.now() + timeout;
    while (Date.now() < until) { try { if (await evaluate(expression)) return; } catch {} await sleep(150); }
    throw new Error(`Timed out waiting for ${label}`);
  };
  const key = async (keyName, code) => {
    const keyCode = { ArrowDown: 40, ArrowUp: 38, Enter: 13, Escape: 27, Backspace: 8 }[keyName];
    await send('Input.dispatchKeyEvent', { type: 'rawKeyDown', key: keyName, code: code || keyName, windowsVirtualKeyCode: keyCode });
    await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: code || keyName, windowsVirtualKeyCode: keyCode });
  };
  const type = text => send('Input.insertText', { text });
  const close = () => { ws.close(); child.kill(); };
  return { send, evaluate, waitFor, key, type, close, state, debugPort, on(method, handler) { const list=listeners.get(method)||[]; list.push(handler); listeners.set(method,list); } };
}

