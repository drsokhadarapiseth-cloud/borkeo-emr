import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const rootDir = process.cwd();
const read = f => fs.readFileSync(path.join(rootDir, f), 'utf8');


test('nationalities catalog script loads offline and exposes window.EMRNationalities', () => {
  const code = read('public/nationalities.js');
  const context = { window: {}, document: { addEventListener: () => {} } };
  vm.createContext(context);
  vm.runInContext(code, context);

  const nat = context.window.EMRNationalities;
  assert.ok(nat, 'window.EMRNationalities must be exposed');
  assert.ok(Array.isArray(nat.groups), 'nat.groups must be an array');
  assert.equal(nat.groups.length, 4, 'Must have 4 sections: cambodia, cambodian_ethnic, international, other');
});

test('Cambodian section has ខ្មែរ / Khmer first and removes exact option ទួន for new entries', () => {
  const code = read('public/nationalities.js');
  const context = { window: {}, document: { addEventListener: () => {} } };
  vm.createContext(context);
  vm.runInContext(code, context);

  const nat = context.window.EMRNationalities;
  const primaryGroup = nat.groups.find(g => g.id === 'cambodia');
  assert.ok(primaryGroup, 'Cambodia primary group must exist');
  assert.equal(primaryGroup.items[0].kh, 'ខ្មែរ');
  assert.equal(primaryGroup.items[0].en, 'Khmer');
  assert.equal(primaryGroup.items[0].value, 'ខ្មែរ');

  // Verify that "ទួន" is NOT present anywhere in choices for new entries
  const allChoices = nat.allEntries.map(e => e.value);
  assert.equal(allChoices.includes('ទួន'), false, 'Exact option ទួន must NOT be in choices for new entries');

  // Verify in protected/EMR.html
  const emrHtml = read('protected/EMR.html');
  assert.match(emrHtml, /<select class="modern-input" id="web_nat"/);
  assert.match(emrHtml, /<optgroup label="កម្ពុជា(?: \/ Cambodia)?">/);
  assert.match(emrHtml, /<option value="ខ្មែរ"[^>]*selected>ខ្មែរ(?: \/ Khmer)?<\/option>/);
  // Ensure "ទួន" is not in the options
  const selectSnippet = emrHtml.slice(emrHtml.indexOf('id="web_nat"'), emrHtml.indexOf('id="web_nat"') + 20000);
  assert.doesNotMatch(selectSnippet, /<option value="ទួន">/);
});

test('Cambodian ethnic section includes ចាម and all 24 CIPO indigenous groups with Pnong as display label', () => {
  const code = read('public/nationalities.js');
  const context = { window: {}, document: { addEventListener: () => {} } };
  vm.createContext(context);
  vm.runInContext(code, context);

  const nat = context.window.EMRNationalities;
  const ethnicGroup = nat.groups.find(g => g.id === 'cambodian_ethnic');
  assert.ok(ethnicGroup, 'Cambodian ethnic group must exist');

  const namesKh = ethnicGroup.items.map(i => i.kh);
  const requiredGroups = [
    'ចាម', 'ព្នង', 'ទំពួន', 'កួយ', 'ចារ៉ាយ', 'គ្រឹង', 'ព្រៅ', 'កាវ៉ែត',
    'ស្ទៀង', 'ក្រោល', 'មិល', 'កាចក់', 'ព័រ', 'ខោញ', 'ជង', 'សួយ',
    'ថ្មូន', 'លុន', 'ស្អូច', 'រដែ', 'ខិ', 'រអង', 'ស្ពុង', 'ល្អឺន', 'សំរែ'
  ];

  requiredGroups.forEach(g => {
    assert.ok(namesKh.includes(g), `Group ${g} must be present in Cambodian ethnic section`);
  });

  // Verify "ព្នង / Pnong" display label and aliases
  const pnong = ethnicGroup.items.find(i => i.kh === 'ព្នង');
  assert.ok(pnong, 'ព្នង must exist');
  assert.equal(pnong.en, 'Pnong');
  assert.equal(pnong.value, 'ព្នង');
  assert.ok(pnong.aliases.includes('ពូនង'), 'ពូនង must be a search alias for Pnong');
  assert.ok(pnong.aliases.includes('Bunong'), 'Bunong must be a search alias for Pnong');

  // Verify findEntry alias resolution
  const byBunong = nat.findEntry('Bunong');
  assert.ok(byBunong && byBunong.kh === 'ព្នង', 'Searching Bunong must resolve to Pnong entry');

  const byPoonong = nat.findEntry('ពូនង');
  assert.ok(byPoonong && byPoonong.kh === 'ព្នង', 'Searching ពូនង must resolve to Pnong entry');

  // Verify "ចារ៉ាយ / Jarai" display label and "ចារាយ" alias
  const jarai = ethnicGroup.items.find(i => i.kh === 'ចារ៉ាយ');
  assert.ok(jarai, 'ចារ៉ាយ must exist');
  assert.equal(jarai.en, 'Jarai');
  assert.ok(jarai.aliases.includes('ចារាយ'), 'ចារាយ must be an alias for ចារ៉ាយ');

  const byOldJarai = nat.findEntry('ចារាយ');
  assert.ok(byOldJarai && byOldJarai.kh === 'ចារ៉ាយ', 'Old spelling ចារាយ must resolve to ចារ៉ាយ entry');
});

