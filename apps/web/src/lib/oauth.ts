import { apiOauthFinish, apiOauthLink, apiPublicConfig, restoreAuthSession } from '@polevka/core';

export type OAuthProvider = 'yandex' | 'vk';
export type OAuthIntent = 'login' | 'link';

type OAuthPublic = {
  yandex?: boolean;
  vk?: boolean;
  yandexClientId?: string;
  vkClientId?: string;
  redirectUri?: string;
};

type PkceSaved = {
  provider: OAuthProvider;
  state: string;
  verifier: string;
  redirectUri: string;
  pdConsent?: boolean;
  intent?: OAuthIntent;
  at: number;
};

const PKCE_KEY = 'polevka_oauth_pkce';

function b64url(buf: ArrayBuffer | Uint8Array) {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  bytes.forEach((b) => { s += String.fromCharCode(b); });
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function randomString(len = 64) {
  const arr = new Uint8Array(len);
  crypto.getRandomValues(arr);
  return b64url(arr).slice(0, len);
}

async function sha256(text: string) {
  const data = new TextEncoder().encode(text);
  const dig = await crypto.subtle.digest('SHA-256', data);
  return b64url(dig);
}

/** www ↔ apex share cookies; sessionStorage does not. */
function pkceCookieAttrs() {
  const host = location.hostname;
  const domain = (host === 'polevka.art' || host.endsWith('.polevka.art'))
    ? '; Domain=.polevka.art'
    : '';
  return `Path=/; Max-Age=600; SameSite=Lax; Secure${domain}`;
}

function writePkce(saved: PkceSaved) {
  const raw = JSON.stringify(saved);
  try { sessionStorage.setItem(PKCE_KEY, raw); } catch { /* */ }
  try {
    document.cookie = `${PKCE_KEY}=${encodeURIComponent(raw)}; ${pkceCookieAttrs()}`;
  } catch { /* */ }
}

function readPkce(): string | null {
  try {
    const fromSession = sessionStorage.getItem(PKCE_KEY);
    if (fromSession) return fromSession;
  } catch { /* */ }
  try {
    const m = document.cookie.match(/(?:^|; )polevka_oauth_pkce=([^;]*)/);
    if (m?.[1]) return decodeURIComponent(m[1]);
  } catch { /* */ }
  return null;
}

function clearPkce() {
  try { sessionStorage.removeItem(PKCE_KEY); } catch { /* */ }
  try {
    const host = location.hostname;
    const domain = (host === 'polevka.art' || host.endsWith('.polevka.art'))
      ? '; Domain=.polevka.art'
      : '';
    document.cookie = `${PKCE_KEY}=; Path=/; Max-Age=0; SameSite=Lax; Secure${domain}`;
  } catch { /* */ }
}

export async function loadOauthConfig(): Promise<OAuthPublic> {
  try {
    const data = await apiPublicConfig() as { oauth?: OAuthPublic };
    return data.oauth || {};
  } catch {
    return {};
  }
}

/**
 * Callback must stay on the same origin as the tab that started OAuth,
 * otherwise PKCE (sessionStorage) and the JWT (localStorage) are lost
 * when www ↔ apex differ from OAUTH_REDIRECT_URI.
 */
function resolveRedirectUri(_cfg: OAuthPublic) {
  return `${location.origin}/oauth/callback`;
}

export async function beginOAuth(
  provider: OAuthProvider,
  opts?: { pdConsent?: boolean; intent?: OAuthIntent },
) {
  const cfg = await loadOauthConfig();
  const redirectUri = resolveRedirectUri(cfg);
  const clientId = provider === 'yandex' ? cfg.yandexClientId : cfg.vkClientId;
  const enabled = provider === 'yandex' ? cfg.yandex : cfg.vk;
  if (!enabled || !clientId) {
    throw Object.assign(
      new Error(provider === 'yandex'
        ? 'Яндекс ID ещё не подключён на сервере'
        : 'VK ID ещё не подключён на сервере'),
      { code: 'oauth_disabled' },
    );
  }
  const intent: OAuthIntent = opts?.intent === 'link' ? 'link' : 'login';
  // VK ID: state ≥ 32; code_verifier 43–128
  const state = randomString(40);
  const verifier = randomString(64);
  const challenge = await sha256(verifier);
  writePkce({
    provider, state, verifier, redirectUri, intent,
    pdConsent: !!opts?.pdConsent, at: Date.now(),
  });

  if (provider === 'yandex') {
    const url = new URL('https://oauth.yandex.ru/authorize');
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('client_id', clientId);
    url.searchParams.set('redirect_uri', redirectUri);
    url.searchParams.set('state', state);
    url.searchParams.set('force_confirm', 'yes');
    url.searchParams.set('code_challenge', challenge);
    url.searchParams.set('code_challenge_method', 'S256');
    location.assign(url.toString());
    return;
  }

  const url = new URL('https://id.vk.ru/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge', challenge);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('scope', 'email vkid.personal_info');
  location.assign(url.toString());
}

function parseCallbackParams(search: string) {
  const params = new URLSearchParams(search.startsWith('?') ? search : `?${search}`);
  const payloadRaw = params.get('payload');
  if (payloadRaw) {
    try {
      const payload = JSON.parse(payloadRaw) as {
        code?: string; state?: string; device_id?: string; error?: string; error_description?: string;
      };
      return {
        code: String(payload.code || ''),
        state: String(payload.state || ''),
        deviceId: String(payload.device_id || ''),
        error: payload.error || params.get('error'),
        errorDescription: payload.error_description || params.get('error_description'),
      };
    } catch {
      /* fall through to flat query */
    }
  }
  return {
    code: params.get('code') || '',
    state: params.get('state') || '',
    deviceId: params.get('device_id') || '',
    error: params.get('error'),
    errorDescription: params.get('error_description'),
  };
}

export async function finishOAuthFromUrl(search: string) {
  const { code, state, deviceId, error, errorDescription } = parseCallbackParams(search);
  if (error) {
    throw Object.assign(new Error(errorDescription || error), { code: 'oauth_denied' });
  }
  if (!code) throw Object.assign(new Error('Нет кода авторизации'), { code: 'oauth_missing_code' });

  const raw = readPkce();
  if (!raw) throw Object.assign(new Error('Сессия OAuth истекла — попробуйте снова'), { code: 'oauth_state' });
  const saved = JSON.parse(raw) as PkceSaved;
  if (saved.state !== state) {
    clearPkce();
    throw Object.assign(new Error('Неверный state OAuth'), { code: 'oauth_state' });
  }
  if (saved.provider === 'vk' && !deviceId) {
    clearPkce();
    throw Object.assign(new Error('VK не вернул device_id'), { code: 'oauth_missing_device' });
  }

  const intent: OAuthIntent = saved.intent === 'link' ? 'link' : 'login';
  const base = {
    provider: saved.provider,
    code,
    codeVerifier: saved.verifier,
    redirectUri: saved.redirectUri,
    deviceId: deviceId || undefined,
  };

  if (intent === 'link') {
    const session = await restoreAuthSession().catch(() => null);
    if (!session) {
      throw Object.assign(
        new Error('Сессия истекла — войдите снова и повторите привязку'),
        { code: 'unauthorized' },
      );
    }
    const data = await apiOauthLink(base);
    clearPkce();
    return { intent, ...data };
  }

  const data = await apiOauthFinish({
    ...base,
    pdConsent: !!saved.pdConsent,
    rememberMe: true,
  });
  clearPkce();
  return { intent, ...data };
}

/** One exchange per callback URL — survives React Strict Mode double-mount. */
let finishOnce: Promise<Record<string, unknown>> | null = null;
let finishOnceKey = '';

export function finishOAuthFromUrlOnce(search: string) {
  const key = search || '';
  if (!finishOnce || finishOnceKey !== key) {
    finishOnceKey = key;
    finishOnce = finishOAuthFromUrl(key)
      .then((data) => data as Record<string, unknown>)
      .finally(() => {
        window.setTimeout(() => {
          if (finishOnceKey === key) {
            finishOnce = null;
            finishOnceKey = '';
          }
        }, 8000);
      });
  }
  return finishOnce;
}
