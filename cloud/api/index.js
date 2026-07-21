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
 *                       (default: polevka.art + www + github pages + localhost)
 *   YC_TRANSLATE_API_KEY — Yandex Cloud Translate API key (Api-Key …)
 *   YC_FOLDER_ID      — folder id (required with some key types)
 *   YANDEX_MAPS_API_KEY — browser Maps JS key (HTTP Referer lock); exposed only via publicConfig
 *   SMTP_HOST / SMTP_PORT / SMTP_USER / SMTP_PASS / MAIL_FROM — transactional email
 *   ALLOW_DEMO_EMAIL_CODES — set to 1 on staging only: return demoCode when SMTP missing
 *
 * Actions (POST JSON { action, ... }):
 *   health | publicConfig | register | login | changePassword | me | getMail | sync | commit | presign | patchSound | translate
 *   | requestEmailVerification | confirmEmailVerification
 *   | requestPasswordReset | confirmPasswordReset | adminDeleteUser | adminUnbindEmail | adminSendEmail
 */

const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const mailTemplates = require('./mailTemplates');

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
    'https://rdulishkevich.github.io',
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
const EMAIL_CODE_TTL_MS = 10 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = 15 * 60 * 1000;
const AUTH_KEY = '_auth/users.json';
const PRIVATE_META_KEY = '_auth/private_meta.json';
const EMAIL_CODES_PREFIX = '_auth/email_codes/';
const PASSWORD_RESET_PREFIX = '_auth/password_resets/';
const ALLOWED_JSON = new Set(['map_data.json', 'profiles.json', 'feed.json', 'mail.json', 'events.json']);
const MEDIA_PREFIXES = ['uploads/', 'audio/', 'images/'];
const TOKEN_TTL_SEC = 60 * 60 * 24 * 14; // 14 days
const MIN_PASSWORD_LEN = 8;
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;      // 30 MB — фото/обложки с телефона
const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;    // 1 GB — длинные WAV / амбисоник
const MAX_JSON_SYNC_BYTES = 2_500_000;
const MAX_INBOX = 200;
const MAX_NOTIFICATIONS = 100;
const MAX_ACTIVITY = 100;
const MAX_MSG_TEXT = 4000;
const MAX_BIO = 2000;
const PROFILE_PII_KEYS = ['email', 'emailVerified', 'skillLevel', 'platformIntents', 'pdConsent', 'pdConsentAt'];
const ALLOWED_MEDIA_CT = /^(image\/(jpeg|jpg|png|webp|gif)|audio\/(mpeg|mp3|wav|x-wav|wave|mp4|aac|ogg|flac|webm|x-m4a)|application\/(json|octet-stream))/i;
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
    if (key === 'mail.json' || key.startsWith('_auth/') || key.startsWith('staging/')) return PRIVATE_BUCKET;
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
    if (allowOrigin) headers['Access-Control-Allow-Origin'] = allowOrigin;
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
        activityLog: (Array.isArray(row.activityLog) ? row.activityLog : []).slice(0, MAX_ACTIVITY)
    };
}

function respond(statusCode, payload) {
    return {
        statusCode,
        headers: corsHeaders(),
        body: JSON.stringify(payload)
    };
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
    return row.n <= limit;
}

function actionRateLimit(action, ip, login = '') {
    const base = String(ip || 'unknown');
    const who = login || base;
    if (action === 'register' && !rateLimit(`reg:${base}`, 8, 60000)) return false;
    if (action === 'login' && !rateLimit(`login:${base}`, 40, 60000)) return false;
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
    if ((action === 'adminDeleteUser' || action === 'adminUnbindEmail') && !rateLimit(`adminops:${who}`, 20, 600000)) return false;
    if (action === 'adminSendEmail' && !rateLimit(`adminsend:${who}`, 30, 3600000)) return false;
    if (action === 'adminSendEmail' && !rateLimit(`adminsendip:${base}`, 60, 3600000)) return false;
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
    // Не используем Authorization: Bearer — у YC HTTP-триггера это IAM invoke-токен.
    const custom = getHeader(event, 'x-rosmap-token');
    if (custom) return String(custom).trim();
    if (body && body.token) return String(body.token);
    return '';
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

async function getJson(key, fallback) {
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucketForKey(key), Key: key }));
        const text = await streamToString(res.Body);
        const data = JSON.parse(text || 'null');
        return data == null ? fallback : data;
    } catch (err) {
        if (err && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) return fallback;
        throw err;
    }
}

