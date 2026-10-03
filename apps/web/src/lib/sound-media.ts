import type { Sound } from '@polevka/core';

export type RoutePt = { lat: number; lng: number };

export function isAmbisonicChannels(value?: string | null) {
  return /ambison/i.test(String(value || ''));
}

export function isSoundwalkPrinciple(value?: string | null) {
  const v = String(value || '');
  return /soundwalk/i.test(v) || /прогулк/i.test(v);
}

export function isAmbisonicSound(sound?: Sound | null) {
  if (!sound) return false;
  const ch = String(sound.channels || '');
  return isAmbisonicChannels(ch) || /ambison/i.test(String(sound.principle || '')) || /^quad$/i.test(ch);
}

export function normalizeRoute(raw: unknown): RoutePt[] {
  if (!Array.isArray(raw)) return [];
  const out: RoutePt[] = [];
  for (const p of raw) {
    if (Array.isArray(p) && p.length >= 2) {
      const lat = Number(p[0]);
      const lng = Number(p[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
      continue;
    }
    if (p && typeof p === 'object') {
      const rec = p as { lat?: unknown; lng?: unknown };
      const lat = Number(rec.lat);
      const lng = Number(rec.lng);
      if (Number.isFinite(lat) && Number.isFinite(lng)) out.push({ lat, lng });
    }
  }
  return out;
}

export function soundCover(sound?: Sound | null): string | undefined {
  const imgs = sound?.images;
  if (!Array.isArray(imgs) || !imgs.length) return undefined;
  const first = String(imgs[0] || '');
  return first || undefined;
}

export function soundAuthor(sound?: Sound | null): string {
  if (!sound) return 'Исследователь';
  return String(sound.recordist || sound.user || sound.author || 'Исследователь');
}

export function soundTime(sound?: Sound | null): number {
  if (!sound) return 0;
  const raw = sound.createdAt || sound.date;
  const t = Date.parse(String(raw || ''));
  if (!Number.isNaN(t)) return t;
  const id = Number(sound.id);
  return Number.isFinite(id) ? id : 0;
}

export function soundRoute(sound?: Sound | null): RoutePt[] {
  return normalizeRoute(sound?.route);
}
