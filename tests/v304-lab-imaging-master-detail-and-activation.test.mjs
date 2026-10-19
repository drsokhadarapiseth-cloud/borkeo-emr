import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');


test('v30.4 lab materials toolbar is strictly isolated from imaging films toolbar', () => {
  const stockHtml = fs.readFileSync(path.join(rootDir, 'protected', 'stock.html'), 'utf8');
  assert.match(stockHtml, /class="lab-toolbar workspace-toolbar material-field"/);
  assert.match(stockHtml, /class="imaging-toolbar workspace-toolbar film-field"/);
  assert.match(stockHtml, /\.imaging-toolbar\{display:none!important\}/);

  const workspaceCss = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic-workspace.css'), 'utf8');
  assert.match(workspaceCss, /\.workspace-toolbar\[hidden\]/);
  assert.match(workspaceCss, /\.film-field\[hidden\]/);
  assert.match(workspaceCss, /display:\s*none\s*!important/);

  const imagingCss = fs.readFileSync(path.join(rootDir, 'public', 'imaging.css'), 'utf8');
  assert.match(imagingCss, /\.imaging-toolbar\[hidden\]/);

  const stockJs = fs.readFileSync(path.join(rootDir, 'public', 'stock.js'), 'utf8');
  assert.match(stockJs, /x\.style\.display = 'none'/);
  assert.match(stockJs, /x\.remove\(\)/);
});

test('v30.4 imaging catalog schema, seeding, and activation toggling', async () => {
  const { openDatabase } = await import('../server/database.mjs');
  const { ensureParaclinicSchema, imagingCatalog, updateImagingModality } = await import('../server/paraclinic.mjs');
  
  const testDbPath = path.join(rootDir, 'data', `test-imaging-catalog-${Date.now()}.sqlite`);
  const db = openDatabase(testDbPath);
  try {
    ensureParaclinicSchema(db);
    
    // Check initial seeding
    const all = imagingCatalog(db, true);
    assert.ok(all.length >= 13, 'At least 13 standard modalities seeded');
    assert.ok(all.some(m => m.code === 'ULTRASOUND' && m.active === true));
    assert.ok(all.some(m => m.code === 'MRI' && m.active === true));

    // Deactivate MRI
    const updated = updateImagingModality(db, 'MRI', { active: false });
    assert.strictEqual(updated.active, false);

    // Active-only list should exclude MRI
    const activeOnly = imagingCatalog(db, false);
    assert.ok(!activeOnly.some(m => m.code === 'MRI'), 'Inactive MRI excluded from active-only list');
    assert.ok(activeOnly.some(m => m.code === 'ULTRASOUND'), 'Active Ultrasound remains');

    // Reactivate MRI
    updateImagingModality(db, 'MRI', { active: true });
    const reactivated = imagingCatalog(db, false);
    assert.ok(reactivated.some(m => m.code === 'MRI'), 'Reactivated MRI appears again');
  } finally {
    db.close();
    try { fs.unlinkSync(testDbPath); } catch {}
  }
});

test('v30.4 lab catalog activation permission for LAB role and active filtering', () => {
  const serverCode = fs.readFileSync(path.join(rootDir, 'server', 'server.mjs'), 'utf8');
  // LAB role allowed set must contain 'active'
  assert.match(serverCode, /sessionRole\(session\)==='LAB'[\s\S]*?'active'/);
  assert.match(serverCode, /\/api\/imaging-catalog/);

  const labJs = fs.readFileSync(path.join(rootDir, 'public', 'lab.js'), 'utf8');
  assert.match(labJs, /form\.elements\[key\]\.disabled = true/);
  assert.doesNotMatch(labJs, /'active'\]\.disabled = true/);
});

test('v30.4 master-detail 2-column layout in public/paraclinic.js for both lab and imaging', () => {
  const paraclinicJs = fs.readFileSync(path.join(rootDir, 'public', 'paraclinic.js'), 'utf8');
  
  // Laboratory order master-detail layout
  assert.match(paraclinicJs, /master-detail-order-layout/);
  assert.match(paraclinicJs, /data-cat-select/);
  assert.match(paraclinicJs, /data-active-category-title/);
  assert.match(paraclinicJs, /rawTests\.filter\(test => test\.active !== false\)/);

  // Imaging request master-detail layout
  assert.match(paraclinicJs, /data-img-group/);
  assert.match(paraclinicJs, /data-active-imaging-title/);
  assert.match(paraclinicJs, /imaging-modality-card/);
  assert.match(paraclinicJs, /\/api\/imaging-catalog/);
});

test('v30.4 thirty patients in demo.sqlite preserve demographic and photo integrity', async () => {
  const { openDatabase } = await import('../server/database.mjs');
  const db = openDatabase(path.join(rootDir, 'data', 'demo.sqlite'));
  try {
    const rows = db.sqlite.prepare("SELECT patient_key, full_name, sex, age, record_json FROM patient_records WHERE patient_key LIKE 'case:BK-%'").all();
    assert.strictEqual(rows.length, 30);
    for (const row of rows) {
      assert.ok(row.full_name && row.full_name.trim().length > 0);
      assert.ok(row.sex === 'ប្រុស' || row.sex === 'ស្រី');
      assert.ok(Number(row.age) > 0);
      const rec = JSON.parse(row.record_json);
      const photo = rec.photo || rec['scope:registration:id:web_patient_photo'] || rec['system:patientPhoto'];
      assert.ok(photo && photo.startsWith('data:image/jpeg;base64,'));
    }
  } finally {
    db.close();
  }
});
