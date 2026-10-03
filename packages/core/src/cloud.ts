import { BUCKET_URL } from './config';
import type { AppEvent, FeedPost, Profile, Sound } from './types';
import { formatSound } from './sounds';

async function fetchJson<T>(file: string): Promise<T | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(`${BUCKET_URL}/${file}`, { cache: 'no-cache', signal: ctrl.signal });
    if (!res.ok) {
      const err = new Error('cloud_unavailable') as Error & { code: string; status: number };
      err.code = 'cloud_unavailable';
      err.status = res.status;
      throw err;
    }
    return await res.json() as T;
  } catch (e) {
    const prev = e as { code?: string; status?: number };
    if (prev?.code === 'cloud_unavailable') throw e;
    const err = new Error('cloud_unavailable') as Error & { code: string; status: number };
    err.code = 'cloud_unavailable';
    err.status = prev?.status || 0;
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchMapData(): Promise<Sound[]> {
  const raw = await fetchJson<unknown[]>('map_data.json');
  if (!Array.isArray(raw)) return [];
  return raw.map((s) => formatSound(s as Sound));
}

export async function fetchProfiles(): Promise<Profile[]> {
  const raw = await fetchJson<unknown[]>('profiles.json');
  return Array.isArray(raw) ? raw as Profile[] : [];
}

export async function fetchFeed(): Promise<FeedPost[]> {
  const raw = await fetchJson<unknown[]>('feed.json');
  return Array.isArray(raw) ? raw as FeedPost[] : [];
}

export async function fetchEvents(): Promise<AppEvent[]> {
  const raw = await fetchJson<unknown[]>('events.json');
  return Array.isArray(raw) ? raw as AppEvent[] : [];
}
