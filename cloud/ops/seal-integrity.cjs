/**
 * Write HMAC .sig for existing catalog / auth / mail JSON so v18 can fail-closed.
 * Reads raw object bytes (does not rewrite JSON). Never prints JWT_SECRET.
 *
 *   node cloud/ops/seal-integrity.cjs
 */
const fs = require('fs');
const path = require('path');
const sessionSec = require('../api/sessionSecurity');

function loadEnv() {
    const p = path.join(__dirname, '..', 'api', '.env');
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, 'utf8').split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m || process.env[m[1]]) continue;
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
}

async function main() {
    loadEnv();
    const secret = process.env.JWT_SECRET || '';
    if (!secret || secret === 'change-me-to-long-random-string') {
        console.error('JWT_SECRET missing in cloud/api/.env (same secret as the Cloud Function)');
        process.exit(1);
    }
    const { S3Client, GetObjectCommand, PutObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
    const bucket = process.env.BUCKET || 'rosmap2026';
    const priv = process.env.PRIVATE_BUCKET || 'rosmap2026-private';
    const s3 = new S3Client({
        region: 'ru-central1',
        endpoint: process.env.STORAGE_ENDPOINT || 'https://storage.yandexcloud.net',
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
        },
        forcePathStyle: true
    });

    async function raw(bucketName, key) {
        try {
            const res = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
            const chunks = [];
            for await (const c of res.Body) chunks.push(c);
            return Buffer.concat(chunks).toString('utf8');
        } catch (err) {
            if (err && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) return null;
            throw err;
        }
    }

    async function seal(key, bucketName) {
        const text = await raw(bucketName, key);
        if (text == null) {
            console.log('skip', key);
            return;
        }
        const sig = sessionSec.signIntegrity(text, secret);
        await s3.send(new PutObjectCommand({
            Bucket: priv,
            Key: sessionSec.integrityKeyFor(key),
            Body: Buffer.from(JSON.stringify({
                key,
                alg: 'hmac-sha256',
                sig,
                at: new Date().toISOString()
            }), 'utf8'),
            ContentType: 'application/json; charset=utf-8',
            ACL: 'private'
        }));
        console.log('sealed', key);
    }

    const publicKeys = ['map_data.json', 'profiles.json', 'feed.json', 'events.json'];
    const privateKeys = ['mail.json', '_auth/users.json', '_auth/private_meta.json'];
    for (const key of publicKeys) await seal(key, bucket);
    for (const key of privateKeys) await seal(key, priv);

    let token;
    do {
        const listed = await s3.send(new ListObjectsV2Command({
            Bucket: priv,
            Prefix: '_mail/boxes/',
            ContinuationToken: token
        }));
        for (const obj of listed.Contents || []) {
            if (obj.Key && obj.Key.endsWith('.json')) await seal(obj.Key, priv);
        }
        token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);

    console.log('seal done');
}

main().catch((err) => {
    console.error(err && (err.code || err.name) || 'seal_failed');
    process.exit(1);
});
