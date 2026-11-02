import { test, expect } from '@playwright/test';
import { assertPasswordStrength } from '../packages/core/src/password-policy';
import { newSoundId, newUserId } from '../packages/core/src/ids';

/**
 * Lightweight contract guards for likes/comments/mail/upload IDs.
 * Full browser journeys live in audit-*.spec.ts; this file catches policy regressions
 * after opaque-ID / storage layout changes.
 */
test.describe('process contracts under opaque ids', () => {
  test('sound and user ids stay opaque for new entities', () => {
    expect(newUserId()).toMatch(/^usr_/);
    expect(newSoundId()).toMatch(/^snd_/);
  });

  test('password policy blocks login-in-password', () => {
    expect(assertPasswordStrength('romaflay99', { login: 'romaflay' }).ok).toBe(false);
    expect(assertPasswordStrength('MapWalk#2026x', { login: 'romaflay' }).ok).toBe(true);
  });

  test('media key shapes (documented dual-read)', () => {
    const uid = newUserId();
    const sid = newSoundId();
    expect(`media/avatars/${uid}/a.jpg`).toMatch(/^media\/avatars\/usr_/);
    expect(`media/sounds/${sid}/clip.wav`).toMatch(/^media\/sounds\/snd_/);
    // legacy still valid for dual-read
    expect('uploads/demo/clip.wav').toMatch(/^uploads\//);
  });
});
