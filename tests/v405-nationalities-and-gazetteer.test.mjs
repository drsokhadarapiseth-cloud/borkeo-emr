import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createEmrServer } from '../server/server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('v40.5: nationality picker files are served to signed-in pages', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'emr-v405-'));
  const port = 34050;
  const app = createEmrServer({ demoMode: false, host: '127.0.0.1', port, appOrigin: `http://127.0.0.1:${port}`, databasePath: path.join(dir, 'emr.sqlite'), nodeEnv: 'test' });
  await new Promise((resolve) => app.server.listen(port, '127.0.0.1', resolve));
  try {
    for (const [file, type] of [['nationalities.js', 'javascript'], ['nationalities.css', 'css']]) {
      const response = await fetch(`http://127.0.0.1:${port}/public/${file}?v=3740`);
      assert.equal(response.status, 200, `${file} must be served`);
      assert.match(response.headers.get('content-type'), new RegExp(type));
      assert.equal(await response.text(), fs.readFileSync(path.join(root, 'public', file), 'utf8'));
    }
  } finally {
    await new Promise((resolve) => app.server.close(resolve));
    app.database.close();
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('v40.5: address data loads when the server is started from another folder', () => {
  const moduleUrl = new URL('../server/gazetteer.mjs', import.meta.url).href;
  const output = execFileSync(process.execPath, ['--input-type=module', '-e', `const g = await import(${JSON.stringify(moduleUrl)}); process.stdout.write(String(g.loadGazetteer().length));`], { cwd: os.tmpdir(), encoding: 'utf8' });
  assert.ok(Number(output.trim()) > 20, 'all Cambodian provinces load');
});
