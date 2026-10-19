// Borkeo EMR - Cambodia Gazetteer Address Module
// Provides in-memory gazetteer lookups, code padding, and hierarchy validation.
import fs from 'node:fs';
import path from 'node:path';

const projectRoot = path.resolve('.');
const gazetteerDir = path.join(projectRoot, 'data', 'gazetteer');

let cachedProvinces = null;
const cachedProvinceDetails = new Map();
const locationIndex = new Map(); // code -> location object

export function padCode(code, level) {
  if (code == null) return '';
  const s = String(code).trim();
  if (!s) return '';
  const lengths = { province: 2, district: 4, commune: 6, village: 8 };
  const target = lengths[level] || s.length;
  return s.padStart(target, '0');
}

export function loadGazetteer() {
  if (cachedProvinces) return cachedProvinces;
  const provincesFile = path.join(gazetteerDir, 'provinces.json');
  if (!fs.existsSync(provincesFile)) {
    throw new Error('Gazetteer provinces.json not found at ' + provincesFile);
  }
  const rawProvinces = JSON.parse(fs.readFileSync(provincesFile, 'utf8'));
  cachedProvinces = rawProvinces.map(p => {
    const code = padCode(p.code, 'province');
    const item = {
      id: p.id,
      code,
      nameKh: p.local,
      nameEn: p.english,
      rawCode: String(p.code),
    };
    locationIndex.set(code, { ...item, type: 'PROVINCE', level: 'province' });
    return item;
  });

  // Load all details and index
  for (const p of cachedProvinces) {
    const detailFile = path.join(gazetteerDir, 'provinces', `${p.id}.json`);
    if (fs.existsSync(detailFile)) {
      const rawDistricts = JSON.parse(fs.readFileSync(detailFile, 'utf8'));
      const districts = rawDistricts.map(d => {
        const dCode = padCode(d.code, 'district');
        const dItem = {
          id: d.id,
          code: dCode,
          rawCode: String(d.code),
          type: d.type || 'ស្រុក',
          nameKh: d.local,
          nameEn: d.english,
          provinceCode: p.code,
          communes: (d.communes || []).map(c => {
            const cCode = padCode(c.code, 'commune');
            const cItem = {
              id: c.id,
              code: cCode,
              rawCode: String(c.code),
              type: c.type || 'ឃុំ',
              nameKh: c.local,
              nameEn: c.english,
              districtCode: dCode,
              provinceCode: p.code,
              villages: (c.villages || []).map(v => {
                const vCode = padCode(v.code, 'village');
                const vItem = {
                  id: v.id,
                  code: vCode,
                  rawCode: String(v.code),
                  type: v.type || 'ភូមិ',
                  nameKh: v.local,
                  nameEn: v.english,
                  communeCode: cCode,
                  districtCode: dCode,
                  provinceCode: p.code,
                };
                locationIndex.set(vCode, { ...vItem, type: v.type, level: 'village' });
                return vItem;
              }),
            };
            locationIndex.set(cCode, { ...cItem, type: c.type, level: 'commune' });
            return cItem;
          }),
        };
        locationIndex.set(dCode, { ...dItem, type: d.type, level: 'district' });
        return dItem;
      });
      cachedProvinceDetails.set(p.code, districts);
      cachedProvinceDetails.set(p.id, districts);
    }
  }

  return cachedProvinces;
}

export function getProvinces() {
  return loadGazetteer();
}

export function getProvinceDetail(provinceIdOrCode) {
  loadGazetteer();
  const key = String(provinceIdOrCode).trim();
  const padded = padCode(key, 'province');
  return cachedProvinceDetails.get(padded) || cachedProvinceDetails.get(key) || null;
}

export function getLocationByCode(code) {
  loadGazetteer();
  if (!code) return null;
  const s = String(code).trim();
  return locationIndex.get(s) ||
    locationIndex.get(padCode(s, 'village')) ||
    locationIndex.get(padCode(s, 'commune')) ||
    locationIndex.get(padCode(s, 'district')) ||
    locationIndex.get(padCode(s, 'province')) || null;
}

/**
 * Validates that the selected address hierarchy is consistent.
 * If child codes are provided, their parent codes must match.
 */
export function validateAddressHierarchy({ provinceCode, districtCode, communeCode, villageCode }) {
  loadGazetteer();
  const pCode = provinceCode ? padCode(provinceCode, 'province') : '';
  const dCode = districtCode ? padCode(districtCode, 'district') : '';
  const cCode = communeCode ? padCode(communeCode, 'commune') : '';
  const vCode = villageCode ? padCode(villageCode, 'village') : '';

  if (vCode) {
    const vLoc = locationIndex.get(vCode);
    if (!vLoc || vLoc.level !== 'village') {
      return { valid: false, error: `Invalid village code: ${villageCode}` };
    }
    if (cCode && vLoc.communeCode !== cCode) {
      return { valid: false, error: `Village ${villageCode} does not belong to commune ${communeCode}` };
    }
    if (dCode && vLoc.districtCode !== dCode) {
      return { valid: false, error: `Village ${villageCode} does not belong to district ${districtCode}` };
    }
    if (pCode && vLoc.provinceCode !== pCode) {
      return { valid: false, error: `Village ${villageCode} does not belong to province ${provinceCode}` };
    }
  }

  if (cCode) {
    const cLoc = locationIndex.get(cCode);
    if (!cLoc || cLoc.level !== 'commune') {
      return { valid: false, error: `Invalid commune code: ${communeCode}` };
    }
    if (dCode && cLoc.districtCode !== dCode) {
      return { valid: false, error: `Commune ${communeCode} does not belong to district ${districtCode}` };
    }
    if (pCode && cLoc.provinceCode !== pCode) {
      return { valid: false, error: `Commune ${communeCode} does not belong to province ${provinceCode}` };
    }
  }

  if (dCode) {
    const dLoc = locationIndex.get(dCode);
    if (!dLoc || dLoc.level !== 'district') {
      return { valid: false, error: `Invalid district code: ${districtCode}` };
    }
    if (pCode && dLoc.provinceCode !== pCode) {
      return { valid: false, error: `District ${districtCode} does not belong to province ${provinceCode}` };
    }
  }

  if (pCode) {
    const pLoc = locationIndex.get(pCode);
    if (!pLoc || pLoc.level !== 'province') {
      return { valid: false, error: `Invalid province code: ${provinceCode}` };
    }
  }

  return { valid: true };
}
