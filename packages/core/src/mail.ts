import type { MailBox, MailMsg, Profile } from './types';

export const SUPPORT_LOGIN = 'support';
export const SUPPORT_NAME = 'Поддержка Полёвки';

export function normalizeMail(raw: unknown[]): MailBox[] {
  return (Array.isArray(raw) ? raw : []).map((row) => {
    const r = (row || {}) as MailBox;
    return {
      loginName: String(r.loginName || '').toLowerCase(),
      inbox: Array.isArray(r.inbox) ? r.inbox : [],
      notifications: Array.isArray(r.notifications) ? r.notifications : [],
      activityLog: Array.isArray(r.activityLog) ? r.activityLog : [],
    };
  }).filter((b) => b.loginName);
}

export function upsertInbox(boxes: MailBox[], login: string, msg: MailMsg, notif?: Record<string, unknown>): MailBox[] {
  const key = String(login || '').toLowerCase();
  const next = boxes.map((b) => ({ ...b, loginName: String(b.loginName || '').toLowerCase() }));
  const i = next.findIndex((b) => b.loginName === key);
  const row: MailBox = i >= 0 ? next[i] : { loginName: key, inbox: [], notifications: [], activityLog: [] };
  const updated: MailBox = {
    ...row,
    inbox: [msg, ...(row.inbox || [])].slice(0, 200),
    notifications: notif ? [notif, ...(row.notifications || [])].slice(0, 60) : (row.notifications || []),
  };
  if (i < 0) return [...next, updated];
  const copy = [...next];
  copy[i] = updated;
  return copy;
}

/** Only the mailbox that changed — server merge keeps the rest. */
export function upsertInboxPatch(boxes: MailBox[], login: string, msg: MailMsg, notif?: Record<string, unknown>): MailBox[] {
  const all = upsertInbox(boxes, login, msg, notif);
  const key = String(login || '').toLowerCase();
  return all.filter((b) => b.loginName === key);
}

export function threadWith(boxes: MailBox[], me: string, peer: string): Array<MailMsg & { mine: boolean }> {
  const self = String(me || '').toLowerCase();
  const other = String(peer || '').toLowerCase();
  const incoming = (boxes.find((b) => b.loginName === self)?.inbox || [])
    .filter((m) => String(m.fromId || '').toLowerCase() === other && !m.deleted)
    .map((m) => ({ ...m, mine: false }));
  const outgoing = (boxes.find((b) => b.loginName === other)?.inbox || [])
    .filter((m) => String(m.fromId || '').toLowerCase() === self && !m.deleted)
    .map((m) => ({ ...m, mine: true }));
  return [...incoming, ...outgoing].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}

export function conversationPeers(boxes: MailBox[], me: string, profiles: Profile[]) {
  const self = String(me || '').toLowerCase();
  const peers = new Set<string>();
  peers.add(SUPPORT_LOGIN);
  const mine = boxes.find((b) => b.loginName === self);
  (mine?.inbox || []).forEach((m) => {
    const id = String(m.fromId || '').toLowerCase();
    if (id && id !== self) peers.add(id);
  });
  boxes.forEach((b) => {
    if (b.loginName === self) return;
    if ((b.inbox || []).some((m) => String(m.fromId || '').toLowerCase() === self && !m.deleted)) {
      peers.add(b.loginName);
    }
  });
  return [...peers].map((login) => {
    const p = profiles.find((x) => String(x.loginName || '').toLowerCase() === login);
    const lastIn = (mine?.inbox || []).filter((m) => String(m.fromId || '').toLowerCase() === login && !m.deleted)[0];
    const lastOut = (boxes.find((b) => b.loginName === login)?.inbox || [])
      .filter((m) => String(m.fromId || '').toLowerCase() === self && !m.deleted)[0];
    const last = [lastIn, lastOut].filter(Boolean).sort((a, b) => new Date(String(b?.date)).getTime() - new Date(String(a?.date)).getTime())[0];
    return {
      login,
      name: login === SUPPORT_LOGIN ? SUPPORT_NAME : String(p?.displayName || p?.username || login),
      lastText: last?.deleted ? '' : (last?.text || ''),
      lastDate: last?.date || '',
    };
  }).sort((a, b) => new Date(b.lastDate || 0).getTime() - new Date(a.lastDate || 0).getTime());
}

export function makeMailMsg(fromId: string, fromName: string, text: string, extra: Partial<MailMsg> = {}): MailMsg {
  return {
    id: `m${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    fromId,
    fromName,
    text,
    date: new Date().toISOString(),
    read: false,
    ...extra,
  };
}
