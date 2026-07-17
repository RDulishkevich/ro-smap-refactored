/**
 * Upload local backup folder to Object Storage + private auth snapshot.
 * Reads keys from cloud/api/.env (not committed).
 *
 * node cloud/ops/backup-upload.mjs --stamp 2026-07-17_1855 --local cloud/backups/...
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');
const require = createRequire(path.join(root, 'cloud/api/package.json'));
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

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

function arg(name, fallback = '') {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 ? process.argv[i + 1] : fallback;
}

async function streamToBuffer(stream) {
    if (!stream) return Buffer.alloc(0);
    if (typeof stream.transformToByteArray === 'function') {
        return Buffer.from(await stream.transformToByteArray());
    }
    const chunks = [];
    for await (const c of stream) chunks.push(c);
    return Buffer.concat(chunks);
}

const env = loadEnv(path.join(root, 'cloud/api/.env'));
const stamp = arg('stamp', new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(' ', '_'));
const localDir = arg('local', path.join(root, 'cloud/backups', stamp));
const bucket = env.BUCKET || 'rosmap2026';

if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
    console.error('Missing AWS keys in cloud/api/.env');
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

const files = ['map_data.json', 'profiles.json', 'mail.json', 'feed.json'];
for (const file of files) {
    const body = fs.readFileSync(path.join(localDir, file));
    const key = `backups/${stamp}/${file}`;
    await s3.send(new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: 'application/json; charset=utf-8'
    }));
    console.log('uploaded', key, body.length);
}

try {
    const auth = await s3.send(new GetObjectCommand({
        Bucket: env.PRIVATE_BUCKET || 'rosmap2026-private',
        Key: '_auth/users.json'
    }));
    const buf = await streamToBuffer(auth.Body);
    const key = `_auth/backups/${stamp}/users.json`;
    await s3.send(new PutObjectCommand({
        Bucket: env.PRIVATE_BUCKET || 'rosmap2026-private',
        Key: key,
        Body: buf,
        ContentType: 'application/json; charset=utf-8',
        ACL: 'private'
    }));
    console.log('uploaded private', key, buf.length);
} catch (e) {
    console.warn('auth backup skipped:', e.message);
}
