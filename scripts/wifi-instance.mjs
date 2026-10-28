import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import {spawn} from 'node:child_process';

// Local launcher settings contain no credentials and are never copied from the
// hospital installation. An isolated copy must keep runtime data under itself.
export function configureWifiInstance(root, env = process.env) {
  const file = path.join(root, 'wifi-instance.local.json');
  let simulation = false;
  if (fs.existsSync(file)) {
    const settings = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (settings.kind !== 'simulation' || settings.port !== 3002 || settings.origin !== 'http://localhost:3002' || settings.dataDirectory !== 'instance-data') {
      throw Error('Invalid simulation launcher settings. Expected localhost:3002 and instance-data.');
    }
    const realRoot = fs.realpathSync(root);
    const directory = path.join(realRoot, 'instance-data');
    if (fs.existsSync(directory) && fs.realpathSync(directory) !== directory) throw Error('Simulation data must not be a link to another installation.');
    env.PORT = '3002'; env.APP_ORIGIN = settings.origin;
    env.DATA_DIR = directory; env.DATABASE_PATH = path.join(directory, 'emr.sqlite');
    env.NPCA_ENABLED = 'false'; env.NPCA_PRACTICE = 'false';
    simulation = true;
  }
  if (!simulation) {
    env.PORT = '3001';
    env.APP_ORIGIN = 'http://127.0.0.1:3001';
  }
  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid EMR port.');
  return { port, origin: env.APP_ORIGIN, simulation };
}

export async function isRunningEmr(origin) {
  try {
    const health = await fetch(origin + '/api/health', {signal:AbortSignal.timeout(2500),redirect:'error'});
    if (!health.ok || (await health.json()).ok !== true) return false;
    const login = await fetch(origin + '/login', {signal:AbortSignal.timeout(2500),redirect:'error'});
    return login.ok && (await login.text()).includes('data-app-version');
  } catch { return false; }
}

export async function openWifiBrowser(origin, spawnBrowser = spawn) {
  if (!['http://127.0.0.1:3001','http://localhost:3002'].includes(origin)) throw Error('Unexpected local EMR address.');
  const command = process.platform === 'win32' ? 'explorer.exe' : process.platform === 'darwin' ? 'open' : 'xdg-open';
  await new Promise((resolve,reject) => {
    const child = spawnBrowser(command, [origin], {detached:true,stdio:'ignore',windowsHide:true});
    child.once('error',reject);
    child.once('spawn',()=>{child.unref();resolve()});
  });
}

// Existing instances are verified before reuse; an unrelated listener is never
// opened or terminated. Return true only when a fresh server is needed.
export async function needsWifiServer(instance, {probe=checkWifiPort, ready=isRunningEmr, open=openWifiBrowser} = {}) {
  try { await probe(instance.port); return true; }
  catch (error) {
    if (error.code !== 'EADDRINUSE' || !await ready(instance.origin)) throw error;
    console.log(`EMR already running. Opening ${instance.origin}`);
    await open(instance.origin);
    return false;
  }
}

// Check before opening any database. Never terminate the current listener.
export async function checkWifiPort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '0.0.0.0', () => probe.close(resolve));
  });
}
