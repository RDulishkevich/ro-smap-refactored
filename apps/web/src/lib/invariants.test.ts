import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../../..');
const webSrc = path.resolve(root, 'apps/web/src');

function read(rel: string) {
  return readFileSync(path.resolve(root, rel), 'utf8');
}

function walkTsx(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (name === 'test' || name === 'brand') continue;
      walkTsx(full, acc);
    } else if (/\.(tsx|ts)$/.test(name) && !name.includes('.test.')) acc.push(full);
  }
  return acc;
}

describe('production invariants', () => {
  it('never uses native alert/confirm/prompt in the React app', () => {
    const hits: string[] = [];
    for (const file of walkTsx(webSrc)) {
      const text = readFileSync(file, 'utf8');
      if (/\bwindow\.(alert|confirm|prompt)\s*\(/.test(text)) hits.push(file);
    }
    expect(hits).toEqual([]);
  });

  it('does not set emailVerified in the React client', () => {
    const dump = walkTsx(webSrc).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(dump).not.toMatch(/emailVerified\s*:\s*true/);
  });

  it('does not use innerHTML for UGC', () => {
    const dump = walkTsx(webSrc).map((f) => readFileSync(f, 'utf8')).join('\n');
    expect(dump).not.toMatch(/dangerouslySetInnerHTML/);
    expect(dump).not.toMatch(/\.innerHTML\s*=/);
  });
});

describe('closed audit gaps', () => {
  it('Vite shell has a CSP meta', () => {
    expect(read('apps/web/index.html')).toMatch(/Content-Security-Policy/);
  });

  it('App root wires MotionConfig to reduceMotion', () => {
    expect(read('apps/web/src/App.tsx')).toMatch(/MotionConfig/);
    expect(read('apps/web/src/App.tsx')).toMatch(/reducedMotion=\{prefs\.reduceMotion/);
  });

  it('event RSVP writes the server participants field', () => {
    const stack = read('apps/web/src/screens/stack.tsx');
    expect(stack).toMatch(/participants:\s*\[\.\.\.participants/);
    expect(stack).not.toMatch(/attendees:\s*\[\.\.\.attendees/);
  });

  it('Guessr maps the same catalog it picks from', () => {
    const stack = read('apps/web/src/screens/stack.tsx');
    expect(stack).not.toMatch(/sounds\.slice\(0,\s*12\)/);
    expect(stack).toMatch(/SoundMap sounds=\{sounds\}/);
  });

  it('RU menu labels the game in Russian', () => {
    const i18n = read('apps/web/src/lib/i18n.ts');
    expect(i18n).toMatch(/guessr: 'Угадайка'/);
    expect(i18n).not.toMatch(/guessr: 'Audio Guesser'/);
  });
});
