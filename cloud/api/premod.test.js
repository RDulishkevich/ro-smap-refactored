import { describe, expect, it } from 'vitest';
import { flagFor, inspectTexts, scanProfanity } from './premod.js';

describe('scanProfanity', () => {
  it('flags spoken and typed Russian profanity', () => {
    const hit = scanProfanity('слышь блять отойди');
    expect(hit.profanity).toBe(true);
    expect(hit.hits.some((h) => h.startsWith('бля'))).toBe(true);
  });

  it('does not flag botanical стебля', () => {
    expect(scanProfanity('шелест стебля камыша у реки')).toEqual({ profanity: false, hits: [] });
  });

  it('flags English stems', () => {
    expect(scanProfanity('what the fuck was that').profanity).toBe(true);
  });

  it('still flags prefixed Russian swears', () => {
    expect(scanProfanity('пошёл нахуй отсюда').profanity).toBe(true);
  });
});

describe('inspectTexts', () => {
  it('keeps a short swear even when speech is not a useful UCS note', () => {
    const r = inspectTexts({ transcript: 'блять сука' });
    expect(r.speech).toBe(false);
    expect(r.profanity).toBe(true);
    expect(r.transcript).toContain('блять');
  });

  it('scans title and description without audio', () => {
    const r = inspectTexts({ title: 'Утро', description: 'пиздец как громко' });
    expect(r.profanity).toBe(true);
    expect(r.transcript).toBe('');
  });

  it('marks useful clean speech', () => {
    const r = inspectTexts({ transcript: 'Запись у реки Дон, слышны камыши и лягушки' });
    expect(r.speech).toBe(true);
    expect(r.profanity).toBe(false);
    expect(r.transcript.length).toBeGreaterThan(12);
  });
});

describe('flagFor', () => {
  it('prefers profanity over skip', () => {
    expect(flagFor({ profanity: true, speech: false }, true)).toBe('profanity');
  });

  it('returns skip when STT did not run and text is clean', () => {
    expect(flagFor({ profanity: false, speech: false }, true)).toBe('skip');
  });

  it('returns speech when there is a transcript without hits', () => {
    expect(flagFor({ profanity: false, speech: true }, false)).toBe('speech');
  });
});
