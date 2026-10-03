import { hasCookieConsentDecision, setCookieConsent } from '@polevka/core';
import { color } from '@polevka/design';
import { useEffect, useState } from 'react';
import { useTh } from '../state/ThemeContext';

export const COOKIE_EVENT = 'polevka-open-cookies';

export function openCookieBanner() {
  window.dispatchEvent(new Event(COOKIE_EVENT));
}

export function CookieBanner() {
  const th = useTh();
  const [open, setOpen] = useState(() => !hasCookieConsentDecision());
  useEffect(() => {
    const on = () => setOpen(true);
    window.addEventListener(COOKIE_EVENT, on);
    return () => window.removeEventListener(COOKIE_EVENT, on);
  }, []);
  if (!open) return null;
  return (
    <div className="fixed left-4 right-4 z-[520] bottom-24 md:bottom-6 md:left-auto md:right-6 md:w-[360px] rounded-3xl p-4 shadow-xl" style={{ background: th.cardBg, border: `1px solid ${th.border}` }}>
      <p className="pv-subtitle mb-1" style={{ color: th.inkText }}>Cookies</p>
      <p className="pv-caption mb-3" style={{ color: color.olive }}>
        «Принять» — сессия входа и локальные настройки. «Только необходимые» — без auth-cookies, вход будет недоступен.
      </p>
      <div className="flex gap-2">
        <button className="pv-label flex-1 py-2 rounded-2xl" style={{ background: th.lightBg, color: color.olive }}
          onClick={() => { setCookieConsent('necessary'); setOpen(false); }}>Только необходимые</button>
        <button className="pv-label flex-1 py-2 rounded-2xl text-white" style={{ background: color.accent }}
          onClick={() => { setCookieConsent('all'); setOpen(false); }}>Принять</button>
      </div>
    </div>
  );
}
