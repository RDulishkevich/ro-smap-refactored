/**
 * RO.SMap Secure API — Yandex Cloud Function
 *
 * Env:
 *   BUCKET            — public Object Storage bucket (default rosmap2026)
 *   PRIVATE_BUCKET    — private bucket for _auth/ and staging/ (default rosmap2026-private)
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY — static keys with write access
 *   STORAGE_ENDPOINT  — https://storage.yandexcloud.net
 *   JWT_SECRET        — long random string for session tokens
 *   ADMIN_PASSWORD    — bootstrap / admin login password (NOT shipped to client)
 *   ALLOWED_ORIGIN    — CORS whitelist, comma-separated
 *                       (default: polevka.art + www + localhost; no GitHub Pages)
 *   YC_TRANSLATE_API_KEY — Yandex Cloud Translate API key (Api-Key …)
 *   YC_FOLDER_ID      — folder id (required with some key types)
 *   YANDEX_MAPS_API_KEY — browser Maps JS key (HTTP Referer lock); exposed only via publicConfig
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM — transactional email
 *   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT — Web Push (device notifications)
 *   ALLOW_DEMO_EMAIL_CODES — set to 1 on staging only: return demoCode when SMTP missing
 *
 * Actions (POST JSON { action, ... }):
 *   health | publicConfig | register | login | refresh | logout | logoutAll | changePassword | me | getMail
 *   | sync | commit | presign | patchSound | translate
 *   | requestEmailVerification | confirmEmailVerification
 *   | requestPasswordReset | confirmPasswordReset | adminDeleteUser | adminUnbindEmail | adminSendEmail
 *   | totpSetup | totpConfirm | totpDisable | getSecurityEvents
 *   | deleteAccount | exportMyData
 *   | savePushSubscription | deletePushSubscription
 *   login rememberMe → persistent refresh cookie (14d); false → session cookie
 */

const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const mailTemplates = require('./mailTemplates');
const sessionSec = require('./sessionSecurity');
const ydbDoc = require('./ydbDoc');
const mailCrypto = require('./mailCrypto');
const webPush = require('./webPush');

let nodemailer = null;
try {
    nodemailer = require('nodemailer');
} catch (_) {
    nodemailer = null;
}

const BUCKET = process.env.BUCKET || 'rosmap2026';
const PRIVATE_BUCKET = process.env.PRIVATE_BUCKET || 'rosmap2026-private';
const ENDPOINT = process.env.STORAGE_ENDPOINT || 'https://storage.yandexcloud.net';
const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const DEFAULT_ALLOWED_ORIGINS = [
    'https://polevka.art',
    'https://www.polevka.art',
    'http://localhost',
    'http://127.0.0.1'
].join(',');
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGINS;
const YC_TRANSLATE_API_KEY = process.env.YC_TRANSLATE_API_KEY || '';
const YC_FOLDER_ID = process.env.YC_FOLDER_ID || '';
/** Browser-only Maps key (HTTP Referer restricted). Served via publicConfig — not committed to frontend. */
const YANDEX_MAPS_API_KEY = process.env.YANDEX_MAPS_API_KEY || '';
const SMTP_HOST = process.env.SMTP_HOST || '';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAIL_FROM = process.env.MAIL_FROM || '';
const ALLOW_DEMO_EMAIL_CODES = String(process.env.ALLOW_DEMO_EMAIL_CODES || '') === '1';

function isLocalDevOrigin(event) {
    const origin = String(getHeader(event, 'origin') || '').toLowerCase();
    return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

function canReturnDemoCode(event) {
    return ALLOW_DEMO_EMAIL_CODES && isLocalDevOrigin(event);
}
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const AUTH_KEY = '_auth/users.json';
const PRIVATE_META_KEY = '_auth/private_meta.json';
const EMAIL_CODES_PREFIX = '_auth/email_codes/';
const PASSWORD_RESET_PREFIX = '_auth/password_resets/';
const ALLOWED_JSON = new Set(['map_data.json', 'profiles.json', 'feed.json', 'mail.json', 'events.json']);
const MEDIA_PREFIXES = ['uploads/', 'audio/', 'images/'];
const TOKEN_TTL_SEC = sessionSec.ACCESS_TTL_SEC; // access JWT (short); refresh via cookie
const MIN_PASSWORD_LEN = 8;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;      // 30 MB — фото/обложки с телефона
const MAX_VIDEO_BYTES = 80 * 1024 * 1024;      // 80 MB — короткое видео в чате
const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;    // 1 GB — длинные WAV / амбисоник
const MAX_JSON_SYNC_BYTES = 2_500_000;
const MAX_SYNC_ROWS = 80;
const MAIL_BOX_PREFIX = '_mail/boxes/';
const LOGIN_LOCKS_KEY = '_auth/login_locks.json';
const RATE_BUCKETS_KEY = '_auth/rate_buckets.json';
const RATE_PERSIST_RE = /^(reg:|login:|emailreq|emailcfm|pwdreq|pwdcfm|admin|totp:|sync:|presign:|patch:|exportdata:)/;
const AUTH_USER_TTL_MS = 8000;
const authUserCache = new Map();
const MAX_INBOX = 200;
const MAX_NOTIFICATIONS = 100;
const MAX_ACTIVITY = 100;
const MAX_MSG_TEXT = 4000;
const MAX_BIO = 2000;
const PROFILE_PII_KEYS = ['email', 'emailVerified', 'skillLevel', 'platformIntents', 'pdConsent', 'pdConsentAt'];
const ALLOWED_MEDIA_CT = /^(image\/(jpeg|jpg|png|webp|gif)|video\/(mp4|quicktime|webm|3gpp)|audio\/(mpeg|mp3|wav|x-wav|wave|mp4|aac|ogg|flac|webm|x-m4a)|application\/json)/i;
const WRITE_RETRIES = 4;
const writeHits = new Map();

class IntegrityError extends Error {
    constructor(key, code = 'integrity_mismatch') {
        super(code);
        this.name = 'IntegrityError';
        this.code = code;
        this.key = key;
    }
}

class WriteConflictError extends Error {
    constructor() {
        super('write_conflict');
        this.name = 'WriteConflictError';
        this.code = 'write_conflict';
    }
}

class ClientError extends Error {
    constructor(status, code, message) {
        super(message || code);
        this.name = 'ClientError';
        this.status = status;
        this.code = code;
    }
}
const DATA_OR_BLOB_RE = /^(data:|blob:)/i;
const HTTP_URL_RE = /^https?:\/\//i;

function normalizeStaffRole(role, login = '') {
    if (String(login || '').toLowerCase() === 'admin') return 'admin';
    const r = String(role || '').toLowerCase();
    if (r === 'admin') return 'admin';
    if (r === 'moderator') return 'moderator';
    return 'user';
}

function isAdminUser(user) {
    return !!user && normalizeStaffRole(user.role, user.login) === 'admin';
}

function isStaffUser(user) {
    const r = user ? normalizeStaffRole(user.role, user.login) : 'user';
    return r === 'admin' || r === 'moderator';
}

/** Request-scoped event for CORS Origin reflection (set at handler entry). */
let __reqEvent = null;

function parseAllowedOrigins(raw) {
    return String(raw || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
}

function isLocalDevOrigin(origin) {
    try {
        const u = new URL(origin);
        return (u.protocol === 'http:' || u.protocol === 'https:')
            && (u.hostname === 'localhost' || u.hostname === '127.0.0.1');
    } catch (_) {
        return false;
    }
}

/** Returns the Origin to echo. Never returns empty for browser Origins (YC may inject *). */
function resolveCorsOrigin(requestOrigin) {
    const rules = parseAllowedOrigins(ALLOWED_ORIGIN);
    if (rules.includes('*')) return '*';
    const fallback = rules.find((r) => r.startsWith('https://')) || rules[0] || 'https://polevka.art';
    if (!requestOrigin) return '';
    if (rules.includes(requestOrigin)) return requestOrigin;
    if (isLocalDevOrigin(requestOrigin)) {
        const allowLocal = rules.some((r) => {
            if (r === 'http://localhost' || r === 'http://127.0.0.1') return true;
            if (r === 'https://localhost' || r === 'https://127.0.0.1') return true;
            try {
                const u = new URL(r);
                return u.hostname === 'localhost' || u.hostname === '127.0.0.1';
            } catch (_) {
                return false;
            }
        });
        if (allowLocal) return requestOrigin;
    }
    // Чужой Origin: отдаём свой домен (не совпадёт → браузер заблокирует), а не пустоту.
    return fallback;
}

function bucketForKey(key) {
    // mail.json — личные сообщения: только private bucket (не публичный CDN)
    if (key === 'mail.json' || key.startsWith('_auth/') || key.startsWith('_mail/') || key.startsWith('staging/')) return PRIVATE_BUCKET;
    return BUCKET;
}

const s3 = new S3Client({
    region: 'ru-central1',
    endpoint: ENDPOINT,
    credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
    },
    forcePathStyle: true
});

const rateBucket = new Map();
let rateHydrated = false;
let rateDirty = false;
let rateFlushAt = 0;
let locksHydrated = false;

function corsHeaders() {
    const requestOrigin = getHeader(__reqEvent, 'origin');
    const allowOrigin = resolveCorsOrigin(requestOrigin);
    const headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Rosmap-Token',
        'Access-Control-Max-Age': '86400',
        'Vary': 'Origin',
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'strict-origin-when-cross-origin',
        'X-Frame-Options': 'DENY'
    };
    if (allowOrigin) {
        headers['Access-Control-Allow-Origin'] = allowOrigin;
        if (allowOrigin !== '*') {
            headers['Access-Control-Allow-Credentials'] = 'true';
        }
    }
    return headers;
}

function isForbiddenMediaUrl(value) {
    return typeof value === 'string' && DATA_OR_BLOB_RE.test(value.trim());
}

function sanitizeMediaUrl(value, { allowEmpty = true } = {}) {
    if (value == null || value === '') return allowEmpty ? '' : null;
    if (typeof value !== 'string') return allowEmpty ? '' : null;
    const v = value.trim();
    if (isForbiddenMediaUrl(v)) return allowEmpty ? '' : null;
    if (!HTTP_URL_RE.test(v) && !v.startsWith('/')) return allowEmpty ? '' : null;
    return v.slice(0, 2048);
}

function stripMailFields(profile = {}) {
    const {
        inbox: _i,
        notifications: _n,
        activityLog: _a,
        ...card
    } = profile;
    return card;
}

function extractMailRecord(profile = {}) {
    const login = String(profile.loginName || '').toLowerCase();
    return {
        loginName: login,
        inbox: Array.isArray(profile.inbox) ? profile.inbox.slice(0, MAX_INBOX) : [],
        notifications: Array.isArray(profile.notifications) ? profile.notifications.slice(0, MAX_NOTIFICATIONS) : [],
        activityLog: Array.isArray(profile.activityLog) ? profile.activityLog.slice(0, MAX_ACTIVITY) : []
    };
}

function sanitizeMessageMedia(msg) {
    if (!msg || typeof msg !== 'object') return msg;
    const out = { ...msg };
    if (out.image !== undefined) {
        const url = sanitizeMediaUrl(out.image, { allowEmpty: true });
        if (url) out.image = url;
        else delete out.image;
    }
    if (out.video !== undefined) {
        const url = sanitizeMediaUrl(out.video, { allowEmpty: true });
        if (url) out.video = url;
        else delete out.video;
    }
    if (out.read) out.read = true;
    if (out.readAt) out.readAt = String(out.readAt);
    if (typeof out.text === 'string') out.text = out.text.slice(0, MAX_MSG_TEXT);
    return out;
}

function sanitizeProfileCard(p) {
    if (!p || typeof p !== 'object') return p;
    const out = stripMailFields(p);
    out.avatar = sanitizeMediaUrl(out.avatar, { allowEmpty: true }) || '';
    if (typeof out.bio === 'string') out.bio = out.bio.slice(0, MAX_BIO);
    if (Array.isArray(out.sessions)) {
        out.sessions = out.sessions.map((s) => {
            if (!s || typeof s !== 'object') return s;
            const photos = Array.isArray(s.photos)
                ? s.photos.map((u) => sanitizeMediaUrl(u, { allowEmpty: false })).filter(Boolean).slice(0, 12)
                : [];
            return { ...s, photos };
        });
    }
    // PII не храним в публичном profiles.json
    PROFILE_PII_KEYS.forEach((k) => { delete out[k]; });
    return out;
}

function extractProfilePii(p = {}) {
    const out = {};
    PROFILE_PII_KEYS.forEach((k) => {
        if (p[k] !== undefined) out[k] = p[k];
    });
    return out;
}

function sanitizeSoundRecord(s) {
    if (!s || typeof s !== 'object') return s;
    const out = { ...s };
    out.url = sanitizeMediaUrl(out.url, { allowEmpty: true }) || '';
    if (Array.isArray(out.images)) {
        out.images = out.images
            .map((u) => sanitizeMediaUrl(u, { allowEmpty: false }))
            .filter(Boolean)
            .slice(0, 3);
    }
    return out;
}

function sanitizeMailRecord(row) {
    if (!row || typeof row !== 'object') return row;
    const login = String(row.loginName || '').toLowerCase();
    return {
        loginName: login,
        inbox: (Array.isArray(row.inbox) ? row.inbox : []).map(sanitizeMessageMedia).slice(0, MAX_INBOX),
        notifications: (Array.isArray(row.notifications) ? row.notifications : []).slice(0, MAX_NOTIFICATIONS),
        activityLog: (Array.isArray(row.activityLog) ? row.activityLog : []).slice(0, MAX_ACTIVITY),
        partners: (Array.isArray(row.partners) ? row.partners : []).map((x) => String(x || '').toLowerCase()).filter(Boolean).slice(0, 200)
    };
}

function respond(statusCode, payload, { cookies } = {}) {
    const headers = corsHeaders();
    const out = {
        statusCode,
        headers,
        body: JSON.stringify(payload)
    };
    if (Array.isArray(cookies) && cookies.length) {
        out.multiValueHeaders = { 'Set-Cookie': cookies };
        // Single-header fallback for runtimes without multiValueHeaders
        if (cookies.length === 1) headers['Set-Cookie'] = cookies[0];
    }
    return out;
}

function rememberFromRequest(event, body) {
    const access = verifyJwt(extractToken(event, body));
    if (access && access.rm === 0) return false;
    const refresh = verifyJwt(sessionSec.extractRefreshToken(event, body, getHeader));
    if (refresh && refresh.rm === 0) return false;
    return true;
}

function authSuccessResponse(user, extra = {}) {
    const remember = extra.rememberMe !== undefined
        ? extra.rememberMe !== false
        : rememberFromRequest(__reqEvent, {});
    const pair = sessionSec.issueTokenPair(signJwt, user, remember);
    const cookies = sessionSec.sessionCookiesFor(
        __reqEvent,
        getHeader,
        pair.access,
        pair.refresh,
        pair.accessTtl,
        pair.refreshTtl
    );
    const { rememberMe: _rm, ...rest } = extra;
    return respond(200, {
        ok: true,
        token: pair.access,
        refreshToken: remember ? pair.refresh : undefined,
        tokenExpiresIn: pair.accessTtl,
        rememberMe: remember,
        user: rest.user || publicUser(user),
        ...rest
    }, { cookies });
}

function parseBody(event) {
    if (!event) return {};
    if (typeof event.body === 'string') {
        try { return JSON.parse(event.body || '{}'); } catch (_) { return {}; }
    }
    if (event.body && typeof event.body === 'object') return event.body;
    if (event.action || event.fileName) return event;
    return {};
}

function getHeader(event, name) {
    const headers = event.headers || {};
    const key = Object.keys(headers).find(k => k.toLowerCase() === name.toLowerCase());
    return key ? headers[key] : '';
}

function rateLimit(key, limit = 60, windowMs = 60000) {
    const now = Date.now();
    const row = rateBucket.get(key) || { n: 0, t: now };
    if (now - row.t > windowMs) {
        row.n = 0;
        row.t = now;
    }
    row.n += 1;
    rateBucket.set(key, row);
    if (RATE_PERSIST_RE.test(key)) rateDirty = true;
    if (rateBucket.size > 2000) {
        for (const [k, v] of rateBucket) {
            if (now - Number(v.t || 0) > 3600000) rateBucket.delete(k);
        }
    }
    return row.n <= limit;
}

async function hydrateRateBuckets() {
    if (rateHydrated) return;
    rateHydrated = true;
    try {
        const snap = await getJson(RATE_BUCKETS_KEY, {});
        const now = Date.now();
        for (const [k, v] of Object.entries(snap || {})) {
            if (!v || now - Number(v.t || 0) > 3600000) continue;
            const cur = rateBucket.get(k);
            if (!cur || Number(v.n) > Number(cur.n)) {
                rateBucket.set(k, { n: Number(v.n) || 0, t: Number(v.t) || now });
            }
        }
    } catch (_) { /* first boot */ }
}

function mergeRateRow(a, b, now) {
    if (!a) return b;
    if (!b) return a;
    if (Math.abs(Number(a.t) - Number(b.t)) > 120000) return Number(a.t) > Number(b.t) ? a : b;
    return {
        n: Math.max(Number(a.n) || 0, Number(b.n) || 0),
        t: Math.min(Number(a.t) || now, Number(b.t) || now)
    };
}

