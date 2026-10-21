/**
 * Yandex SmartCaptcha server validation.
 * Env: SMARTCAPTCHA_SERVER_KEY (ysc2_…), SMARTCAPTCHA_CLIENT_KEY (ysc1_… public).
 */

const SMARTCAPTCHA_SERVER_KEY = process.env.SMARTCAPTCHA_SERVER_KEY || '';
const SMARTCAPTCHA_CLIENT_KEY = process.env.SMARTCAPTCHA_CLIENT_KEY || '';
const VALIDATE_URL = 'https://smartcaptcha.cloud.yandex.ru/validate';

function configured() {
  return !!(SMARTCAPTCHA_SERVER_KEY && SMARTCAPTCHA_CLIENT_KEY);
}

function publicConfig() {
  return {
    enabled: configured(),
    sitekey: configured() ? SMARTCAPTCHA_CLIENT_KEY : '',
  };
}

/**
 * @param {string} token
 * @param {string} [ip]
 * @returns {Promise<{ ok: boolean, message?: string }>}
 */
async function validateToken(token, ip) {
  if (!configured()) return { ok: true, message: 'captcha_disabled' };
  const t = String(token || '').trim();
  if (!t) return { ok: false, message: 'captcha_required' };

  const body = new URLSearchParams();
  body.set('secret', SMARTCAPTCHA_SERVER_KEY);
  body.set('token', t);
  if (ip) body.set('ip', String(ip).split(',')[0].trim().slice(0, 64));

  let res;
  try {
    res = await fetch(VALIDATE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
  } catch {
    // Fail closed when captcha is configured but Yandex is unreachable.
    return { ok: false, message: 'captcha_unavailable' };
  }

  const data = await res.json().catch(() => ({}));
  if (data && data.status === 'ok') return { ok: true };
  return { ok: false, message: String(data?.message || 'captcha_failed').slice(0, 200) };
}

module.exports = {
  configured,
  publicConfig,
  validateToken,
};
