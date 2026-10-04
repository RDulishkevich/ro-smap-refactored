'use strict';

const crypto = require('crypto');

const PREFIX = 'enc:v1:';

function mailKey() {
    const secret = process.env.MAIL_ENC_KEY || process.env.JWT_SECRET || '';
    if (!secret) return null;
    return crypto.createHash('sha256').update(`polevka-mail-v1:${secret}`).digest();
}

function encryptString(plain) {
    if (plain == null || plain === '') return plain;
    const s = String(plain);
    if (s.startsWith(PREFIX)) return s;
    const key = mailKey();
    if (!key) return s;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const enc = Buffer.concat([cipher.update(s, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return PREFIX + [iv, tag, enc].map((b) => b.toString('base64url')).join('.');
}

function decryptString(value) {
    const s = String(value || '');
    if (!s.startsWith(PREFIX)) return s;
    const key = mailKey();
    if (!key) return s;
    try {
        const [ivB, tagB, encB] = s.slice(PREFIX.length).split('.');
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivB, 'base64url'));
        decipher.setAuthTag(Buffer.from(tagB, 'base64url'));
        return Buffer.concat([
            decipher.update(Buffer.from(encB, 'base64url')),
            decipher.final()
        ]).toString('utf8');
    } catch (_) {
        return s;
    }
}

function cryptMessage(msg, fn) {
    if (!msg || typeof msg !== 'object') return msg;
    const out = { ...msg };
    if (typeof out.text === 'string') out.text = fn(out.text);
    if (typeof out.image === 'string') out.image = fn(out.image);
    if (typeof out.video === 'string') out.video = fn(out.video);
    return out;
}

function cryptNotif(n, fn) {
    if (!n || typeof n !== 'object') return n;
    if (typeof n.text !== 'string') return n;
    return { ...n, text: fn(n.text) };
}

function encryptMailBox(row) {
    if (!row || typeof row !== 'object') return row;
    return {
        ...row,
        inbox: (Array.isArray(row.inbox) ? row.inbox : []).map((m) => cryptMessage(m, encryptString)),
        notifications: (Array.isArray(row.notifications) ? row.notifications : []).map((n) => cryptNotif(n, encryptString))
    };
}

function decryptMailBox(row) {
    if (!row || typeof row !== 'object') return row;
    return {
        ...row,
        inbox: (Array.isArray(row.inbox) ? row.inbox : []).map((m) => cryptMessage(m, decryptString)),
        notifications: (Array.isArray(row.notifications) ? row.notifications : []).map((n) => cryptNotif(n, decryptString))
    };
}

module.exports = { encryptMailBox, decryptMailBox, encryptString, decryptString };
