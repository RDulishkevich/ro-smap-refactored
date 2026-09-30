import { BUCKET_URL } from './config';
import type { AppEvent, FeedPost, Profile, Sound } from './types';
import { formatSound } from './sounds';

async function fetchJson<T>(file: string): Promise<T | null> {
  try {
    const res = await fetch(`${BUCKET_URL}/${file}?nocache=${Date.now()}`);
    if (!res.ok) return null;
    return await res.json() as T;
  } catch {
    return null;
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
