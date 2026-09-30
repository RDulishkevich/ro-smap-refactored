import { CONSENT_KEY, CONSENT_VERSION } from './config';

export type ConsentChoice = 'all' | 'necessary';
export type ConsentRecord = { v: number; choice: ConsentChoice; at: string };

export function getCookieConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentRecord;
    if (!parsed || Number(parsed.v) !== CONSENT_VERSION) return null;
    if (parsed.choice !== 'all' && parsed.choice !== 'necessary') return null;
    return parsed;
  } catch {
    return null;
  }
}

export function hasCookieConsentForAuth() {
  const c = getCookieConsent();
  return !!(c && c.choice === 'all');
}

export function hasCookieConsentDecision() {
  return !!getCookieConsent();
}

export function setCookieConsent(choice: ConsentChoice): ConsentRecord {
  const next: ConsentRecord = {
    v: CONSENT_VERSION,
    choice: choice === 'necessary' ? 'necessary' : 'all',
    at: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return next;
}
