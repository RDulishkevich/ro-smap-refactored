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
 *   ALLOWED_ORIGIN    — CORS origin (default *)
 *
 * Actions (POST JSON { action, ... }):
 *   health | register | login | changePassword | me | sync | commit | presign
 */

const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = process.env.BUCKET || 'rosmap2026';
const PRIVATE_BUCKET = process.env.PRIVATE_BUCKET || 'rosmap2026-private';
const ENDPOINT = process.env.STORAGE_ENDPOINT || 'https://storage.yandexcloud.net';
const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const AUTH_KEY = '_auth/users.json';
const ALLOWED_JSON = new Set(['map_data.json', 'profiles.json', 'feed.json', 'mail.json']);
const MEDIA_PREFIXES = ['uploads/', 'audio/', 'images/'];
const TOKEN_TTL_SEC = 60 * 60 * 24 * 14; // 14 days
const MAX_IMAGE_BYTES = 30 * 1024 * 1024;      // 30 MB — фото/обложки с телефона
const MAX_AUDIO_BYTES = 1024 * 1024 * 1024;    // 1 GB — длинные WAV / амбисоник
const MAX_JSON_SYNC_BYTES = 2_500_000;
const MAX_INBOX = 200;
const MAX_NOTIFICATIONS = 100;
const MAX_ACTIVITY = 100;
const MAX_MSG_TEXT = 4000;
const MAX_BIO = 2000;
const ALLOWED_MEDIA_CT = /^(image\/(jpeg|jpg|png|webp|gif)|audio\/(mpeg|mp3|wav|x-wav|wave|mp4|aac|ogg|flac|webm|x-m4a)|application\/(json|octet-stream))/i;
const DATA_OR_BLOB_RE = /^(data:|blob:)/i;
const HTTP_URL_RE = /^https?:\/\//i;

