import { describe, expect, it } from 'vitest';
import { mapCatId } from './ucsMap.js';
import {
  heuristicSuggest,
  isUsefulTranscript,
  lookup,
  normalizeAlternatives,
  normalizeSuggestion,
} from './ucsSuggest.js';

describe('ucsMap', () => {
  it('maps forest ambience to forest / biophony', () => {
    expect(mapCatId('AMBForst', 'AMBIENCE')).toEqual({ kind: 'forest', eco: 'biophony' });
  });

  it('maps water flow from the WATER category', () => {
    expect(mapCatId('WATRFlow', 'WATER')).toEqual({ kind: 'water', eco: 'geophony' });
  });

  it('maps vehicles to urban / anthrophony', () => {
    expect(mapCatId('VEHCar', 'VEHICLES')).toEqual({ kind: 'urban', eco: 'anthrophony' });
  });

  it('maps birds CatIDs to birds / biophony', () => {
    expect(mapCatId('BIRDSong', 'BIRDS')).toEqual({ kind: 'birds', eco: 'biophony' });
  });
});

describe('ucsSuggest normalize', () => {
  it('rejects invented CatIDs', () => {
    expect(normalizeSuggestion({ catId: 'FAKE999', fxName: 'Nope' }, 'groq')).toBeNull();
  });

  it('fills kind and eco from the map, not the model', () => {
    const s = normalizeSuggestion({
      catId: 'AMBForst',
      fxName: 'Forest Dawn',
      kind: 'urban',
      ecoCategory: 'anthrophony',
      title: 'Утро в лесу',
      rationale: 'лес',
    }, 'groq');
    expect(s?.catId).toBe('AMBForst');
    expect(s?.category).toBe('AMBIENCE');
    expect(s?.kind).toBe('forest');
    expect(s?.ecoCategory).toBe('biophony');
    expect(s?.fxName).toBe('Forest Dawn');
  });

  it('keeps two unique alternative CatIDs', () => {
    const alts = normalizeAlternatives(
      ['AMBBird', 'AMBForst', 'VEGELeaf', 'NOPE'],
      'AMBForst',
      'groq',
    );
    expect(alts.map((a) => a.catId)).toEqual(['AMBBird', 'VEGELeaf']);
    expect(alts[0].kind).toBe('birds');
  });
});

describe('ucsSuggest heuristics', () => {
  it('picks rain from keywords', () => {
    const s = heuristicSuggest('Сильный дождь по крыше');
    expect(s?.catId).toBe('RAIN');
    expect(s?.kind).toBe('water');
  });

  it('picks a train CatID from keywords', () => {
    const s = heuristicSuggest('Электричка проходит мимо платформы');
    expect(s?.catId).toMatch(/^TRN/);
    expect(s?.kind).toBe('urban');
  });

  it('falls back to AMBMisc', () => {
    const s = heuristicSuggest('xyz');
    expect(s?.catId).toBe('AMBMisc');
  });
});

describe('isUsefulTranscript', () => {
  it('drops empty and hallucinated speech', () => {
    expect(isUsefulTranscript('')).toBe(false);
    expect(isUsefulTranscript('музыка')).toBe(false);
    expect(isUsefulTranscript('продолжение следует')).toBe(false);
    expect(isUsefulTranscript('la la la la la la')).toBe(false);
  });

  it('keeps a real spoken note', () => {
    expect(isUsefulTranscript('Запись у реки Дон, слышны камыши и лягушки')).toBe(true);
  });
});

describe('ucsIndex', () => {
  it('has the official UCS 8.2.1 CatID count', () => {
    expect(lookup('AMBForst')?.category).toBe('AMBIENCE');
    expect(lookup('WATRFlow')?.category).toBe('WATER');
  });
});
