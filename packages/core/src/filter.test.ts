import { describe, expect, it } from 'vitest';
import { EMPTY_FILTER, filterSounds, soundMatchesFilter } from './filter';
import type { Sound } from './types';

const sound = (over: Partial<Sound> = {}): Sound => ({
  id: '1',
  title: 'Река Дон',
  location: 'Ростов-на-Дону',
  type: 'water',
  ecoCategory: 'geophony',
  ucsCat: 'WATER',
  tagArray: ['река'],
  ...over,
});

describe('filterSounds', () => {
  it('ignores empty filter except deleted rows', () => {
    const list = [sound(), sound({ id: '2', deleted: true, title: 'gone' })];
    expect(filterSounds(list, EMPTY_FILTER).map((s) => s.id)).toEqual(['1']);
  });

  it('matches query, eco and type', () => {
    const river = sound();
    const city = sound({
      id: '2',
      title: 'Улица',
      location: 'Москва',
      type: 'urban',
      ecoCategory: 'anthrophony',
      ucsCat: 'AMBIENCE',
      tagArray: ['город'],
    });
    expect(soundMatchesFilter(river, { ...EMPTY_FILTER, q: 'дон' })).toBe(true);
    expect(soundMatchesFilter(city, { ...EMPTY_FILTER, q: 'дон' })).toBe(false);
    expect(filterSounds([river, city], { ...EMPTY_FILTER, eco: 'anthrophony' })).toEqual([city]);
    expect(filterSounds([river, city], { ...EMPTY_FILTER, type: 'water' })).toEqual([river]);
  });
});