async function flushRateBuckets(force) {
    if (!rateDirty && !force) return;
    const now = Date.now();
    if (!force && now < rateFlushAt) return;
    rateFlushAt = now + 15000;
    const snapshot = {};
    for (const [k, v] of rateBucket.entries()) {
        if (!RATE_PERSIST_RE.test(k)) continue;
        if (now - Number(v.t || 0) > 3600000) continue;
        snapshot[k] = { n: Number(v.n) || 0, t: Number(v.t) || now };
    }
    rateDirty = false;
    try {
        await mutateJson(RATE_BUCKETS_KEY, {}, (cur) => {
            const now2 = Date.now();
            const next = {};
            const keys = new Set([
                ...Object.keys(cur && typeof cur === 'object' ? cur : {}),
                ...Object.keys(snapshot)
            ]);
            for (const k of keys) {
                const pick = mergeRateRow(cur && cur[k], snapshot[k], now2);
                if (pick && now2 - Number(pick.t || 0) < 3600000) {
                    next[k] = { n: Number(pick.n) || 0, t: Number(pick.t) || now2 };
                }
            }
            const ordered = Object.keys(next).sort((x, y) => Number(next[y].t) - Number(next[x].t));
            for (const k of ordered.slice(400)) delete next[k];
            return next;
        }, { privateObject: true });
    } catch (_) {
        rateDirty = true;
    }
}

async function hydrateLoginLocks() {
    if (locksHydrated) return;
    locksHydrated = true;
    try {
        sessionSec.importLoginLocks(await getJson(LOGIN_LOCKS_KEY, {}));
    } catch (_) { /* unlocked */ }
}

function actionRateLimit(action, ip, login = '') {
    const base = String(ip || 'unknown');
    const who = login || base;
    if (action === 'register' && !rateLimit(`reg:${base}`, 8, 60000)) return false;
    if (action === 'login' && !rateLimit(`login:${base}`, 25, 60000)) return false;
    if (action === 'refresh' && !rateLimit(`refresh:${base}`, 60, 60000)) return false;
    if ((action === 'logout' || action === 'logoutAll') && !rateLimit(`logout:${who}`, 30, 60000)) return false;
    // Authenticated write budget — keyed by login so shared NAT doesn't starve one user.
    if ((action === 'sync' || action === 'commit') && !rateLimit(`sync:${who}`, 120, 60000)) return false;
    if (action === 'presign' && !rateLimit(`presign:${who}`, 90, 60000)) return false;
    if (action === 'patchSound' && !rateLimit(`patch:${who}`, 180, 60000)) return false;
    if (action === 'translate' && !rateLimit(`translate:${who}`, 40, 60000)) return false;
    if (action === 'getMail' && !rateLimit(`getmail:${who}`, 120, 60000)) return false;
    if (action === 'requestEmailVerification' && !rateLimit(`emailreq:${who}`, 5, 600000)) return false;
    if (action === 'requestEmailVerification' && !rateLimit(`emailreqip:${base}`, 20, 3600000)) return false;
    if (action === 'confirmEmailVerification' && !rateLimit(`emailcfm:${who}`, 20, 600000)) return false;
    if (action === 'requestPasswordReset' && !rateLimit(`pwdreq:${base}`, 8, 600000)) return false;
    if (action === 'confirmPasswordReset' && !rateLimit(`pwdcfm:${base}`, 20, 600000)) return false;
    if (action === 'deleteAccount' && !rateLimit(`delacc:${who}`, 5, 600000)) return false;
    if (action === 'exportMyData' && !rateLimit(`exportdata:${who}`, 10, 600000)) return false;
    if ((action === 'adminDeleteUser' || action === 'adminUnbindEmail') && !rateLimit(`adminops:${who}`, 20, 600000)) return false;
    if (action === 'adminSendEmail' && !rateLimit(`adminsend:${who}`, 30, 3600000)) return false;
    if (action === 'adminSendEmail' && !rateLimit(`adminsendip:${base}`, 60, 3600000)) return false;
    if ((action === 'totpSetup' || action === 'totpConfirm' || action === 'totpDisable')
        && !rateLimit(`totp:${who}`, 20, 600000)) return false;
    if (action === 'getSecurityEvents' && !rateLimit(`secevt:${who}`, 30, 60000)) return false;
    if ((action === 'savePushSubscription' || action === 'deletePushSubscription')
        && !rateLimit(`pushsub:${who}`, 30, 600000)) return false;
    return true;
}

function b64url(buf) {
    return Buffer.from(buf).toString('base64url');
}

function signJwt(payload) {
    if (!JWT_SECRET) throw new Error('JWT_SECRET is not configured');
    const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const body = b64url(JSON.stringify(payload));
    const data = `${header}.${body}`;
    const sig = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    return `${data}.${sig}`;
}

function verifyJwt(token) {
    if (!token || !JWT_SECRET) return null;
    const parts = String(token).split('.');
    if (parts.length !== 3) return null;
    const data = `${parts[0]}.${parts[1]}`;
    const expect = crypto.createHmac('sha256', JWT_SECRET).update(data).digest('base64url');
    try {
        const a = Buffer.from(expect);
        const b = Buffer.from(String(parts[2]));
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    } catch (_) {
        return null;
    }
    try {
        const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
        if (!payload.exp || Date.now() / 1000 > payload.exp) return null;
        return payload;
    } catch (_) {
        return null;
    }
}

function extractToken(event, body) {
    return sessionSec.extractTokenFromRequest(event, body, getHeader);
}

function normalizeLogin(login) {
    return String(login || '').trim().toLowerCase().replace(/[^a-z0-9_\-\.]/gi, '').slice(0, 32);
}

function hashPassword(password, salt) {
    const s = salt || crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(String(password), s, 64).toString('hex');
    return { salt: s, hash };
}

function verifyPassword(password, salt, hash) {
    if (!salt || !hash) return false;
    const next = crypto.scryptSync(String(password), salt, 64).toString('hex');
    try {
        return crypto.timingSafeEqual(Buffer.from(next, 'hex'), Buffer.from(hash, 'hex'));
    } catch (_) {
        return false;
    }
}

async function streamToString(stream) {
    if (!stream) return '';
    if (typeof stream.transformToString === 'function') return stream.transformToString();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}

async function getObject(key, bucketOverride) {
    try {
        const res = await s3.send(new GetObjectCommand({
            Bucket: bucketOverride || bucketForKey(key),
            Key: key
        }));
        return { text: await streamToString(res.Body), etag: res.ETag || '' };
    } catch (err) {
        if (err && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) return null;
        throw err;
    }
}

async function getJsonRawText(key, bucketOverride) {
    const obj = await getObject(key, bucketOverride);
    return obj ? obj.text : null;
}

async function getJsonRaw(key, fallback, bucketOverride) {
    try {
        const obj = await getObject(key, bucketOverride);
        if (!obj) return fallback;
        const data = JSON.parse(obj.text || 'null');
        return data == null ? fallback : data;
    } catch (err) {
        if (err && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) return fallback;
        throw err;
    }
}

async function verifyIntegrity(key, text) {
    if (!JWT_SECRET || !sessionSec.needsIntegrity(key) || key.startsWith('_auth/integrity/')) return;
    const sigRow = await getJsonRaw(sessionSec.integrityKeyFor(key), null, PRIVATE_BUCKET);
    if (!sigRow || !sigRow.sig) {
        if (sessionSec.integrityRequired(key) && process.env.INTEGRITY_ALLOW_UNSIGNED !== '1') {
            console.error('integrity_missing', key);
            throw new IntegrityError(key, 'integrity_missing');
        }
        return;
    }
    const expect = sessionSec.signIntegrity(text, JWT_SECRET);
    const a = Buffer.from(String(expect));
    const b = Buffer.from(String(sigRow.sig));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
        console.error('integrity_mismatch', key);
        try {
            await sessionSec.appendSecurityEvent(putJson, getJsonRaw, { type: 'integrity_mismatch', key });
        } catch (_) { /* keep fail-closed */ }
        throw new IntegrityError(key);
    }
}

async function publishPublicJson(key, data) {
    const bodyUtf8 = JSON.stringify(data);
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: Buffer.from(bodyUtf8, 'utf8'),
        ContentType: 'application/json; charset=utf-8'
    }));
    if (JWT_SECRET && sessionSec.needsIntegrity(key)) {
        const sig = sessionSec.signIntegrity(bodyUtf8, JWT_SECRET);
        await s3.send(new PutObjectCommand({
            Bucket: PRIVATE_BUCKET,
            Key: sessionSec.integrityKeyFor(key),
            Body: Buffer.from(JSON.stringify({
                key, alg: 'hmac-sha256', sig, at: new Date().toISOString()
            }), 'utf8'),
            ContentType: 'application/json; charset=utf-8',
            ACL: 'private'
        }));
    }
}

async function publishPatchedSoundCache(sound) {
    if (!sound || sound.id == null) return;
    try {
        const obj = await getObject('map_data.json', BUCKET);
        if (!obj?.text) return;
        const list = JSON.parse(obj.text || 'null');
        if (!Array.isArray(list)) return;
        const sid = String(sound.id);
        const idx = list.findIndex((s) => s && String(s.id) === sid);
        if (idx < 0) list.push(sound);
        else list[idx] = { ...list[idx], ...sound };
        await publishPublicJson('map_data.json', list);
    } catch (_) { /* next play republishes */ }
}

async function getJsonCas(key, fallback) {
    if (ydbDoc.enabled() && ydbDoc.resolveKey(key)) {
        return ydbDoc.getJsonCas(key, fallback);
    }
    const obj = await getObject(key);
    if (!obj) return { data: fallback, etag: null, missing: true };
    let data;
    try {
        data = JSON.parse(obj.text || 'null');
    } catch (_) {
        throw new IntegrityError(key, 'json_corrupt');
    }
    if (data == null) throw new IntegrityError(key, 'json_corrupt');
    await verifyIntegrity(key, obj.text);
    return { data, etag: obj.etag || null, missing: false };
}

async function getJson(key, fallback) {
    const row = await getJsonCas(key, fallback);
    return row.data;
}

function stripEtag(etag) {
    return String(etag || '').replace(/^W\//, '').replace(/"/g, '');
}

function isPreconditionFailed(err) {
    const code = String(err?.name || err?.Code || '');
    const status = Number(err?.$metadata?.httpStatusCode || 0);
    return status === 412 || /PreconditionFailed|Precondition/i.test(code);
}

async function putJson(key, data, { privateObject = false, ifMatch } = {}) {
    if (ydbDoc.enabled() && ydbDoc.resolveKey(key)) {
        await ydbDoc.putJson(key, data, { ifMatch });
        if (ydbDoc.PUBLIC_KEYS.has(key)) await publishPublicJson(key, data);
        return;
    }
    const bucket = bucketForKey(key);
    const bodyUtf8 = JSON.stringify(data);
    const params = {
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(bodyUtf8, 'utf8'),
        ContentType: 'application/json; charset=utf-8'
    };
    if (privateObject || bucket === PRIVATE_BUCKET || key.startsWith('_auth/') || key.startsWith('_mail/') || key.startsWith('staging/')) {
        params.ACL = 'private';
    }
    if (ifMatch) params.IfMatch = stripEtag(ifMatch);
    try {
        await s3.send(new PutObjectCommand(params));
    } catch (err) {
        if (ifMatch && isPreconditionFailed(err)) throw new WriteConflictError();
        throw err;
    }
    if (JWT_SECRET && sessionSec.needsIntegrity(key)) {
        const sig = sessionSec.signIntegrity(bodyUtf8, JWT_SECRET);
        const sigBody = Buffer.from(JSON.stringify({
            key,
            alg: 'hmac-sha256',
            sig,
            at: new Date().toISOString()
        }), 'utf8');
        let signed = false;
        for (let i = 0; i < 2 && !signed; i++) {
            try {
                await s3.send(new PutObjectCommand({
                    Bucket: PRIVATE_BUCKET,
                    Key: sessionSec.integrityKeyFor(key),
                    Body: sigBody,
                    ContentType: 'application/json; charset=utf-8',
                    ACL: 'private'
                }));
                signed = true;
            } catch (_) { /* retry once */ }
        }
        if (!signed) throw new IntegrityError(key, 'integrity_write_failed');
    }
}

async function mutateJson(key, fallback, mutator, { privateObject = false } = {}) {
    let last = null;
    for (let attempt = 0; attempt < WRITE_RETRIES; attempt++) {
        const cas = await getJsonCas(key, fallback);
        const next = await mutator(cas.data, cas);
        if (next === undefined) return cas.data;
        try {
            await putJson(key, next, { privateObject, ifMatch: cas.missing ? undefined : cas.etag });
            return next;
        } catch (err) {
            last = err;
            if (err && err.code === 'write_conflict' && attempt < WRITE_RETRIES - 1) continue;
            throw err;
        }
    }
    throw last || new WriteConflictError();
}

async function deletePrivateObject(key) {
    if (ydbDoc.enabled() && ydbDoc.resolveKey(key)) {
        try { await ydbDoc.deleteJson(key); } catch (_) { /* missing row */ }
    }
    try {
        await s3.send(new DeleteObjectCommand({
            Bucket: bucketForKey(key),
            Key: key
        }));
    } catch (_) { /* missing object */ }
}

let publicProfilesScrubbed = false;
async function scrubPublicProfilePii() {
    if (publicProfilesScrubbed) return;
    publicProfilesScrubbed = true;
    try {
        await mutateJson('profiles.json', [], (list) => {
            let dirty = false;
            const next = (list || []).map((p) => {
                if (!p || typeof p !== 'object') return p;
                if (!PROFILE_PII_KEYS.some((k) => p[k] !== undefined)) return p;
                dirty = true;
                return sanitizeProfileCard(p);
            });
            return dirty ? next : undefined;
        });
    } catch (_) {
        publicProfilesScrubbed = false;
    }
}

function anonymizeActorName(login, value) {
    return String(value || '').toLowerCase() === login ? 'Удалённый аккаунт' : value;
}

function anonymizeComments(list, login) {
    return (Array.isArray(list) ? list : []).map((c) => {
        if (!c || typeof c !== 'object') return c;
        const mine = String(c.authorId || '').toLowerCase() === login
            || String(c.author || '').toLowerCase() === login;
        const replies = anonymizeComments(c.replies, login);
        const reactedBy = (Array.isArray(c.reactedBy) ? c.reactedBy : []).filter((x) => String(x).toLowerCase() !== login);
        if (!mine) return { ...c, replies, reactedBy };
        return {
            ...c,
            authorId: 'deleted',
            author: 'Удалённый аккаунт',
            replies,
            reactedBy
        };
    });
}

function stripLoginFromList(list, login) {
    return (Array.isArray(list) ? list : []).filter((x) => String(x || '').toLowerCase() !== login);
}

function withAdmin(users) {
    const next = users && typeof users === 'object' ? { ...users } : {};
    if (!ADMIN_PASSWORD) return next;
    if (next.admin && next.admin.hash) return next;
    const { salt, hash } = hashPassword(ADMIN_PASSWORD);
    next.admin = {
        salt,
        hash,
        displayName: 'Admin',
        role: 'admin',
        createdAt: new Date().toISOString()
    };
    return next;
}

async function mutateAuth(mutator) {
    return mutateJson(AUTH_KEY, {}, async (data) => {
        const users = withAdmin(data);
        return mutator(users);
    }, { privateObject: true });
}

async function mutateMeta(mutator) {
    return mutateJson(PRIVATE_META_KEY, {}, (data) => {
        const meta = data && typeof data === 'object' ? { ...data } : {};
        return mutator(meta);
    }, { privateObject: true });
}

function smtpLog(label, err) {
    console.error(label, err && (err.code || err.name || 'send_failed'));
}

function assertCooldown(login, kind) {
    const wait = {
        message: 1600,
        comment: 2800,
        like: 280,
        play: 800,
        sync: 400,
        publish: 8000
    }[kind] || 500;
    const key = `${String(login || '')}:${kind}`;
    const now = Date.now();
    const prev = writeHits.get(key) || 0;
    if (now - prev < wait) {
        return respond(429, {
            ok: false,
            error: 'slow_down',
            message: 'Слишком часто. Подождите секунду.'
        });
    }
    writeHits.set(key, now);
    if (writeHits.size > 8000) {
        for (const [k, t] of writeHits) {
            if (now - t > 60000) writeHits.delete(k);
        }
    }
    return null;
}

function mergeActorSets(cloud = [], proposed = []) {
    return Array.from(new Set([...cloud, ...proposed].map(String).filter(Boolean)));
}

function verifiedEmailOwner(meta, email) {
    const want = normalizeEmail(email);
    if (!want) return null;
    for (const [login, row] of Object.entries(meta || {})) {
        if (normalizeEmail(row?.email) === want && row?.emailVerified) return normalizeLogin(login);
    }
    return null;
}

async function loadAuthUsers() {
    const users = await getJson(AUTH_KEY, {});
    return users && typeof users === 'object' ? users : {};
}

async function saveAuthUsers(users) {
    await mutateAuth(() => (users && typeof users === 'object' ? users : {}));
}

async function loadPrivateMeta() {
    const meta = await getJson(PRIVATE_META_KEY, {});
    return meta && typeof meta === 'object' ? meta : {};
}

async function savePrivateMeta(meta) {
    await mutateMeta(() => (meta && typeof meta === 'object' ? meta : {}));
}

/** Стирает утечку: старая публичная копия mail.json → []. */
async function scrubPublicMailObject() {
    try {
        await s3.send(new PutObjectCommand({
            Bucket: BUCKET,
            Key: 'mail.json',
            Body: Buffer.from('[]', 'utf8'),
            ContentType: 'application/json; charset=utf-8'
        }));
    } catch (_) {}
}

/**
 * mail.json только из private bucket.
 * Если там пусто — один раз мигрируем из публичного бакета и затираем публичную копию.
 */
async function getMailJson() {
    let data = await getJson('mail.json', null);
    if (Array.isArray(data)) return data;
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: 'mail.json' }));
        const text = await streamToString(res.Body);
        const parsed = JSON.parse(text || '[]');
        if (Array.isArray(parsed)) {
            if (parsed.length) await putJson('mail.json', parsed, { privateObject: true });
            await scrubPublicMailObject();
            return parsed;
        }
    } catch (_) {}
    return [];
}

