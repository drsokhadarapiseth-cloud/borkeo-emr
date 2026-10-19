import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';

const outputDir = path.resolve('docs/ui-screenshots');
fs.mkdirSync(outputDir, { recursive: true });

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

// We can authenticate by logging in and obtaining a cookie or running in demo mode
// Let's check if http://127.0.0.1:3000 is running
async function isServerRunning() {
  return new Promise((resolve) => {
    const req = http.get('http://127.0.0.1:3000/public/login.html', (res) => {
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function capture() {
  const running = await isServerRunning();
  console.log('Server running on 3000:', running);

  const viewports = [
    { name: '1440', width: 1440, height: 900 },
    { name: '1024', width: 1024, height: 768 },
    { name: '390', width: 390, height: 844 },
  ];

  // For public login page
  for (const vp of viewports) {
    const filename = path.join(outputDir, `before-login-${vp.name}px.png`);
    try {
      execFileSync(edgePath, [
        '--headless=new',
        '--disable-gpu',
        `--screenshot=${filename}`,
        `--window-size=${vp.width},${vp.height}`,
        'http://127.0.0.1:3000/login.html'
      ]);
      console.log(`Captured ${filename} (${fs.statSync(filename).size} bytes)`);
    } catch (e) {
      console.error(`Failed ${filename}:`, e.message);
    }
  }
}

capture();
