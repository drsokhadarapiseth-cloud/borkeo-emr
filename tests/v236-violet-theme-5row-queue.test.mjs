import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';


test('v23.6 queue-display.css implements rich Violet Theme and 5-row grid styling', () => {
  const css = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.css'), 'utf8');
  assert.ok(css.includes('#4C1D95'), 'uses deep violet header #4C1D95');
  assert.ok(css.includes('#F5F3FF'), 'uses soft violet background #F5F3FF');
  assert.ok(css.includes('#6D28D9'), 'uses rich active row highlight #6D28D9');
  assert.ok(css.includes('#EDE9FE'), 'uses soft violet badges #EDE9FE');
  assert.ok(css.includes('active-calling-row'), 'styles active calling row highlight');
  assert.ok(css.includes('grid-template-rows: repeat(5, 1fr)'), 'layouts 5 equal height rows');
});

test('v23.6 queue-display.html structures 5-row table and removes visible top banner', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/queue-display.html'), 'utf8');
  assert.ok(html.includes('tv-waiting-section'), 'has main waiting table section');
  assert.ok(html.includes('ទៅកាន់ / Counter'), 'has Counter column header');
  assert.match(html, /v=23[67]0/, 'uses cache buster v=2360/v=2370 for CSS/JS assets');
});

test('v23.6 queue-display.js renders 5 slots, active counter call, and leaves counter blank for waiting', () => {
  const js = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.js'), 'utf8');
  assert.ok(js.includes('maxRows = 5'), 'renders 5 rows');
  assert.ok(js.includes('active-calling-row'), 'highlights active calling patient');
  assert.ok(js.includes('tv-counter-blank'), 'leaves counter blank for waiting patients');
  assert.ok(js.includes('playWelcomeBell'), 'preserves gentle 3-note welcome bell');
});
