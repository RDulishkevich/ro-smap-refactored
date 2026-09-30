import fs from 'node:fs';

const files = [
  'g:/Мой диплом/App/index.html',
  'g:/Мой диплом/App/src/core/auth.js',
];

for (const f of files) {
  let t = fs.readFileSync(f, 'utf8');
  t = t
    .replace(/hover:ds-soft-fill/g, '')
    .replace(/hover:ds-link/g, '')
    .replace(/dark:hover:bg-blue-900\/50/g, '')
    .replace(/dark:hover:bg-blue-900\/30/g, '')
    .replace(/dark:bg-blue-900\/40/g, '')
    .replace(/dark:bg-blue-900\/30/g, '')
    .replace(/text-blue-700 dark:text-blue-300/g, 'ds-link')
    .replace(/text-blue-700/g, 'ds-link')
    .replace(/dark:hover:text-blue-200/g, '')
    .replace(/border-blue-100 dark:border-blue-900\/40/g, 'border-[color:var(--panel-border)]')
    .replace(/hover:bg-blue-700/g, '')
    .replace(/\bbg-blue-500\b/g, 'bg-[color:var(--accent)]')
    .replace(/class="([^"]*)"/g, (_, c) => `class="${c.replace(/\s+/g, ' ').trim()}"`);
  fs.writeFileSync(f, t);
  const left = (t.match(/blue-|indigo-/g) || []).length;
  console.log(f, 'remaining', left);
}
