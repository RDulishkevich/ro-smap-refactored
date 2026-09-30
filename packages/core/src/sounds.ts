import type { Comment, Sound } from './types';

function randomId(prefix: string) {
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function normalizeComment(c: Partial<Comment> & Record<string, unknown>): Comment {
  return {
    id: String(c.id || randomId('c')),
    author: String(c.author || 'Гость'),
    authorId: (c.authorId as string) || null,
    text: String(c.text || ''),
    date: String(c.date || ''),
    replies: Array.isArray(c.replies)
      ? c.replies.map((r) => ({
        id: String(r.id || randomId('cr')),
        author: String(r.author || 'Гость'),
        authorId: r.authorId || null,
        text: String(r.text || ''),
        date: String(r.date || ''),
      }))
      : [],
    reactedBy: Array.isArray(c.reactedBy) ? c.reactedBy.map(String) : [],
    reports: Array.isArray(c.reports) ? c.reports : [],
  };
}

const TYPE_FROM_UCS: Record<string, string> = {
  WATER: 'water',
  ANIMALS: 'birds',
  BIRDS: 'birds',
  AMBIENCE: 'urban',
  INDUSTRIAL: 'urban',
  VEHICLES: 'urban',
  NATURE: 'nature',
  WEATHER: 'nature',
  PLANTS: 'forest',
};

export function inferSoundType(s: Sound): string {
  if (s.type && ['nature', 'water', 'urban', 'forest', 'birds'].includes(String(s.type))) return String(s.type);
  const ucs = String(s.ucsCat || '').toUpperCase();
  if (TYPE_FROM_UCS[ucs]) return TYPE_FROM_UCS[ucs];
  const eco = String(s.ecoCategory || '');
  if (eco === 'geophony') return 'nature';
  if (eco === 'biophony') return 'birds';
  if (eco === 'anthrophony') return 'urban';
  return 'nature';
}

export function formatSound(s: Sound): Sound {
  const comments = Array.isArray(s.comments) ? s.comments.map((c) => normalizeComment(c)) : [];
  const type = inferSoundType(s);
  const location = String(s.location || [s.lat, s.lng].filter(Boolean).join(', ') || 'Ростовская область');
  const plays = s.plays ?? 0;
  const likes = Array.isArray(s.likedBy) ? s.likedBy.length : Number(s.likes || 0);
  return {
    ...s,
    type,
    location,
    comments,
    plays,
    likes,
    user: String(s.user || s.recordist || 'Автор'),
    duration: String(s.duration || '0:00'),
    wf: Number(s.wf ?? Math.abs(Number(s.id) || 0) % 4),
    status: s.status || 'published',
    likedBy: Array.isArray(s.likedBy) ? s.likedBy : [],
    dislikedBy: Array.isArray(s.dislikedBy) ? s.dislikedBy : [],
  };
}

export function publishedSounds(list: Sound[]) {
  return list.filter((s) => !s.deleted && (!s.status || s.status === 'published'));
}

export function pendingSounds(list: Sound[]) {
  return list.filter((s) => !s.deleted && s.status === 'pending');
}

export function draftSounds(list: Sound[]) {
  return list.filter((s) => !s.deleted && s.status === 'draft');
}

export function rejectedSounds(list: Sound[]) {
  return list.filter((s) => !s.deleted && s.status === 'rejected');
}

export function soundsByAuthor(list: Sound[], login: string, displayName?: string) {
  const l = login.toLowerCase();
  const n = String(displayName || '').toLowerCase();
  return list.filter((s) => {
    const id = String(s.recordistId || '').toLowerCase();
    const user = String(s.user || s.recordist || '').toLowerCase();
    return id === l || user === l || (!!n && user === n);
  });
}

export function formatPlays(n: number | string | undefined) {
  const v = typeof n === 'string' ? parseInt(n, 10) || 0 : Number(n || 0);
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.0', '')}к`;
  return String(v);
}

export const WF = [
  [0.3, 0.6, 0.8, 0.5, 0.9, 0.4, 0.7, 0.5, 0.8, 0.6, 0.3, 0.9, 0.7, 0.4, 0.6, 0.8, 0.5, 0.7, 0.4, 0.6, 0.9, 0.5, 0.3, 0.7, 0.8, 0.4, 0.6, 0.5, 0.9, 0.3],
  [0.6, 0.4, 0.7, 0.9, 0.5, 0.8, 0.3, 0.6, 0.9, 0.4, 0.7, 0.5, 0.8, 0.6, 0.3, 0.9, 0.5, 0.7, 0.4, 0.8, 0.6, 0.3, 0.7, 0.5, 0.4, 0.9, 0.6, 0.8, 0.3, 0.7],
  [0.5, 0.7, 0.4, 0.8, 0.6, 0.3, 0.9, 0.5, 0.7, 0.8, 0.4, 0.6, 0.5, 0.9, 0.7, 0.3, 0.8, 0.5, 0.6, 0.4, 0.9, 0.7, 0.5, 0.3, 0.8, 0.6, 0.4, 0.7, 0.9, 0.5],
  [0.8, 0.5, 0.3, 0.7, 0.9, 0.6, 0.4, 0.8, 0.5, 0.7, 0.3, 0.9, 0.6, 0.4, 0.8, 0.5, 0.7, 0.3, 0.9, 0.6, 0.4, 0.8, 0.5, 0.7, 0.3, 0.6, 0.9, 0.4, 0.7, 0.5],
];