async function putMailJson(data) {
    await mutateJson('mail.json', [], () => (Array.isArray(data) ? data : []), { privateObject: true });
    await scrubPublicMailObject();
}

function mailBoxKey(login) {
    return `${MAIL_BOX_PREFIX}${normalizeLogin(login)}.json`;
}

function emptyMailBox(login) {
    return {
        loginName: normalizeLogin(login),
        inbox: [],
        notifications: [],
        activityLog: [],
        partners: []
    };
}

function pushSubsKey(login) {
    return `_auth/push/${normalizeLogin(login)}.json`;
}

function sanitizePushSub(raw) {
    const endpoint = String(raw && raw.endpoint ? raw.endpoint : '').trim();
    if (!/^https:\/\/\S{8,2048}$/i.test(endpoint)) return null;
    const keys = raw && raw.keys && typeof raw.keys === 'object' ? raw.keys : {};
    const p256dh = String(keys.p256dh || '').trim();
    const auth = String(keys.auth || '').trim();
    if (p256dh.length < 20 || p256dh.length > 200) return null;
    if (auth.length < 8 || auth.length > 80) return null;
    if (!/^[A-Za-z0-9_-]+$/.test(p256dh) || !/^[A-Za-z0-9_-]+$/.test(auth)) return null;
    return {
        endpoint,
        keys: { p256dh, auth },
        at: new Date().toISOString()
    };
}

async function upsertPushSub(login, sub) {
    await mutateJson(pushSubsKey(login), { loginName: login, subs: [] }, (cur) => {
        const prev = Array.isArray(cur && cur.subs) ? cur.subs : [];
        const next = prev.filter((row) => row && row.endpoint !== sub.endpoint);
        next.unshift(sub);
        return {
            loginName: normalizeLogin(login),
            subs: next.slice(0, 5),
            updatedAt: new Date().toISOString()
        };
    }, { privateObject: true });
}

async function dropPushSub(login, endpoint) {
    const ep = String(endpoint || '').trim();
    if (!ep) {
        await deletePrivateObject(pushSubsKey(login));
        return;
    }
    await mutateJson(pushSubsKey(login), { loginName: login, subs: [] }, (cur) => ({
        loginName: normalizeLogin(login),
        subs: (Array.isArray(cur && cur.subs) ? cur.subs : []).filter((row) => row && row.endpoint !== ep),
        updatedAt: new Date().toISOString()
    }), { privateObject: true });
}

async function notifyUserPush(login, payload) {
    if (!webPush.configured()) return;
    const row = await getJson(pushSubsKey(login), { loginName: login, subs: [] });
    const subs = Array.isArray(row && row.subs) ? row.subs : [];
    if (!subs.length) return;
    const results = await Promise.all(subs.map((sub) => webPush.send(sub, payload)));
    const gone = subs.filter((_, i) => results[i] && results[i].gone).map((sub) => sub.endpoint);
    if (!gone.length) return;
    await mutateJson(pushSubsKey(login), { loginName: login, subs: [] }, (cur) => ({
        loginName: normalizeLogin(login),
        subs: (Array.isArray(cur && cur.subs) ? cur.subs : []).filter((sub) => sub && !gone.includes(sub.endpoint)),
        updatedAt: new Date().toISOString()
    }), { privateObject: true });
}

function inferMailPartners(row, all, login) {
    const me = normalizeLogin(login);
    const partners = new Set((row.partners || []).map((x) => normalizeLogin(x)).filter(Boolean));
    for (const m of row.inbox || []) {
        const from = normalizeLogin(m.fromId);
        if (from && from !== me) partners.add(from);
    }
    for (const other of all || []) {
        const otherLogin = normalizeLogin(other.loginName);
        if (!otherLogin || otherLogin === me) continue;
        if ((other.inbox || []).some((m) => normalizeLogin(m.fromId) === me)) partners.add(otherLogin);
    }
    return Array.from(partners).slice(0, 200);
}

async function loadMailBox(login) {
    const key = mailBoxKey(login);
    const cas = await getJsonCas(key, null);
    if (!cas.missing && cas.data && typeof cas.data === 'object') {
        return sanitizeMailRecord(mailCrypto.decryptMailBox({ ...emptyMailBox(login), ...cas.data }));
    }
    const all = await getMailJson();
    const row = (all || []).find((r) => normalizeLogin(r.loginName) === normalizeLogin(login));
    const box = sanitizeMailRecord({
        ...emptyMailBox(login),
        ...(row || {}),
        partners: inferMailPartners(row || emptyMailBox(login), all, login)
    });
    try {
        await putJson(key, mailCrypto.encryptMailBox(box), { privateObject: true });
    } catch (_) { /* next write will persist */ }
    return box;
}

async function listMailBoxes() {
    if (ydbDoc.enabled()) {
        const rows = await ydbDoc.scanKind('mail');
        return rows.map((row) => sanitizeMailRecord(mailCrypto.decryptMailBox(row)));
    }
    const fromFiles = [];
    const seen = new Set();
    try {
        let token;
        do {
            const res = await s3.send(new ListObjectsV2Command({
                Bucket: PRIVATE_BUCKET,
                Prefix: MAIL_BOX_PREFIX,
                ContinuationToken: token
            }));
            const keys = (res.Contents || []).map((o) => o.Key).filter((k) => k && k.endsWith('.json'));
            const batch = [];
            for (const key of keys) {
                const login = key.slice(MAIL_BOX_PREFIX.length).replace(/\.json$/i, '');
                if (!login || seen.has(login)) continue;
                seen.add(login);
                batch.push(loadMailBox(login));
            }
            const rows = await Promise.all(batch);
            fromFiles.push(...rows);
            token = res.IsTruncated ? res.NextContinuationToken : undefined;
        } while (token);
    } catch (_) { /* fallback below */ }
    const legacy = await getMailJson();
    for (const row of legacy || []) {
        const login = normalizeLogin(row.loginName);
        if (!login || seen.has(login)) continue;
        seen.add(login);
        fromFiles.push(sanitizeMailRecord({
            ...emptyMailBox(login),
            ...row,
            partners: inferMailPartners(row, legacy, login)
        }));
    }
    return fromFiles;
}

async function applyMailMerge(proposed, user) {
    if (!Array.isArray(proposed) || !proposed.length) {
        if (isStaffUser(user)) return (await listMailBoxes()).map(sanitizeMailRecord);
        const mine = await loadMailBox(user.login);
        const boxes = [mine];
        for (const p of mine.partners || []) boxes.push(await loadMailBox(p));
        return projectMailForClient(boxes, user);
    }
    const actor = user.login;
    const targets = new Set([actor]);
    for (const row of proposed || []) {
        const login = normalizeLogin(row.loginName);
        if (login) targets.add(login);
    }
    const fresh = await Promise.all([...targets].map((login) => loadMailBox(login)));
    let merged = mergeMailArrays(fresh, proposed);
    merged = sanitizeMail(fresh, merged, user);

    const actorFresh = fresh.find((r) => normalizeLogin(r.loginName) === actor) || emptyMailBox(actor);
    const partners = new Set([...(actorFresh.partners || [])]);
    for (const row of merged) {
        const login = normalizeLogin(row.loginName);
        if (login === actor) {
            for (const p of row.partners || []) partners.add(normalizeLogin(p));
            continue;
        }
        if ((row.inbox || []).some((m) => normalizeLogin(m.fromId) === actor)) partners.add(login);
    }
    merged = merged.map((row) => {
        if (normalizeLogin(row.loginName) !== actor) return row;
        return sanitizeMailRecord({ ...row, partners: Array.from(partners).filter(Boolean).slice(0, 200) });
    });

    const pushJobs = [];
    for (const row of merged) {
        const login = normalizeLogin(row.loginName);
        if (!login || login === actor) continue;
        const before = fresh.find((r) => normalizeLogin(r.loginName) === login);
        const oldIds = new Set((before && before.inbox ? before.inbox : []).map((m) => m && m.id).filter(Boolean));
        const added = (row.inbox || []).filter((m) => m && m.id && !oldIds.has(m.id)
            && normalizeLogin(m.fromId) === actor && !m.deleted);
        if (!added.length) continue;
        const last = added[added.length - 1];
        pushJobs.push({
            to: login,
            title: String(last.fromName || user.displayName || actor).slice(0, 80) || 'Полёвка',
            body: last.video ? 'Видео' : (last.image ? 'Фото' : 'Новое сообщение'),
            tag: `dm-${actor}`
        });
    }

    for (const row of merged) {
        const login = normalizeLogin(row.loginName);
        await mutateJson(mailBoxKey(login), emptyMailBox(login), (cur) => {
            const plain = mailCrypto.decryptMailBox(cur && cur.loginName ? cur : emptyMailBox(login));
            const base = sanitizeMailRecord(plain);
            const again = mergeMailArrays([base], [row]);
            const sanitized = sanitizeMail([base], again, user);
            const next = sanitized.find((r) => normalizeLogin(r.loginName) === login) || row;
            if (login === actor) next.partners = Array.from(partners).filter(Boolean).slice(0, 200);
            return mailCrypto.encryptMailBox(sanitizeMailRecord(next));
        }, { privateObject: true });
    }

    if (pushJobs.length) {
        await Promise.all(pushJobs.map((job) => notifyUserPush(job.to, {
            title: job.title,
            body: job.body,
            tag: job.tag,
            url: '/messages'
        }).catch(() => {})));
    }

    const extra = [];
    if (!isStaffUser(user)) {
        for (const p of partners) {
            if (merged.some((r) => normalizeLogin(r.loginName) === p)) continue;
            extra.push(await loadMailBox(p));
        }
    }
    return projectMailForClient([...merged, ...extra], user);
}

async function persistLoginLock(ip, login, lockedUntil) {
    const key = `${String(ip || '')}|${normalizeLogin(login)}`;
    await mutateJson(LOGIN_LOCKS_KEY, {}, (locks) => {
        const next = locks && typeof locks === 'object' ? { ...locks } : {};
        next[key] = { lockedUntil, at: new Date().toISOString() };
        const now = Date.now();
        for (const [k, v] of Object.entries(next)) {
            if (!v || Number(v.lockedUntil || 0) < now) delete next[k];
        }
        return next;
    }, { privateObject: true });
}

async function readLoginLock(ip, login) {
    try {
        const locks = await getJson(LOGIN_LOCKS_KEY, {});
        const row = locks && locks[`${String(ip || '')}|${normalizeLogin(login)}`];
        const until = Number(row?.lockedUntil || 0);
        if (until > Date.now()) {
            return { ok: false, retryAfterSec: Math.ceil((until - Date.now()) / 1000) };
        }
    } catch (_) { /* unlocked */ }
    return null;
}

/** Актуальная роль из _auth + profiles (не доверяем JWT.role). */
async function resolveAuthUser(payload) {
    if (!payload?.login) return null;
    if (payload.typ && payload.typ !== 'access') return null;
    const login = String(payload.login).toLowerCase();
    const tvHint = payload.tv != null ? Number(payload.tv) : null;
    const cached = authUserCache.get(login);
    if (cached && Date.now() - cached.at < AUTH_USER_TTL_MS && (tvHint == null || cached.tv === tvHint)) {
        return cached.user;
    }
    const users = await loadAuthUsers();
    const row = users[login];
    if (!row) return null;
    const tv = Number(row.tokenVersion || 0) || 0;
    if (payload.tv != null && Number(payload.tv) !== tv) return null;
    const profiles = await getJson('profiles.json', []);
    const profile = (profiles || []).find((p) => String(p.loginName || '').toLowerCase() === login);
    if (profile?.blocked && login !== 'admin') {
        const blocked = { login, blocked: true, role: 'user', displayName: login, tokenVersion: tv };
        authUserCache.set(login, { at: Date.now(), tv, user: blocked });
        return blocked;
    }
    let role = normalizeStaffRole(row.role, login);
    if (profile?.role) role = normalizeStaffRole(profile.role, login);
    if (profile?.role === 'user' && login !== 'admin') role = 'user';
    const resolved = {
        login,
        role,
        displayName: profile?.displayName || row.displayName || payload.displayName || login,
        blocked: false,
        tokenVersion: tv,
        totpEnabled: !!row.totpEnabled
    };
    authUserCache.set(login, { at: Date.now(), tv, user: resolved });
    return resolved;
}

/** Клиенту не отдаём чужие ящики целиком — только свои + исходящие (для UI чатов). */
function projectMailForClient(mail, user) {
    if (!user) return [];
    if (isStaffUser(user)) return (mail || []).map(sanitizeMailRecord);
    const login = user.login;
    const out = [];
    for (const row of mail || []) {
        const rowLogin = String(row.loginName || '').toLowerCase();
        if (rowLogin === login) {
            out.push(sanitizeMailRecord(row));
            continue;
        }
        const ownOutbound = (row.inbox || []).filter((m) => String(m.fromId || '').toLowerCase() === login);
        if (!ownOutbound.length) continue;
        out.push(sanitizeMailRecord({
            loginName: rowLogin,
            inbox: ownOutbound,
            notifications: [],
            activityLog: []
        }));
    }
    return out;
}

async function ensureAdminUser(users) {
    const next = withAdmin(users);
    if (ADMIN_PASSWORD && (!users || !users.admin || !users.admin.hash) && next.admin && next.admin.hash) {
        try {
            await mutateAuth((u) => withAdmin(u));
        } catch (_) { /* bootstrap best-effort */ }
    }
    return next;
}

function issueToken(user) {
    const pair = sessionSec.issueTokenPair(signJwt, {
        login: user.login,
        role: normalizeStaffRole(user.role, user.login),
        displayName: user.displayName || user.login,
        tokenVersion: user.tokenVersion || 0
    });
    return pair.access;
}

function publicUser(user) {
    return {
        login: user.login,
        loginName: user.login,
        username: user.displayName || user.login,
        displayName: user.displayName || user.login,
        role: normalizeStaffRole(user.role, user.login)
    };
}

function recordTime(item) {
    if (!item) return 0;
    const raw = item.editedAt || item.reactedAt || item.updatedAt || item.date || item.createdAt || item.profileUpdatedAt || 0;
    const t = new Date(raw).getTime();
    return Number.isFinite(t) ? t : 0;
}

function laterIso(a, b) {
    const ta = a ? new Date(a).getTime() : 0;
    const tb = b ? new Date(b).getTime() : 0;
    if (tb > ta) return b || a || '';
    return a || b || '';
}

function mergeReactions(a = {}, b = {}) {
    const out = { ...a };
    Object.keys(b || {}).forEach((emoji) => {
        const set = new Set([...(out[emoji] || []), ...(b[emoji] || [])]);
        if (set.size) out[emoji] = Array.from(set);
        else delete out[emoji];
    });
    return out;
}

function mergeKeyedArrays(a = [], b = [], idKey = 'id') {
    const map = new Map();
    const upsert = (item) => {
        if (!item || item[idKey] == null) return;
        const prev = map.get(item[idKey]);
        if (!prev) { map.set(item[idKey], item); return; }
        const prevT = recordTime(prev);
        const nextT = recordTime(item);
        const newer = nextT >= prevT ? item : prev;
        const older = nextT >= prevT ? prev : item;
        const deleted = !!(newer.deleted || (older.deleted && nextT <= prevT));
        map.set(item[idKey], {
            ...older,
            ...newer,
            deleted: deleted || undefined,
            reactions: mergeReactions(older.reactions, newer.reactions),
            reports: mergeKeyedArrays(older.reports || [], newer.reports || [])
        });
    };
    (a || []).forEach(upsert);
    (b || []).forEach(upsert);
    return Array.from(map.values());
}

function profileScalarRev(p) {
    if (!p?.profileUpdatedAt) return 0;
    const t = new Date(p.profileUpdatedAt).getTime();
    return Number.isFinite(t) ? t : 0;
}