async function putJson(key, data, { privateObject = false } = {}) {
    const bucket = bucketForKey(key);
    const params = {
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(JSON.stringify(data), 'utf8'),
        ContentType: 'application/json; charset=utf-8'
    };
    if (privateObject || bucket === PRIVATE_BUCKET || key.startsWith('_auth/') || key.startsWith('staging/')) {
        params.ACL = 'private';
    }
    await s3.send(new PutObjectCommand(params));
}

async function loadAuthUsers() {
    const users = await getJson(AUTH_KEY, {});
    return users && typeof users === 'object' ? users : {};
}

async function saveAuthUsers(users) {
    await putJson(AUTH_KEY, users, { privateObject: true });
}

async function loadPrivateMeta() {
    const meta = await getJson(PRIVATE_META_KEY, {});
    return meta && typeof meta === 'object' ? meta : {};
}

async function savePrivateMeta(meta) {
    await putJson(PRIVATE_META_KEY, meta, { privateObject: true });
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
    await putJson('mail.json', data, { privateObject: true });
    await scrubPublicMailObject();
}

/** Актуальная роль из _auth + profiles (не доверяем JWT.role). */
async function resolveAuthUser(payload) {
    if (!payload?.login) return null;
    const login = String(payload.login).toLowerCase();
    const users = await loadAuthUsers();
    const row = users[login];
    if (!row) return null;
    const profiles = await getJson('profiles.json', []);
    const profile = (profiles || []).find((p) => String(p.loginName || '').toLowerCase() === login);
    if (profile?.blocked && login !== 'admin') {
        return { login, blocked: true, role: 'user', displayName: login };
    }
    let role = normalizeStaffRole(row.role, login);
    if (profile?.role) role = normalizeStaffRole(profile.role, login);
    if (profile?.role === 'user' && login !== 'admin') role = 'user';
    return {
        login,
        role,
        displayName: profile?.displayName || row.displayName || payload.displayName || login,
        blocked: false
    };
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
    if (!ADMIN_PASSWORD) return users;
    if (users.admin && users.admin.hash) return users;
    const { salt, hash } = hashPassword(ADMIN_PASSWORD);
    users.admin = {
        salt,
        hash,
        displayName: 'Admin',
        role: 'admin',
        createdAt: new Date().toISOString()
    };
    await saveAuthUsers(users);
    return users;
}

function issueToken(user) {
    const now = Math.floor(Date.now() / 1000);
    const role = normalizeStaffRole(user.role, user.login);
    return signJwt({
        login: user.login,
        role,
        displayName: user.displayName || user.login,
        iat: now,
        exp: now + TOKEN_TTL_SEC
    });
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
            likedBy: Array.isArray(s.likedBy) ? s.likedBy : (cloud.likedBy || []),
            dislikedBy: Array.isArray(s.dislikedBy) ? s.dislikedBy : (cloud.dislikedBy || []),
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
            // allow edits/deletes only for own messages
            if (String(prev.fromId || '').toLowerCase() === actorLogin || String(msg.fromId || '').toLowerCase() === actorLogin) {
                out.push(msg);
            } else {
                out.push(prev);
            }
            cloudMap.delete(msg.id);
            continue;
        }
        if (String(msg.fromId || '').toLowerCase() === actorLogin) out.push(msg);
    }
    for (const leftover of cloudMap.values()) out.push(leftover);
    return out;
}

