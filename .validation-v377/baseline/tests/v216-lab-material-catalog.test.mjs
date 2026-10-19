import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { openDatabase } from '../server/database.mjs';
import { ensureParaclinicSchema, labCatalog } from '../server/paraclinic.mjs';
import { ensureStockSchema, addStockItem, listStock, useLabMaterials, manualMaterialUsage, receiveStock, stockHistory } from '../server/stock.mjs';

function createTestDb() {
  const db = openDatabase(':memory:');
  ensureParaclinicSchema(db);
  return db;
}

test('v21.6 lab stock schema supports international guideline fields (REF, CMS, Name/Reagent, Category, Lot, Storage, Expiry, Qty, TestCode, PerTest)', () => {
  const db = createTestDb();
  try {
    ensureStockSchema(db);
    const cols = db.sqlite.prepare('PRAGMA table_info(stock_items)').all().map(c => c.name);
    assert.ok(cols.includes('ref_code'), 'ref_code column exists');
    assert.ok(cols.includes('cms_code'), 'cms_code column exists');
    assert.ok(cols.includes('name'), 'name column exists');
    assert.ok(cols.includes('category'), 'category column exists');
    assert.ok(cols.includes('lot_no'), 'lot_no column exists');
    assert.ok(cols.includes('storage_condition'), 'storage_condition column exists');
    assert.ok(cols.includes('expiry_date'), 'expiry_date column exists');
    assert.ok(cols.includes('unit'), 'unit column exists');
    assert.ok(cols.includes('balance'), 'balance column exists');
    assert.ok(cols.includes('test_code'), 'test_code column exists');
    assert.ok(cols.includes('per_test'), 'per_test column exists');

    const code = labCatalog(db)[0].code;
    const id = addStockItem(db, 'material', {
      refCode: 'REF-HGB-99',
      cmsCode: 'CMS-LAB-01',
      name: 'Hemoglobin Reagent Kit',
      category: 'Reagent',
      lotNo: 'LOT-2026-X1',
      storageCondition: '2°C - 8°C',
      expiryDate: '2027-10-31',
      unit: 'test',
      quantity: 200,
      testCode: code,
      perTest: 1
    }, 'lab_tech_1');

    assert.ok(id, 'Material item created with unique ID');
    const items = listStock(db, 'material');
    assert.equal(items.length, 1);
    const item = items[0];
    assert.equal(item.ref_code, 'REF-HGB-99');
    assert.equal(item.cms_code, 'CMS-LAB-01');
    assert.equal(item.name, 'Hemoglobin Reagent Kit');
    assert.equal(item.category, 'Reagent');
    assert.equal(item.lot_no, 'LOT-2026-X1');
    assert.equal(item.storage_condition, '2°C - 8°C');
    assert.equal(item.expiry_date, '2027-10-31');
    assert.equal(item.unit, 'test');
    assert.equal(item.balance, 200);
    assert.equal(item.test_code, code);
    assert.equal(item.per_test, 1);

    // Test automatic deduction upon lab test order
    const order = { id: 'lab_order_1', request: { items: [{ code }] }, result: { items: [{ code }] } };
    useLabMaterials(db, order, 'lab_tech_1');
    assert.equal(listStock(db, 'material')[0].balance, 199);

    // Test manual use and receipt
    manualMaterialUsage(db, id, 5, 'MANUAL-QC-01', 'lab_tech_1');
    assert.equal(listStock(db, 'material')[0].balance, 194);

    receiveStock(db, id, 50, 'lab_tech_1');
    assert.equal(listStock(db, 'material')[0].balance, 244);

    const hist = stockHistory(db, 'material');
    assert.equal(hist.length, 4); // Opening + Order Use + Manual Use + Receipt
  } finally {
    db.sqlite.close();
  }
});

test('v21.6 stock.html and stock.js contain international lab standard inputs, headers, and Reagent terminology', () => {
  const html = fs.readFileSync(path.join(process.cwd(), 'protected/stock.html'), 'utf8');
  assert.ok(html.includes('name="refCode"'), 'stock.html has refCode input');
  assert.ok(html.includes('name="cmsCode"'), 'stock.html has cmsCode input');
  assert.ok(html.includes('name="category"'), 'stock.html has category select');
  assert.ok(html.includes('name="lotNo"'), 'stock.html has lotNo input');
  assert.ok(html.includes('name="storageCondition"'), 'stock.html has storageCondition select');
  assert.ok(html.includes('Reagent'), 'stock.html contains Reagent label');

  const js = fs.readFileSync(path.join(process.cwd(), 'public/stock.js'), 'utf8');
  assert.ok(js.includes('ref_code'), 'stock.js references ref_code');
  assert.ok(js.includes('category'), 'stock.js references category');
  assert.ok(js.includes('lot_no'), 'stock.js references lot_no');
  assert.ok(js.includes('storage_condition'), 'stock.js references storage_condition');
  assert.ok(js.includes('Reagent'), 'stock.js uses Reagent terminology');
});

test('v21.6 version step consistency across package.json, login.html, and server.mjs', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8'));
  assert.match(pkg.version, /^2[0-9]\./);

  const server = fs.readFileSync(path.join(process.cwd(), 'server/server.mjs'), 'utf8');
  assert.match(server, /2[0-9]\./);

  const login = fs.readFileSync(path.join(process.cwd(), 'public/login.html'), 'utf8');
  assert.match(login, /v2[0-9]\./);
});
