import { FUNCTION_URL, REFRESH_KEY, REMEMBER_KEY, TOKEN_KEY, USER_KEY } from './config';
import type { SessionUser } from './types';

export type ApiError = Error & { code?: string; status?: number; data?: unknown };

let accessToken = '';
let refreshInFlight: Promise<unknown> | null = null;

function rememberTokens() {
  try {
    return localStorage.getItem(REMEMBER_KEY) === '1';
  } catch {
    return false;
  }
}

function readStoredToken() {
  try {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || '';
  } catch {
    return '';
  }
}

export function getAuthToken() {
  return accessToken || readStoredToken();
}

export function setAccessToken(token: string, remember = rememberTokens()) {
  accessToken = token;
  try {
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    if (token) {
      store.setItem(TOKEN_KEY, token);
      other.removeItem(TOKEN_KEY);
    } else {
      localStorage.removeItem(TOKEN_KEY);
      sessionStorage.removeItem(TOKEN_KEY);
    }
  } catch {
    /* ignore */
  }
}

export function readRefreshToken() {
  try {
    return localStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(REFRESH_KEY) || '';
  } catch {
    return '';
  }
}

export function persistRefreshToken(token: string, remember = rememberTokens()) {
  try {
    if (!token) {
      localStorage.removeItem(REFRESH_KEY);
      sessionStorage.removeItem(REFRESH_KEY);
      return;
    }
    const store = remember ? localStorage : sessionStorage;
    const other = remember ? sessionStorage : localStorage;
    store.setItem(REFRESH_KEY, token);
    other.removeItem(REFRESH_KEY);
  } catch {
    /* ignore */
  }
}

export function clearSessionTokens() {
  setAccessToken('');
  persistRefreshToken('');
}

