import fs from 'node:fs';

// v42.3: Cambodia Essential Medicines List, 10th edition (2023-2024), 704 items.
// Read once and served to logged-in staff; the browser searches it locally.
let cached = null;

export function medicineCatalogue() {
  if (!cached) {
    const items = JSON.parse(fs.readFileSync(new URL('./catalogues/medicines-eml-2024.json', import.meta.url), 'utf8'));
    cached = Object.freeze({ source: 'Cambodia Essential Medicines List, 10th edition (2023-2024)', count: items.length, items });
  }
  return cached;
}
