/**
 * Session cookies, short-lived access JWT, refresh, TOTP, lockout, security events, JSON HMAC.
 * Used by cloud/api/index.js — no secrets logged.
 */
const crypto = require('crypto');

const ACCESS_TTL_SEC = 30 * 60;           // 30 minutes
const REFRESH_TTL_SEC = 60 * 60 * 24 * 14; // 14 days
const ACCESS_COOKIE = 'rosmap_at';
const REFRESH_COOKIE = 'rosmap_rt';
const LOGIN_FAIL_LIMIT = 8;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const SECURITY_EVENTS_KEY = '_auth/security_events.json';
const MAX_SECURITY_EVENTS = 200;
const INTEGRITY_KEYS = new Set([
    'mail.json',
    'profiles.json',
    'map_data.json',
    'feed.json',
    'events.json',
    '_auth/users.json',
    '_auth/private_meta.json'
]);

const loginFails = new Map();

function parseCookies(event, getHeader) {
    const raw = getHeader(event, 'cookie') || '';
    const out = {};
    String(raw).split(';').forEach((part) => {
        const idx = part.indexOf('=');
        if (idx < 0) return;
        const k = part.slice(0, idx).trim();
        const v = part.slice(idx + 1).trim();
        if (k) {
            try { out[k] = decodeURIComponent(v); }
            catch (_) { out[k] = v; }
        }
    });
    return out;
}

function extractTokenFromRequest(event, body, getHeader) {
    const cookies = parseCookies(event, getHeader);
    if (cookies[ACCESS_COOKIE]) return String(cookies[ACCESS_COOKIE]).trim();
    const custom = getHeader(event, 'x-rosmap-token');
    if (custom) return String(custom).trim();
    if (body && body.token) return String(body.token);
    return '';
}

function extractRefreshToken(event, body, getHeader) {
    const cookies = parseCookies(event, getHeader);
    if (cookies[REFRESH_COOKIE]) return String(cookies[REFRESH_COOKIE]).trim();
    if (body && body.refreshToken) return String(body.refreshToken);
    return '';
}

function isHttpsRequest(event, getHeader) {
    const origin = getHeader(event, 'origin') || '';
    if (origin.startsWith('https:')) return true;
    if (origin.startsWith('http://localhost') || origin.startsWith('http://127.0.0.1')) return false;
    const fwd = getHeader(event, 'x-forwarded-proto') || '';
    return String(fwd).toLowerCase().includes('https');
}