function laterTyping(a, b) {
    const atOf = (t) => (t && t.at ? new Date(t.at).getTime() : (t === null ? 0 : -1));
    if (a === undefined) return b === undefined ? undefined : b;
    if (b === undefined) return a;
    if (!a && !b) return null;
    if (a && !b) return a;
    if (!a && b) return b;
    return atOf(b) >= atOf(a) ? b : a;
}

function mergeCommentLists(a = [], b = []) {
    const map = new Map();
    const upsert = (c) => {
        if (!c?.id) return;
        const prev = map.get(c.id);
        if (!prev) {
            map.set(c.id, { ...c, replies: [...(c.replies || [])], reactedBy: [...(c.reactedBy || [])] });
            return;
        }
        const prevT = recordTime(prev);
        const nextT = recordTime(c);
        const newer = nextT >= prevT ? c : prev;
        const older = nextT >= prevT ? prev : c;
        map.set(c.id, {
            ...older,
            ...newer,
            replies: mergeKeyedArrays(older.replies || [], newer.replies || []),
            // LWW for hearts — union made un-react impossible
            reactedBy: Array.isArray(newer.reactedBy) ? [...newer.reactedBy] : [...(older.reactedBy || [])]
        });
    };
    (a || []).forEach(upsert);
    (b || []).forEach(upsert);
    return Array.from(map.values());
}

function mergeMapDataArrays(fresh = [], proposed = []) {
    const map = new Map();
    (fresh || []).forEach((s) => { if (s?.id != null) map.set(s.id, s); });
    (proposed || []).forEach((s) => {
        if (s?.id == null) return;
        const cloud = map.get(s.id);
        if (!cloud) { map.set(s.id, s); return; }
        // Tombstone всегда побеждает «живую» копию — иначе удаление откатывается.
        if (s.deleted) {
            map.set(s.id, { ...cloud, ...s, deleted: true });
            return;
        }
        if (cloud.deleted) return;
        map.set(s.id, {
            ...cloud,
            ...s,
            comments: mergeCommentLists(cloud.comments || [], s.comments || []),
            reports: mergeKeyedArrays(cloud.reports || [], s.reports || []),
            likedBy: mergeActorSets(cloud.likedBy || [], s.likedBy || []),
            dislikedBy: mergeActorSets(cloud.dislikedBy || [], s.dislikedBy || []),
            plays: Math.max(cloud.plays || 0, s.plays || 0),
            downloads: Math.max(cloud.downloads || 0, s.downloads || 0),
            route: (s.route && s.route.length > 1) ? s.route : (cloud.route || s.route)
        });
    });
    return Array.from(map.values());
}

function mergeFeedPostsArrays(fresh = [], proposed = []) {
    const map = new Map();
    const stamp = (p) => {
        const raw = p?.reactedAt || p?.updatedAt || p?.createdAt || 0;
        const t = new Date(raw).getTime();
        return Number.isFinite(t) ? t : 0;
    };
    const upsert = (p) => {
        if (p?.id == null) return;
        if (p.deleted) {
            map.delete(p.id);
            return;
        }
        const prev = map.get(p.id);
        if (!prev) {
            map.set(p.id, {
                ...p,
                comments: Array.isArray(p.comments) ? p.comments : [],
                reactedBy: Array.isArray(p.reactedBy) ? [...p.reactedBy] : [],
                viewedBy: Array.isArray(p.viewedBy) ? [...p.viewedBy] : []
            });
            return;
        }
        const newer = stamp(p) >= stamp(prev) ? p : prev;
        const older = stamp(p) >= stamp(prev) ? prev : p;
        map.set(p.id, {
            ...older,
            ...newer,
            comments: mergeCommentLists(older.comments || [], newer.comments || []),
            reactedBy: Array.isArray(newer.reactedBy) ? [...newer.reactedBy] : [...(older.reactedBy || [])],
            viewedBy: Array.from(new Set([...(older.viewedBy || []), ...(newer.viewedBy || [])])),
            views: Math.max(Number(older.views) || 0, Number(newer.views) || 0, (newer.viewedBy || older.viewedBy || []).length),
            pinned: Object.prototype.hasOwnProperty.call(newer, 'pinned') ? !!newer.pinned : !!older.pinned,
            pinnedAt: newer.pinned ? (newer.pinnedAt || older.pinnedAt) : undefined
        });
    };
    (fresh || []).forEach(upsert);
    (proposed || []).forEach(upsert);
    return Array.from(map.values()).sort((a, b) => {
        const ap = a.pinned ? 1 : 0;
        const bp = b.pinned ? 1 : 0;
        if (bp !== ap) return bp - ap;
        return stamp(b) - stamp(a);
    });
}

function mergeEventsArrays(fresh = [], proposed = []) {
    const map = new Map();
    const stamp = (e) => {
        const t = new Date(e?.updatedAt || e?.createdAt || 0).getTime();
        return Number.isFinite(t) ? t : 0;
    };
    const mergeParticipants = (a = [], b = []) => {
        const m = new Map();
        [...a, ...b].forEach((p) => {
            if (!p?.login) return;
            const key = String(p.login).toLowerCase();
            const prev = m.get(key);
            if (!prev || stamp(p) >= stamp(prev)) m.set(key, { ...prev, ...p, login: key });
        });
        return Array.from(m.values());
    };
    const upsert = (e) => {
        if (e?.id == null) return;
        if (e.deleted) {
            map.delete(e.id);
            return;
        }
        const prev = map.get(e.id);
        if (!prev) {
            map.set(e.id, { ...e, participants: [...(e.participants || [])], prizes: [...(e.prizes || [])], conditions: [...(e.conditions || [])], winners: [...(e.winners || [])] });
            return;
        }
        const newer = stamp(e) >= stamp(prev) ? e : prev;
        const older = stamp(e) >= stamp(prev) ? prev : e;
        map.set(e.id, {
            ...older,
            ...newer,
            participants: mergeParticipants(older.participants || [], newer.participants || []),
            prizes: Array.isArray(newer.prizes) ? newer.prizes : (older.prizes || []),
            conditions: Array.isArray(newer.conditions) ? newer.conditions : (older.conditions || []),
            winners: Array.isArray(newer.winners) ? newer.winners : (older.winners || []),
            pinned: Object.prototype.hasOwnProperty.call(newer, 'pinned') ? !!newer.pinned : !!older.pinned
        });
    };
    (fresh || []).forEach(upsert);
    (proposed || []).forEach(upsert);
    return Array.from(map.values()).sort((a, b) => stamp(b) - stamp(a));
}

function mergeProfilesArrays(fresh = [], proposed = []) {
    const out = new Map();
    (fresh || []).forEach((p) => {
        if (p?.loginName) out.set(String(p.loginName).toLowerCase(), { ...p, loginName: String(p.loginName).toLowerCase() });
    });
    (proposed || []).forEach((p) => {
        if (!p?.loginName) return;
        const login = String(p.loginName).toLowerCase();
        const cloud = out.get(login);
        if (!cloud) {
            out.set(login, { ...p, loginName: login });
            return;
        }
        const preferProposedScalars = profileScalarRev(p) > profileScalarRev(cloud);
        const merged = preferProposedScalars ? { ...cloud, ...p } : { ...p, ...cloud };
        merged.loginName = login;
        merged.lastSeen = laterIso(cloud.lastSeen, p.lastSeen);
        merged.profileUpdatedAt = laterIso(cloud.profileUpdatedAt, p.profileUpdatedAt);
        // Почта живёт в mail.json — в profiles оставляем только если ещё не разрезали (миграция).
        if (Array.isArray(p.inbox) || Array.isArray(cloud.inbox)) {
            merged.inbox = mergeKeyedArrays(cloud.inbox || [], p.inbox || []);
        }
        if (Array.isArray(p.notifications) || Array.isArray(cloud.notifications)) {
            merged.notifications = mergeKeyedArrays(cloud.notifications || [], p.notifications || []);
        }
        if (Array.isArray(p.activityLog) || Array.isArray(cloud.activityLog)) {
            merged.activityLog = mergeKeyedArrays(cloud.activityLog || [], p.activityLog || []);
        }
        merged.sessions = preferProposedScalars
            ? (p.sessions || [])
            : mergeKeyedArrays(cloud.sessions || [], p.sessions || []);
        if (Object.prototype.hasOwnProperty.call(p, 'typing') || Object.prototype.hasOwnProperty.call(cloud, 'typing')) {
            if (p.typing === null && (!cloud.typing || new Date(p.lastSeen || 0) >= new Date(cloud.typing?.at || 0))) {
                merged.typing = null;
            } else {
                merged.typing = laterTyping(cloud.typing, p.typing === null ? null : p.typing);
            }
        }
        if (!preferProposedScalars) {
            merged.badges = cloud.badges || [];
            merged.bio = cloud.bio;
            merged.avatar = cloud.avatar;
            merged.links = cloud.links;
            merged.gear = cloud.gear;
            merged.email = cloud.email;
            merged.emailVerified = cloud.emailVerified;
            merged.role = cloud.role;
            merged.blocked = cloud.blocked;
            merged.displayName = cloud.displayName || p.displayName;
            merged.progress = cloud.progress || p.progress;
        }
        out.set(login, merged);
    });
    return Array.from(out.values());
}

function mergeMailArrays(fresh = [], proposed = []) {
    const out = new Map();
    (fresh || []).forEach((p) => {
        if (p?.loginName) out.set(String(p.loginName).toLowerCase(), {
            loginName: String(p.loginName).toLowerCase(),
            inbox: Array.isArray(p.inbox) ? p.inbox : [],
            notifications: Array.isArray(p.notifications) ? p.notifications : [],
            activityLog: Array.isArray(p.activityLog) ? p.activityLog : []
        });
    });
    (proposed || []).forEach((p) => {
        if (!p?.loginName) return;
        const login = String(p.loginName).toLowerCase();
        const cloud = out.get(login);
        if (!cloud) {
            out.set(login, {
                loginName: login,
                inbox: Array.isArray(p.inbox) ? p.inbox : [],
                notifications: Array.isArray(p.notifications) ? p.notifications : [],
                activityLog: Array.isArray(p.activityLog) ? p.activityLog : []
            });
            return;
        }
        out.set(login, {
            loginName: login,
            inbox: mergeKeyedArrays(cloud.inbox || [], p.inbox || []),
            notifications: mergeKeyedArrays(cloud.notifications || [], p.notifications || []),
            activityLog: mergeKeyedArrays(cloud.activityLog || [], p.activityLog || [])
        });
    });
    return Array.from(out.values());
}

function ownsSound(sound, login) {
    if (!sound || !login) return false;
    const rid = String(sound.recordistId || '').toLowerCase();
    return rid === login;
}

function sanitizeInbox(cloudInbox = [], proposedInbox = [], actorLogin) {
    const cloudMap = new Map((cloudInbox || []).map((m) => [m.id, m]));
    const out = [];
    for (const msg of proposedInbox || []) {
        if (!msg?.id) continue;
        const prev = cloudMap.get(msg.id);
        if (prev) {
            if (String(prev.fromId || '').toLowerCase() === actorLogin) {
                out.push({ ...msg, fromId: prev.fromId, id: prev.id });
            } else {
                const read = !!(prev.read || msg.read);
                const readAt = read
                    ? String(prev.readAt || msg.readAt || new Date().toISOString())
                    : undefined;
                out.push({ ...prev, read, ...(readAt ? { readAt } : {}) });
            }
            cloudMap.delete(msg.id);
            continue;
        }
        if (String(msg.fromId || '').toLowerCase() === actorLogin) out.push(msg);
    }
    for (const leftover of cloudMap.values()) out.push(leftover);
    return out;
}

function sanitizeProfiles(fresh, merged, user, knownLogins) {
    if (isAdminUser(user)) {
        return (merged || []).map((p) => {
            const login = String(p.loginName || '').toLowerCase();
            return sanitizeProfileCard({
                ...p,
                role: normalizeStaffRole(p.role, login)
            });
        });
    }
    const freshMap = new Map((fresh || []).map((p) => [String(p.loginName || '').toLowerCase(), p]));
    const allowed = knownLogins instanceof Set ? knownLogins : null;
    return (merged || []).filter((p) => {
        const login = String(p.loginName || '').toLowerCase();
        if (!login) return false;
        if (login === user.login) return true;
        if (!freshMap.has(login)) return false;
        if (allowed && !allowed.has(login)) return false;
        return true;
    }).map((p) => {
        const login = String(p.loginName || '').toLowerCase();
        const cloud = freshMap.get(login) || {};
        if (login === user.login) {
            return sanitizeProfileCard({
                ...p,
                role: normalizeStaffRole(cloud.role, login),
                blocked: !!cloud.blocked,
                badges: Array.isArray(cloud.badges) ? cloud.badges : (p.badges || []),
                loginName: login,
                bio: p.bio,
                avatar: p.avatar,
                links: p.links,
                gear: p.gear,
                profileUpdatedAt: laterIso(cloud.profileUpdatedAt, p.profileUpdatedAt)
            });
        }
        return sanitizeProfileCard({
            ...cloud,
            ...p,
            loginName: login,
            role: cloud.role,
            blocked: cloud.blocked,
            badges: cloud.badges,
            bio: cloud.bio,
            avatar: cloud.avatar,
            links: cloud.links,
            gear: cloud.gear,
            email: cloud.email,
            emailVerified: cloud.emailVerified,
            displayName: cloud.displayName || p.displayName,
            progress: cloud.progress || p.progress,
            sessions: cloud.sessions || [],
            typing: p.typing !== undefined ? laterTyping(cloud.typing, p.typing) : cloud.typing,
            lastSeen: laterIso(cloud.lastSeen, p.lastSeen),
            profileUpdatedAt: cloud.profileUpdatedAt
        });
    });
}

function sanitizeMail(fresh, merged, user) {
    if (isStaffUser(user)) {
        return (merged || []).map(sanitizeMailRecord);
    }
    const freshMap = new Map((fresh || []).map((p) => [String(p.loginName || '').toLowerCase(), p]));
    return (merged || []).map((row) => {
        const login = String(row.loginName || '').toLowerCase();
        const cloud = freshMap.get(login) || { loginName: login, inbox: [], notifications: [], activityLog: [] };
        if (login === user.login) {
            return sanitizeMailRecord({
                loginName: login,
                inbox: sanitizeInbox(cloud.inbox || [], row.inbox || [], user.login),
                notifications: mergeKeyedArrays(cloud.notifications || [], row.notifications || []),
                activityLog: mergeKeyedArrays(cloud.activityLog || [], row.activityLog || []),
                partners: Array.from(new Set([...(cloud.partners || []), ...(row.partners || [])]))
            });
        }
        // Чужой ящик: можно только дописать свои исходящие в inbox получателя + нотифы от себя
        return sanitizeMailRecord({
            loginName: login,
            inbox: sanitizeInbox(cloud.inbox || [], row.inbox || [], user.login),
            notifications: mergeKeyedArrays(cloud.notifications || [], (row.notifications || []).filter((n) => {
                return !n?.id || (cloud.notifications || []).some((x) => x.id === n.id) || String(n.fromId || '').toLowerCase() === user.login;
            })),
            activityLog: cloud.activityLog || [],
            partners: cloud.partners || []
        });
    });
}

function forceActorInList(cloudList = [], proposedList, actorLogin) {
    const cloud = (Array.isArray(cloudList) ? cloudList : []).map(String).filter(Boolean);
    const without = cloud.filter((x) => x !== actorLogin);
    if (!Array.isArray(proposedList)) return cloud;
    if (proposedList.map(String).includes(actorLogin)) without.push(actorLogin);
    return without;
}

function sanitizeRepliesForActor(cloudReplies = [], proposedReplies = [], actorLogin) {
    const cloudMap = new Map((cloudReplies || []).map((r) => [r.id, r]));
    const out = [];
    for (const r of proposedReplies || []) {
        if (!r?.id) continue;
        const prev = cloudMap.get(r.id);
        if (prev) {
            if (String(prev.authorId || '').toLowerCase() === actorLogin) {
                out.push({
                    ...prev,
                    ...r,
                    authorId: actorLogin,
                    text: typeof r.text === 'string' ? r.text.slice(0, 2000) : prev.text,
                    reactedBy: forceActorInList(prev.reactedBy, r.reactedBy, actorLogin)
                });
            } else {
                out.push({
                    ...prev,
                    reactedBy: forceActorInList(prev.reactedBy, r.reactedBy, actorLogin)
                });
            }
            cloudMap.delete(r.id);
            continue;
        }
        out.push({
            ...r,
            authorId: actorLogin,
            text: typeof r.text === 'string' ? r.text.slice(0, 2000) : '',
            reactedBy: forceActorInList([], r.reactedBy, actorLogin)
        });
    }
    for (const leftover of cloudMap.values()) out.push(leftover);
    return out;
}

