/**
 * Compact UCS 8.2.1 index for the Cloud Function.
 * Usage (repo root): node cloud/ops/build-ucs-index.mjs
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ucsByCatId, ucsCategories, ucsStructure } from '../../src/data/ucsCatalog.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const byId = {};
const byCategory = {};

for (const cat of ucsCategories) {
  const rows = ucsStructure[cat] || [];
  byCategory[cat] = rows.map((r) => r.id);
  for (const r of rows) {
    const meta = ucsByCatId[r.id] || {};
    const ru = String(r.name || '').replace(/^[A-Za-z0-9]+\s*\(/, '').replace(/\)$/, '').trim();
    byId[r.id] = {
      category: meta.category || cat,
      sub: meta.subCategory || '',
      ru,
    };
  }
}

const payload = { categories: ucsCategories, byId, byCategory };
const out = `/** Compact UCS 8.2.1 index. Regenerated from src/data/ucsCatalog.js via cloud/ops/build-ucs-index.mjs */\nmodule.exports = ${JSON.stringify(payload)};\n`;
const dest = join(root, 'api', 'ucsIndex.js');
writeFileSync(dest, out);
process.stdout.write(`wrote ${dest} (${Object.keys(byId).length} CatIDs)\n`);
