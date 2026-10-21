import {
  REFRESH_KEY, REMEMBER_KEY,
  apiOauthFinish, apiOauthLink, apiPublicConfig, restoreAuthSession,
  persistRefreshToken, setRememberMe,
} from '@polevka/core';

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

type BridgePayload = {
  provider: OAuthProvider;
  intent: OAuthIntent;
  pdConsent: boolean;
  remember: boolean;
  at?: string;
  rt?: string;
  user?: string;
};

const PKCE_KEY = 'polevka_oauth_pkce';
const BRIDGE_KEY = 'polevka_oauth_bridge';
const CB_SEARCH_KEY = 'polevka_oauth_cb_search';

/** Snapshot callback query before DeepLinks / nav can rewrite the URL to `/`. */
export function captureOauthCallbackSearch() {
  if (typeof location === 'undefined') return;
  if (location.pathname.startsWith('/oauth/callback') && location.search.length > 1) {
    try { sessionStorage.setItem(CB_SEARCH_KEY, location.search); } catch { /* */ }
  }
}

function readOauthCallbackSearch(fallback = '') {
  captureOauthCallbackSearch();
  if (typeof location !== 'undefined'
    && location.pathname.startsWith('/oauth/callback')
    && location.search.length > 1) {
    return location.search;
  }
  try { return sessionStorage.getItem(CB_SEARCH_KEY) || fallback; } catch { return fallback; }
}

function clearOauthCallbackSearch() {
  try { sessionStorage.removeItem(CB_SEARCH_KEY); } catch { /* */ }
}

if (typeof location !== 'undefined') captureOauthCallbackSearch();

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

function sharedCookieAttrs(maxAge = 600) {
  const host = location.hostname;
  const domain = (host === 'polevka.art' || host.endsWith('.polevka.art'))
    ? '; Domain=.polevka.art'
    : '';
  return `Path=/; Max-Age=${maxAge}; SameSite=Lax; Secure${domain}`;
}

function writeCookie(name: string, value: string, maxAge = 600) {
  try {
    document.cookie = `${name}=${encodeURIComponent(value)}; ${sharedCookieAttrs(maxAge)}`;
  } catch { /* */ }
}

