// v48.1 - NPCA practice mode for a TEST hosting (GitHub Codespace) only.
// Started with NPCA_PRACTICE=true. The HEF (IDPoor), NSSF and NPCA card checks
// answer from the synthetic test patients, and a built-in practice NPCA accepts
// closed visits: Processing (5), then Ready (1) after about a minute, or Failed (2)
// with a reason. Nothing goes to the internet. It refuses production, a real
// NPCA connection, and a database that held real patients before it was first used.
import { npcaSettings } from './settings.mjs';
import { HEF_SOURCE, normalizeHefCard } from '../hef-lookup.mjs';
import { evaluateNssfEligibility, normalizeNssfCard } from '../nssf-lookup.mjs';

export const PRACTICE_BASE_URL = 'https://npca-practice.invalid';
export const PRACTICE_FACILITY = 'PRACTICE-FACILITY';
export const PRACTICE_READY_MS = 60_000;
const MARKERS = ['system:syntheticHostingTest', 'system:syntheticRegistrationFixture', 'system:demoPatient'];
const parse = (value) => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
export const isSyntheticRecord = (recordJson) => { const data = typeof recordJson === 'string' ? parse(recordJson) : recordJson || {}; return MARKERS.some((key) => data[key] === true || data[key] === 'true'); };

export function npcaPracticeSettings(overrides = {}, env = process.env) {
  if (overrides.enabled === true || env.NPCA_ENABLED === 'true') throw new Error('NPCA practice mode cannot run together with a real NPCA connection (NPCA_ENABLED=true).');
  const config = npcaSettings({ enabled: true, baseUrl: PRACTICE_BASE_URL, clientId: 'practice', clientSecret: 'practice', username: 'practice', password: 'practice',
    systemCode: 'PRACTICE', facilityCode: PRACTICE_FACILITY, pollHours: 1 / 60, sendForms: true, timeoutMs: 15000 }, {});
  config.practice = true;
  return config;
}

