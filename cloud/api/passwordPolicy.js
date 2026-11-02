/**
 * Server-side password strength (NIST-inspired checklist, no client-side "encryption").
 * Passwords arrive over TLS; we hash with scrypt on the server.
 */

const MIN_LEN = 10;
const MAX_LEN = 128;

const COMMON = new Set([
  'password', 'password1', 'password12', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyui', 'iloveyou', 'admin123', 'welcome1', 'monkey123',
  'dragon123', 'master123', 'login123', 'abc12345', '11111111', '00000000',
  'passw0rd', 'letmein1', 'football', 'baseball', 'sunshine', 'princess',
  'пароль123', 'йцукен12', 'админ123', 'полевка1', 'polevka1', 'polevka12',
]);

function normalizeForCheck(password) {
  return String(password || '').trim();
}

/**
 * @returns {{ ok: true } | { ok: false, error: string, message: string }}
 */
function assertPasswordStrength(password, { login = '', email = '' } = {}) {
  const pw = normalizeForCheck(password);
  if (pw.length < MIN_LEN) {
    return {
      ok: false,
      error: 'weak_password',
      message: `Пароль слишком короткий (минимум ${MIN_LEN} символов)`,
    };
  }
  if (pw.length > MAX_LEN) {
    return { ok: false, error: 'weak_password', message: 'Пароль слишком длинный' };
  }
  const lower = pw.toLowerCase();
  if (COMMON.has(lower)) {
    return { ok: false, error: 'weak_password', message: 'Слишком простой пароль — выберите другой' };
  }
  const loginNorm = String(login || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (loginNorm.length >= 3 && lower.includes(loginNorm)) {
    return { ok: false, error: 'weak_password', message: 'Пароль не должен содержать логин' };
  }
  const emailLocal = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  if (emailLocal.length >= 3 && lower.includes(emailLocal)) {
    return { ok: false, error: 'weak_password', message: 'Пароль не должен содержать email' };
  }
  // Reject single-charset short patterns
  if (/^\d+$/.test(pw) || /^[a-zA-Z]+$/.test(pw)) {
    return {
      ok: false,
      error: 'weak_password',
      message: 'Добавьте и буквы, и цифры (или спецсимволы)',
    };
  }
  return { ok: true };
}

module.exports = {
  MIN_LEN,
  MAX_LEN,
  assertPasswordStrength,
};
