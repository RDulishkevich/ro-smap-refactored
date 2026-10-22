import { useMemo } from 'react';
import { pendingSounds, rejectedSounds, roleAtLeast, type Profile, type Sound } from '@polevka/core';

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function soundTime(s: Sound): number {
  const raw = s.date || s.editedAt || s.updatedAt || s.createdAt;
  const t = raw ? new Date(String(raw)).getTime() : 0;
  return Number.isFinite(t) ? t : 0;
}

export function useStaffStats(allSounds: Sound[], profiles: Profile[], ticketCount: number) {
  return useMemo(() => {
    const live = allSounds.filter((x) => !x.deleted);
    const pending = pendingSounds(allSounds);
    const rejected = rejectedSounds(allSounds);
    const published = live.filter((x) => !x.status || x.status === 'published');
    const reported = live.filter((s) => Array.isArray(s.reports) && s.reports.length > 0);
    const reportHits = reported.reduce((n, s) => n + (s.reports as unknown[]).length, 0);
    const now = Date.now();
    const weekNew = live.filter((s) => {
      const t = soundTime(s);
      return t > 0 && now - t < WEEK_MS;
    }).length;
    const byType: Record<string, number> = {};
    for (const s of published) {
      const key = String(s.type || s.ucsCat || 'other');
      byType[key] = (byType[key] || 0) + 1;
    }
    const typeTop = Object.entries(byType).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const blocked = profiles.filter((p) => p.blocked).length;
    const staff = profiles.filter((p) => roleAtLeast(p.role, 'moderator')).length;
    const totalPool = published.length + pending.length + rejected.length;
    const pct = (n: number) => (totalPool ? Math.round((n / totalPool) * 100) : 0);
    const queueLoad = pending.length + reported.length + ticketCount;
    return {
      pending: pending.length,
      published: published.length,
      rejected: rejected.length,
      reported: reported.length,
      reportHits,
      tickets: ticketCount,
      people: profiles.length,
      blocked,
      staff,
      weekNew,
      typeTop,
      pctPublished: pct(published.length),
      pctPending: pct(pending.length),
      pctRejected: pct(rejected.length),
      queueLoad,
      totalPool,
    };
  }, [allSounds, profiles, ticketCount]);
}
