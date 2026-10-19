import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();
const read = file => fs.readFileSync(path.join(rootDir, file), 'utf8');

test('v35.4 version consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.ok(['35.4.0', '35.5.0', '35.6.0', '35.7.0', '35.8.0', '35.9.0', '36.0.0', '36.1.0', '36.2.0', '36.3.0', '36.4.0', '36.5.0', '36.6.0'].includes(pkg.version));

  const loginHtml = read('public/login.html');
  assert.match(loginHtml, /v3[56]\.[0-9]/);

  const serverMjs = read('server/server.mjs');
  assert.match(serverMjs, /Borkeo EMR v3[56]\.[0-9]/);
});

test('ward-services.js removes ambulance transfer section and event listeners', () => {
  const code = read('public/ward-services.js');

  // Ambulance transfer controls must NOT exist
  assert.ok(!code.includes('data-transfer-direction'), 'Should not contain data-transfer-direction');
  assert.ok(!code.includes('data-transfer-distance'), 'Should not contain data-transfer-distance');
  assert.ok(!code.includes('data-transfer-qty'), 'Should not contain data-transfer-qty');
  assert.ok(!code.includes('data-add-transfer'), 'Should not contain data-add-transfer');
  assert.ok(!code.includes('data-transfer-status'), 'Should not contain data-transfer-status');
  assert.ok(!code.includes('distanceCodes'), 'Should not contain distanceCodes');
  assert.ok(!code.includes('renderTransferDistances'), 'Should not contain renderTransferDistances');
  assert.ok(!code.includes('updateTransfer'), 'Should not contain updateTransfer');
});

test('ward-services.js contains all required Khmer translations on Nursing Care page', () => {
  const code = read('public/ward-services.js');

  // Headers and general text
  assert.ok(code.includes('<h2>ការថែទាំក្នុងវួដ និងការបង់ប្រាក់</h2>'), 'Khmer panel title');
  assert.ok(code.includes('ថ្លៃសេវាថែទាំក្នុងវួដ និងការសម្របសម្រួល Paraclinic សម្រាប់វិក្កយបត្រ IPD បច្ចុប្បន្ន'), 'Khmer subtitle');
  assert.ok(code.includes('<h3>ថ្លៃសេវាថែទាំក្នុងវួដ</h3>'), 'Khmer ward fee header');
  assert.ok(code.includes('ជ្រើសរើសសេវា…'), 'Khmer service dropdown default');
  assert.ok(code.includes('ជ្រើសប្រភេទបង់ប្រាក់ និងសេវា'), 'Khmer payment category button');
  assert.ok(code.includes('ថ្លៃសេវាសកម្មផ្សេងៗទាំងអស់'), 'Khmer all other services optgroup');

  // Charges list & Cashier handoff
  assert.ok(code.includes('<h3>ថ្លៃសេវាលើវិក្កយបត្របច្ចុប្បន្ន</h3>'), 'Khmer current charges heading');
  assert.ok(code.includes('មិនមានការគិតថ្លៃលើវិក្កយបត្របច្ចុប្បន្នទេ។'), 'Khmer empty charges message');
  assert.ok(code.includes('លុបថ្លៃសេវា'), 'Khmer remove charge button');
  assert.ok(code.includes('បញ្ជូនវិក្កយបត្រទៅបេឡា'), 'Khmer send to cashier button');
  assert.ok(code.includes('បានបញ្ជូនទៅបេឡា'), 'Khmer sent to cashier state');
  assert.ok(code.includes('បេឡាមានវិក្កយបត្រនេះក្នុងជួររង់ចាំទូទាត់ប្រាក់។'), 'Khmer queue status');
  assert.ok(code.includes('គ្មានសមតុល្យត្រូវទូទាត់សម្រាប់បញ្ជូនទេ។'), 'Khmer no balance status');

  // Paraclinic workflow & orders
  assert.ok(code.includes('<h3>ការបញ្ជាតេស្តមន្ទីរពិសោធន៍ និងរូបភាពវេជ្ជសាស្ត្រ</h3>'), 'Khmer paraclinic heading');
  assert.ok(code.includes('សូមបើកអ្នកជំងឺសម្រាកព្យាបាល (IPD) ដើម្បីមើលការបញ្ជា។'), 'Khmer empty patient prompt');
  assert.ok(code.includes('មិនមានការបញ្ជាតេស្តមន្ទីរពិសោធន៍ ឬរូបភាពវេជ្ជសាស្ត្រសម្រាប់អ្នកជំងឺនេះទេ។'), 'Khmer no orders message');
  assert.ok(code.includes('ទទួលការបញ្ជា'), 'Khmer receive order action');
  assert.ok(code.includes('បានយកសំណាក'), 'Khmer specimen collected action');
  assert.ok(code.includes('បញ្ជូនសំណាកទៅមន្ទីរពិសោធន៍'), 'Khmer send to lab action');
  assert.ok(code.includes('យកសំណាកជំនួសឡើងវិញ'), 'Khmer replacement specimen action');
  assert.ok(code.includes('អ្នកជំងឺត្រូវបានបញ្ជូនទៅថតរូបភាពវេជ្ជសាស្ត្រ'), 'Khmer patient sent to imaging');
  assert.ok(code.includes('ផ្នែកបានទទួលការបញ្ជារួច'), 'Khmer ward received order stage');
  assert.ok(code.includes('រង់ចាំផ្នែកទទួលការបញ្ជា'), 'Khmer waiting for ward stage');
  assert.ok(code.includes('ការបញ្ជារបស់វេជ្ជបណ្ឌិត · ឥតគិតថ្លៃ · '), 'Khmer doctor order free badge');

  // Paraclinic fees & waivers
  assert.ok(code.includes('អ្នកជំងឺយល់ព្រមបង់ប្រាក់'), 'Khmer patient agrees to pay button');
  assert.ok(code.includes('ស្នើសុំការលើកលែងថ្លៃសេវា'), 'Khmer request fee waiver button');
  assert.ok(code.includes("'បានបង់ប្រាក់'"), 'Khmer paid state');
  assert.ok(code.includes("'ឥតគិតថ្លៃ (បានអនុម័ត)'"), 'Khmer approved waiver state');
  assert.ok(code.includes("'មិនគិតថ្លៃ'"), 'Khmer free state');
  assert.ok(code.includes("'រង់ចាំការអនុម័តពី Admin/ប្រធាន'"), 'Khmer pending approval state');
  assert.ok(code.includes("'ការស្នើសុំមិនត្រូវបានអនុម័ត · ត្រូវបង់ប្រាក់'"), 'Khmer waiver rejected state');
  assert.ok(code.includes("'បានជូនដំណឹងអ្នកជំងឺ · ត្រូវបង់ប្រាក់'"), 'Khmer informed state');
  assert.ok(code.includes("'មិនទាន់បង់ប្រាក់'"), 'Khmer not yet paid state');
});

test('clinical-fees.css styles ward-paraclinic-workflow cleanly at top of column', () => {
  const css = read('public/clinical-fees.css');
  assert.match(css, /\.ward-paraclinic-workflow\{margin-top:0;padding-top:0;border-top:none\}/);
});
