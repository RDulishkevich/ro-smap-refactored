type Bucket = { times: number[]; last: number };
const buckets: Record<string, Bucket> = {};

export function spamGuardCheck(key: string, opts: { minIntervalMs?: number; maxPerWindow?: number; windowMs?: number } = {}) {
  const minIntervalMs = opts.minIntervalMs ?? 1200;
  const maxPerWindow = opts.maxPerWindow ?? 8;
  const windowMs = opts.windowMs ?? 60000;
  const now = Date.now();
  const bucket = buckets[key] || { times: [], last: 0 };

  if (bucket.last && now - bucket.last < minIntervalMs) {
    return { ok: false, waitMs: minIntervalMs - (now - bucket.last), reason: 'cooldown' as const };
  }
  bucket.times = (bucket.times || []).filter((t) => now - t < windowMs);
  if (bucket.times.length >= maxPerWindow) {
    const waitMs = windowMs - (now - bucket.times[0]);
    return { ok: false, waitMs, reason: 'burst' as const };
  }
  bucket.times.push(now);
  bucket.last = now;
  buckets[key] = bucket;
  return { ok: true as const };
}

export function spamGuardMessage(result: { waitMs?: number; reason?: string }) {
  const sec = Math.max(1, Math.ceil((result.waitMs || 1000) / 1000));
  return result.reason === 'burst'
    ? `Слишком много действий. Подождите ${sec} с.`
    : `Подождите ${sec} с перед следующим действием.`;
}

export function escapeHtml(s: string) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
