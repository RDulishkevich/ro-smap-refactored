import { afterEach, describe, expect, it } from 'vitest';
import { isSoundSaved, setSoundSaved, toggleSoundSaved } from './saved-sounds';

afterEach(() => localStorage.clear());

describe('saved sounds', () => {
  it('toggles a sound into and out of the local library', () => {
    expect(isSoundSaved('p1')).toBe(false);
    expect(toggleSoundSaved('p1')).toBe(true);
    expect(isSoundSaved('p1')).toBe(true);
    expect(toggleSoundSaved('p1')).toBe(false);
    expect(isSoundSaved('p1')).toBe(false);
  });

  it('setSoundSaved is idempotent', () => {
    setSoundSaved('p2', true);
    setSoundSaved('p2', true);
    expect(isSoundSaved('p2')).toBe(true);
    setSoundSaved('p2', false);
    expect(isSoundSaved('p2')).toBe(false);
  });
});
