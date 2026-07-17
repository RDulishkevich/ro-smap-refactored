/**
 * RO.SMap Secure API — Yandex Cloud Function
 *
 * Env:
 *   BUCKET            — Object Storage bucket (default rosmap2026)
 *   AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY — static keys with write access
 *   STORAGE_ENDPOINT  — https://storage.yandexcloud.net
 *   JWT_SECRET        — long random string for session tokens
 *   ADMIN_PASSWORD    — bootstrap / admin login password (NOT shipped to client)
 *   ALLOWED_ORIGIN    — CORS origin (default *)
 *
 * Actions (POST JSON { action, ... }):
 *   health | register | login | changePassword | me | sync | presign
 */

const crypto = require('crypto');
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

const BUCKET = process.env.BUCKET || 'rosmap2026';
const ENDPOINT = process.env.STORAGE_ENDPOINT || 'https://storage.yandexcloud.net';
const JWT_SECRET = process.env.JWT_SECRET || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '*';
const AUTH_KEY = '_auth/users.json';
const ALLOWED_JSON = new Set(['map_data.json', 'profiles.json', 'feed.json']);
const MEDIA_PREFIXES = ['uploads/', 'audio/', 'images/'];
const TOKEN_TTL_SEC = 60 * 60 * 24 * 14; // 14 days

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
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
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

function rateLimit(ip, limit = 60, windowMs = 60000) {
    const now = Date.now();
    const row = rateBucket.get(ip) || { n: 0, t: now };
    if (now - row.t > windowMs) {
        row.n = 0;
        row.t = now;
    }
    row.n += 1;
    rateBucket.set(ip, row);
    return row.n <= limit;
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
    const auth = getHeader(event, 'authorization') || '';
    if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
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
        const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
        const text = await streamToString(res.Body);
        const data = JSON.parse(text || 'null');
        return data == null ? fallback : data;
    } catch (err) {
        if (err && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) return fallback;
        throw err;
    }
}

async function putJson(key, data) {
    await s3.send(new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        Body: Buffer.from(JSON.stringify(data), 'utf8'),
        ContentType: 'application/json; charset=utf-8'
    }));
}

async function loadAuthUsers() {
    const users = await getJson(AUTH_KEY, {});
    return users && typeof users === 'object' ? users : {};
}

async function saveAuthUsers(users) {
    await putJson(AUTH_KEY, users);
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
        if (s.deleted) { map.set(s.id, s); return; }
        if (cloud.deleted && !s.deleted) { map.set(s.id, s); return; }
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
        merged.inbox = mergeKeyedArrays(cloud.inbox || [], p.inbox || []);
        merged.notifications = mergeKeyedArrays(cloud.notifications || [], p.notifications || []);
        merged.activityLog = mergeKeyedArrays(cloud.activityLog || [], p.activityLog || []);
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
    if (user.role === 'admin') return merged;
    const freshMap = new Map((fresh || []).map((p) => [String(p.loginName || '').toLowerCase(), p]));
    return (merged || []).map((p) => {
        const login = String(p.loginName || '').toLowerCase();
        const cloud = freshMap.get(login) || {};
        if (login === user.login) {
            return {
                ...p,
                role: cloud.role === 'admin' ? 'admin' : 'user',
                blocked: !!cloud.blocked,
                badges: Array.isArray(cloud.badges) ? cloud.badges : [],
                loginName: login
            };
        }
        return {
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
            inbox: sanitizeInbox(cloud.inbox || [], p.inbox || [], user.login),
            notifications: mergeKeyedArrays(cloud.notifications || [], (p.notifications || []).filter((n) => {
                // allow new notifs that reference actor, otherwise keep cloud
                return !n?.id || (cloud.notifications || []).some((x) => x.id === n.id) || String(n.fromId || '').toLowerCase() === user.login;
            })),
            activityLog: cloud.activityLog || [],
            typing: p.typing !== undefined ? laterTyping(cloud.typing, p.typing) : cloud.typing,
            lastSeen: laterIso(cloud.lastSeen, p.lastSeen),
            profileUpdatedAt: cloud.profileUpdatedAt
        };
    });
}

