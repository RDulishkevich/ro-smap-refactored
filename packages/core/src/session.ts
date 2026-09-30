import { SESSION_FLAG, USER_KEY } from './config';
import { apiMe, apiRefreshSession, getAuthToken, setAccessToken, userFromApi } from './api';
import type { SessionUser } from './types';

export function readStoredUser(): SessionUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) return null;
    const u = JSON.parse(raw);
    return userFromApi(u);
  } catch {
    return null;
  }
}

export function persistUser(user: SessionUser | null) {
  try {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      localStorage.setItem(SESSION_FLAG, '1');
    } else {
      localStorage.removeItem(USER_KEY);
      localStorage.removeItem(SESSION_FLAG);
    }
  } catch {
    /* ignore */
  }
}

export function hasAuthSession() {
  if (getAuthToken()) return true;
  try {
    return localStorage.getItem(SESSION_FLAG) === '1';
  } catch {
    return false;
  }
}

export function setAuthSession(token: string, user: SessionUser | null) {
  if (token) setAccessToken(token);
  persistUser(user);
}

export function clearAuthSession() {
  setAccessToken('');
  persistUser(null);
}

export async function restoreAuthSession(): Promise<SessionUser | null> {
  const tryMe = async () => {
    const data = await apiMe() as { token?: string; user?: Record<string, unknown> };
    const user = userFromApi(data.user);
    setAuthSession(data.token ? String(data.token) : getAuthToken(), user);
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
