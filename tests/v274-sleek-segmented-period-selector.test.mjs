import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';


test('v27.4 protected/finance.html provides clean segmented pill tabs without cluttered multi-row dropdowns', () => {
  const html = fs.readFileSync(new URL('../protected/finance.html', import.meta.url), 'utf8');

  // Must have segmented pill navigation
  assert.match(html, /class="period-pills-nav"/);
  assert.match(html, /class="period-pill active" data-period="month"/);
  assert.match(html, /data-period="trimester"/);
  assert.match(html, /data-period="semester"/);
  assert.match(html, /data-period="year"/);
  assert.match(html, /data-period="custom"/);

  // Must have dedicated clean input area
  assert.match(html, /class="period-inputs-area"/);
  assert.match(html, /id="controls-month"/);
  assert.match(html, /id="controls-trimester"/);
  assert.match(html, /id="controls-semester"/);
  assert.match(html, /id="controls-year"/);
  assert.match(html, /id="controls-custom"/);
});

test('v27.4 public/finance.css contains strict hidden rule preventing multi-control overlapping', () => {
  const css = fs.readFileSync(new URL('../public/finance.css', import.meta.url), 'utf8');

  // Must have display: none !important rule for hidden period groups
  assert.match(css, /\.period-controls-group\[hidden\]\{display:none!important\}/);
  assert.match(css, /\.period-pills-nav/);
  assert.match(css, /\.period-pill\.active/);
});

test('v27.4 public/finance.js activates pill tabs and toggles single active control group', () => {
  const js = fs.readFileSync(new URL('../public/finance.js', import.meta.url), 'utf8');

  assert.match(js, /\.period-pill\.active/);
  assert.match(js, /querySelectorAll\('\.period-pill'\)/);
  assert.match(js, /grp\.hidden = \(type !== m\)/);
});
