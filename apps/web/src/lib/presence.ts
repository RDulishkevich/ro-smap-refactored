import type { Profile } from '@polevka/core';
import type { Locale } from './i18n';

/** Match legacy vanilla: 2 minutes. */
export const ONLINE_THRESHOLD_MS = 2 * 60 * 1000;

export function isUserOnline(profile?: Profile | null): boolean {
  if (!profile?.lastSeen) return false;
  const t = new Date(profile.lastSeen).getTime();
  if (Number.isNaN(t)) return false;
  return Date.now() - t < ONLINE_THRESHOLD_MS;
}

export function formatPresenceLabel(profile: Profile | null | undefined, locale: Locale = 'ru'): string {
  if (isUserOnline(profile)) return locale === 'en' ? 'online' : 'в сети';
  if (!profile?.lastSeen) return locale === 'en' ? 'offline' : 'не в сети';
  const seen = new Date(profile.lastSeen);
  if (Number.isNaN(seen.getTime())) return locale === 'en' ? 'offline' : 'не в сети';
  const diff = Date.now() - seen.getTime();
  if (locale === 'en') {
    if (diff < 60_000) return 'last seen just now';
    if (diff < 3_600_000) return `last seen ${Math.floor(diff / 60_000)} min ago`;
    if (diff < 86_400_000) return `last seen ${Math.floor(diff / 3_600_000)} h ago`;
    return `last seen ${seen.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
  }
  if (diff < 60_000) return 'был(а) в сети только что';
  if (diff < 3_600_000) return `был(а) в сети ${Math.floor(diff / 60_000)} мин. назад`;
  if (diff < 86_400_000) return `был(а) в сети ${Math.floor(diff / 3_600_000)} ч. назад`;
  return `был(а) в сети ${seen.toLocaleString('ru-RU', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`;
}
