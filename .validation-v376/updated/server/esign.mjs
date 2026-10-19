import zlib from 'node:zlib';
import { DEFAULT_ROLE_LABELS } from './access.mjs';

const MAX_SIGNATURE_DATA_URL = 140_000;

function createCrcTable() {
  const cTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    cTable[n] = c;
  }
  return cTable;
}
const CRC_TABLE = createCrcTable();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);
  const crcBuf = Buffer.alloc(4);
  const toCrc = Buffer.concat([typeBuf, data]);
  crcBuf.writeUInt32BE(crc32(toCrc), 0);
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

export function generateSimulatedSignaturePng(signerName = '', role = '') {
  const width = 240;
  const height = 70;
  const raw = Buffer.alloc(height * (1 + width * 4), 0);
  
  const inkR = 15, inkG = 76, inkB = 129;
  const setPixel = (x, y, alpha = 255) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const offset = y * (1 + width * 4) + 1 + x * 4;
    raw[offset] = inkR;
    raw[offset + 1] = inkG;
    raw[offset + 2] = inkB;
    raw[offset + 3] = Math.max(raw[offset + 3], alpha);
  };

  const drawThickLine = (x0, y0, x1, y1) => {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    if (steps === 0) {
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          setPixel(x0 + ox, y0 + oy, (ox === 0 && oy === 0) ? 255 : 180);
        }
      }
      return;
    }
    for (let i = 0; i <= steps; i++) {
      const cx = Math.round(x0 + (x1 - x0) * (i / steps));
      const cy = Math.round(y0 + (y1 - y0) * (i / steps));
      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          setPixel(cx + ox, cy + oy, (ox === 0 && oy === 0) ? 255 : 180);
        }
      }
    }
  };

  const seed = (String(signerName || '').length + String(role || '').length) % 15;
  const startY = 35 + (seed % 5);
  drawThickLine(20, startY, 45, 18);
  drawThickLine(45, 18, 55, 45);
  drawThickLine(55, 45, 80, 22);
  drawThickLine(80, 22, 100, 38);
  drawThickLine(100, 38, 130, 24);
  drawThickLine(130, 24, 150, 42);
  drawThickLine(150, 42, 185, 28);
  drawThickLine(185, 28, 220, 36);
  drawThickLine(15, 52, 225, 50);

  const compressed = zlib.deflateSync(raw);
  const header = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = pngChunk('IHDR', ihdrData);
  const idat = pngChunk('IDAT', compressed);
  const iend = pngChunk('IEND', Buffer.alloc(0));

  return `data:image/png;base64,${Buffer.concat([header, ihdr, idat, iend]).toString('base64')}`;
}

export function defaultSimulatedSignatureDataUrl(signerName = '', role = '') {
  return generateSimulatedSignaturePng(signerName, role);
}

export function ensureESignSchema(database) {
  database.sqlite.exec(`
    CREATE TABLE IF NOT EXISTS user_esignatures (
      user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      signer_name TEXT NOT NULL DEFAULT '',
      signature_png TEXT NOT NULL DEFAULT '',
      created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE INDEX IF NOT EXISTS user_esignatures_updated_idx
      ON user_esignatures(updated_at DESC);
  `);
}

function cleanSignerName(value) {
  const name = String(value || '').trim();
  if (!name || name.length > 120 || /[\u0000-\u001f\u007f]/.test(name)) {
    throw new Error('Signer name is invalid.');
  }
  return name;
}

