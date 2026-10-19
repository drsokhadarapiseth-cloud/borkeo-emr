import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { projectRoot } from './config.mjs';
export function createDiagnosisSearch(file = path.join(projectRoot, 'data/icd10/catalogue.sqlite')) {
  let db;
  const open = () => db ||= new DatabaseSync(file, { readOnly: true });
  return {
    search(query = '', limit = 40) {
      const q = String(query || '').normalize('NFC').trim().slice(0, 100);
      const size = Math.max(1, Math.min(50, Number.parseInt(limit, 10) || 40));
      let rows;
      if (!q) rows = open().prepare('SELECT * FROM diagnoses ORDER BY code LIMIT ?').all(size);
      else if (/^[a-z]\d[\da-z.]*$/i.test(q)) {
        const prefix = q.toUpperCase();
        rows = open().prepare('SELECT * FROM diagnoses WHERE code >= ? AND code < ? ORDER BY code LIMIT ?').all(prefix, prefix + '\uffff', size);
      } else {
        const tokens = q.match(/[\p{L}\p{N}\p{M}]+/gu) || [];
        if (!tokens.length) return { items: [], limited: false };
        const expression = tokens.map(t => '"' + t + '"*').join(' AND ');
        rows = open().prepare(`SELECT d.* FROM diagnosis_search s JOIN diagnoses d ON d.id=s.rowid WHERE diagnosis_search MATCH ? ORDER BY rank LIMIT ?`).all(expression, size);
      }
      const items = rows.map(r => ({ id: r.id, code: r.code, en: r.en, kh: r.kh, fr: r.fr, selectable: /^[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?$/.test(r.code) }));
      return { items, limited: items.length === size };
    },
    close() { db?.close(); db = undefined; }
  };
}
