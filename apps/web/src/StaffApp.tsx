import { useState } from 'react';
import {
  apiStaffLogin, clearAuthSession, getAuthToken, setAuthSession, setCookieConsent,
  setRememberMe, userFromApi, type SessionUser,
} from '@polevka/core';
import { color } from '@polevka/design';
import { ThemeProvider, useTh } from './state/ThemeContext';
import { PrefsProvider } from './state/PrefsContext';
import { UiProvider, useUi } from './state/UiContext';
import { AuthProvider, useAuth } from './state/AuthContext';
import { DataProvider } from './state/DataContext';
import { NavProvider } from './state/NavContext';
import { CookieBanner } from './primitives/CookieBanner';
import { Overlays } from './primitives/chrome';
import { StaffHost } from './staff/StaffHost';
import BrandMark from '@/brand/BrandMark';

const ACCENT = color.accent;

function readJwtAud(token: string): string | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(json) as { aud?: string };
    return payload.aud ? String(payload.aud) : null;
  } catch {
    return null;
  }
}

function hasStaffAudience() {
  const t = getAuthToken();
  return !!t && readJwtAud(t) === 'staff';
}

function StaffLoginGate({ children }: { children: React.ReactNode }) {
  const th = useTh();
  const { toast } = useUi();
  const { logout } = useAuth();
  const [login, setLogin] = useState('');
  const [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false);

  if (hasStaffAudience()) {
    return (
      <div className="h-dvh w-screen flex flex-col" style={{ background: th.isDark ? '#000' : '#F3F4F6' }}>
        <header className="flex items-center gap-3 px-5 h-14 flex-shrink-0" style={{ background: th.cardBg, borderBottom: `1px solid ${th.border}` }}>
          <div className="w-8 h-8"><BrandMark /></div>
          <p className="pv-subtitle flex-1" style={{ color: th.inkText }}>Staff · Полёвка</p>
          <a href="https://www.polevka.art/" className="pv-caption" style={{ color: th.soft }}>К сайту</a>
          <button type="button" className="pv-caption" style={{ color: ACCENT }} onClick={() => void logout()}>Выйти</button>
        </header>
        <div className="flex-1 min-h-0 overflow-hidden" style={{ background: th.phoneBg }}>
          {children}
        </div>
      </div>
    );
  }

  const submit = async () => {
    setBusy(true);
    try {
      const data = await apiStaffLogin(login.trim(), totp.trim()) as {
        token?: string; user?: Record<string, unknown>;
      };
      const next = userFromApi(data.user) as SessionUser | null;
      if (!data.token || !next) throw Object.assign(new Error('Нет сессии'), { code: 'oauth_failed' });
      // AuthProvider clears tokens without consent=all; staff needs a session cookie.
      setCookieConsent('all');
      setRememberMe(true);
      setAuthSession(String(data.token), next, true);
      window.location.reload();
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err.code === 'totp_required') toast(err.message || 'Включите 2FA в кабинете на сайте');
      else toast(err.message || 'Неверный логин или код');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-dvh flex items-center justify-center p-6" style={{ background: th.phoneBg }}>
      <form
        className="w-full max-w-sm rounded-3xl p-6 flex flex-col gap-3"
        style={{ background: th.cardBg, border: `1px solid ${th.border}` }}
        onSubmit={(e) => { e.preventDefault(); void submit(); }}
      >
        <div className="flex items-center gap-2 mb-1">
          <div className="w-9 h-9"><BrandMark /></div>
          <div>
            <p className="pv-heading" style={{ color: th.inkText }}>Админка</p>
            <p className="pv-micro" style={{ color: th.soft }}>логин + аутентификатор</p>
          </div>
        </div>
        <label className="pv-label" style={{ color: th.soft }}>
          Логин
          <input value={login} onChange={(e) => setLogin(e.target.value)} autoComplete="username" autoFocus
            className="mt-1 w-full rounded-2xl px-4 py-2.5 outline-none" style={{ background: th.phoneBg, color: th.inkText }} />
        </label>
        <label className="pv-label" style={{ color: th.soft }}>
          Код из приложения
          <input value={totp} onChange={(e) => setTotp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            inputMode="numeric" autoComplete="one-time-code" maxLength={6}
            className="mt-1 w-full rounded-2xl px-4 py-2.5 outline-none tracking-widest"
            style={{ background: th.phoneBg, color: th.inkText }} />
        </label>
        <button type="submit" disabled={busy || !login.trim() || totp.length < 6}
          className="pv-button w-full min-h-11 rounded-2xl text-white mt-1"
          style={{ background: ACCENT, opacity: busy || !login.trim() || totp.length < 6 ? 0.7 : 1 }}>
          {busy ? '…' : 'Войти'}
        </button>
        <p className="pv-micro leading-snug" style={{ color: th.soft }}>
          Пароль аккаунта не нужен. Сначала включите 2FA в кабинете на сайте.
        </p>
        <button type="button" className="pv-caption self-start" style={{ color: th.soft }}
          onClick={() => { clearAuthSession(); window.location.href = 'https://www.polevka.art/'; }}>
          ← На сайт
        </button>
      </form>
    </div>
  );
}

function StaffShell() {
  const { isLoggedIn } = useAuth();
  const { toast } = useUi();
  return (
    <NavProvider isLoggedIn={isLoggedIn} onNeedAuth={() => toast('Нужен вход staff')}>
      <StaffLoginGate>
        <StaffHost />
      </StaffLoginGate>
      <Overlays />
    </NavProvider>
  );
}

export function StaffApp() {
  return (
    <ThemeProvider>
      <PrefsProvider>
        <UiProvider>
          <AuthProvider>
            <DataProvider>
              <StaffShell />
              <CookieBanner />
            </DataProvider>
          </AuthProvider>
        </UiProvider>
      </PrefsProvider>
    </ThemeProvider>
  );
}
