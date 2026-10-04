import { BUCKET_URL } from './config';
import type { AppEvent, FeedPost, Profile, Sound } from './types';
import { formatSound } from './sounds';

const etags = new Map<string, string>();
const lastRaw = new Map<string, unknown>();
const lastFormatted = new Map<string, unknown>();

async function fetchJson<T>(file: string): Promise<{ data: T; unchanged: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const headers: Record<string, string> = {};
    const prev = etags.get(file);
    if (prev) headers['If-None-Match'] = prev;
    const res = await fetch(`${BUCKET_URL}/${file}`, { cache: 'no-cache', headers, signal: ctrl.signal });
    if (res.status === 304) {
      const cached = lastRaw.get(file);
      if (cached !== undefined) return { data: cached as T, unchanged: true };
    }
    if (!res.ok) {
      const err = new Error('cloud_unavailable') as Error & { code: string; status: number };
      err.code = 'cloud_unavailable';
      err.status = res.status;
      throw err;
    }
    const etag = res.headers.get('etag');
    if (etag) etags.set(file, etag);
    const data = await res.json() as T;
    lastRaw.set(file, data);
    return { data, unchanged: false };
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
  const { data, unchanged } = await fetchJson<unknown[]>('map_data.json');
  if (unchanged && lastFormatted.has('map_data.json')) return lastFormatted.get('map_data.json') as Sound[];
  if (!Array.isArray(data)) return [];
  const sounds = data.map((s) => formatSound(s as Sound));
  lastFormatted.set('map_data.json', sounds);
  return sounds;
}

export async function fetchProfiles(): Promise<Profile[]> {
  const { data, unchanged } = await fetchJson<unknown[]>('profiles.json');
  if (unchanged && lastFormatted.has('profiles.json')) return lastFormatted.get('profiles.json') as Profile[];
  const list = Array.isArray(data) ? data as Profile[] : [];
  lastFormatted.set('profiles.json', list);
  return list;
}

export async function fetchFeed(): Promise<FeedPost[]> {
  const { data, unchanged } = await fetchJson<unknown[]>('feed.json');
  if (unchanged && lastFormatted.has('feed.json')) return lastFormatted.get('feed.json') as FeedPost[];
  const list = Array.isArray(data) ? data as FeedPost[] : [];
  lastFormatted.set('feed.json', list);
  return list;
}

export async function fetchEvents(): Promise<AppEvent[]> {
  const { data, unchanged } = await fetchJson<unknown[]>('events.json');
  if (unchanged && lastFormatted.has('events.json')) return lastFormatted.get('events.json') as AppEvent[];
  const list = Array.isArray(data) ? data as AppEvent[] : [];
  lastFormatted.set('events.json', list);
  return list;
}
