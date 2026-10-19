import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();
const read = (rel) => fs.readFileSync(path.join(rootDir, rel), 'utf8');

test('v33.2 release version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(['33.2.0', '33.3.0', '34.9.0', '35.0.0', '35.1.0', '35.2.0', '35.3.0', '35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0', '36.7.0'].includes(pkg.version));

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v(?:3[2-6]\.)/);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /Borkeo EMR v(?:3[2-6]\.)/);
});

test('v33.2 triage buttons renamed from ហៅ និងបំពេញទ្រីយ៉ា to បំពេញទ្រីយ៉ា', () => {
  const triageJs = read('public/triage.js');
  assert.doesNotMatch(triageJs, /ហៅ និងបំពេញទ្រីយ៉ា/, 'public/triage.js must not contain ហៅ និងបំពេញទ្រីយ៉ា');
  assert.match(triageJs, /បំពេញទ្រីយ៉ា/, 'public/triage.js must contain បំពេញទ្រីយ៉ា');
});

test('v33.2 HEF dialog uses portal-style banners, 3-column summary grid, member cards, and exact Khmer poverty statuses', () => {
  const hefJs = read('public/hef-lookup.js');
  const hefCss = read('public/hef-lookup.css');

  // Check Khmer poverty status mapping
  assert.match(hefJs, /ងាយរងហានិភ័យ/, 'Must map NEAR_POOR to ងាយរងហានិភ័យ');
  assert.match(hefJs, /ក្រកម្រិត១/, 'Must map POOR_1 to ក្រកម្រិត១');
  assert.match(hefJs, /ក្រកម្រិត២/, 'Must map POOR_2 to ក្រកម្រិត២');
  assert.match(hefJs, /មិនក្រីក្រ/, 'Must map NOT_POOR to មិនក្រីក្រ');

  // Check portal validation banner
  assert.match(hefJs, /ប័ណ្ណត្រឹមត្រូវ/, 'Must have valid banner text');
  assert.match(hefJs, /ប័ណ្ណមិនត្រឹមត្រូវ/, 'Must have invalid banner text');
  assert.match(hefJs, /hef-banner/, 'Must render banner class');
  assert.match(hefJs, /hef-summary-grid/, 'Must render summary grid class');
  assert.match(hefJs, /hef-member-card/, 'Must render member card class');

  // Verify povertyStatusLabel function in isolated context
  const startIdx = hefJs.indexOf('  function povertyStatusLabel(');
  const endIdx = hefJs.indexOf('  function fieldChanges(', startIdx);
  assert.ok(startIdx > -1 && endIdx > -1, 'povertyStatusLabel function found');

  const ctx = {
    txt: (kh, en) => kh
  };
  vm.runInNewContext(hefJs.slice(startIdx, endIdx) + '\nthis.povertyStatusLabel = povertyStatusLabel;', ctx);
  assert.equal(ctx.povertyStatusLabel('NEAR_POOR'), 'ងាយរងហានិភ័យ');
  assert.equal(ctx.povertyStatusLabel('POOR_1'), 'ក្រកម្រិត១');
  assert.equal(ctx.povertyStatusLabel('POOR_2'), 'ក្រកម្រិត២');
  assert.equal(ctx.povertyStatusLabel('NOT_POOR'), 'មិនក្រីក្រ');

  // English context
  const ctxEn = {
    txt: (kh, en) => en
  };
  vm.runInNewContext(hefJs.slice(startIdx, endIdx) + '\nthis.povertyStatusLabel = povertyStatusLabel;', ctxEn);
  assert.equal(ctxEn.povertyStatusLabel('NEAR_POOR'), 'Near-Poor');
  assert.equal(ctxEn.povertyStatusLabel('POOR_1'), 'Level 1 / Very Poor');

  // Check CSS styles
  assert.match(hefCss, /\.hef-banner/, 'CSS must style .hef-banner');
  assert.match(hefCss, /\.hef-banner-success/, 'CSS must style .hef-banner-success');
  assert.match(hefCss, /\.hef-banner-danger/, 'CSS must style .hef-banner-danger');
  assert.match(hefCss, /\.hef-summary-grid/, 'CSS must style .hef-summary-grid');
  assert.match(hefCss, /\.hef-member-card/, 'CSS must style .hef-member-card');
});

test('v33.2 registration occupation list includes common Cambodian jobs and ផ្សេងៗ with custom input preserving indexing', () => {
  const protectedEmr = read('protected/EMR.html');
  const legacyEmr = read('legacy-html/EMR.html');
  const recordJs = read('public/emr-patient-record.js');

  for (const [name, html] of [['protected/EMR.html', protectedEmr], ['legacy-html/EMR.html', legacyEmr]]) {
    assert.match(html, /<option value="កសិករ">កសិករ<\/option>/, `${name} must include កសិករ`);
    assert.match(html, /<option value="កម្មករ \/ កម្មការិនី">កម្មករ \/ កម្មការិនី<\/option>/, `${name} must include កម្មករ / កម្មការិនី`);
    assert.match(html, /<option value="មន្ត្រីរាជការ">មន្ត្រីរាជការ<\/option>/, `${name} must include មន្ត្រីរាជការ`);
    assert.match(html, /<option value="សិស្ស \/ និស្សិត">សិស្ស \/ និស្សិត<\/option>/, `${name} must include សិស្ស / និស្សិត`);
    assert.match(html, /<option value="ផ្សេងៗ">ផ្សេងៗ<\/option>/, `${name} must include ផ្សេងៗ`);
    assert.match(html, /id="reg_occupation_other(?:_legacy)?"[^>]*data-emr-no-auto-index/, `${name} custom occupation input must have data-emr-no-auto-index`);
  }

  // Check patient record save/load handling
  assert.match(recordJs, /reg_occupation_other/, 'public/emr-patient-record.js must reference reg_occupation_other');
  assert.match(recordJs, /syncOccupationField/, 'public/emr-patient-record.js must export syncOccupationField');
  assert.match(recordJs, /onOccupationOtherInput/, 'public/emr-patient-record.js must export onOccupationOtherInput');
});
