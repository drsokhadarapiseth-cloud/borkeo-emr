import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

test('v13.2 includes the responsive layout layer on all application pages', () => {
  const pages = [
    ...fs.readdirSync(path.join(root, 'protected')).filter((name) => name.endsWith('.html') && name !== 'print-preview.html').map((name) => `protected/${name}`),
    'public/login.html',
  ];
  for (const page of pages) {
    const expectedVersion = page === 'protected/EMR.html' ? 1504 : 1310;
    assert.match(read(page), new RegExp(`responsive-layout\\.css\\?v=${expectedVersion}`));
  }

  const css = read('public/responsive-layout.css');
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /@media screen and \(max-width: 720px\)/);
  assert.match(css, /\.page-a4, \.page-a4 \* \{ min-width: 0 !important; \}/);
  assert.match(css, /grid-template-columns: 1fr !important/);
});

test('v13.0 responsive layer preserves the public queue display structure while fitting small screens', () => {
  const queue = read('protected/queue-display.html');
  const css = read('public/responsive-layout.css');
  assert.match(queue, /<span>ល\.រ<\/span><span>ឈ្មោះ<\/span><span id="display-place-header">/);
  assert.match(css, /\.queue-table-wrap/);
  assert.match(css, /\.queue-tools input, \.queue-tools button/);
});
