import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  apiLogin, apiLogout, apiMe, apiRegister, clearAuthSession, hasCookieConsentForAuth,
  persistUser, restoreAuthSession, setAuthSession, userFromApi, type SessionUser,
} from '@polevka/core';

type AuthCtx = {
  user: SessionUser | null;
  isLoggedIn: boolean;
  isStaff: boolean;
  login: (login: string, password: string, totp?: string) => Promise<void>;
  register: (login: string, password: string, displayName?: string, pdConsent?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  patchUser: (partial: Partial<SessionUser>) => void;
  restoring: boolean;
};

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    restoreAuthSession().then((u) => { setUser(u); setRestoring(false); }).catch(() => setRestoring(false));
  }, []);

  const login = useCallback(async (loginName: string, password: string, totp?: string) => {
    if (!hasCookieConsentForAuth()) throw Object.assign(new Error('Нужно принять cookies сессии'), { code: 'consent' });
    const data = await apiLogin(loginName, password, totp) as {
      token?: string; user?: Record<string, unknown>; needsTotp?: boolean;
    };
    if (data.needsTotp) {
      throw Object.assign(new Error('Введите код 2FA'), { code: 'totp_required' });
    }
    const next = userFromApi(data.user);
    setAuthSession(String(data.token || ''), next);
    setUser(next);
  }, []);

  const register = useCallback(async (loginName: string, password: string, displayName?: string, pdConsent?: boolean) => {
    if (!hasCookieConsentForAuth()) throw Object.assign(new Error('Нужно принять cookies сессии'), { code: 'consent' });
    if (!pdConsent) throw Object.assign(new Error('Нужно согласие на обработку персональных данных'), { code: 'pd_consent' });
    await apiRegister(loginName, password, displayName, true);
    await login(loginName, password);
  }, [login]);

  const logout = useCallback(async () => {
    await apiLogout();
    clearAuthSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const data = await apiMe() as { token?: string; user?: Record<string, unknown> };
      const next = userFromApi(data.user);
      setAuthSession(data.token ? String(data.token) : '', next);
      setUser(next);
    } catch {
      /* keep current */
    }
  }, []);

  const patchUser = useCallback((partial: Partial<SessionUser>) => {
    setUser((u) => {
      if (!u) return u;
      const next = { ...u, ...partial };
      persistUser(next);
      return next;
    });
  }, []);

  const value = useMemo(() => ({
    user,
    isLoggedIn: !!user,
    isStaff: user?.role === 'admin' || user?.role === 'moderator',
    login, register, logout, refreshUser, patchUser, restoring,
  }), [user, login, register, logout, refreshUser, patchUser, restoring]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('AuthProvider');
  return v;
}
