import { BUCKET_URL } from '@polevka/core';

/** Resolve profile/cover URLs that may be absolute, data:, or bucket-relative. */
export function resolveMediaUrl(raw?: string | null): string | undefined {
  const v = String(raw || '').trim();
  if (!v) return undefined;
  // Emoji / short placeholders (🎙️, 👤) are not media URLs.
  if (v.length <= 8 && !/[a-z0-9./:_-]/i.test(v)) return undefined;
  if (/^(https?:|data:|blob:)/i.test(v)) return v;
  if (v.startsWith('//')) return `https:${v}`;
  // App shell assets (favicon / PWA icons) live on the site origin, not Object Storage.
  if (/^\/(favicon|icon-\d+|apple-touch-icon|manifest)/i.test(v)) return v;
  if (v.startsWith('/')) return `${BUCKET_URL}${v}`;
  if (!v.includes('://') && (v.includes('/') || /\.(jpe?g|png|webp|gif|avif)$/i.test(v))) {
    return `${BUCKET_URL}/${v.replace(/^\.?\//, '')}`;
  }
  return undefined;
}

export function isMediaUrl(raw?: string | null): boolean {
  return !!resolveMediaUrl(raw);
}
