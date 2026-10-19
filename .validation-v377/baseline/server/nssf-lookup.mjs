import crypto from 'node:crypto';

export const NSSF_LOOKUP_ROLES = new Set(['REGISTRATION', 'ADMIN', 'VICE_DIRECTOR']);
export const NSSF_SOURCE = 'https://service.nssf.gov.kh/search-service-portal';
export const NSSF_API_ENDPOINT = 'https://nssf-api.nssf.gov.kh/search_portal_member_api/api/Member/SearchBeneficiary';

// Official AES-256-CBC encryption parameters used by the public NSSF Member Search Portal
const NSSF_KEY = Buffer.from('QE5zc2ZfZnJvbV8xMjM0QHRyYWNraW5nJDNAaWxvdmU=', 'base64');
const NSSF_IV = Buffer.from('QFNvcGhhdEBsZW5nXzE5Mg==', 'base64');

export function normalizeNssfCard(value) {
  const id = String(value ?? '').replace(/[០-៩]/g, x => String(x.charCodeAt(0) - 0x17e0)).trim();
  if (!/^\d{4,20}$/.test(id)) {
    const e = new Error('Enter a valid numeric NSSF Card number.');
    e.status = 400;
    throw e;
  }
  return id;
}

function sanitizeText(value, max = 120) {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value).replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max)
    : '';
}

export function decryptNssfPayload(encryptedBase64) {
  if (!encryptedBase64 || typeof encryptedBase64 !== 'string') {
    return '';
  }
  try {
    const decipher = crypto.createDecipheriv('aes-256-cbc', NSSF_KEY, NSSF_IV);
    let decrypted = decipher.update(encryptedBase64, 'base64', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted.trim();
  } catch (err) {
    throw new Error('Failed to decrypt NSSF provider payload: ' + err.message);
  }
}

export function parseDecryptedBeneficiary(decryptedText) {
  if (decryptedText === '') return null;
  if (typeof decryptedText !== 'string') throw new Error('Unexpected NSSF decrypted payload.');
  let jsonString = decryptedText.replace(/^\uFEFF/, '').trim();
  if (jsonString === 'null') return null;
  // Preserve both direct JSON and the existing base64-JSON wire variant.
  if (/^[A-Za-z0-9+/]+={0,2}$/.test(jsonString) && jsonString.length % 4 === 0) {
    const bytes = Buffer.from(jsonString, 'base64');
    if (bytes.toString('base64') === jsonString) jsonString = bytes.toString('utf8').replace(/^\uFEFF/, '').trim();
  }
  let value;
  try { value = JSON.parse(jsonString); } catch { throw new Error('Unexpected NSSF decrypted JSON.'); }
  if (value === null) return null;
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Unexpected NSSF beneficiary structure.');
  return value;
}

function providerInteger(value) {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 2147483647) return value;
  if (typeof value === 'string' && /^\d{1,10}$/.test(value.trim())) {
    const n=Number(value.trim());if(n<=2147483647)return n;
  }
  return null;
}
function providerDate(value) {
  if (typeof value !== 'string') return null;
  const match=/^(\d{4}-\d{2}-\d{2})(?:T.*)?$/.exec(value.trim());if(!match)return null;
  const day=match[1],d=new Date(day+'T00:00:00Z');
  return Number.isFinite(d.valueOf()) && d.toISOString().slice(0,10)===day ? day : null;
}

