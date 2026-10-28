// Starts Borkeo EMR for phones and tablets on the same Wi-Fi network over
// plain http. Passwords are still required (this is not the username-only
// demo); only the network address changes from this computer to the LAN.
// Usage: npm run start:wifi
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadConfig} from '../server/config.mjs';
import {configureWifiInstance,checkWifiPort} from './wifi-instance.mjs';
// Load this installation's .env before filling launcher defaults. No database is
// opened here. Isolated launcher settings override inherited database paths.
loadConfig();
const instance = configureWifiInstance(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
const emrMode = String(process.env.EMR_MODE || '').toLowerCase();
if (emrMode === 'production' || process.env.NODE_ENV === 'production') {
  console.error('Wi-Fi mode uses plain http, and production mode requires secure (https) cookies,');
  console.error('so phones could not stay signed in. Start without NODE_ENV=production / EMR_MODE=production.');
  process.exit(1);
}
if (emrMode === 'demo') {
  console.error('Wi-Fi mode is for the real, password-protected EMR. Remove EMR_MODE=demo.');
  process.exit(1);
}

process.env.HOST = '0.0.0.0';
try { await checkWifiPort(instance.port); }
catch (error) {
  if (error.code === 'EADDRINUSE') console.error(`Port ${instance.port} is already in use. No process was stopped. Use the existing EMR window or close that instance before restarting. Link: ${instance.origin}`);
  else console.error(error.message);
  process.exit(1);
}
const { startServer } = await import('../server/server.mjs');
const application = await startServer();
const port = application.config.port;

console.log('');
console.log(`This computer: ${instance.origin}${instance.simulation ? ' (separate simulation data)' : ''}`);
console.log('Phones and tablets: connect to the same Wi-Fi, then open one of the');
console.log('"Mobile / Phone access" addresses above in the browser.');
console.log('If the phone cannot connect, allow the port once in Windows Firewall');
console.log('(Administrator PowerShell):');
console.log(`  netsh advfirewall firewall add rule name="Borkeo EMR ${port}" dir=in action=allow protocol=TCP localport=${port} profile=private`);
console.log('Traffic on the Wi-Fi is not encrypted; use only a trusted hospital network.');
