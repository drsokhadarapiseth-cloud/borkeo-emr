import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';

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
  env.PORT ||= '3001';
  env.APP_ORIGIN ||= `http://127.0.0.1:${env.PORT}`;
  const port = Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw Error('Invalid EMR port.');
  return { port, origin: env.APP_ORIGIN, simulation };
}

// Check before opening any database. Never terminate the current listener.
export async function checkWifiPort(port) {
  await new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(port, '0.0.0.0', () => probe.close(resolve));
  });
}