export function evaluateNssfEligibility(beneficiary, requestedCard, nowIso = new Date().toISOString()) {
  const base={found:beneficiary!==null,requestedCard,source:NSSF_SOURCE,verifiedAt:nowIso};
  if (beneficiary === null) return {...base,card:{number:requestedCard,nameKh:null,nameEn:null,valid:false,status:'NOT_FOUND',statusKh:'រកមិនឃើញទិន្នន័យ',statusEn:'Not Found',endEligibleDate:null,validityType:'NOT_PROVIDED'}};
  if (!beneficiary || typeof beneficiary!=='object' || Array.isArray(beneficiary)) throw new Error('Unexpected NSSF beneficiary structure.');
  // The supplied official portal renders sta_eli_id == 1 as valid. Its UI
  // displays ben_type 1/2/3 as valid indefinitely. An expiry date is NOT a
  // prerequisite for validity, and pagination counters are not member status.
  const statusId=providerInteger(beneficiary.sta_eli_id);
  const type=providerInteger(beneficiary.ben_type);
  const endEligibleDate=providerDate(beneficiary.end_eligible_date);
  const aliases=['new_ben_code','ben_code','b_code','ss_id'].map(k=>sanitizeText(beneficiary[k],30)).filter(Boolean);
  if (aliases.length && !aliases.includes(requestedCard)) throw new Error('NSSF returned a different beneficiary identifier.');
  if (!Object.hasOwn(beneficiary,'sta_eli_id')) throw new Error('NSSF did not return its official member status.');
  const cardNumber=sanitizeText(beneficiary.new_ben_code || beneficiary.ben_code || requestedCard,30);
  const nameKh=sanitizeText(beneficiary.ben_full_name_kh || beneficiary.ben_name_kh || beneficiary.full_name_kh, 120) || null;
  const nameEn=sanitizeText(beneficiary.ben_full_name_en || beneficiary.ben_name_en || beneficiary.full_name_en, 120) || null;
  const valid=statusId===null ? null : statusId===1;
  const status=valid===true?'VALID':valid===false?'INACTIVE':'UNKNOWN';
  return {...base,card:{number:cardNumber,nameKh,nameEn,valid,status,
    statusKh:valid===true?'មានសុពលភាពផ្លូវការ':valid===false?'គ្មានសុពលភាពតាមប្រភព ប.ស.ស.':'មិនអាចបញ្ជាក់ស្ថានភាពបាន',
    statusEn:valid===true?'Officially Valid':valid===false?'Invalid according to NSSF':'Status Unknown',
    endEligibleDate,validityType:valid===true && [1,2,3].includes(type)?'INDEFINITE':endEligibleDate?'UNTIL':'NOT_PROVIDED',providerStatusId:statusId}};
}

async function readBoundedJson(response) {
  const cType = response.headers.get('content-type') || '';
  if (!cType.includes('json')) {
    throw new Error('NSSF provider returned an unexpected document format.');
  }
  const reader = response.body.getReader();
  let size = 0;
  const chunks = [];
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > 524288) {
      await reader.cancel();
      throw new Error('NSSF provider response exceeded size limit.');
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createNssfLookup({ fetchImpl = fetch, now = Date.now } = {}) {
  let active = 0;
  const attempts = new Map();

  return async function lookup(card, userId) {
    const id = normalizeNssfCard(card);
    const time = now();
    const recent = (attempts.get(userId) || []).filter(t => time - t < 60000);

    if (recent.length >= 12 || active >= 3) {
      const e = new Error('Too many verification requests. Please wait and retry.');
      e.status = 429;
      throw e;
    }

    attempts.set(userId, [...recent, time]);
    active++;

    if (attempts.size > 1000) {
      for (const [k, v] of attempts) {
        if (!v.some(t => time - t < 60000)) attempts.delete(k);
      }
    }

    try {
      const targetUrl = new URL(NSSF_API_ENDPOINT);
      targetUrl.searchParams.set('ben_code', id);

      const response = await fetchImpl(targetUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        redirect: 'error',
        signal: AbortSignal.timeout(15000)
      });

      if (!response.ok) {
        throw new Error(`NSSF provider service returned HTTP ${response.status}`);
      }

      const body = await readBoundedJson(response);
      if (!body || body.success !== true) {
        throw new Error('NSSF provider reported an unsuccessful query response.');
      }

      // Decrypt provider data payload
      if (!Object.hasOwn(body, 'data')) throw new Error('NSSF response did not include its data field.');
      if (body.data !== null && typeof body.data !== 'string') throw new Error('Unexpected NSSF encrypted data field.');
      const decrypted = decryptNssfPayload(body.data);
      const beneficiary = parseDecryptedBeneficiary(decrypted);

      return evaluateNssfEligibility(beneficiary, id, new Date(now()).toISOString());
    } catch (error) {
      if (error.status === 400 || error.status === 429) {
        throw error;
      }
      const e = new Error(
        error.name === 'TimeoutError' || error.name === 'AbortError'
          ? 'NSSF portal verification timed out. Please retry.'
          : 'Unable to verify with NSSF portal right now. The connection or provider response could not be confirmed.'
      );
      e.status = 503;
      throw e;
    } finally {
      active--;
    }
  };
}