function sanitizeProfiles(fresh, merged, user) {
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
    return (merged || []).map((p) => {
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
                activityLog: mergeKeyedArrays(cloud.activityLog || [], row.activityLog || [])
            });
        }
        // Чужой ящик: можно только дописать свои исходящие в inbox получателя + нотифы от себя
        return sanitizeMailRecord({
            loginName: login,
            inbox: sanitizeInbox(cloud.inbox || [], row.inbox || [], user.login),
            notifications: mergeKeyedArrays(cloud.notifications || [], (row.notifications || []).filter((n) => {
                return !n?.id || (cloud.notifications || []).some((x) => x.id === n.id) || String(n.fromId || '').toLowerCase() === user.login;
            })),
            activityLog: cloud.activityLog || []
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
    if (isStaffUser(user)) {
        return (merged || []).map(sanitizeSoundRecord);
    }
    const freshMap = new Map((fresh || []).map((s) => [s.id, s]));
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

    let users = await loadAuthUsers();
    users = await ensureAdminUser(users);
    if (users[login]) return respond(409, { ok: false, error: 'login_taken' });

    const { salt, hash } = hashPassword(password);
    users[login] = {
        salt,
        hash,
        displayName,
        role: 'user',
        createdAt: new Date().toISOString()
    };
    await saveAuthUsers(users);

    // ensure profile shell exists
    const profiles = await getJson('profiles.json', []);
    if (!profiles.some((p) => String(p.loginName || '').toLowerCase() === login)) {
        profiles.push({
            loginName: login,
            displayName,
            role: 'user',
            joinedAt: new Date().toISOString(),
            profileUpdatedAt: new Date().toISOString(),
            sessions: [],
            badges: [],
            progress: { xp: 0, achievements: [], completedQuests: [], guessrBestScore: 0 }
        });
        await putJson('profiles.json', profiles);
    }

    const mail = await getMailJson();
    if (!mail.some((p) => String(p.loginName || '').toLowerCase() === login)) {
        mail.push({ loginName: login, inbox: [], notifications: [], activityLog: [] });
        await putMailJson(mail);
    }

    const user = { login, displayName, role: 'user' };
    const token = issueToken(user);
    return respond(200, { ok: true, token, user: publicUser(user) });
}

async function handleLogin(body) {
    const login = normalizeLogin(body.login || body.username);
    const password = String(body.password || '');
    if (!login || !password) return respond(400, { ok: false, error: 'missing_fields' });

    let users = await loadAuthUsers();
    users = await ensureAdminUser(users);

    // Bootstrap admin login even before auth file existed
    if (login === 'admin' && ADMIN_PASSWORD && password === ADMIN_PASSWORD && !users.admin) {
        users = await ensureAdminUser(users);
    }

    const row = users[login];
    if (!row) return respond(404, { ok: false, error: 'no_user' });
    if (!verifyPassword(password, row.salt, row.hash)) {
        // allow ADMIN_PASSWORD override for admin account recovery
        if (!(login === 'admin' && ADMIN_PASSWORD && password === ADMIN_PASSWORD)) {
            return respond(401, { ok: false, error: 'bad_credentials' });
        }
    }

    // sync role from profiles if present
    const profiles = await getJson('profiles.json', []);
    const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === login);
    if (profile?.blocked && login !== 'admin') {
        return respond(403, { ok: false, error: 'blocked' });
    }
    let role = normalizeStaffRole(row.role, login);
    if (profile?.role) role = normalizeStaffRole(profile.role, login);
    if (profile?.role === 'user' && login !== 'admin') role = 'user';

    const user = {
        login,
        displayName: profile?.displayName || row.displayName || login,
        role
    };
    const privateMeta = await loadPrivateMeta();
    const pii = privateMeta[login] && typeof privateMeta[login] === 'object' ? privateMeta[login] : {};
    // Разовая подтяжка PII из публичного профиля, если ещё не мигрировали
    const fromPublic = extractProfilePii(profile || {});
    const mergedPii = { ...fromPublic, ...pii };
    if (PROFILE_PII_KEYS.some((k) => pii[k] === undefined && fromPublic[k] !== undefined)) {
        privateMeta[login] = { ...mergedPii, updatedAt: new Date().toISOString() };
        await savePrivateMeta(privateMeta);
    }
    const token = issueToken(user);
    return respond(200, {
        ok: true,
        token,
        user: { ...publicUser(user), ...extractProfilePii(mergedPii) }
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

    let users = await loadAuthUsers();
    users = await ensureAdminUser(users);
    const row = users[authUser.login];
    if (!row) return respond(404, { ok: false, error: 'no_user' });

    const okCurrent = verifyPassword(currentPassword, row.salt, row.hash)
        || (authUser.login === 'admin' && ADMIN_PASSWORD && currentPassword === ADMIN_PASSWORD);
    if (!okCurrent) return respond(401, { ok: false, error: 'bad_credentials' });

    const { salt, hash } = hashPassword(newPassword);
    users[authUser.login] = { ...row, salt, hash, passwordUpdatedAt: new Date().toISOString() };
    await saveAuthUsers(users);
    return respond(200, { ok: true });
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
    try {
        await s3.send(new DeleteObjectCommand({
            Bucket: bucketForKey(emailCodeKey(login)),
            Key: emailCodeKey(login)
        }));
    } catch (_) { /* ignore */ }
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
    try {
        await s3.send(new DeleteObjectCommand({
            Bucket: bucketForKey(passwordResetKey(login)),
            Key: passwordResetKey(login)
        }));
    } catch (_) { /* ignore */ }
}

async function findLoginByEmailOrLogin(loginOrEmail) {
    const raw = String(loginOrEmail || '').trim().toLowerCase();
    if (!raw) return null;
    if (raw.includes('@')) {
        const email = normalizeEmail(raw);
        if (!isValidEmail(email)) return null;
        const meta = await loadPrivateMeta();
        for (const [login, row] of Object.entries(meta || {})) {
            if (normalizeEmail(row?.email) === email) return normalizeLogin(login);
        }
        return null;
    }
    const login = normalizeLogin(raw);
    const users = await loadAuthUsers();
    return users[login] ? login : null;
}

async function handleRequestPasswordReset(body) {
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
    if (!smtpOk && !ALLOW_DEMO_EMAIL_CODES) return generic;

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
            console.error('SMTP password reset failed', err);
            await clearPasswordReset(login);
            return respond(502, { ok: false, error: 'mail_send_failed' });
        }
        return respond(200, { ok: true });
    }

    return respond(200, { ok: true, demoCode: code, demo: true });
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
    if (!row?.codeHash) return respond(400, { ok: false, error: 'no_pending_code' });
    if (Date.now() > Number(row.expiresAt || 0)) {
        await clearPasswordReset(login);
        return respond(400, { ok: false, error: 'code_expired' });
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

    let users = await loadAuthUsers();
    users = await ensureAdminUser(users);
    if (!users[login]) return respond(404, { ok: false, error: 'no_user' });
    const { salt, hash } = hashPassword(newPassword);
    users[login] = { ...users[login], salt, hash, passwordUpdatedAt: new Date().toISOString() };
    await saveAuthUsers(users);
    await clearPasswordReset(login);
    return respond(200, { ok: true });
}

async function handleAdminDeleteUser(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const actor = await resolveAuthUser(payload);
    if (!actor || !isAdminUser(actor)) return respond(403, { ok: false, error: 'forbidden' });

    const target = normalizeLogin(body.login);
    if (!target || target === 'admin' || target === actor.login || target === 'support') {
        return respond(400, { ok: false, error: 'bad_login' });
    }

    let users = await loadAuthUsers();
    if (!users[target]) return respond(404, { ok: false, error: 'no_user' });
    delete users[target];
    await saveAuthUsers(users);

    const meta = await loadPrivateMeta();
    if (meta[target]) {
        delete meta[target];
        await savePrivateMeta(meta);
    }
    await clearEmailCode(target);
    await clearPasswordReset(target);

    const profiles = await getJson('profiles.json', []);
    const nextProfiles = (profiles || []).map((p) => {
        if (String(p.loginName || '').toLowerCase() !== target) return p;
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
    });
    await putJson('profiles.json', nextProfiles);

    try {
        const mail = await getMailJson();
        const nextMail = (mail || []).filter((r) => String(r.loginName || '').toLowerCase() !== target);
        await putMailJson(nextMail);
    } catch (_) { /* ignore */ }

    return respond(200, { ok: true, login: target });
}

async function handleAdminUnbindEmail(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const actor = await resolveAuthUser(payload);
    if (!actor || !isAdminUser(actor)) return respond(403, { ok: false, error: 'forbidden' });

    const target = normalizeLogin(body.login);
    if (!target) return respond(400, { ok: false, error: 'bad_login' });

    const meta = await loadPrivateMeta();
    const prev = meta[target] && typeof meta[target] === 'object' ? meta[target] : {};
    meta[target] = {
        ...prev,
        email: '',
        emailVerified: false,
        emailVerifiedAt: '',
        updatedAt: new Date().toISOString()
    };
    await savePrivateMeta(meta);
    await clearEmailCode(target);
    return respond(200, { ok: true, login: target });
}

async function handleAdminSendEmail(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const actor = await resolveAuthUser(payload);
    if (!actor || !isStaffUser(actor)) return respond(403, { ok: false, error: 'forbidden' });
    if (actor.blocked) return respond(403, { ok: false, error: 'blocked' });

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
        console.error('SMTP staff message failed', err);
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

    const smtpOk = isSmtpConfigured();
    if (!smtpOk && !ALLOW_DEMO_EMAIL_CODES) {
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
            console.error('SMTP send failed', err);
            await clearEmailCode(user.login);
            return respond(502, { ok: false, error: 'mail_send_failed' });
        }
        return respond(200, { ok: true, expiresAt });
    }

    // Staging only: SMTP missing + ALLOW_DEMO_EMAIL_CODES=1
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

    const meta = await loadPrivateMeta();
    meta[user.login] = {
        ...(meta[user.login] || {}),
        email: normalizeEmail(row.email),
        emailVerified: true,
        emailVerifiedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    await savePrivateMeta(meta);
    await clearEmailCode(user.login);

    return respond(200, {
        ok: true,
        email: meta[user.login].email,
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

    // Разовая миграция PII из публичного profiles.json → private_meta
    const profiles = await getJson('profiles.json', []);
    const profile = (profiles || []).find((p) => String(p.loginName || '').toLowerCase() === user.login);
    const fromPublic = extractProfilePii(profile || {});
    if (Object.keys(fromPublic).length) {
        const mergedPii = { ...fromPublic, ...pii };
        const needsSave = PROFILE_PII_KEYS.some((k) => pii[k] === undefined && fromPublic[k] !== undefined);
        if (needsSave) {
            privateMeta[user.login] = { ...mergedPii, updatedAt: new Date().toISOString() };
            await savePrivateMeta(privateMeta);
        }
        pii = mergedPii;
        if (PROFILE_PII_KEYS.some((k) => profile[k] !== undefined)) {
            const scrubbed = (profiles || []).map((p) => sanitizeProfileCard(p));
            await putJson('profiles.json', scrubbed);
        }
    }

    const token = issueToken(user);
    return respond(200, {
        ok: true,
        token,
        user: {
            ...publicUser(user),
            ...extractProfilePii(pii)
        }
    });
}

async function handleGetMail(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });
    const mail = await getMailJson();
    return respond(200, { ok: true, data: projectMailForClient(mail, user) });
}

async function handleSync(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });

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

    const soundId = String(body.soundId || '').trim();
    if (!soundId) return respond(400, { ok: false, error: 'bad_sound_id' });

    const ops = body.ops && typeof body.ops === 'object' ? body.ops : {};
    const incPlays = Math.min(20, Math.max(0, Math.floor(Number(ops.incPlays) || 0)));
    const incDownloads = Math.min(20, Math.max(0, Math.floor(Number(ops.incDownloads) || 0)));
    const reaction = ops.reaction === 'like' || ops.reaction === 'dislike' ? ops.reaction : null;

    if (!incPlays && !incDownloads && !reaction) {
        return respond(400, { ok: false, error: 'empty_ops' });
    }

    const fresh = await getJson('map_data.json', []);
    if (!Array.isArray(fresh)) return respond(500, { ok: false, error: 'bad_map_data' });

    const idx = fresh.findIndex((s) => s && s.id === soundId);
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

    const next = sanitizeSoundRecord(sound);
    fresh[idx] = next;
    await putJson('map_data.json', fresh);

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

    const freshMail = await getMailJson();
    const extracted = (proposedProfiles || [])
        .filter((p) => p?.loginName)
        .map(extractMailRecord);
    if (!extracted.length) return;

    let merged = mergeMailArrays(freshMail, extracted);
    merged = sanitizeMail(freshMail, merged, user);
    await putMailJson(merged);
}

