/**
 * VK ID + Yandex ID OAuth code exchange (server-side secrets).
 * Env: YANDEX_OAUTH_CLIENT_ID/SECRET, VK_OAUTH_CLIENT_ID/SECRET, OAUTH_REDIRECT_URI
 */

const YANDEX_OAUTH_CLIENT_ID = process.env.YANDEX_OAUTH_CLIENT_ID || '';
const YANDEX_OAUTH_CLIENT_SECRET = process.env.YANDEX_OAUTH_CLIENT_SECRET || '';
const VK_OAUTH_CLIENT_ID = process.env.VK_OAUTH_CLIENT_ID || '';
const VK_OAUTH_CLIENT_SECRET = process.env.VK_OAUTH_CLIENT_SECRET || '';
// GitHub Pages serves the app on www and 301s apex → www. Callback must be www
// so the OAuth code never depends on that bounce (and IdP redirect_uri matches).
const OAUTH_REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || 'https://www.polevka.art/oauth/callback';

function oauthPublicConfig() {
  return {
    yandex: !!(YANDEX_OAUTH_CLIENT_ID && YANDEX_OAUTH_CLIENT_SECRET),
    // VK ID web + PKCE: client_id достаточно; secret/service_token — опционально
    vk: !!VK_OAUTH_CLIENT_ID,
    yandexClientId: YANDEX_OAUTH_CLIENT_ID || '',
    vkClientId: VK_OAUTH_CLIENT_ID || '',
    redirectUri: OAUTH_REDIRECT_URI,
  };
}

function formBody(fields) {
  return Object.entries(fields)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
}

async function exchangeYandex(code, redirectUri) {
  // Confidential Yandex app: client_secret only — do not mix with PKCE verifier.
  const res = await fetch('https://oauth.yandex.ru/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({
      grant_type: 'authorization_code',
      code,
      client_id: YANDEX_OAUTH_CLIENT_ID,
      client_secret: YANDEX_OAUTH_CLIENT_SECRET,
      redirect_uri: redirectUri || OAUTH_REDIRECT_URI,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const err = new Error(data.error_description || data.error || 'yandex_token_failed');
    err.code = 'oauth_exchange';
    throw err;
  }
  const infoRes = await fetch('https://login.yandex.ru/info?format=json', {
    headers: { Authorization: `OAuth ${data.access_token}` },
  });
  const info = await infoRes.json().catch(() => ({}));
  if (!infoRes.ok || !info.id) {
    const err = new Error('yandex_profile_failed');
    err.code = 'oauth_profile';
    throw err;
  }
  const subject = String(info.id || '').trim();
  if (!subject) {
    const err = new Error('yandex_subject_missing');
    err.code = 'oauth_profile';
    throw err;
  }
  const displayName = String(info.display_name || info.real_name || info.login || `Яндекс ${subject}`).slice(0, 40);
  const email = info.default_email || (Array.isArray(info.emails) ? info.emails[0] : '') || '';
  const avatar = info.is_avatar_empty
    ? ''
    : (info.default_avatar_id
      ? `https://avatars.yandex.net/get-yapic/${info.default_avatar_id}/islands-200`
      : '');
  return {
    provider: 'yandex',
    subject,
    displayName,
    email: String(email || '').slice(0, 200),
    avatar: String(avatar || '').slice(0, 2048),
    loginHint: String(info.login || '').slice(0, 32),
  };
}

async function exchangeVk(code, redirectUri, codeVerifier, deviceId) {
  if (!deviceId) {
    const err = new Error('vk_device_id_required');
    err.code = 'oauth_exchange';
    throw err;
  }
  const res = await fetch('https://id.vk.ru/oauth2/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({
      grant_type: 'authorization_code',
      code,
      client_id: VK_OAUTH_CLIENT_ID,
      ...(VK_OAUTH_CLIENT_SECRET ? { client_secret: VK_OAUTH_CLIENT_SECRET } : {}),
      redirect_uri: redirectUri || OAUTH_REDIRECT_URI,
      code_verifier: codeVerifier,
      device_id: deviceId,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) {
    const err = new Error(data.error_description || data.error || 'vk_token_failed');
    err.code = 'oauth_exchange';
    throw err;
  }
  const infoRes = await fetch('https://id.vk.ru/oauth2/user_info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formBody({
      access_token: data.access_token,
      client_id: VK_OAUTH_CLIENT_ID,
    }),
  });
  const infoWrap = await infoRes.json().catch(() => ({}));
  const info = infoWrap.user || infoWrap;
  const subject = String(info.user_id || info.id || data.user_id || '').trim();
  if (!infoRes.ok || !subject) {
    const err = new Error('vk_profile_failed');
    err.code = 'oauth_profile';
    throw err;
  }
  const first = String(info.first_name || '').trim();
  const last = String(info.last_name || '').trim();
  const displayName = String(info.display_name || [first, last].filter(Boolean).join(' ') || `VK ${subject}`).slice(0, 40);
  return {
    provider: 'vk',
    subject,
    displayName,
    email: String(info.email || data.email || '').slice(0, 200),
    avatar: String(info.avatar || info.photo_200 || '').slice(0, 2048),
    loginHint: '',
  };
}

async function exchangeOAuthCode(provider, { code, redirectUri, codeVerifier, deviceId }) {
  if (provider === 'yandex') {
    if (!YANDEX_OAUTH_CLIENT_ID || !YANDEX_OAUTH_CLIENT_SECRET) {
      const err = new Error('yandex_oauth_not_configured');
      err.code = 'oauth_disabled';
      throw err;
    }
    return exchangeYandex(code, redirectUri);
  }
  if (provider === 'vk') {
    if (!VK_OAUTH_CLIENT_ID) {
      const err = new Error('vk_oauth_not_configured');
      err.code = 'oauth_disabled';
      throw err;
    }
    return exchangeVk(code, redirectUri, codeVerifier, deviceId);
  }
  const err = new Error('bad_provider');
  err.code = 'bad_provider';
  throw err;
}

module.exports = {
  oauthPublicConfig,
  exchangeOAuthCode,
  OAUTH_REDIRECT_URI,
};