export async function apiRequest(action: string, payload: Record<string, unknown> = {}, { auth = false, _retried = false } = {}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const body: Record<string, unknown> = { action, ...payload };
  if (auth) {
    const token = getAuthToken();
    if (token) {
      body.token = token;
      headers['X-Rosmap-Token'] = token;
    }
  }

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
    credentials: 'include',
  });

  let data: Record<string, unknown> | null = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (auth && !_retried && (res.status === 401 || data?.error === 'unauthorized')
    && action !== 'refresh' && action !== 'login' && action !== 'logout') {
    const refreshed = await apiRefreshSession().catch(() => null) as { ok?: boolean } | null;
    if (refreshed?.ok) {
      return apiRequest(action, payload, { auth: true, _retried: true });
    }
  }

  if (!res.ok || (data && data.ok === false)) {
    const err = new Error(String((data && (data.message || data.error)) || `HTTP ${res.status}`)) as ApiError;
    err.code = String((data && data.error) || `http_${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  if (data?.token) setAccessToken(String(data.token), data.rememberMe !== false);
  if (typeof data?.refreshToken === 'string' && data.refreshToken) {
    persistRefreshToken(data.refreshToken, data.rememberMe !== false);
  }
  return data || { ok: true };
}

export function apiRefreshSession() {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    try {
      const rt = readRefreshToken();
      const data = await apiRequest('refresh', rt ? { refreshToken: rt } : {}, { auth: false });
      if (data?.token) setAccessToken(String(data.token), data.rememberMe !== false);
      return data;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

export const apiRegister = (login: string, password: string, displayName?: string, pdConsent?: boolean) =>
  apiRequest('register', {
    login,
    password,
    displayName: displayName || login,
    ...(pdConsent ? { pdConsent: true, pdConsentAt: new Date().toISOString() } : {}),
  });

export const apiLogin = (login: string, password: string, totpCode?: string, rememberMe = true) =>
  apiRequest('login', { login, password, rememberMe, ...(totpCode ? { totpCode } : {}) });

export const apiLogout = () => apiRequest('logout', {}, { auth: false }).catch(() => ({ ok: true }));
export const apiLogoutAll = () => apiRequest('logoutAll', {}, { auth: true });
export const apiMe = () => apiRequest('me', {}, { auth: true });
export const apiRequestEmailVerification = (email: string) =>
  apiRequest('requestEmailVerification', { email }, { auth: true });
export const apiConfirmEmailVerification = (code: string) =>
  apiRequest('confirmEmailVerification', { code }, { auth: true });
export const apiRequestPasswordReset = (loginOrEmail: string) =>
  apiRequest('requestPasswordReset', { loginOrEmail }, { auth: false });
export const apiConfirmPasswordReset = (loginOrEmail: string, code: string, newPassword: string) =>
  apiRequest('confirmPasswordReset', { loginOrEmail, code, newPassword }, { auth: false });
export const apiChangePassword = (currentPassword: string, newPassword: string) =>
  apiRequest('changePassword', { currentPassword, newPassword }, { auth: true });
export const apiPublicConfig = () => apiRequest('publicConfig');
export const apiHealth = () => apiRequest('health');
export const apiGetMail = async () => {
  const data = await apiRequest('getMail', {}, { auth: true });
  return Array.isArray(data?.data) ? data.data : [];
};
export const apiPatchSound = (soundId: string | number, ops: Record<string, unknown>) =>
  apiRequest('patchSound', { soundId, ops }, { auth: true });
export const apiCommit = (fileName: string) => apiRequest('commit', { fileName }, { auth: true });
export const apiPresignUpload = (fileName: string, contentType: string, contentLength: number) =>
  apiRequest('presign', { fileName, contentType, contentLength: Number(contentLength) || 0 }, { auth: true });

function actorLogin() {
  try {
    const raw = localStorage.getItem(USER_KEY) || '';
    if (!raw) return '';
    const u = JSON.parse(raw) as { loginName?: string; login?: string };
    return String(u.loginName || u.login || '').toLowerCase();
  } catch {
    return '';
  }
}

async function withWriteRetry<T>(fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let i = 0; i < 4; i++) {
    try {
      return await fn();
    } catch (err) {
      last = err;
      const e = err as ApiError;
      if (e.code !== 'write_conflict' && e.status !== 409) throw err;
      await new Promise((r) => setTimeout(r, 80 * (i + 1)));
    }
  }
  throw last instanceof Error ? last : Object.assign(new Error('write_conflict'), { code: 'write_conflict' });
}

export async function apiSyncJson(fileName: string, data: unknown) {
  // Server merge (handleSync): send only changed rows. Full-array overwrite races with other writers.
  const payload = Array.isArray(data) ? data : [];
  const raw = JSON.stringify(payload);
  if (raw.length < 2_000_000) {
    try {
      return await withWriteRetry(() => apiRequest('sync', { fileName, data: payload }, { auth: true }));
    } catch (err) {
      const e = err as ApiError;
      if (e.code !== 'payload_too_large' && e.status !== 413) throw err;
    }
  }
  const login = actorLogin();
  if (!login) throw Object.assign(new Error('unauthorized'), { code: 'unauthorized' });
  const stagingKey = `staging/${login}/${fileName}`;
  const pre = await apiPresignUpload(stagingKey, 'application/json', raw.length) as { uploadUrl?: string };
  if (!pre.uploadUrl) throw new Error('Нет URL загрузки');
  const putRes = await fetch(pre.uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: raw,
  });
  if (!putRes.ok) throw new Error('Ошибка staging-загрузки в облако');
  return withWriteRetry(() => apiCommit(fileName));
}
export const apiAdminSendEmail = (login: string, message: string, subject?: string) =>
  apiRequest('adminSendEmail', { login, message, subject }, { auth: true });
export const apiDeleteAccount = (password: string, totpCode?: string) =>
  apiRequest('deleteAccount', { password, ...(totpCode ? { totpCode } : {}) }, { auth: true });
export const apiAdminDeleteUser = (login: string) =>
  apiRequest('adminDeleteUser', { login }, { auth: true });
export const apiAdminUnbindEmail = (login: string) =>
  apiRequest('adminUnbindEmail', { login }, { auth: true });
export const apiTranslate = (texts: string | string[], sourceLanguageCode = 'ru', targetLanguageCode = 'en') =>
  apiRequest('translate', { texts, sourceLanguageCode, targetLanguageCode }, { auth: true });
export const apiTotpSetup = () => apiRequest('totpSetup', {}, { auth: true });
export const apiTotpConfirm = (totpCode: string) => apiRequest('totpConfirm', { totpCode }, { auth: true });
export const apiTotpDisable = (password: string, totpCode: string) =>
  apiRequest('totpDisable', { password, totpCode }, { auth: true });
export const apiGetSecurityEvents = () => apiRequest('getSecurityEvents', {}, { auth: true });

export function normalizeRole(role: unknown): SessionUser['role'] {
  const r = String(role || '').toLowerCase();
  return r === 'admin' || r === 'moderator' ? r : 'user';
}

export function userFromApi(user: Record<string, unknown> | undefined | null): SessionUser | null {
  if (!user) return null;
  const login = String(user.loginName || user.login || user.username || '');
  if (!login) return null;
  return {
    username: String(user.username || user.displayName || login),
    loginName: login,
    role: normalizeRole(user.role),
    totpEnabled: !!user.totpEnabled,
    email: user.email != null ? String(user.email) : undefined,
    emailVerified: user.emailVerified != null ? !!user.emailVerified : undefined,
    displayName: user.displayName != null ? String(user.displayName) : undefined,
    avatar: user.avatar != null ? String(user.avatar) : undefined,
    bio: user.bio != null ? String(user.bio) : undefined,
  };
}
