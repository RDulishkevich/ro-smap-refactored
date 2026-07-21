/**
 * One-shot: migrate mail.json public -> private, then delete public copy.
 * Uses Cloud Function env (AWS_*). Does not print secrets.
 *
 *   node cloud/ops/migrate-mail-private.cjs
 */
const { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand } = require('../api/node_modules/@aws-sdk/client-s3');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function loadEnvFromActiveFunction() {
    const raw = execFileSync('yc', [
        'serverless', 'function', 'version', 'list',
        '--function-id', 'd4ebp9rd7rd53iso4p8u',
        '--limit', '1',
        '--format', 'json'
    ], { encoding: 'utf8' });
    const list = JSON.parse(raw);
    const rows = Array.isArray(list) ? list : (list.value || []);
    const id = rows[0]?.id;
    if (!id) throw new Error('no active function version');
    const ver = JSON.parse(execFileSync('yc', [
        'serverless', 'function', 'version', 'get',
        '--id', id,
        '--format', 'json'
    ], { encoding: 'utf8' }));
    return ver.environment || {};
}

async function streamToString(stream) {
    if (!stream) return '';
    if (typeof stream.transformToString === 'function') return stream.transformToString();
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    return Buffer.concat(chunks).toString('utf8');
}

async function main() {
    const env = loadEnvFromActiveFunction();
    const endpoint = env.STORAGE_ENDPOINT || 'https://storage.yandexcloud.net';
    const publicBucket = env.BUCKET || 'rosmap2026';
    const privateBucket = env.PRIVATE_BUCKET || 'rosmap2026-private';
    if (!env.AWS_ACCESS_KEY_ID || !env.AWS_SECRET_ACCESS_KEY) {
        throw new Error('missing AWS keys on function env');
    }

    const s3 = new S3Client({
        region: 'ru-central1',
        endpoint,
        credentials: {
            accessKeyId: env.AWS_ACCESS_KEY_ID,
            secretAccessKey: env.AWS_SECRET_ACCESS_KEY
        },
        forcePathStyle: true
    });

    let publicMail = null;
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: publicBucket, Key: 'mail.json' }));
        const text = await streamToString(res.Body);
        publicMail = JSON.parse(text || '[]');
        console.log('public mail records:', Array.isArray(publicMail) ? publicMail.length : 'bad');
    } catch (err) {
        console.log('public mail read:', err.name || err.Code || err.message);
    }

    let privateMail = null;
    try {
        const res = await s3.send(new GetObjectCommand({ Bucket: privateBucket, Key: 'mail.json' }));
        const text = await streamToString(res.Body);
        privateMail = JSON.parse(text || '[]');
        console.log('private mail records:', Array.isArray(privateMail) ? privateMail.length : 'bad');
    } catch (err) {
        console.log('private mail read:', err.name || err.Code || err.message);
    }

    const source = (Array.isArray(privateMail) && privateMail.length)
        ? privateMail
        : (Array.isArray(publicMail) ? publicMail : []);

    await s3.send(new PutObjectCommand({
        Bucket: privateBucket,
        Key: 'mail.json',
        Body: Buffer.from(JSON.stringify(source), 'utf8'),
        ContentType: 'application/json; charset=utf-8'
    }));
    console.log('wrote private mail.json, records:', source.length);

    try {
        await s3.send(new DeleteObjectCommand({ Bucket: publicBucket, Key: 'mail.json' }));
        console.log('deleted public mail.json');
    } catch (err) {
        console.log('delete public failed, scrubbing to []:', err.name || err.message);
        await s3.send(new PutObjectCommand({
            Bucket: publicBucket,
            Key: 'mail.json',
            Body: Buffer.from('[]', 'utf8'),
            ContentType: 'application/json; charset=utf-8'
        }));
        console.log('scrubbed public mail.json to []');
    }

    const backupDir = path.join(__dirname, '..', 'backups');
    fs.mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    fs.writeFileSync(path.join(backupDir, `mail-migrated-${stamp}.json`), JSON.stringify(source, null, 2));
    console.log('local backup written under cloud/backups/');
}

main().catch((err) => {
    console.error('migrate failed:', err.message || err);
    process.exit(1);
});
