import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v26.9 pharmacy toolbar includes បើកផ្ទាំងលេខរៀង button and styles it', () => {
  const pharmacyOpdHtml = fs.readFileSync(new URL('../protected/pharmacy-opd.html', import.meta.url), 'utf8');
  const pharmacyOpdCss = fs.readFileSync(new URL('../public/pharmacy-opd.css', import.meta.url), 'utf8');

  // Toolbar contains the queue button
  assert.match(pharmacyOpdHtml, /class="pharmacy-toolbar"[^>]*>[\s\S]*?<a class="tv-display-tab" href="\/pharmacy\/display" target="_blank">បើកផ្ទាំងលេខរៀង<\/a>/);
  // CSS styles .pharmacy-toolbar .tv-display-tab
  assert.match(pharmacyOpdCss, /\.pharmacy-toolbar \.tv-display-tab/);
});

test('v26.9 pharmacy display screen shows both OPD and IPD discharge patients and uses updated title', () => {
  const displayHtml = fs.readFileSync(new URL('../protected/pharmacy-display.html', import.meta.url), 'utf8');
  const displayJs = fs.readFileSync(new URL('../public/pharmacy-display.js', import.meta.url), 'utf8');
  const langJs = fs.readFileSync(new URL('../public/emr-language.js', import.meta.url), 'utf8');

  // Title and header updated from ពិនិត្យលេខរៀង to ផ្ទាំងលេខរៀង · ឱសថស្ថាន
  assert.match(displayHtml, /<title>ផ្ទាំងលេខរៀង · ឱសថស្ថាន<\/title>/);
  assert.match(displayHtml, /<h1>ផ្ទាំងលេខរៀង · ឱសថស្ថាន<\/h1>/);
  assert.doesNotMatch(displayHtml, /ពិនិត្យលេខរៀង/);

  // Contains both columns
  assert.match(displayHtml, /id="opd-dispensing-rows"/);
  assert.match(displayHtml, /id="ipd-dispensing-rows"/);
  assert.match(displayHtml, /<h2 id="opd-title">OPD<\/h2>/);
  assert.match(displayHtml, /<h2 id="ipd-title">អ្នកជំងឺ IPD បានចេញពីពេទ្យ<\/h2>/);

  // Script renders queue number for both OPD and IPD
  assert.match(displayJs, /item\.registrationQueueNumber/);

  // Translation exists
  assert.match(langJs, /\['ផ្ទាំងលេខរៀង · ឱសថស្ថាន', 'Queue Display · Pharmacy'\]/);
});
