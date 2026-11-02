/** Client mirror of cloud/api/passwordPolicy.js — UI hints; server is authoritative. */

export const PASSWORD_MIN_LEN = 10;

const COMMON = new Set([
  'password', 'password1', 'password12', '12345678', '123456789', '1234567890',
  'qwerty123', 'qwertyui', 'iloveyou', 'admin123', 'welcome1', 'monkey123',
  'passw0rd', 'letmein1', 'пароль123', 'полевка1', 'polevka1', 'polevka12',
]);

export function assertPasswordStrength(
  password: string,
  opts?: { login?: string; email?: string },
): { ok: true } | { ok: false; message: string } {
  const pw = String(password || '').trim();
  if (pw.length < PASSWORD_MIN_LEN) {
    return { ok: false, message: `Пароль слишком короткий (минимум ${PASSWORD_MIN_LEN} символов)` };
  }
  if (pw.length > 128) return { ok: false, message: 'Пароль слишком длинный' };
  const lower = pw.toLowerCase();
  if (COMMON.has(lower)) return { ok: false, message: 'Слишком простой пароль — выберите другой' };
  const loginNorm = String(opts?.login || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  if (loginNorm.length >= 3 && lower.includes(loginNorm)) {
    return { ok: false, message: 'Пароль не должен содержать логин' };
  }
  const emailLocal = String(opts?.email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  if (emailLocal.length >= 3 && lower.includes(emailLocal)) {
    return { ok: false, message: 'Пароль не должен содержать email' };
  }
  if (/^\d+$/.test(pw) || /^[a-zA-Z]+$/.test(pw)) {
    return { ok: false, message: 'Добавьте и буквы, и цифры (или спецсимволы)' };
  }
  return { ok: true };
}
