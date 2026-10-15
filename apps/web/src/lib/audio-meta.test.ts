import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_PEAKS, seedPeaks } from './audio-meta';

describe('seedPeaks', () => {
  it('is visible and stable for a given seed', () => {
    const a = seedPeaks('108151', 64);
    const b = seedPeaks('108151', 64);
    expect(a).toEqual(b);
    expect(a.length).toBe(64);
    expect(Math.min(...a)).toBeGreaterThanOrEqual(0.2);
    expect(Math.max(...a)).toBeGreaterThan(0.4);
    expect(PLACEHOLDER_PEAKS.length).toBe(64);
    expect(Math.max(...PLACEHOLDER_PEAKS)).toBeGreaterThan(0.4);
  });
});
