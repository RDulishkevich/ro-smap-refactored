import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiLogin, apiLogout, apiMe, apiRegister, clearAuthSession, hasCookieConsentForAuth,
  persistRefreshToken, persistUser, readRememberMe, restoreAuthSession, setAuthSession, setRememberMe,
  userFromApi, type SessionUser,
} from '@polevka/core';
import {
  assertDeviceUnlock, canUseDeviceUnlock, clearDeviceUnlock, enrollDeviceUnlock, hasDeviceUnlock,
} from '../lib/device-unlock';
import { unsubscribeDevicePush } from '../lib/notify';
import { CONSENT_NECESSARY_EVENT } from '../primitives/CookieBanner';
type AuthCtx = {
  user: SessionUser | null;
  isLoggedIn: boolean;
  isStaff: boolean;
  login: (login: string, password: string, totp?: string, rememberMe?: boolean, captchaToken?: string) => Promise<void>;
  register: (login: string, password: string, displayName?: string, pdConsent?: boolean, captchaToken?: string) => Promise<void>;
  applySession: (data: { token?: string; refreshToken?: string; user?: Record<string, unknown>; rememberMe?: boolean }) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  patchUser: (partial: Partial<SessionUser>) => void;
  restoring: boolean;
  needsUnlock: boolean;
  unlockWithDevice: () => Promise<boolean>;
  resumeStoredSession: () => Promise<boolean>;
  skipDeviceUnlock: () => Promise<void>;
  offerDeviceUnlock: (login?: string, displayName?: string) => Promise<boolean>;
  disableDeviceUnlock: () => void;
  deviceUnlockReady: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [restoring, setRestoring] = useState(true);
  const [needsUnlock, setNeedsUnlock] = useState(false);
  const [deviceUnlockReady, setDeviceUnlockReady] = useState(() => hasDeviceUnlock());

  useEffect(() => {
    let cancelled = false;
    if (!hasCookieConsentForAuth()) {
      clearAuthSession();
      setRestoring(false);
      return;
    }
    const gate = readRememberMe() && hasDeviceUnlock();
    if (gate) {
      setNeedsUnlock(true);
      setRestoring(false);
      return;
    }
    restoreAuthSession().then((u) => {
      if (cancelled) return;
      setUser(u);
      setRestoring(false);
    }).catch(() => {
      if (!cancelled) setRestoring(false);
    });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (
    loginName: string,
    password: string,
    totp?: string,
    rememberMe = true,
    captchaToken?: string,
  ) => {
    if (!hasCookieConsentForAuth()) throw Object.assign(new Error('Нужно принять cookies сессии'), { code: 'consent' });
    setRememberMe(rememberMe);
    const data = await apiLogin(loginName, password, totp, rememberMe, captchaToken) as {
      token?: string; refreshToken?: string; user?: Record<string, unknown>; needsTotp?: boolean;
    };
    if (data.needsTotp) {
      throw Object.assign(new Error('Введите код 2FA'), { code: 'totp_required' });
    }
    const next = userFromApi(data.user);
    if (data.refreshToken) persistRefreshToken(data.refreshToken, rememberMe);
    setAuthSession(String(data.token || ''), next, rememberMe);
    setUser(next);
    setNeedsUnlock(false);
    if (!rememberMe) {
      clearDeviceUnlock();
      setDeviceUnlockReady(false);
    }
  }, []);

  const register = useCallback(async (
    loginName: string,
    password: string,
    displayName?: string,
    pdConsent?: boolean,
    captchaToken?: string,
  ) => {
    if (!hasCookieConsentForAuth()) throw Object.assign(new Error('Нужно принять cookies сессии'), { code: 'consent' });
    if (!pdConsent) throw Object.assign(new Error('Нужно согласие на обработку персональных данных'), { code: 'pd_consent' });
    // Register already returns a session — do not login again (captcha token is one-shot).
    const data = await apiRegister(loginName, password, displayName, true, captchaToken) as {
      token?: string; refreshToken?: string; user?: Record<string, unknown>;
    };
    setRememberMe(true);
    const next = userFromApi(data.user);
    if (!data.token || !next) {
      throw Object.assign(new Error('Не удалось создать сессию'), { code: 'register_failed' });
    }
    if (data.refreshToken) persistRefreshToken(data.refreshToken, true);
    setAuthSession(String(data.token), next, true);
    setUser(next);
    setNeedsUnlock(false);
  }, []);

  const applySession = useCallback((data: {
    token?: string; refreshToken?: string; user?: Record<string, unknown>; rememberMe?: boolean;
  }) => {
    if (!hasCookieConsentForAuth()) throw Object.assign(new Error('Нужно принять cookies сессии'), { code: 'consent' });
    const remember = data.rememberMe !== false;
    setRememberMe(remember);
    const next = userFromApi(data.user);
    if (!next || !data.token) throw Object.assign(new Error('Ошибка сессии'), { code: 'oauth_failed' });
    if (data.refreshToken) persistRefreshToken(data.refreshToken, remember);
    setAuthSession(String(data.token), next, remember);
    setUser(next);
    setNeedsUnlock(false);
    if (!remember) {
      clearDeviceUnlock();
      setDeviceUnlockReady(false);
    }
  }, []);

  const logout = useCallback(async () => {
    try { await unsubscribeDevicePush(); } catch { /* still sign out */ }
    await apiLogout();
    clearAuthSession();
    setRememberMe(false);
    clearDeviceUnlock();
    setDeviceUnlockReady(false);
    setNeedsUnlock(false);
    setUser(null);
  }, []);

  useEffect(() => {
    const on = () => { void logout(); };
    window.addEventListener(CONSENT_NECESSARY_EVENT, on);
    return () => window.removeEventListener(CONSENT_NECESSARY_EVENT, on);
  }, [logout]);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiMe() as { token?: string; user?: Record<string, unknown> };
      const next = userFromApi(data.user);
      setAuthSession(data.token ? String(data.token) : '', next, readRememberMe());
      setUser(next);
    } catch {
      /* keep current */
    }
  }, []);

  const patchUser = useCallback((partial: Partial<SessionUser>) => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, ...partial };
      persistUser(next, readRememberMe());
      return next;
    });
  }, []);

  const unlockWithDevice = useCallback(async () => {
    await assertDeviceUnlock();
    const next = await restoreAuthSession();
    if (!next) return false;
    setNeedsUnlock(false);
    setUser(next);
    return true;
  }, []);

  const resumeStoredSession = useCallback(async () => {
    const next = await restoreAuthSession();
    setNeedsUnlock(false);
    if (!next) return false;
    setUser(next);
    return true;
  }, []);

  const skipDeviceUnlock = useCallback(async () => {
    try { await unsubscribeDevicePush(); } catch { /* still clear */ }
    try { await apiLogout(); } catch { /* still clear local */ }
    clearAuthSession();
    setNeedsUnlock(false);
    setUser(null);
  }, []);

  const offerDeviceUnlock = useCallback(async (login?: string, displayName?: string) => {
    const who = String(login || user?.loginName || '').trim();
    if (!who) return false;
    if (!(await canUseDeviceUnlock())) return false;
    await enrollDeviceUnlock(who, displayName || user?.displayName || user?.username || who);
    setDeviceUnlockReady(true);
    return true;
  }, [user]);

  const disableDeviceUnlock = useCallback(() => {
    clearDeviceUnlock();
    setDeviceUnlockReady(false);
  }, []);

  const value = useMemo(() => ({
    user,
    isLoggedIn: !!user,
    isStaff: user?.role === 'admin' || user?.role === 'moderator',
    login, register, applySession, logout, refreshUser, patchUser, restoring,
    needsUnlock, unlockWithDevice, resumeStoredSession, skipDeviceUnlock, offerDeviceUnlock, disableDeviceUnlock, deviceUnlockReady,
  }), [user, login, register, applySession, logout, refreshUser, patchUser, restoring, needsUnlock, unlockWithDevice, resumeStoredSession, skipDeviceUnlock, offerDeviceUnlock, disableDeviceUnlock, deviceUnlockReady]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider');
  return v;
}
