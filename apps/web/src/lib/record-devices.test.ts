import { describe, expect, it } from 'vitest';
import { channelLaneLabel, resolveInputChannels } from './record-devices';

describe('resolveInputChannels', () => {
  it('prefers the live track setting', () => {
    expect(resolveInputChannels(4, 8, 2)).toBe(4);
  });

  it('falls back to capability max, then the graph source', () => {
    expect(resolveInputChannels(0, 6, 2)).toBe(6);
    expect(resolveInputChannels(0, 0, 1)).toBe(1);
  });

  it('clamps to 1..8', () => {
    expect(resolveInputChannels(0, 0, 0)).toBe(1);
    expect(resolveInputChannels(16, 32, 16)).toBe(8);
  });
});

describe('channelLaneLabel', () => {
  it('uses L/R for stereo and numbers otherwise', () => {
    expect(channelLaneLabel(0, 2)).toBe('L');
    expect(channelLaneLabel(1, 2)).toBe('R');
    expect(channelLaneLabel(0, 4)).toBe('1');
    expect(channelLaneLabel(3, 4)).toBe('4');
  });
});