function sanitizeCommentsForActor(cloudComments = [], proposedComments = [], actorLogin) {
    const cloudMap = new Map((cloudComments || []).map((c) => [c.id, c]));
    const out = [];
    for (const c of proposedComments || []) {
        if (!c?.id) continue;
        const prev = cloudMap.get(c.id);
        if (prev) {
            if (String(prev.authorId || '').toLowerCase() === actorLogin) {
                out.push({
                    ...prev,
                    ...c,
                    authorId: actorLogin,
                    text: typeof c.text === 'string' ? c.text.slice(0, 2000) : prev.text,
                    replies: sanitizeRepliesForActor(prev.replies || [], c.replies || [], actorLogin),
                    reactedBy: forceActorInList(prev.reactedBy, c.reactedBy, actorLogin)
                });
            } else {
                out.push({
                    ...prev,
                    replies: sanitizeRepliesForActor(prev.replies || [], c.replies || [], actorLogin),
                    reactedBy: forceActorInList(prev.reactedBy, c.reactedBy, actorLogin)
                });
            }
            cloudMap.delete(c.id);
            continue;
        }
        out.push({
            ...c,
            authorId: actorLogin,
            text: typeof c.text === 'string' ? c.text.slice(0, 2000) : '',
            replies: sanitizeRepliesForActor([], c.replies || [], actorLogin),
            reactedBy: forceActorInList([], c.reactedBy, actorLogin)
        });
    }
    for (const leftover of cloudMap.values()) out.push(leftover);
    return out;
}

function sanitizeMapData(fresh, merged, user) {
    const freshMap = new Map((fresh || []).map((s) => [s.id, s]));
    if (isStaffUser(user)) {
        return (merged || []).map((s) => {
            const cloud = freshMap.get(s.id);
            if (!cloud) return sanitizeSoundRecord(s);
            return sanitizeSoundRecord({
                ...s,
                likedBy: forceActorInList(cloud.likedBy, s.likedBy, user.login),
                dislikedBy: forceActorInList(cloud.dislikedBy, s.dislikedBy, user.login)
            });
        });
    }
    const out = [];
    for (const s of merged || []) {
        const cloud = freshMap.get(s.id);
        if (!cloud) {
            // new record — force ownership
            out.push(sanitizeSoundRecord({
                ...s,
                recordistId: user.login,
                recordist: s.recordist || user.displayName || user.login,
                status: s.status === 'draft' ? 'draft' : 'pending',
                comments: sanitizeCommentsForActor([], s.comments || [], user.login)
            }));
            continue;
        }
        if (ownsSound(cloud, user.login)) {
            out.push(sanitizeSoundRecord({
                ...s,
                recordistId: user.login,
                // non-admin cannot self-publish
                status: s.status === 'published' && cloud.status !== 'published' ? 'pending' : s.status,
                comments: sanitizeCommentsForActor(cloud.comments || [], s.comments || [], user.login),
                likedBy: forceActorInList(cloud.likedBy, s.likedBy, user.login),
                dislikedBy: forceActorInList(cloud.dislikedBy, s.dislikedBy, user.login)
            }));
            continue;
        }
        // foreign sound: allow only social fields from actor
        out.push(sanitizeSoundRecord({
            ...cloud,
            comments: sanitizeCommentsForActor(cloud.comments || [], s.comments || [], user.login),
            reports: mergeKeyedArrays(cloud.reports || [], s.reports || []),
            likedBy: forceActorInList(cloud.likedBy, s.likedBy, user.login),
            dislikedBy: forceActorInList(cloud.dislikedBy, s.dislikedBy, user.login),
            plays: Math.max(cloud.plays || 0, s.plays || 0),
            downloads: Math.max(cloud.downloads || 0, s.downloads || 0)
        }));
    }
    // keep any fresh sounds missing from merged (prevent wipe)
    for (const [id, cloud] of freshMap.entries()) {
        if (!out.some((s) => s.id === id)) out.push(sanitizeSoundRecord(cloud));
    }
    return out;
}

function sanitizeFeed(fresh, merged, user) {
    if (isStaffUser(user)) return merged;
    const freshMap = new Map((fresh || []).map((p) => [p.id, p]));
    const out = [];
    for (const p of merged || []) {
        const cloud = freshMap.get(p.id);
        if (!cloud) {
            // Non-admins cannot create feed posts
            continue;
        }
        if (String(cloud.authorId || '').toLowerCase() === user.login) {
            out.push({
                ...p,
                authorId: user.login,
                comments: sanitizeCommentsForActor(cloud.comments || [], p.comments || [], user.login),
                reactedBy: forceActorInList(cloud.reactedBy, p.reactedBy, user.login)
            });
            continue;
        }
        // Social-only merge on others' posts
        out.push({
            ...cloud,
            comments: sanitizeCommentsForActor(cloud.comments || [], p.comments || [], user.login),
            reactedBy: forceActorInList(cloud.reactedBy, p.reactedBy, user.login),
            reactedAt: p.reactedAt || cloud.reactedAt,
            viewedBy: Array.from(new Set([...(cloud.viewedBy || []), ...(p.viewedBy || [])])),
            views: Math.max(Number(cloud.views) || 0, Number(p.views) || 0),
            updatedAt: p.updatedAt && new Date(p.updatedAt) > new Date(cloud.updatedAt || 0) ? p.updatedAt : cloud.updatedAt
        });
    }
    for (const [id, cloud] of freshMap.entries()) {
        if (!out.some((p) => p.id === id) && !cloud.deleted) out.push(cloud);
    }
    return out;
}

function sanitizeEvents(fresh, merged, user) {
    if (isAdminUser(user)) return merged;
    const freshMap = new Map((fresh || []).map((e) => [e.id, e]));
    const out = [];
    for (const e of merged || []) {
        const cloud = freshMap.get(e.id);
        if (!cloud) continue; // non-admin cannot create events
        // Users may only update their own participant row
        const cloudParts = cloud.participants || [];
        const nextParts = e.participants || [];
        const mine = nextParts.find((p) => String(p.login || '').toLowerCase() === user.login);
        const others = cloudParts.filter((p) => String(p.login || '').toLowerCase() !== user.login);
        const participants = mine
            ? [...others, { ...mine, login: user.login, name: mine.name || user.displayName || user.login }]
            : cloudParts;
        out.push({ ...cloud, participants, updatedAt: e.updatedAt || cloud.updatedAt });
    }
    for (const [id, cloud] of freshMap.entries()) {
        if (!out.some((e) => e.id === id) && !cloud.deleted) out.push(cloud);
    }
    return out;
}

async function handleRegister(body) {
    const login = normalizeLogin(body.login || body.username);
    const password = String(body.password || '');
    const displayName = String(body.displayName || body.username || login).trim().slice(0, 40) || login;
    if (!login || login.length < 2) return respond(400, { ok: false, error: 'bad_login' });
    if (password.length < MIN_PASSWORD_LEN) return respond(400, { ok: false, error: 'weak_password' });
    if (login === 'admin') return respond(403, { ok: false, error: 'reserved_login' });
    if (!body.pdConsent) return respond(400, { ok: false, error: 'pd_consent' });

    const { salt, hash } = hashPassword(password);
    let created = false;
    for (let attempt = 0; attempt < WRITE_RETRIES; attempt++) {
        const usersCas = await getJsonCas(AUTH_KEY, {});
        let users = usersCas.data && typeof usersCas.data === 'object' ? { ...usersCas.data } : {};
        users = await ensureAdminUser(users);
        if (users[login]) return respond(409, { ok: false, error: 'login_taken' });
        users[login] = {
            salt,
            hash,
            displayName,
            role: 'user',
            tokenVersion: 0,
            createdAt: new Date().toISOString()
        };
        try {
            await putJson(AUTH_KEY, users, { privateObject: true, ifMatch: usersCas.missing ? undefined : usersCas.etag });
            created = true;
            break;
        } catch (err) {
            if (err && err.code === 'write_conflict' && attempt < WRITE_RETRIES - 1) continue;
            throw err;
        }
    }
    if (!created) return respond(409, { ok: false, error: 'write_conflict' });

    await mutateMeta((meta) => {
        meta[login] = {
            ...(meta[login] || {}),
            pdConsent: true,
            pdConsentAt: String(body.pdConsentAt || new Date().toISOString()),
            updatedAt: new Date().toISOString()
        };
        return meta;
    });

    await mutateJson('profiles.json', [], (profiles) => {
        const list = Array.isArray(profiles) ? profiles.slice() : [];
        if (list.some((p) => String(p.loginName || '').toLowerCase() === login)) return list;
        list.push({
            loginName: login,
            displayName,
            role: 'user',
            joinedAt: new Date().toISOString(),
            profileUpdatedAt: new Date().toISOString(),
            sessions: [],
            badges: [],
            progress: { xp: 0, achievements: [], completedQuests: [], guessrBestScore: 0 }
        });
        return list;
    });

    await mutateJson(mailBoxKey(login), emptyMailBox(login), (cur) => {
        if (cur && cur.loginName) return sanitizeMailRecord(cur);
        return emptyMailBox(login);
    }, { privateObject: true });

    const user = { login, displayName, role: 'user', tokenVersion: 0 };
    return authSuccessResponse(user);
}

async function handleLogin(event, body) {
    const login = normalizeLogin(body.login || body.username);
    const password = String(body.password || '');
    const totpCode = String(body.totpCode || body.totp || '').trim();
    const ip = getHeader(event, 'x-forwarded-for') || event.requestContext?.identity?.sourceIp || 'unknown';
    const ipKey = String(ip).split(',')[0].trim();

    if (!login || !password) return respond(400, { ok: false, error: 'missing_fields' });

    const lock = sessionSec.checkLoginAllowed(ipKey, login);
    const persistedLock = lock.ok ? await readLoginLock(ipKey, login) : null;
    if (!lock.ok || persistedLock) {
        const blocked = lock.ok ? persistedLock : lock;
        await sessionSec.appendSecurityEvent(putJson, getJson, {
            type: 'login_locked',
            login,
            ip: ipKey
        });
        return respond(429, {
            ok: false,
            error: 'login_locked',
            retryAfterSec: blocked.retryAfterSec,
            message: 'Слишком много неудачных попыток. Попробуйте позже.'
        });
    }

    let users = await loadAuthUsers();
    users = await ensureAdminUser(users);

    if (login === 'admin' && ADMIN_PASSWORD && password === ADMIN_PASSWORD && !users.admin) {
        users = await ensureAdminUser(users);
    }

    const row = users[login];
    if (!row) {
        const fail = sessionSec.recordLoginFailure(ipKey, login);
        if (fail.lockedUntil && fail.lockedUntil > Date.now()) await persistLoginLock(ipKey, login, fail.lockedUntil);
        return respond(401, { ok: false, error: 'bad_credentials' });
    }
    const passwordOk = verifyPassword(password, row.salt, row.hash)
        || (login === 'admin' && ADMIN_PASSWORD && password === ADMIN_PASSWORD && !row.hash);
    if (!passwordOk) {
        const fail = sessionSec.recordLoginFailure(ipKey, login);
        if (fail.lockedUntil && fail.lockedUntil > Date.now()) await persistLoginLock(ipKey, login, fail.lockedUntil);
        await sessionSec.appendSecurityEvent(putJson, getJson, {
            type: 'login_fail',
            login,
            ip: ipKey
        });
        return respond(401, { ok: false, error: 'bad_credentials' });
    }

    const profiles = await getJson('profiles.json', []);
    const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === login);
    if (profile?.blocked && login !== 'admin') {
        return respond(403, { ok: false, error: 'blocked' });
    }
    let role = normalizeStaffRole(row.role, login);
    if (profile?.role) role = normalizeStaffRole(profile.role, login);
    if (profile?.role === 'user' && login !== 'admin') role = 'user';

    if (row.totpEnabled && row.totpSecret) {
        if (!totpCode) {
            return respond(200, {
                ok: true,
                needsTotp: true,
                login,
                message: 'Введите код из приложения 2FA'
            });
        }
        if (!sessionSec.verifyTotp(row.totpSecret, totpCode)) {
            const fail = sessionSec.recordLoginFailure(ipKey, login);
            if (fail.lockedUntil && fail.lockedUntil > Date.now()) await persistLoginLock(ipKey, login, fail.lockedUntil);
            await sessionSec.appendSecurityEvent(putJson, getJson, {
                type: 'totp_fail',
                login,
                ip: ipKey
            });
            return respond(401, { ok: false, error: 'bad_totp' });
        }
    }

    sessionSec.clearLoginFailures(ipKey, login);
    void mutateJson(LOGIN_LOCKS_KEY, {}, (locks) => {
        const next = locks && typeof locks === 'object' ? { ...locks } : {};
        delete next[`${ipKey}|${normalizeLogin(login)}`];
        return next;
    }, { privateObject: true }).catch(() => {});

    const user = {
        login,
        displayName: profile?.displayName || row.displayName || login,
        role,
        tokenVersion: Number(row.tokenVersion || 0) || 0
    };
    const privateMeta = await loadPrivateMeta();
    const pii = privateMeta[login] && typeof privateMeta[login] === 'object' ? privateMeta[login] : {};
    const fromPublic = extractProfilePii(profile || {});
    const mergedPii = { ...fromPublic, ...pii };
    if (PROFILE_PII_KEYS.some((k) => pii[k] === undefined && fromPublic[k] !== undefined)) {
        await mutateMeta((meta) => {
            meta[login] = { ...(meta[login] || {}), ...mergedPii, updatedAt: new Date().toISOString() };
            return meta;
        });
    }
    await sessionSec.appendSecurityEvent(putJson, getJson, {
        type: 'login_ok',
        login,
        ip: ipKey
    });
    const mustEnableTotp = isStaffUser({ login, role }) && !row.totpEnabled;
    return authSuccessResponse(user, {
        rememberMe: body.rememberMe !== false,
        mustEnableTotp,
        user: {
            ...publicUser(user),
            ...extractProfilePii(mergedPii),
            totpEnabled: !!row.totpEnabled,
            mustEnableTotp
        }
    });
}

async function assertStaffTotp(authUser) {
    if (!isStaffUser(authUser)) return null;
    const users = await loadAuthUsers();
    const row = users[authUser.login];
    if (row?.totpEnabled) return null;
    return respond(403, {
        ok: false,
        error: 'totp_required',
        message: 'Для staff обязательна 2FA. Включите в кабинете → Безопасность.'
    });
}

async function handleChangePassword(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const authUser = await resolveAuthUser(payload);
    if (!authUser) return respond(401, { ok: false, error: 'unauthorized' });
    if (authUser.blocked) return respond(403, { ok: false, error: 'blocked' });

    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < MIN_PASSWORD_LEN) return respond(400, { ok: false, error: 'weak_password' });

    const { salt, hash } = hashPassword(newPassword);
    let nextTv = 0;
    await mutateAuth((users) => {
        const row = users[authUser.login];
        if (!row) throw new ClientError(401, 'unauthorized');
        const okCurrent = verifyPassword(currentPassword, row.salt, row.hash)
            || (authUser.login === 'admin' && ADMIN_PASSWORD && currentPassword === ADMIN_PASSWORD);
        if (!okCurrent) throw new ClientError(401, 'bad_credentials');
        nextTv = (Number(row.tokenVersion || 0) || 0) + 1;
        users[authUser.login] = {
            ...row,
            salt,
            hash,
            passwordUpdatedAt: new Date().toISOString(),
            tokenVersion: nextTv
        };
        return users;
    });
    await sessionSec.appendSecurityEvent(putJson, getJson, {
        type: 'password_changed',
        login: authUser.login
    });
    // Re-issue session on this device; other devices invalidated via tokenVersion
    return authSuccessResponse({
        login: authUser.login,
        displayName: authUser.displayName,
        role: authUser.role,
        tokenVersion: nextTv
    });
}

async function handleRefresh(event, body) {
    const refreshTok = sessionSec.extractRefreshToken(event, body, getHeader);
    const payload = verifyJwt(refreshTok);
    if (!payload || payload.typ !== 'refresh' || !payload.login) {
        return respond(401, { ok: false, error: 'unauthorized' }, {
            cookies: sessionSec.clearSessionCookies(event, getHeader)
        });
    }
    const users = await loadAuthUsers();
    const row = users[String(payload.login).toLowerCase()];
    if (!row) {
        return respond(401, { ok: false, error: 'unauthorized' }, {
            cookies: sessionSec.clearSessionCookies(event, getHeader)
        });
    }
    const tv = Number(row.tokenVersion || 0) || 0;
    if (payload.tv != null && Number(payload.tv) !== tv) {
        return respond(401, { ok: false, error: 'unauthorized' }, {
            cookies: sessionSec.clearSessionCookies(event, getHeader)
        });
    }
    const authUser = await resolveAuthUser({
        login: payload.login,
        typ: 'access',
        tv,
        displayName: row.displayName
    });
    if (!authUser || authUser.blocked) {
        return respond(authUser?.blocked ? 403 : 401, {
            ok: false,
            error: authUser?.blocked ? 'blocked' : 'unauthorized'
        }, { cookies: sessionSec.clearSessionCookies(event, getHeader) });
    }
    return authSuccessResponse(authUser, { rememberMe: payload.rm !== 0 });
}

async function handleLogout(event, body) {
    await sessionSec.appendSecurityEvent(putJson, getJson, {
        type: 'logout',
        login: verifyJwt(extractToken(event, body))?.login || ''
    });
    return respond(200, { ok: true }, {
        cookies: sessionSec.clearSessionCookies(event, getHeader)
    });
}

