import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';
import { ensureStockSchema, addStockItem, listStock, receiveStock, manualFilmUsage, stockHistory } from '../server/stock.mjs';

function createTestDb() {
  return openDatabase(':memory:');
}

test('v21.7 imaging film stock schema supports X-Ray, CT, MRI, and Ultrasound film and consumable cataloging', () => {
  const db = createTestDb();
  try {
    ensureStockSchema(db);

    // 1. Add X-Ray Dry Film
    const xrayId = addStockItem(db, 'film', {
      refCode: 'REF-XR-1417',
      cmsCode: 'CMS-IMG-XR1',
      name: 'X-Ray Dry Imaging Film',
      category: 'X-RAY',
      strength: '14x17 inch',
      lotNo: 'LOT-XR-2026A',
      expiryDate: '2028-06-30',
      unit: 'សន្លឹក',
      quantity: 500,
      perTest: 1
    }, 'radiographer_1');

    // 2. Add CT Laser Film
    const ctId = addStockItem(db, 'film', {
      refCode: 'REF-CT-1417',
      cmsCode: 'CMS-IMG-CT1',
      name: 'CT Laser Imaging Film',
      category: 'CT',
      strength: '14x17 inch',
      lotNo: 'LOT-CT-2026B',
      expiryDate: '2028-12-31',
      unit: 'សន្លឹក',
      quantity: 300,
      perTest: 2
    }, 'radiographer_1');

    // 3. Add MRI Film
    const mriId = addStockItem(db, 'film', {
      refCode: 'REF-MRI-1417',
      cmsCode: 'CMS-IMG-MRI1',
      name: 'MRI High Resolution Film',
      category: 'MRI',
      strength: '14x17 inch',
      lotNo: 'LOT-MRI-2026C',
      expiryDate: '2029-03-31',
      unit: 'សន្លឹក',
      quantity: 200,
      perTest: 2
    }, 'radiographer_1');

    // 4. Add Ultrasound Thermal Paper
    const usId = addStockItem(db, 'film', {
      refCode: 'REF-US-110HD',
      cmsCode: 'CMS-IMG-US1',
      name: 'Ultrasound High Density Thermal Paper',
      category: 'ULTRASOUND',
      strength: '110mm x 18m Roll',
      lotNo: 'LOT-US-2026D',
      expiryDate: '2029-12-31',
      unit: 'roll',
      quantity: 50,
      perTest: 0.1
    }, 'radiographer_1');

    assert.ok(xrayId && ctId && mriId && usId, 'All film items created successfully');
    const films = listStock(db, 'film');
    assert.equal(films.length, 4);

    const xray = films.find(x => x.id === xrayId);
    assert.equal(xray.ref_code, 'REF-XR-1417');
    assert.equal(xray.cms_code, 'CMS-IMG-XR1');
    assert.equal(xray.category, 'X-RAY');
    assert.equal(xray.strength, '14x17 inch');
    assert.equal(xray.balance, 500);

    // Test film usage
    manualFilmUsage(db, xrayId, 2, 'EXAM-XR-001', 'radiographer_1');
    assert.equal(listStock(db, 'film').find(x => x.id === xrayId).balance, 498);

    // Test film receipt
    receiveStock(db, xrayId, 100, 'radiographer_1');
    assert.equal(listStock(db, 'film').find(x => x.id === xrayId).balance, 598);

    const hist = stockHistory(db, 'film');
    assert.equal(hist.length, 6); // 4 Openings + 1 Use + 1 Receipt
  } finally {
    db.sqlite.close();
  }
});

test('v21.7 stock.html and imaging.html include film stock subtab navigation and fields', () => {
  const imagingHtml = fs.readFileSync(path.join(process.cwd(), 'protected/imaging.html'), 'utf8');
  assert.ok(imagingHtml.includes('/imaging/films'), 'imaging.html contains link to /imaging/films');

  const stockHtml = fs.readFileSync(path.join(process.cwd(), 'protected/stock.html'), 'utf8');
  assert.ok(stockHtml.includes('film-field'), 'stock.html contains film-field classes');
  assert.ok(stockHtml.includes('/imaging/films'), 'stock.html has imaging toolbar link');

  const stockJs = fs.readFileSync(path.join(process.cwd(), 'public/stock.js'), 'utf8');
  assert.ok(stockJs.includes("startsWith('/imaging') ? 'film'"), 'stock.js recognizes imaging pathname as film stock');
  assert.ok(stockJs.includes('បញ្ជីហ្វីល និងសម្ភារៈ'), 'stock.js has film table title');
});

