/**
 * YDB Document API (DynamoDB protocol) — source of truth for Полёвка rows.
 * No gRPC SDK: Cloud Function zip stays small. Public JSON is a published cache.
 *
 * Env: YDB_DOCAPI_ENDPOINT (https://docapi.serverless.yandexcloud.net/ru-central1/…/…)
 *      AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY (SA static key with ydb.databaseUser)
 */
const crypto = require('crypto');

const TABLE = 'polevka_rows';
const REGION = process.env.YDB_DOCAPI_REGION || 'ru-central1';
const SERVICE = 'dynamodb';
const PUBLIC_KEYS = new Set(['map_data.json', 'profiles.json', 'feed.json', 'events.json']);

const COLLECTIONS = {
    'map_data.json': { kind: 'sound', mode: 'array', idOf: (r) => (r && r.id != null ? String(r.id) : '') },
    'profiles.json': { kind: 'profile', mode: 'array', idOf: (r) => String(r?.loginName || '').toLowerCase() },
    'feed.json': { kind: 'feed', mode: 'array', idOf: (r) => (r && r.id != null ? String(r.id) : '') },
    'events.json': { kind: 'event', mode: 'array', idOf: (r) => (r && r.id != null ? String(r.id) : '') },
    '_auth/users.json': { kind: 'user', mode: 'map' },
    '_auth/private_meta.json': { kind: 'meta', mode: 'map' },
    '_auth/login_locks.json': { kind: 'lock', mode: 'map' }
};

function enabled() {
    return !!(process.env.YDB_DOCAPI_ENDPOINT && process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

function resolveKey(key) {
    if (COLLECTIONS[key]) return COLLECTIONS[key];
    const mail = String(key || '').match(/^_mail\/boxes\/([^/]+)\.json$/i);
    if (mail) return { kind: 'mail', mode: 'item', id: String(mail[1] || '').toLowerCase() };
    if (String(key || '').startsWith('_auth/')) return { kind: 'kv', mode: 'item', id: String(key) };
    return null;
}

function sha256hex(data) {
    return crypto.createHash('sha256').update(data, 'utf8').digest('hex');
}

function hmac(key, data) {
    return crypto.createHmac('sha256', key).update(data, 'utf8').digest();
}

async function docapi(target, payload) {
    const endpoint = process.env.YDB_DOCAPI_ENDPOINT;
    const url = new URL(endpoint);
    const body = JSON.stringify(payload);
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
    const dateStamp = amzDate.slice(0, 8);
    const access = process.env.AWS_ACCESS_KEY_ID;
    const secret = process.env.AWS_SECRET_ACCESS_KEY;
    const canonicalUri = url.pathname.split('/').map((p) => encodeURIComponent(p)).join('/').replace(/%2F/g, '/') || '/';
    const canonicalHeaders = `content-type:application/x-amz-json-1.0\nhost:${url.host}\nx-amz-date:${amzDate}\nx-amz-target:${target}\n`;
    const signedHeaders = 'content-type;host;x-amz-date;x-amz-target';
    const canonical = `POST\n${canonicalUri}\n\n${canonicalHeaders}\n${signedHeaders}\n${sha256hex(body)}`;
    const scope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`;
    const stringToSign = `AWS4-HMAC-SHA256\n${amzDate}\n${scope}\n${sha256hex(canonical)}`;
    const kSigning = hmac(hmac(hmac(hmac(`AWS4${secret}`, dateStamp), REGION), SERVICE), 'aws4_request');
    const signature = crypto.createHmac('sha256', kSigning).update(stringToSign, 'utf8').digest('hex');
    const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-amz-json-1.0',
            'X-Amz-Date': amzDate,
            'X-Amz-Target': target,
            Authorization: `AWS4-HMAC-SHA256 Credential=${access}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
        },
        body
    });
    const text = await res.text();
    let data = {};
    try { data = text ? JSON.parse(text) : {}; } catch (_) { data = { message: text }; }
    if (!res.ok) {
        const type = String(data.__type || data.code || '');
        const err = new Error(data.message || type || `docapi_${res.status}`);
        err.code = type.split('#').pop() || 'docapi';
        err.status = res.status;
        throw err;
    }
    return data;
}

let tableReady = null;

async function ensureTable() {
    if (tableReady) return tableReady;
    tableReady = (async () => {
        try {
            await docapi('DynamoDB_20120810.CreateTable', {
                TableName: TABLE,
                KeySchema: [
                    { AttributeName: 'kind', KeyType: 'HASH' },
                    { AttributeName: 'id', KeyType: 'RANGE' }
                ],
                AttributeDefinitions: [
                    { AttributeName: 'kind', AttributeType: 'S' },
                    { AttributeName: 'id', AttributeType: 'S' }
                ]
            });
        } catch (err) {
            if (!/ResourceInUse|AlreadyExists/i.test(String(err.code || err.message || ''))) throw err;
        }
    })();
    return tableReady;
}

function fromItem(item) {
    if (!item || !item.body || item.body.S == null) return null;
    try { return JSON.parse(item.body.S); } catch (_) { return null; }
}

function revOf(item) {
    return item && item.rev && item.rev.N != null ? String(item.rev.N) : '0';
}

async function getRow(kind, id) {
    await ensureTable();
    const out = await docapi('DynamoDB_20120810.GetItem', {
        TableName: TABLE,
        Key: { kind: { S: kind }, id: { S: String(id) } }
    });
    return out.Item || null;
}

