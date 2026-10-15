import { describe, expect, it } from 'vitest';
import { soundTagLines } from './sound-tags';
import type { Sound } from '@polevka/core';

describe('soundTagLines', () => {
  it('uses UCS category as the primary tag and fx as secondary', () => {
    const sound = {
      id: '1',
      title: 'Whoosh Motion',
      type: 'urban',
      ucsCat: 'SWOOSHES',
      ucsCatId: 'WHSH',
      fxName: 'Whoosh Motion',
      tagArray: ['Motion'],
    } as Sound;
    const lines = soundTagLines(sound, 'Город');
    expect(lines.primary).toMatch(/Swooshes/i);
    expect(lines.secondary).toMatch(/Motion/);
  });

  it('falls back to the type label', () => {
    const sound = { id: '2', title: 'Ручей' } as Sound;
    expect(soundTagLines(sound, 'Вода').primary).toBe('Вода');
  });
});
