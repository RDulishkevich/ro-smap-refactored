/** Client anti-spam cooldowns — complements API rate limits. */

window.__spamBuckets = window.__spamBuckets || {};

/**
 * @param {string} key
 * @param {{ minIntervalMs?: number, maxPerWindow?: number, windowMs?: number }} opts
 * @returns {{ ok: boolean, waitMs?: number, reason?: string }}
 */
window.spamGuardCheck = function(key, opts = {}) {
    const minIntervalMs = opts.minIntervalMs ?? 1200;
    const maxPerWindow = opts.maxPerWindow ?? 8;
    const windowMs = opts.windowMs ?? 60000;
    const now = Date.now();
    const bucket = window.__spamBuckets[key] || { times: [], last: 0 };

    if (bucket.last && now - bucket.last < minIntervalMs) {
        return { ok: false, waitMs: minIntervalMs - (now - bucket.last), reason: 'cooldown' };
    }

    bucket.times = (bucket.times || []).filter((t) => now - t < windowMs);
    if (bucket.times.length >= maxPerWindow) {
        const waitMs = windowMs - (now - bucket.times[0]);
        return { ok: false, waitMs, reason: 'burst' };
    }

    bucket.times.push(now);
    bucket.last = now;
    window.__spamBuckets[key] = bucket;
    return { ok: true };
};

window.spamGuardToast = function(result) {
    const sec = Math.max(1, Math.ceil((result.waitMs || 1000) / 1000));
    const msg = result.reason === 'burst'
        ? `Слишком много действий. Подождите ${sec} с.`
        : `Подождите ${sec} с перед следующим действием.`;
    if (window.showToast) window.showToast(msg);
};
