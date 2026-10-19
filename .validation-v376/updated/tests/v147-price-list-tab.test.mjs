import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root=path.resolve(import.meta.dirname,'..');
const read=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('v14.7 removes the English cashier heading and provides an Admin/Director price-list tab',()=>{
  const html=read('protected/billing.html');
  const js=read('public/billing.js');
  const sessionCss=read('public/emr-session.css');
  assert.doesNotMatch(html,/Cashier Workspace/);
  assert.doesNotMatch(html,/ទទួលប្រាក់បានលឿន និងច្បាស់លាស់/);
  assert.match(html,/id="cashier-hospital-name"/);
  assert.match(html,/id="price-list-tab-button"[^>]*hidden/);
  assert.match(html,/id="service-catalog-editor"/);
  assert.match(html,/name="categoryCode"/);
  assert.match(html,/name="defaultAmount"/);
  assert.match(html,/name="currency"/);
  assert.match(html,/<input name="active" type="checkbox" checked> សកម្ម/);
  assert.doesNotMatch(html,/name="active"><select/);
  assert.match(js,/price-list-tab-button'\)\.hidden=!\['ADMIN','VICE_DIRECTOR','DIRECTOR'\]\.includes\(role\)/);
  assert.match(js,/api\('\/api\/finance\/services'/);
  assert.match(js,/async function loadServices\(type=payer\(\)\)/);
  assert.doesNotMatch(sessionCss,/body\.emr-director-view #manage-services/);
});

test('v14.8 provides icon actions and removes a service from active choices without deleting its history',()=>{
  const js=read('public/billing.js');
  assert.match(js,/data-edit-service=/);
  assert.match(js,/data-delete-service=/);
  assert.match(js,/method:'DELETE'/);
  assert.match(js,/ប្រវត្តិវិក្កយបត្រចាស់នឹងនៅដដែល/);
  assert.match(js,/await loadServices\('DIRECT'\);renderServiceCatalog\(\)/);
});

test('v14.9 groups services, offers per-row active checkboxes, and hides the editor until Add or Edit',()=>{
  const html=read('protected/billing.html');
  const js=read('public/billing.js');
  const css=read('public/billing.css');
  const finance=read('server/finance.mjs');
  assert.match(html,/id="service-catalog-editor" class="service-editor"/);
  assert.match(html,/<input name="active" type="checkbox" checked>/);
  assert.match(js,/data-service-active=/);
  assert.match(js,/IX · ផ្នែកថែទាំភ្នែក/);
  assert.match(finance,/GO_GENITAL_WART_TREATMENT/);
  assert.match(js,/showModal\(\)/);
  assert.match(css,/\.service-category-divider/);
});