function readCookie(name: string): string | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}=([^;]*)`));
    return m?.[1] ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

function clearCookie(name: string) {
  writeCookie(name, '', 0);
}

function writePkce(saved: PkceSaved) {
  const raw = JSON.stringify(saved);
  try { sessionStorage.setItem(PKCE_KEY, raw); } catch { /* */ }
  writeCookie(PKCE_KEY, raw);
}

function readPkce(): string | null {
  try {
    const fromSession = sessionStorage.getItem(PKCE_KEY);
    if (fromSession) return fromSession;
  } catch { /* */ }
  return readCookie(PKCE_KEY);
}

function clearPkce() {
  try { sessionStorage.removeItem(PKCE_KEY); } catch { /* */ }
  clearCookie(PKCE_KEY);
}

export async function loadOauthConfig(): Promise<OAuthPublic> {
  try {
    const data = await apiPublicConfig() as { oauth?: OAuthPublic };
    return data.oauth || {};
  } catch {
    return {};
  }
}

/** Canonical callback on Pages — apex 301 → www breaks some IdP handoffs mid-flight. */
const POLEVKA_OAUTH_CALLBACK = 'https://www.polevka.art/oauth/callback';

function redirectOrigin(cfg: OAuthPublic) {
  const raw = String(cfg.redirectUri || POLEVKA_OAUTH_CALLBACK).trim();
  try { return new URL(raw).origin; } catch { return 'https://www.polevka.art'; }
}

function redirectUriFor(cfg: OAuthPublic) {
  const host = location.hostname;
  if (host === 'polevka.art' || host === 'www.polevka.art' || host.endsWith('.polevka.art')) {
    return POLEVKA_OAUTH_CALLBACK;
  }
  const raw = String(cfg.redirectUri || '').trim();
  if (raw) return raw;
  return `${location.origin}/oauth/callback`;
}

function apexHost(hostname: string) {
  return String(hostname || '').replace(/^www\./i, '').toLowerCase();
}

/**
 * Bridge only when the registered OAuth host is a truly different site.
 * www ↔ apex on polevka.art is the same Pages app — never bridge (cookie drops).
 */
function needsHostBridge(cfg: OAuthPublic) {
  const host = location.hostname;
  if (host === 'polevka.art' || host === 'www.polevka.art' || host.endsWith('.polevka.art')) {
    return false;
  }
  const confOrigin = redirectOrigin(cfg);
  if (location.origin === confOrigin) return false;
  try {
    const confHost = apexHost(new URL(confOrigin).hostname);
    const hereHost = apexHost(location.hostname);
    if (confHost && confHost === hereHost) return false;
  } catch { /* */ }
  return true;
}

function encodeOauthState(intent: OAuthIntent) {
  return `${intent}.${randomString(32)}`;
}

function intentFromOauthState(state: string, fallback: OAuthIntent = 'login'): OAuthIntent {
  const head = String(state || '').split('.')[0];
  return head === 'link' ? 'link' : fallback === 'link' ? 'link' : 'login';
}

function readLocalRefresh() {
  try {
    return localStorage.getItem(REFRESH_KEY) || sessionStorage.getItem(REFRESH_KEY) || '';
  } catch { return ''; }
}

function readLocalRemember() {
  try { return localStorage.getItem(REMEMBER_KEY) === '1'; } catch { return true; }
}

function writeBridgePayload(raw: string) {
  try { sessionStorage.setItem(BRIDGE_KEY, raw); } catch { /* */ }
  writeCookie(BRIDGE_KEY, raw, 300);
}

function readBridgePayload(): string | null {
  try {
    const fromSession = sessionStorage.getItem(BRIDGE_KEY);
    if (fromSession) return fromSession;
  } catch { /* */ }
  return readCookie(BRIDGE_KEY);
}

function clearBridgePayload() {
  try { sessionStorage.removeItem(BRIDGE_KEY); } catch { /* */ }
  clearCookie(BRIDGE_KEY);
}

/**
 * Cross-site handoff when the registered OAuth host is a different site
 * (not www↔apex of the same Pages deployment). Keep the cookie tiny.
 */
function stashBridgeAndGo(cfg: OAuthPublic, provider: OAuthProvider, intent: OAuthIntent, pdConsent: boolean) {
  const targetOrigin = redirectOrigin(cfg);
  const payload: BridgePayload = {
    provider,
    intent,
    pdConsent,
    remember: readLocalRemember(),
    rt: intent === 'link' ? (readLocalRefresh() || undefined) : undefined,
  };
  const raw = JSON.stringify(payload);
  if (raw.length > 3500) {
    throw Object.assign(
      new Error(intent === 'link'
        ? 'Сессия слишком длинная для привязки — откройте сайт без www и повторите'
        : 'Не удалось начать вход — откройте сайт без www и повторите'),
      { code: 'oauth_bridge' },
    );
  }
  writeBridgePayload(raw);
  location.assign(`${targetOrigin}/oauth/bridge`);
}

let bridgeOnce: Promise<boolean> | null = null;

export async function consumeOauthBridge(): Promise<boolean> {
  if (!location.pathname.startsWith('/oauth/bridge')) return false;
  if (bridgeOnce) return bridgeOnce;
  bridgeOnce = (async () => {
    const raw = readBridgePayload();
    if (!raw) {
      throw Object.assign(
        new Error('Сессия входа истекла — нажмите «Войти» через Яндекс или VK ещё раз'),
        { code: 'oauth_bridge' },
      );
    }
    clearBridgePayload();
    const bridge = JSON.parse(raw) as BridgePayload;
    const remember = bridge.remember !== false;
    setRememberMe(remember);
    if (bridge.rt) persistRefreshToken(bridge.rt, remember);
    if (bridge.intent === 'link') {
      const session = await restoreAuthSession().catch(() => null);
      if (!session) {
        throw Object.assign(
          new Error('Войдите снова, затем привяжите соцсеть'),
          { code: 'unauthorized' },
        );
      }
    }
    await beginOAuth(bridge.provider, {
      intent: bridge.intent,
      pdConsent: bridge.pdConsent,
      _bridged: true,
    });
    return true;
  })().catch((err) => {
    bridgeOnce = null;
    throw err;
  });
  return bridgeOnce;
}

export async function beginOAuth(
  provider: OAuthProvider,
  opts?: { pdConsent?: boolean; intent?: OAuthIntent; _bridged?: boolean },
) {
  const cfg = await loadOauthConfig();
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
  const redirectUri = redirectUriFor(cfg);

  if (!opts?._bridged && needsHostBridge(cfg)) {
    stashBridgeAndGo(cfg, provider, intent, !!opts?.pdConsent);
    return;
  }

  // Drop stale PKCE so a cancelled «привязать» cannot turn the next «войти» into link.
  clearPkce();
  clearOauthCallbackSearch();

  const state = encodeOauthState(intent);
  // Yandex confidential clients (client_secret on server) break when mixed with PKCE.
  // VK ID web requires PKCE + device_id.
  const usePkce = provider === 'vk';
  const verifier = usePkce ? randomString(64) : '';
  const challenge = usePkce ? await sha256(verifier) : '';
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
      /* fall through */
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
  const resolved = readOauthCallbackSearch(search);
  const { code, state, deviceId, error, errorDescription } = parseCallbackParams(resolved);
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

  // Prefer intent encoded in state (survives stale PKCE intent field).
  const intent: OAuthIntent = intentFromOauthState(state, saved.intent === 'link' ? 'link' : 'login');
  const exchange = {
    provider: saved.provider,
    code,
    redirectUri: saved.redirectUri || POLEVKA_OAUTH_CALLBACK,
    deviceId: deviceId || undefined,
    ...(saved.verifier ? { codeVerifier: saved.verifier } : {}),
  };

  if (intent === 'link') {
    const session = await restoreAuthSession().catch(() => null);
    if (!session) {
      throw Object.assign(
        new Error('Сессия истекла — войдите снова и повторите привязку'),
        { code: 'unauthorized' },
      );
    }
    const data = await apiOauthLink(exchange);
    clearPkce();
    clearOauthCallbackSearch();
    return { intent, ...data };
  }

  const data = await apiOauthFinish({
    ...exchange,
    pdConsent: !!saved.pdConsent,
    rememberMe: true,
  });
  clearPkce();
  clearOauthCallbackSearch();
  return { intent, ...data };
}

let finishOnce: Promise<Record<string, unknown>> | null = null;
let finishOnceKey = '';

export function finishOAuthFromUrlOnce(search?: string) {
  captureOauthCallbackSearch();
  const key = readOauthCallbackSearch(search || '') || '';
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
