import assert from 'node:assert/strict';
import test from 'node:test';
import { openDatabase } from '../server/database.mjs';
import { ensureAccessSchema } from '../server/access.mjs';
import { ensureFinanceSchema, serviceCatalog } from '../server/finance.mjs';

test('v14.9 uses the corrected genital-wart service and keeps the obsolete catalog row inactive',()=>{
  const database=openDatabase(':memory:');
  try{
    ensureAccessSchema(database);
    ensureFinanceSchema(database);
    let services=new Map(serviceCatalog(database,{includeInactive:true}).map(service=>[service.code,service]));
    assert.deepEqual([services.get('GO_GENITAL_WART_TREATMENT').nameKh,services.get('GO_GENITAL_WART_TREATMENT').defaultAmount,services.get('GO_GENITAL_WART_TREATMENT').currency,services.get('GO_GENITAL_WART_TREATMENT').active],['ព្យាបាលសិរមាន់',40000,'KHR',true]);
    const eyes=serviceCatalog(database).filter(service=>service.categoryCode==='EYE_CARE').sort((a,b)=>a.sortOrder-b.sortOrder);
    assert.deepEqual(eyes.map(service=>service.defaultAmount),[10000,5000,25000,25000,40000,60000,100000,140000,180000,50000]);
    assert.ok(eyes.every(service=>service.active&&service.currency==='KHR'));
    assert.equal(database.sqlite.prepare("SELECT COUNT(*) count FROM finance_catalog_migrations WHERE code='OFFICIAL_FEES_V149'").get().count,1);

    const now=Date.now();
    database.sqlite.prepare(`INSERT INTO finance_service_catalog
      (id,code,category_code,name_kh,name_en,default_amount_minor,currency,active,sort_order,created_at,updated_at,department_code,unit_label)
      VALUES ('legacy-genital-row','GO_SYPHILIS_TREATMENT','OBSTETRIC','ព្យាបាលរោគស្វាយ','Syphilis treatment',40000,'KHR',1,115,?,?,'gyneco-obstetric','case')`).run(now,now);
    database.sqlite.prepare("DELETE FROM finance_catalog_migrations WHERE code='OFFICIAL_FEES_V149'").run();
    ensureFinanceSchema(database);
    services=new Map(serviceCatalog(database,{includeInactive:true}).map(service=>[service.code,service]));
    assert.equal(services.get('GO_SYPHILIS_TREATMENT').active,false);
    assert.equal(services.get('GO_SYPHILIS_TREATMENT').nameKh,'ព្យាបាលរោគស្វាយ','the old catalog row remains intact for history');
    assert.equal(services.get('GO_GENITAL_WART_TREATMENT').active,true);
  }finally{database.close()}
});
