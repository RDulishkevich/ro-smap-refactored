import type { Sound } from './types';

export type CatalogFilter = {
  eco: string;
  ucs: string;
  ucsSub: string;
  tag: string;
  gear: string;
  channels: string;
  q: string;
  type: string;
};

export const EMPTY_FILTER: CatalogFilter = {
  eco: '',
  ucs: '',
  ucsSub: '',
  tag: '',
  gear: '',
  channels: '',
  q: '',
  type: '',
};

export function soundSearchBlob(s: Sound) {
  return [
    s.title, s.location, s.user, s.recordist, s.recordistId, s.description,
    s.type, s.ecoCategory, s.ucsCat, s.ucsCatId, s.fxName, s.gear, s.recorder,
    s.microphone, s.channels, s.principle, s.weather,
    ...(s.tagArray || []),
  ].map((v) => String(v || '')).join(' ').toLowerCase();
}

export function soundMatchesFilter(s: Sound, f: CatalogFilter): boolean {
  if (s.deleted) return false;
  if (f.type && String(s.type || '') !== f.type) return false;
  const q = (f.q || '').trim().toLowerCase();
  if (q && !soundSearchBlob(s).includes(q)) return false;
  if (f.eco && String(s.ecoCategory || '') !== f.eco) return false;
  if (f.ucs) {
    const cat = String(s.ucsCat || s.ucsCategory || '').toUpperCase();
    const id = String(s.ucsCatId || '').toUpperCase();
    const needle = f.ucs.toUpperCase();
    if (cat !== needle && id !== needle && !id.startsWith(needle) && !cat.includes(needle)) return false;
  }
  if (f.ucsSub) {
    const id = String(s.ucsCatId || '').toUpperCase();
    if (id !== f.ucsSub.toUpperCase()) return false;
  }
  if (f.tag) {
    const tags = (s.tagArray || []).map((t) => String(t).toLowerCase());
    const blob = `${s.title} ${s.description || ''} ${s.type || ''}`.toLowerCase();
    if (!tags.includes(f.tag.toLowerCase()) && !blob.includes(f.tag.toLowerCase())) return false;
  }
  if (f.gear) {
    const g = `${s.gear || ''} ${s.recorder || ''} ${s.microphone || ''}`.toLowerCase();
    if (!g.includes(f.gear.toLowerCase())) return false;
  }
  if (f.channels && String(s.channels || '') !== f.channels) return false;
  return true;
}

export function filterSounds(list: Sound[], f: CatalogFilter): Sound[] {
  if (!f.eco && !f.ucs && !f.ucsSub && !f.tag && !f.gear && !f.channels && !f.q && !f.type) return list.filter((s) => !s.deleted);
  return list.filter((s) => soundMatchesFilter(s, f));
}
