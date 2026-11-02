const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function encodeBase32(bytes: Uint8Array) {
  let bits = 0;
  let value = 0;
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    value = (value << 8) | bytes[i];
    bits += 8;
    while (bits >= 5) {
      out += CROCKFORD[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += CROCKFORD[(value << (5 - bits)) & 31];
  return out;
}

export function newEntityId(prefix: string) {
  const p = String(prefix || 'id').replace(/[^a-z]/gi, '').toLowerCase().slice(0, 4) || 'id';
  let ms = Date.now();
  const time = new Uint8Array(6);
  for (let i = 5; i >= 0; i--) {
    time[i] = ms & 0xff;
    ms = Math.floor(ms / 256);
  }
  const rand = new Uint8Array(10);
  crypto.getRandomValues(rand);
  const all = new Uint8Array(16);
  all.set(time, 0);
  all.set(rand, 6);
  return `${p}_${encodeBase32(all).toLowerCase()}`;
}

export const newUserId = () => newEntityId('usr');
export const newSoundId = () => newEntityId('snd');
export const newExpeditionId = () => newEntityId('exp');
export const newEventId = () => newEntityId('evt');
export const newPostId = () => newEntityId('pst');
