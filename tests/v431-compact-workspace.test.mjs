import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise real row generation with synthetic summaries: compacting the header
// must retain critical resuscitation and risk/early-warning information.
const source = fs.readFileSync('public/patient-banner.js', 'utf8');
const start = source.indexOf('  function clinicalRowHtml(info)');
const end = source.indexOf('\n  function toggleBannerDetails', start);
function row(summary, earlyWarning = null) {
  const context = vm.createContext({
    summaryFor: () => summary,
    riskFlags: value => value.flags || [],
    currentMedications: () => [],
    label: (_key, en) => en,
    plainLabel: (_key, en) => en,
    optionLabel: (_group, code) => code,
    escapeHtml: value => String(value).replaceAll('<', '&lt;'),
    earlyWarning,
    bannerDetailsOpen: false,
  });
  vm.runInContext(source.slice(start, end) + '\nthis.row = clinicalRowHtml({raw:{data:{}}});', context);
  return context.row;
}
test('compact patient header retains DNR, risks and early warning in dedicated visible classes', () => {
  const html = row({resuscitation:{status:'dnr'}, flags:['Severe allergy'], problems:[]}, {level:'high',text:'Urgent review'});
  assert.match(html, /is-dnr/);
  assert.match(html, /has-flags/);
  assert.match(html, /data-banner-ews/);
  assert.match(html, /Urgent review/);
  assert.match(html, /Severe allergy/);
  const normal = row({problems:[]});
  assert.doesNotMatch(normal, /is-dnr|has-flags|data-banner-ews/);
});
