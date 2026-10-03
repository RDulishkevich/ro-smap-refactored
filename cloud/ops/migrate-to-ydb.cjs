/**
 * Copy current Object Storage JSON into YDB Document API rows.
 * Requires: AWS_* keys, YDB_DOCAPI_ENDPOINT, BUCKET / PRIVATE_BUCKET.
 * Does not delete S3 objects (public JSON stays as cache).
 */
const fs = require('fs');
const path = require('path');

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
    if (!process.env.YDB_DOCAPI_ENDPOINT) {
        console.error('Set YDB_DOCAPI_ENDPOINT (run cloud/ops/ydb-create.ps1)');
        process.exit(1);
    }
    const awsSdk = path.join(__dirname, '..', 'api', 'node_modules', '@aws-sdk', 'client-s3');
    const { S3Client, GetObjectCommand, ListObjectsV2Command } = require(awsSdk);
    const ydb = require('../api/ydbDoc');
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

    async function read(bucketName, key, fallback) {
        try {
            const res = await s3.send(new GetObjectCommand({ Bucket: bucketName, Key: key }));
            const chunks = [];
            for await (const c of res.Body) chunks.push(c);
            const text = Buffer.concat(chunks).toString('utf8');
            const data = JSON.parse(text || 'null');
            return data == null ? fallback : data;
        } catch (err) {
            if (err && (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404)) return fallback;
            throw err;
        }
    }

    const jobs = [
        ['map_data.json', bucket, []],
        ['profiles.json', bucket, []],
        ['feed.json', bucket, []],
        ['events.json', bucket, []],
        ['_auth/users.json', priv, {}],
        ['_auth/private_meta.json', priv, {}],
        ['_auth/login_locks.json', priv, {}],
        ['_auth/security_events.json', priv, []]
    ];

    for (const [key, bkt, fallback] of jobs) {
        const data = await read(bkt, key, fallback);
        await ydb.putJson(key, data);
        const n = Array.isArray(data) ? data.length : Object.keys(data || {}).length;
        console.log('ok', key, n);
    }

    const seen = new Set();
    const mail = await read(priv, 'mail.json', []);
    if (Array.isArray(mail)) {
        for (const row of mail) {
            const login = String(row?.loginName || '').toLowerCase();
            if (!login) continue;
            await ydb.putJson(`_mail/boxes/${login}.json`, row);
            seen.add(login);
            console.log('ok mail', login);
        }
    }
    let token;
    do {
        const listed = await s3.send(new ListObjectsV2Command({
            Bucket: priv,
            Prefix: '_mail/boxes/',
            ContinuationToken: token
        }));
        for (const obj of listed.Contents || []) {
            const key = obj.Key;
            const m = String(key || '').match(/^_mail\/boxes\/([^/]+)\.json$/i);
            if (!m) continue;
            const login = String(m[1] || '').toLowerCase();
            if (!login || seen.has(login)) continue;
            const row = await read(priv, key, null);
            if (!row) continue;
            await ydb.putJson(key, row);
            seen.add(login);
            console.log('ok mail', login);
        }
        token = listed.IsTruncated ? listed.NextContinuationToken : undefined;
    } while (token);
    console.log('migration done');
}

main().catch((err) => {
    console.error(err && (err.message || err));
    process.exit(1);
});
