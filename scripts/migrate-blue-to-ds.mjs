/**
 * Phase 3: replace legacy Tailwind blue CTAs with ds-btn / token utilities.
 * Run: node scripts/migrate-blue-to-ds.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const files = [
  'index.html',
  'src/core/auth.js',
  'src/ui/ui.js',
  'src/core/events.js',
  'src/core/admin-console.js',
];

function migrate(text) {
  let t = text;
  let n = 0;
  const sub = (re, to) => {
    const before = t;
    t = t.replace(re, to);
    if (t !== before) n += (before.length - t.length > 0 || before !== t) ? 1 : 0;
  };

  // Primary filled buttons — common stacks
  const buttonStacks = [
    /bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-\[0\.98\]/g,
    /bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95/g,
    /bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md/g,
    /bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm/g,
    /bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors/g,
    /bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold/g,
    /bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm/g,
    /bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors/g,
    /bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm/g,
    /bg-blue-600 hover:bg-blue-700 text-sm font-semibold transition-colors/g,
    /bg-blue-600 hover:bg-blue-700 text-white px-5 py-2\.5 rounded-xl text-sm font-bold transition-all shadow-md active:scale-95/g,
    /bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors shadow-md/g,
    /rounded-xl text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-md transition-colors/g,
    /min-w-\[2\.75rem\] h-11 px-3\.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shrink-0/g,
    /px-5 py-2\.5 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-md/g,
    /px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors shadow-sm/g,
    /px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm/g,
    /px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-sm font-semibold transition-colors/g,
    /w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm/g,
    /w-full py-3\.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95/g,
    /w-full py-3\.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-\[0\.98\]/g,
    /flex-1 py-3\.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-\[0\.98\]/g,
    /flex-1 py-3\.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all shadow-md active:scale-95/g,
    /flex-1 py-2\.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors/g,
    /flex-1 py-2\.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold/g,
    /flex-1 flex items-center justify-center gap-2 py-2\.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm text-sm/g,
    /w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold transition-colors shadow-sm/g,
    /mt-3 w-full py-2\.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm/g,
    /mt-3 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm/g,
    /shrink-0 px-3 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors shadow-sm whitespace-nowrap/g,
  ];

  for (const re of buttonStacks) {
    t = t.replace(re, 'ds-btn ds-btn--primary');
  }

  // Leftover bare blue fills on buttons
  t = t.replace(/\bbg-blue-600 hover:bg-blue-700\b/g, 'ds-btn ds-btn--primary');
  t = t.replace(/\bbg-blue-600\b/g, 'ds-btn ds-btn--primary');

  // Soft fills
  t = t.replace(/\bbg-blue-50 dark:bg-blue-900\/30\b/g, 'ds-soft-fill');
  t = t.replace(/\bbg-blue-50 dark:bg-blue-900\/20\b/g, 'ds-soft-fill');
  t = t.replace(/\bbg-blue-50\b/g, 'ds-soft-fill');
  t = t.replace(/\bbg-blue-100\b/g, 'ds-soft-fill');
  t = t.replace(/\bhover:bg-blue-50 dark:hover:bg-blue-900\/30\b/g, 'hover:ds-soft-fill');
  t = t.replace(/\bhover:bg-blue-100\b/g, 'hover:opacity-90');
  t = t.replace(/\bhover:bg-blue-50\b/g, 'hover:opacity-90');

  // Links / accent text
  t = t.replace(/\btext-blue-600 dark:text-blue-400\b/g, 'ds-link');
  t = t.replace(/\btext-blue-600 dark:text-blue-300\b/g, 'ds-link');
  t = t.replace(/\btext-blue-600\b/g, 'ds-link');
  t = t.replace(/\btext-blue-500\b/g, 'ds-link');
  t = t.replace(/\btext-blue-400\b/g, 'ds-link');
  t = t.replace(/\bdark:text-blue-400\b/g, '');
  t = t.replace(/\bdark:hover:text-blue-400\b/g, '');
  t = t.replace(/\bhover:text-blue-600\b/g, 'hover:opacity-80');
  t = t.replace(/\bhover:text-blue-500\b/g, 'hover:opacity-80');
  t = t.replace(/\bhover:text-blue-400\b/g, 'hover:opacity-80');

  // Indigo leftovers
  t = t.replace(/\btext-indigo-600 dark:text-indigo-400\b/g, 'ds-link');
  t = t.replace(/\btext-indigo-500 hover:text-indigo-400\b/g, 'ds-link');
  t = t.replace(/\btext-indigo-600\b/g, 'ds-link');
  t = t.replace(/\btext-indigo-500\b/g, 'ds-link');
  t = t.replace(/\btext-indigo-400\b/g, 'ds-link');
  t = t.replace(/\bdark:text-indigo-400\b/g, '');

  // Auth / tab active borders
  t = t.replace(/text-blue-600 border-b-2 border-blue-600/g, 'ds-link border-b-2 border-[color:var(--accent)]');
  t = t.replace(/border-b-2 border-blue-600/g, 'border-b-2 border-[color:var(--accent)]');
  t = t.replace(/border-l-4 border-blue-500/g, 'border-l-4 border-[color:var(--accent)]');
  t = t.replace(/border-blue-600/g, 'border-[color:var(--accent)]');

  // Clean double spaces in class attrs
  t = t.replace(/class="([^"]*)"/g, (_, c) => `class="${c.replace(/\s+/g, ' ').trim()}"`);

  return { text: t, changed: t !== text };
}

for (const rel of files) {
  const p = path.join(root, rel);
  if (!fs.existsSync(p)) continue;
  const src = fs.readFileSync(p, 'utf8');
  const { text, changed } = migrate(src);
  if (changed) {
    fs.writeFileSync(p, text);
    const left = (text.match(/bg-blue-|text-blue-|text-indigo-|hover:bg-blue/g) || []).length;
    console.log(`updated ${rel} (remaining blue/indigo hits: ${left})`);
  } else {
    console.log(`skip ${rel}`);
  }
}