async function handleLogoutAll(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const authUser = await resolveAuthUser(payload);
    if (!authUser) return respond(401, { ok: false, error: 'unauthorized' });
    if (authUser.blocked) return respond(403, { ok: false, error: 'blocked' });

    let nextTv = 0;
    await mutateAuth((users) => {
        const row = users[authUser.login];
        if (!row) throw new ClientError(401, 'unauthorized');
        nextTv = (Number(row.tokenVersion || 0) || 0) + 1;
        users[authUser.login] = { ...row, tokenVersion: nextTv };
        return users;
    });
    await sessionSec.appendSecurityEvent(putJson, getJson, {
        type: 'logout_all',
        login: authUser.login
    });
    return respond(200, { ok: true }, {
        cookies: sessionSec.clearSessionCookies(event, getHeader)
    });
}

async function handleTotpSetup(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const authUser = await resolveAuthUser(payload);
    if (!authUser) return respond(401, { ok: false, error: 'unauthorized' });
    if (authUser.blocked) return respond(403, { ok: false, error: 'blocked' });

    const secret = sessionSec.generateTotpSecret();
    await mutateAuth((users) => {
        const row = users[authUser.login];
        if (!row) throw new ClientError(401, 'unauthorized');
        if (row.totpEnabled) throw new ClientError(400, 'totp_already_enabled');
        users[authUser.login] = {
            ...row,
            totpPendingSecret: secret,
            totpPendingAt: new Date().toISOString()
        };
        return users;
    });
    return respond(200, {
        ok: true,
        secret,
        otpauthUrl: sessionSec.totpOtpauthUrl(secret, authUser.login)
    });
}

async function handleTotpConfirm(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const authUser = await resolveAuthUser(payload);
    if (!authUser) return respond(401, { ok: false, error: 'unauthorized' });
    if (authUser.blocked) return respond(403, { ok: false, error: 'blocked' });

    const code = String(body.totpCode || body.code || '').trim();
    await mutateAuth((users) => {
        const row = users[authUser.login];
        if (!row) throw new ClientError(401, 'unauthorized');
        const secret = row.totpPendingSecret || row.totpSecret;
        if (!secret) throw new ClientError(400, 'totp_not_started');
        if (!sessionSec.verifyTotp(secret, code)) throw new ClientError(401, 'bad_totp');
        users[authUser.login] = {
            ...row,
            totpEnabled: true,
            totpSecret: secret,
            totpEnabledAt: new Date().toISOString()
        };
        delete users[authUser.login].totpPendingSecret;
        delete users[authUser.login].totpPendingAt;
        return users;
    });
    await sessionSec.appendSecurityEvent(putJson, getJson, {
        type: 'totp_enabled',
        login: authUser.login
    });
    return respond(200, { ok: true, totpEnabled: true });
}

async function handleTotpDisable(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const authUser = await resolveAuthUser(payload);
    if (!authUser) return respond(401, { ok: false, error: 'unauthorized' });
    if (authUser.blocked) return respond(403, { ok: false, error: 'blocked' });
    if (isStaffUser(authUser)) {
        return respond(403, {
            ok: false,
            error: 'totp_required_staff',
            message: 'Staff не может отключить 2FA'
        });
    }
    const password = String(body.password || '');
    const code = String(body.totpCode || body.code || '').trim();
    let nextTv = 0;
    await mutateAuth((users) => {
        const row = users[authUser.login];
        if (!row) throw new ClientError(401, 'unauthorized');
        if (!row.totpEnabled) throw new ClientError(400, 'totp_not_enabled');
        const okPass = verifyPassword(password, row.salt, row.hash)
            || (authUser.login === 'admin' && ADMIN_PASSWORD && password === ADMIN_PASSWORD);
        if (!okPass) throw new ClientError(401, 'bad_credentials');
        if (!sessionSec.verifyTotp(row.totpSecret, code)) throw new ClientError(401, 'bad_totp');
        const next = { ...row, totpEnabled: false };
        delete next.totpSecret;
        delete next.totpPendingSecret;
        delete next.totpPendingAt;
        delete next.totpEnabledAt;
        next.tokenVersion = (Number(row.tokenVersion || 0) || 0) + 1;
        nextTv = next.tokenVersion;
        users[authUser.login] = next;
        return users;
    });
    await sessionSec.appendSecurityEvent(putJson, getJson, {
        type: 'totp_disabled',
        login: authUser.login
    });
    return authSuccessResponse({
        login: authUser.login,
        displayName: authUser.displayName,
        role: authUser.role,
        tokenVersion: nextTv
    }, { totpEnabled: false });
}

async function handleGetSecurityEvents(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const authUser = await resolveAuthUser(payload);
    if (!authUser) return respond(401, { ok: false, error: 'unauthorized' });
    if (authUser.blocked) return respond(403, { ok: false, error: 'blocked' });
    const totpBlock = await assertStaffTotp(authUser);
    if (totpBlock) return totpBlock;

    if (authUser.role !== 'admin') return respond(403, { ok: false, error: 'forbidden' });

    const list = await getJson(sessionSec.SECURITY_EVENTS_KEY, []);
    return respond(200, {
        ok: true,
        events: Array.isArray(list) ? list.slice(0, 100) : []
    });
}

function isSmtpConfigured() {
    return !!(SMTP_HOST && SMTP_USER && SMTP_PASS && MAIL_FROM && nodemailer);
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase().slice(0, 254);
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function hashEmailCode(login, code) {
    return crypto.createHmac('sha256', JWT_SECRET || 'email-code')
        .update(`${login}:${code}`)
        .digest('hex');
}

function emailCodeKey(login) {
    return `${EMAIL_CODES_PREFIX}${normalizeLogin(login)}.json`;
}

async function loadEmailCode(login) {
    return getJson(emailCodeKey(login), null);
}

async function saveEmailCode(login, row) {
    await putJson(emailCodeKey(login), row, { privateObject: true });
}

async function clearEmailCode(login) {
    await deletePrivateObject(emailCodeKey(login));
}

async function sendTransactionalMail(to, { subject, text, html, replyTo }) {
    const port = SMTP_PORT || 587;
    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure: Number(port) === 465,
        requireTLS: Number(port) !== 465,
        auth: { user: SMTP_USER, pass: SMTP_PASS }
    });
    const headers = {};
    if (String(SMTP_HOST || '').includes('unisender')) {
        const uniHeaders = { global_language: 'ru', track_links: 0, track_read: 0 };
        if (String(process.env.UNISENDER_SKIP_UNSUBSCRIBE || '') === '1') {
            uniHeaders.skip_unsubscribe = 1;
        }
        headers['X-UNISENDER-GO'] = JSON.stringify(uniHeaders);
    }
    const opts = { from: MAIL_FROM, to, subject, text, html, headers };
    if (replyTo) opts.replyTo = replyTo;
    await transporter.sendMail(opts);
}

function maskEmail(email) {
    const e = normalizeEmail(email);
    const at = e.indexOf('@');
    if (at < 1) return '***';
    const local = e.slice(0, at);
    const domain = e.slice(at + 1);
    const shown = local.length <= 2 ? `${local[0] || '*'}*` : `${local.slice(0, 2)}***`;
    return `${shown}@${domain}`;
}

async function sendVerificationMail(to, code) {
    await sendTransactionalMail(to, mailTemplates.verificationEmail(code));
}

async function sendPasswordResetMail(to, code) {
    await sendTransactionalMail(to, mailTemplates.passwordResetEmail(code));
}

function passwordResetKey(login) {
    return `${PASSWORD_RESET_PREFIX}${normalizeLogin(login)}.json`;
}

async function loadPasswordReset(login) {
    return getJson(passwordResetKey(login), null);
}

async function savePasswordReset(login, row) {
    await putJson(passwordResetKey(login), row, { privateObject: true });
}

async function clearPasswordReset(login) {
    await deletePrivateObject(passwordResetKey(login));
}

async function findLoginByEmailOrLogin(loginOrEmail) {
    const raw = String(loginOrEmail || '').trim().toLowerCase();
    if (!raw) return null;
    if (raw.includes('@')) {
        const email = normalizeEmail(raw);
        if (!isValidEmail(email)) return null;
        const meta = await loadPrivateMeta();
        return verifiedEmailOwner(meta, email);
    }
    const login = normalizeLogin(raw);
    const users = await loadAuthUsers();
    return users[login] ? login : null;
}

async function handleRequestPasswordReset(event, body) {
    const loginOrEmail = String(body.loginOrEmail || '').trim();
    const generic = respond(200, { ok: true, message: 'if_account_exists_email_sent' });

    if (!rateLimit(`pwdreqid:${loginOrEmail.toLowerCase().slice(0, 64)}`, 5, 600000)) {
        return respond(429, { ok: false, error: 'rate_limited' });
    }

    const login = await findLoginByEmailOrLogin(loginOrEmail);
    if (!login || login === 'admin') return generic;

    const meta = await loadPrivateMeta();
    const email = normalizeEmail(meta[login]?.email);
    if (!isValidEmail(email) || !meta[login]?.emailVerified) return generic;

    const smtpOk = isSmtpConfigured();
    if (!smtpOk && !canReturnDemoCode(event)) return generic;

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + PASSWORD_RESET_TTL_MS;
    await savePasswordReset(login, {
        codeHash: hashEmailCode(login, code),
        expiresAt,
        createdAt: new Date().toISOString()
    });

    if (smtpOk) {
        try {
            await sendPasswordResetMail(email, code);
        } catch (err) {
            smtpLog('SMTP password reset failed', err);
            await clearPasswordReset(login);
            return generic;
        }
        return generic;
    }

    return respond(200, { ok: true, message: 'if_account_exists_email_sent', demoCode: code, demo: true });
}

async function handleConfirmPasswordReset(body) {
    const loginOrEmail = String(body.loginOrEmail || '').trim();
    const code = String(body.code || '').trim();
    const newPassword = String(body.newPassword || '');
    if (!/^\d{6}$/.test(code)) return respond(400, { ok: false, error: 'bad_code' });
    if (newPassword.length < MIN_PASSWORD_LEN) return respond(400, { ok: false, error: 'weak_password' });

    const login = await findLoginByEmailOrLogin(loginOrEmail);
    if (!login || login === 'admin') return respond(400, { ok: false, error: 'bad_code' });

    const row = await loadPasswordReset(login);
    if (!row?.codeHash) return respond(400, { ok: false, error: 'bad_code' });
    if (Date.now() > Number(row.expiresAt || 0)) {
        await clearPasswordReset(login);
        return respond(400, { ok: false, error: 'bad_code' });
    }

    const expect = hashEmailCode(login, code);
    try {
        const a = Buffer.from(expect, 'hex');
        const b = Buffer.from(String(row.codeHash), 'hex');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return respond(400, { ok: false, error: 'bad_code' });
        }
    } catch (_) {
        return respond(400, { ok: false, error: 'bad_code' });
    }

    const { salt, hash } = hashPassword(newPassword);
    let savedReset = false;
    for (let attempt = 0; attempt < WRITE_RETRIES; attempt++) {
        const cas = await getJsonCas(AUTH_KEY, {});
        let users = cas.data && typeof cas.data === 'object' ? { ...cas.data } : {};
        users = await ensureAdminUser(users);
        if (!users[login]) return respond(400, { ok: false, error: 'bad_code' });
        const nextTv = (Number(users[login].tokenVersion || 0) || 0) + 1;
        users[login] = {
            ...users[login],
            salt,
            hash,
            passwordUpdatedAt: new Date().toISOString(),
            tokenVersion: nextTv
        };
        try {
            await putJson(AUTH_KEY, users, { privateObject: true, ifMatch: cas.missing ? undefined : cas.etag });
            savedReset = true;
            break;
        } catch (err) {
            if (err && err.code === 'write_conflict' && attempt < WRITE_RETRIES - 1) continue;
            throw err;
        }
    }
    if (!savedReset) throw new WriteConflictError();
    await clearPasswordReset(login);
    await sessionSec.appendSecurityEvent(putJson, getJson, {
        type: 'password_reset',
        login
    });
    return respond(200, { ok: true });
}

function mediaObjectKey(url) {
    const s = String(url || '').split('?')[0];
    const abs = s.match(/storage\.yandexcloud\.net\/rosmap2026\/(.+)$/i);
    if (abs) {
        try { return decodeURIComponent(abs[1]); } catch (_) { return abs[1]; }
    }
    if (s.startsWith('uploads/')) return s.replace(/^\/+/, '');
    return '';
}

async function listPrefixKeys(bucket, prefix) {
    const keys = [];
    let token;
    do {
        const out = await s3.send(new ListObjectsV2Command({
            Bucket: bucket,
            Prefix: prefix,
            ContinuationToken: token
        }));
        for (const obj of out.Contents || []) {
            if (obj.Key) keys.push(obj.Key);
        }
        token = out.IsTruncated ? out.NextContinuationToken : undefined;
    } while (token);
    return keys;
}

async function deleteStorageKeys(bucket, keys) {
    for (let i = 0; i < keys.length; i += 1000) {
        const chunk = keys.slice(i, i + 1000).filter(Boolean);
        if (!chunk.length) continue;
        await s3.send(new DeleteObjectsCommand({
            Bucket: bucket,
            Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true }
        }));
    }
}

async function purgeAccountUploads(login, keepKeys) {
    const keep = keepKeys instanceof Set ? keepKeys : new Set();
    const prefixes = [`uploads/${login}/`, `staging/${login}/`];
    for (const prefix of prefixes) {
        const found = await listPrefixKeys(BUCKET, prefix);
        const drop = found.filter((k) => !keep.has(k));
        if (drop.length) await deleteStorageKeys(BUCKET, drop);
    }
    const priv = await listPrefixKeys(PRIVATE_BUCKET, `staging/${login}/`);
    if (priv.length) await deleteStorageKeys(PRIVATE_BUCKET, priv);
}

function isOwnedSound(s, login) {
    if (!s) return false;
    return String(s.recordistId || '').toLowerCase() === login
        || String(s.user || '').toLowerCase() === login;
}

async function purgeAccountData(target) {
    const login = normalizeLogin(target);
    await mutateAuth((users) => {
        if (!users[login]) throw new ClientError(404, 'no_user');
        delete users[login];
        return users;
    });
    await mutateMeta((meta) => {
        delete meta[login];
        return meta;
    });
    await clearEmailCode(login);
    await clearPasswordReset(login);
    await mutateJson('profiles.json', [], (profiles) => (profiles || []).map((p) => {
        if (String(p.loginName || '').toLowerCase() !== login) return p;
        return sanitizeProfileCard({
            ...p,
            displayName: 'Удалённый аккаунт',
            bio: '',
            avatar: '',
            links: [],
            gear: [],
            blocked: true,
            role: 'user',
            deletedAt: new Date().toISOString(),
            profileUpdatedAt: new Date().toISOString()
        });
    }));
    await deletePrivateObject(mailBoxKey(login));
    await deletePrivateObject(pushSubsKey(login));

    const keepKeys = new Set();
    await mutateJson('map_data.json', [], (sounds) => (sounds || []).map((s) => {
        if (!s || typeof s !== 'object') return s;
        const mine = isOwnedSound(s, login);
        const published = mine && (!s.status || s.status === 'published') && !s.deleted;
        if (published) {
            const u = mediaObjectKey(s.url);
            if (u) keepKeys.add(u);
            for (const img of s.images || []) {
                const k = mediaObjectKey(img);
                if (k) keepKeys.add(k);
            }
        }
        if (mine && !published) {
            return {
                ...s,
                deleted: true,
                status: 'deleted',
                url: '',
                images: [],
                recordistId: 'deleted',
                recordist: 'Удалённый аккаунт',
                user: 'Удалённый аккаунт',
                likedBy: stripLoginFromList(s.likedBy, login),
                dislikedBy: stripLoginFromList(s.dislikedBy, login),
                comments: anonymizeComments(s.comments, login)
            };
        }
        return {
            ...s,
            recordistId: mine ? 'deleted' : s.recordistId,
            recordist: anonymizeActorName(login, s.recordist),
            user: anonymizeActorName(login, s.user),
            likedBy: stripLoginFromList(s.likedBy, login),
            dislikedBy: stripLoginFromList(s.dislikedBy, login),
            comments: anonymizeComments(s.comments, login)
        };
    }));
    await mutateJson('feed.json', [], (posts) => (posts || []).map((p) => {
        if (!p || typeof p !== 'object') return p;
        const mine = String(p.authorId || p.loginName || '').toLowerCase() === login;
        return {
            ...p,
            authorId: mine ? 'deleted' : p.authorId,
            author: anonymizeActorName(login, p.author),
            loginName: mine ? 'deleted' : p.loginName,
            likedBy: stripLoginFromList(p.likedBy, login)
        };
    }));
    try {
        await purgeAccountUploads(login, keepKeys);
    } catch (_) { /* best-effort files */ }
}

