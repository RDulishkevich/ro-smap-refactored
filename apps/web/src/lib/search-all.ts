import { soundSearchBlob, type AppEvent, type Expedition, type FeedPost, type Profile, type Sound } from '@polevka/core';

export type SearchHit =
  | { kind: 'sound'; id: string; title: string; hint: string; sound: Sound }
  | { kind: 'expedition'; id: string; title: string; hint: string; exp: Expedition }
  | { kind: 'event'; id: string; title: string; hint: string; event: AppEvent }
  | { kind: 'person'; id: string; title: string; hint: string; profile: Profile }
  | { kind: 'post'; id: string; title: string; hint: string };

const KIND_LIMIT = 8;

function hay(parts: unknown[]) {
  return parts.map((v) => String(v || '')).join(' ').toLowerCase();
}

export function searchAll(q: string, data: {
  sounds: Sound[];
  profiles: Profile[];
  events: AppEvent[];
  feed: FeedPost[];
}): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (needle.length < 1) return [];
  const hits: SearchHit[] = [];

  for (const sound of data.sounds) {
    if (!soundSearchBlob(sound).includes(needle)) continue;
    hits.push({
      kind: 'sound',
      id: `s-${sound.id}`,
      title: String(sound.title || 'Без названия'),
      hint: [sound.location, sound.user || sound.recordist].filter(Boolean).join(' · '),
      sound,
    });
    if (hits.filter((h) => h.kind === 'sound').length >= KIND_LIMIT) break;
  }

  const expeditions: Expedition[] = data.profiles.flatMap((p) => (p.sessions || []).map((s) => ({
    ...s,
    ownerLogin: s.ownerLogin || p.loginName,
  })));
  for (const exp of expeditions) {
    if (!hay([exp.title, exp.desc, exp.preview, exp.ownerLogin]).includes(needle)) continue;
    hits.push({
      kind: 'expedition',
      id: `x-${exp.id || exp.title}`,
      title: exp.title,
      hint: String(exp.desc || 'Экспедиция'),
      exp,
    });
    if (hits.filter((h) => h.kind === 'expedition').length >= KIND_LIMIT) break;
  }

  for (const event of data.events) {
    if (!hay([event.title, event.loc, event.location, event.tag, event.status]).includes(needle)) continue;
    hits.push({
      kind: 'event',
      id: `e-${event.id || event.title}`,
      title: event.title,
      hint: [event.loc || event.location, event.date].filter(Boolean).join(' · ') || 'Событие',
      event,
    });
    if (hits.filter((h) => h.kind === 'event').length >= KIND_LIMIT) break;
  }

  for (const profile of data.profiles) {
    const login = String(profile.loginName || profile.login || '');
    if (!hay([profile.displayName, profile.username, login, profile.bio, profile.gear]).includes(needle)) continue;
    hits.push({
      kind: 'person',
      id: `p-${login}`,
      title: String(profile.displayName || profile.username || login),
      hint: login ? `@${login}` : 'Профиль',
      profile,
    });
    if (hits.filter((h) => h.kind === 'person').length >= KIND_LIMIT) break;
  }

  for (const post of data.feed) {
    if (!hay([post.title, post.text, post.author]).includes(needle)) continue;
    hits.push({
      kind: 'post',
      id: `f-${post.id || post.title}`,
      title: String(post.title || 'Публикация'),
      hint: String(post.text || post.author || '').slice(0, 80),
    });
    if (hits.filter((h) => h.kind === 'post').length >= KIND_LIMIT) break;
  }

  return hits;
}

export const SEARCH_KIND_LABEL: Record<SearchHit['kind'], string> = {
  sound: 'Звук',
  expedition: 'Экспедиция',
  event: 'Событие',
  person: 'Человек',
  post: 'Лента',
};
