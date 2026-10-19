import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';
import { createEmrServer } from '../server/server.mjs';
import zlib from 'node:zlib';

const ROOT = path.resolve('.');

test('v36.0 - Version metadata consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  assert.ok(['36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0', '36.7.0'].includes(pkg.version));

  const loginHtml = fs.readFileSync(path.join(ROOT, 'public', 'login.html'), 'utf8');
  assert.match(loginHtml, /v36\.[0-9]/);

  const serverMjs = fs.readFileSync(path.join(ROOT, 'server', 'server.mjs'), 'utf8');
  assert.match(serverMjs, /Borkeo EMR v36\.[0-9]/);
});

test('v36.0 - SQLite database initializes with high-performance PRAGMAs (WAL, NORMAL synchronous, memory temp_store, 32MB cache)', () => {
  const db = openDatabase(':memory:');
  try {
    const syncMode = db.sqlite.prepare('PRAGMA synchronous').get();
    // 1 represents NORMAL in SQLite
    assert.equal(syncMode.synchronous, 1);

    const tempStore = db.sqlite.prepare('PRAGMA temp_store').get();
    // 2 represents MEMORY in SQLite
    assert.equal(tempStore.temp_store, 2);

    const cacheSize = db.sqlite.prepare('PRAGMA cache_size').get();
    assert.equal(cacheSize.cache_size, -32000);

    const journalMode = db.sqlite.prepare('PRAGMA journal_mode').get();
    // In-memory or WAL mode
    assert.ok(['wal', 'memory'].includes(journalMode.journal_mode));
  } finally {
    db.close();
  }
});

test('v36.0 - HTTP Gzip compression, ETag conditional 304, and static asset caching', async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', port: 0 });
  await new Promise((resolve, reject) => {
    app.server.once('error', reject);
    app.server.listen(0, '127.0.0.1', resolve);
  });

  const port = app.server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    // 1. Request with Accept-Encoding: gzip receives Content-Encoding: gzip and ETag
    const gzipRes = await fetch(`${baseUrl}/login`, {
      headers: { 'accept-encoding': 'gzip' }
    });
    assert.equal(gzipRes.status, 200);
    assert.equal(gzipRes.headers.get('content-encoding'), 'gzip');
    assert.ok(gzipRes.headers.get('vary')?.includes('Accept-Encoding'));
    const etag = gzipRes.headers.get('etag');
    assert.ok(etag, 'Response should include ETag');

    const text = await gzipRes.text();
    assert.ok(text.includes('login-form'));
    assert.match(text, /v36\.[0-9]/);

    // 2. Request with If-None-Match matching ETag returns 304 Not Modified
    const conditionalRes = await fetch(`${baseUrl}/login`, {
      headers: {
        'if-none-match': etag,
        'accept-encoding': 'gzip'
      }
    });
    assert.equal(conditionalRes.status, 304);

    // 3. Request without gzip Accept-Encoding receives plain response without content-encoding
    const plainRes = await fetch(`${baseUrl}/login`, {
      headers: { 'accept-encoding': 'identity' }
    });
    assert.equal(plainRes.status, 200);
    assert.equal(plainRes.headers.get('content-encoding'), null);

    // 4. Static assets with version query (?v=) receive public cache header
    const assetRes = await fetch(`${baseUrl}/public/login.css?v=1970&build=36.0`);
    assert.equal(assetRes.status, 200);
    const cacheControl = assetRes.headers.get('cache-control') || '';
    assert.ok(cacheControl.includes('public, max-age='), 'Versioned static asset should be publicly cacheable');
    assert.ok(assetRes.headers.has('etag'), 'Static asset should have ETag');

    // 5. Test font asset has cache header
    const fontRes = await fetch(`${baseUrl}/public/fonts/Battambang-Regular.ttf`);
    assert.equal(fontRes.status, 200);
    assert.ok(fontRes.headers.get('cache-control')?.includes('public, max-age=86400'));
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
