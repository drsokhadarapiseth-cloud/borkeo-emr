import assert from 'node:assert/strict';
import test from 'node:test';
import { createEmrServer } from '../server/server.mjs';

test('invoice print stylesheet, Khmer font and hospital logo are served as assets', async () => {
  const app = createEmrServer({ demoMode: false, databasePath: ':memory:', host: '127.0.0.1' });
  try {
    await new Promise(resolve => app.server.listen(0, '127.0.0.1', resolve));
    const origin = `http://127.0.0.1:${app.server.address().port}`;
    for (const [asset, contentType] of [
      ['/public/receipt.css?v=1041', 'text/css'],
      ['/public/fonts/Battambang-Regular.ttf', 'font/ttf'],
      ['/public/logo-hospital.jpg?v=1041', 'image/jpeg'],
    ]) {
      const response = await fetch(origin + asset, { redirect: 'manual' });
      assert.equal(response.status, 200, asset);
      assert.ok(response.headers.get('content-type').startsWith(contentType), asset);
      const bytes = new Uint8Array(await response.arrayBuffer());
      assert.ok(bytes.length > 100, asset);
      if (contentType === 'text/css') assert.match(new TextDecoder().decode(bytes), /@media print/);
      if (contentType === 'font/ttf') assert.deepEqual([...bytes.slice(0, 4)], [0, 1, 0, 0]);
      if (contentType === 'image/jpeg') assert.deepEqual([...bytes.slice(0, 3)], [255, 216, 255]);
    }
  } finally {
    await new Promise(resolve => app.server.close(resolve));
    app.database.close();
  }
});
