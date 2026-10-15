import type { AppEvent, Profile, Sound } from '@polevka/core';
import type { ScreenConfig } from '../state/NavContext';

export type MailNotif = {
  id?: string;
  type?: string;
  fromName?: string;
  fromId?: string;
  text?: string;
  date?: string;
  expeditionId?: string;
  expeditionOwner?: string;
  soundId?: string | number;
  soundTitle?: string;
};

export function openNotification(
  n: MailNotif,
  ctx: {
    push: (s: ScreenConfig) => void;
    sounds: Sound[];
    profiles: Profile[];
    events: AppEvent[];
  },
): boolean {
  const { push, sounds, profiles, events } = ctx;
  const from = String(n.fromId || '').replace(/^@/, '').toLowerCase();
  const soundId = n.soundId != null ? String(n.soundId) : '';

  if (soundId) {
    const sound = sounds.find((s) => String(s.id) === soundId);
    if (sound) {
      push({ type: 'sound-detail', sound });
      return true;
    }
  }

  if (n.type === 'expedition-invite' && n.expeditionId) {
    const owner = String(n.expeditionOwner || from).toLowerCase();
    const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === owner);
    const exp = (profile?.sessions || []).find((s) => String(s.id) === String(n.expeditionId));
    if (exp) {
      push({ type: 'expedition-detail', exp });
      return true;
    }
  }

  if (n.type === 'message' && from) {
    const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === from);
    push({
      type: 'conversation',
      name: String(n.fromName || profile?.displayName || profile?.username || from),
      avatar: String(profile?.avatar || '👤'),
      peer: from,
    });
    return true;
  }

  if (from) {
    const profile = profiles.find((p) => String(p.loginName || '').toLowerCase() === from);
    push({
      type: 'user-profile',
      name: String(n.fromName || profile?.displayName || profile?.username || from),
      avatar: String(profile?.avatar || '🎙️'),
      username: `@${from}`,
    });
    return true;
  }

  if (n.type === 'event' && n.text) {
    const hit = events.find((e) => String(e.title || '').toLowerCase().includes(String(n.text).slice(0, 24).toLowerCase()));
    if (hit?.id) {
      push({ type: 'events', focusId: String(hit.id) });
      return true;
    }
  }

  return false;
}
