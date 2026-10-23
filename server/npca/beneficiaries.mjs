import { randomUUID } from 'node:crypto';
import { npcaAudit } from './storage.mjs';

export function beneficiaryEligible(person) {
  // Missing/unknown eligibility is not treated as an entitlement.
  return person?.dead === false && (person.eligible === true || person.eligibility === true || person.eligibility === 'eligible') && Boolean(person.spid);
}
export async function searchBeneficiaries(client, database, actorId, cardNumber) {
  if (!/^[A-Za-z0-9-]{3,64}$/.test(cardNumber)) throw new Error('លេខប័ណ្ណមិនត្រឹមត្រូវ។');
  const result = await client.request('search', { card_number: cardNumber }, { actorId });
  const raw = Array.isArray(result.data) ? result.data : result.data?.beneficiaries ?? result.beneficiaries;
  if (!Array.isArray(raw)) throw new Error('ទម្រង់ចម្លើយ NPCA មិនត្រឹមត្រូវ។');
  database.sqlite.prepare('DELETE FROM npca_beneficiaries WHERE expires_at<?').run(Date.now());
  return raw.map(person => {
    const id = randomUUID();
    database.sqlite.prepare('INSERT INTO npca_beneficiaries VALUES (?,?,?,?,?)').run(id, actorId, cardNumber, JSON.stringify(person), Date.now() + 30 * 60000);
    return { selectionId: id, spid: person.spid, patientCode: person.patient_code, surname: person.surname, name: person.name,
      sex: person.sex, birthdate: person.birthdate, benefitCards: person.benefit_cards || [], eligible: beneficiaryEligible(person), dead: person.dead === true };
  });
}
export function selectionFor(database, id, actorId) {
  const row = database.sqlite.prepare('SELECT * FROM npca_beneficiaries WHERE id=? AND actor_id=? AND expires_at>?').get(id, actorId, Date.now());
  if (!row) throw Object.assign(new Error('សូមពិនិត្យសិទ្ធិ NPCA ម្តងទៀត។'), { status: 400 });
  const person = JSON.parse(row.beneficiary);
  if (!beneficiaryEligible(person)) throw Object.assign(new Error('អ្នកជំងឺនេះមិនមានសិទ្ធិទាមទារប្រាក់ NPCA ទេ។'), { status: 400 });
  return { ...person, verifiedCardNumber: row.card_number };
}
export function saveBeneficiaryLink(database, patientKey, person, paymentType, actorId) {
  if (!paymentType?.startsWith('PATY-')) throw new Error('សូមកំណត់ប្រភេទបង់ប្រាក់ NPCA ឱ្យត្រឹមត្រូវ។');
  database.sqlite.prepare(`INSERT INTO npca_patient_links VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(patient_key) DO UPDATE SET
    spid=excluded.spid,patient_code=excluded.patient_code,cards=excluded.cards,payment_type=excluded.payment_type,
    eligible=excluded.eligible,verified_at=excluded.verified_at,verified_by=excluded.verified_by`).run(
      patientKey, person.spid, person.patient_code || null, JSON.stringify(person.benefit_cards || []), paymentType, 1, Date.now(), actorId);
  npcaAudit(database, 'BENEFICIARY_SELECTED', { actorId, patientKey });
}
export function beneficiaryPayment(person) {
  const cardTypes = new Set((person.benefit_cards || []).map(card => card.card_type ?? card.type));
  const schemes = { HEF:'PATY-0000N09', HEFR:'PATY-00003LD', HEFIY:'PATY-00002NF', HEFIV:'PATY-00002NF', HEFIP:'PATY-00002NF', OTHID:'PATY-00002NF', HEFCNP:'PATY-00002EH', NSSF:'PATY-000K010', NSSFE:'PATY-0000G3E', NSSFEM:'PATY-0000G3E', NSSFP:'PATY-00B003F', NSSFPM:'PATY-00B003F', NSSFS:'PATY-000T040' };
  const values = [...new Set([...cardTypes].map(type => schemes[type]).filter(Boolean))];
  // Multiple benefit schemes need an explicit, confirmed choice; never guess.
  return values.length === 1 ? values[0] : '';
}
