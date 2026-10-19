import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

test('v22.8 queue display completely suppresses language switcher and stray headers', () => {
  const langJs = fs.readFileSync(path.join(process.cwd(), 'public/emr-language.js'), 'utf8');
  assert.ok(langJs.includes('englishDisabled') || langJs.includes('tv-queue-shell') || langJs.includes('queue-display'), 'emr-language.js suppresses switcher on queue display');

  const css = fs.readFileSync(path.join(process.cwd(), 'public/queue-display.css'), 'utf8');
  assert.ok(css.includes('.emr-language-switch'), 'queue-display.css hides emr-language-switch');
  assert.ok(css.includes('.tv-hidden-compat'), 'queue-display.css hides tv-hidden-compat');

  const html = fs.readFileSync(path.join(process.cwd(), 'protected/queue-display.html'), 'utf8');
  assert.ok(html.includes('tv-hidden-compat'), 'queue-display.html marks compatibility tags as tv-hidden-compat');
});

