import { BUCKET_URL } from './config';
import type { AppEvent, FeedPost, Profile, Sound } from './types';
import { formatSound } from './sounds';

const etags = new Map<string, string>();
const lastRaw = new Map<string, unknown>();
const lastHash = new Map<string, string>();
const lastFormatted = new Map<string, unknown>();

export function resetCatalogFetchCache() {
  etags.clear();
  lastRaw.clear();
  lastHash.clear();
  lastFormatted.clear();
}

export type CatalogPoll<T> = { data: T; unchanged: boolean };

function catalogUnavailable(status = 0): Error & { code: string; status: number } {
  const err = new Error('cloud_unavailable') as Error & { code: string; status: number };
  err.code = 'cloud_unavailable';
  err.status = status;
  return err;
}

async function bodyFingerprint(text: string): Promise<string> {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return `len:${text.length}:${text.slice(0, 80)}:${text.slice(-80)}`;
  }
}

async function fetchJson<T>(file: string): Promise<{ data: T; unchanged: boolean }> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const headers: Record<string, string> = {};
    const prev = etags.get(file);
    if (prev && lastRaw.has(file)) headers['If-None-Match'] = prev;
    const res = await fetch(`${BUCKET_URL}/${file}`, { cache: 'no-cache', headers, signal: ctrl.signal });
    if (res.status === 304) {
      const cached = lastRaw.get(file);
      if (cached !== undefined) return { data: cached as T, unchanged: true };
      // 304 without a body and without a cache — do not treat as empty catalog.
    }
    if (!res.ok) throw catalogUnavailable(res.status);
    const etag = res.headers.get('etag');
    if (etag) etags.set(file, etag);
    const text = await res.text();
    const hash = await bodyFingerprint(text);
    if (hash && hash === lastHash.get(file) && lastRaw.has(file)) {
      return { data: lastRaw.get(file) as T, unchanged: true };
    }
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw catalogUnavailable(res.status);
    }
    lastHash.set(file, hash);
    lastRaw.set(file, data);
    return { data, unchanged: false };
  } catch (e) {
    const prev = e as { code?: string; status?: number };
    if (prev?.code === 'cloud_unavailable') throw e;
    throw catalogUnavailable(prev?.status || 0);
  } finally {
    clearTimeout(timer);
  }
}

function formatCatalog<T>(file: string, data: T, unchanged: boolean, format: (raw: T) => T): CatalogPoll<T> {
  if (unchanged && lastFormatted.has(file)) {
    return { data: lastFormatted.get(file) as T, unchanged: true };
  }
  const next = format(data);
  lastFormatted.set(file, next);
  return { data: next, unchanged: false };
}

function requireArray<T>(data: unknown): T[] {
  if (!Array.isArray(data)) throw catalogUnavailable(200);
  return data as T[];
}

export async function fetchMapCatalog(): Promise<CatalogPoll<Sound[]>> {
  const { data, unchanged } = await fetchJson<unknown>('map_data.json');
  return formatCatalog('map_data.json', data, unchanged, (raw) => requireArray<unknown>(raw).map((s) => formatSound(s as Sound)));
}

export async function fetchProfilesCatalog(): Promise<CatalogPoll<Profile[]>> {
  const { data, unchanged } = await fetchJson<unknown>('profiles.json');
  return formatCatalog('profiles.json', data, unchanged, (raw) => requireArray<Profile>(raw));
}

export async function fetchFeedCatalog(): Promise<CatalogPoll<FeedPost[]>> {
  const { data, unchanged } = await fetchJson<unknown>('feed.json');
  return formatCatalog('feed.json', data, unchanged, (raw) => requireArray<FeedPost>(raw));
}

export async function fetchEventsCatalog(): Promise<CatalogPoll<AppEvent[]>> {
  const { data, unchanged } = await fetchJson<unknown>('events.json');
  return formatCatalog('events.json', data, unchanged, (raw) => requireArray<AppEvent>(raw).filter((e) => !e.deleted));
}

export async function fetchMapData(): Promise<Sound[]> {
  return (await fetchMapCatalog()).data;
}

export async function fetchProfiles(): Promise<Profile[]> {
  return (await fetchProfilesCatalog()).data;
}

export async function fetchFeed(): Promise<FeedPost[]> {
  return (await fetchFeedCatalog()).data;
}

export async function fetchEvents(): Promise<AppEvent[]> {
  return (await fetchEventsCatalog()).data;
}
