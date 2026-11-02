import { describe, expect, it } from 'vitest';
import { buildUcsFileName, parseUcsFileName, sanitizeFxName } from './catalogs';
import { firstTranslatedText } from './api';

describe('sanitizeFxName', () => {
  it('keeps a complete Title Case phrase with spaces, not underscores', () => {
    expect(sanitizeFxName('Rostov_Market_Day_Crowd')).toBe('Rostov Market Day Crowd');
    expect(sanitizeFxName('forest dawn birds near river')).toBe('Forest Dawn Birds Near River');
  });

  it('truncates on a word boundary instead of mid-word', () => {
    const long = 'Morning Market Crowd Voices Distant Tram Near The Fountain Square';
    const out = sanitizeFxName(long, 40);
    expect(out.includes('_')).toBe(false);
    expect(out.length).toBeLessThanOrEqual(40);
    expect(out.endsWith(' ')).toBe(false);
    expect(out).toBe('Morning Market Crowd Voices Distant');
  });
});

describe('buildUcsFileName', () => {
  it('puts the whole FXName in one underscore block', () => {
    const name = buildUcsFileName({
      catId: 'AMBCity',
      fxName: 'Rostov Market Day Crowd',
      creatorId: 'romaflay',
      sourceId: 'Don2026',
      principle: 'стерео XY',
      location: 'Ростов',
    });
    expect(name).toBe('AMBCity_Rostov Market Day Crowd_romaflay_Don2026_XY-Rostov.wav');
  });
});

describe('parseUcsFileName', () => {
  it('reads a UCS name with spaces in FXName', () => {
    const parsed = parseUcsFileName('AMBCity_Rostov Market Day Crowd_romaflay_Don2026_XY-Rostov.wav');
    expect(parsed?.catId).toBe('AMBCity');
    expect(parsed?.fxName).toBe('Rostov Market Day Crowd');
    expect(parsed?.creatorId).toBe('romaflay');
    expect(parsed?.sourceId).toBe('Don2026');
    expect(parsed?.userData).toBe('XY-Rostov');
  });

  it('rebuilds a legacy underscored FXName into one phrase', () => {
    const parsed = parseUcsFileName('AMBCity_Rostov_Market_Day_Crowd_romaflay_Don2026_XY-Rostov.wav');
    expect(parsed?.fxName).toBe('Rostov Market Day Crowd');
    expect(parsed?.creatorId).toBe('romaflay');
    expect(parsed?.sourceId).toBe('Don2026');
  });
});

describe('firstTranslatedText', () => {
  it('reads the Secure API string array', () => {
    expect(firstTranslatedText({ translations: ['Morning forest by the river'] })).toBe('Morning forest by the river');
  });

  it('reads a Yandex-shaped item', () => {
    expect(firstTranslatedText({ translations: [{ text: 'Morning forest' }] })).toBe('Morning forest');
  });
});
