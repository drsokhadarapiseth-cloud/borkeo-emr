import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createEmrServer } from '../server/server.mjs';
import { openBrowser } from './helpers/context-browser.mjs';

// Stage 1 PMRS2 -> Borkeo registration import. No real PMRS2 site is contacted;
// the scraped payload is synthesised from the local gazetteer and the page's own
// control values so the test carries no hard-coded Khmer.
test('PMRS2 import fills registration, resolves the address and flags a duplicate', { timeout: 240000 }, async () => {
  const app = createEmrServer({ demoMode: true, databasePath: ':memory:', nodeEnv: 'test', host: '127.0.0.1', port: 0, npca: { enabled: false }, npcaPractice: false });
  let browser;
  try {
    // Seed an existing patient so duplicate detection by health-card number has a hit.
    const dupKey = 'case:PMRS2-DUP';
    app.database.upsertPatient({
      id: crypto.randomUUID(), patientKey: dupKey, savedAt: Date.now(),
      userId: app.database.sqlite.prepare("SELECT id FROM users WHERE username='registration'").get().id,
      summary: { caseNumber: 'PMRS2-DUP', healthId: 'HCDUP777', firstName: 'Existing', lastName: 'Patient', fullName: 'Patient Existing', sex: 'Male', age: '40', dateOfBirth: '1986-01-01', phone: '012999888', equityCard: '', paymentType: '', departmentCode: 'opd', departmentNameKh: '', departmentNameEn: '', serviceMode: 'opd', entryDate: '2026-10-30', dischargeDate: '' },
      data: { 'scope:registration:id:web_health_id': 'HOSP-OWN-1', 'scope:registration:id:web_other_card_number': 'HCDUP777' },
    });
    await new Promise(r => app.server.listen(0, '127.0.0.1', r));
    app.config.appOrigin = 'http://127.0.0.1:' + app.server.address().port;

    browser = await openBrowser();
    await browser.send('Network.setBlockedURLs', { urls: ['https://*'] });
    const response = await fetch(app.config.appOrigin + '/api/auth/login', { method: 'POST', headers: { Origin: app.config.appOrigin, 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'registration' }) });
    const [name, value] = response.headers.get('set-cookie').split(';')[0].split('=');
    await browser.send('Network.setCookie', { name, value, url: app.config.appOrigin });

    await browser.send('Page.navigate', { url: app.config.appOrigin + '/emr?view=registration&pmrs2Import=1' });
    await browser.waitFor('!!document.getElementById("web_last_name") && typeof window.applyPmrs2Registration==="function" && typeof window.restorePatientAddress==="function"', 'registration + import ready', 60000);

    // Build a synthetic PMRS2 payload from the gazetteer and the page's own values.
    const built = await browser.evaluate(`(async () => {
      const provinces = await (await fetch('/public/data/gazetteer/provinces.json')).json();
      const prov = provinces.find(p => p.id === 'kandal') || provinces[0];
      const detail = await (await fetch('/public/data/gazetteer/provinces/' + prov.id + '.json')).json();
      const d = detail[0]; const c = (d.communes || [])[0]; const v = (c.villages || [])[0];
      return {
        province: prov.local, district: d.local, commune: c.local, village: v.local,
        sexValue: document.getElementById('web_sex_male').value,
        entryValue: document.getElementById('web_entry_type').options[0].value,
        expectProvinceCode: String(prov.code).padStart(2,'0').slice(-2),
      };
    })()`);

    const payload = {
      fullName: 'Sok Dara', sex: built.sexValue, dob: '2016-05-05', phone: '098765432',
      healthId: 'HCNEW123', caseNumber: 'B2756S4-0M007C3', entryType: built.entryValue,
      province: built.province, district: built.district, commune: built.commune, village: built.village,
      street: 'House 12 Street 3',
    };

    const report = await browser.evaluate(`window.applyPmrs2Registration(${JSON.stringify(payload)})`);
    const fields = await browser.evaluate(`({
      last: document.getElementById('web_last_name').value,
      first: document.getElementById('web_first_name').value,
      sex: document.getElementById('web_sex_male').checked,
      phone: document.getElementById('web_phone').value,
      health: document.getElementById('web_health_id').value,
      dob: document.getElementById('web_dob').value,
      entry: document.getElementById('web_entry_type').value,
      otherNum: document.getElementById('web_other_card_number').value,
      otherType: document.getElementById('web_other_card_type').value,
      otherIssuer: document.getElementById('web_other_card_issuer').value,
      otherYes: document.getElementById('other_id_yes').checked,
      pmrs2Case: document.getElementById('web_pmrs2_case_number').value,
      pmrs2CaseReadonly: document.getElementById('web_pmrs2_case_number').readOnly,
      pCode: document.getElementById('web_province_code').value,
      dCode: document.getElementById('web_district_code').value,
      cCode: document.getElementById('web_commune_code').value,
      vCode: document.getElementById('web_village_code').value,
      street: document.getElementById('web_street_address').value,
    })`);

    assert.equal(fields.last, 'Sok', 'family name first');
    assert.equal(fields.first, 'Dara');
    assert.equal(fields.sex, true, 'sex radio set');
    assert.equal(fields.phone, '098765432');
    assert.notEqual(fields.health, 'HCNEW123', 'PMRS2 ID did not overwrite the hospital health-card field');
    assert.equal(fields.otherNum, 'HCNEW123', 'PMRS2 ID goes to the other-card number');
    assert.equal(fields.otherType, '4. Other Card');
    assert.equal(fields.otherIssuer, 'PMRS2');
    assert.equal(fields.otherYes, true, 'other-card radio ticked');
    assert.equal(fields.pmrs2Case, 'B2756S4-0M007C3', 'PMRS2 case number in its own field');
    assert.equal(fields.pmrs2CaseReadonly, true, 'PMRS2 case number field is read-only');
    assert.equal(fields.dob, '2016-05-05');
    assert.equal(fields.entry, built.entryValue, 'entry type select set');
    assert.equal(fields.street, 'House 12 Street 3');
    assert.equal(fields.pCode, built.expectProvinceCode, 'province resolved to gazetteer code');
    assert.ok(fields.dCode && fields.cCode && fields.vCode, 'district/commune/village resolved through the hierarchy');
    assert.equal(report.addressResolved, true);
    assert.ok(report.filled.includes('pmrs2_id_card') && report.filled.includes('pmrs2_case_number') && report.filled.includes('address'));

    // Duplicate detection by the PMRS2 ID stored in the other-card field.
    const dupReport = await browser.evaluate(`window.applyPmrs2Registration(${JSON.stringify({ ...payload, healthId: 'HCDUP777' })})`);
    assert.ok(dupReport.duplicates.length >= 1, 'duplicate found');
    assert.equal(dupReport.duplicates[0].matchedBy, 'other');

    // Extension hand-off path: content script sets the data attribute and dispatches the event.
    await browser.evaluate(`document.getElementById('web_other_card_number').value='';
      document.documentElement.setAttribute('data-borkeo-pmrs2-import', ${JSON.stringify(JSON.stringify({ ...payload, healthId: 'HCEVENT9' }))});
      document.dispatchEvent(new CustomEvent('borkeo:pmrs2-import')); true`);
    await browser.waitFor(`document.getElementById('web_other_card_number').value==='HCEVENT9'`, 'event hand-off fills form', 15000);
    assert.equal(await browser.evaluate(`document.documentElement.hasAttribute('data-borkeo-pmrs2-import')`), false, 'data attribute cleared after read');

    // Scraper: build a PMRS2-like form from the extension's own captions and read it back.
    const fieldsSrc = fs.readFileSync('pmrs2-helper/pmrs2-fields.js', 'utf8');
    const scrapeSrc = fs.readFileSync('pmrs2-helper/scrape.js', 'utf8');
    const scraped = await browser.evaluate(`(async () => {
      const frame = document.createElement('iframe');
      document.body.appendChild(frame);
      const d = frame.contentDocument;
      d.open(); d.write('<!doctype html><html><body></body></html>'); d.close();
      const s1 = d.createElement('script'); s1.textContent = ${JSON.stringify(fieldsSrc)}; d.body.appendChild(s1);
      const s2 = d.createElement('script'); s2.textContent = ${JSON.stringify(scrapeSrc)}; d.body.appendChild(s2);
      const fields = frame.contentWindow.PMRS2_FIELDS;
      for (const f of fields) {
        const wrap = d.createElement('div'); wrap.className = 'input-group';
        const label = d.createElement('label'); label.textContent = f.labels[0];
        const input = d.createElement('input'); input.type = 'text'; input.value = 'V_' + f.key;
        wrap.appendChild(label); wrap.appendChild(input); d.body.appendChild(wrap);
      }
      const out = frame.contentWindow.scrapePmrs2(d);
      frame.remove();
      return out;
    })()`);
    assert.equal(scraped.phone, 'V_phone', 'scraper reads a form field by its caption');
    assert.equal(scraped.province, 'V_province');
    assert.equal(scraped.healthId, 'V_healthId');

    // Summary page: values shown as plain text beside the caption (PMRS2 patient detail).
    const scrapedText = await browser.evaluate(`(async () => {
      const frame = document.createElement('iframe');
      document.body.appendChild(frame);
      const d = frame.contentDocument;
      d.open(); d.write('<!doctype html><html><body></body></html>'); d.close();
      const s1 = d.createElement('script'); s1.textContent = ${JSON.stringify(fieldsSrc)}; d.body.appendChild(s1);
      const s2 = d.createElement('script'); s2.textContent = ${JSON.stringify(scrapeSrc)}; d.body.appendChild(s2);
      const fields = frame.contentWindow.PMRS2_FIELDS;
      const COLON = '\\u17c8';
      for (const f of fields) {
        const p = d.createElement('p');
        const b = d.createElement('b'); b.textContent = f.labels[0] + COLON;
        p.appendChild(b); p.appendChild(d.createTextNode(' T_' + f.key));
        d.body.appendChild(p);
      }
      const out = frame.contentWindow.scrapePmrs2(d);
      frame.remove();
      return out;
    })()`);
    assert.equal(scrapedText.phone, 'T_phone', 'scraper reads a plain-text value beside its caption');
    assert.equal(scrapedText.sex, 'T_sex');
    assert.equal(scrapedText.caseNumber, 'T_caseNumber');
    assert.equal(scrapedText.healthId, 'T_healthId');

    assert.deepEqual(browser.state.errors, []);
  } finally {
    await browser?.close();
    app.server.closeAllConnections();
    await new Promise(r => app.server.close(r));
    app.database.close();
  }
});
