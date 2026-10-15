import { apiOauthFinish, apiPublicConfig } from '@polevka/core';

export type OAuthProvider = 'yandex' | 'vk';

type OAuthPublic = {
  yandex?: boolean;
  vk?: boolean;
  yandexClientId?: string;
  vkClientId?: string;
  redirectUri?: string;
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

export async function loadOauthConfig(): Promise<OAuthPublic> {
  try {
    const data = await apiPublicConfig() as { oauth?: OAuthPublic };
    return data.oauth || {};
  } catch {
    return {};
  }
}

export async function beginOAuth(provider: OAuthProvider, opts?: { pdConsent?: boolean }) {
  const cfg = await loadOauthConfig();
  const redirectUri = cfg.redirectUri || `${location.origin}/oauth/callback`;
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
  // VK ID: state ≥ 32; code_verifier 43–128
  const state = randomString(40);
  const verifier = randomString(64);
  const challenge = await sha256(verifier);
  sessionStorage.setItem(PKCE_KEY, JSON.stringify({
    provider, state, verifier, redirectUri, pdConsent: !!opts?.pdConsent, at: Date.now(),
  }));

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

  const raw = sessionStorage.getItem(PKCE_KEY);
  sessionStorage.removeItem(PKCE_KEY);
  if (!raw) throw Object.assign(new Error('Сессия OAuth истекла — попробуйте снова'), { code: 'oauth_state' });
  const saved = JSON.parse(raw) as {
    provider: OAuthProvider; state: string; verifier: string; redirectUri: string;
    pdConsent?: boolean;
  };
  if (saved.state !== state) {
    throw Object.assign(new Error('Неверный state OAuth'), { code: 'oauth_state' });
  }
  if (saved.provider === 'vk' && !deviceId) {
    throw Object.assign(new Error('VK не вернул device_id'), { code: 'oauth_missing_device' });
  }

  return apiOauthFinish({
    provider: saved.provider,
    code,
    codeVerifier: saved.verifier,
    redirectUri: saved.redirectUri,
    deviceId: deviceId || undefined,
    pdConsent: !!saved.pdConsent,
    rememberMe: true,
  });
}