export function ensureNpcaPracticeSchema(database) {
  database.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS npca_practice_state (id INTEGER PRIMARY KEY CHECK(id=1), started_at INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS npca_practice_visits (visit_code TEXT PRIMARY KEY, patient_key TEXT, status INTEGER NOT NULL,
      submitted_at INTEGER NOT NULL, admitted_on TEXT, discharged_on TEXT, errors TEXT NOT NULL DEFAULT '');
  `);
}
// First start: only test patients may be in the database. Afterwards patients
// registered by hand during the practice are allowed.
export function assertNpcaPracticeAllowed(database, now = Date.now()) {
  ensureNpcaPracticeSchema(database);
  if (database.sqlite.prepare('SELECT 1 FROM npca_practice_state WHERE id=1').get()) return;
  const real = database.sqlite.prepare('SELECT record_json FROM patient_records').all().filter((row) => !isSyntheticRecord(row.record_json)).length;
  if (real) throw new Error(`NPCA practice mode refused: ${real} patient(s) in this database are not test patients. Use it only on a test hosting with the seeded test patients.`);
  database.sqlite.prepare('INSERT INTO npca_practice_state(id,started_at) VALUES (1,?)').run(now);
}

// The test patient whose HEF or NSSF number is this card.
function practiceCard(database, card, kind) {
  const key = kind === 'HEF' ? 'web_equity' : 'web_nssf';
  for (const row of database.sqlite.prepare("SELECT patient_key, record_json FROM patient_records WHERE record_json LIKE '%syntheticHostingTest%'").all()) {
    const data = parse(row.record_json), reg = (id) => data['scope:registration:id:' + id];
    if (String(reg(key) || '') !== card) continue;
    return { patientKey: row.patient_key, data, reg, eligible: data['system:practiceCardNotEligible'] !== true };
  }
  return null;
}
const MALE = 'ប្រុស';
const sexOf = (reg) => reg('web_sex_male') === true ? MALE : reg('web_sex_female') === true ? 'ស្រី' : '';

export function practiceHefLookup(database, card, now = Date.now()) {
  const requestedCard = normalizeHefCard(card), found = practiceCard(database, requestedCard, 'HEF'), verifiedAt = new Date(now).toISOString();
  if (!found) return { found: false, requestedCard, source: HEF_SOURCE, verifiedAt };
  const { reg, eligible } = found, address = {};
  for (const level of ['province', 'district', 'commune', 'village']) { address[level] = String(reg('web_' + level) || ''); address[level + 'Code'] = String(reg('web_' + level + '_code') || ''); }
  const lastName = String(reg('web_last_name') || ''), firstName = String(reg('web_first_name') || '');
  return { found: true, requestedCard, source: HEF_SOURCE, verifiedAt, practice: true,
    card: { number: requestedCard, valid: eligible, disqualified: false, status: eligible ? 'Active' : 'Expired', povertyStatus: eligible ? 'Poor 1' : '', householdCode: 'PRACTICE-' + requestedCard.slice(-6), validUntil: eligible ? '2028-12-31' : '2025-12-31', redirected: false },
    address, members: [{ id: 'member-0', lastName, firstName, fullName: [lastName, firstName].filter(Boolean).join(' '), sex: sexOf(reg), dateOfBirth: String(reg('web_dob') || ''), relation: 'Head' }] };
}
export function practiceNssfLookup(database, card, now = Date.now()) {
  const id = normalizeNssfCard(card), found = practiceCard(database, id, 'NSSF');
  const result = evaluateNssfEligibility(found ? { ben_code: id, ben_full_name_kh: [found.reg('web_last_name'), found.reg('web_first_name')].filter(Boolean).join(' '), sta_eli_id: found.eligible ? 1 : 2, ben_type: 1 } : null, id, new Date(now).toISOString());
  return { ...result, practice: true };
}

// Practice NPCA server, used as the fetch of the NPCA client.
export function createPracticeFetch(database, { clock = Date.now } = {}) {
  ensureNpcaPracticeSchema(database);
  const reply = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const record = (row, status) => ({ visit_code: row.visit_code, visit_ulid: 'PRACTICE-' + row.visit_code, status, errors: row.errors || [], message: status === 2 ? row.errors : '' });
  const current = (row) => {
    if (row.status === 5 && clock() - row.submitted_at >= PRACTICE_READY_MS) {
      database.sqlite.prepare('UPDATE npca_practice_visits SET status=1 WHERE visit_code=?').run(row.visit_code);
      return { ...row, status: 1 };
    }
    return row;
  };
  return async function practiceFetch(input, options = {}) {
    const url = new URL(input), method = String(options.method || 'GET').toUpperCase();
    const body = options.body ? parse(options.body) : {};
    if (url.origin !== PRACTICE_BASE_URL) return reply(404, { success: false, message: 'Not the practice NPCA.' });
    if (url.pathname === '/oauth/token' && method === 'POST') return reply(200, { token_type: 'Bearer', access_token: 'PRACTICE-TOKEN', refresh_token: 'PRACTICE-REFRESH', expires_in: 7200 });
    if (options.headers?.Authorization !== 'Bearer PRACTICE-TOKEN') return reply(401, { success: false, http_code: 401, message: 'Unauthenticated', errors: 'Invalid or expired token' });
    if (url.pathname === '/api/v1/external/beneficiary/search') {
      const card = String(url.searchParams.get('card_number') || '');
      const found = practiceCard(database, card, 'HEF') && { ...practiceCard(database, card, 'HEF'), type: 'HEF' } || practiceCard(database, card, 'NSSF') && { ...practiceCard(database, card, 'NSSF'), type: 'NSSF' };
      if (!found) return reply(200, { success: true, data: [] });
      const { reg, eligible, type } = found, healthId = String(reg('web_health_id') || found.patientKey);
      return reply(200, { success: true, data: [{ spid: 'PRACTICE-SPID-' + healthId, patient_code: healthId, surname: reg('web_last_name') || '', name: reg('web_first_name') || '',
        sex: sexOf(reg) === MALE ? 'M' : 'F', birthdate: reg('web_dob') || '', phone_number: reg('web_phone') || '', nationality: 'KHM', dead: false, eligible,
        benefit_cards: [{ card_type: type, card_number: card }] }] });
    }
    if (url.pathname === '/api/v1/external/visits' && method === 'POST') {
      const visit = body.visits?.[0];
      if (!visit?.code) return reply(422, { success: false, http_code: 422, message: 'Invalid request data', errors: 'The visits.0.code field is required.', data: null });
      const prior = database.sqlite.prepare('SELECT * FROM npca_practice_visits WHERE visit_code=?').get(visit.code);
      // Practice versions of the 4.5.5 failure reasons.
      const spid = String(visit.patient?.spid || ''), healthId = spid.replace(/^PRACTICE-SPID-/, '');
      const owner = database.sqlite.prepare("SELECT record_json FROM patient_records WHERE health_id=? AND record_json LIKE '%syntheticHostingTest%'").get(healthId);
      const errors = [];
      if (prior && current(prior).status === 1) errors.push('Visit Code has been submitted.');
      if (!spid.startsWith('PRACTICE-SPID-') || !owner) errors.push('The patient SPID is not a beneficiary.');
      else if (parse(owner.record_json)['system:practiceCardNotEligible'] === true) errors.push('The beneficiary is not eligible.');
      if (visit.health_facility_code !== PRACTICE_FACILITY) errors.push('The health facility code is invalid.');
      if (visit.discharge_type === 'DITY-000Y00F' && !visit.referral?.referred_to?.reason) errors.push('Referral reason is required.');
      if (errors.length) return reply(422, { success: false, http_code: 422, message: 'Invalid request data', errors: errors.join(' '), data: null });
      const status = visit.discharged_at ? 5 : 3, now = clock();
      database.sqlite.prepare(`INSERT INTO npca_practice_visits(visit_code,patient_key,status,submitted_at,admitted_on,discharged_on,errors) VALUES(?,?,?,?,?,?,'')
        ON CONFLICT(visit_code) DO UPDATE SET status=excluded.status,submitted_at=excluded.submitted_at,admitted_on=excluded.admitted_on,discharged_on=excluded.discharged_on,errors=''`)
        .run(visit.code, visit.patient?.code || null, status, now, String(visit.admitted_at || '').slice(0, 10), String(visit.discharged_at || '').slice(0, 10));
      return reply(200, { success: true, http_code: 200, message: status === 3 ? 'Your request is accepted and pending update.' : 'Your request is accepted and is being processed.',
        data: { visit_ulid: 'PRACTICE-' + visit.code, visit_code: visit.code, status } });
    }
    if (url.pathname === '/api/v1/external/visits/processed') {
      const code = url.searchParams.get('visit_code');
      if (code) { const row = database.sqlite.prepare('SELECT * FROM npca_practice_visits WHERE visit_code=?').get(code); return reply(200, { success: true, data: row ? [record(row, current(row).status)] : [] }); }
      const by = url.searchParams.get('discharged_at_from') ? 'discharged' : 'admitted', from = url.searchParams.get(by + '_at_from'), to = url.searchParams.get(by + '_at_to');
      const rows = database.sqlite.prepare(`SELECT * FROM npca_practice_visits WHERE ${by}_on>=? AND ${by}_on<=? ORDER BY visit_code`).all(from, to);
      return reply(200, { success: true, data: { data: rows.map((row) => record(row, current(row).status)), current_page: 1, last_page: 1 } });
    }
    return reply(404, { success: false, message: 'Unknown practice endpoint' });
  };
}