async function handleAdminDeleteUser(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const actor = await resolveAuthUser(payload);
    if (!actor || !isAdminUser(actor)) return respond(403, { ok: false, error: 'forbidden' });
    const totpBlock = await assertStaffTotp(actor);
    if (totpBlock) return totpBlock;

    const target = normalizeLogin(body.login);
    if (!target || target === 'admin' || target === actor.login || target === 'support') {
        return respond(400, { ok: false, error: 'bad_login' });
    }
    await purgeAccountData(target);
    await sessionSec.appendSecurityEvent(putJson, getJson, { type: 'account_deleted', login: target, by: actor.login });
    return respond(200, { ok: true, login: target });
}

async function handleDeleteAccount(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    if (user.login === 'admin' || user.login === 'support') {
        return respond(400, { ok: false, error: 'protected_account' });
    }

    const password = String(body.password || '');
    const totpCode = String(body.totpCode || body.totp || '').trim();
    const users = await loadAuthUsers();
    const row = users[user.login];
    if (!row) return respond(401, { ok: false, error: 'unauthorized' });
    if (!verifyPassword(password, row.salt, row.hash)) {
        return respond(401, { ok: false, error: 'bad_credentials' });
    }
    if (row.totpEnabled && row.totpSecret) {
        if (!sessionSec.verifyTotp(row.totpSecret, totpCode)) {
            return respond(401, { ok: false, error: 'bad_totp' });
        }
    }

    await purgeAccountData(user.login);
    await sessionSec.appendSecurityEvent(putJson, getJson, { type: 'account_deleted', login: user.login, by: user.login });
    return respond(200, { ok: true }, { cookies: sessionSec.clearSessionCookies(event, getHeader) });
}

async function handleSavePushSubscription(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    const sub = sanitizePushSub(body.subscription || body);
    if (!sub) return respond(400, { ok: false, error: 'bad_subscription' });
    await upsertPushSub(user.login, sub);
    return respond(200, { ok: true });
}

async function handleDeletePushSubscription(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    await dropPushSub(user.login, body.endpoint);
    return respond(200, { ok: true });
}

async function handleExportMyData(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    const totpBlock = await assertStaffTotp(user);
    if (totpBlock) return totpBlock;

    const [profiles, sounds, feed, meta] = await Promise.all([
        getJson('profiles.json', []),
        getJson('map_data.json', []),
        getJson('feed.json', []),
        loadPrivateMeta()
    ]);
    const login = user.login;
    const profile = (profiles || []).find((p) => String(p.loginName || '').toLowerCase() === login) || null;
    const pii = meta[login] && typeof meta[login] === 'object' ? { ...meta[login] } : {};
    const mail = await loadMailBox(login);
    const pushRow = await getJson(pushSubsKey(login), { subs: [] });
    return respond(200, {
        ok: true,
        data: {
            exportedAt: new Date().toISOString(),
            login,
            profile: profile ? sanitizeProfileCard(profile) : null,
            private: {
                email: pii.email || '',
                emailVerified: !!pii.emailVerified,
                pdConsent: !!pii.pdConsent,
                pdConsentAt: pii.pdConsentAt || '',
                skillLevel: pii.skillLevel,
                platformIntents: pii.platformIntents
            },
            mail: sanitizeMailRecord(mail),
            pushEndpoints: (Array.isArray(pushRow && pushRow.subs) ? pushRow.subs : [])
                .map((row) => row && row.endpoint).filter(Boolean),
            sounds: (sounds || []).filter((s) => isOwnedSound(s, login)),
            posts: (feed || []).filter((p) => String(p.authorId || p.loginName || '').toLowerCase() === login)
        }
    });
}

async function handleAdminUnbindEmail(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const actor = await resolveAuthUser(payload);
    if (!actor || !isAdminUser(actor)) return respond(403, { ok: false, error: 'forbidden' });
    const totpBlock = await assertStaffTotp(actor);
    if (totpBlock) return totpBlock;

    const target = normalizeLogin(body.login);
    if (!target) return respond(400, { ok: false, error: 'bad_login' });

    await mutateMeta((meta) => {
        const prev = meta[target] && typeof meta[target] === 'object' ? meta[target] : {};
        meta[target] = {
            ...prev,
            email: '',
            emailVerified: false,
            emailVerifiedAt: '',
            updatedAt: new Date().toISOString()
        };
        return meta;
    });
    await clearEmailCode(target);
    return respond(200, { ok: true, login: target });
}

async function handleAdminSendEmail(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const actor = await resolveAuthUser(payload);
    if (!actor || !isStaffUser(actor)) return respond(403, { ok: false, error: 'forbidden' });
    if (actor.blocked) return respond(403, { ok: false, error: 'blocked' });
    const totpBlock = await assertStaffTotp(actor);
    if (totpBlock) return totpBlock;

    const target = normalizeLogin(body.login);
    if (!target) return respond(400, { ok: false, error: 'bad_login' });

    const subject = String(body.subject || 'Сообщение от поддержки Полёвки').trim().slice(0, 120);
    const message = String(body.message || body.text || '').trim().slice(0, 4000);
    if (!message || message.length < 2) return respond(400, { ok: false, error: 'bad_message' });

    const users = await loadAuthUsers();
    if (!users[target]) return respond(404, { ok: false, error: 'no_user' });

    const meta = await loadPrivateMeta();
    const row = meta[target] && typeof meta[target] === 'object' ? meta[target] : {};
    const email = normalizeEmail(row.email);
    if (!isValidEmail(email) || !row.emailVerified) {
        return respond(400, { ok: false, error: 'email_unavailable', message: 'User has no verified email' });
    }

    if (!isSmtpConfigured()) {
        return respond(503, { ok: false, error: 'mail_not_configured' });
    }

    const fromLabel = isAdminUser(actor) ? 'Администратор Полёвки' : 'Модератор Полёвки';
    const tpl = mailTemplates.staffMessageEmail({ subject, message, fromLabel });
    try {
        await sendTransactionalMail(email, {
            ...tpl,
            replyTo: 'support@polevka.art'
        });
    } catch (err) {
        smtpLog('SMTP staff message failed', err);
        return respond(502, { ok: false, error: 'mail_send_failed' });
    }

    return respond(200, {
        ok: true,
        login: target,
        toMasked: maskEmail(email),
        subject: tpl.subject
    });
}

async function handleRequestEmailVerification(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });

    const email = normalizeEmail(body.email);
    if (!isValidEmail(email)) return respond(400, { ok: false, error: 'bad_email' });

    const privateMeta = await loadPrivateMeta();
    const existing = privateMeta[user.login] || {};
    if (existing.emailVerified && normalizeEmail(existing.email) === email) {
        return respond(200, { ok: true, alreadyVerified: true });
    }
    const taken = verifiedEmailOwner(privateMeta, email);
    if (taken && taken !== user.login) {
        return respond(200, { ok: true, expiresAt: Date.now() + EMAIL_CODE_TTL_MS });
    }

    const smtpOk = isSmtpConfigured();
    if (!smtpOk && !canReturnDemoCode(event)) {
        return respond(503, {
            ok: false,
            error: 'mail_not_configured',
            message: 'Email delivery is not configured yet'
        });
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + EMAIL_CODE_TTL_MS;
    await saveEmailCode(user.login, {
        email,
        codeHash: hashEmailCode(user.login, code),
        expiresAt,
        createdAt: new Date().toISOString()
    });

    if (smtpOk) {
        try {
            await sendVerificationMail(email, code);
        } catch (err) {
            smtpLog('SMTP send failed', err);
            await clearEmailCode(user.login);
            return respond(502, { ok: false, error: 'mail_send_failed' });
        }
        return respond(200, { ok: true, expiresAt });
    }

    return respond(200, {
        ok: true,
        expiresAt,
        demoCode: code,
        demo: true
    });
}

async function handleConfirmEmailVerification(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });

    const code = String(body.code || '').trim();
    if (!/^\d{6}$/.test(code)) return respond(400, { ok: false, error: 'bad_code' });

    const row = await loadEmailCode(user.login);
    if (!row || !row.codeHash || !row.email) {
        return respond(400, { ok: false, error: 'no_pending_code' });
    }
    if (Date.now() > Number(row.expiresAt || 0)) {
        await clearEmailCode(user.login);
        return respond(400, { ok: false, error: 'code_expired' });
    }

    const expect = hashEmailCode(user.login, code);
    try {
        const a = Buffer.from(expect, 'hex');
        const b = Buffer.from(String(row.codeHash), 'hex');
        if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
            return respond(400, { ok: false, error: 'bad_code' });
        }
    } catch (_) {
        return respond(400, { ok: false, error: 'bad_code' });
    }

    const email = normalizeEmail(row.email);
    let savedEmail = email;
    try {
    await mutateMeta((meta) => {
        const taken = verifiedEmailOwner(meta, email);
        if (taken && taken !== user.login) {
            throw new ClientError(409, 'email_taken', 'Этот email уже подтверждён на другом аккаунте');
        }
        meta[user.login] = {
            ...(meta[user.login] || {}),
            email,
            emailVerified: true,
            emailVerifiedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        savedEmail = meta[user.login].email;
        return meta;
    });
    } catch (err) {
        if (err && err.code === 'email_taken') await clearEmailCode(user.login);
        throw err;
    }
    await clearEmailCode(user.login);

    return respond(200, {
        ok: true,
        email: savedEmail,
        emailVerified: true
    });
}

async function handleMe(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });

    const privateMeta = await loadPrivateMeta();
    let pii = privateMeta[user.login] && typeof privateMeta[user.login] === 'object'
        ? { ...privateMeta[user.login] }
        : {};

    const profiles = await getJson('profiles.json', []);
    const profile = (profiles || []).find((p) => String(p.loginName || '').toLowerCase() === user.login);
    const fromPublic = extractProfilePii(profile || {});
    if (Object.keys(fromPublic).length) {
        const mergedPii = { ...fromPublic, ...pii };
        const needsSave = PROFILE_PII_KEYS.some((k) => pii[k] === undefined && fromPublic[k] !== undefined);
        if (needsSave) {
            await mutateMeta((meta) => {
                meta[user.login] = { ...(meta[user.login] || {}), ...mergedPii, updatedAt: new Date().toISOString() };
                return meta;
            });
        }
        pii = mergedPii;
        if (profile && PROFILE_PII_KEYS.some((k) => profile[k] !== undefined)) {
            await mutateJson('profiles.json', [], (list) => (list || []).map((p) => (
                String(p.loginName || '').toLowerCase() === user.login ? sanitizeProfileCard(p) : p
            )));
        }
    }

    const mustEnableTotp = isStaffUser(user) && !user.totpEnabled;
    return authSuccessResponse(user, {
        mustEnableTotp,
        user: {
            ...publicUser(user),
            ...extractProfilePii(pii),
            totpEnabled: !!user.totpEnabled,
            mustEnableTotp
        }
    });
}

async function handleGetMail(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    const totpBlock = await assertStaffTotp(user);
    if (totpBlock) return totpBlock;
    if (isAdminUser(user)) {
        const all = await listMailBoxes();
        return respond(200, { ok: true, data: all.map(sanitizeMailRecord) });
    }
    if (isStaffUser(user)) {
        const [mine, support] = await Promise.all([loadMailBox(user.login), loadMailBox('support')]);
        return respond(200, { ok: true, data: [mine, support].map(sanitizeMailRecord) });
    }
    const mine = await loadMailBox(user.login);
    const partners = (mine.partners || []).map((p) => normalizeLogin(p)).filter(Boolean);
    const extra = await Promise.all(partners.map((p) => loadMailBox(p)));
    return respond(200, { ok: true, data: projectMailForClient([mine, ...extra], user) });
}

async function handleSync(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    const totpBlock = await assertStaffTotp(user);
    if (totpBlock) return totpBlock;

    const fileName = String(body.fileName || '');
    if (!ALLOWED_JSON.has(fileName)) return respond(400, { ok: false, error: 'bad_file' });

    const proposed = Array.isArray(body.data) ? body.data : null;
    if (!proposed) return respond(400, { ok: false, error: 'bad_data' });

    // Крупные базы не влезают в HTTP-триггер (~3.5MB) — используйте staging+commit
    const approx = Buffer.byteLength(JSON.stringify(proposed), 'utf8');
    if (approx > MAX_JSON_SYNC_BYTES) {
        return respond(413, {
            ok: false,
            error: 'payload_too_large',
            message: 'Use staging upload + action=commit'
        });
    }

    if (!isStaffUser(user) && proposed.length > MAX_SYNC_ROWS) {
        return respond(413, {
            ok: false,
            error: 'too_many_rows',
            message: 'Send changed rows only'
        });
    }

    const cool = assertCooldown(user.login, fileName === 'mail.json' ? 'message' : 'sync');
    if (cool) return cool;

    return applyMergeAndSave(fileName, proposed, user);
}

/**
 * Lightweight social/metrics patch — avoids rewriting the whole map_data.json from the client.
 * ops: { incPlays?, incDownloads?, reaction?: 'like'|'dislike', reactionSet?: boolean }
 */
async function handlePatchSound(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    const totpBlock = await assertStaffTotp(user);
    if (totpBlock) return totpBlock;


    const soundId = String(body.soundId || '').trim();
    if (!soundId) return respond(400, { ok: false, error: 'bad_sound_id' });

    const ops = body.ops && typeof body.ops === 'object' ? body.ops : {};
    const incPlays = Math.min(1, Math.max(0, Math.floor(Number(ops.incPlays) || 0)));
    const incDownloads = Math.min(1, Math.max(0, Math.floor(Number(ops.incDownloads) || 0)));
    const reaction = ops.reaction === 'like' || ops.reaction === 'dislike' ? ops.reaction : null;

    if (!incPlays && !incDownloads && !reaction) {
        return respond(400, { ok: false, error: 'empty_ops' });
    }

    const cool = assertCooldown(user.login, reaction ? 'like' : 'play');
    if (cool) return cool;

    if (ydbDoc.enabled()) {
        const patched = await ydbDoc.mutateRow('sound', soundId, (prev) => {
            if (!prev) return undefined;
            const sound = { ...prev };
            const login = user.login;
            if (incPlays) sound.plays = Math.max(0, (sound.plays || 0) + incPlays);
            if (incDownloads) sound.downloads = Math.max(0, (sound.downloads || 0) + incDownloads);
            if (reaction) {
                const hadLike = (Array.isArray(prev.likedBy) ? prev.likedBy : []).includes(login);
                const hadDislike = (Array.isArray(prev.dislikedBy) ? prev.dislikedBy : []).includes(login);
                let likedBy = (Array.isArray(prev.likedBy) ? prev.likedBy : []).map(String).filter(Boolean).filter((x) => x !== login);
                let dislikedBy = (Array.isArray(prev.dislikedBy) ? prev.dislikedBy : []).map(String).filter(Boolean).filter((x) => x !== login);
                let addLike = false;
                let addDislike = false;
                if (Object.prototype.hasOwnProperty.call(ops, 'reactionSet')) {
                    if (reaction === 'like' && ops.reactionSet) addLike = true;
                    if (reaction === 'dislike' && ops.reactionSet) addDislike = true;
                } else if (reaction === 'like') addLike = !hadLike;
                else addDislike = !hadDislike;
                if (addLike) likedBy.push(login);
                if (addDislike) dislikedBy.push(login);
                sound.likedBy = likedBy;
                sound.dislikedBy = dislikedBy;
            }
            return sanitizeSoundRecord(sound);
        });
        if (!patched) return respond(404, { ok: false, error: 'sound_not_found' });
        await publishPatchedSoundCache(patched);
        return respond(200, {
            ok: true,
            soundId,
            sound: {
                id: patched.id,
                plays: patched.plays || 0,
                downloads: patched.downloads || 0,
                likedBy: patched.likedBy || [],
                dislikedBy: patched.dislikedBy || []
            }
        });
    }

    let next = null;
    for (let attempt = 0; attempt < WRITE_RETRIES; attempt++) {
    const cas = await getJsonCas('map_data.json', []);
    const fresh = cas.data;
    if (!Array.isArray(fresh)) return respond(500, { ok: false, error: 'bad_map_data' });

    const idx = fresh.findIndex((s) => s && String(s.id) === soundId);
    if (idx < 0) return respond(404, { ok: false, error: 'sound_not_found' });

    const prev = fresh[idx];
    const sound = { ...prev };
    const login = user.login;

    if (incPlays) sound.plays = Math.max(0, (sound.plays || 0) + incPlays);
    if (incDownloads) sound.downloads = Math.max(0, (sound.downloads || 0) + incDownloads);

    if (reaction) {
        const hadLike = (Array.isArray(prev.likedBy) ? prev.likedBy : []).includes(login);
        const hadDislike = (Array.isArray(prev.dislikedBy) ? prev.dislikedBy : []).includes(login);
        let likedBy = (Array.isArray(prev.likedBy) ? prev.likedBy : []).map(String).filter(Boolean);
        let dislikedBy = (Array.isArray(prev.dislikedBy) ? prev.dislikedBy : []).map(String).filter(Boolean);
        likedBy = likedBy.filter((x) => x !== login);
        dislikedBy = dislikedBy.filter((x) => x !== login);

        let addLike = false;
        let addDislike = false;
        if (Object.prototype.hasOwnProperty.call(ops, 'reactionSet')) {
            if (reaction === 'like' && ops.reactionSet) addLike = true;
            if (reaction === 'dislike' && ops.reactionSet) addDislike = true;
        } else if (reaction === 'like') {
            addLike = !hadLike;
        } else {
            addDislike = !hadDislike;
        }
        if (addLike) likedBy.push(login);
        if (addDislike) dislikedBy.push(login);
        sound.likedBy = likedBy;
        sound.dislikedBy = dislikedBy;
    }

    next = sanitizeSoundRecord(sound);
    fresh[idx] = next;
    try {
        await putJson('map_data.json', fresh, { ifMatch: cas.missing ? undefined : cas.etag });
        break;
    } catch (err) {
        if (err && err.code === 'write_conflict' && attempt < WRITE_RETRIES - 1) continue;
        throw err;
    }
    }

    return respond(200, {
        ok: true,
        soundId,
        sound: {
            id: next.id,
            plays: next.plays || 0,
            downloads: next.downloads || 0,
            likedBy: next.likedBy || [],
            dislikedBy: next.dislikedBy || []
        }
    });
}

