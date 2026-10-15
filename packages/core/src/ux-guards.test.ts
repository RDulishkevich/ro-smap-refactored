import { describe, expect, it } from 'vitest';
import { escapeHtml, spamGuardCheck, spamGuardMessage } from './antispam';
import { hasCookieConsentDecision, hasCookieConsentForAuth, setCookieConsent } from './consent';
import { normalizeComment } from './sounds';
import { matchSupportBotFaq } from './support-bot';

describe('spamGuardCheck', () => {
  it('rate-limits a key', () => {
    const key = `test-${Math.random()}`;
    expect(spamGuardCheck(key, { minIntervalMs: 10_000 }).ok).toBe(true);
    const blocked = spamGuardCheck(key, { minIntervalMs: 10_000 });
    expect(blocked.ok).toBe(false);
    expect(spamGuardMessage(blocked)).toMatch(/подождите/i);
  });
});

describe('consent', () => {
  it('requires an explicit choice before auth cookies', () => {
    expect(hasCookieConsentDecision()).toBe(false);
    expect(hasCookieConsentForAuth()).toBe(false);
    setCookieConsent('necessary');
    expect(hasCookieConsentDecision()).toBe(true);
    expect(hasCookieConsentForAuth()).toBe(false);
    setCookieConsent('all');
    expect(hasCookieConsentForAuth()).toBe(true);
  });
});

describe('comments and support', () => {
  it('normalizes a flat comment', () => {
    const c = normalizeComment({ text: 'привет', author: 'Рома' });
    expect(c.text).toBe('привет');
    expect(c.author).toBe('Рома');
    expect(c.replies).toEqual([]);
  });

  it('matches FAQ without leaking a second support brand', () => {
    const hit = matchSupportBotFaq('как добавить звук');
    expect(hit?.answer).toMatch(/модерац/i);
    expect(JSON.stringify(hit)).not.toMatch(/RO·SMap/i);
  });

  it('escapes html', () => {
    expect(escapeHtml('<b>"x"</b>')).toBe('&lt;b&gt;&quot;x&quot;&lt;/b&gt;');
  });
});
