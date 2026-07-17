/**
 * One-shot migration: extract inbox/notifications/activityLog from profiles.json → mail.json
 * and rewrite slim profile cards (визитки).
 *
 * Usage:
 *   node cloud/ops/split-profiles-mail.mjs
 *   node cloud/ops/split-profiles-mail.mjs --dry-run
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const require = createRequire(path.join(root, 'cloud/api/package.json'));
const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');

const dryRun = process.argv.includes('--dry-run');

function loadEnv(file) {
    const out = {};
    if (!fs.existsSync(file)) return out;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
        if (!line || line.trim().startsWith('#') || !line.includes('=')) continue;
        const i = line.indexOf('=');
        out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return out;
}

async function streamToString(stream) {
    if (!stream) return '';
    if (typeof stream.transformToString === 'function') return stream.transformToString();
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    return Buffer.concat(chunks).toString('utf8');
}

async function getJson(s3, bucket, key, fallback) {
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        return JSON.parse(await streamToString(res.Body));
    } catch (err) {
        if (err?.name === 'NoSuchKey' || err?.$metadata?.httpStatusCode === 404) return fallback;
        throw err;
    }
}

async function putJson(s3, bucket, key, data) {
    await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: Buffer.from(JSON.stringify(data), 'utf8'),
        ContentType: 'application/json; charset=utf-8'
    }));
}

function mergeKeyed(a = [], b = []) {
    const map = new Map();
    [...a, ...b].forEach((item) => {
        if (!item?.id) return;
        map.set(item.id, { ...(map.get(item.id) || {}), ...item });
    });
    return Array.from(map.values());
}

const env = loadEnv(path.join(root, 'cloud/api/.env'));
const bucket = env.BUCKET || 'rosmap2026';
if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    console.error('Need cloud/api/.env with AWS keys');
    process.exit(1);
}

const s3 = new S3Client({
    region: 'ru-central1',
    endpoint: env.STORAGE_ENDPOINT || 'https://storage.yandexcloud.net',
    credentials: {
        accessKeyId: env.AWS_ACCESS_KEY_ID,
        secretAccessKey: env.AWS_SECRET_ACCESS_KEY
    },
    forcePathStyle: true
});

const profiles = await getJson(s3, bucket, 'profiles.json', []);
const existingMail = await getJson(s3, bucket, 'mail.json', []);
const mailMap = new Map(
    (Array.isArray(existingMail) ? existingMail : []).map((m) => [String(m.loginName || '').toLowerCase(), m])
);

const cards = [];
let movedMsgs = 0;
let movedNotifs = 0;

for (const p of (Array.isArray(profiles) ? profiles : [])) {
    if (!p?.loginName) continue;
    const login = String(p.loginName).toLowerCase();
    const prev = mailMap.get(login) || { loginName: login, inbox: [], notifications: [], activityLog: [] };
    const inbox = mergeKeyed(prev.inbox || [], p.inbox || []);
    const notifications = mergeKeyed(prev.notifications || [], p.notifications || []);
    const activityLog = mergeKeyed(prev.activityLog || [], p.activityLog || []);
    movedMsgs += (p.inbox || []).length;
    movedNotifs += (p.notifications || []).length;
    mailMap.set(login, { loginName: login, inbox, notifications, activityLog });

    const {
        inbox: _i,
        notifications: _n,
        activityLog: _a,
        ...card
    } = p;
    card.loginName = login;
    // Drop embedded data-URLs from avatars / session photos
    if (typeof card.avatar === 'string' && /^(data:|blob:)/i.test(card.avatar)) card.avatar = '';
    if (Array.isArray(card.sessions)) {
        card.sessions = card.sessions.map((s) => ({
            ...s,
            photos: (s.photos || []).filter((u) => typeof u === 'string' && /^https?:\/\//i.test(u))
        }));
    }
    cards.push(card);
}

const mail = Array.from(mailMap.values());
const before = Buffer.byteLength(JSON.stringify(profiles), 'utf8');
const afterProfiles = Buffer.byteLength(JSON.stringify(cards), 'utf8');
const afterMail = Buffer.byteLength(JSON.stringify(mail), 'utf8');

console.log(`profiles: ${profiles.length} → cards ${cards.length}, mail rows ${mail.length}`);
console.log(`size profiles.json: ${(before / 1024).toFixed(1)} KB → ${(afterProfiles / 1024).toFixed(1)} KB`);
console.log(`size mail.json: ${(afterMail / 1024).toFixed(1)} KB`);
console.log(`embedded messages seen: ${movedMsgs}, notifications: ${movedNotifs}`);

if (dryRun) {
    console.log('Dry run — nothing written.');
    process.exit(0);
}

await putJson(s3, bucket, 'mail.json', mail);
await putJson(s3, bucket, 'profiles.json', cards);
console.log('Wrote mail.json + slim profiles.json');