async function migrateMailOutOfProfiles(proposedProfiles, user) {
    const hasEmbedded = (proposedProfiles || []).some((p) =>
        (Array.isArray(p.inbox) && p.inbox.length)
        || (Array.isArray(p.notifications) && p.notifications.length)
        || (Array.isArray(p.activityLog) && p.activityLog.length)
        || Object.prototype.hasOwnProperty.call(p, 'inbox')
        || Object.prototype.hasOwnProperty.call(p, 'notifications')
        || Object.prototype.hasOwnProperty.call(p, 'activityLog')
    );
    if (!hasEmbedded) return;

    const extracted = (proposedProfiles || [])
        .filter((p) => p?.loginName)
        .map(extractMailRecord);
    if (!extracted.length) return;
    await applyMailMerge(extracted, user);
}

async function persistActorPrivateMeta(proposedProfiles, user) {
    if (!user?.login || !Array.isArray(proposedProfiles)) return;
    const mine = proposedProfiles.find((p) => String(p.loginName || '').toLowerCase() === user.login);
    if (!mine) return;
    const pii = extractProfilePii(mine);
    // emailVerified only via confirmEmailVerification — never trust the client
    delete pii.emailVerified;
    delete pii.pdConsent;
    delete pii.pdConsentAt;
    if (!Object.keys(pii).length) return;
    await mutateMeta((meta) => {
        const prev = meta[user.login] && typeof meta[user.login] === 'object' ? meta[user.login] : {};
        const next = { ...prev, ...pii, updatedAt: new Date().toISOString() };
        if (pii.email !== undefined) {
            const newEmail = normalizeEmail(pii.email);
            const oldEmail = normalizeEmail(prev.email);
            const owner = verifiedEmailOwner(meta, newEmail);
            if (owner && owner !== user.login) {
                next.email = prev.email;
                next.emailVerified = prev.emailVerified;
            } else if (newEmail !== oldEmail) {
                next.emailVerified = false;
            }
        }
        meta[user.login] = next;
        return meta;
    });
}

async function applyMergeAndSave(fileName, proposed, user) {
    if (fileName === 'mail.json') {
        const clientData = await applyMailMerge(proposed, user);
        return respond(200, {
            ok: true,
            fileName,
            count: Array.isArray(clientData) ? clientData.length : 0,
            data: clientData
        });
    }

    let nextProposed = proposed;
    if (fileName === 'profiles.json') {
        await migrateMailOutOfProfiles(proposed, user);
        await persistActorPrivateMeta(proposed, user);
        nextProposed = (proposed || []).map(stripMailFields).map(sanitizeProfileCard);
    }

    const knownLogins = fileName === 'profiles.json'
        ? new Set(Object.keys(await loadAuthUsers()))
        : null;

    let saved = null;
    for (let attempt = 0; attempt < WRITE_RETRIES; attempt++) {
    const cas = await getJsonCas(fileName, []);
    const fresh = cas.data;
    if (!nextProposed.length && Array.isArray(fresh) && fresh.length) {
        return respond(200, { ok: true, skipped: true, count: fresh.length, data: fresh });
    }

    let merged = nextProposed;
    if (Array.isArray(fresh)) {
        if (fileName === 'profiles.json') merged = mergeProfilesArrays(fresh, nextProposed);
        else if (fileName === 'feed.json') merged = mergeFeedPostsArrays(fresh, nextProposed);
        else if (fileName === 'events.json') merged = mergeEventsArrays(fresh, nextProposed);
        else merged = mergeMapDataArrays(fresh, nextProposed);
    }

    if (fileName === 'profiles.json') merged = sanitizeProfiles(fresh, merged, user, knownLogins).map(stripMailFields).map(sanitizeProfileCard);
    else if (fileName === 'feed.json') merged = sanitizeFeed(fresh, merged, user);
    else if (fileName === 'events.json') merged = sanitizeEvents(fresh, merged, user);
    else merged = sanitizeMapData(fresh, merged, user);

    try {
        await putJson(fileName, merged, { ifMatch: cas.missing ? undefined : cas.etag });
        saved = merged;
        break;
    } catch (err) {
        if (err && err.code === 'write_conflict' && attempt < WRITE_RETRIES - 1) continue;
        throw err;
    }
    }
    if (!saved) throw new WriteConflictError();

    return respond(200, {
        ok: true,
        fileName,
        count: Array.isArray(saved) ? saved.length : 0,
        data: saved
    });
}

async function handleCommit(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    const totpBlock = await assertStaffTotp(user);
    if (totpBlock) return totpBlock;

    const cool = assertCooldown(user.login, 'sync');
    if (cool) return cool;

    const fileName = String(body.fileName || '');
    if (!ALLOWED_JSON.has(fileName)) return respond(400, { ok: false, error: 'bad_file' });

    const stagingKey = `staging/${user.login}/${fileName}`;
    const proposed = await getJson(stagingKey, null);
    if (!Array.isArray(proposed)) {
        return respond(400, { ok: false, error: 'no_staging', message: `Missing ${stagingKey}` });
    }
    const stagingBytes = Buffer.byteLength(JSON.stringify(proposed), 'utf8');
    if (stagingBytes > MAX_JSON_SYNC_BYTES) {
        return respond(413, { ok: false, error: 'file_too_large', maxBytes: MAX_JSON_SYNC_BYTES });
    }

    const result = await applyMergeAndSave(fileName, proposed, user);

    try {
        await s3.send(new DeleteObjectCommand({
            Bucket: PRIVATE_BUCKET,
            Key: stagingKey
        }));
    } catch (_) {}

    return result;
}

async function handlePresign(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    const totpBlock = await assertStaffTotp(user);
    if (totpBlock) return totpBlock;


    const fileName = String(body.fileName || '').replace(/^\/+/, '');
    const contentType = String(body.contentType || 'application/octet-stream');
    const contentLength = Number(body.contentLength || 0);
    if (!fileName || fileName.includes('..')) return respond(400, { ok: false, error: 'bad_file' });
    if (!ALLOWED_MEDIA_CT.test(contentType) && !fileName.startsWith('staging/')) {
        return respond(400, { ok: false, error: 'bad_content_type' });
    }

    let key;
    // Staging JSON для больших баз (обход лимита тела HTTP-триггера)
    const stagingMatch = fileName.match(/^staging\/([^/]+)\/(map_data\.json|profiles\.json|feed\.json|mail\.json|events\.json)$/);
    if (stagingMatch) {
        if (stagingMatch[1] !== user.login) return respond(403, { ok: false, error: 'bad_staging_owner' });
        if (!(contentLength > 0)) {
            return respond(400, { ok: false, error: 'content_length_required' });
        }
        if (contentLength > MAX_JSON_SYNC_BYTES) {
            return respond(413, {
                ok: false,
                error: 'file_too_large',
                maxBytes: MAX_JSON_SYNC_BYTES,
                message: 'Staging JSON must be ≤ 2.5 MB'
            });
        }
        key = fileName;
    } else if (ALLOWED_JSON.has(fileName) || fileName === AUTH_KEY || fileName.startsWith('_auth/') || fileName.startsWith('_mail/')) {
        return respond(403, { ok: false, error: 'use_sync' });
    } else {
        const allowed = MEDIA_PREFIXES.some((p) => fileName.startsWith(p));
        if (!allowed) return respond(403, { ok: false, error: 'bad_prefix' });
        const safe = fileName.replace(/[^a-zA-Z0-9_\-./]/g, '_');
        key = safe.startsWith(`uploads/${user.login}/`)
            ? safe
            : `uploads/${user.login}/${safe.split('/').pop()}`;

        const isImage = /^image\//i.test(contentType);
        const isVideo = /^video\//i.test(contentType);
        const maxBytes = isImage ? MAX_IMAGE_BYTES : (isVideo ? MAX_VIDEO_BYTES : MAX_AUDIO_BYTES);
        if (!(contentLength > 0)) {
            return respond(400, { ok: false, error: 'content_length_required' });
        }
        if (contentLength > maxBytes) {
            return respond(413, {
                ok: false,
                error: 'file_too_large',
                maxBytes,
                message: isImage ? 'Image must be ≤ 30 MB' : (isVideo ? 'Video must be ≤ 80 MB' : 'Audio must be ≤ 1 GB')
            });
        }
    }

    // Не подписываем ACL: браузер шлёт только Content-Type, иначе PUT → 403 SignatureMismatch.
    // В private-бакете объекты и так непубличные по умолчанию.
    const hostBucket = key.startsWith('staging/') || key === 'mail.json' ? PRIVATE_BUCKET : BUCKET;
    const command = new PutObjectCommand({
        Bucket: hostBucket,
        Key: key,
        ContentType: contentType,
        ...(contentLength > 0 ? { ContentLength: Math.floor(contentLength) } : {})
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    return respond(200, {
        ok: true,
        uploadUrl,
        publicUrl: `${ENDPOINT}/${hostBucket}/${key}`,
        key,
        maxImageBytes: MAX_IMAGE_BYTES,
        maxAudioBytes: MAX_AUDIO_BYTES
    });
}

async function handleTranslate(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    const totpBlock = await assertStaffTotp(user);
    if (totpBlock) return totpBlock;

    if (!YC_TRANSLATE_API_KEY) {
        return respond(503, { ok: false, error: 'translate_unconfigured', message: 'YC_TRANSLATE_API_KEY is not set' });
    }

    let texts = body.texts;
    if (typeof texts === 'string') texts = [texts];
    if (!Array.isArray(texts) || !texts.length) {
        return respond(400, { ok: false, error: 'bad_texts' });
    }
    texts = texts.map((t) => String(t || '').slice(0, 2000)).filter(Boolean).slice(0, 8);
    if (!texts.length) return respond(400, { ok: false, error: 'bad_texts' });

    const totalLen = texts.reduce((n, t) => n + t.length, 0);
    if (totalLen > 8000) return respond(400, { ok: false, error: 'texts_too_long' });

    const sourceLanguageCode = String(body.sourceLanguageCode || 'ru').slice(0, 8);
    const targetLanguageCode = String(body.targetLanguageCode || 'en').slice(0, 8);

    const reqBody = {
        sourceLanguageCode,
        targetLanguageCode,
        texts
    };
    if (YC_FOLDER_ID) reqBody.folderId = YC_FOLDER_ID;

    const res = await fetch('https://translate.api.cloud.yandex.net/translate/v2/translate', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Api-Key ${YC_TRANSLATE_API_KEY}`
        },
        body: JSON.stringify(reqBody)
    });

    let data = null;
    try { data = await res.json(); } catch (_) { data = null; }
    if (!res.ok) {
        return respond(502, {
            ok: false,
            error: 'translate_failed',
            message: (data && (data.message || data.error)) || `Yandex Translate HTTP ${res.status}`
        });
    }

    const translations = (data?.translations || []).map((t) => t.text || '');
    return respond(200, { ok: true, translations, sourceLanguageCode, targetLanguageCode });
}

exports.handler = async function handler(event = {}) {
    __reqEvent = event || {};
    const method = (event.httpMethod || event.requestContext?.http?.method || 'POST').toUpperCase();
    if (method === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }

    const ip = getHeader(event, 'x-forwarded-for') || event.requestContext?.identity?.sourceIp || 'unknown';
    const ipKey = String(ip).split(',')[0].trim();

    const body = parseBody(event);
    // Legacy client shape { fileName, contentType } without action → reject (force upgrade)
    const action = body.action || (body.fileName && body.contentType && !body.data ? 'legacy_presign' : '');

    // health / publicConfig — без секретов и без тяжёлых лимитов
    if (action === 'health') {
        return respond(200, { ok: true, version: 23, ydb: ydbDoc.enabled(), vapid: webPush.configured() });
    }
    if (action === 'publicConfig') {
        return respond(200, {
            ok: true,
            yandexMapsApiKey: YANDEX_MAPS_API_KEY || '',
            bucketUrl: `https://storage.yandexcloud.net/${BUCKET}`,
            vapidPublicKey: webPush.vapidPublic()
        });
    }

    if (!JWT_SECRET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        return respond(500, { ok: false, error: 'server_misconfigured' });
    }

    await Promise.all([hydrateRateBuckets(), hydrateLoginLocks(), scrubPublicProfilePii()]);

    // everything else shares a generous per-IP ceiling
    if (!rateLimit(`ip:${ipKey}`, 360, 60000)) {
        void flushRateBuckets(true);
        return respond(429, { ok: false, error: 'rate_limited' });
    }

    const authActions = new Set([
        'sync', 'commit', 'presign', 'me', 'changePassword', 'patchSound', 'translate',
        'getMail', 'requestEmailVerification', 'confirmEmailVerification',
        'adminDeleteUser', 'adminUnbindEmail', 'adminSendEmail',
        'logoutAll', 'totpSetup', 'totpConfirm', 'totpDisable', 'getSecurityEvents',
        'deleteAccount', 'exportMyData', 'savePushSubscription', 'deletePushSubscription'
    ]);
    const tokenPayload = authActions.has(action)
        ? verifyJwt(extractToken(event, body))
        : null;
    if (!actionRateLimit(action, ipKey, tokenPayload?.login || '')) {
        void flushRateBuckets(true);
        return respond(429, { ok: false, error: 'rate_limited', message: 'Too many requests, retry shortly' });
    }
    if (rateDirty) void flushRateBuckets(false);

    try {
        if (action === 'register') return await handleRegister(body);
        if (action === 'login') return await handleLogin(event, body);
        if (action === 'refresh') return await handleRefresh(event, body);
        if (action === 'logout') return await handleLogout(event, body);
        if (action === 'logoutAll') return await handleLogoutAll(event, body);
        if (action === 'changePassword') return await handleChangePassword(event, body);
        if (action === 'me') return await handleMe(event, body);
        if (action === 'getMail') return await handleGetMail(event, body);
        if (action === 'sync') return await handleSync(event, body);
        if (action === 'commit') return await handleCommit(event, body);
        if (action === 'presign') return await handlePresign(event, body);
        if (action === 'patchSound') return await handlePatchSound(event, body);
        if (action === 'translate') return await handleTranslate(event, body);
        if (action === 'requestEmailVerification') return await handleRequestEmailVerification(event, body);
        if (action === 'confirmEmailVerification') return await handleConfirmEmailVerification(event, body);
        if (action === 'requestPasswordReset') return await handleRequestPasswordReset(event, body);
        if (action === 'confirmPasswordReset') return await handleConfirmPasswordReset(body);
        if (action === 'deleteAccount') return await handleDeleteAccount(event, body);
        if (action === 'exportMyData') return await handleExportMyData(event, body);
        if (action === 'adminDeleteUser') return await handleAdminDeleteUser(event, body);
        if (action === 'adminUnbindEmail') return await handleAdminUnbindEmail(event, body);
        if (action === 'adminSendEmail') return await handleAdminSendEmail(event, body);
        if (action === 'totpSetup') return await handleTotpSetup(event, body);
        if (action === 'totpConfirm') return await handleTotpConfirm(event, body);
        if (action === 'totpDisable') return await handleTotpDisable(event, body);
        if (action === 'getSecurityEvents') return await handleGetSecurityEvents(event, body);
        if (action === 'savePushSubscription') return await handleSavePushSubscription(event, body);
        if (action === 'deletePushSubscription') return await handleDeletePushSubscription(event, body);
        if (action === 'legacy_presign') {
            return respond(401, {
                ok: false,
                error: 'auth_required',
                message: 'Anonymous writes disabled. Update the app / redeploy secure API.'
            });
        }
        return respond(400, { ok: false, error: 'unknown_action' });
    } catch (err) {
        if (err instanceof ClientError || err?.name === 'ClientError') {
            return respond(err.status || 400, { ok: false, error: err.code, message: err.message });
        }
        if (err instanceof IntegrityError || err?.name === 'IntegrityError') {
            console.error('API integrity', err.key || err.code);
            return respond(503, { ok: false, error: 'integrity_mismatch', message: 'Данные временно недоступны' });
        }
        if (err && err.code === 'write_conflict') {
            return respond(409, { ok: false, error: 'write_conflict', message: 'Конфликт записи, повторите' });
        }
        console.error('API error', err && (err.code || err.name || 'internal'));
        return respond(500, { ok: false, error: 'internal' });
    }
};
