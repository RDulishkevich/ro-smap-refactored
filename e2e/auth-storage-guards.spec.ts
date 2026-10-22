import { test, expect } from '@playwright/test';
import { assertPasswordStrength } from '../packages/core/src/password-policy';
import { newEntityId, newSoundId, newUserId } from '../packages/core/src/ids';

test.describe('password policy & opaque ids', () => {
  test('rejects short and common passwords', () => {
    expect(assertPasswordStrength('short').ok).toBe(false);
    expect(assertPasswordStrength('password12').ok).toBe(false);
    expect(assertPasswordStrength('abcdefghij').ok).toBe(false);
    expect(assertPasswordStrength('1234567890').ok).toBe(false);
    const ok = assertPasswordStrength('ForestMap#2026', { login: 'roma' });
    expect(ok.ok).toBe(true);
  });

  test('opaque ids have stable prefixes', () => {
    expect(newUserId()).toMatch(/^usr_[0-9a-z]+$/i);
    expect(newSoundId()).toMatch(/^snd_[0-9a-z]+$/i);
    expect(newEntityId('evt')).toMatch(/^evt_[0-9a-z]+$/i);
  });
});