function sanitizeMapData(fresh, merged, user) {
    if (user.role === 'admin') return merged;
    const freshMap = new Map((fresh || []).map((s) => [s.id, s]));
    const out = [];
    for (const s of merged || []) {
        const cloud = freshMap.get(s.id);
        if (!cloud) {
            // new record — force ownership
            out.push({
                ...s,
                recordistId: user.login,
                recordist: s.recordist || user.displayName || user.login,
                status: s.status === 'draft' ? 'draft' : 'pending'
            });
            continue;
        }
        if (ownsSound(cloud, user.login)) {
            out.push({
                ...s,
                recordistId: user.login,
                // non-admin cannot self-publish
                status: s.status === 'published' && cloud.status !== 'published' ? 'pending' : s.status
            });
            continue;
        }
        // foreign sound: allow only social fields from actor
        out.push({
            ...cloud,
            comments: mergeCommentLists(cloud.comments || [], s.comments || []),
            reports: mergeKeyedArrays(cloud.reports || [], s.reports || []),
            likedBy: Array.isArray(s.likedBy) ? s.likedBy : (cloud.likedBy || []),
            dislikedBy: Array.isArray(s.dislikedBy) ? s.dislikedBy : (cloud.dislikedBy || []),
            plays: Math.max(cloud.plays || 0, s.plays || 0),
            downloads: Math.max(cloud.downloads || 0, s.downloads || 0)
        });
    }
    // keep any fresh sounds missing from merged (prevent wipe)
    for (const [id, cloud] of freshMap.entries()) {
        if (!out.some((s) => s.id === id)) out.push(cloud);
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
            notifications: [],
            inbox: [],
            sessions: [],
            badges: [],
            progress: { xp: 0, achievements: [], completedQuests: [], guessrBestScore: 0 }
        });
        await putJson('profiles.json', profiles);
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

    const fresh = await getJson(fileName, []);
    if (!proposed.length && Array.isArray(fresh) && fresh.length) {
        return respond(200, { ok: true, skipped: true, data: fresh });
    }

    let merged = proposed;
    if (Array.isArray(fresh)) {
        if (fileName === 'profiles.json') merged = mergeProfilesArrays(fresh, proposed);
        else if (fileName === 'feed.json') merged = mergeFeedPostsArrays(fresh, proposed);
        else merged = mergeMapDataArrays(fresh, proposed);
    }

    const user = { login: payload.login, role: payload.role, displayName: payload.displayName };
    if (fileName === 'profiles.json') merged = sanitizeProfiles(fresh, merged, user);
    else if (fileName === 'feed.json') merged = sanitizeFeed(fresh, merged, user);
    else merged = sanitizeMapData(fresh, merged, user);

    await putJson(fileName, merged);
    return respond(200, { ok: true, data: merged });
}

async function handlePresign(event, body) {
    const payload = verifyJwt(extractToken(event, body));
    if (!payload) return respond(401, { ok: false, error: 'unauthorized' });

    const fileName = String(body.fileName || '').replace(/^\/+/, '');
    const contentType = String(body.contentType || 'application/octet-stream');
    if (!fileName || fileName.includes('..')) return respond(400, { ok: false, error: 'bad_file' });

    // JSON database files must go through action=sync, never raw presign
    if (ALLOWED_JSON.has(fileName) || fileName === AUTH_KEY || fileName.startsWith('_auth/')) {
        return respond(403, { ok: false, error: 'use_sync' });
    }
    const allowed = MEDIA_PREFIXES.some((p) => fileName.startsWith(p));
    if (!allowed) return respond(403, { ok: false, error: 'bad_prefix' });

    // namespace by user
    const safe = fileName.replace(/[^a-zA-Z0-9_\-./]/g, '_');
    const key = safe.startsWith(`uploads/${payload.login}/`)
        ? safe
        : `uploads/${payload.login}/${safe.split('/').pop()}`;

    const command = new PutObjectCommand({
        Bucket: BUCKET,
        Key: key,
        ContentType: contentType
    });
    const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 900 });
    return respond(200, {
        ok: true,
        uploadUrl,
        publicUrl: `${ENDPOINT}/${BUCKET}/${key}`,
        key
    });
}

exports.handler = async function handler(event = {}) {
    const method = (event.httpMethod || event.requestContext?.http?.method || 'POST').toUpperCase();
    if (method === 'OPTIONS') {
        return { statusCode: 204, headers: corsHeaders(), body: '' };
    }

    const ip = getHeader(event, 'x-forwarded-for') || event.requestContext?.identity?.sourceIp || 'unknown';
    if (!rateLimit(String(ip).split(',')[0].trim())) {
        return respond(429, { ok: false, error: 'rate_limited' });
    }

    if (!JWT_SECRET || !process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
        return respond(500, { ok: false, error: 'server_misconfigured' });
    }

    const body = parseBody(event);
    // Legacy client shape { fileName, contentType } without action → reject (force upgrade)
    const action = body.action || (body.fileName && body.contentType && !body.data ? 'legacy_presign' : '');

    try {
        if (action === 'health') return respond(200, { ok: true, version: 1 });
        if (action === 'register') return await handleRegister(body);
        if (action === 'login') return await handleLogin(body);
        if (action === 'changePassword') return await handleChangePassword(event, body);
        if (action === 'me') return await handleMe(event, body);
        if (action === 'sync') return await handleSync(event, body);
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
