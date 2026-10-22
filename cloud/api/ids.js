/**
 * Opaque entity IDs for Полёвка (usr_/snd_/exp_/evt_/pst_).
 * ULID-like: prefix + Crockford base32 of (ms timestamp + entropy).
 */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeBase32(buf) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < buf.length; i++) {
    value = (value << 8) | buf[i];
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

function newEntityId(prefix) {
  const p = String(prefix || 'id').replace(/[^a-z]/gi, '').toLowerCase().slice(0, 4) || 'id';
  const ms = Date.now();
  const time = Buffer.alloc(6);
  time.writeUIntBE(ms, 0, 6);
  const rand = require('crypto').randomBytes(10);
  return `${p}_${encodeBase32(Buffer.concat([time, rand])).toLowerCase()}`;
}

const newUserId = () => newEntityId('usr');
const newSoundId = () => newEntityId('snd');
const newExpeditionId = () => newEntityId('exp');
const newEventId = () => newEntityId('evt');
const newPostId = () => newEntityId('pst');

function isOpaqueId(id, prefix) {
  const s = String(id || '');
  if (prefix) return new RegExp(`^${prefix}_[0-9a-z]+$`, 'i').test(s);
  return /^(usr|snd|exp|evt|pst)_[0-9a-z]+$/i.test(s);
}

module.exports = {
  newEntityId,
  newUserId,
  newSoundId,
  newExpeditionId,
  newEventId,
  newPostId,
  isOpaqueId,
};
