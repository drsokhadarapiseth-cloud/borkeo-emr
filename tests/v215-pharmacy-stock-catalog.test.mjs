import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';
import { ensureStockSchema, addStockItem, listStock, syncMedicineStock, stockHistory } from '../server/stock.mjs';

function createTestDb() {
  return openDatabase(':memory:');
}

test('v21.5 stock schema supports 7 pharmacy medicine fields (CMS, ATC, Name, Dose/Form, Strength, Expiry, Qty)', () => {
  const db = createTestDb();
  try {
    ensureStockSchema(db);
    const cols = db.sqlite.prepare('PRAGMA table_info(stock_items)').all().map(c => c.name);
    assert.ok(cols.includes('cms_code'), 'cms_code column exists');
    assert.ok(cols.includes('atc_code'), 'atc_code column exists');
    assert.ok(cols.includes('name'), 'name column exists');
    assert.ok(cols.includes('dose_form'), 'dose_form column exists');
    assert.ok(cols.includes('strength'), 'strength column exists');
    assert.ok(cols.includes('expiry_date'), 'expiry_date column exists');
    assert.ok(cols.includes('unit'), 'unit column exists');
    assert.ok(cols.includes('balance'), 'balance column exists');

    const id = addStockItem(db, 'medicine', {
      cmsCode: 'CMS-PAR-01',
      atcCode: 'N02BE01',
      name: 'Paracetamol',
      doseForm: 'Tablet',
      strength: '500 mg',
      expiryDate: '2028-12-31',
      unit: 'គ្រាប់',
      quantity: 500
    }, 'pharmacist_1');

    assert.ok(id, 'Medicine item created with unique ID');
    const items = listStock(db, 'medicine');
    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.cms_code, 'CMS-PAR-01');
    assert.equal(item.atc_code, 'N02BE01');
    assert.equal(item.name, 'Paracetamol');
    assert.equal(item.dose_form, 'Tablet');
    assert.equal(item.strength, '500 mg');
    assert.equal(item.expiry_date, '2028-12-31');
    assert.equal(item.unit, 'គ្រាប់');
    assert.equal(item.balance, 500);

    // Test stock deduction and history
    syncMedicineStock(db, 'OPD:test-case', [{ name: 'Paracetamol', unit: 'គ្រាប់', total: 20 }], 'doctor_1');
    const updated = listStock(db, 'medicine')[0];
    assert.equal(updated.balance, 480);

    const hist = stockHistory(db, 'medicine');
    assert.equal(hist.length, 2); // Opening + Prescription
  } finally {
    db.sqlite.close();
  }
});

test('v21.5 stock.html and stock.js contain the 7 requested fields in form and dynamic header', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/stock.html'), 'utf8');
  assert.ok(html.includes('name="cmsCode"'), 'stock.html has cmsCode input');
  assert.ok(html.includes('name="atcCode"'), 'stock.html has atcCode input');
  assert.ok(html.includes('name="name"'), 'stock.html has name input');
  assert.ok(html.includes('name="doseForm"'), 'stock.html has doseForm input');
  assert.ok(html.includes('name="strength"'), 'stock.html has strength input');
  assert.ok(html.includes('name="expiryDate"'), 'stock.html has expiryDate input');
  assert.ok(html.includes('name="quantity"'), 'stock.html has quantity input');

  const js = fs.readFileSync(path.join(process.cwd(), 'public/stock.js'), 'utf8');
  assert.ok(js.includes('cms_code'), 'stock.js references cms_code');
  assert.ok(js.includes('atc_code'), 'stock.js references atc_code');
  assert.ok(js.includes('dose_form'), 'stock.js references dose_form');
  assert.ok(js.includes('expiry_date'), 'stock.js references expiry_date');
  assert.ok(js.includes('strength'), 'stock.js references strength');
});