function cleanSignatureDataUrl(value) {
  const dataUrl = String(value || '').trim();
  if (!dataUrl) return '';
  if (dataUrl.length > MAX_SIGNATURE_DATA_URL || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(dataUrl)) {
    throw new Error('Electronic signature image is invalid or too large.');
  }
  let bytes;
  try { bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64'); }
  catch { throw new Error('Electronic signature image is invalid.'); }
  if (bytes.length < 8 || bytes[0] !== 0x89 || bytes[1] !== 0x50 || bytes[2] !== 0x4e || bytes[3] !== 0x47) {
    throw new Error('Electronic signature must be a PNG image.');
  }
  return dataUrl;
}

export function listESignatures(database) {
  return database.sqlite.prepare(`
    SELECT u.id AS user_id, u.username, u.display_name,
      COALESCE(e.signer_name, '') AS signer_name,
      COALESCE(e.signature_png, '') AS signature_png,
      e.updated_at AS signature_updated_at
    FROM users u
    LEFT JOIN user_esignatures e ON e.user_id=u.id
    ORDER BY u.display_name COLLATE NOCASE, u.username COLLATE NOCASE
  `).all().map(row => ({
    userId: row.user_id,
    username: row.username,
    displayName: row.display_name,
    signerName: row.signer_name,
    signatureDataUrl: row.signature_png,
    updatedAt: row.signature_updated_at || null,
    hasSignature: Boolean(row.signature_png),
  }));
}

export function getESignature(database, userId) {
  if (!database || !userId) return null;
  ensureESignSchema(database);
  const row = database.sqlite.prepare(`SELECT user_id, signer_name, signature_png, updated_at
    FROM user_esignatures WHERE user_id=?`).get(userId);
  if (!row) return null;
  return {
    userId: row.user_id,
    signerName: row.signer_name,
    signatureDataUrl: row.signature_png,
    updatedAt: row.updated_at,
    hasSignature: Boolean(row.signature_png),
  };
}

export function setESignature(database, userId, values, actorUserId, now = Date.now()) {
  if (!database || !userId) return null;
  ensureESignSchema(database);
  const user = database.sqlite.prepare('SELECT id, username, display_name, role FROM users WHERE id=?').get(userId);
  if (!user) return null;
  const signerName = cleanSignerName(values?.signerName || user.display_name);
  const signatureDataUrl = cleanSignatureDataUrl(values?.signatureDataUrl || defaultSimulatedSignatureDataUrl(signerName, user.role));
  database.sqlite.prepare(`
    INSERT INTO user_esignatures
      (user_id, signer_name, signature_png, created_by, updated_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      signer_name=excluded.signer_name,
      signature_png=excluded.signature_png,
      updated_by=excluded.updated_by,
      updated_at=excluded.updated_at
  `).run(userId, signerName, signatureDataUrl, actorUserId, actorUserId, now, now);
  return {
    userId,
    username: user.username,
    displayName: user.display_name,
    signerName,
    signatureDataUrl,
    updatedAt: now,
    hasSignature: Boolean(signatureDataUrl),
  };
}

export function signatureSnapshot(databaseOrUser, sessionOrSignedAt, maybeSignedAt) {
  let db = null;
  let user = {};
  let signedAt = Date.now();

  if (databaseOrUser && typeof databaseOrUser.sqlite === 'object') {
    db = databaseOrUser;
    user = sessionOrSignedAt || {};
    if (typeof maybeSignedAt === 'number') signedAt = maybeSignedAt;
  } else if (sessionOrSignedAt && typeof sessionOrSignedAt === 'object') {
    user = sessionOrSignedAt;
    if (typeof maybeSignedAt === 'number') signedAt = maybeSignedAt;
  } else {
    user = databaseOrUser || {};
    if (typeof sessionOrSignedAt === 'number') signedAt = sessionOrSignedAt;
  }

  const role = String(user.active_role || user.role || '').toUpperCase();
  const roleKhmer = DEFAULT_ROLE_LABELS[role] || role;
  const userId = user.user_id || user.id || '';
  const signature = (db && userId) ? getESignature(db, userId) : null;
  const rawSignerName = signature?.signerName || String(user.signer_name || user.signerName || user.display_name || user.displayName || user.username || '');
  const signerName = rawSignerName;
  const rawSignature = signature?.signatureDataUrl || user.signature_data_url || user.signatureDataUrl;
  const signatureDataUrl = rawSignature || defaultSimulatedSignatureDataUrl(signerName || user.username || '', role);
  return {
    userId,
    username: String(user.username || ''),
    displayName: String(user.display_name || user.displayName || ''),
    signerName,
    signedName: signerName,
    signatureDataUrl,
    role,
    wardCode: String(user.active_ward_code || user.wardCode || '').toLowerCase(),
    signedAt,
    signatureConfiguredAt: signature?.updatedAt || signedAt,
  };
}
