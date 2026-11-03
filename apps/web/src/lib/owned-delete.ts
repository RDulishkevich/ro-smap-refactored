import { apiDeleteMedia, apiSyncJson, type AppEvent, type Expedition, type Profile, type Sound } from '@polevka/core';

export function eventTombstone(ev: AppEvent): AppEvent {
  return {
    id: ev.id,
    deleted: true,
    title: '',
    loc: '',
    location: '',
    date: '',
    time: '',
    tag: '',
    desc: '',
    text: '',
    participants: [],
    attendees: [],
    n: 0,
    updatedAt: new Date().toISOString(),
  };
}

export function stripExpedition(profile: Profile, expeditionId: string): Profile {
  return {
    ...profile,
    sessions: (profile.sessions || []).filter((s) => String(s.id) !== String(expeditionId)),
    profileUpdatedAt: new Date().toISOString(),
  };
}

export function soundsLinkedToExpedition(
  sounds: Sound[],
  expeditionId: string,
  soundIds?: Array<string | number>,
): Sound[] {
  const id = String(expeditionId);
  const extra = new Set((soundIds || []).map(String));
  return sounds.filter((s) => !s.deleted && (String(s.sessionId || '') === id || extra.has(String(s.id))));
}

function ownsSound(s: Sound, login: string) {
  const key = String(login || '').toLowerCase();
  const rec = String(s.recordistId || '').toLowerCase();
  const user = String(s.user || '').toLowerCase();
  return !!key && (rec === key || user === key);
}

export async function persistEventDelete(ev: AppEvent) {
  await apiSyncJson('events.json', [eventTombstone(ev)]);
}

export async function persistExpeditionDelete(opts: {
  profile: Profile;
  expedition: Expedition;
  sounds: Sound[];
  asAdmin: boolean;
  actorLogin: string;
}): Promise<{ profile: Profile; unlinked: Sound[] }> {
  const nextProfile = stripExpedition(opts.profile, String(opts.expedition.id || ''));
  const unlinked = soundsLinkedToExpedition(opts.sounds, String(opts.expedition.id || ''), opts.expedition.soundIds)
    .filter((s) => opts.asAdmin || ownsSound(s, opts.actorLogin))
    .map((s) => ({ ...s, sessionId: null }));
  await apiSyncJson('profiles.json', [nextProfile]);
  if (unlinked.length) await apiSyncJson('map_data.json', unlinked);
  const photos = (opts.expedition.photos || []).map(String).filter(Boolean);
  if (photos.length) void apiDeleteMedia(photos).catch(() => { /* GC best-effort — card already gone */ });
  return { profile: nextProfile, unlinked };
}
