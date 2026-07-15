import test from 'node:test';
import assert from 'node:assert/strict';

import { rawSoundsData, formatSoundObject } from '../src/data/sounds.js';

function createState() {
  return rawSoundsData.map(formatSoundObject);
}

test('filtering keeps matching sounds and ignores empty query', () => {
  const sounds = createState();
  const query = '';
  const activeEcoLayer = new Set(['anthrophony']);

  const filtered = sounds.filter(sound => {
    const searchTarget = `${sound.title} ${sound.description} ${sound.keywords} ${sound.ecoCategory} ${sound.ucsCat} ${sound.typeTag} ${sound.recPrinciple} ${sound.gear} ${sound.micType} ${sound.recordist} ${sound.weather} ${sound.date} ${sound.license} ${sound.channels}`.toLowerCase();
    const searchMatch = !query || searchTarget.includes(query);
    const ecoMatch = activeEcoLayer.size === 0 || activeEcoLayer.has(sound.ecoCategory);
    return searchMatch && ecoMatch;
  });

  assert.ok(filtered.length > 0);
  assert.ok(filtered.every(sound => sound.ecoCategory === 'anthrophony'));
});