test('International section is sorted A-Z by English name, excludes Cambodia, and contains complete A-Z catalog', () => {
  const code = read('public/nationalities.js');
  const context = { window: {}, document: { addEventListener: () => {} } };
  vm.createContext(context);
  vm.runInContext(code, context);

  const nat = context.window.EMRNationalities;
  const intlGroup = nat.groups.find(g => g.id === 'international');
  assert.ok(intlGroup, 'International group must exist');
  assert.ok(intlGroup.items.length >= 190, 'Must have at least 190 countries');

  // Check Cambodia is not present in international group
  assert.equal(
    intlGroup.items.some(i => i.en.toLowerCase().includes('cambodia') || i.kh.includes('កម្ពុជា')),
    false,
    'Cambodia must NOT be duplicated in international group'
  );

  // Check sorted A-Z by English name
  for (let i = 0; i < intlGroup.items.length - 1; i++) {
    const cur = intlGroup.items[i].en;
    const next = intlGroup.items[i + 1].en;
    assert.ok(
      cur.localeCompare(next) <= 0,
      `International catalog must be sorted A-Z: "${cur}" should precede "${next}"`
    );
  }

  // Check end options
  const otherGroup = nat.groups.find(g => g.id === 'other');
  assert.ok(otherGroup, 'Other group must exist');
  const endValues = otherGroup.items.map(i => i.kh);
  assert.ok(endValues.includes('ផ្សេងៗ'), 'ផ្សេងៗ / Other must be at the end');
  assert.ok(endValues.includes('មិនបានបញ្ជាក់'), 'មិនបានបញ្ជាក់ / Not specified must be at the end');
});

test('Historical records with removed or renamed values are preserved safely', () => {
  const code = read('public/nationalities.js');
  const context = { window: {}, document: { addEventListener: () => {} } };
  vm.createContext(context);
  vm.runInContext(code, context);

  const nat = context.window.EMRNationalities;

  // Format label tests (defaults to Khmer in v35.0)
  assert.equal(nat.formatLabel('ខ្មែរ'), 'ខ្មែរ');
  assert.equal(nat.formatLabel('ព្នង'), 'ព្នង');
  assert.equal(nat.formatLabel('ពូនង'), 'ព្នង');
  assert.equal(nat.formatLabel('ចារាយ'), 'ចារ៉ាយ');
  assert.equal(nat.formatLabel('ចារ៉ាយ'), 'ចារ៉ាយ');
  assert.equal(nat.formatLabel('ទួន'), 'ទួន', 'Historical value ទួន must be preserved as-is');
  assert.equal(nat.formatLabel('បារាំង / France'), 'បារាំង');
  assert.equal(nat.formatLabel('France'), 'បារាំង');
  assert.equal(nat.formatLabel('បារាំង'), 'បារាំង');

  // English format label
  assert.equal(nat.formatLabel('ខ្មែរ', 'en'), 'Khmer');
  assert.equal(nat.formatLabel('ព្នង', 'en'), 'Pnong');
  assert.equal(nat.formatLabel('France', 'en'), 'France');

  // Explicit bilingual format label
  assert.equal(nat.formatLabel('ខ្មែរ', 'bilingual'), 'ខ្មែរ / Khmer');
  assert.equal(nat.formatLabel('ព្នង', 'bilingual'), 'ព្នង / Pnong');

  // Test patient record identity restoration logic
  const patientRecordJs = read('public/emr-patient-record.js');
  assert.match(patientRecordJs, /window\.EMRNationalities\?\.findEntry\(stored\)/);
});

test('Search inputs in nationalities component have data-emr-transient to preserve storage indexing', () => {
  const natJs = read('public/nationalities.js');
  assert.match(natJs, /setAttribute\(['"]data-emr-transient['"],\s*['"]['"]\)/);
  assert.match(natJs, /setAttribute\(['"]data-emr-no-auto-index['"],\s*['"]['"]\)/);

  // Verify requests.js formats nationality using EMRNationalities
  const requestsJs = read('public/requests.js');
  assert.match(requestsJs, /window\.EMRNationalities\?\.formatLabel/);
});
