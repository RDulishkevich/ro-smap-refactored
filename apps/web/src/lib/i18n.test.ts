import { describe, expect, it } from 'vitest';
import { DICT, kindI18nKey, recordingsLabel, typeI18nKey, type I18nKey } from './i18n';

describe('i18n', () => {
  it('keeps ru and en keys in sync', () => {
    expect(Object.keys(DICT.en).sort()).toEqual(Object.keys(DICT.ru).sort());
  });

  it('never shows legacy brand names', () => {
    const dump = `${JSON.stringify(DICT.ru)} ${JSON.stringify(DICT.en)}`;
    expect(dump).not.toMatch(/RO·SMap|RO\.SMap|rosmap/i);
  });

  it('maps sound types and search kinds', () => {
    expect(typeI18nKey('water')).toBe('typeWater');
    expect(typeI18nKey('unknown')).toBe('typeOther');
    expect(kindI18nKey('sound')).toBe('kindSound');
    expect(kindI18nKey('post')).toBe('kindPost');
  });

  it('declines recording counts in Russian and English', () => {
    const ru = (k: I18nKey) => DICT.ru[k];
    const en = (k: I18nKey) => DICT.en[k];
    expect(recordingsLabel(1, ru, 'ru')).toBe(DICT.ru.recordingOne);
    expect(recordingsLabel(2, ru, 'ru')).toBe(DICT.ru.recordingFew);
    expect(recordingsLabel(5, ru, 'ru')).toBe(DICT.ru.recordingMany);
    expect(recordingsLabel(21, ru, 'ru')).toBe(DICT.ru.recordingOne);
    expect(recordingsLabel(1, en, 'en')).toBe(DICT.en.recordingOne);
    expect(recordingsLabel(2, en, 'en')).toBe(DICT.en.recordingMany);
  });
});
