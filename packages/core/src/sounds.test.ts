import { describe, expect, it } from 'vitest';
import { formatSound, normalizePeaks } from './sounds';

describe('normalizePeaks', () => {
  it('keeps compact 0–1 bars', () => {
    const peaks = Array.from({ length: 16 }, (_, i) => i / 15);
    expect(normalizePeaks(peaks)).toEqual(peaks.map((n) => Math.round(n * 1000) / 1000));
  });

  it('drops junk and oversized payloads', () => {
    expect(normalizePeaks([1, 2, 'x'])).toBeUndefined();
    expect(normalizePeaks('nope')).toBeUndefined();
    const huge = Array.from({ length: 400 }, () => 0.5);
    expect(normalizePeaks(huge)?.length).toBe(80);
  });

  it('formatSound attaches sanitized peaks', () => {
    const s = formatSound({
      id: 'snd_1',
      title: 'River',
      peaks: [0, 1.4, -0.2, 0.33, 0.8, 0.1, 0.4, 0.9, 0.2],
    });
    expect(s.peaks?.[0]).toBe(0);
    expect(s.peaks?.[1]).toBe(1);
    expect(s.peaks?.[2]).toBe(0);
    expect(s.peaks?.length).toBe(9);
  });
});
