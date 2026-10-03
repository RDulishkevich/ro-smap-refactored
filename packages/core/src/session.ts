import { LAST_LOGIN_KEY, REMEMBER_KEY, SESSION_FLAG, USER_KEY } from './config';
import { apiMe, apiRefreshSession, getAuthToken, setAccessToken, userFromApi } from './api';
import type { SessionUser } from './types';

function storageOf(remember: boolean) {
  return remember ? localStorage : sessionStorage;
}

export function readRememberMe(): boolean {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1';
  } catch {
    return false;
  }
}

export function setRememberMe(on: boolean) {
  try {
    if (on) localStorage.setItem(REMEMBER_KEY, '1');
    else localStorage.removeItem(REMEMBER_KEY);
  } catch {
    /* ignore */
  }
}

export function readLastLogin(): string {
  try {
    return localStorage.getItem(LAST_LOGIN_KEY) || '';
  } catch {
    return '';
  }
}

export function readStoredUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY) || '';
    if (!raw) return null;
    const u = JSON.parse(raw);
    return userFromApi(u);
  } catch {
    return null;
  }
}

export function persistUser(user: SessionUser | null, remember = readRememberMe()) {
  try {
    if (user) {
      const store = storageOf(remember);
      const other = storageOf(!remember);
      store.setItem(USER_KEY, JSON.stringify(user));
      store.setItem(SESSION_FLAG, '1');
      other.removeItem(USER_KEY);
      other.removeItem(SESSION_FLAG);
      setRememberMe(remember);
      if (user.loginName) localStorage.setItem(LAST_LOGIN_KEY, user.loginName);
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SESSION_FLAG);
      sessionStorage.removeItem(USER_KEY);
      sessionStorage.removeItem(SESSION_FLAG);
    }
  } catch {
    /* ignore */
  }
}

export function hasAuthSession() {
  if (getAuthToken()) return true;
  try {
    return localStorage.getItem(SESSION_FLAG) === '1' || sessionStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

export function setAuthSession(token: string, user: SessionUser | null, remember = readRememberMe()) {
  if (token) setAccessToken(token);
  persistUser(user, remember);
}

export function clearAuthSession() {
  setAccessToken('');
  persistUser(null);
}

export async function restoreAuthSession(): Promise<SessionUser | null> {
  const tryMe = async () => {
    const data = await apiMe() as { token?: string; user?: Record<string, unknown> };
    const user = userFromApi(data.user);
    setAuthSession(data.token ? String(data.token) : getAuthToken(), user, readRememberMe());
    return user;
  };
  try {
    return await tryMe();
  } catch (err: unknown) {
    const e = err as { code?: string; status?: number };
    if (e.code === 'unauthorized' || e.status === 401) {
      try {
        const refreshed = await apiRefreshSession() as { ok?: boolean };
        if (refreshed?.ok) return await tryMe();
      } catch {
        /* ignore */
      }
    }
    if (e.code === 'unauthorized' || e.code === 'blocked' || e.status === 401 || e.status === 403) {
      clearAuthSession();
    }
    return null;
  }
}