async function persistActorPrivateMeta(proposedProfiles, user) {
    if (!user?.login || !Array.isArray(proposedProfiles)) return;
    const mine = proposedProfiles.find((p) => String(p.loginName || '').toLowerCase() === user.login);
    if (!mine) return;
    const pii = extractProfilePii(mine);
    // emailVerified only via confirmEmailVerification — never trust the client
    delete pii.emailVerified;
    if (!Object.keys(pii).length) return;
    const meta = await loadPrivateMeta();
    const prev = meta[user.login] && typeof meta[user.login] === 'object' ? meta[user.login] : {};
    const next = { ...prev, ...pii, updatedAt: new Date().toISOString() };
    if (pii.email !== undefined) {
        const newEmail = String(pii.email || '').trim().toLowerCase();
        const oldEmail = String(prev.email || '').trim().toLowerCase();
        if (newEmail !== oldEmail) next.emailVerified = false;
    }
    meta[user.login] = next;
    await savePrivateMeta(meta);
}

async function applyMergeAndSave(fileName, proposed, user) {
    let nextProposed = proposed;
    if (fileName === 'profiles.json') {
        await migrateMailOutOfProfiles(proposed, user);
        await persistActorPrivateMeta(proposed, user);
        nextProposed = (proposed || []).map(stripMailFields).map(sanitizeProfileCard);
    }

    const fresh = fileName === 'mail.json'
        ? await getMailJson()
        : await getJson(fileName, []);
    if (!nextProposed.length && Array.isArray(fresh) && fresh.length) {
        const skippedData = fileName === 'mail.json' ? projectMailForClient(fresh, user) : fresh;
        return respond(200, { ok: true, skipped: true, count: fresh.length, data: skippedData });
    }

    let merged = nextProposed;
    if (Array.isArray(fresh)) {
        if (fileName === 'profiles.json') merged = mergeProfilesArrays(fresh, nextProposed);
        else if (fileName === 'mail.json') merged = mergeMailArrays(fresh, nextProposed);
        else if (fileName === 'feed.json') merged = mergeFeedPostsArrays(fresh, nextProposed);
        else if (fileName === 'events.json') merged = mergeEventsArrays(fresh, nextProposed);
        else merged = mergeMapDataArrays(fresh, nextProposed);
    }

    if (fileName === 'profiles.json') merged = sanitizeProfiles(fresh, merged, user).map(stripMailFields).map(sanitizeProfileCard);
    else if (fileName === 'mail.json') merged = sanitizeMail(fresh, merged, user);
    else if (fileName === 'feed.json') merged = sanitizeFeed(fresh, merged, user);
    else if (fileName === 'events.json') merged = sanitizeEvents(fresh, merged, user);
    else merged = sanitizeMapData(fresh, merged, user);

    if (fileName === 'mail.json') await putMailJson(merged);
    else await putJson(fileName, merged);

    const clientData = fileName === 'mail.json' ? projectMailForClient(merged, user) : merged;
    return respond(200, {
        ok: true,
        fileName,
        count: Array.isArray(merged) ? merged.length : 0,
        // Клиент использует этот снимок вместо повторного GET (CDN/гонка иначе «теряет» сообщения)
        data: clientData
    });
}

