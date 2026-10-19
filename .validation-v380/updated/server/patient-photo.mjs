// Photo data URLs have their own bounded limit; ordinary record text stays bounded.
export const MAX_PATIENT_PHOTO_CHARS = 512_000;
export const PATIENT_PHOTO_FIELDS = new Set([
  'scope:registration:id:web_patient_photo',
  'scope:registration:id:patient_photo',
  'system:patientPhoto',
]);
export function validPatientPhoto(value) {
  if (value === '') return true; // Explicit photo removal.
  if (typeof value !== 'string' || value.length > MAX_PATIENT_PHOTO_CHARS) return false;
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  const bytes = Buffer.from(match[2], 'base64');
  if (bytes.toString('base64') !== match[2]) return false;
  if (match[1] === 'jpeg') return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (match[1] === 'png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  return bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP';
}