function bucketForKey(key) {
    if (key.startsWith('_auth/') || key.startsWith('staging/')) return PRIVATE_BUCKET;
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
    return {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Rosmap-Token',
        'Access-Control-Max-Age': '86400'
    };
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
    if (action === 'register' && !rateLimit(`reg:${base}`, 5, 60000)) return false;
    if (action === 'login' && !rateLimit(`login:${base}`, 30, 60000)) return false;
    if ((action === 'sync' || action === 'commit') && !rateLimit(`sync:${base}:${login || 'anon'}`, 40, 60000)) return false;
    if (action === 'presign' && !rateLimit(`presign:${base}:${login || 'anon'}`, 60, 60000)) return false;
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
    if (expect !== parts[2]) return null;
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
    return signJwt({
        login: user.login,
        role: user.role === 'admin' ? 'admin' : 'user',
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
        role: user.role === 'admin' ? 'admin' : 'user'
    };
}

function recordTime(item) {
    if (!item) return 0;
    const raw = item.editedAt || item.date || item.createdAt || item.profileUpdatedAt || 0;
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
            reactedBy: Array.from(new Set([...(older.reactedBy || []), ...(newer.reactedBy || [])]))
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
    const stamp = (p) => new Date(p?.updatedAt || p?.createdAt || 0).getTime();
    (fresh || []).forEach((p) => { if (p?.id != null && !p.deleted) map.set(p.id, p); });
    (proposed || []).forEach((p) => {
        if (p?.id == null) return;
        if (p.deleted) { map.delete(p.id); return; }
        const cloud = map.get(p.id);
        if (!cloud || stamp(p) >= stamp(cloud)) map.set(p.id, p);
    });
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
    if (user.role === 'admin') {
        return (merged || []).map(sanitizeProfileCard);
    }
    const freshMap = new Map((fresh || []).map((p) => [String(p.loginName || '').toLowerCase(), p]));
    return (merged || []).map((p) => {
        const login = String(p.loginName || '').toLowerCase();
        const cloud = freshMap.get(login) || {};
        if (login === user.login) {
            return sanitizeProfileCard({
                ...p,
                role: cloud.role === 'admin' ? 'admin' : 'user',
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
    if (user.role === 'admin') {
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

function sanitizeMapData(fresh, merged, user) {
    if (user.role === 'admin') {
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
                status: s.status === 'draft' ? 'draft' : 'pending'
            }));
            continue;
        }
        if (ownsSound(cloud, user.login)) {
            out.push(sanitizeSoundRecord({
                ...s,
                recordistId: user.login,
                // non-admin cannot self-publish
                status: s.status === 'published' && cloud.status !== 'published' ? 'pending' : s.status
            }));
            continue;
        }
        // foreign sound: allow only social fields from actor
        out.push(sanitizeSoundRecord({
            ...cloud,
            comments: mergeCommentLists(cloud.comments || [], s.comments || []),
            reports: mergeKeyedArrays(cloud.reports || [], s.reports || []),
            likedBy: Array.isArray(s.likedBy) ? s.likedBy : (cloud.likedBy || []),
            dislikedBy: Array.isArray(s.dislikedBy) ? s.dislikedBy : (cloud.dislikedBy || []),
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
    if (user.role === 'admin') return merged;
    const freshMap = new Map((fresh || []).map((p) => [p.id, p]));
    const out = [];
    for (const p of merged || []) {
        const cloud = freshMap.get(p.id);
        if (!cloud) {
            out.push({ ...p, authorId: user.login, author: p.author || user.displayName || user.login });
            continue;
        }
        if (String(cloud.authorId || '').toLowerCase() === user.login) out.push(p);
        else out.push(cloud);
    }
    for (const [id, cloud] of freshMap.entries()) {
        if (!out.some((p) => p.id === id) && !cloud.deleted) out.push(cloud);
    }
    return out;
}

async function handleRegister(body) {
    const login = normalizeLogin(body.login || body.username);
    const password = String(body.password || '');
    const displayName = String(body.displayName || body.username || login).trim().slice(0, 40) || login;
    if (!login || login.length < 2) return respond(400, { ok: false, error: 'bad_login' });
    if (password.length < 4) return respond(400, { ok: false, error: 'weak_password' });
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

    const mail = await getJson('mail.json', []);
    if (!mail.some((p) => String(p.loginName || '').toLowerCase() === login)) {
        mail.push({ loginName: login, inbox: [], notifications: [], activityLog: [] });
        await putJson('mail.json', mail);
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
    let role = row.role === 'admin' || login === 'admin' ? 'admin' : 'user';
    if (profile?.role === 'admin') role = 'admin';
    if (profile?.role === 'user' && login !== 'admin') role = 'user';

    const user = {
        login,
        displayName: profile?.displayName || row.displayName || login,
        role
    };
    const token = issueToken(user);
    return respond(200, { ok: true, token, user: publicUser(user) });
}

async function handleChangePassword(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    if (newPassword.length < 4) return respond(400, { ok: false, error: 'weak_password' });

    let users = await loadAuthUsers();
    users = await ensureAdminUser(users);
    const row = users[payload.login];
    if (!row) return respond(404, { ok: false, error: 'no_user' });

    const okCurrent = verifyPassword(currentPassword, row.salt, row.hash)
        || (payload.login === 'admin' && ADMIN_PASSWORD && currentPassword === ADMIN_PASSWORD);
    if (!okCurrent) return respond(401, { ok: false, error: 'bad_credentials' });

    const { salt, hash } = hashPassword(newPassword);
    users[payload.login] = { ...row, salt, hash, passwordUpdatedAt: new Date().toISOString() };
    await saveAuthUsers(users);
    return respond(200, { ok: true });
}

async function handleMe(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });
    const profiles = await getJson('profiles.json', []);
    const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === payload.login);
    if (profile?.blocked && payload.login !== 'admin') {
        return respond(403, { ok: false, error: 'blocked' });
    }
    const role = (payload.role === 'admin' || profile?.role === 'admin' || payload.login === 'admin') ? 'admin' : 'user';
    const user = {
        login: payload.login,
        displayName: profile?.displayName || payload.displayName || payload.login,
        role
    };
    // refresh token role claim
    const token = issueToken(user);
    return respond(200, { ok: true, token, user: publicUser(user) });
}

async function handleSync(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });

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

    return applyMergeAndSave(fileName, proposed, {
        login: payload.login,
        role: payload.role,
        displayName: payload.displayName
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

    const freshMail = await getJson('mail.json', []);
    const extracted = (proposedProfiles || [])
        .filter((p) => p?.loginName)
        .map(extractMailRecord);
    if (!extracted.length) return;

    let merged = mergeMailArrays(freshMail, extracted);
    merged = sanitizeMail(freshMail, merged, user);
    await putJson('mail.json', merged);
}

async function applyMergeAndSave(fileName, proposed, user) {
    let nextProposed = proposed;
    if (fileName === 'profiles.json') {
        await migrateMailOutOfProfiles(proposed, user);
        nextProposed = (proposed || []).map(stripMailFields);
    }

    const fresh = await getJson(fileName, []);
    if (!nextProposed.length && Array.isArray(fresh) && fresh.length) {
        return respond(200, { ok: true, skipped: true, count: fresh.length, data: fresh });
    }

    let merged = nextProposed;
    if (Array.isArray(fresh)) {
        if (fileName === 'profiles.json') merged = mergeProfilesArrays(fresh, nextProposed);
        else if (fileName === 'mail.json') merged = mergeMailArrays(fresh, nextProposed);
        else if (fileName === 'feed.json') merged = mergeFeedPostsArrays(fresh, nextProposed);
        else merged = mergeMapDataArrays(fresh, nextProposed);
    }

    if (fileName === 'profiles.json') merged = sanitizeProfiles(fresh, merged, user).map(stripMailFields);
    else if (fileName === 'mail.json') merged = sanitizeMail(fresh, merged, user);
    else if (fileName === 'feed.json') merged = sanitizeFeed(fresh, merged, user);
    else merged = sanitizeMapData(fresh, merged, user);

    await putJson(fileName, merged);
    return respond(200, {
        ok: true,
        fileName,
        count: Array.isArray(merged) ? merged.length : 0,
        // Клиент использует этот снимок вместо повторного GET (CDN/гонка иначе «теряет» сообщения)
        data: merged
    });
}

async function handleCommit(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });

    const fileName = String(body.fileName || '');
    if (!ALLOWED_JSON.has(fileName)) return respond(400, { ok: false, error: 'bad_file' });

    const stagingKey = `staging/${payload.login}/${fileName}`;
    const proposed = await getJson(stagingKey, null);
    if (!Array.isArray(proposed)) {
        return respond(400, { ok: false, error: 'no_staging', message: `Missing ${stagingKey}` });
    }

    const result = await applyMergeAndSave(fileName, proposed, {
        login: payload.login,
        role: payload.role,
        displayName: payload.displayName
    });

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

    const fileName = String(body.fileName || '').replace(/^\/+/, '');
    const contentType = String(body.contentType || 'application/octet-stream');
    const contentLength = Number(body.contentLength || 0);
    if (!fileName || fileName.includes('..')) return respond(400, { ok: false, error: 'bad_file' });
    if (!ALLOWED_MEDIA_CT.test(contentType) && !fileName.startsWith('staging/')) {
        return respond(400, { ok: false, error: 'bad_content_type' });
    }

    let key;
    // Staging JSON для больших баз (обход лимита тела HTTP-триггера)
    const stagingMatch = fileName.match(/^staging\/([^/]+)\/(map_data\.json|profiles\.json|feed\.json|mail\.json)$/);
    if (stagingMatch) {
        if (stagingMatch[1] !== payload.login) return respond(403, { ok: false, error: 'bad_staging_owner' });
        key = fileName;
    } else if (ALLOWED_JSON.has(fileName) || fileName === AUTH_KEY || fileName.startsWith('_auth/')) {
        return respond(403, { ok: false, error: 'use_sync' });
    } else {
        const allowed = MEDIA_PREFIXES.some((p) => fileName.startsWith(p));
        if (!allowed) return respond(403, { ok: false, error: 'bad_prefix' });
        const safe = fileName.replace(/[^a-zA-Z0-9_\-./]/g, '_');
        key = safe.startsWith(`uploads/${payload.login}/`)
            ? safe
            : `uploads/${payload.login}/${safe.split('/').pop()}`;

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
    const hostBucket = key.startsWith('staging/') ? PRIVATE_BUCKET : BUCKET;
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

exports.handler = async function handler(event = {}) {
    const method = (event.httpMethod || event.requestContext?.http?.method || 'POST').toUpperCase();
    if (method === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }

    const ip = getHeader(event, 'x-forwarded-for') || event.requestContext?.identity?.sourceIp || 'unknown';
    const ipKey = String(ip).split(',')[0].trim();
    if (!rateLimit(`ip:${ipKey}`, 120, 60000)) {
        return respond(429, { ok: false, error: 'rate_limited' });
    }

    if (!JWT_SECRET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        return respond(500, { ok: false, error: 'server_misconfigured' });
    }

    const body = parseBody(event);
    // Legacy client shape { fileName, contentType } without action → reject (force upgrade)
    const action = body.action || (body.fileName && body.contentType && !body.data ? 'legacy_presign' : '');
    const tokenPayload = (action === 'sync' || action === 'commit' || action === 'presign' || action === 'me' || action === 'changePassword')
        ? verifyJwt(extractToken(event, body))
        : null;
    if (!actionRateLimit(action, ipKey, tokenPayload?.login || '')) {
        return respond(429, { ok: false, error: 'rate_limited' });
    }

    try {
        if (action === 'health') return respond(200, { ok: true, version: 2 });
        if (action === 'register') return await handleRegister(body);
        if (action === 'login') return await handleLogin(body);
        if (action === 'changePassword') return await handleChangePassword(event, body);
        if (action === 'me') return await handleMe(event, body);
        if (action === 'sync') return await handleSync(event, body);
        if (action === 'commit') return await handleCommit(event, body);
        if (action === 'presign') return await handlePresign(event, body);
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
        return respond(500, { ok: false, error: 'internal', detail: String(err.message || err) });
    }
};