function buildSetCookie(name, value, maxAgeSec, event, getHeader) {
    // Cookie ставится на хост Cloud Function (HTTPS). SPA на другом origin → нужен SameSite=None; Secure.
    const max = Math.max(0, maxAgeSec | 0);
    return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; Max-Age=${max}; Secure; SameSite=None`;
}

function clearCookie(name, event, getHeader) {
    return buildSetCookie(name, '', 0, event, getHeader);
}

function issueTokenPair(signJwt, user) {
    const now = Math.floor(Date.now() / 1000);
    const tv = Number(user.tokenVersion || 0) || 0;
    const base = {
        login: user.login,
        role: user.role,
        displayName: user.displayName || user.login,
        tv,
        iat: now
    };
    const access = signJwt({ ...base, typ: 'access', exp: now + ACCESS_TTL_SEC });
    const refresh = signJwt({
        login: user.login,
        tv,
        typ: 'refresh',
        iat: now,
        exp: now + REFRESH_TTL_SEC
    });
    return { access, refresh, accessTtl: ACCESS_TTL_SEC, refreshTtl: REFRESH_TTL_SEC };
}

function sessionCookiesFor(event, getHeader, access, refresh, accessTtl, refreshTtl) {
    return [
        buildSetCookie(ACCESS_COOKIE, access, accessTtl, event, getHeader),
        buildSetCookie(REFRESH_COOKIE, refresh, refreshTtl, event, getHeader)
    ];
}

function clearSessionCookies(event, getHeader) {
    return [
        clearCookie(ACCESS_COOKIE, event, getHeader),
        clearCookie(REFRESH_COOKIE, event, getHeader)
    ];
}

function base32Encode(buf) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    let output = '';
    for (let i = 0; i < buf.length; i++) {
        value = (value << 8) | buf[i];
        bits += 8;
        while (bits >= 5) {
            output += alphabet[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) output += alphabet[(value << (5 - bits)) & 31];
    return output;
}

function base32Decode(str) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const cleaned = String(str || '').toUpperCase().replace(/=+$/, '').replace(/[^A-Z2-7]/g, '');
    let bits = 0;
    let value = 0;
    const out = [];
    for (let i = 0; i < cleaned.length; i++) {
        const idx = alphabet.indexOf(cleaned[i]);
        if (idx < 0) continue;
        value = (value << 5) | idx;
        bits += 5;
        if (bits >= 8) {
            out.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(out);
}

function generateTotpSecret() {
    return base32Encode(crypto.randomBytes(20));
}

function hotp(secretBuf, counter) {
    const buf = Buffer.alloc(8);
    buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buf.writeUInt32BE(counter & 0xffffffff, 4);
    const hmac = crypto.createHmac('sha1', secretBuf).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24)
        | ((hmac[offset + 1] & 0xff) << 16)
        | ((hmac[offset + 2] & 0xff) << 8)
        | (hmac[offset + 3] & 0xff);
    return String(code % 1e6).padStart(6, '0');
}

function verifyTotp(secretBase32, token, window = 1) {
    const code = String(token || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(code)) return false;
    const secret = base32Decode(secretBase32);
    if (!secret.length) return false;
    const step = Math.floor(Date.now() / 1000 / 30);
    for (let w = -window; w <= window; w++) {
        if (hotp(secret, step + w) === code) return true;
    }
    return false;
}

function totpOtpauthUrl(secretBase32, login) {
    const label = encodeURIComponent(`Polevka:${login}`);
    const issuer = encodeURIComponent('Polevka');
    return `otpauth://totp/${label}?secret=${secretBase32}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

function lockKey(ip, login) {
    return `${ip}|${String(login || '').toLowerCase()}`;
}

function checkLoginAllowed(ip, login) {
    const row = loginFails.get(lockKey(ip, login));
    if (!row) return { ok: true };
    if (row.lockedUntil && Date.now() < row.lockedUntil) {
        return { ok: false, retryAfterSec: Math.ceil((row.lockedUntil - Date.now()) / 1000) };
    }
    return { ok: true };
}

function recordLoginFailure(ip, login) {
    const key = lockKey(ip, login);
    const row = loginFails.get(key) || { n: 0, lockedUntil: 0 };
    row.n += 1;
    if (row.n >= LOGIN_FAIL_LIMIT) {
        row.lockedUntil = Date.now() + LOGIN_LOCK_MS;
        row.n = 0;
    }
    loginFails.set(key, row);
    return row;
}

function clearLoginFailures(ip, login) {
    loginFails.delete(lockKey(ip, login));
}

function signIntegrity(bodyUtf8, jwtSecret) {
    return crypto.createHmac('sha256', jwtSecret).update(bodyUtf8).digest('hex');
}

function integrityKeyFor(objectKey) {
    return `_auth/integrity/${String(objectKey).replace(/[^\w.\-/]/g, '_')}.sig`;
}

function needsIntegrity(objectKey) {
    return INTEGRITY_KEYS.has(objectKey) || objectKey.startsWith('_auth/');
}

async function appendSecurityEvent(putJson, getJson, evt) {
    try {
        const list = await getJson(SECURITY_EVENTS_KEY, []);
        const row = {
            id: 'se' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
            at: new Date().toISOString(),
            ...evt
        };
        const next = [row, ...(Array.isArray(list) ? list : [])].slice(0, MAX_SECURITY_EVENTS);
        await putJson(SECURITY_EVENTS_KEY, next, { privateObject: true });
        return row;
    } catch (_) {
        return null;
    }
}

module.exports = {
    ACCESS_TTL_SEC,
    REFRESH_TTL_SEC,
    ACCESS_COOKIE,
    REFRESH_COOKIE,
    SECURITY_EVENTS_KEY,
    parseCookies,
    extractTokenFromRequest,
    extractRefreshToken,
    buildSetCookie,
    clearCookie,
    clearSessionCookies,
    sessionCookiesFor,
    issueTokenPair,
    generateTotpSecret,
    verifyTotp,
    totpOtpauthUrl,
    checkLoginAllowed,
    recordLoginFailure,
    clearLoginFailures,
    signIntegrity,
    integrityKeyFor,
    needsIntegrity,
    appendSecurityEvent
};