async function putRow(kind, id, body, { ifRev } = {}) {
    await ensureTable();
    const nextRev = String(Date.now());
    const item = {
        kind: { S: kind },
        id: { S: String(id) },
        body: { S: JSON.stringify(body) },
        rev: { N: nextRev }
    };
    const req = { TableName: TABLE, Item: item };
    if (ifRev != null && ifRev !== '') {
        req.ConditionExpression = 'attribute_not_exists(rev) OR rev = :old';
        req.ExpressionAttributeValues = { ':old': { N: String(ifRev) } };
    }
    try {
        await docapi('DynamoDB_20120810.PutItem', req);
    } catch (err) {
        if (/ConditionalCheckFailed/i.test(String(err.code || err.message || ''))) {
            const conflict = new Error('write_conflict');
            conflict.code = 'write_conflict';
            throw conflict;
        }
        throw err;
    }
    return nextRev;
}

async function deleteRow(kind, id) {
    await ensureTable();
    await docapi('DynamoDB_20120810.DeleteItem', {
        TableName: TABLE,
        Key: { kind: { S: kind }, id: { S: String(id) } }
    });
}

async function batchWrite(requests) {
    await ensureTable();
    for (let i = 0; i < requests.length; i += 25) {
        let chunk = requests.slice(i, i + 25);
        for (let attempt = 0; attempt < 4 && chunk.length; attempt++) {
            const out = await docapi('DynamoDB_20120810.BatchWriteItem', {
                RequestItems: { [TABLE]: chunk }
            });
            const again = (out.UnprocessedItems && out.UnprocessedItems[TABLE]) || [];
            if (!again.length) break;
            chunk = again;
            if (attempt === 3 && again.length) {
                const err = new Error('ydb_batch_incomplete');
                err.code = 'write_conflict';
                throw err;
            }
        }
    }
}

async function queryKind(kind) {
    await ensureTable();
    const items = [];
    let start;
    do {
        const req = {
            TableName: TABLE,
            KeyConditionExpression: 'kind = :k',
            ExpressionAttributeValues: { ':k': { S: kind } }
        };
        if (start) req.ExclusiveStartKey = start;
        const out = await docapi('DynamoDB_20120810.Query', req);
        items.push(...(out.Items || []));
        start = out.LastEvaluatedKey;
    } while (start);
    return items;
}

function collectionFromItems(spec, items) {
    if (spec.mode === 'map') {
        const obj = {};
        for (const it of items) {
            const row = fromItem(it);
            if (row != null) obj[it.id.S] = row;
        }
        return obj;
    }
    if (spec.mode === 'item') {
        const it = items[0];
        return it ? fromItem(it) : null;
    }
    return items.map(fromItem).filter((r) => r != null);
}

async function loadSpec(key, spec, fallback) {
    if (spec.mode === 'item') {
        const it = await getRow(spec.kind, spec.id);
        if (!it) return { data: fallback, etag: null, missing: true };
        return { data: fromItem(it), etag: revOf(it), missing: false };
    }
    const items = await queryKind(spec.kind);
    if (!items.length) return { data: fallback, etag: null, missing: true };
    const data = collectionFromItems(spec, items);
    const etag = items.map(revOf).sort().join(',') || '0';
    return { data, etag, missing: false };
}

async function saveSpec(key, spec, data, { ifMatch, publish } = {}) {
    if (spec.mode === 'item') {
        await putRow(spec.kind, spec.id, data, { ifRev: ifMatch });
        return;
    }
    const prev = await queryKind(spec.kind);
    const prevIds = new Set(prev.map((it) => it.id.S));
    const nextEntries = spec.mode === 'map'
        ? Object.entries(data || {})
        : (data || []).map((row) => [spec.idOf(row), row]).filter(([id]) => id);
    const nextIds = new Set(nextEntries.map(([id]) => id));
    const reqs = [];
    for (const [id, row] of nextEntries) {
        reqs.push({
            PutRequest: {
                Item: {
                    kind: { S: spec.kind },
                    id: { S: String(id) },
                    body: { S: JSON.stringify(row) },
                    rev: { N: String(Date.now()) }
                }
            }
        });
    }
    for (const id of prevIds) {
        if (!nextIds.has(id)) {
            reqs.push({ DeleteRequest: { Key: { kind: { S: spec.kind }, id: { S: String(id) } } } });
        }
    }
    await batchWrite(reqs);
    if (publish && PUBLIC_KEYS.has(key)) await publish(key, data);
}

async function getJsonCas(key, fallback) {
    const spec = resolveKey(key);
    if (!spec) return null;
    return loadSpec(key, spec, fallback);
}

async function putJson(key, data, opts = {}) {
    const spec = resolveKey(key);
    if (!spec) return false;
    await saveSpec(key, spec, data, opts);
    return true;
}

async function mutateRow(kind, id, mutator) {
    for (let i = 0; i < 4; i++) {
        const it = await getRow(kind, id);
        if (!it) return null;
        const prev = fromItem(it);
        const next = await mutator(prev, { etag: revOf(it) });
        if (next === undefined) return prev;
        try {
            await putRow(kind, id, next, { ifRev: revOf(it) });
            return next;
        } catch (err) {
            if (err && err.code === 'write_conflict' && i < 3) continue;
            throw err;
        }
    }
    const err = new Error('write_conflict');
    err.code = 'write_conflict';
    throw err;
}

async function scanKind(kind) {
    const items = await queryKind(kind);
    return items.map(fromItem).filter((r) => r != null);
}

module.exports = {
    enabled,
    resolveKey,
    getJsonCas,
    putJson,
    mutateRow,
    scanKind,
    PUBLIC_KEYS
};
