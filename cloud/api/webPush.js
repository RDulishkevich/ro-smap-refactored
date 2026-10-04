/**
 * Web Push (VAPID). Payload is a short notice — not the full message text.
 * Fails closed when keys or `web-push` are missing.
 */
'use strict';

let webpush = null;
try {
    webpush = require('web-push');
} catch (_) {
    webpush = null;
}

function vapidPublic() {
    return String(process.env.VAPID_PUBLIC_KEY || '').trim();
}

function vapidPrivate() {
    return String(process.env.VAPID_PRIVATE_KEY || '').trim();
}

function configured() {
    return !!(webpush && vapidPublic() && vapidPrivate());
}

function init() {
    if (!configured()) return false;
    webpush.setVapidDetails(
        String(process.env.VAPID_SUBJECT || 'mailto:support@polevka.art').trim(),
        vapidPublic(),
        vapidPrivate()
    );
    return true;
}

function send(sub, payload) {
    if (!init() || !sub || !sub.endpoint || !sub.keys) {
        return Promise.resolve({ ok: false, gone: false });
    }
    const body = JSON.stringify({
        title: String(payload && payload.title ? payload.title : 'Полёвка').slice(0, 80),
        body: String(payload && payload.body ? payload.body : 'Новое сообщение').slice(0, 140),
        tag: String(payload && payload.tag ? payload.tag : 'mail').slice(0, 80),
        url: String(payload && payload.url ? payload.url : '/messages').slice(0, 200)
    });
    const job = webpush.sendNotification({
        endpoint: String(sub.endpoint),
        keys: {
            p256dh: String(sub.keys.p256dh || ''),
            auth: String(sub.keys.auth || '')
        }
    }, body, { TTL: 3600, urgency: 'high' });
    const timeout = new Promise((_, reject) => {
        setTimeout(() => reject(Object.assign(new Error('timeout'), { statusCode: 0 })), 4000);
    });
    return Promise.race([job, timeout]).then(() => ({ ok: true, gone: false })).catch((err) => {
        const status = Number(err && (err.statusCode || err.status)) || 0;
        return { ok: false, gone: status === 404 || status === 410 };
    });
}

module.exports = { configured, vapidPublic, send };