async function handleCommit(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const user = await resolveAuthUser(payload);
    if (!user) return respond(401, { ok: false, error: 'unauthorized' });
    if (user.blocked) return respond(403, { ok: false, error: 'blocked' });

    const fileName = String(body.fileName || '');
    if (!ALLOWED_JSON.has(fileName)) return respond(400, { ok: false, error: 'bad_file' });

    const stagingKey = `staging/${user.login}/${fileName}`;
    const proposed = await getJson(stagingKey, null);
    if (!Array.isArray(proposed)) {
        return respond(400, { ok: false, error: 'no_staging', message: `Missing ${stagingKey}` });
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
        key = fileName;
    } else if (ALLOWED_JSON.has(fileName) || fileName === AUTH_KEY || fileName.startsWith('_auth/')) {
        return respond(403, { ok: false, error: 'use_sync' });
    } else {
        const allowed = MEDIA_PREFIXES.some((p) => fileName.startsWith(p));
        if (!allowed) return respond(403, { ok: false, error: 'bad_prefix' });
        const safe = fileName.replace(/[^a-zA-Z0-9_\-./]/g, '_');
        key = safe.startsWith(`uploads/${user.login}/`)
            ? safe
            : `uploads/${user.login}/${safe.split('/').pop()}`;

        const isImage = /^image\//i.test(contentType);
        const isAudio = /^audio\//i.test(contentType);
        const maxBytes = isImage ? MAX_IMAGE_BYTES : (isAudio ? MAX_AUDIO_BYTES : MAX_AUDIO_BYTES);
        if (contentLength > 0 && contentLength > maxBytes) {
            return respond(413, {
                ok: false,
                error: 'file_too_large',
                maxBytes,
                message: isImage ? 'Image must be ≤ 30 MB' : 'Audio must be ≤ 1 GB'
            });
        }
    }

    // Не подписываем ACL: браузер шлёт только Content-Type, иначе PUT → 403 SignatureMismatch.
    // В private-бакете объекты и так непубличные по умолчанию.
    const hostBucket = key.startsWith('staging/') || key === 'mail.json' ? PRIVATE_BUCKET : BUCKET;
    const command = new PutObjectCommand({
        Bucket: hostBucket,
        Key: key,
        ContentType: contentType
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
        return respond(200, { ok: true, version: 12 });
    }
    if (action === 'publicConfig') {
        return respond(200, {
            ok: true,
            yandexMapsApiKey: YANDEX_MAPS_API_KEY || '',
            bucketUrl: `https://storage.yandexcloud.net/${BUCKET}`
        });
    }

    if (!JWT_SECRET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        return respond(500, { ok: false, error: 'server_misconfigured' });
    }

    // everything else shares a generous per-IP ceiling
    if (!rateLimit(`ip:${ipKey}`, 360, 60000)) {
        return respond(429, { ok: false, error: 'rate_limited' });
    }

    const tokenPayload = (
        action === 'sync' || action === 'commit' || action === 'presign' || action === 'me'
        || action === 'changePassword' || action === 'patchSound' || action === 'translate'
        || action === 'getMail'
        || action === 'requestEmailVerification' || action === 'confirmEmailVerification'
        || action === 'adminDeleteUser' || action === 'adminUnbindEmail' || action === 'adminSendEmail'
    )
        ? verifyJwt(extractToken(event, body))
        : null;
    if (!actionRateLimit(action, ipKey, tokenPayload?.login || '')) {
        return respond(429, { ok: false, error: 'rate_limited', message: 'Too many requests, retry shortly' });
    }

    try {
        if (action === 'register') return await handleRegister(body);
        if (action === 'login') return await handleLogin(body);
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
        if (action === 'requestPasswordReset') return await handleRequestPasswordReset(body);
        if (action === 'confirmPasswordReset') return await handleConfirmPasswordReset(body);
        if (action === 'adminDeleteUser') return await handleAdminDeleteUser(event, body);
        if (action === 'adminUnbindEmail') return await handleAdminUnbindEmail(event, body);
        if (action === 'adminSendEmail') return await handleAdminSendEmail(event, body);
        if (action === 'legacy_presign') {
            return respond(401, {
                ok: false,
                error: 'auth_required',
                message: 'Anonymous writes disabled. Update the app / redeploy secure API.'
            });
        }
        return respond(400, { ok: false, error: 'unknown_action' });
    } catch (err) {
        console.error('API error', err);
        return respond(500, { ok: false, error: 'internal' });
    }
};
