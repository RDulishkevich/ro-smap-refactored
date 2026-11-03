/**
 * Fail-closed media key rules for DeleteObject.
 * Only media/ and uploads/ — never _auth/, staging JSON, or root catalogs.
 */

const ROOT_JSON = new Set([
  'map_data.json', 'profiles.json', 'feed.json', 'events.json', 'mail.json',
  'catalog/sounds.json',
]);

function normalizeKey(raw) {
  return String(raw || '').replace(/^\/+/, '').split('?')[0].trim();
}

function parsePublicMediaKey(url, { bucket = 'rosmap2026' } = {}) {
  const s = String(url || '').split('?')[0].trim();
  if (!s) return '';
  const abs = s.match(new RegExp(`storage\\.yandexcloud\\.net\\/${bucket}\\/(.+)$`, 'i'));
  if (abs) {
    try { return decodeURIComponent(abs[1]); } catch (_) { return abs[1]; }
  }
  const rel = s.replace(/^\/+/, '');
  if (rel.startsWith('media/') || rel.startsWith('uploads/')) return rel;
  return '';
}

function isDeletableMediaKey(key) {
  const k = normalizeKey(key);
  if (!k) return false;
  if (k.includes('..') || k.includes('\\') || k.includes('\0')) return false;
  if (ROOT_JSON.has(k)) return false;
  if (k.startsWith('_auth/') || k.startsWith('_mail/') || k.startsWith('staging/')) return false;
  if (k.startsWith('auth/') || k.startsWith('meta/') || k.startsWith('catalog/')) return false;
  if (k === 'media' || k === 'media/' || k === 'uploads' || k === 'uploads/') return false;
  const parts = k.split('/').filter(Boolean);
  if (k.startsWith('media/')) return parts.length >= 4;
  if (k.startsWith('uploads/')) return parts.length >= 3;
  return false;
}

function mediaKeyOwnerHint(key) {
  const k = normalizeKey(key);
  const avatar = k.match(/^media\/avatars\/([^/]+)\//);
  if (avatar) return { type: 'avatar', id: avatar[1] };
  const sound = k.match(/^media\/sounds\/([^/]+)\//);
  if (sound) return { type: 'sound', id: sound[1] };
  const upload = k.match(/^uploads\/([^/]+)\//);
  if (upload) return { type: 'upload', id: upload[1] };
  return { type: '', id: '' };
}

function actorOwnsMediaKey(key, { login, userId, admin }) {
  if (admin) return isDeletableMediaKey(key);
  if (!isDeletableMediaKey(key)) return false;
  const hint = mediaKeyOwnerHint(key);
  const who = String(login || '').toLowerCase();
  const uid = String(userId || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
  if (hint.type === 'upload') return !!who && hint.id.toLowerCase() === who;
  if (hint.type === 'avatar') {
    if (uid && hint.id === uid) return true;
    return !!who && hint.id.toLowerCase() === who;
  }
  if (hint.type === 'sound') return false;
  return false;
}

function collectTombstonedMediaUrls(freshBoxes, mergedBoxes) {
  const urls = [];
  const seen = new Set();
  const freshMap = new Map((freshBoxes || []).map((r) => [String(r?.loginName || '').toLowerCase(), r]));
  for (const row of mergedBoxes || []) {
    const before = freshMap.get(String(row?.loginName || '').toLowerCase());
    const prevById = new Map((before?.inbox || []).map((m) => [m && m.id, m]));
    for (const msg of row.inbox || []) {
      if (!msg?.id || !msg.deleted) continue;
      const prev = prevById.get(msg.id);
      if (!prev) continue;
      for (const u of [prev.image, prev.video]) {
        const s = String(u || '');
        if (!s || seen.has(s)) continue;
        seen.add(s);
        urls.push(s);
      }
    }
  }
  return urls.slice(0, 40);
}

module.exports = {
  parsePublicMediaKey,
  isDeletableMediaKey,
  mediaKeyOwnerHint,
  actorOwnsMediaKey,
  collectTombstonedMediaUrls,
};
