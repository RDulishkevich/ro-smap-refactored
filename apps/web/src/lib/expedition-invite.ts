import { apiSyncJson, makeMailMsg, upsertInboxPatch, type Expedition, type ExpeditionInvite, type MailBox, type Profile, type Sound } from '@polevka/core';
import { soundOwnerLogin } from './sound-media';

export function ownerOfSound(sound: Sound, profiles: Profile[]): string {
  const direct = soundOwnerLogin(sound);
  if (!direct) return '';
  const hit = profiles.find((p) => {
    const login = String(p.loginName || '').toLowerCase();
    const name = String(p.displayName || p.username || '').toLowerCase();
    return login === direct || name === direct;
  });
  return hit ? String(hit.loginName || '').toLowerCase() : direct;
}

export function isOwnSound(sound: Sound, login: string, profiles: Profile[]) {
  const me = login.toLowerCase();
  return ownerOfSound(sound, profiles) === me;
}

export async function sendExpeditionInvites(opts: {
  mail: MailBox[];
  ownerLogin: string;
  ownerName: string;
  expedition: Expedition;
  invites: ExpeditionInvite[];
}) {
  const pending = opts.invites.filter((i) => i.status === 'pending');
  if (!pending.length) return;
  for (const inv of pending) {
    const msg = makeMailMsg(
      opts.ownerLogin,
      opts.ownerName,
      `Приглашение в экспедицию «${opts.expedition.title}»`,
    );
    const notif = {
      id: `n${Date.now()}${inv.login}`,
      type: 'expedition-invite',
      text: `${opts.ownerName} приглашает в экспедицию «${opts.expedition.title}»`,
      fromId: opts.ownerLogin,
      fromName: opts.ownerName,
      date: msg.date,
      read: false,
      expeditionId: opts.expedition.id,
      expeditionOwner: opts.ownerLogin,
      soundId: inv.soundId,
    };
    await apiSyncJson('mail.json', upsertInboxPatch(opts.mail, inv.login, msg, notif));
  }
}

export async function resolveExpeditionInvite(opts: {
  profiles: Profile[];
  accept: boolean;
  expeditionId: string;
  expeditionOwner: string;
  soundId: string;
  memberLogin: string;
}) {
  const ownerKey = opts.expeditionOwner.toLowerCase();
  const member = opts.memberLogin.toLowerCase();
  const owner = opts.profiles.find((p) => String(p.loginName || '').toLowerCase() === ownerKey);
  if (!owner) throw new Error('Экспедиция не найдена');
  const sessions = [...(owner.sessions || [])];
  const idx = sessions.findIndex((s) => String(s.id) === String(opts.expeditionId));
  if (idx < 0) throw new Error('Экспедиция не найдена');
  const exp = { ...sessions[idx] };
  const invites = [...(exp.invites || [])];
  const i = invites.findIndex((x) => x.login === member && String(x.soundId) === String(opts.soundId));
  if (i >= 0) invites[i] = { ...invites[i], status: opts.accept ? 'accepted' : 'declined' };
  else if (opts.accept) invites.push({ login: member, soundId: String(opts.soundId), status: 'accepted' });
  const members = new Set((exp.members || []).map((m) => m.toLowerCase()));
  const soundIds = new Set((exp.soundIds || []).map(String));
  if (opts.accept) {
    members.add(member);
    if (opts.soundId) soundIds.add(String(opts.soundId));
  }
  sessions[idx] = {
    ...exp,
    invites,
    members: [...members],
    soundIds: [...soundIds],
    n: Math.max(Number(exp.n) || 0, soundIds.size),
  };
  await apiSyncJson('profiles.json', [{
    ...owner,
    loginName: owner.loginName,
    sessions,
    profileUpdatedAt: new Date().toISOString(),
  }]);
}
