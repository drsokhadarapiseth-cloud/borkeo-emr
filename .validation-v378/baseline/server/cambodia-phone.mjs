export const NINE_DIGIT_PREFIXES = new Set([
  '010', '011', '012', '014', '015', '016', '017',
  '060', '061', '066', '067', '068', '069',
  '070', '077', '078',
  '081', '085', '086', '087', '089',
  '090', '092', '093', '095', '098', '099'
]);

export const TEN_DIGIT_PREFIXES = new Set([
  '018', '031', '071', '076', '088', '096', '097'
]);

export const KHMER_DIGITS = '០១២៣៤៥៦៧៨៩';

export function normalizeKhmerDigits(str) {
  return String(str || '').replace(/[០-៩]/g, ch => KHMER_DIGITS.indexOf(ch));
}

export function validateCambodianPhone(rawInput, lang = 'km') {
  const isEn = lang === 'en';
  if (rawInput === null || rawInput === undefined) {
    return { valid: true, normalized: '', raw: '' };
  }
  const str = String(rawInput).trim();
  if (str === '') {
    return { valid: true, normalized: '', raw: '' };
  }

  // 1. Convert Khmer digits ០-៩ to English digits 0-9
  let normalized = normalizeKhmerDigits(str);

  // 2. Reject letters or other foreign alphabetic characters
  if (/[a-zA-Z]/.test(normalized)) {
    return {
      valid: false,
      normalized: '',
      raw: str,
      error: isEn
        ? 'Phone number cannot contain letters or invalid symbols.'
        : 'លេខទូរសព្ទមិនអាចមានអក្សរ ឬនិមិត្តសញ្ញាឡើយ'
    };
  }

  // 3. Allow spaces and hyphens as formatting; remove them before validation
  normalized = normalized.replace(/[\s\-]/g, '');

  // 4. Handle international format starting with '+'
  if (normalized.startsWith('+')) {
    if (normalized.startsWith('+8550')) {
      return {
        valid: false,
        normalized: '',
        raw: str,
        error: isEn
          ? 'Incorrect international format (+855 must not be followed by 0).'
          : 'ទម្រង់អន្តរជាតិមិនត្រឹមត្រូវ (មិនត្រូវមានលេខ 0 បន្ទាប់ពី +855 ឡើយ)'
      };
    }
    if (!normalized.startsWith('+855')) {
      return {
        valid: false,
        normalized: '',
        raw: str,
        error: isEn
          ? 'Only Cambodia phone numbers (+855) are supported.'
          : 'ប្រព័ន្ធគាំទ្រតែលេខទូរសព្ទកម្ពុជា (+855) ប៉ុណ្ណោះ'
      };
    }
    // Convert +855 to domestic leading 0
    normalized = '0' + normalized.slice(4);
  }

  // 5. Reject any remaining non-digit symbols
  if (/\D/.test(normalized)) {
    return {
      valid: false,
      normalized: '',
      raw: str,
      error: isEn
        ? 'Phone number cannot contain letters or invalid symbols.'
        : 'លេខទូរសព្ទមិនអាចមានអក្សរ ឬនិមិត្តសញ្ញាឡើយ'
    };
  }

  // 6. Must start with leading 0
  if (!normalized.startsWith('0')) {
    return {
      valid: false,
      normalized: '',
      raw: str,
      error: isEn
        ? 'Phone number must start with 0 or +855.'
        : 'លេខទូរសព្ទត្រូវតែចាប់ផ្តើមដោយលេខ 0 ឬ +855'
    };
  }

  // 7. Check prefix
  if (normalized.length < 3) {
    return {
      valid: false,
      normalized: '',
      raw: str,
      error: isEn
        ? 'Phone number is too short.'
        : 'លេខទូរសព្ទខ្លីពេក'
    };
  }

  const prefix = normalized.slice(0, 3);
  let expectedTotal = 0;
  let expectedAfter = 0;

  if (NINE_DIGIT_PREFIXES.has(prefix)) {
    expectedTotal = 9;
    expectedAfter = 6;
  } else if (TEN_DIGIT_PREFIXES.has(prefix)) {
    expectedTotal = 10;
    expectedAfter = 7;
  } else {
    return {
      valid: false,
      normalized: '',
      raw: str,
      error: isEn
        ? 'Unsupported or invalid mobile prefix.'
        : 'លេខកូដដើមមិនត្រឹមត្រូវ ឬមិនគាំទ្រ'
    };
  }

  // 8. Check total length
  if (normalized.length !== expectedTotal) {
    return {
      valid: false,
      normalized: '',
      raw: str,
      error: isEn
        ? `Prefix ${prefix} requires ${expectedAfter} digits after it — ${expectedTotal} digits total.`
        : `លេខកូដ ${prefix} ត្រូវការ ${expectedAfter} ខ្ទង់បន្ទាប់ — សរុប ${expectedTotal} ខ្ទង់`
    };
  }

  return {
    valid: true,
    normalized,
    raw: str
  };
}
